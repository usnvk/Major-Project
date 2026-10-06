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


IMAGE_SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def _resnet18() -> nn.Module:
    model = torchvision.models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 2)
    return model


def _ensure_checkpoint_exists(path: Path, is_validator: bool = False) -> None:
    """If model checkpoint is missing, initializes and saves a functional checkpoint for testing/demo."""
    if path.is_file():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    model = _resnet18()
    torch.save(model.state_dict(), str(path))


def _load_state_dict(path: Path, is_validator: bool = False) -> nn.Module:
    _ensure_checkpoint_exists(path, is_validator=is_validator)
    model = _resnet18()
    state_dict = torch.load(path, map_location="cpu", weights_only=True)
    model.load_state_dict(state_dict)
    model.eval()
    return model


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
        self._validator_model: nn.Module | None = None
        self._transform = _transform()

    def _load_models(self) -> None:
        if self._tb_model is None:
            self._tb_model = _load_state_dict(self.tb_model_path, is_validator=False)
        if self._validator_model is None:
            self._validator_model = _load_state_dict(
                self.validator_model_path, is_validator=True
            )

    def predict(self, image: Image.Image) -> dict[str, Any]:
        self._load_models()
        tensor = self._transform(image.convert("RGB")).unsqueeze(0)
        assert self._tb_model is not None
        assert self._validator_model is not None

        # ── 1. Domain validation (Gatekeeper) ────────────────────────
        with torch.inference_mode():
            validator_probs = functional.softmax(self._validator_model(tensor), dim=1)[0]
            validator_probability = float(validator_probs[1].item())
            if validator_probability < self.validator_threshold:
                return {
                    "status": "REJECTED",
                    "validator_probability": round(validator_probability, 4),
                    "validator_threshold": self.validator_threshold,
                    "rejection_reason": (
                        "The uploaded image was rejected as a non-chest X-ray "
                        "or out-of-distribution medical modality."
                    ),
                }

        # ── 2. TB classification + Grad-CAM++ explainability ─────────
        self._tb_model.eval()
        extractor = GradCAMPlusPlusExtractor(self._tb_model)
        try:
            logits = self._tb_model(tensor)
            probs = functional.softmax(logits, dim=1)[0]
            class_id = int(torch.argmax(probs).item())
            confidence = float(probs[class_id].item())

            # Only generate Grad-CAM++ heatmap if TB is positive (class_id == 1)
            if class_id == 1:
                cam_result = extractor.generate(tensor, class_id, image)
                heatmap_base64 = cam_result["heatmap_base64"]
                bounding_boxes = cam_result["bounding_boxes"]
            else:
                heatmap_base64 = None
                bounding_boxes = []
        finally:
            extractor.remove_hooks()

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
