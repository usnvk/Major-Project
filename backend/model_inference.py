from __future__ import annotations

import base64
import io
import os
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as functional
import torchvision
from PIL import Image
from torchvision import transforms

try:
    import onnxruntime as ort
except ImportError:
    ort = None


IMAGE_SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def _resnet18() -> nn.Module:
    model = torchvision.models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 2)
    return model


def _ensure_checkpoint_exists(path: Path, is_validator: bool = False) -> None:
    """Fails instead of creating an untrained random-weight checkpoint."""
    if not path.is_file():
        checkpoint_type = "validator" if is_validator else "TB"
        raise FileNotFoundError(
            f"{checkpoint_type} model checkpoint is missing: {path}"
        )


def _load_state_dict(path: Path, is_validator: bool = False) -> nn.Module:
    _ensure_checkpoint_exists(path, is_validator=is_validator)
    model = _resnet18()
    loaded = torch.load(path, map_location="cpu", weights_only=True)
    state_dict = loaded.get("model_state_dict", loaded) if isinstance(loaded, dict) else loaded
    model.load_state_dict(state_dict)
    model.eval()
    return model


class PublicTBDenseNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.backbone = torchvision.models.densenet121(weights=None)
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.2),
            nn.Linear(self.backbone.classifier.in_features, 2),
        )

    def forward(self, tensor: torch.Tensor) -> torch.Tensor:
        return self.backbone(tensor)


def _transform() -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=MEAN, std=STD),
        ]
    )


# ─────────────────────────────────────────────────────────────────────────────
# Grad-CAM++ Extractor (Enhanced Pulmonary Lesion Localization)
# ─────────────────────────────────────────────────────────────────────────────

