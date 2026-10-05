import sys
import torch
import torch.nn as nn
from opacus import PrivacyEngine
from src.core.model import get_resnet18, make_privacy_compatible

def test_dp_integration():
    print("=" * 60)
    print("  Testing Opacus Differential Privacy (DP-SGD) Integration")
    print("=" * 60)

    # 1. Model initialization with DP compatibility
    print("\n[Step 1] Initializing DP-compatible ResNet-18 model...")
    model = get_resnet18(pretrained=False, privacy_preserving=True)
    
    # Check that BatchNorm has been converted to GroupNorm
    has_bn = any(isinstance(m, nn.BatchNorm2d) for m in model.modules())
    has_gn = any(isinstance(m, nn.GroupNorm) for m in model.modules())
    print(f"  - Contains standard BatchNorm: {has_bn} (Expected: False)")
    print(f"  - Contains privacy GroupNorm:  {has_gn} (Expected: True)")
    assert not has_bn, "Model should not contain BatchNorm layers for Opacus DP!"
    assert has_gn, "Model should use GroupNorm for Opacus DP!"

    # 2. Setup Optimizer & Synthetic DataLoader
    print("\n[Step 2] Setting up DP-SGD Optimizer & DataLoader...")
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=1e-4
    )
    criterion = nn.CrossEntropyLoss()
    
    # Synthetic batch of 8 chest X-ray tensors (224x224)
    dummy_data = [(torch.randn(3, 224, 224), torch.randint(0, 2, (1,)).item()) for _ in range(8)]
    dataloader = torch.utils.data.DataLoader(dummy_data, batch_size=4)

    # 3. Attach Opacus PrivacyEngine
    print("\n[Step 3] Attaching Opacus PrivacyEngine...")
    privacy_engine = PrivacyEngine()
    private_model, private_optimizer, private_loader = privacy_engine.make_private(
        module=model,
        optimizer=optimizer,
        data_loader=dataloader,
        noise_multiplier=1.0,
        max_grad_norm=1.0,
    )
    print("  - PrivacyEngine successfully attached!")

    # 4. Perform DP-SGD Forward and Backward Step
    print("\n[Step 4] Executing DP-SGD Training Step (Per-sample clipping + noise injection)...")
    private_model.train()
    for images, labels in private_loader:
        private_optimizer.zero_grad()
        outputs = private_model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        private_optimizer.step()
        print(f"  - Step completed! Mini-batch Loss: {loss.item():.4f}")
        break

    # 5. Measure and report Privacy Budget (Epsilon, Delta)
    target_delta = 1e-5
    epsilon = privacy_engine.get_epsilon(delta=target_delta)
    print(f"\n[Step 5] Privacy Budget Evaluation:")
    print(f"  - Target Delta (delta):    {target_delta}")
    print(f"  - Current Epsilon (epsilon): {epsilon:.4f}")
    print(f"  - Privacy Guarantee: (epsilon = {epsilon:.2f}, delta = {target_delta})-DP")

    # 6. Verify Flower weight serialization from underlying module
    print("\n[Step 6] Verifying Flower Client/Server weight extraction...")
    underlying = private_model._module if hasattr(private_model, "_module") else private_model
    params = [val.cpu().numpy() for val in underlying.state_dict().values()]
    print(f"  - Extracted {len(params)} parameter tensors for Flower FedAvg aggregation.")
    
    print("\n" + "=" * 60)
    print("  All Differential Privacy (Opacus) checks PASSED successfully!")
    print("=" * 60)

if __name__ == "__main__":
    test_dp_integration()
