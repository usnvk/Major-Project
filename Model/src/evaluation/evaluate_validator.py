import os
import json
import argparse
import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from PIL import Image
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, precision_recall_curve, auc, confusion_matrix
)
import matplotlib.pyplot as plt

from src.training.train_validator import get_validator_resnet18, get_validator_transforms

class ComprehensiveTestDataset(Dataset):
    """Loads all test set samples with category annotations."""
    def __init__(self, root_dir, transform=None):
        self.samples = []
        self.transform = transform
        
        # 1. Load VALID Chest X-Rays
        v_dir = os.path.join(root_dir, "valid_chest_xray", "test")
        if os.path.exists(v_dir):
            for fname in os.listdir(v_dir):
                if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff')):
                    self.samples.append((os.path.join(v_dir, fname), 1, "valid_chest_xray"))
                    
        # 2. Load INVALID OOD images category by category
        inv_base = os.path.join(root_dir, "invalid")
        if os.path.exists(inv_base):
            for cat in os.listdir(inv_base):
                c_dir = os.path.join(inv_base, cat, "test")
                if os.path.exists(c_dir):
                    for fname in os.listdir(c_dir):
                        if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff')):
                            self.samples.append((os.path.join(c_dir, fname), 0, cat))
                            
    def __len__(self):
        return len(self.samples)
        
    def __getitem__(self, idx):
        path, label, category = self.samples[idx]
        img = Image.open(path).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, label, category, path

def plot_confusion_matrix(cm, classes, title, filename):
    """Plots and saves confusion matrix."""
    plt.figure(figsize=(6, 5))
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title(title)
    plt.colorbar()
    tick_marks = np.arange(len(classes))
    plt.xticks(tick_marks, classes)
    plt.yticks(tick_marks, classes)
    
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            plt.text(j, i, format(cm[i, j], 'd'),
                     horizontalalignment="center",
                     color="white" if cm[i, j] > thresh else "black")
                     
    plt.tight_layout()
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.savefig(filename, dpi=300)
    plt.close()
    print(f"Saved confusion matrix plot to {filename}")

