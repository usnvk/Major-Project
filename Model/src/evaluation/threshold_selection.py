import os
import json
import argparse
import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from src.training.train_validator import ValidatorDataset, get_validator_resnet18, get_validator_transforms

def select_optimal_threshold(data_dir="data", model_path="models/validator/chest_xray_validator.pth", alpha=0.85):
    """
    Evaluates validator on validation dataset across threshold candidates to select
    the optimal threshold optimizing the FAR/FRR trade-off, prioritizing low FAR.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"=== Selecting Validator Threshold on Validation Set (Alpha={alpha}) ===")
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Validator model checkpoint '{model_path}' not found! Run train_validator.py first.")
        
    _, val_transform = get_validator_transforms()
    val_dataset = ValidatorDataset(data_dir, split="val", transform=val_transform)
    val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False, num_workers=0)
    
    model = get_validator_resnet18(pretrained=False).to(device)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()
    
    all_probs = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels, _ in val_loader:
            images = images.to(device)
            outputs = model(images)
            probs = F.softmax(outputs, dim=1)[:, 1] # Probability of Class 1 (VALID)
            
            all_probs.extend(probs.cpu().numpy())
            all_labels.extend(labels.numpy())
            
    all_probs = np.array(all_probs)
    all_labels = np.array(all_labels)
    
    valid_mask = (all_labels == 1)
    invalid_mask = (all_labels == 0)
    
    num_valid = np.sum(valid_mask)
    num_invalid = np.sum(invalid_mask)
    
    print(f"Validation Samples -> VALID (CXR): {num_valid}, INVALID (OOD): {num_invalid}")
    
    thresholds = np.linspace(0.01, 0.99, 99)
    best_loss = float('inf')
    best_thresh = 0.50
    best_far = 0.0
    best_frr = 0.0
    
    results = []
    
    for th in thresholds:
        preds = (all_probs >= th).astype(int)
        
        # FP: INVALID images predicted as VALID (1)
        fp = np.sum((preds == 1) & (all_labels == 0))
        tn = np.sum((preds == 0) & (all_labels == 0))
        far = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        
        # FN: VALID images predicted as INVALID (0)
        fn = np.sum((preds == 0) & (all_labels == 1))
        tp = np.sum((preds == 1) & (all_labels == 1))
        frr = fn / (fn + tp) if (fn + tp) > 0 else 0.0
        
        # Weighted loss prioritizing low FAR
        loss = alpha * far + (1.0 - alpha) * frr
        
        results.append({
            "threshold": float(th),
            "FAR": float(far),
            "FRR": float(frr),
            "loss": float(loss)
        })
        
        if loss < best_loss:
            best_loss = loss
            best_thresh = th
            best_far = far
            best_frr = frr
            
    print("\n" + "="*50)
    print(f"{'THRESHOLD OPTIMIZATION RESULTS':^50}")
    print("="*50)
    print(f"Selected Optimal Threshold: {best_thresh:.4f}")
    print(f"Validation FAR (False Acceptance): {best_far:.4f} ({best_far*100:.2f}%)")
    print(f"Validation FRR (False Rejection):  {best_frr:.4f} ({best_frr*100:.2f}%)")
    print(f"FAR/FRR Trade-off Loss:           {best_loss:.4f}")
    print("="*50 + "\n")
    
    config = {
        "optimal_threshold": float(best_thresh),
        "val_far": float(best_far),
        "val_frr": float(best_frr),
        "val_loss": float(best_loss),
        "alpha_far_weight": float(alpha),
        "val_valid_count": int(num_valid),
        "val_invalid_count": int(num_invalid)
    }
    
    config_path = os.path.join(os.path.dirname(model_path), "validator_config.json")
    with open(config_path, "w") as f:
        json.dump(config, f, indent=4)
        
    print(f"Saved threshold configuration to {config_path}")
    return best_thresh, config

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Select optimal threshold for validator on validation set")
    parser.add_argument("--data_dir", type=str, default="data")
    parser.add_argument("--model_path", type=str, default="models/validator/chest_xray_validator.pth")
    parser.add_argument("--alpha", type=float, default=0.85, help="Weight for FAR in loss (0 to 1)")
    args = parser.parse_args()
    
    select_optimal_threshold(args.data_dir, args.model_path, args.alpha)
