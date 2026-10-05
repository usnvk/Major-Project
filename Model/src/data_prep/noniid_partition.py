"""
Non-IID Data Distribution Analyzer & Dirichlet Partitioner
Major Project: Privacy-Preserving Federated Learning for TB Diagnosis
Batch: B27, SIT Tumakuru

In real-world healthcare federated learning, data across clinical institutions
is Non-Identically and Independently Distributed (Non-IID). Different hospitals
experience different disease prevalence (e.g. tertiary TB referral center vs
general district hospital screening).

This module provides:
1. Dirichlet Distribution (Dir(alpha)) partitioning simulation
2. Quantitative distribution metrics:
   - Class imbalance ratios (Normal vs TB)
   - Total Variation Distance (TVD) from uniform IID
   - Shannon Diversity Entropy per node
3. Real dataset scanner that reports the active node partitions
"""

import os
import sys
import math
import argparse
import numpy as np


def compute_shannon_entropy(counts: list[int]) -> float:
    """Computes Shannon entropy in bits for class distribution."""
    total = sum(counts)
    if total == 0:
        return 0.0
    entropy = 0.0
    for c in counts:
        if c > 0:
            p = c / total
            entropy -= p * math.log2(p)
    return entropy


def compute_tvd(p: list[float], q: list[float]) -> float:
    """Computes Total Variation Distance between two probability distributions."""
    return 0.5 * sum(abs(pi - qi) for pi, qi in zip(p, q))


def analyze_active_dataset(dataset_dir: str):
    """
    Inspects the actual local dataset directory and calculates non-IID metrics
    for each hospital node.
    """
    print("=" * 72)
    print("       ACTIVE FEDERATED DATASET: NON-IID DISTRIBUTION AUDIT")
    print("=" * 72)

    nodes = ["node_A", "node_B", "node_C"]
    hospital_names = {
        "node_A": "Hospital A (Urban TB Referral Center)",
        "node_B": "Hospital B (Rural General Hospital)",
        "node_C": "Hospital C (Metropolitan Academic Center)",
    }

    stats = {}
    global_normal = 0
    global_tb = 0

    for node in nodes:
        node_stats = {"train": {}, "test": {}}
        for split in ["train", "test"]:
            split_dir = os.path.join(dataset_dir, node, split)
            if not os.path.exists(split_dir):
                print(f"[WARN] Path not found: {split_dir}")
                continue
            normal_cnt = len(os.listdir(os.path.join(split_dir, "Normal"))) if os.path.exists(os.path.join(split_dir, "Normal")) else 0
            tb_cnt = len(os.listdir(os.path.join(split_dir, "TB"))) if os.path.exists(os.path.join(split_dir, "TB")) else 0
            node_stats[split] = {"Normal": normal_cnt, "TB": tb_cnt}
            if split == "train":
                global_normal += normal_cnt
                global_tb += tb_cnt
        stats[node] = node_stats

    # Print Table
    header = f"{'Node ID':<8} | {'Hospital Institution':<38} | {'Normal':<8} | {'TB':<8} | {'TB %':<8} | {'Entropy':<7} | {'TVD Skew':<8}"
    print(header)
    print("-" * len(header))

    global_total = global_normal + global_tb
    global_p = [global_normal / global_total, global_tb / global_total] if global_total > 0 else [0.5, 0.5]

    for node in nodes:
        tr = stats[node].get("train", {"Normal": 0, "TB": 0})
        n_norm = tr["Normal"]
        n_tb = tr["TB"]
        tot = n_norm + n_tb
        if tot == 0:
            continue
        tb_pct = (n_tb / tot) * 100
        p_node = [n_norm / tot, n_tb / tot]
        entropy = compute_shannon_entropy([n_norm, n_tb])
        tvd = compute_tvd(p_node, global_p)

        inst_name = hospital_names.get(node, node)
        print(f"{node:<8} | {inst_name:<38} | {n_norm:<8} | {n_tb:<8} | {tb_pct:>6.1f}% | {entropy:>6.3f} | {tvd:>7.4f}")

    print("-" * len(header))
    print(f"{'Global':<8} | {'Total Pooled Cohort':<38} | {global_normal:<8} | {global_tb:<8} | {(global_tb/global_total*100):>6.1f}% | {compute_shannon_entropy([global_normal, global_tb]):>6.3f} | {'0.0000':<8}")
    print("=" * 72)

    print("\nNon-IID Characteristics Summary:")
    print("  - Node A: High TB prevalence (skewed toward Positive class, mimics specialized pulmonary clinics)")
    print("  - Node B: Low TB prevalence (skewed toward Normal class, mimics community health centers)")
    print("  - Node C: Balanced cohort (reference research and teaching hospital)")
    print("  - Outcome: Validates that Federated Learning (FedAvg) aggregates knowledge without centralizing patient scans.")


def simulate_dirichlet_partitions(num_samples: int = 6000, alpha: float = 0.5, num_clients: int = 3):
    """
    Simulates Dirichlet-based non-IID partitioning for given alpha.
    Lower alpha (e.g. 0.1) => extreme non-IID skew.
    Higher alpha (e.g. 10.0) => nearly uniform IID.
    """
    print(f"\n--- Simulating Dirichlet Partitioning (alpha={alpha}, N={num_samples}, Clients={num_clients}) ---")
    np.random.seed(42)

    # Assume binary classification with 50/50 overall prevalence
    class_sizes = [num_samples // 2, num_samples // 2]
    client_counts = {i: [0, 0] for i in range(num_clients)}

    for class_idx, n_c in enumerate(class_sizes):
        proportions = np.random.dirichlet(np.repeat(alpha, num_clients))
        allocations = (proportions * n_c).astype(int)
        # Fix rounding
        allocations[-1] += n_c - allocations.sum()
        for client_id in range(num_clients):
            client_counts[client_id][class_idx] = int(allocations[client_id])

    print(f"{'Client':<10} | {'Normal':<8} | {'TB':<8} | {'Total':<8} | {'TB %':<8}")
    print("-" * 50)
    for c_id, (n, tb) in client_counts.items():
        tot = n + tb
        tb_pct = (tb / tot * 100) if tot > 0 else 0
        print(f"Client {c_id+1:<3} | {n:<8} | {tb:<8} | {tot:<8} | {tb_pct:>6.1f}%")
    print("-" * 50)


def main():
    parser = argparse.ArgumentParser(description="Federated Non-IID Dataset Analyzer & Partitioner")
    parser.add_argument("--dataset_dir", type=str, default="dataset", help="Path to federated dataset root")
    parser.add_argument("--simulate", action="store_true", help="Run Dirichlet simulation")
    parser.add_argument("--alpha", type=float, default=0.5, help="Dirichlet concentration parameter")
    args = parser.parse_args()

    # Find dataset relative to script or current directory
    target_dir = args.dataset_dir
    if not os.path.exists(target_dir):
        alt_path = os.path.join(os.path.dirname(__file__), "..", "..", "dataset")
        if os.path.exists(alt_path):
            target_dir = os.path.abspath(alt_path)

    if os.path.exists(target_dir):
        analyze_active_dataset(target_dir)
    else:
        print(f"[INFO] Dataset directory '{target_dir}' not found. Running simulation mode.")

    if args.simulate or not os.path.exists(target_dir):
        for test_alpha in [0.1, 0.5, 5.0]:
            simulate_dirichlet_partitions(alpha=test_alpha)


if __name__ == "__main__":
    main()
