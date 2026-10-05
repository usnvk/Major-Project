import os
import json
import argparse
import numpy as np
import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image

from src.core.model import get_resnet18 as get_tb_resnet18
from src.training.train_validator import get_validator_resnet18

MEDICAL_DISCLAIMER = "TB output is a model prediction, not a definitive medical diagnosis."

# Default paths
DEFAULT_VALIDATOR_PATH = "models/validator/chest_xray_validator.pth"
DEFAULT_CONFIG_PATH = "models/validator/validator_config.json"
DEFAULT_TB_MODEL_PATHS = [
    "models/existing_tb_model/tb_resnet18.pth",
    "centralized_model.pth",
    "federated_model.pth"
]

def load_image(image_input):
    """Loads and converts input image to RGB PIL Image."""
    if isinstance(image_input, Image.Image):
        return image_input.convert("RGB")
    elif isinstance(image_input, str):
        if not os.path.exists(image_input):
            raise FileNotFoundError(f"Image file not found: {image_input}")
        return Image.open(image_input).convert("RGB")
    elif isinstance(image_input, bytes):
        import io
        return Image.open(io.BytesIO(image_input)).convert("RGB")
    else:
        raise ValueError(f"Unsupported image input type: {type(image_input)}")

def check_image_integrity(pil_img):
    """
    Performs basic pre-validation integrity checks on image.
    Rejects corrupted, blank, or saturated images.
    Note: Does NOT reject based on aspect ratio or rotation.
    """
    # Low resolution check (< 32x32 pixels)
    width, height = pil_img.size
    if width < 32 or height < 32:
        return False, f"Image resolution ({width}x{height}) is too low (minimum required: 32x32)."
        
    img_np = np.array(pil_img, dtype=np.float32)
    
    # Blank image check (variance near 0)
    std_val = float(np.std(img_np))
    if std_val < 2.0:
        return False, f"Image is blank or featureless (pixel std dev = {std_val:.2f})."
        
    # Extreme brightness or darkness saturation check
    mean_val = float(np.mean(img_np))
    if mean_val < 5.0:
        return False, f"Image is pitch black or severely underexposed (mean intensity = {mean_val:.2f})."
    if mean_val > 250.0:
        return False, f"Image is pure white or severely overexposed (mean intensity = {mean_val:.2f})."
        
    return True, None

def get_existing_tb_model_path(user_provided_path=None):
    """Resolves existing TB model weight file path."""
    if user_provided_path and os.path.exists(user_provided_path):
        return user_provided_path
        
    for p in DEFAULT_TB_MODEL_PATHS:
        if os.path.exists(p):
            return p
            
    return None

