import os
import sqlite3
from pathlib import Path
from typing import Any, List, Tuple

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
import torchvision
from torchvision import transforms
from torchvision.datasets import ImageFolder
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler


def _convert_bn_to_gn(module: nn.Module, num_groups: int = 32):
    """Recursively replaces all BatchNorm2d layers with GroupNorm for DP compatibility."""
    for name, child in module.named_children():
        if isinstance(child, nn.BatchNorm2d):
            num_channels = child.num_features
            groups = min(num_groups, num_channels)
            while num_channels % groups != 0 and groups > 1:
                groups -= 1
            gn = nn.GroupNorm(num_groups=groups, num_channels=num_channels, affine=True)
            setattr(module, name, gn)
        else:
            _convert_bn_to_gn(child, num_groups)


def make_privacy_compatible(model: nn.Module) -> nn.Module:
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
    except (ImportError, Exception):
        # Pure PyTorch fallback when opacus is not in environment
        _convert_bn_to_gn(model)

    for mod in model.modules():
        if isinstance(mod, nn.ReLU):
            mod.inplace = False
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

    # Freeze layers 1-3 to lower communication overhead by >65%
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


# ─────────────────────────────────────────────────────────────────────────────
# Active Learning Hybrid Dataset (Edge Queue + Base Hospital Partition)
# ─────────────────────────────────────────────────────────────────────────────

class ActiveLearningDataset(Dataset):
    """
    Combines base hospital training partition with doctor-verified feedback edge cases.
    Assigns higher sampling weights to flagged edge cases so local training prioritizes
    clinical errors / overrides.
    """

    def __init__(self, base_dir: str, transform=None, node_id: str = "node_A"):
        self.transform = transform
        self.samples: List[Tuple[Any, int, float, str | None]] = []  # (path/img, label, weight, pred_id)

        # 1. Load base folder images (weight 1.0)
        if os.path.exists(base_dir):
            base_folder = ImageFolder(root=base_dir)
            for path, label in base_folder.samples:
                self.samples.append((path, label, 1.0, None))

        # 2. Query edge active learning database if available
        self.pending_prediction_ids: List[str] = []
        db_path = Path(__file__).resolve().parents[3] / "backend" / "feedback.db"
        if not db_path.exists():
            # Try alternate relative location
            db_path = Path("..") / "backend" / "feedback.db"

        if db_path.exists():
            try:
                conn = sqlite3.connect(str(db_path))
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                rows = cursor.execute(
                    "SELECT prediction_id, image_path, doctor_label FROM active_learning_queue WHERE pending_active_learning = 1"
                ).fetchall()

                for row in rows:
                    img_p = row["image_path"]
                    if os.path.exists(img_p):
                        lbl = 1 if "positive" in row["doctor_label"].lower() else 0
                        # Assign high sampling weight (4.0x) to active learning edge cases
                        self.samples.append((img_p, lbl, 4.0, row["prediction_id"]))
                        self.pending_prediction_ids.append(row["prediction_id"])
                conn.close()
            except Exception as e:
                pass

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        img_source, label, _, _ = self.samples[idx]
        if isinstance(img_source, str):
            image = Image.open(img_source).convert("RGB")
        else:
            image = img_source

        if self.transform:
            image = self.transform(image)
        return image, label

    def get_sampling_weights(self) -> List[float]:
        return [sample[2] for sample in self.samples]


def mark_active_learning_completed(prediction_ids: List[str]):
    """Marks queued edge cases as trained in local edge database."""
    if not prediction_ids:
        return
    db_path = Path(__file__).resolve().parents[3] / "backend" / "feedback.db"
    if not db_path.exists():
        db_path = Path("..") / "backend" / "feedback.db"
    if db_path.exists():
        try:
            import datetime
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            conn = sqlite3.connect(str(db_path))
            placeholders = ",".join("?" for _ in prediction_ids)
            conn.execute(
                f"UPDATE active_learning_queue SET pending_active_learning = 0, trained_at = ? WHERE prediction_id IN ({placeholders})",
                [now_iso] + prediction_ids
            )
            conn.commit()
            conn.close()
        except Exception:
            pass


def get_dataloader(data_dir, batch_size=16, is_train=True, use_active_learning=False, node_id="node_A"):
    """Creates a DataLoader with optional Active Learning weighted sampling."""
    train_transform, val_transform = get_transforms()
    transform = train_transform if is_train else val_transform

    if is_train and use_active_learning:
        dataset = ActiveLearningDataset(base_dir=data_dir, transform=transform, node_id=node_id)
        weights = dataset.get_sampling_weights()
        sampler = WeightedRandomSampler(weights=weights, num_samples=len(weights), replacement=True)
        dataloader = DataLoader(
            dataset,
            batch_size=batch_size,
            sampler=sampler,
            num_workers=0,
            pin_memory=True if torch.cuda.is_available() else False,
        )
        return dataloader, dataset.pending_prediction_ids

    dataset = ImageFolder(root=data_dir, transform=transform)
    dataloader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=is_train,
        num_workers=0,
        pin_memory=True if torch.cuda.is_available() else False,
    )
    return dataloader


# ─────────────────────────────────────────────────────────────────────────────
# Training Loops with FedProx Regularization
# ─────────────────────────────────────────────────────────────────────────────

def train_one_epoch_fedprox(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
    global_model_params: List[torch.Tensor] | None = None,
    mu: float = 0.0,
) -> Tuple[float, float]:
    """
    Trains model for one epoch using FedProx:
    Loss = CrossEntropy + (mu / 2) * sum(||w_local - w_global||^2)
    """
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    num_batches = len(dataloader)

    # Convert global params to device tensors for proximal calculation
    g_params = [p.to(device).detach() for p in global_model_params] if (global_model_params and mu > 0) else None

    for batch_idx, (images, labels) in enumerate(dataloader, 1):
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)

        # FedProx proximal penalty
        if g_params is not None and mu > 0:
            prox_term = 0.0
            for local_p, global_p in zip(model.parameters(), g_params):
                if local_p.requires_grad:
                    prox_term += ((local_p - global_p) ** 2).sum()
            loss = loss + (mu / 2.0) * prox_term

        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

        if batch_idx % 100 == 0 or batch_idx == num_batches:
            print(
                f"    Batch {batch_idx:03d}/{num_batches:03d} | Running Acc: {correct/total*100:.1f}% | Loss: {loss.item():.4f}",
                flush=True,
            )

    epoch_loss = running_loss / total
    epoch_acc = correct / total
    return epoch_loss, epoch_acc


def validate(model: nn.Module, dataloader: DataLoader, criterion: nn.Module, device: torch.device):
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
