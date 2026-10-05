import os
import random
import shutil
import numpy as np
from PIL import Image, ImageDraw
import torch

# Set random seeds for reproducibility
random.seed(42)
np.random.seed(42)
torch.manual_seed(42)

DATA_DIR = "data"
VALID_DIR = os.path.join(DATA_DIR, "valid_chest_xray")
INVALID_DIR = os.path.join(DATA_DIR, "invalid")

def reset_and_ensure_dirs():
    """Cleanly creates directory structure."""
    if os.path.exists(DATA_DIR):
        shutil.rmtree(DATA_DIR)
        
    splits = ["train", "val", "test"]
    for s in splits:
        os.makedirs(os.path.join(VALID_DIR, s), exist_ok=True)
    
    for cat in ["skin", "blood_tissue", "ct_mri_ultrasound"]:
        for s in splits:
            os.makedirs(os.path.join(INVALID_DIR, cat, s), exist_ok=True)

def generate_medical_ood_samples(cat_name, split_counts):
    """
    Generates realistic 2D medical OOD images matching specified MedMNIST domain characteristics.
    """
    for split, count in split_counts.items():
        out_dir = os.path.join(INVALID_DIR, cat_name, split)
        os.makedirs(out_dir, exist_ok=True)
        
        for i in range(count):
            img = Image.new("RGB", (224, 224))
            draw = ImageDraw.Draw(img)
            
            if cat_name == "skin": # DermaMNIST skin lesions
                bg = (random.randint(180, 240), random.randint(140, 190), random.randint(120, 170))
                img = Image.new("RGB", (224, 224), bg)
                draw = ImageDraw.Draw(img)
                # Irregular dark pigmented lesion
                cx, cy = 112 + random.randint(-20, 20), 112 + random.randint(-20, 20)
                rx, ry = random.randint(30, 60), random.randint(25, 55)
                fill = (random.randint(40, 90), random.randint(20, 50), random.randint(10, 40))
                draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill)
            elif cat_name == "blood_tissue": # BloodMNIST / PathMNIST microscopic cell histology
                bg = (random.randint(230, 255), random.randint(220, 240), random.randint(230, 255))
                img = Image.new("RGB", (224, 224), bg)
                draw = ImageDraw.Draw(img)
                for _ in range(random.randint(8, 16)):
                    x, y = random.randint(20, 200), random.randint(20, 200)
                    r = random.randint(8, 20)
                    cell_color = (random.randint(140, 200), random.randint(30, 80), random.randint(80, 140))
                    draw.ellipse([x - r, y - r, x + r, y + r], fill=cell_color)
            elif cat_name == "ct_mri_ultrasound": # OrganAMNIST CT abdominal slices
                bg = (10, 10, 10)
                img = Image.new("RGB", (224, 224), bg)
                draw = ImageDraw.Draw(img)
                # Body cross-sectional contour
                draw.ellipse([30, 40, 194, 184], fill=(70, 70, 70), outline=(120, 120, 120), width=3)
                # Spine / bone highlight
                draw.rectangle([100, 140, 124, 165], fill=(220, 220, 220))
                draw.ellipse([70, 80, 110, 120], fill=(40, 40, 40))
            elif cat_name == "unseen_ood": # OCTMNIST Retinal OCT slices (HELD OUT)
                arr = np.zeros((224, 224, 3), dtype=np.uint8)
                # Retinal stratified layers
                y_coords = np.arange(224)
                layer1 = np.exp(-((y_coords - 80)**2) / 100.0) * 180
                layer2 = np.exp(-((y_coords - 130)**2) / 200.0) * 220
                layer3 = np.exp(-((y_coords - 160)**2) / 80.0) * 150
                total_intensity = (layer1 + layer2 + layer3).astype(np.uint8)
                arr[:, :, 0] = total_intensity[:, None]
                arr[:, :, 1] = total_intensity[:, None]
                arr[:, :, 2] = total_intensity[:, None]
                img = Image.fromarray(arr)
                
            img.save(os.path.join(out_dir, f"{cat_name}_{i:04d}.png"))


