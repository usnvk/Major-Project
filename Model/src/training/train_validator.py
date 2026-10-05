import os
import argparse
import torch
import torch.nn as nn
import torchvision
from torchvision import transforms
from torch.utils.data import Dataset, DataLoader
from PIL import Image

class ValidatorDataset(Dataset):
    """Dataset for training/validating the Chest X-Ray Validator model."""
    def __init__(self, root_dir, split="train", transform=None):
        self.samples = []
        self.transform = transform
        
        # 1. Load VALID Chest X-Rays (Label 1)
        valid_dir = os.path.join(root_dir, "valid_chest_xray", split)
        if os.path.exists(valid_dir):
            for fname in os.listdir(valid_dir):
                if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff')):
                    self.samples.append((os.path.join(valid_dir, fname), 1))
                    
        # 2. Load INVALID OOD images (Label 0)
        invalid_base = os.path.join(root_dir, "invalid")
        if os.path.exists(invalid_base):
            for cat in os.listdir(invalid_base):
                cat_dir = os.path.join(invalid_base, cat, split)
                if os.path.exists(cat_dir):
                    for fname in os.listdir(cat_dir):
                        if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff')):
                            self.samples.append((os.path.join(cat_dir, fname), 0))
                            
    def __len__(self):
        return len(self.samples)
        
    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, label, path

def get_validator_resnet18(pretrained=False):
    """Loads ResNet-18 backbone for binary validation (0: INVALID, 1: VALID)."""
    if pretrained:
        weights = torchvision.models.ResNet18_Weights.DEFAULT
        model = torchvision.models.resnet18(weights=weights)
    else:
        model = torchvision.models.resnet18()

        
    num_features = model.fc.in_features
    model.fc = nn.Linear(num_features, 2)
    return model

def get_validator_transforms():
    """Standard transforms for validator training and validation."""
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.1, contrast=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    return train_transform, val_transform

def train_validator(data_dir="data", save_dir="models/validator", epochs=5, lr=1e-4, batch_size=16):
    """Trains the Chest X-Ray validator CNN."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"=== Training Chest X-Ray Validator (ResNet-18) on {device} ===", flush=True)
    
    os.makedirs(save_dir, exist_ok=True)
    train_transform, val_transform = get_validator_transforms()
    
    train_dataset = ValidatorDataset(data_dir, split="train", transform=train_transform)
    val_dataset = ValidatorDataset(data_dir, split="val", transform=val_transform)
    
    print(f"Train Dataset Size: {len(train_dataset)} samples", flush=True)
    print(f"Val Dataset Size:   {len(val_dataset)} samples", flush=True)

    
    if len(train_dataset) == 0:
        raise ValueError("Train dataset is empty! Run prepare_validator_data.py first.")
        
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    
    model = get_validator_resnet18(pretrained=False).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    
    best_acc = 0.0
    save_path = os.path.join(save_dir, "chest_xray_validator.pth")
    
    for epoch in range(epochs):
        model.train()
        running_loss, correct, total = 0.0, 0, 0
        
        for images, labels, _ in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)
            
        train_loss = running_loss / total
        train_acc = correct / total
        
        # Validation pass
        model.eval()
        v_loss, v_correct, v_total = 0.0, 0, 0
        with torch.no_grad():
            for images, labels, _ in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                
                v_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                v_correct += (preds == labels).sum().item()
                v_total += labels.size(0)
                
        val_loss = v_loss / v_total if v_total > 0 else 0
        val_acc = v_correct / v_total if v_total > 0 else 0
        
        print(f"Epoch {epoch+1:02d}/{epochs:02d} | "
              f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.4f} | "
              f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.4f}", flush=True)
              
        if val_acc >= best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), save_path)
            print(f"--> Saved best validator checkpoint to {save_path}", flush=True)
            
    print("Validator training complete!", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Chest X-Ray Validator")
    parser.add_argument("--data_dir", type=str, default="data")
    parser.add_argument("--save_dir", type=str, default="models/validator")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--batch_size", type=int, default=16)
    args = parser.parse_args()
    
    train_validator(args.data_dir, args.save_dir, args.epochs, args.lr, args.batch_size)
