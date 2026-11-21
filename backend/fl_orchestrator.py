"""
Central Federated Learning Orchestration Engine & Aggregation Hub
Runs on the Admin Server (Laptop A).
Dynamically manages any number of hospital nodes (1, 2, 3, 4, 5+),
performs real sample-weighted FedAvg aggregation, model checkpoint versioning,
and real-time SSE event streaming.
"""

import datetime
import json
import os
import sys
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def safe_print(*args, **kwargs):
    try:
        sys.stdout.write(" ".join(str(a) for a in args) + kwargs.get("end", "\n"))
        sys.stdout.flush()
    except Exception:
        try:
            safe_text = " ".join(
                str(a).encode("ascii", errors="replace").decode("ascii") for a in args
            )
            sys.stdout.write(safe_text + kwargs.get("end", "\n"))
            sys.stdout.flush()
        except Exception:
            pass


print = safe_print

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
MODEL_DIR = PROJECT_ROOT / "Model"
CHECKPOINTS_DIR = MODEL_DIR / "checkpoints"
CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)


class FederatedOrchestrator:
    """
    Singleton FL Orchestrator.
    Dynamically supports 1 to N hospital nodes.
    Aggregation triggers once ALL round participants have submitted updates.
    """

    def __init__(self):
        self.lock = threading.Lock()
        self.is_active = False
        self.current_round = 1
        self.round_id = "FL-2026-001"
        # idle | broadcasting | local_training | receiving_updates | aggregating | completed
        self.stage = "idle"
        self.aggregation_method = "FedAvg"
        self.is_simulation = False
        self.demo_mode = True
        self.target_rounds = 1
        self.rounds_completed_in_session = 0
        self.dp_enabled = True

        # Global Model Versioning
        self.global_version = "v1"
        self.global_checkpoint_path = str(MODEL_DIR / "models" / "federated_model.pth")
        self.validation_accuracy: Optional[float] = None
        self.validation_loss: Optional[float] = None

        # Dynamic Node Registry — any node_id is accepted when it heartbeats
        self.nodes: Dict[str, Dict[str, Any]] = {}

        # Participants confirmed at round-start (nodes that were live when round began)
        self.round_participants: List[str] = []

        # Updates received for the active round (keyed by node_id)
        self.round_updates: Dict[str, Dict[str, Any]] = {}

        # Event stream buffer (up to 200 events for real-time frontend)
        self.events: deque = deque(maxlen=200)
        self.event_subscribers: List[Any] = []

        # Model Registry
        self.model_registry: List[Dict[str, Any]] = []

        # Round History
        self.round_history: List[Dict[str, Any]] = []

        # Start node liveness monitor
        self._start_liveness_monitor()

    # ─────────────────────────── Internal Helpers ────────────────────────────

    def _start_liveness_monitor(self):
        """Periodically marks nodes offline if they miss heartbeats."""

        def monitor_loop():
            while True:
                time.sleep(4.0)
                now = time.time()
                with self.lock:
                    for nid, info in self.nodes.items():
                        if now - info.get("last_heartbeat", 0) > 35.0:
                            info["status"] = "offline"

        t = threading.Thread(target=monitor_loop, daemon=True)
        t.start()

    def emit_event(self, event_type: str, payload: Optional[Dict[str, Any]] = None):
        """Emits a real-time event to the in-memory event stream and auto-advances stages."""
        event_obj = {
            "id": len(self.events) + 1,
            "type": event_type,
            "round": self.current_round,
            "round_id": self.round_id,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "payload": payload or {},
        }
        with self.lock:
            self.events.append(event_obj)
            # Auto-advance stage when local training finishes or upload starts
            if event_type in ("UPDATE_GENERATED", "MODEL_UPDATE_UPLOADING"):
                if self.stage == "local_training":
                    self.stage = "receiving_updates"
            elif event_type == "LOCAL_TRAINING_PROGRESS":
                b = (payload or {}).get("batch")
                tb = (payload or {}).get("total_batches")
                if b and tb and b >= tb:
                    if self.stage == "local_training":
                        self.stage = "receiving_updates"
        for q in list(self.event_subscribers):
            try:
                q.put(event_obj)
            except Exception:
                pass

    # ─────────────────────────── Heartbeat ───────────────────────────────────

    def record_heartbeat(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Receives heartbeat from any hospital node.
        Dynamically registers the node if it's new.
        """
        node_id = data.get("node_id")
        if not node_id:
            return {"status": "error", "message": "node_id required"}

        with self.lock:
            if node_id not in self.nodes:
                # Auto-register new node on first heartbeat
                self.nodes[node_id] = {
                    "node_id": node_id,
                    "name": data.get("name", node_id.upper()),
                    "status": "online",
                    "ip_address": data.get("ip_address", "127.0.0.1"),
                    "dataset_size": data.get("dataset_size", 0),
                    "model_version": self.global_version,
                    "last_heartbeat": time.time(),
                    "last_loss": None,
                    "last_acc": None,
                    "dp_epsilon": None,
                }
            node = self.nodes[node_id]
            node["status"] = "online"
            node["last_heartbeat"] = time.time()
            if "dataset_size" in data:
                node["dataset_size"] = data["dataset_size"]
            if "last_loss" in data and data["last_loss"] is not None:
                node["last_loss"] = data["last_loss"]
            if "last_acc" in data and data["last_acc"] is not None:
                node["last_acc"] = data["last_acc"]
            if "dp_epsilon" in data and data["dp_epsilon"] is not None:
                node["dp_epsilon"] = data["dp_epsilon"]
            if "model_version" in data and data["model_version"]:
                node["model_version"] = data["model_version"]
            if "name" in data and data["name"]:
                node["name"] = data["name"]

        return {"status": "ok", "node_id": node_id}

    # ─────────────────────────── Round Lifecycle ─────────────────────────────

    def start_round(
        self,
        aggregation: str = "FedAvg",
        demo: bool = False,
        dp: bool = False,
        simulate: bool = False,
        rounds: int = 1,
        min_nodes: int = 1,
    ) -> Dict[str, Any]:
        """
        Initiates a real Federated Learning round.
        Works with ANY number of live nodes (minimum 1 by default).
        """
        with self.lock:
            if self.is_active:
                return {
                    "status": "error",
                    "message": "A federated learning round is already in progress.",
                }

            if simulate:
                return {
                    "status": "error",
                    "message": "Simulated training is disabled. Connect real hospital nodes.",
                }

            now = time.time()
            live_nodes = [
                nid
                for nid, node in self.nodes.items()
                if node.get("status") == "online"
                and now - node.get("last_heartbeat", 0) <= 35.0
            ]

            if len(live_nodes) < max(1, min_nodes):
                return {
                    "status": "error",
                    "message": (
                        f"At least {min_nodes} live hospital node(s) required. "
                        f"Currently {len(live_nodes)} connected. "
                        "Start a hospital node client and try again."
                    ),
                }

            # Increment round number if previous was successfully completed
            if self.stage == "completed":
                self.current_round += 1

            self.is_active = True
            self.aggregation_method = aggregation
            self.demo_mode = demo
            self.dp_enabled = dp
            self.target_rounds = max(1, rounds)
            self.is_simulation = False
            self.round_updates = {}
            self.round_participants = list(live_nodes)
            self.stage = "broadcasting"
            self.round_id = f"FL-2026-{self.current_round:03d}"

        n_nodes = len(self.round_participants)
        print("\n" + "=" * 60)
        print("   TB FEDERATED LEARNING SERVER — CENTRAL AGGREGATION HUB")
        print("=" * 60)
        print(f"[SERVER]  Admin Server listening on port 8000")
        print(f"[MODEL]   Global Model {self.global_version} loaded")
        print(f"[CLUSTER] {n_nodes} hospital node(s) participating this round:")
        for nid in self.round_participants:
            info = self.nodes.get(nid, {})
            print(f"  → {nid}  |  Dataset: {info.get('dataset_size', 0)} CXRs  |  IP: {info.get('ip_address', '?')}")
        print(f"\n[ROUND]   FL Round #{self.current_round} ({self.round_id}) started")
        print(f"[METHOD]  Aggregation: {aggregation} (sample-weighted)")
        print(f"[BROADCAST] Sending Global Model {self.global_version} to {n_nodes} edge node(s)...")

        self.emit_event("ROUND_CREATED", {
            "round": self.current_round,
            "round_id": self.round_id,
            "global_model": self.global_version,
            "aggregation": self.aggregation_method,
            "participants": self.round_participants,
            "num_nodes": n_nodes,
        })

        self.emit_event("GLOBAL_MODEL_BROADCAST", {
            "version": self.global_version,
            "nodes": self.round_participants,
            "status": f"Global Model {self.global_version} distributed to {n_nodes} hospital node(s).",
        })

        # Transition to local training briskly
        time.sleep(0.4)
        with self.lock:
            self.stage = "local_training"

        print(f"[ROUND]   Waiting for local edge training on {n_nodes} hospital node(s)...")

        return {
            "status": "round_started",
            "round": self.current_round,
            "round_id": self.round_id,
            "global_model": self.global_version,
            "aggregation": self.aggregation_method,
            "participants": self.round_participants,
            "num_nodes": n_nodes,
        }

    def submit_update(
        self,
        node_id: str,
        round_num: int,
        loss: float,
        accuracy: float,
        epsilon: float,
        num_samples: int,
        size_mb: float,
        weights_hash: Optional[str] = None,
        parameters_base64: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Receives local model parameter updates from any hospital node.
        Triggers FedAvg aggregation once ALL round participants have submitted.
        """
        with self.lock:
            if not self.is_active or round_num != self.current_round:
                return {"status": "error", "message": "No matching active round."}

            if node_id not in self.round_participants:
                return {
                    "status": "error",
                    "message": f"Node {node_id} was not registered as a participant for this round.",
                }

            self.round_updates[node_id] = {
                "node_id": node_id,
                "loss": loss,
                "accuracy": accuracy,
                "epsilon": epsilon,
                "num_samples": num_samples,
                "size_mb": size_mb,
                "weights_hash": weights_hash,
                "parameters_base64": parameters_base64,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }
            received_count = len(self.round_updates)
            total_expected = len(self.round_participants)

        # Determine node label for logging
        node_label = self.nodes.get(node_id, {}).get("name", node_id.upper())
        print("\n" + "-" * 60)
        print(f"[CENTRAL HUB] RECEIVED MODEL UPDATE FROM {node_label}")
        print(f"  • Parameters Size:   {size_mb} MB")
        print(f"  • Local Training:    Loss: {loss:.4f} | Accuracy: {accuracy}%")
        print(f"  • Dataset Cohort:    {num_samples} patient radiographs")
        print(f"  • DP-SGD Privacy:    ε = {epsilon}")
        if weights_hash:
            print(f"  • Weight Checksum:   SHA256:{weights_hash}")
        print(f"  • Verification:      {received_count}/{total_expected} Nodes Submitted ✓")
        print("-" * 60)

        self.emit_event("UPDATE_RECEIVED", {
            "node_id": node_id,
            "received_count": received_count,
            "total_clients": total_expected,
            "size_mb": size_mb,
            "loss": loss,
            "accuracy": accuracy,
            "epsilon": epsilon,
            "samples": num_samples,
            "weights_hash": weights_hash,
        })

        # Trigger aggregation when ALL participants have submitted
        if received_count >= total_expected:
            # Verify all submissions have real model parameters
            missing_params = [
                nid
                for nid in self.round_participants
                if not self.round_updates.get(nid, {}).get("parameters_base64")
            ]
            if missing_params:
                with self.lock:
                    self.stage = "receiving_updates"
                return {
                    "status": "updates_received",
                    "received_count": received_count,
                    "message": f"Waiting for model parameters from: {missing_params}",
                }

            with self.lock:
                self.stage = "aggregating"

            self.emit_event("AGGREGATION_STARTED", {
                "round": self.current_round,
                "participants": self.round_participants,
                "received_count": received_count,
                "total_clients": total_expected,
                "total_samples": sum(u.get("num_samples", 0) for u in self.round_updates.values()),
            })

            result = self._execute_fedavg()
            if result.get("status") == "error":
                return result
            return {
                "status": "round_completed",
                "received_count": received_count,
                **result,
            }

        with self.lock:
            self.stage = "receiving_updates"

        return {"status": "update_accepted", "received_count": received_count}

    # ─────────────────────────── FedAvg Aggregation ──────────────────────────

    def _execute_fedavg(self) -> Dict[str, Any]:
        """
        Performs sample-weighted FedAvg aggregation across ALL participating nodes.
        Works with 1, 2, 3, 4, 5+ nodes.
        """
        import base64
        import io

        with self.lock:
            self.stage = "aggregating"

        print(f"\n[FEDAVG]  Starting aggregation across {len(self.round_updates)} node(s)...")

        updates = []
        for nid, update in self.round_updates.items():
            try:
                payload = base64.b64decode(update["parameters_base64"], validate=True)
                state_dict = torch.load(
                    io.BytesIO(payload),
                    map_location="cpu",
                    weights_only=True,
                )
                if not isinstance(state_dict, dict):
                    raise ValueError("Parameter payload is not a state dict")
                updates.append((update["num_samples"], state_dict, nid))
                print(f"  → Decoded weights from {nid}: {update['num_samples']} samples")
            except Exception as error:
                return {
                    "status": "error",
                    "message": f"Invalid model parameters from {nid}: {error}",
                }

        total_samples = sum(n for n, _, _ in updates)
        if total_samples <= 0:
            return {"status": "error", "message": "Cannot aggregate with 0 total samples."}

        # Verify all state dicts have matching keys
        all_keys = [set(sd.keys()) for _, sd, _ in updates]
        if len(all_keys) > 1 and not all(k == all_keys[0] for k in all_keys[1:]):
            return {"status": "error", "message": "Model architecture mismatch across nodes."}

        print(f"[FEDAVG]  Total dataset: {total_samples} radiographs across {len(updates)} hospital(s)")
        print(f"[FEDAVG]  Weights: " + " | ".join(
            f"{nid}: {n}/{total_samples}={n/total_samples:.4f}" for n, _, nid in updates
        ))

        # Base state dict from existing model to ensure all buffers (e.g. BatchNorm statistics) are preserved
        base_state_dict = {}
        for candidate_base in [
            BACKEND_DIR / "models" / "centralized_model.pth",
            MODEL_DIR / "centralized_model.pth",
            BACKEND_DIR / "models" / "federated_model.pth",
        ]:
            if candidate_base.is_file():
                try:
                    loaded_b = torch.load(candidate_base, map_location="cpu", weights_only=True)
                    candidate_sd = loaded_b.get("model_state_dict", loaded_b) if isinstance(loaded_b, dict) else loaded_b
                    if isinstance(candidate_sd, dict) and "bn1.running_mean" in candidate_sd:
                        base_state_dict = dict(candidate_sd)
                        break
                except Exception:
                    pass

        try:
            aggregated = dict(base_state_dict) if base_state_dict else {}
            first_keys = list(updates[0][1].keys())
            for key in first_keys:
                orig_dtype = updates[0][1][key].dtype
                weighted_sum = sum(
                    sd[key].float() * (n / total_samples)
                    for n, sd, _ in updates
                )
                aggregated[key] = weighted_sum.to(orig_dtype)
        except Exception as error:
            return {"status": "error", "message": f"FedAvg computation failed: {error}"}

        print(f"[FEDAVG]  Aggregation complete. Saving checkpoint...")

        # Version the new model
        previous_version = self.global_version
        try:
            next_num = int(previous_version.replace("v", "")) + 1
        except ValueError:
            next_num = 2
        new_version = f"v{next_num}"
        round_number = self.current_round

        checkpoint_name = f"federated_model_{new_version}.pth"
        checkpoint_path = CHECKPOINTS_DIR / checkpoint_name
        checkpoint = {
            "version": new_version,
            "round": round_number,
            "aggregation": self.aggregation_method,
            "num_clients": len(updates),
            "total_samples": total_samples,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "model_state_dict": aggregated,
        }
        torch.save(checkpoint, str(checkpoint_path))

        # Save as active model (two locations for compatibility)
        active_model_path = MODEL_DIR / "models" / "federated_model.pth"
        active_model_path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(aggregated, str(active_model_path))

        backend_model_path = BACKEND_DIR / "models" / "federated_model.pth"
        backend_model_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            import shutil
            shutil.copyfile(str(active_model_path), str(backend_model_path))
        except Exception:
            torch.save(aggregated, str(backend_model_path))

        print(f"[FEDAVG]  Saved: {checkpoint_path}")
        print(f"[FEDAVG]  Active model updated: {active_model_path}")

        # Reload inference engine in background thread so HTTP response is instant
        def _bg_reload():
            try:
                import importlib
                _main_mod = importlib.import_module("main") if "main" in sys.modules else None
                if _main_mod and hasattr(_main_mod, "reload_inference"):
                    _main_mod.reload_inference()
                    print("[FL] Central inference engine reloaded successfully.")
            except Exception as _reload_err:
                print(f"[FL] Inference reload skipped: {_reload_err}")

        threading.Thread(target=_bg_reload, daemon=True).start()

        # Compute weighted metrics
        weighted_loss = sum(
            upd["loss"] * upd["num_samples"]
            for upd in self.round_updates.values()
        ) / total_samples
        weighted_accuracy = sum(
            upd["accuracy"] * upd["num_samples"]
            for upd in self.round_updates.values()
        ) / total_samples

        with self.lock:
            self.global_version = new_version
            self.validation_loss = round(weighted_loss, 4)
            self.validation_accuracy = round(weighted_accuracy, 4)

            # Update all participating nodes' model version
            for nid in self.round_participants:
                if nid in self.nodes:
                    self.nodes[nid]["model_version"] = new_version

            self.model_registry.insert(0, {
                "version": new_version,
                "round": round_number,
                "timestamp": checkpoint["timestamp"],
                "status": "Current",
                "accuracy": round(weighted_accuracy, 4),
                "loss": round(weighted_loss, 4),
                "aggregation": self.aggregation_method,
                "checkpoint": checkpoint_name,
                "clients": len(updates),
                "samples": total_samples,
            })
            # Mark previous entries as old
            for entry in self.model_registry[1:]:
                entry["status"] = "Previous"

            self.round_history.insert(0, {
                "round": round_number,
                "round_id": self.round_id,
                "model_transition": "Central Model Updated Successfully",
                "clients": f"{len(updates)} / {len(self.round_participants)}",
                "total_samples": total_samples,
                "aggregation": self.aggregation_method,
                "status": "Completed",
                "validation_accuracy": round(weighted_accuracy, 4),
                "timestamp": checkpoint["timestamp"],
                "participants": self.round_participants,
            })
            self.stage = "completed"
            self.is_active = False

        print(f"\n[SUCCESS] ✓ Central Model Updated Successfully!")
        print(f"  • Previous:  {previous_version}  →  New: {new_version}")
        print(f"  • Round:     #{round_number}")
        print(f"  • Nodes:     {len(updates)} hospital(s)")
        print(f"  • Samples:   {total_samples} radiographs")
        print(f"  • Accuracy:  {weighted_accuracy:.2f}%  |  Loss: {weighted_loss:.4f}")
        print(f"  • Checkpoint: {checkpoint_name}")

        self.emit_event("AGGREGATION_COMPLETED", {
            "method": self.aggregation_method,
            "previous_version": previous_version,
            "new_version": new_version,
            "checkpoint": checkpoint_name,
            "total_samples": total_samples,
            "num_clients": len(updates),
            "weighted_accuracy": round(weighted_accuracy, 4),
            "weighted_loss": round(weighted_loss, 4),
            "message": "Central Model Updated Successfully",
        })
        self.emit_event("GLOBAL_MODEL_DISTRIBUTED", {
            "version": new_version,
            "nodes": self.round_participants,
            "checkpoint": checkpoint_name,
            "message": "Central Model Updated Successfully",
        })

        with self.lock:
            # Preserve updates for modal & dashboard display
            self.last_round_updates = dict(self.round_updates)
            self.rounds_completed_in_session += 1
            remaining_rounds = self.target_rounds - self.rounds_completed_in_session
            should_launch_next = remaining_rounds > 0
            saved_params = {
                "aggregation": self.aggregation_method,
                "demo": self.demo_mode,
                "dp": self.dp_enabled,
                "target_rounds": self.target_rounds,
            }

        if should_launch_next:
            print(f"\n[ORCHESTRATOR] Launching next round #{self.current_round + 1} with Global Model {new_version}...")

            def _launch_next():
                time.sleep(2.0)
                self.start_round(
                    aggregation=saved_params["aggregation"],
                    demo=saved_params["demo"],
                    dp=saved_params["dp"],
                    simulate=False,
                    rounds=saved_params["target_rounds"],
                )

            threading.Thread(target=_launch_next, daemon=True).start()

        return {
            "version": new_version,
            "checkpoint": checkpoint_name,
            "weighted_accuracy": round(weighted_accuracy, 4),
            "weighted_loss": round(weighted_loss, 4),
            "total_samples": total_samples,
            "num_clients": len(updates),
            "message": "Central Model Updated Successfully",
        }

    # ─────────────────────────── Admin Controls ───────────────────────────────

    def cancel_round(self) -> Dict[str, Any]:
        """Cancels an active round."""
        with self.lock:
            if not self.is_active:
                return {"status": "error", "message": "No active round to cancel."}
            self.is_active = False
            self.stage = "idle"
            self.round_updates = {}
            self.round_participants = []
        self.emit_event("ROUND_CANCELLED", {"message": "Admin cancelled active round."})
        return {"status": "round_cancelled"}

    # ─────────────────────────── Status / Queries ─────────────────────────────

    def get_live_status(self) -> Dict[str, Any]:
        """Returns complete real-time state of the FL cluster."""
        with self.lock:
            online_nodes = [
                nid for nid, n in self.nodes.items() if n.get("status") == "online"
            ]
            active_updates = self.round_updates or getattr(self, "last_round_updates", {})
            return {
                "is_active": self.is_active,
                "stage": self.stage,
                "current_round": self.current_round,
                "round_id": self.round_id,
                "global_model_version": self.global_version,
                "aggregation_method": self.aggregation_method,
                "validation_accuracy": self.validation_accuracy,
                "validation_loss": self.validation_loss,
                "demo_mode": self.demo_mode,
                "simulation": self.is_simulation,
                "round_updates": {
                    nid: {k: v for k, v in upd.items() if k != "parameters_base64"}
                    for nid, upd in active_updates.items()
                },
                "round_participants": list(self.round_participants),
                "nodes": {k: dict(v) for k, v in self.nodes.items()},
                "online_node_count": len(online_nodes),
                "online_nodes": online_nodes,
            }


# Global Singleton
fl_orchestrator = FederatedOrchestrator()
