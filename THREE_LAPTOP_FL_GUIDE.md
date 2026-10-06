# Three-Laptop Real-Time TB Federated Learning System
## Operational Verification & Multi-Machine Demonstration Guide

### Core System Philosophy
> **"Train together. Keep patient data local."**

The platform demonstrates a genuine Federated Learning lifecycle for Tuberculosis Chest X-ray classification across three physical machines connected over the same local Wi-Fi/LAN:
$$\text{Global ResNet-18 } v1 \longrightarrow \text{Edge Training (Hospitals A \& B)} \longrightarrow \text{Differential Privacy (DP-SGD)} \longrightarrow \text{FedAvg Aggregation} \longrightarrow \text{Global Model } v2 \longrightarrow \text{Redistribution}$$

---

## 1. Physical Hardware Topology

```text
                           LAPTOP A
                CENTRAL ADMIN / FL AGGREGATION
                    IP: 192.168.1.XX (LAN)
                           │
          ┌────────────────┴────────────────┐
          │                                 │
     Wi-Fi / LAN                       Wi-Fi / LAN
          │                                 │
          ↓                                 ↓
      LAPTOP B                          LAPTOP C
     HOSPITAL A                        HOSPITAL B
     (Urban TB)                       (Rural Clinic)
```

| Machine | Role | Services & Processes | Network Ports |
| :--- | :--- | :--- | :--- |
| **Laptop A** | Central Admin Hub & FL Aggregator | FastAPI Backend, Vite Admin Dashboard, FedAvg Aggregation Engine, Global ResNet-18 Model Registry ($v1 \rightarrow v2$), SSE Telemetry | `0.0.0.0:8000` (FastAPI)<br>`0.0.0.0:5173` (Vite)<br>`0.0.0.0:8099` (Flower/gRPC) |
| **Laptop B** | Hospital A Edge Node | Local ResNet-18 PyTorch training, Opacus DP-SGD ($\varepsilon, \delta$), Isolated CXR Dataset (`Model/data/hospital_A/`), Heartbeat Daemon | Connects to `LAPTOP_A_IP:8000` & `8099` |
| **Laptop C** | Hospital B Edge Node | Local ResNet-18 PyTorch training, Opacus DP-SGD ($\varepsilon, \delta$), Isolated CXR Dataset (`Model/data/hospital_B/`), Heartbeat Daemon | Connects to `LAPTOP_A_IP:8000` & `8099` |

---

## 2. Strict Privacy Boundary Enforcement

Hospital A and Hospital B **NEVER** transmit raw radiograph images, patient PHI, or DICOM files to Laptop A:
- **Laptop A receives only**: Serialized PyTorch weight tensors ($\sim 11.2\text{ MB}$), sample counts ($n_A, n_B$), cross-entropy losses, local accuracies, and Opacus $(\varepsilon, \delta)$ privacy accountant budgets.
- **Laptop B & C retain**: Raw DICOM images, patient identities, local SQLite database records, and edge Grad-CAM heatmaps.

```text
RAW PATIENT IMAGES: ✕ NEVER LEAVE HOSPITAL (LAPTOPS B & C)
MODEL UPDATES:      ✓ SERIALIZED WEIGHT VECTORS SENT TO CENTRAL SERVER (LAPTOP A)
```

---

## 3. Step-by-Step Multi-Laptop Execution Runbook

### Step 3.1: Laptop A (Central Admin & Aggregation Server)
1. Determine Laptop A's Wi-Fi IP address on Windows:
   ```powershell
   ipconfig
   # Look for IPv4 Address under Wireless LAN adapter Wi-Fi: e.g. 192.168.1.100
   ```
