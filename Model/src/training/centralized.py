import os
import argparse
import torch
import torch.nn as nn
from torchvision.datasets import ImageFolder
from torch.utils.data import ConcatDataset, DataLoader
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
import matplotlib.pyplot as plt
import numpy as np

from src.core.model import get_resnet18, get_transforms, train_one_epoch, validate

def main():
    parser = argparse.ArgumentParser(description="Train Centralized TB ResNet-18 Model")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs (default: 3)")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size for DataLoader (default: 32)")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate (default: 1e-4)")
    args = parser.parse_args()

    print("=== Starting Centralized Model Training ===")
    
    # 1. Device configuration
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # 2. Paths and Datasets
    train_transform, val_transform = get_transforms()
    
    nodes = ["node_A", "node_B", "node_C"]
    train_datasets = []
    test_datasets = []
    
    for node in nodes:
        train_path = os.path.join("dataset", node, "train")
        test_path = os.path.join("dataset", node, "test")
        
        if not os.path.exists(train_path) or not os.path.exists(test_path):
            raise FileNotFoundError(f"Dataset for {node} not found! Run dataset_prep.py first.")
            
        train_datasets.append(ImageFolder(train_path, transform=train_transform))
        test_datasets.append(ImageFolder(test_path, transform=val_transform))
        
    # Combine datasets
    centralized_train = ConcatDataset(train_datasets)
    centralized_test = ConcatDataset(test_datasets)
    
    print(f"Centralized Train set size: {len(centralized_train)}")
    print(f"Centralized Test set size:  {len(centralized_test)}")
    
    # Create DataLoaders
    train_loader = DataLoader(centralized_train, batch_size=args.batch_size, shuffle=True, num_workers=0)
    test_loader = DataLoader(centralized_test, batch_size=args.batch_size, shuffle=False, num_workers=0)
    
    # 3. Model setup
    model = get_resnet18(pretrained=True).to(device)
    
    # Define optimizer (only update layer 4 and fc)
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()), 
        lr=args.lr
    )
    criterion = torch.nn.CrossEntropyLoss()
    
    # 4. Training loop
    epochs = args.epochs
    best_acc = 0.0
    
    for epoch in range(epochs):
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, _, _ = validate(model, test_loader, criterion, device)
        
        print(f"Epoch {epoch+1:02d}/{epochs:02d} | "
              f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.4f} | "
              f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.4f}")
              
        # Keep track of the best model
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), "centralized_model.pth")
            print("--> Saved new best centralized model checkpoint.")
            
    print("Training finished.")
    
    # 5. Final Evaluation
    print("\nEvaluating Best Centralized Model...")
    model.load_state_dict(torch.load("centralized_model.pth"))
    _, _, preds, labels = validate(model, test_loader, criterion, device)
    
    # Calculate metrics
    acc = accuracy_score(labels, preds)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='binary')
    cm = confusion_matrix(labels, preds)
    
    print("\nCentralized Model Metrics:")
    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1-Score:  {f1:.4f}")
    print("  Confusion Matrix:")
    print(cm)
    
if __name__ == "__main__":
    main()
