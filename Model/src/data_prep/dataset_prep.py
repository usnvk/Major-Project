import os
import zipfile
import urllib.request
import shutil
import random

# Dataset URLs
MONTGOMERY_URL = "https://openi.nlm.nih.gov/imgs/collections/NLM-MontgomeryCXRSet.zip"
SHENZHEN_URL = "https://openi.nlm.nih.gov/imgs/collections/ChinaSet_AllFiles.zip"

def download_file(url, output_path):
    """Downloads a file with custom headers and a progress log."""
    print(f"Downloading {url} to {output_path}...")
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    with urllib.request.urlopen(req) as response, open(output_path, 'wb') as out_file:
        total_size = int(response.info().get('Content-Length', 0))
        downloaded = 0
        chunk_size = 1024 * 1024  # 1MB chunks
        last_percent = -1
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)
            if total_size > 0:
                percent = int(downloaded * 100 / total_size)
                if percent % 10 == 0 and percent != last_percent:
                    print(f"Progress: {percent}% ({downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB)")
                    last_percent = percent
    print("Download complete.")

def extract_zip(zip_path, extract_to):
    """Extracts a zip file to the specified directory."""
    print(f"Extracting {zip_path} to {extract_to}...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
    print("Extraction complete.")

def scan_images(dir_path):
    """Recursively scans for chest X-ray images, classifying normal vs TB from filename suffixes."""
    normal_images = []
    tb_images = []
    for root, _, files in os.walk(dir_path):
        for file in files:
            if file.lower().endswith('.png'):
                full_path = os.path.join(root, file)
                # Suffix check: _0 is normal, _1 is TB
                filename_no_ext = os.path.splitext(file)[0]
                if filename_no_ext.endswith('_0'):
                    normal_images.append(full_path)
                elif filename_no_ext.endswith('_1'):
                    tb_images.append(full_path)
    return normal_images, tb_images

def partition_and_save(normal_list, tb_list, output_root):
    """Partitions dataset into 3 stratified, non-overlapping node subsets with 80/20 train/test splits."""
    random.seed(42)
    random.shuffle(normal_list)
    random.shuffle(tb_list)
    
    # Stratified splits for the three nodes (equal size)
    n_len = len(normal_list)
    normal_splits = [
        normal_list[0 : n_len//3],
        normal_list[n_len//3 : 2*(n_len//3)],
        normal_list[2*(n_len//3) :]
    ]
    
    tb_len = len(tb_list)
    tb_splits = [
        tb_list[0 : tb_len//3],
        tb_list[tb_len//3 : 2*(tb_len//3)],
        tb_list[2*(tb_len//3) :]
    ]
    
    nodes = ['node_A', 'node_B', 'node_C']
    for i, node in enumerate(nodes):
        node_normal = normal_splits[i]
        node_tb = tb_splits[i]
        
        # 80/20 split inside the node
        n_train_idx = int(0.8 * len(node_normal))
        t_train_idx = int(0.8 * len(node_tb))
        
        train_normal = node_normal[:n_train_idx]
        test_normal = node_normal[n_train_idx:]
        
        train_tb = node_tb[:t_train_idx]
        test_tb = node_tb[t_train_idx:]
        
        # Save to filesystem
        for subset, normal_imgs, tb_imgs in [('train', train_normal, train_tb), ('test', test_normal, test_tb)]:
            normal_dir = os.path.join(output_root, node, subset, 'Normal')
            tb_dir = os.path.join(output_root, node, subset, 'TB')
            
            os.makedirs(normal_dir, exist_ok=True)
            os.makedirs(tb_dir, exist_ok=True)
            
            for img_path in normal_imgs:
                shutil.copy(img_path, os.path.join(normal_dir, os.path.basename(img_path)))
            for img_path in tb_imgs:
                shutil.copy(img_path, os.path.join(tb_dir, os.path.basename(img_path)))
                
        print(f"Created data for {node}:")
        print(f"  Train: Normal={len(train_normal)}, TB={len(train_tb)} (Total={len(train_normal)+len(train_tb)})")
        print(f"  Test:  Normal={len(test_normal)}, TB={len(test_tb)} (Total={len(test_normal)+len(test_tb)})")

def main():
    # Directories
    raw_dir = "dataset/raw"
    extracted_dir = "dataset/extracted"
    processed_dir = "dataset"
    
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(extracted_dir, exist_ok=True)
    
    montgomery_zip = os.path.join(raw_dir, "NLM-MontgomeryCXRSet.zip")
    shenzhen_zip = os.path.join(raw_dir, "ChinaSet_AllFiles.zip")
    
    # 1. Download
    if not os.path.exists(montgomery_zip):
        download_file(MONTGOMERY_URL, montgomery_zip)
    else:
        print("Montgomery County dataset already downloaded.")
        
    if not os.path.exists(shenzhen_zip):
        download_file(SHENZHEN_URL, shenzhen_zip)
    else:
        print("Shenzhen Hospital dataset already downloaded.")
        
    # 2. Extract
    montgomery_extracted = os.path.join(extracted_dir, "Montgomery")
    shenzhen_extracted = os.path.join(extracted_dir, "Shenzhen")
    
    if not os.path.exists(montgomery_extracted):
        extract_zip(montgomery_zip, montgomery_extracted)
    if not os.path.exists(shenzhen_extracted):
        extract_zip(shenzhen_zip, shenzhen_extracted)
        
    # 3. Scan & Process
    print("Scanning datasets...")
    m_normal, m_tb = scan_images(montgomery_extracted)
    s_normal, s_tb = scan_images(shenzhen_extracted)
    
    print(f"Montgomery dataset: {len(m_normal)} normal, {len(m_tb)} TB (Total={len(m_normal)+len(m_tb)})")
    print(f"Shenzhen dataset:   {len(s_normal)} normal, {len(s_tb)} TB (Total={len(s_normal)+len(s_tb)})")
    
    combined_normal = m_normal + s_normal
    combined_tb = m_tb + s_tb
    
    print(f"Combined dataset:   {len(combined_normal)} normal, {len(combined_tb)} TB (Total={len(combined_normal)+len(combined_tb)})")
    
    # 4. Stratify and split into node datasets
    partition_and_save(combined_normal, combined_tb, processed_dir)
    
    # 5. Clean up extraction directories to free space
    print("Cleaning up extraction cache...")
    try:
        shutil.rmtree(extracted_dir)
        print("Cleaned up extraction cache.")
    except Exception as e:
        print(f"Failed to clean up extraction cache: {e}")

if __name__ == "__main__":
    main()
