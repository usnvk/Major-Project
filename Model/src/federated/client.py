import flwr as fl
import argparse
import torch
import os
from collections import OrderedDict
from src.core.model import get_resnet18, get_dataloader, train_one_epoch, validate

def main():
    parser = argparse.ArgumentParser(description="Flower Federated Learning Client")
    parser.add_argument("--node", type=str, required=True, choices=["node_A", "node_B", "node_C"], help="Node identifier (e.g. node_A)")
    parser.add_argument("--server", type=str, default="localhost:8080", help="Flower server address")
    parser.add_argument("--epochs", type=int, default=2, help="Number of local epochs per round")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size for training")
    parser.add_argument("--dp", action="store_true", default=False, help="Enable Opacus Differential Privacy (DP-SGD)")
    parser.add_argument("--noise_multiplier", type=float, default=1.0, help="DP noise multiplier (sigma)")
    parser.add_argument("--max_grad_norm", type=float, default=1.0, help="DP maximum gradient norm clipping threshold")
    parser.add_argument("--target_delta", type=float, default=1e-5, help="DP target delta")
    args = parser.parse_args()
    
    node = args.node
    print(f"[{node}] Initializing local client node (DP={'ENABLED' if args.dp else 'DISABLED'})...")
    
    # 1. Device configuration
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[{node}] Using device: {device}")
    
    # 2. Paths and DataLoaders
    train_dir = os.path.join("dataset", node, "train")
    test_dir = os.path.join("dataset", node, "test")
    
    if not os.path.exists(train_dir) or not os.path.exists(test_dir):
        raise FileNotFoundError(f"[{node}] Dataset directories not found! Make sure dataset_prep.py has run successfully.")
        
    train_loader = get_dataloader(train_dir, batch_size=args.batch_size, is_train=True)
    test_loader = get_dataloader(test_dir, batch_size=args.batch_size, is_train=False)
    
    print(f"[{node}] Loaded local data: Train samples={len(train_loader.dataset)}, Test samples={len(test_loader.dataset)}")
    
    # 3. Model setup
    model = get_resnet18(pretrained=False, privacy_preserving=args.dp).to(device)
    
    # Optimizer (only update trainable parameters - layer 4 & fc)
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()), 
        lr=1e-4
    )
    criterion = torch.nn.CrossEntropyLoss()

    # Differential Privacy setup with Opacus
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
            print(f"[{node}] 🔒 Opacus PrivacyEngine attached: noise_multiplier={args.noise_multiplier}, max_grad_norm={args.max_grad_norm}")
        except Exception as dp_err:
            print(f"[{node}] Warning: Failed to attach Opacus PrivacyEngine ({dp_err}). Running standard training.")
            args.dp = False

    def get_underlying_model():
        return model._module if hasattr(model, "_module") else model
    
    # 4. Flower Client Class
    class PyTorchFlowerClient(fl.client.NumPyClient):
        def get_parameters(self, config):
            """Returns the local model parameters as NumPy arrays."""
            m = get_underlying_model()
            return [val.cpu().numpy() for val in m.state_dict().values()]
            
        def fit(self, parameters, config):
            """Receives global parameters, updates local model, trains with DP, and returns updated parameters."""
            m = get_underlying_model()
            # Update local weights with server's aggregated weights
            params_dict = zip(m.state_dict().keys(), parameters)
            state_dict = OrderedDict({k: torch.tensor(v) for k, v in params_dict})
            m.load_state_dict(state_dict, strict=True)
            
            print(f"[{node}] Start training round...")
            for epoch in range(args.epochs):
                loss, acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
                print(f"[{node}] Epoch {epoch+1}/{args.epochs}: Train Loss={loss:.4f}, Train Accuracy={acc:.4f}")

            metrics = {}
            if args.dp and privacy_engine is not None:
                epsilon = privacy_engine.get_epsilon(delta=args.target_delta)
                print(f"[{node}] [DP] Differential Privacy Guarantee: epsilon = {epsilon:.2f}, delta = {args.target_delta}")
                metrics["epsilon"] = float(epsilon)
                metrics["delta"] = float(args.target_delta)
                
            return self.get_parameters(config={}), len(train_loader.dataset), metrics
            
        def evaluate(self, parameters, config):
            """Evaluates local model on local test set and returns loss and metrics."""
            m = get_underlying_model()
            params_dict = zip(m.state_dict().keys(), parameters)
            state_dict = OrderedDict({k: torch.tensor(v) for k, v in params_dict})
            m.load_state_dict(state_dict, strict=True)
            
            print(f"[{node}] Evaluating current model...")
            loss, acc, _, _ = validate(m, test_loader, criterion, device)
            print(f"[{node}] Evaluation results: Loss={loss:.4f}, Accuracy={acc:.4f}")
            
            return float(loss), len(test_loader.dataset), {"accuracy": float(acc)}

    # 5. Connect and Start Client
    print(f"[{node}] Connecting to Flower Server at {args.server}...")
    fl.client.start_client(
        server_address=args.server,
        client=PyTorchFlowerClient().to_client()
    )

if __name__ == "__main__":
    main()
