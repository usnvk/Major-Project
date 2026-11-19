import argparse
import copy
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, WeightedRandomSampler, random_split
from torchvision import datasets, models, transforms


class PublicTBDenseNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.backbone = models.densenet121(weights=None)
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.2),
            nn.Linear(self.backbone.classifier.in_features, 2),
        )

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        return self.backbone(tensor)


def load_public_checkpoint(model: nn.Module, checkpoint_path: Path) -> None:
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    compatible = {}
    for key, value in state_dict.items():
        if key.startswith("backbone.features."):
            compatible[key[len("backbone.") :]] = value
        elif key.startswith("backbone.classifier.1."):
            compatible["backbone.classifier.1." + key.rsplit(".", 1)[1]] = value
    model.load_state_dict(compatible, strict=False)


def export_onnx(model: nn.Module, output_path: Path) -> None:
    model.eval()
    dummy = torch.randn(1, 3, 224, 224)
    torch.onnx.export(
        model,
        dummy,
        str(output_path),
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch_size"}, "logits": {0: "batch_size"}},
        opset_version=17,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Fine-tune the public TB DenseNet-121 checkpoint")
    parser.add_argument("--dataset", required=True, help="Folder containing Normal and Tuberculosis folders")
    parser.add_argument("--checkpoint", default="../../backend/models/tb_public.pth")
    parser.add_argument("--output", default="../../backend/models/tb_public_finetuned.onnx")
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(8),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    eval_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    full = datasets.ImageFolder(args.dataset, transform=train_transform)
    if set(full.classes) != {"Normal", "Tuberculosis"}:
        raise ValueError(
            f"Dataset folders must be named Normal and Tuberculosis. Found: {full.classes}"
        )
    if len(full) < 20:
        raise ValueError("Dataset is too small for fine-tuning.")

    val_size = max(1, int(len(full) * 0.15))
    train_size = len(full) - val_size
    train_set, val_set = random_split(full, [train_size, val_size])
    val_set.dataset = copy.deepcopy(full)
    val_set.dataset.transform = eval_transform

    class_counts = np.bincount([full.targets[i] for i in train_set.indices], minlength=2)
    class_weights = len(train_set.indices) / (2 * np.maximum(class_counts, 1))
    sample_weights = [class_weights[full.targets[i]] for i in train_set.indices]
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)

    train_loader = DataLoader(train_set, batch_size=args.batch_size, sampler=sampler, num_workers=0)
    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False, num_workers=0)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = PublicTBDenseNet().to(device)
    load_public_checkpoint(model, Path(args.checkpoint).resolve())
    for parameter in model.backbone.features.parameters():
        parameter.requires_grad = False
    criterion = nn.CrossEntropyLoss(weight=torch.tensor(class_weights, dtype=torch.float32, device=device))
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=1e-4)

    best_accuracy = 0.0
    best_state = None
    for epoch in range(args.epochs):
        model.train()
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(images), labels)
            loss.backward()
            optimizer.step()

        model.eval()
        correct = 0
        with torch.inference_mode():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                preds = model(images).argmax(dim=1)
                correct += (preds == labels).sum().item()
        accuracy = correct / len(val_set)
        print(f"Epoch {epoch + 1}/{args.epochs} - validation accuracy: {accuracy:.4f}")
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            best_state = copy.deepcopy(model.state_dict())

    if best_state is not None:
        model.load_state_dict(best_state)
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    export_onnx(model.cpu(), output_path)
    print(f"Exported fine-tuned ONNX model: {output_path}")
    print(f"Best validation accuracy: {best_accuracy:.4f}")


if __name__ == "__main__":
    main()
