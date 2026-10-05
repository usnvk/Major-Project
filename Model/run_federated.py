import subprocess
import time
import sys
import os

import argparse

def main():
    parser = argparse.ArgumentParser(description="Federated Learning Simulation Orchestrator")
    parser.add_argument("--rounds", type=int, default=3, help="Number of federated learning rounds")
    parser.add_argument("--epochs", type=int, default=2, help="Local epochs per round per client")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size for local training")
    parser.add_argument("--port", type=str, default="8099", help="Flower server port")
    parser.add_argument("--dp", action="store_true", default=False, help="Enable Opacus Differential Privacy")
    parser.add_argument("--noise_multiplier", type=float, default=1.0, help="DP noise multiplier")
    parser.add_argument("--max_grad_norm", type=float, default=1.0, help="DP max gradient norm")
    parser.add_argument("--target_delta", type=float, default=1e-5, help="DP target delta")
    args = parser.parse_args()

    print(f"=== Launching Federated Learning Simulation (DP={'ENABLED' if args.dp else 'DISABLED'}) ===")
    
    # Create logs directory
    os.makedirs("logs", exist_ok=True)
    
    # 1. Start Server
    server_log_path = os.path.join("logs", "server.log")
    server_log = open(server_log_path, "w", encoding="utf-8")
    print(f"Starting central Flower Server on port {args.port}...")
    server_cmd = [sys.executable, "-m", "src.federated.server", "--rounds", str(args.rounds), "--port", str(args.port)]
    if args.dp:
        server_cmd.append("--dp")
    server_proc = subprocess.Popen(server_cmd, stdout=server_log, stderr=subprocess.STDOUT)
    
    # Wait for server to spin up and bind to port
    print("Waiting 3 seconds for server to bind...")
    time.sleep(3)
    
    # 2. Start Clients (Hospitals A, B, C)
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
            "--server", f"localhost:{args.port}"
        ]
        if args.dp:
            client_cmd.extend([
                "--dp",
                "--noise_multiplier", str(args.noise_multiplier),
                "--max_grad_norm", str(args.max_grad_norm),
                "--target_delta", str(args.target_delta)
            ])

        proc = subprocess.Popen(client_cmd, stdout=log_file, stderr=subprocess.STDOUT)
        client_procs.append((node, proc))
        # Stagger client startup slightly
        time.sleep(1)
        
    print("\nAll processes launched successfully!")
    print("Federated training is running. Monitor logs in the 'logs/' folder:")
    print("  - logs/server.log")
    print("  - logs/node_A.log")
    print("  - logs/node_B.log")
    print("  - logs/node_C.log\n")
    
    # 3. Monitor clients execution
    start_time = time.time()
    try:
        while True:
            # Check which clients are still running
            active_clients = [node for node, proc in client_procs if proc.poll() is None]
            if not active_clients:
                print("All clients have completed execution.")
                break
                
            elapsed = int(time.time() - start_time)
            print(f"Active clients: {', '.join(active_clients)} | Elapsed time: {elapsed}s", end="\r", flush=True)
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\nKeyboardInterrupt received. Terminating all processes...")
        server_proc.terminate()
        for _, proc in client_procs:
            proc.terminate()
            
    # Close all file descriptors
    server_log.close()
    for log_file in client_logs:
        log_file.close()
        
    # Wait for server process to shut down
    server_proc.wait()
    print("\n=== Federated Learning Simulation Completed! ===")

if __name__ == "__main__":
    main()
