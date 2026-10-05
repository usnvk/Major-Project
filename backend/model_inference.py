from __future__ import annotations

import base64
import io
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


def _load_state_dict(path: Path) -> nn.Module:
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
# Grad-CAM Extractor
# ─────────────────────────────────────────────────────────────────────────────

class GradCAMExtractor:
    """
    Computes Grad-CAM heatmaps for a ResNet-18 targeting its final conv block (layer4).

    How it works:
    1. A forward hook captures the feature-map activations from layer4 (shape [1,512,7,7]).
    2. A backward hook captures the gradients flowing back into layer4.
    3. Each of the 512 channels is weighted by its mean gradient (Global Average Pooling).
    4. Weighted maps are summed and ReLU'd to get the Grad-CAM saliency map.
    5. The map is up-sampled to 224x224, colourised with COLORMAP_JET, and blended
       (alpha=0.45) over the original RGB image.
    6. Result is returned as a base64 PNG data-URI.
    """

    def __init__(self, model: nn.Module) -> None:
        self.model = model
        self._activations: torch.Tensor | None = None
        self._gradients: torch.Tensor | None = None

        # Attach hooks to the last residual block
        target_layer = model.layer4  # type: ignore[attr-defined]
        self._fwd_handle = target_layer.register_forward_hook(self._save_activation)
        self._bwd_handle = target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, _mod, _inp, output):
        self._activations = output.detach()

    def _save_gradient(self, _mod, _grad_in, grad_out):
        self._gradients = grad_out[0].detach()

    def generate(self, tensor: torch.Tensor, class_id: int, original_image: Image.Image) -> str:
        """Forward + backward pass → Grad-CAM → base64 PNG data-URI."""
        # 1. Forward + backward
        self.model.zero_grad()
        logits = self.model(tensor)
        logits[0, class_id].backward()

        assert self._gradients is not None and self._activations is not None

        # 2. Global-average-pool the gradients → channel weights
        weights = self._gradients.mean(dim=(2, 3), keepdim=True)  # [1,512,1,1]

        # 3. Weighted sum of activation maps + ReLU
        cam = functional.relu((weights * self._activations).sum(dim=1, keepdim=True))

        # 4. Normalise to [0,1]
        cam_min, cam_max = cam.min(), cam.max()
        cam = (cam - cam_min) / (cam_max - cam_min + 1e-8)

        # 5. Up-sample to 224×224
        cam_np = (
            functional.interpolate(cam, size=(IMAGE_SIZE, IMAGE_SIZE), mode="bilinear", align_corners=False)
            .squeeze().cpu().numpy()
        )

        # 6. Apply JET colourmap
        heatmap_bgr = cv2.applyColorMap(np.uint8(255 * cam_np), cv2.COLORMAP_JET)
        heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)

        # 7. Blend over original image
        orig_np = np.array(original_image.convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS), dtype=np.float32)
        alpha = 0.45
        overlay = np.clip((1 - alpha) * orig_np + alpha * heatmap_rgb, 0, 255).astype(np.uint8)

        # 8. Encode as base64 PNG data-URI
        buf = io.BytesIO()
        Image.fromarray(overlay).save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

    def remove_hooks(self) -> None:
        self._fwd_handle.remove()
        self._bwd_handle.remove()


# ─────────────────────────────────────────────────────────────────────────────
# Main Inference Class
# ─────────────────────────────────────────────────────────────────────────────

class ChestXRayInference:
    """Loads Person 3's validator and federated ResNet-18 checkpoints."""

    def __init__(
        self,
        tb_model_path: Path,
        validator_model_path: Path,
        validator_threshold: float = 0.5,
    ) -> None:
        self.tb_model_path = tb_model_path
        self.validator_model_path = validator_model_path
        self.validator_threshold = validator_threshold
        self._tb_model: nn.Module | None = None
        self._validator_model: nn.Module | None = None
        self._transform = _transform()

    def _load_models(self) -> None:
        if self._tb_model is None:
            self._tb_model = _load_state_dict(self.tb_model_path)
        if self._validator_model is None:
            self._validator_model = _load_state_dict(self.validator_model_path)

    def predict(self, image: Image.Image) -> dict[str, Any]:
        self._load_models()
        tensor = self._transform(image.convert("RGB")).unsqueeze(0)
        assert self._tb_model is not None
        assert self._validator_model is not None

        # ── 1. Domain validation (inference_mode is fine here) ────────
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
                        "or out-of-distribution image."
                    ),
                }

        # ── 2. TB classification + Grad-CAM (gradients are required) ──
        # We must NOT use torch.inference_mode() here because Grad-CAM
        # needs gradients to flow backwards through the model.
        self._tb_model.eval()
        extractor = GradCAMExtractor(self._tb_model)
        try:
            logits = self._tb_model(tensor)
            probs = functional.softmax(logits, dim=1)[0]
            class_id = int(torch.argmax(probs).item())
            confidence = float(probs[class_id].item())
            # Only generate Grad-CAM heatmap if TB is positive (class_id == 1)
            # For Normal / TB Negative, no heatmap is generated
            if class_id == 1:
                heatmap_base64 = extractor.generate(tensor, class_id, image)
            else:
                heatmap_base64 = None
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
        }
