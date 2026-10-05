import torch
import torch.nn as nn
import torchvision
from torchvision import transforms
from torchvision.datasets import ImageFolder
from torch.utils.data import DataLoader

def make_privacy_compatible(model):
    """
    Converts ResNet-18 to be fully compatible with Opacus Differential Privacy
    by replacing BatchNorm with GroupNorm, disabling in-place ReLUs,
    and preventing in-place residual additions.
    """
    import torchvision.models.resnet as rnet
    try:
        from opacus.validators import ModuleValidator
        
        def patched_forward(self, x):
            identity = x
            out = self.conv1(x)
            out = self.bn1(out)
            out = self.relu(out)
            out = self.conv2(out)
            out = self.bn2(out)
            if self.downsample is not None:
                identity = self.downsample(x)
            out = out + identity
            out = self.relu(out)
            return out

        rnet.BasicBlock.forward = patched_forward
        model = ModuleValidator.fix(model)
        for mod in model.modules():
            if isinstance(mod, nn.ReLU):
                mod.inplace = False
    except ImportError:
        pass
    return model

def get_resnet18(pretrained=True, privacy_preserving=False):
    """Loads ResNet-18, freezes layers 1-3, and replaces the classifier for 2 classes.
    If privacy_preserving is True, applies Opacus compatibility transformations."""
    if pretrained:
        weights = torchvision.models.ResNet18_Weights.DEFAULT
        model = torchvision.models.resnet18(weights=weights)
    else:
        model = torchvision.models.resnet18()

    if privacy_preserving:
        model = make_privacy_compatible(model)
        
    # Freeze layers 1-3
    for name, param in model.named_parameters():
        if "layer4" not in name and "fc" not in name:
            param.requires_grad = False
            
    # Replace final classification layer (fc)
    # Output classes: 0 = Normal, 1 = TB
    num_features = model.fc.in_features
    model.fc = nn.Linear(num_features, 2)
    return model

def get_transforms():
    """Returns PyTorch transforms for training and validation."""
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    return train_transform, val_transform

def get_dataloader(data_dir, batch_size=16, is_train=True):
    """Creates a DataLoader from an ImageFolder directory."""
    train_transform, val_transform = get_transforms()
    transform = train_transform if is_train else val_transform
    dataset = ImageFolder(root=data_dir, transform=transform)
    dataloader = DataLoader(
        dataset, 
        batch_size=batch_size, 
        shuffle=is_train, 
        num_workers=0, # Windows safe
        pin_memory=True if torch.cuda.is_available() else False
    )
    return dataloader

def train_one_epoch(model, dataloader, criterion, optimizer, device):
    """Trains the model for one epoch."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    num_batches = len(dataloader)
    
    for batch_idx, (images, labels) in enumerate(dataloader, 1):
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
        
        if batch_idx % 100 == 0 or batch_idx == num_batches:
            print(f"    Batch {batch_idx:03d}/{num_batches:03d} | Running Acc: {correct/total*100:.1f}% | Loss: {loss.item():.4f}", flush=True)
        
    epoch_loss = running_loss / total
    epoch_acc = correct / total
    return epoch_loss, epoch_acc

def validate(model, dataloader, criterion, device):
    """Evaluates the model on validation/test data."""
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    all_preds = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in dataloader:
            images, labels = images.to(device), labels.to(device)
            
            outputs = model(images)
            loss = criterion(outputs, labels)
            
            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)
            
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
    val_loss = running_loss / total
    val_acc = correct / total
    return val_loss, val_acc, all_preds, all_labels
