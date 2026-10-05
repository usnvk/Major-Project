"""
run_inference.py
----------------
Folder-based end-to-end inference pipeline.

Usage:
    1. Place exactly ONE chest X-ray image inside the 'user test/' folder.
    2. Run:  python run_inference.py

Workflow:
    user test/  -->  Chest X-Ray Validator  -->  (if valid) TB Detector  -->  Result

No models are retrained. Both the Chest X-Ray Validator and TB Detector are
loaded from their pre-trained checkpoint files during inference.
    - Validator : models/validator/chest_xray_validator.pth
    - TB Model  : centralized_model.pth  (or federated_model.pth as fallback)
"""

import os
import sys

# Ensure UTF-8 output encoding for Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ── Configuration ──────────────────────────────────────────────────────────────
INPUT_FOLDER   = "user test"
TB_MODEL_PATH  = "centralized_model.pth"   # Primary TB model; fallback handled by predict()

SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}

SEPARATOR      = "=" * 62
THIN_SEP       = "-" * 62

# ── Helpers ────────────────────────────────────────────────────────────────────

def find_image(folder: str) -> str | None:
    """Return the path of the first supported image found in *folder*."""
    if not os.path.isdir(folder):
        return None
    images = [
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in SUPPORTED_EXTS
    ]
    if not images:
        return None
    if len(images) > 1:
        print(f"[WARNING] Multiple images found in '{folder}/'. "
              f"Using the first one: '{images[0]}'")
        print(f"          Found: {images}\n")
    return os.path.join(folder, images[0])


def print_result(image_path: str, result: dict) -> None:
    """Print a clean, readable summary of the predict() result dict."""
    filename = os.path.basename(image_path)

    print()
    print(SEPARATOR)
    print(f"{'CHEST X-RAY ANALYSIS RESULT':^62}")
    print(SEPARATOR)
    print(f"  Image         : {filename}")

    status = result.get("status", "UNKNOWN")

    # ── Pre-validation failure (corrupt / blank / saturated) ──────────────────
    if status in ("REJECTED", "ERROR") and "validator_probability" not in result:
        print(f"  Validator     : REJECTED (Pre-validation)")
        print(THIN_SEP)
        reason = result.get("rejection_reason", "Unknown error.")
        # Wrap long reason lines
        for line in _wrap(reason, width=54):
            print(f"  {'':>14}  {line}")
        print(THIN_SEP)
        print(f"  TB Detector   : NOT RUN  (blocked by pre-validator)")
        print(SEPARATOR)
        print()
        return

    # ── Validator rejected the image as non-CXR ───────────────────────────────
    if status == "REJECTED":
        prob = result.get("validator_probability", 0.0)
        thr  = result.get("validator_threshold", 0.50)
        print(f"  Validator     : REJECTED")
        print(f"  CXR Score     : {prob:.4f}  (threshold = {thr:.4f})")
        print(THIN_SEP)
        reason = result.get("rejection_reason", "Image is not a Chest X-Ray.")
        for line in _wrap(reason, width=54):
            print(f"  {'':>14}  {line}")
        print(THIN_SEP)
        print(f"  TB Detector   : NOT RUN  (gatekeeper blocked execution)")
        print(SEPARATOR)
        print()
        return

    # ── Validator accepted but TB model is missing ────────────────────────────
    if status == "VALIDATOR_ACCEPTED_TB_MODEL_MISSING":
        prob = result.get("validator_probability", 0.0)
        thr  = result.get("validator_threshold", 0.50)
        print(f"  Validator     : ACCEPTED  (CXR Score = {prob:.4f})")
        print(THIN_SEP)
        print(f"  TB Detector   : ERROR — model checkpoint not found.")
        reason = result.get("rejection_reason", "")
        for line in _wrap(reason, width=54):
            print(f"  {'':>14}  {line}")
        print(THIN_SEP)
        print(f"  Hint: Place centralized_model.pth in the project root.")
        print(SEPARATOR)
        print()
        return

    # ── Fully accepted + TB prediction returned ───────────────────────────────
    if status == "ACCEPTED":
        prob       = result.get("validator_probability", 0.0)
        thr        = result.get("validator_threshold", 0.50)
        tb_label   = result.get("tb_prediction", "Unknown")
        tb_conf    = result.get("tb_confidence", 0.0)
        model_used = result.get("tb_model_used", TB_MODEL_PATH)
        disclaimer = result.get("medical_disclaimer", "")

        # Visual indicator for the TB result
        if tb_label == "Tuberculosis":
            tb_display = f"⚠  TUBERCULOSIS  ({tb_conf * 100:.2f}% confidence)"
        else:
            tb_display = f"✔  NORMAL        ({tb_conf * 100:.2f}% confidence)"

        print(f"  Validator     : ACCEPTED")
        print(f"  CXR Score     : {prob:.4f}  (threshold = {thr:.4f})")
        print(THIN_SEP)
        print(f"  TB Prediction : {tb_display}")
        print(f"  TB Model      : {os.path.basename(model_used)}")
        print(THIN_SEP)
        if disclaimer:
            print(f"  ⚠  DISCLAIMER :")
            for line in _wrap(disclaimer, width=50):
                print(f"     {line}")
        print(SEPARATOR)
        print()
        return

    # ── Fallback for unexpected status ────────────────────────────────────────
    print(f"  Status        : {status}")
    print(f"  Raw Result    : {result}")
    print(SEPARATOR)
    print()


def _wrap(text: str, width: int = 54) -> list[str]:
    """Split *text* into lines of at most *width* characters."""
    words = text.split()
    lines, current = [], ""
    for word in words:
        if len(current) + len(word) + (1 if current else 0) <= width:
            current = (current + " " + word).strip()
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines if lines else [""]


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    # 1. Locate image in the input folder
    image_path = find_image(INPUT_FOLDER)

    if image_path is None:
        if not os.path.isdir(INPUT_FOLDER):
            print(f"\n[ERROR] Input folder '{INPUT_FOLDER}/' does not exist.")
            print(f"        Please create it and place your X-ray image inside.\n")
        else:
            print(f"\n[INFO] No image found in '{INPUT_FOLDER}/'.")
            print(f"       Supported formats: {', '.join(sorted(SUPPORTED_EXTS))}")
            print(f"       Please place your X-ray image in the '{INPUT_FOLDER}/' folder and try again.\n")
        sys.exit(1)

    print(f"\n[INFO] Image located : {image_path}")
    print(f"[INFO] Running end-to-end inference pipeline...\n")

    # 2. Import predict() from the existing inference.py (unchanged)
    try:
        from src.inference.inference import predict
    except ImportError as e:
        print(f"[ERROR] Could not import 'predict' from inference.py: {e}")
        print(f"        Make sure you are running this script from the project root directory.")
        sys.exit(1)

    # 3. Run inference — validator gates the TB model internally
    try:
        result = predict(image_path, tb_model_path=TB_MODEL_PATH)
    except Exception as e:
        print(f"[ERROR] Inference failed with an unexpected error:")
        print(f"        {e}")
        sys.exit(1)

    # 4. Display result
    print_result(image_path, result)


if __name__ == "__main__":
    main()