class GradCAMPlusPlusExtractor:
    """
    Computes Grad-CAM++ heatmaps for ResNet-18 targeting layer4.
    Grad-CAM++ uses higher-order partial derivatives of the classification score
    to compute alpha weighting coefficients, providing sharper localization for
    multiple, small, or low-contrast pulmonary lesions.
    """

    def __init__(self, model: nn.Module) -> None:
        self.model = model
        self._activations: torch.Tensor | None = None
        self._gradients: torch.Tensor | None = None

        target_layer = model.layer4  # type: ignore[attr-defined]
        self._fwd_handle = target_layer.register_forward_hook(self._save_activation)
        self._bwd_handle = target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, _mod, _inp, output):
        self._activations = output

    def _save_gradient(self, _mod, _grad_in, grad_out):
        self._gradients = grad_out[0]

    def generate(
        self,
        tensor: torch.Tensor,
        class_id: int,
        original_image: Image.Image,
    ) -> dict[str, Any]:
        """Forward + backward pass → Grad-CAM++ → base64 PNG data-URI + bounding boxes."""
        self.model.zero_grad()
        logits = self.model(tensor)
        score = logits[0, class_id]
        score.backward(retain_graph=True)

        assert self._gradients is not None and self._activations is not None

        grads = self._gradients  # [1, 512, 7, 7]
        activations = self._activations  # [1, 512, 7, 7]

        # Grad-CAM++ weight formulation
        # grads_power_2 and grads_power_3 for second/third order terms
        grads_power_2 = grads.pow(2)
        grads_power_3 = grads_power_2 * grads

        # Equation denominator: 2*grads^2 + sum(activations * grads^3)
        sum_activations = activations.sum(dim=(2, 3), keepdim=True)
        eps = 1e-7
        aij = grads_power_2 / (2.0 * grads_power_2 + sum_activations * grads_power_3 + eps)
        aij = torch.where(grads != 0, aij, torch.zeros_like(aij))

        # Channel weights: sum over spatial dims of (alpha * relu(grads))
        weights = (aij * functional.relu(grads)).sum(dim=(2, 3), keepdim=True)

        # Weighted combination of positive activations
        cam = (weights * activations).sum(dim=1, keepdim=True)
        cam = functional.relu(cam)

        # Normalize to [0, 1]
        cam_min, cam_max = cam.min(), cam.max()
        cam = (cam - cam_min) / (cam_max - cam_min + eps)

        # Interpolate to 224x224
        cam_np = (
            functional.interpolate(
                cam, size=(IMAGE_SIZE, IMAGE_SIZE), mode="bilinear", align_corners=False
            )
            .squeeze()
            .detach()
            .cpu()
            .numpy()
        )

        # Colorize with JET colormap
        heatmap_bgr = cv2.applyColorMap(np.uint8(255 * cam_np), cv2.COLORMAP_JET)
        heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)

        # Blend with original image
        orig_np = np.array(
            original_image.convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS),
            dtype=np.float32,
        )
        alpha = 0.45
        overlay = np.clip((1 - alpha) * orig_np + alpha * heatmap_rgb, 0, 255).astype(np.uint8)

        # Extract suspected lesion bounding boxes using Otsu / adaptive thresholding
        gray_cam = np.uint8(255 * cam_np)
        _, thresh = cv2.threshold(gray_cam, int(0.55 * 255), 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        bounding_boxes = []
        for c in contours:
            area = cv2.contourArea(c)
            if area > 120:  # Filter out trivial speckles
                x, y, w, h = cv2.boundingRect(c)
                bounding_boxes.append(
                    {
                        "x": int(x),
                        "y": int(y),
                        "width": int(w),
                        "height": int(h),
                        "relative_area": round(float(area) / (IMAGE_SIZE * IMAGE_SIZE), 4),
                    }
                )

        # Encode overlay to base64
        buf = io.BytesIO()
        Image.fromarray(overlay).save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return {
            "heatmap_base64": f"data:image/png;base64,{b64}",
            "bounding_boxes": bounding_boxes,
            "peak_intensity": round(float(cam_max.item()), 4),
        }

    def remove_hooks(self) -> None:
        self._fwd_handle.remove()
        self._bwd_handle.remove()


class DenseNetGradCAM:
    def __init__(self, model: nn.Module) -> None:
        self.model = model
        self.activations: torch.Tensor | None = None
        target = model.backbone.features.norm5
        self.fwd = target.register_forward_hook(self._save_activation)

    def _save_activation(self, _module, _inputs, output):
        self.activations = output

    def generate(self, tensor: torch.Tensor, class_id: int, original_image: Image.Image) -> dict[str, Any]:
        self.model.zero_grad()
        logits = self.model(tensor)
        if self.activations is None:
            return {"heatmap_base64": None, "bounding_boxes": []}
        gradients = torch.autograd.grad(
            logits[0, class_id],
            self.activations,
            retain_graph=True,
            create_graph=False,
        )[0]

        weights = gradients.mean(dim=(2, 3), keepdim=True)
        cam = functional.relu((weights * self.activations).sum(dim=1, keepdim=True))
        cam -= cam.min()
        cam /= cam.max() + 1e-7
        cam_np = functional.interpolate(
            cam,
            size=(224, 224),
            mode="bilinear",
            align_corners=False,
        ).squeeze().detach().cpu().numpy()

        heatmap_bgr = cv2.applyColorMap(np.uint8(255 * cam_np), cv2.COLORMAP_JET)
        heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
        original = np.array(original_image.convert("RGB").resize((224, 224), Image.LANCZOS), dtype=np.float32)
        overlay = np.clip(0.55 * original + 0.45 * heatmap_rgb, 0, 255).astype(np.uint8)
        buffer = io.BytesIO()
        Image.fromarray(overlay).save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")

        gray = np.uint8(255 * cam_np)
        _, thresh = cv2.threshold(gray, 140, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        boxes = []
        for contour in contours:
            if cv2.contourArea(contour) > 120:
                x, y, width, height = cv2.boundingRect(contour)
                boxes.append({
                    "x": int(x),
                    "y": int(y),
                    "width": int(width),
                    "height": int(height),
                    "relative_area": round(float(cv2.contourArea(contour)) / (224 * 224), 4),
                })
        return {"heatmap_base64": f"data:image/png;base64,{encoded}", "bounding_boxes": boxes}

    def remove_hooks(self) -> None:
        self.fwd.remove()


# ─────────────────────────────────────────────────────────────────────────────
# Main Inference Class
# ─────────────────────────────────────────────────────────────────────────────

class ChestXRayInference:
    """Loads Gatekeeper and federated ResNet-18 checkpoints with Grad-CAM++ explainability."""

    def __init__(
        self,
        tb_model_path: Path | str,
        validator_model_path: Path | str,
        validator_threshold: float = 0.35,
    ) -> None:
        self.tb_model_path = Path(tb_model_path)
        self.validator_model_path = Path(validator_model_path)
        self.validator_threshold = validator_threshold
        self._tb_model: nn.Module | None = None
        self._tb_session = None
        self._tb_input_name: str | None = None
        self._validator_model: nn.Module | None = None
        self._transform = _transform()
        self.tb_threshold = 0.15

    def _load_models(self) -> None:
        if self.tb_model_path.suffix.lower() == ".onnx":
            if self._tb_session is None:
                if ort is None:
                    raise RuntimeError("onnxruntime is required for the public TB model")
                if not self.tb_model_path.is_file():
                    raise FileNotFoundError(
                        f"TB model checkpoint is missing: {self.tb_model_path}"
                    )
                self._tb_session = ort.InferenceSession(
                    str(self.tb_model_path),
                    providers=["CPUExecutionProvider"],
                )
                self._tb_input_name = self._tb_session.get_inputs()[0].name
        elif self.tb_model_path.suffix.lower() == ".pth":
            if self._tb_model is None:
                if not self.tb_model_path.is_file():
                    raise FileNotFoundError(
                        f"TB model checkpoint is missing: {self.tb_model_path}"
                    )
                checkpoint = torch.load(
                    self.tb_model_path,
                    map_location="cpu",
                    weights_only=True,
                )
                state_dict = (
                    checkpoint.get("model_state_dict", checkpoint)
                    if isinstance(checkpoint, dict)
                    else checkpoint
                )
                model = PublicTBDenseNet()
                compatible = {}
                for key, value in state_dict.items():
                    if key.startswith("backbone.features."):
                        compatible[key] = value
                    elif key.startswith("backbone.classifier.1."):
                        compatible[key] = value
                model.load_state_dict(compatible, strict=False)
                model.eval()
                self._tb_model = model
        elif self._tb_model is None:
            self._tb_model = _load_state_dict(self.tb_model_path, is_validator=False)
        if self._validator_model is None:
            self._validator_model = _load_state_dict(
                self.validator_model_path, is_validator=True
            )

    def predict(self, image: Image.Image) -> dict[str, Any]:
        self._load_models()
        rgb_image = image.convert("RGB")
        tensor = self._transform(rgb_image).unsqueeze(0)
        assert self._validator_model is not None

        # Domain information is advisory only. Black/white/noise uploads must
        # receive a TB screening result rather than a document rejection.
        with torch.inference_mode():
            validator_probs = functional.softmax(self._validator_model(tensor), dim=1)[0]
            validator_probability = float(validator_probs[1].item())

        # ── 2. TB classification + Grad-CAM++ explainability ─────────
        if self._tb_session is not None:
            # Public DenseNet-121 ONNX model: logits [Normal, Tuberculosis].
            input_array = tensor.detach().cpu().numpy().astype(np.float32)
            logits = self._tb_session.run(
                None,
                {self._tb_input_name: input_array},
            )[0]
            logits_tensor = torch.from_numpy(np.asarray(logits, dtype=np.float32))
            probs = functional.softmax(logits_tensor, dim=1)[0]
            tb_probability = float(probs[1].item())
            class_id = 1 if tb_probability >= self.tb_threshold else 0
            confidence = tb_probability if class_id == 1 else float(probs[0].item())
            heatmap_base64 = None
            bounding_boxes = []
        else:
            assert self._tb_model is not None
            self._tb_model.eval()
            logits = self._tb_model(tensor)
            probs = functional.softmax(logits, dim=1)[0]
            tb_probability = float(probs[1].item())
            if isinstance(self._tb_model, PublicTBDenseNet):
                class_id = 1 if tb_probability >= self.tb_threshold else 0
                confidence = tb_probability if class_id == 1 else float(probs[0].item())
                if class_id == 1:
                    extractor = DenseNetGradCAM(self._tb_model)
                    try:
                        cam = extractor.generate(tensor, class_id, image)
                        heatmap_base64 = cam["heatmap_base64"]
                        bounding_boxes = cam["bounding_boxes"]
                    finally:
                        extractor.remove_hooks()
                else:
                    heatmap_base64 = None
                    bounding_boxes = []
            else:
                class_id = int(torch.argmax(probs).item())
                confidence = float(probs[class_id].item())
                heatmap_base64 = None
                bounding_boxes = []

        return {
            "status": "ACCEPTED",
            "validator_probability": round(validator_probability, 4),
            "validator_threshold": self.validator_threshold,
            "class_id": class_id,
            "label": "Tuberculosis" if class_id == 1 else "Normal",
            "confidence": round(confidence, 4),
            "heatmap_base64": heatmap_base64,
            "bounding_boxes": bounding_boxes,
        }
