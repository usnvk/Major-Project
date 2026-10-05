import os
import torch
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
import argparse

from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image
from src.core.model import get_resnet18

def find_sample_images(base_dir):
    """Searches for one Normal and one TB image in the test set directories."""
    normal_img = None
    tb_img = None
    
    for root, _, files in os.walk(base_dir):
        for file in files:
            if file.lower().endswith('.png'):
                full_path = os.path.join(root, file)
                if "Normal" in root and normal_img is None:
                    normal_img = full_path
                elif "TB" in root and tb_img is None:
                    tb_img = full_path
            if normal_img is not None and tb_img is not None:
                break
    return normal_img, tb_img

def generate_gradcam(model, image_path, output_path, device):
    """Generates a Grad-CAM visualization for a given chest X-ray image."""
    print(f"Generating Grad-CAM for {image_path}...")
    
    # Load and preprocess image
    pil_img = Image.open(image_path).convert('RGB')
    pil_img_resized = pil_img.resize((224, 224))
    img_np = np.array(pil_img_resized, dtype=np.float32) / 255.0
    
    # Normalize input image for ResNet-18 (ImageNet mean and std)
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_tensor = (img_np - mean) / std
    img_tensor = torch.tensor(img_tensor).permute(2, 0, 1).unsqueeze(0).to(device)
    
    # Specify the target convolutional layer for ResNet-18 Grad-CAM
    # Usually the last block of the final convolutional layer: model.layer4[-1]
    target_layers = [model.layer4[-1]]
    
    # Get model prediction
    model.eval()
    with torch.no_grad():
        output = model(img_tensor)
        probabilities = torch.softmax(output, dim=1).cpu().numpy()[0]
        pred_class = int(np.argmax(probabilities))
        pred_prob = probabilities[pred_class]
        
    class_labels = {0: "Normal", 1: "TB"}
    pred_label = class_labels[pred_class]
    true_label = "TB" if "TB" in image_path else "Normal"
    
    # Initialize Grad-CAM
    cam = GradCAM(model=model, target_layers=target_layers)
    
    # Compute activation map for the predicted class
    targets = [ClassifierOutputTarget(pred_class)]
    grayscale_cam = cam(input_tensor=img_tensor, targets=targets)[0, :]
    
    # Overlay heatmap on original image
    visualization = show_cam_on_image(img_np, grayscale_cam, use_rgb=True)
    
    # Plot side-by-side comparison
    fig, axes = plt.subplots(1, 2, figsize=(10, 5))
    axes[0].imshow(img_np)
    axes[0].set_title(f"Original Image (True: {true_label})")
    axes[0].axis('off')
    
    axes[1].imshow(visualization)
    axes[1].set_title(f"Grad-CAM Heatmap (Pred: {pred_label} [{pred_prob:.2%}])")
    axes[1].axis('off')
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    print(f"--> Saved Grad-CAM comparison to: {os.path.abspath(output_path)}")

def main():
    parser = argparse.ArgumentParser(description="Grad-CAM Visualization for TB prediction")
    parser.add_argument("--model_path", type=str, default="federated_model.pth", help="Path to trained model weights")
    args = parser.parse_args()
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # 1. Load Trained Model
    if not os.path.exists(args.model_path):
        raise FileNotFoundError(f"Model file '{args.model_path}' not found! Train centralized or federated model first.")
        
    print(f"Loading weights from {args.model_path}...")
    model = get_resnet18(pretrained=False).to(device)
    model.load_state_dict(torch.load(args.model_path, map_location=device))
    
    # 2. Find sample images from the test dataset
    test_root = os.path.join("dataset")
    normal_sample, tb_sample = find_sample_images(test_root)
    
    if normal_sample is None or tb_sample is None:
        raise FileNotFoundError("Could not find sample images in the 'dataset' directory. Make sure dataset_prep.py ran.")
        
    print(f"Sample Normal Chest X-Ray: {normal_sample}")
    print(f"Sample TB Chest X-Ray:     {tb_sample}")
    
    # 3. Generate Grad-CAM heatmaps
    prefix = os.path.splitext(os.path.basename(args.model_path))[0]
    generate_gradcam(model, normal_sample, f"gradcam_{prefix}_normal.png", device)
    generate_gradcam(model, tb_sample, f"gradcam_{prefix}_tb.png", device)

if __name__ == "__main__":
    main()