def evaluate_validator(data_dir="data", model_path="models/validator/chest_xray_validator.pth", config_path="models/validator/validator_config.json"):
    """Comprehensive evaluation of the trained Chest X-Ray validator on the untouched test set."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"=== Comprehensive Evaluation of Validator on Untouched Test Set ({device}) ===")
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Validator model checkpoint '{model_path}' not found! Run train_validator.py first.")
        
    threshold = 0.50
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            cfg = json.load(f)
            threshold = cfg.get("optimal_threshold", 0.50)
            print(f"Loaded optimal decision threshold: {threshold:.4f}")
    else:
        print(f"WARNING: Configuration file '{config_path}' not found! Defaulting threshold to {threshold:.4f}")
        
    _, val_transform = get_validator_transforms()
    test_dataset = ComprehensiveTestDataset(data_dir, transform=val_transform)
    
    if len(test_dataset) == 0:
        raise ValueError("Test dataset is empty! Run prepare_validator_data.py first.")
        
    test_loader = DataLoader(test_dataset, batch_size=16, shuffle=False, num_workers=0)
    
    model = get_validator_resnet18(pretrained=False).to(device)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()
    
    all_probs = []
    all_labels = []
    all_categories = []
    
    with torch.no_grad():
        for images, labels, categories, _ in test_loader:
            images = images.to(device)
            outputs = model(images)
            probs = F.softmax(outputs, dim=1)[:, 1] # Probability of VALID (1)
            
            all_probs.extend(probs.cpu().numpy())
            all_labels.extend(labels.numpy())
            all_categories.extend(categories)
            
    all_probs = np.array(all_probs)
    all_labels = np.array(all_labels)
    all_categories = np.array(all_categories)
    
    preds = (all_probs >= threshold).astype(int)
    
    # Standard metrics
    acc = accuracy_score(all_labels, preds)
    prec = precision_score(all_labels, preds, zero_division=0)
    rec = recall_score(all_labels, preds, zero_division=0) # Sensitivity
    f1 = f1_score(all_labels, preds, zero_division=0)
    
    # Specificity: TN / (TN + FP)
    cm = confusion_matrix(all_labels, preds)
    tn, fp, fn, tp = cm.ravel()
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    
    # ROC-AUC & PR-AUC
    try:
        roc_auc = roc_auc_score(all_labels, all_probs)
    except Exception:
        roc_auc = 0.0
        
    try:
        precision_curve, recall_curve, _ = precision_recall_curve(all_labels, all_probs)
        pr_auc = auc(recall_curve, precision_curve)
    except Exception:
        pr_auc = 0.0
        
    # Overall FAR and FRR
    overall_far = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    overall_frr = fn / (fn + tp) if (fn + tp) > 0 else 0.0
    
    print("\n" + "="*60)
    print(f"{'VALIDATOR TEST METRICS SUMMARY':^60}")
    print("="*60)
    print(f"Optimal Threshold:            {threshold:.4f}")
    print(f"Accuracy:                     {acc:.4f} ({acc*100:.2f}%)")
    print(f"Precision:                    {prec:.4f}")
    print(f"Recall / Sensitivity:         {rec:.4f}")
    print(f"Specificity:                  {spec:.4f}")
    print(f"F1-Score:                     {f1:.4f}")
    print(f"ROC-AUC:                      {roc_auc:.4f}")
    print(f"PR-AUC:                       {pr_auc:.4f}")
    print(f"Overall FAR (False Accept):   {overall_far:.4f} ({overall_far*100:.2f}%)")
    print(f"Overall FRR (False Reject):   {overall_frr:.4f} ({overall_frr*100:.2f}%)")
    print("="*60)
    print("Confusion Matrix (0=INVALID, 1=VALID):")
    print(cm)
    print("="*60 + "\n")
    
    # Category-wise FAR/FRR Report
    print("="*65)
    print(f"{'CATEGORY-WISE BREAKDOWN & FAR/FRR METRICS':^65}")
    print("="*65)
    print(f"{'Category':<25} | {'Total':<7} | {'Accepted':<8} | {'Rejected':<8} | {'FAR/FRR':<10}")
    print("-" * 65)
    
    unique_cats = np.unique(all_categories)
    for cat in unique_cats:
        mask = (all_categories == cat)
        cat_labels = all_labels[mask]
        cat_preds = preds[mask]
        total_cat = len(cat_labels)
        
        accepted = np.sum(cat_preds == 1)
        rejected = np.sum(cat_preds == 0)
        
        if cat == "valid_chest_xray":
            # For valid CXR: metric is FRR (False Rejection Rate)
            cat_frr = rejected / total_cat if total_cat > 0 else 0.0
            print(f"{cat:<25} | {total_cat:<7} | {accepted:<8} | {rejected:<8} | FRR: {cat_frr*100:5.2f}%")
        else:
            # For invalid categories: metric is FAR (False Acceptance Rate)
            cat_far = accepted / total_cat if total_cat > 0 else 0.0
            print(f"{cat:<25} | {total_cat:<7} | {accepted:<8} | {rejected:<8} | FAR: {cat_far*100:5.2f}%")
            
    print("="*65 + "\n")
    
    # Save Confusion Matrix Plot
    plot_confusion_matrix(cm, ["INVALID", "VALID"], "Chest X-Ray Validator Confusion Matrix", "validator_confusion_matrix.png")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Chest X-Ray Validator")
    parser.add_argument("--data_dir", type=str, default="data")
    parser.add_argument("--model_path", type=str, default="models/validator/chest_xray_validator.pth")
    parser.add_argument("--config_path", type=str, default="models/validator/validator_config.json")
    args = parser.parse_args()
    
    evaluate_validator(args.data_dir, args.model_path, args.config_path)
