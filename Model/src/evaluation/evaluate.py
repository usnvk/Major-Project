import os
import torch
from torchvision.datasets import ImageFolder
from torch.utils.data import ConcatDataset, DataLoader
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
import matplotlib.pyplot as plt
import numpy as np

from src.core.model import get_resnet18, get_transforms, validate

def plot_confusion_matrix(cm, classes, title, filename):
    """Plots and saves the confusion matrix."""
    plt.figure(figsize=(6, 5))
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title(title)
    plt.colorbar()
    tick_marks = np.arange(len(classes))
    plt.xticks(tick_marks, classes)
    plt.yticks(tick_marks, classes)
    
    # Draw values in grid cells
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

def main():
    print("=== Starting Model Comparison Evaluation ===")
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # 1. Load Combined Test Dataset
    _, val_transform = get_transforms()
    nodes = ["node_A", "node_B", "node_C"]
    test_datasets = []
    
    for node in nodes:
        test_path = os.path.join("dataset", node, "test")
        if not os.path.exists(test_path):
            raise FileNotFoundError(f"Test dataset for {node} not found. Make sure dataset_prep.py has run successfully.")
        test_datasets.append(ImageFolder(test_path, transform=val_transform))
        
    combined_test_dataset = ConcatDataset(test_datasets)
    test_loader = DataLoader(combined_test_dataset, batch_size=16, shuffle=False, num_workers=0)
    print(f"Total test samples to evaluate: {len(combined_test_dataset)}")
    
    # 2. Check and Load Centralized Model
    cent_path = "centralized_model.pth"
    if not os.path.exists(cent_path):
        print(f"WARNING: Centralized model checkpoint '{cent_path}' not found! Run src/centralized.py first.")
        cent_results = None
    else:
        print("Loading Centralized model...")
        cent_model = get_resnet18(pretrained=False).to(device)
        cent_model.load_state_dict(torch.load(cent_path, map_location=device))
        
        _, _, cent_preds, cent_labels = validate(cent_model, test_loader, torch.nn.CrossEntropyLoss(), device)
        
        c_acc = accuracy_score(cent_labels, cent_preds)
        c_prec, c_rec, c_f1, _ = precision_recall_fscore_support(cent_labels, cent_preds, average='binary')
        c_cm = confusion_matrix(cent_labels, cent_preds)
        
        cent_results = {
            "Accuracy": c_acc,
            "Precision": c_prec,
            "Recall": c_rec,
            "F1-Score": c_f1,
            "CM": c_cm
        }
        
        # Save confusion matrix plot
        plot_confusion_matrix(c_cm, ["Normal", "TB"], "Centralized Model Confusion Matrix", "centralized_confusion_matrix.png")
        
    # 3. Check and Load Federated Model
    fed_path = "federated_model.pth"
    if not os.path.exists(fed_path):
        print(f"WARNING: Federated model checkpoint '{fed_path}' not found! Run Federated Learning first.")
        fed_results = None
    else:
        print("Loading Federated model...")
        fed_model = get_resnet18(pretrained=False).to(device)
        fed_model.load_state_dict(torch.load(fed_path, map_location=device))
        
        _, _, fed_preds, fed_labels = validate(fed_model, test_loader, torch.nn.CrossEntropyLoss(), device)
        
        f_acc = accuracy_score(fed_labels, fed_preds)
        f_prec, f_rec, f_f1, _ = precision_recall_fscore_support(fed_labels, fed_preds, average='binary')
        f_cm = confusion_matrix(fed_labels, fed_preds)
        
        fed_results = {
            "Accuracy": f_acc,
            "Precision": f_prec,
            "Recall": f_rec,
            "F1-Score": f_f1,
            "CM": f_cm
        }
        
        # Save confusion matrix plot
        plot_confusion_matrix(f_cm, ["Normal", "TB"], "Federated Model Confusion Matrix", "federated_confusion_matrix.png")
        
    # 4. Generate comparison table
    if cent_results and fed_results:
        print("\n" + "="*50)
        print(f"{'METRIC COMPARISON TABLE':^50}")
        print("="*50)
        print(f"{'Metric':<15} | {'Centralized':<15} | {'Federated':<15}")
        print("-" * 50)
        for metric in ["Accuracy", "Precision", "Recall", "F1-Score"]:
            c_val = cent_results[metric]
            f_val = fed_results[metric]
            print(f"{metric:<15} | {c_val:<15.4f} | {f_val:<15.4f}")
        print("="*50)
        
        # Create a combined comparison plot
        metrics = ["Accuracy", "Precision", "Recall", "F1-Score"]
        c_vals = [cent_results[m] for m in metrics]
        f_vals = [fed_results[m] for m in metrics]
        
        x = np.arange(len(metrics))
        width = 0.35
        
        fig, ax = plt.subplots(figsize=(8, 6))
        rects1 = ax.bar(x - width/2, c_vals, width, label='Centralized', color='#1f77b4')
        rects2 = ax.bar(x + width/2, f_vals, width, label='Federated', color='#ff7f0e')
        
        ax.set_ylabel('Scores')
        ax.set_title('Performance Comparison: Centralized vs Federated Model')
        ax.set_xticks(x)
        ax.set_xticklabels(metrics)
        ax.set_ylim(0, 1.1)
        ax.legend()
        
        # Add labels on top of bars
        def autolabel(rects):
            for rect in rects:
                height = rect.get_height()
                ax.annotate(f'{height:.2f}',
                            xy=(rect.get_x() + rect.get_width() / 2, height),
                            xytext=(0, 3),  # 3 points vertical offset
                            textcoords="offset points",
                            ha='center', va='bottom')
                            
        autolabel(rects1)
        autolabel(rects2)
        
        plt.tight_layout()
        plt.savefig("performance_comparison.png", dpi=300)
        plt.close()
        print("Saved performance comparison bar chart to performance_comparison.png")
    else:
        print("\nCannot generate comparison table because one or both models are missing.")

if __name__ == "__main__":
    main()