def predict(image_input, tb_model_path=None, validator_path=DEFAULT_VALIDATOR_PATH, config_path=DEFAULT_CONFIG_PATH):
    """
    Single entrypoint for end-to-end inference.
    
    Workflow:
    1. Validates file readability & integrity.
    2. Runs ResNet-18 Validator CNN.
    3. Rejects invalid / non-chest X-ray images (TB model is NEVER called for rejected images).
    4. Sends accepted Chest X-Rays to existing TB classification model.
    5. Returns prediction dictionary with confidence scores and medical disclaimer.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # -------------------------------------------------------------
    # STEP 1: Image Load & File Integrity Validation
    # -------------------------------------------------------------
    try:
        pil_img = load_image(image_input)
    except Exception as e:
        return {
            "is_valid": False,
            "status": "REJECTED",
            "rejection_reason": f"File loading/corrupted error: {str(e)}",
            "medical_disclaimer": MEDICAL_DISCLAIMER
        }
        
    is_intact, integrity_reason = check_image_integrity(pil_img)
    if not is_intact:
        return {
            "is_valid": False,
            "status": "REJECTED",
            "rejection_reason": f"Pre-validation failed: {integrity_reason}",
            "medical_disclaimer": MEDICAL_DISCLAIMER
        }
        
    # -------------------------------------------------------------
    # STEP 2: Chest X-Ray Validator Gating Check
    # -------------------------------------------------------------
    if not os.path.exists(validator_path):
        return {
            "is_valid": False,
            "status": "ERROR",
            "rejection_reason": f"Validator checkpoint missing at '{validator_path}'. Run train_validator.py first.",
            "medical_disclaimer": MEDICAL_DISCLAIMER
        }
        
    threshold = 0.50
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            cfg = json.load(f)
            threshold = cfg.get("optimal_threshold", 0.50)
            
    val_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    val_tensor = val_transforms(pil_img).unsqueeze(0).to(device)
    
    validator_model = get_validator_resnet18(pretrained=False).to(device)
    validator_model.load_state_dict(torch.load(validator_path, map_location=device))
    validator_model.eval()
    
    with torch.no_grad():
        v_out = validator_model(val_tensor)
        v_probs = F.softmax(v_out, dim=1)[0]
        prob_valid = float(v_probs[1].item())
        
    if prob_valid < threshold:
        return {
            "is_valid": False,
            "status": "REJECTED",
            "validator_probability": round(prob_valid, 4),
            "validator_threshold": round(threshold, 4),
            "rejection_reason": f"Image rejected as non-Chest X-Ray / OOD (Confidence P(VALID) = {prob_valid:.4f} < Threshold {threshold:.4f}).",
            "medical_disclaimer": MEDICAL_DISCLAIMER
        }
        
    # -------------------------------------------------------------
    # STEP 3: Existing TB Model Inference (Execution ONLY for VALID images)
    # -------------------------------------------------------------
    resolved_tb_path = get_existing_tb_model_path(tb_model_path)
    if not resolved_tb_path or not os.path.exists(resolved_tb_path):
        return {
            "is_valid": True,
            "status": "VALIDATOR_ACCEPTED_TB_MODEL_MISSING",
            "validator_probability": round(prob_valid, 4),
            "validator_threshold": round(threshold, 4),
            "rejection_reason": f"Chest X-Ray accepted by validator, but existing TB model checkpoint not found. Provide path via --tb_model_path or place model at 'models/existing_tb_model/tb_resnet18.pth'.",
            "medical_disclaimer": MEDICAL_DISCLAIMER
        }
        
    tb_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    tb_tensor = tb_transforms(pil_img).unsqueeze(0).to(device)
    
    tb_model = get_tb_resnet18(pretrained=False).to(device)
    tb_model.load_state_dict(torch.load(resolved_tb_path, map_location=device))
    tb_model.eval()
    
    with torch.no_grad():
        tb_out = tb_model(tb_tensor)
        tb_probs = F.softmax(tb_out, dim=1)[0]
        pred_class_id = int(torch.argmax(tb_probs).item())
        confidence = float(tb_probs[pred_class_id].item())
        
    tb_labels = {0: "Normal", 1: "Tuberculosis"}
    pred_label = tb_labels.get(pred_class_id, "Unknown")
    
    return {
        "is_valid": True,
        "status": "ACCEPTED",
        "validator_probability": round(prob_valid, 4),
        "validator_threshold": round(threshold, 4),
        "tb_prediction": pred_label,
        "tb_class_id": pred_class_id,
        "tb_confidence": round(confidence, 4),
        "tb_model_used": resolved_tb_path,
        "medical_disclaimer": MEDICAL_DISCLAIMER
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Chest X-Ray Validator & TB Prediction Inference Entrypoint")
    parser.add_argument("--image", type=str, required=True, help="Path to input image")
    parser.add_argument("--tb_model_path", type=str, default=None, help="Path to existing trained TB model checkpoint")
    parser.add_argument("--validator_path", type=str, default=DEFAULT_VALIDATOR_PATH)
    parser.add_argument("--config_path", type=str, default=DEFAULT_CONFIG_PATH)
    args = parser.parse_args()
    
    result = predict(args.image, args.tb_model_path, args.validator_path, args.config_path)
    print("\n" + "="*50)
    print(f"{'INFERENCE RESULT':^50}")
    print("="*50)
    print(json.dumps(result, indent=4))
    print("="*50 + "\n")