2. Start the FastAPI backend server (binds to `0.0.0.0:8000`):
   ```powershell
   cd Major-Project
   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
3. Start the Vite Frontend (binds to `0.0.0.0:5173`):
   ```powershell
   cd Major-Project/Frontend
   npm run dev
   ```
4. Open the browser on Laptop A:
   ```text
   http://localhost:5173
   ```
   Log in with Admin credentials (`admin@pulmoscan.org` / `AdminPass123!`).

---

### Step 3.2: Laptop B (Hospital A — Urban Referral Center)
1. Clone or sync the project repository onto Laptop B.
2. Launch the standalone Hospital A edge client pointing to Laptop A's IP address:
   ```bash
   cd Major-Project
   python Model/run_hospital_node.py \
       --node_id node_A \
       --server 192.168.1.100:8099 \
       --api_server http://192.168.1.100:8000 \
       --demo
   ```
3. **Observed Terminal Output (Laptop B)**:
   ```text
   ==========================================================
    HOSPITAL A — URBAN REFERRAL CENTER
   ==========================================================
   [CLIENT] Initializing Edge Hospital Federated Client
   [CLIENT] Node ID:         node_A
   [CLIENT] Central Server:  192.168.1.100:8099
   [CLIENT] REST API Hub:    http://192.168.1.100:8000
   [CLIENT] Mode:            DEMONSTRATION (~15-25s round)
   [CLIENT] Privacy Engine:  Opacus DP-SGD (ENABLED)
   [DATA]   Local CXR samples: 120 (PHYSICALLY ISOLATED ON THIS LAPTOP)
   [DATA]   Privacy Boundary: RAW CXR IMAGES NEVER LEAVE THIS MACHINE.
   [CLIENT] Authentication successful with Central Server ✓
   [FL]     Waiting for Central Server to initiate Federated Learning round...
   ```

---

### Step 3.3: Laptop C (Hospital B — Rural District Clinic)
1. Clone or sync the project repository onto Laptop C.
2. Launch the standalone Hospital B edge client pointing to Laptop A's IP address:
   ```bash
   cd Major-Project
   python Model/run_hospital_node.py \
       --node_id node_B \
       --server 192.168.1.100:8099 \
       --api_server http://192.168.1.100:8000 \
       --demo
   ```
3. **Observed Terminal Output (Laptop C)**:
   ```text
   ==========================================================
    HOSPITAL B — RURAL DISTRICT CLINIC
   ==========================================================
   [CLIENT] Initializing Edge Hospital Federated Client
   [CLIENT] Node ID:         node_B
   [CLIENT] Central Server:  192.168.1.100:8099
   [CLIENT] REST API Hub:    http://192.168.1.100:8000
   [CLIENT] Mode:            DEMONSTRATION (~15-25s round)
   [CLIENT] Privacy Engine:  Opacus DP-SGD (ENABLED)
   [DATA]   Local CXR samples: 120 (PHYSICALLY ISOLATED ON THIS LAPTOP)
   [DATA]   Privacy Boundary: RAW CXR IMAGES NEVER LEAVE THIS MACHINE.
   [CLIENT] Authentication successful with Central Server ✓
   [FL]     Waiting for Central Server to initiate Federated Learning round...
   ```

---

### Step 3.4: Laptop A Triggers the Federated Round
1. On Laptop A's Admin Dashboard:
   - Notice the **Connected Hospital Edge Nodes** table shows:
     - `Hospital A`: ● Online (Last Heartbeat: 2 sec ago) · Model: `v1` · Dataset: `120 CXRs`
     - `Hospital B`: ● Online (Last Heartbeat: 3 sec ago) · Model: `v1` · Dataset: `120 CXRs`
2. Click the prominent button:
   $$\mathbf{START\ FEDERATED\ LEARNING\ ROUND}$$
3. The real-time **5-Stage Orchestration Modal** opens automatically:
   - **Stage 1 (Broadcast Global Model)**: Distributes ResNet-18 $v1$ weights to Hospital A & B.
   - **Stage 2 (Local Edge Training)**: Terminals on Laptops B & C simultaneously print mini-batch training (`Epoch 1/1 - Batch 1/4`, loss, accuracy, and Opacus $\varepsilon$). The UI live cards update in real time.
   - **Stage 3 (Update Ingestion)**: Serialized weight tensors ($\sim 11.2\text{ MB}$) transmitted over encrypted transport. Laptop A confirms `2 / 2 CLIENT UPDATES RECEIVED`.
   - **Stage 4 (FedAvg Aggregation)**: Executes mathematically exact sample-weighted tensor averaging:
     $$W_{\text{global, new}} = \left(\frac{120}{240}\right) W_A + \left(\frac{120}{240}\right) W_B$$
   - **Stage 5 (Global Model Update)**: Transition from `ResNet-18 v1` $\longrightarrow$ `ResNet-18 v2`. Checkpoint `federated_model_v2.pth` is serialized and redistributed to Hospital A & B.

---

## 4. Single-Laptop Fail-Safe Simulation Mode (`--simulate`)

If demonstrating on a single machine without external laptops:
1. In the Admin Dashboard configuration bar, toggle:
   $$\text{Cluster Deployment} \longrightarrow \textbf{Fail-Safe Simulation (Single Laptop Demo)}$$
2. Click **START FEDERATED LEARNING ROUND**.
3. Background client threads simulate the edge hospital workers while strictly tracking model versioning ($v1 \rightarrow v2$) and saving real checkpoints.

---

## 5. Summary of Implemented REST & Telemetry API

| Endpoint | Method | Functionality |
| :--- | :--- | :--- |
| `/api/fl/round/start` | POST | Initiates genuine FL round across edge nodes |
| `/api/fl/round/cancel` | POST | Cancels an active in-progress round |
| `/api/fl/live-status` | GET | Real-time cluster status, active stage, and update vectors |
| `/api/fl/nodes` | GET | Edge hospital registry with live 3-second heartbeats |
| `/api/fl/node/register` | POST | Edge node authentication and cluster joining |
| `/api/fl/node/heartbeat` | POST | Edge node periodic liveness and DP budget reporting |
| `/api/fl/model/current` | GET | Active global model architecture, version, and validation metrics |
| `/api/fl/models` | GET | Model Registry with historical checkpoints and participants |
| `/api/fl/rounds` | GET | Completed federated learning rounds chronological history |
| `/api/fl/events` | GET | Synchronized backend telemetry event stream |
| `/api/fl/events/emit` | POST | Edge clients broadcast batch training progress to Central Server |
| `/api/fl/round/submit-update` | POST | Edge clients upload serialized weights ($11.2\text{ MB}$) and metrics |
