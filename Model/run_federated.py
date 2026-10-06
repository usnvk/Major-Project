import argparse
import os
import subprocess
import sys
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Federated Learning Simulation Orchestrator (FedProx + DP-SGD + mTLS)")
    parser.add_argument("--rounds", type=int, default=3, help="Number of federated learning rounds")
    parser.add_argument("--epochs", type=int, default=1, help="Local epochs per round per client")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size for local training")
    parser.add_argument("--port", type=str, default="8099", help="Flower server port")
    parser.add_argument("--dp", action="store_true", default=False, help="Enable Opacus Differential Privacy (DP-SGD)")
    parser.add_argument("--noise_multiplier", type=float, default=1.0, help="DP noise multiplier")
    parser.add_argument("--max_grad_norm", type=float, default=1.0, help="DP max gradient norm")
    parser.add_argument("--target_delta", type=float, default=1e-5, help="DP target delta")
    parser.add_argument("--mu", type=float, default=0.01, help="FedProx proximal regularization coefficient mu")
    parser.add_argument("--byzantine", action="store_true", default=False, help="Enable Byzantine-resilient Trimmed-Mean")
    parser.add_argument("--trim_ratio", type=float, default=0.1, help="Trimmed mean ratio")
    parser.add_argument("--mtls", action="store_true", default=False, help="Enable mTLS x509 encryption")
    parser.add_argument("--fp16", action="store_true", default=False, help="Enable FP16 parameter compression")
    args = parser.parse_args()

    print(f"=== Launching Tuberculosis Federated Learning Simulation ===")
    print(f"  • Algorithm:           FedProx (mu={args.mu})")
    print(f"  • Privacy Engine:      {'Opacus DP-SGD (ENABLED)' if args.dp else 'Standard SGD'}")
    print(f"  • Byzantine Resilience: {'Trimmed-Mean (ENABLED)' if args.byzantine else 'Standard FedAvg'}")
    print(f"  • Transport Protocol:  {'mTLS Encrypted gRPC' if args.mtls else 'Plain gRPC'}")

    os.makedirs("logs", exist_ok=True)

    # 1. Start Server
    server_log_path = os.path.join("logs", "server.log")
    server_log = open(server_log_path, "w", encoding="utf-8")
    print(f"Starting Flower Aggregation Server on port {args.port}...")
    server_cmd = [
        sys.executable, "-m", "src.federated.server",
        "--rounds", str(args.rounds),
        "--port", str(args.port),
        "--trim_ratio", str(args.trim_ratio),
        "--min_clients", "3",
    ]
    if args.dp:
        server_cmd.append("--dp")
    if args.byzantine:
        server_cmd.append("--byzantine")
    if args.mtls:
        server_cmd.append("--mtls")

    server_proc = subprocess.Popen(server_cmd, stdout=server_log, stderr=subprocess.STDOUT)

    # Wait 3 seconds for server to bind
    print("Waiting 3 seconds for Flower server to bind...")
    time.sleep(3)

    # 2. Start Clients (Hospital Nodes A, B, C)
    client_procs = []
    client_logs = []

    nodes = ["node_A", "node_B", "node_C"]
    for node in nodes:
        print(f"Starting Flower Client for {node}...")
        log_path = os.path.join("logs", f"{node}.log")
        log_file = open(log_path, "w", encoding="utf-8")
        client_logs.append(log_file)

        client_cmd = [
            sys.executable, "-m", "src.federated.client",
            "--node", node,
            "--epochs", str(args.epochs),
            "--batch_size", str(args.batch_size),
            "--server", f"localhost:{args.port}",
            "--mu", str(args.mu),
        ]
        if args.dp:
            client_cmd.extend([
                "--dp",
                "--noise_multiplier", str(args.noise_multiplier),
                "--max_grad_norm", str(args.max_grad_norm),
                "--target_delta", str(args.target_delta),
            ])
        if args.fp16:
            client_cmd.append("--fp16")
        if args.mtls:
            client_cmd.append("--mtls")

        proc = subprocess.Popen(client_cmd, stdout=log_file, stderr=subprocess.STDOUT)
        client_procs.append((node, proc))
        time.sleep(1)

    print("\nAll 3 Hospital Nodes launched successfully!")
    print("Federated training running across cluster. Logs in 'logs/' folder:")
    print("  - logs/server.log")
    print("  - logs/node_A.log")
    print("  - logs/node_B.log")
    print("  - logs/node_C.log\n")

    # 3. Monitor execution
    start_time = time.time()
    try:
        while True:
            active_clients = [node for node, proc in client_procs if proc.poll() is None]
            if not active_clients:
                print("\nAll hospital clients completed training round execution.")
                break

            elapsed = int(time.time() - start_time)
            print(f"Active clients: {', '.join(active_clients)} | Elapsed time: {elapsed}s", end="\r", flush=True)
            time.sleep(4)

    except KeyboardInterrupt:
        print("\nTerminating all federated processes...")
        server_proc.terminate()
        for _, proc in client_procs:
            proc.terminate()

    # Close file handles
    server_log.close()
    for log_file in client_logs:
        log_file.close()

    server_proc.wait()
    print("\n=== Federated Learning Training Pipeline Completed! ===")


if __name__ == "__main__":
    main()
