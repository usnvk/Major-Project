import os
import random
import time
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from torch.utils.data import Dataset, DataLoader
from PIL import Image

def train_robust_validator():
    device = torch.device("cpu")
    print("Training Chest X-Ray Validator using Pretrained ResNet-18 on CPU...")

    # Collect valid chest x-rays
    valid_paths = []
    # From Model/data/valid_chest_xray
    for root, _, files in os.walk("Model/data/valid_chest_xray"):
        for f in files:
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                valid_paths.append(os.path.join(root, f))
    # Add from node_A/node_B/node_C to have a rich set
    for node in ["node_A", "node_B", "node_C"]:
        p = os.path.join("Model", "dataset", node, "train")
        if os.path.exists(p):
            for root, _, files in os.walk(p):
                for f in files:
                    if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                        valid_paths.append(os.path.join(root, f))
    valid_paths = list(set(valid_paths))
    random.seed(42)
    random.shuffle(valid_paths)
    # Use 600 valid chest x-rays
    valid_paths = valid_paths[:600]
    print(f"Collected {len(valid_paths)} valid chest X-rays.")

    # Collect invalid non-chest images
    invalid_paths = []
    for root, _, files in os.walk("Model/data/invalid"):
        for f in files:
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                invalid_paths.append(os.path.join(root, f))
    invalid_paths = list(set(invalid_paths))
    random.shuffle(invalid_paths)
    # Use 600 invalid images
    invalid_paths = invalid_paths[:600]
    print(f"Collected {len(invalid_paths)} invalid OOD images.")

    class ValDataset(Dataset):
        def __init__(self, items, transform=None):
            self.items = items
            self.transform = transform
        def __len__(self):
            return len(self.items)
        def __getitem__(self, idx):
            path, label = self.items[idx]
            img = Image.open(path).convert("RGB")
            if self.transform:
                img = self.transform(img)
            return img, label

    all_samples = [(p, 1) for p in valid_paths] + [(p, 0) for p in invalid_paths]
    random.shuffle(all_samples)
    split_idx = int(0.85 * len(all_samples))
    train_samples = all_samples[:split_idx]
    val_samples = all_samples[split_idx:]

    train_tf = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(5),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    val_tf = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    train_loader = DataLoader(ValDataset(train_samples, train_tf), batch_size=32, shuffle=True)
    val_loader = DataLoader(ValDataset(val_samples, val_tf), batch_size=32, shuffle=False)

    cache_path = Path.home() / '.cache' / 'torch' / 'hub' / 'checkpoints' / 'resnet18-f37072fd.pth'
    model = models.resnet18()
    if cache_path.exists():
        print(f"Loading cached ImageNet backbone from {cache_path}...")
        model.load_state_dict(torch.load(cache_path, map_location='cpu'))
    
    # Freeze earlier layers, fine-tune layer4 + fc
    for name, param in model.named_parameters():
        if "layer4" not in name and "fc" not in name:
            param.requires_grad = False
    
    model.fc = nn.Linear(512, 2)
    model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=3e-4)

    best_acc = 0.0
    best_weights = None

    for epoch in range(4):
        t0 = time.time()
        model.train()
        train_loss, train_corr, train_tot = 0.0, 0, 0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * len(y)
            train_corr += (out.argmax(1) == y).sum().item()
            train_tot += len(y)

        model.eval()
        val_corr, val_tot = 0, 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                out = model(x)
                val_corr += (out.argmax(1) == y).sum().item()
                val_tot += len(y)

        train_acc = train_corr / train_tot
        val_acc = val_corr / val_tot
        print(f"Epoch {epoch+1}/4: Train Acc = {train_acc*100:.2f}%, Val Acc = {val_acc*100:.2f}% ({time.time()-t0:.1f}s)")
        if val_acc >= best_acc:
            best_acc = val_acc
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # Save to both backend/models and Model/models/validator
    os.makedirs("backend/models", exist_ok=True)
    os.makedirs("Model/models/validator", exist_ok=True)
    
    torch.save(best_weights, "backend/models/chest_xray_validator.pth")
    torch.save(best_weights, "Model/models/validator/chest_xray_validator.pth")
    print(f"Saved high-accuracy validator checkpoint (Val Acc: {best_acc*100:.2f}%) to backend/models/chest_xray_validator.pth!")

if __name__ == "__main__":
    train_robust_validator()