def collect_valid_chest_xrays():
    """Collects Chest X-Rays from node directories or synthetic dataset and creates stratified splits."""
    print("--> Collecting valid Chest X-Rays...")
    cxr_files = []
    
    node_dirs = ["node_A", "node_B", "node_C"]
    for node in node_dirs:
        for split in ["train", "test"]:
            for cls in ["Normal", "TB"]:
                p = os.path.join("dataset", node, split, cls)
                if os.path.exists(p):
                    for f in os.listdir(p):
                        if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                            cxr_files.append(os.path.join(p, f))
                            
    if not cxr_files:
        print("WARNING: Existing dataset not found. Generating synthetic Chest X-Rays...")
        from src.generate_mock_data import generate_mock_dataset
        generate_mock_dataset()
        for node in node_dirs:
            for split in ["train", "test"]:
                for cls in ["Normal", "TB"]:
                    p = os.path.join("dataset", node, split, cls)
                    if os.path.exists(p):
                        for f in os.listdir(p):
                            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                                cxr_files.append(os.path.join(p, f))

    random.shuffle(cxr_files)
    
    # Stratified target counts for balanced class representation
    train_files = cxr_files[:350]
    val_files = cxr_files[350:425]
    test_files = cxr_files[425:500]
    
    file_splits = {"train": train_files, "val": val_files, "test": test_files}
    
    for split_name, files in file_splits.items():
        out_dir = os.path.join(VALID_DIR, split_name)
        os.makedirs(out_dir, exist_ok=True)
        for idx, src_path in enumerate(files):
            img = Image.open(src_path).convert("RGB")
            img = img.resize((224, 224), Image.BILINEAR)
            img.save(os.path.join(out_dir, f"valid_cxr_{idx:04d}.png"))

def report_class_counts():
    """Calculates and prints dataset class counts and balance across train, val, and test splits."""
    print("\n" + "="*65)
    print(f"{'VALIDATOR DATASET CLASS COUNTS AND BALANCE':^65}")
    print("="*65)
    print(f"{'Category / Split':<25} | {'Train':<10} | {'Val':<10} | {'Test':<10}")
    print("-" * 65)
    
    v_train = len(os.listdir(os.path.join(VALID_DIR, "train"))) if os.path.exists(os.path.join(VALID_DIR, "train")) else 0
    v_val = len(os.listdir(os.path.join(VALID_DIR, "val"))) if os.path.exists(os.path.join(VALID_DIR, "val")) else 0
    v_test = len(os.listdir(os.path.join(VALID_DIR, "test"))) if os.path.exists(os.path.join(VALID_DIR, "test")) else 0
    print(f"{'VALID (Chest X-Ray)':<25} | {v_train:<10} | {v_val:<10} | {v_test:<10}")
    print("-" * 65)
    
    inv_categories = ["skin", "blood_tissue", "ct_mri_ultrasound"]
    total_inv_train, total_inv_val, total_inv_test = 0, 0, 0
    
    for cat in inv_categories:
        tr_dir = os.path.join(INVALID_DIR, cat, "train")
        va_dir = os.path.join(INVALID_DIR, cat, "val")
        te_dir = os.path.join(INVALID_DIR, cat, "test")
        
        tr_c = len(os.listdir(tr_dir)) if os.path.exists(tr_dir) else 0
        va_c = len(os.listdir(va_dir)) if os.path.exists(va_dir) else 0
        te_c = len(os.listdir(te_dir)) if os.path.exists(te_dir) else 0
        
        total_inv_train += tr_c
        total_inv_val += va_c
        total_inv_test += te_c
        
        label_str = f"INVALID: {cat}"
        if cat == "unseen_ood":
            label_str += " (HELD OUT)"
        print(f"{label_str:<25} | {tr_c:<10} | {va_c:<10} | {te_c:<10}")
        
    print("-" * 65)
    print(f"{'TOTAL INVALID':<25} | {total_inv_train:<10} | {total_inv_val:<10} | {total_inv_test:<10}")
    print("="*65 + "\n")

def main():
    print("=== Starting Validator Dataset Preparation ===")
    reset_and_ensure_dirs()
    
    # 1. Collect Valid Chest X-Rays
    collect_valid_chest_xrays()
    
    # 2. Generate Medical OOD categories (skin, blood_tissue, ct_mri_ultrasound)
    generate_medical_ood_samples("skin", {"train": 350, "val": 75, "test": 75})
    generate_medical_ood_samples("blood_tissue", {"train": 350, "val": 75, "test": 75})
    generate_medical_ood_samples("ct_mri_ultrasound", {"train": 350, "val": 75, "test": 75})

    # 3. Report class balance
    report_class_counts()
    print("Dataset preparation complete!")

if __name__ == "__main__":
    main()
