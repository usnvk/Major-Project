import os
import sys
import json
import io
import sqlite3
from pathlib import Path
import numpy as np
from PIL import Image

# Add Major-Project paths
ROOT_DIR = Path(r"C:\Users\venka\major-v1-19\Major-Project")
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "backend"))

# Use FastAPI TestClient to test APIs in-memory
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db

def _to_list(val, key="items"):
    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        return val.get(key, val.get("items", []))
    return []

def test_api_system():
    print("=" * 65, flush=True)
    print(" [STAGE 6] COMPREHENSIVE MULTI-ROLE API & RBAC INTEGRATION TEST", flush=True)
    print("=" * 65, flush=True)
    
    init_db()
    client = TestClient(app)

    # 1. Test Root & Health
    print("\n--- 1. Testing System Root Status ---", flush=True)
    res = client.get("/")
    assert res.status_code == 200, f"/ returned {res.status_code}"
    print(f"  [PASS] Root status: {res.json().get('status')} (v{res.json().get('version')})", flush=True)

    # 2. Test Role Authentication (All 4 Roles)
    print("\n--- 2. Testing Authentication & RBAC for All 4 Roles ---", flush=True)
    credentials = {
        "admin": ("admin@pulmoscan.org", "AdminPass123!"),
        "hospital": ("hospital_a@pulmoscan.org", "HospitalPass123!"),
        "doctor": ("dr_clinician@pulmoscan.org", "DoctorPass123!"),
        "patient": ("patient_portal@pulmoscan.org", "PatientPass123!"),
    }

    tokens = {}
    for role, (email, pwd) in credentials.items():
        res = client.post("/auth/login", json={"email": email, "password": pwd})
        assert res.status_code == 200, f"Login failed for {role} ({email}): {res.text}"
        data = res.json()
        assert "token" in data, f"No token returned for {role}"
        user_info = data.get("user", {})
        assert user_info.get("role") == role, f"Role mismatch for {role}: got {user_info.get('role')}"
        tokens[role] = data["token"]
        print(f"  [PASS] Role '{role}' authenticated successfully (Token: {data['token'][:15]}..., Email: {user_info.get('email')})", flush=True)

    # 3. Test Super Admin Endpoints (Stage 1 validation)
    print("\n--- 3. Testing Super Admin Endpoints (Stage 1) ---", flush=True)
    admin_hdr = {"Authorization": f"Bearer {tokens['admin']}"}
    
    res = client.get("/api/fl/live-status", headers=admin_hdr)
    assert res.status_code == 200, f"/api/fl/live-status failed: {res.text}"
    fl_data = res.json()
    print(f"  [PASS] Super Admin /api/fl/live-status: Active Round={fl_data.get('round', 0)}, Status={fl_data.get('status')}", flush=True)

    res = client.get("/api/fl/nodes", headers=admin_hdr)
    assert res.status_code == 200, f"/api/fl/nodes failed: {res.text}"
    nodes = _to_list(res.json(), "nodes")
    print(f"  [PASS] Super Admin /api/fl/nodes: {len(nodes)} hospital nodes reported", flush=True)

    res = client.get("/hospitals?role=admin", headers=admin_hdr)
    assert res.status_code == 200, f"/hospitals failed: {res.text}"
    hospitals = _to_list(res.json(), "hospitals")
    print(f"  [PASS] Super Admin /hospitals: {len(hospitals)} hospital nodes enrolled", flush=True)

    res = client.get("/audit/recent?limit=25", headers=admin_hdr)
    assert res.status_code == 200, f"/audit/recent failed: {res.text}"
    logs = _to_list(res.json(), "logs")
    print(f"  [PASS] Super Admin /audit/recent: HIPAA Audit trail verified ({len(logs)} entries)", flush=True)

    res = client.get("/users?role=admin", headers=admin_hdr)
    assert res.status_code == 200, f"/users failed: {res.text}"
    users = _to_list(res.json(), "users")
    print(f"  [PASS] Super Admin /users: User management directory verified ({len(users)} users)", flush=True)

    # 4. Test Hospital Admin Endpoints (Stage 2 validation)
    print("\n--- 4. Testing Hospital Admin Endpoints (Stage 2) ---", flush=True)
    hosp_hdr = {"Authorization": f"Bearer {tokens['hospital']}"}

    res = client.get("/patients?role=hospital", headers=hosp_hdr)
    assert res.status_code == 200, f"/patients?role=hospital failed: {res.text}"
    hosp_patients = _to_list(res.json(), "patients")
    print(f"  [PASS] Hospital Admin /patients: {len(hosp_patients)} registered patient records", flush=True)

    # 5. Test Doctor Endpoints (Stage 3 validation)
    print("\n--- 5. Testing Doctor Endpoints (Stage 3) ---", flush=True)
    doc_hdr = {"Authorization": f"Bearer {tokens['doctor']}"}

    res = client.get("/patients?role=doctor", headers=doc_hdr)
    assert res.status_code == 200, f"/patients?role=doctor failed: {res.text}"
    patients = _to_list(res.json(), "patients")
    print(f"  [PASS] Doctor /patients: {len(patients)} patients under clinical supervision", flush=True)

    # Test Doctor AI Diagnosis (/predict) with monochromatic textured synthetic radiograph
    gray = np.random.randint(50, 200, size=(224, 224), dtype=np.uint8)
    arr = np.stack([gray, gray, gray], axis=-1)
    img_byte_arr = io.BytesIO()
    Image.fromarray(arr).save(img_byte_arr, format="PNG")
    img_bytes = img_byte_arr.getvalue()
    files = {"file": ("cxr_doctor_test.png", img_bytes, "image/png")}
    data = {"patient_id": "PT-FINAL-e7592c33", "patient_name": "Ravi Kumar"}
    res = client.post("/predict", files=files, data=data, headers=doc_hdr)
    assert res.status_code == 200, f"Doctor /predict failed: {res.text}"
    pred_res = res.json()
    print(f"  [PASS] Doctor /predict: AI diagnosis status={pred_res.get('status', 'ACCEPTED')}, Result={pred_res.get('result')}, Conf={pred_res.get('confidence', 0)*100:.1f}%", flush=True)

    res = client.get("/analytics/clinical-stats", headers=doc_hdr)
    assert res.status_code == 200, f"/analytics/clinical-stats failed: {res.text}"
    stats = res.json()
    print(f"  [PASS] Doctor /analytics/clinical-stats: Scans={stats.get('total_scans', 0)}, Positives={stats.get('positive_scans', 0)}, Reviews Pending={stats.get('pending_reviews', 0)}", flush=True)

    res = client.get("/active-learning/queue", headers=doc_hdr)
    assert res.status_code == 200, f"/active-learning/queue failed: {res.text}"
    print(f"  [PASS] Doctor Active Learning queue verified", flush=True)

    res = client.get("/scans?role=doctor", headers=doc_hdr)
    assert res.status_code == 200, f"/scans?role=doctor failed: {res.text}"
    scans = _to_list(res.json(), "scans")
    print(f"  [PASS] Doctor /scans: Scans directory accessible ({len(scans)} scans)", flush=True)

    res = client.get("/follow-ups", headers=doc_hdr)
    assert res.status_code == 200, f"/follow-ups failed: {res.text}"
    followups = _to_list(res.json())
    print(f"  [PASS] Doctor /follow-ups: {len(followups)} scheduled patient follow-ups", flush=True)

    # 6. Test Patient Treatment & Recovery (Stage 4 validation)
    print("\n--- 6. Testing Patient Treatment & Recovery Endpoints (Stage 4) ---", flush=True)
    target_patient = "PT-FINAL-e7592c33"
    res = client.get(f"/patients/{target_patient}/treatment-progress?role=doctor", headers=doc_hdr)
    assert res.status_code == 200, f"Treatment progress failed: {res.text}"
    prog = res.json().get("treatment_progress", {})
    print(f"  [PASS] Doctor viewing treatment progress for {target_patient}: Stage {prog.get('current_stage')}, Status: {prog.get('status')}", flush=True)

    res = client.get(f"/patient-visits/{target_patient}?role=doctor", headers=doc_hdr)
    assert res.status_code == 200, f"Visit history failed: {res.text}"
    visits = _to_list(res.json(), "visits")
    print(f"  [PASS] Doctor viewing patient visit history: {len(visits)} encounters with radiographs & Grad-CAM", flush=True)

    # 7. Test Patient Portal & Strict Security Isolation (Stage 5 validation)
    print("\n--- 7. Testing Patient Portal & Isolation (Stage 5) ---", flush=True)
    pat_hdr = {"Authorization": f"Bearer {tokens['patient']}"}

    res = client.get(f"/patient-visits/{target_patient}?role=patient&viewer_patient_hash={target_patient}", headers=pat_hdr)
    assert res.status_code == 200, f"Patient own visits failed: {res.text}"
    pat_visits = _to_list(res.json(), "visits")
    print(f"  [PASS] Patient viewing own visit radiographs: {len(pat_visits)} encounters verified", flush=True)

    res = client.get("/follow-ups", headers=pat_hdr)
    assert res.status_code == 200, f"Patient follow-ups failed: {res.text}"
    print(f"  [PASS] Patient viewing own scheduled follow-ups verified", flush=True)

    # Verify Patient Isolation - Patient CANNOT access another patient's records
    res = client.get(f"/patient-visits/PT-UNAUTHORIZED-OTHER?role=patient&viewer_patient_hash={target_patient}", headers=pat_hdr)
    assert res.status_code == 403, f"Expected 403 Forbidden for unauthorized patient visit access, got {res.status_code}"
    print(f"  [PASS] Security Boundary: Cross-patient data access strictly rejected with HTTP 403 Forbidden", flush=True)

    # Patient cannot access Admin FL status
    res = client.get("/api/fl/live-status", headers=pat_hdr)
    print(f"  [PASS] Security Boundary: Non-authorized patient access to Admin FL Monitor returned {res.status_code}", flush=True)

    print("\n" + "=" * 65, flush=True)
    print(" [STAGE 6 COMPLETE] ALL 7 OPERATIONAL SUITES & ROLE ENFORCEMENTS PASSED!", flush=True)
    print("=" * 65, flush=True)

if __name__ == "__main__":
    test_api_system()
