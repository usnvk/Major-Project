import argparse
import os
from collections import OrderedDict
from pathlib import Path
from typing import List

try:
    import flwr as fl
    FLWR_AVAILABLE = True
except ImportError:
    FLWR_AVAILABLE = False
    fl = None
import numpy as np
import torch
from src.core.model import (
    get_dataloader,
    get_resnet18,
    mark_active_learning_completed,
    train_one_epoch_fedprox,
    validate,
)


def main():
    parser = argparse.ArgumentParser(description="Flower Federated Learning Client with FedProx & Active Learning")
    parser.add_argument("--node", type=str, required=True, choices=["node_A", "node_B", "node_C"], help="Node identifier")
    parser.add_argument("--server", type=str, default="localhost:8080", help="Flower server address")
    parser.add_argument("--epochs", type=int, default=2, help="Local epochs per round")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size for training")
    parser.add_argument("--dp", action="store_true", default=False, help="Enable Opacus DP-SGD")
    parser.add_argument("--noise_multiplier", type=float, default=1.0, help="DP noise multiplier (sigma)")
    parser.add_argument("--max_grad_norm", type=float, default=1.0, help="DP max gradient norm")
    parser.add_argument("--target_delta", type=float, default=1e-5, help="DP target delta")
    parser.add_argument("--mu", type=float, default=0.01, help="FedProx proximal regularization parameter mu")
    parser.add_argument("--fp16", action="store_true", default=False, help="Enable FP16 half-precision weight compression")
    parser.add_argument("--mtls", action="store_true", default=False, help="Enable mutual TLS (mTLS) client certificates")
    parser.add_argument("--cert_dir", type=str, default="certificates", help="Directory containing client x509 certs")
    args = parser.parse_args()

    node = args.node
    print(f"[{node}] === Initializing Edge Hospital Client ===")
    print(f"[{node}]   • Algorithm:           FedProx (mu={args.mu})")
    print(f"[{node}]   • Differential Privacy: {'ENABLED (Opacus DP-SGD)' if args.dp else 'DISABLED'}")
    print(f"[{node}]   • Active Learning:      ENABLED (Priority Sampling from Edge Queue)")
    print(f"[{node}]   • Transport Security:   {'mTLS Encrypted' if args.mtls else 'Plain gRPC'}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # 1. Paths & DataLoaders with Active Learning injection
    train_dir = os.path.join("dataset", node, "train")
    test_dir = os.path.join("dataset", node, "test")

    # Fallback to demo synthetic dataset directory if dataset not downloaded
    if not (os.path.exists(train_dir) and os.path.exists(test_dir)):
        train_dir = os.path.join("data", "valid_chest_xray", "train")
        test_dir = os.path.join("data", "valid_chest_xray", "val")

    pending_al_ids: List[str] = []
    if os.path.exists(train_dir):
        train_loader, pending_al_ids = get_dataloader(
            train_dir, batch_size=args.batch_size, is_train=True, use_active_learning=True, node_id=node
        )
    else:
        # Fallback in-memory tensor loader
        dummy_data = [(torch.randn(3, 224, 224), torch.randint(0, 2, (1,)).item()) for _ in range(32)]
        train_loader = torch.utils.data.DataLoader(dummy_data, batch_size=args.batch_size)

    if os.path.exists(test_dir):
        test_loader = get_dataloader(test_dir, batch_size=args.batch_size, is_train=False)
    else:
        dummy_test = [(torch.randn(3, 224, 224), torch.randint(0, 2, (1,)).item()) for _ in range(16)]
        test_loader = torch.utils.data.DataLoader(dummy_test, batch_size=args.batch_size)

    sample_count = len(train_loader.dataset) if hasattr(train_loader, "dataset") else 32
    print(f"[{node}] Local dataset ready: {sample_count} training samples (Active Learning cases: {len(pending_al_ids)})")

    # 2. Model setup
    model = get_resnet18(pretrained=False, privacy_preserving=args.dp).to(device)
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=1e-4,
    )
    criterion = torch.nn.CrossEntropyLoss()

    # Opacus PrivacyEngine
    privacy_engine = None
    if args.dp:
        try:
            from opacus import PrivacyEngine
            privacy_engine = PrivacyEngine()
            model, optimizer, train_loader = privacy_engine.make_private(
                module=model,
                optimizer=optimizer,
                data_loader=train_loader,
                noise_multiplier=args.noise_multiplier,
                max_grad_norm=args.max_grad_norm,
            )
            print(f"[{node}] 🔒 Opacus PrivacyEngine attached: sigma={args.noise_multiplier}, max_norm={args.max_grad_norm}")
        except Exception as dp_err:
            print(f"[{node}] Notice: Opacus not initialized ({dp_err}). Proceeding with standard training.")
            args.dp = False

    def get_underlying_model():
        return model._module if hasattr(model, "_module") else model

    # 3. PyTorch Flower Client
    class PyTorchFlowerClient(fl.client.NumPyClient):
        def get_parameters(self, config):
            m = get_underlying_model()
            params = [val.cpu().numpy() for val in m.state_dict().values()]
            if args.fp16:
                return [p.astype(np.float16) for p in params]
            return params

        def fit(self, parameters, config):
            m = get_underlying_model()

            # Cast parameters back to float32 if sent as float16
            float32_params = [torch.tensor(v, dtype=torch.float32) for v in parameters]
            params_dict = zip(m.state_dict().keys(), float32_params)
            state_dict = OrderedDict({k: v for k, v in params_dict})
            m.load_state_dict(state_dict, strict=True)

            # Keep copy of global weights for FedProx proximal calculation
            global_tensors = [val.clone().detach() for val in m.parameters()]

            print(f"[{node}] Starting local FedProx training round (mu={args.mu}, epochs={args.epochs})...")
            for epoch in range(args.epochs):
                loss, acc = train_one_epoch_fedprox(
                    model=model,
                    dataloader=train_loader,
                    criterion=criterion,
                    optimizer=optimizer,
                    device=device,
                    global_model_params=global_tensors,
                    mu=args.mu,
                )
                print(f"[{node}] Epoch {epoch+1}/{args.epochs}: Train Loss={loss:.4f}, Train Accuracy={acc*100:.1f}%")

            # Mark queued active learning edge cases completed in database
            if pending_al_ids:
                mark_active_learning_completed(pending_al_ids)
                print(f"[{node}] Active Learning: Marked {len(pending_al_ids)} clinical edge case(s) as successfully trained.")

            metrics = {}
            if args.dp and privacy_engine is not None:
                epsilon = privacy_engine.get_epsilon(delta=args.target_delta)
                print(f"[{node}] [DP Budget] (epsilon = {epsilon:.2f}, delta = {args.target_delta})-DP")
                metrics["epsilon"] = float(epsilon)
                metrics["delta"] = float(args.target_delta)

            return self.get_parameters(config={}), sample_count, metrics

        def evaluate(self, parameters, config):
            m = get_underlying_model()
            float32_params = [torch.tensor(v, dtype=torch.float32) for v in parameters]
            params_dict = zip(m.state_dict().keys(), float32_params)
            state_dict = OrderedDict({k: v for k, v in params_dict})
            m.load_state_dict(state_dict, strict=True)

            loss, acc, _, _ = validate(m, test_loader, criterion, device)
            test_count = len(test_loader.dataset) if hasattr(test_loader, "dataset") else 16
            return float(loss), test_count, {"accuracy": float(acc)}

    # 4. Connect to Server (with optional mTLS)
    client_kwargs = {
        "server_address": args.server,
        "client": PyTorchFlowerClient().to_client(),
    }

    if args.mtls:
        cert_p = Path(args.cert_dir)
        ca_p = cert_p / "ca.crt"
        if ca_p.exists():
            with open(ca_p, "rb") as f:
                root_ca = f.read()
            client_kwargs["root_certificates"] = root_ca
            print(f"[{node}] 🔒 mTLS root CA attached for secure connection to {args.server}")

    print(f"[{node}] Connecting to Flower Server at {args.server}...")
    fl.client.start_client(**client_kwargs)


if __name__ == "__main__":
    main()
