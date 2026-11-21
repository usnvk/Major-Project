import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DATABASE_PATH = Path(__file__).resolve().parent / "feedback.db"
EDGE_STORAGE_DIR = Path(__file__).resolve().parent / "edge_storage"


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.execute("PRAGMA busy_timeout = 30000")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('doctor', 'admin', 'patient')),
                license_number TEXT,
                patient_hash TEXT,
                hospital_node TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                user_email TEXT NOT NULL,
                user_role TEXT NOT NULL,
                action TEXT NOT NULL,
                resource_id TEXT,
                details TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS predictions (
                prediction_id TEXT PRIMARY KEY,
                patient_hash TEXT,
                filename TEXT NOT NULL,
                is_dicom INTEGER DEFAULT 0,
                image_path TEXT,
                result TEXT NOT NULL,
                confidence REAL NOT NULL,
                stage INTEGER,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prediction_id TEXT,
                image_id TEXT,
                predicted_result TEXT NOT NULL,
                true_label TEXT NOT NULL,
                confirmed_stage INTEGER,
                doctor_notes TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
            );
            CREATE TABLE IF NOT EXISTS active_learning_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prediction_id TEXT UNIQUE NOT NULL,
                patient_hash TEXT NOT NULL,
                image_path TEXT NOT NULL,
                ai_prediction TEXT NOT NULL,
                ai_confidence REAL NOT NULL,
                doctor_label TEXT NOT NULL,
                doctor_stage INTEGER,
                doctor_notes TEXT,
                pending_active_learning INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                trained_at TEXT,
                FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
            );
            CREATE TABLE IF NOT EXISTS hospitals (
                hospital_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                address TEXT,
                contact_email TEXT,
                phone TEXT,
                node_id TEXT UNIQUE,
                status TEXT NOT NULL DEFAULT 'offline',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS follow_ups (
                follow_up_id TEXT PRIMARY KEY,
                patient_hash TEXT NOT NULL,
                visit_id TEXT,
                doctor_email TEXT,
                scheduled_at TEXT NOT NULL,
                reason TEXT,
                status TEXT NOT NULL DEFAULT 'scheduled',
                created_at TEXT NOT NULL,
                FOREIGN KEY (visit_id) REFERENCES patient_visits(visit_id)
            );
            CREATE TABLE IF NOT EXISTS patient_visits (
                visit_id TEXT PRIMARY KEY,
                patient_hash TEXT NOT NULL,
                visit_date TEXT NOT NULL,
                previous_visit_id TEXT,
                symptoms TEXT,
                doctor_observations TEXT,
                ai_prediction TEXT,
                ai_confidence REAL,
                treatment_stage INTEGER,
                doctor_review_status TEXT NOT NULL DEFAULT 'pending',
                doctor_validated_change TEXT,
                doctor_email TEXT,
                doctor_name TEXT,
                xray_image_path TEXT,
                heatmap_image_path TEXT,
                prediction_id TEXT,
                visit_number INTEGER DEFAULT 1,
                prescribed_medicines TEXT,
                doctor_treatment_action TEXT,
                ai_comparison_notes TEXT,
                comparison_delta_confidence REAL,
                comparison_status TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
            );
            """
        )
        users_sql_row = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
        ).fetchone()
        users_sql = users_sql_row["sql"] if users_sql_row else ""
        if "'hospital'" not in users_sql:
            connection.executescript(
                """
                ALTER TABLE users RENAME TO users_legacy;
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('doctor', 'admin', 'patient', 'hospital')),
                    license_number TEXT,
                    patient_hash TEXT,
                    hospital_node TEXT,
                    created_at TEXT NOT NULL
                );
                INSERT INTO users (id, email, password_hash, name, role, license_number, patient_hash, hospital_node, created_at)
                SELECT id, email, password_hash, name, role, license_number, patient_hash, hospital_node, created_at
                FROM users_legacy;
                DROP TABLE users_legacy;
                """
            )
        # Migrate predictions columns if existing db
        pred_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(predictions)")
        }
        if "patient_hash" not in pred_columns:
            connection.execute("ALTER TABLE predictions ADD COLUMN patient_hash TEXT")
        if "patient_name" not in pred_columns:
            connection.execute("ALTER TABLE predictions ADD COLUMN patient_name TEXT")
        if "uploaded_by_email" not in pred_columns:
            connection.execute("ALTER TABLE predictions ADD COLUMN uploaded_by_email TEXT")
        if "is_dicom" not in pred_columns:
            connection.execute("ALTER TABLE predictions ADD COLUMN is_dicom INTEGER DEFAULT 0")
        if "image_path" not in pred_columns:
            connection.execute("ALTER TABLE predictions ADD COLUMN image_path TEXT")

        # Migrate feedback columns if existing db
        feedback_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(feedback)")
        }
        if "prediction_id" not in feedback_columns:
            connection.execute("ALTER TABLE feedback ADD COLUMN prediction_id TEXT")
        if "doctor_email" not in feedback_columns:
            connection.execute("ALTER TABLE feedback ADD COLUMN doctor_email TEXT")
        if "doctor_name" not in feedback_columns:
            connection.execute("ALTER TABLE feedback ADD COLUMN doctor_name TEXT")
        if "doctor_notes" not in feedback_columns:
            connection.execute("ALTER TABLE feedback ADD COLUMN doctor_notes TEXT")
        if "created_at" not in feedback_columns:
            connection.execute("ALTER TABLE feedback ADD COLUMN created_at TEXT")

        # Patients table for Stage-wise Treatment & Recovery Monitoring
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS patients (
                patient_hash TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                age INTEGER,
                gender TEXT,
                contact_phone TEXT,
                contact_email TEXT,
                emergency_contact TEXT,
                medical_history TEXT,
                allergies TEXT,
                initial_diagnosis_date TEXT NOT NULL,
                initial_stage INTEGER DEFAULT 1,
                current_stage INTEGER DEFAULT 1,
                treatment_status TEXT DEFAULT 'active',
                doctor_confirmed_cured INTEGER DEFAULT 0,
                doctor_cured_date TEXT,
                prescribed_medicines TEXT,
                assigned_doctor_email TEXT,
                assigned_doctor_name TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )

        # Migrate patient_visits columns if existing db
        visit_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(patient_visits)")
        }
        if "visit_number" not in visit_columns:
            connection.execute("ALTER TABLE patient_visits ADD COLUMN visit_number INTEGER DEFAULT 1")
        if "prescribed_medicines" not in visit_columns:
            connection.execute("ALTER TABLE patient_visits ADD COLUMN prescribed_medicines TEXT")
        if "doctor_treatment_action" not in visit_columns:
            connection.execute("ALTER TABLE patient_visits ADD COLUMN doctor_treatment_action TEXT")
        if "ai_comparison_notes" not in visit_columns:
            connection.execute("ALTER TABLE patient_visits ADD COLUMN ai_comparison_notes TEXT")
        if "comparison_delta_confidence" not in visit_columns:
            connection.execute("ALTER TABLE patient_visits ADD COLUMN comparison_delta_confidence REAL")
        if "comparison_status" not in visit_columns:
            connection.execute("ALTER TABLE patient_visits ADD COLUMN comparison_status TEXT")

        # High performance query indexes
        connection.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_predictions_patient_hash ON predictions(patient_hash);
            CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);
            CREATE INDEX IF NOT EXISTS idx_feedback_pred_id ON feedback(prediction_id);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_al_pending ON active_learning_queue(pending_active_learning);
            CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(treatment_status);
            CREATE INDEX IF NOT EXISTS idx_patients_stage ON patients(current_stage);
            CREATE INDEX IF NOT EXISTS idx_visits_patient_hash ON patient_visits(patient_hash);
            """
        )

    try:
        seed_default_users_and_scans()
    except sqlite3.OperationalError:
        pass


def save_prediction(
    prediction_id: str,
    filename: str,
    result: str,
    confidence: float,
    stage: int | None,
    patient_hash: str | None = None,
    patient_name: str | None = None,
    uploaded_by_email: str | None = None,
    is_dicom: bool = False,
    image_path: str | None = None,
) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO predictions
                (prediction_id, patient_hash, patient_name, filename, is_dicom, image_path, result, confidence, stage, uploaded_by_email, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                prediction_id,
                patient_hash or f"PT-{prediction_id[:8].upper()}",
                patient_name,
                filename,
                1 if is_dicom else 0,
                image_path,
                result,
                confidence,
                stage,
                uploaded_by_email,
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def create_hospital(
    hospital_id: str,
    name: str,
    address: str | None,
    contact_email: str | None,
    phone: str | None,
    node_id: str,
) -> dict[str, Any]:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO hospitals
            (hospital_id, name, address, contact_email, phone, node_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'offline', ?)
            """,
            (
                hospital_id,
                name,
                address,
                contact_email,
                phone,
                node_id,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        row = connection.execute(
            "SELECT * FROM hospitals WHERE hospital_id = ?",
            (hospital_id,),
        ).fetchone()
    return dict(row)


def get_hospitals() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM hospitals ORDER BY created_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]


def schedule_follow_up(
    follow_up_id: str,
    patient_hash: str,
    visit_id: str | None,
    doctor_email: str | None,
    scheduled_at: str,
    reason: str | None,
) -> dict[str, Any]:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO follow_ups
            (follow_up_id, patient_hash, visit_id, doctor_email, scheduled_at, reason, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)
            """,
            (
                follow_up_id,
                patient_hash,
                visit_id,
                doctor_email,
                scheduled_at,
                reason,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        row = connection.execute(
            "SELECT * FROM follow_ups WHERE follow_up_id = ?",
            (follow_up_id,),
        ).fetchone()
    return dict(row)


def get_follow_ups(patient_hash: str | None = None) -> list[dict[str, Any]]:
    with get_connection() as connection:
        if patient_hash:
            rows = connection.execute(
                "SELECT * FROM follow_ups WHERE patient_hash = ? ORDER BY scheduled_at ASC",
                (patient_hash,),
            ).fetchall()
        else:
            rows = connection.execute(
                "SELECT * FROM follow_ups ORDER BY scheduled_at ASC"
            ).fetchall()
    return [dict(row) for row in rows]


def create_patient_visit(
    visit_id: str,
    patient_hash: str,
    visit_date: str,
    symptoms: str | None,
    doctor_observations: str | None,
    ai_prediction: str | None,
    ai_confidence: float | None,
    treatment_stage: int | None,
    doctor_email: str | None,
    doctor_name: str | None,
    xray_image_path: str | None,
    heatmap_image_path: str | None,
    prediction_id: str | None,
    prescribed_medicines: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    with get_connection() as connection:
        previous = connection.execute(
            """
            SELECT visit_id, visit_number FROM patient_visits
            WHERE patient_hash = ?
            ORDER BY visit_date DESC, created_at DESC
            LIMIT 1
            """,
            (patient_hash,),
        ).fetchone()
        previous_visit_id = previous["visit_id"] if previous else None
        prev_num = previous["visit_number"] if previous and previous["visit_number"] is not None else 0
        visit_number = prev_num + 1

        if prescribed_medicines is None and treatment_stage:
            prescribed_medicines = get_default_medications_for_stage(treatment_stage)
        meds_json = json.dumps(prescribed_medicines) if prescribed_medicines is not None else None

        connection.execute(
            """
            INSERT INTO patient_visits
            (visit_id, patient_hash, visit_date, previous_visit_id, symptoms,
             doctor_observations, ai_prediction, ai_confidence, treatment_stage,
             doctor_review_status, doctor_email, doctor_name, xray_image_path,
             heatmap_image_path, prediction_id, visit_number, prescribed_medicines, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                visit_id,
                patient_hash,
                visit_date,
                previous_visit_id,
                symptoms,
                doctor_observations,
                ai_prediction,
                ai_confidence,
                treatment_stage,
                doctor_email,
                doctor_name,
                xray_image_path,
                heatmap_image_path,
                prediction_id,
                visit_number,
                meds_json,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
    visits = get_patient_visits(patient_hash)
    return visits[-1]


def get_patient_visits(patient_hash: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM patient_visits
            WHERE patient_hash = ?
            ORDER BY visit_date ASC, created_at ASC
            """,
            (patient_hash,),
        ).fetchall()
    results = []
    for row in rows:
        item = dict(row)
        if "prescribed_medicines" in item and isinstance(item["prescribed_medicines"], str):
            try:
                item["prescribed_medicines"] = json.loads(item["prescribed_medicines"])
            except Exception:
                pass
        results.append(item)
    return results


def review_patient_visit(
    visit_id: str,
    doctor_validated_change: str,
    doctor_observations: str,
    treatment_stage: int | None,
    doctor_email: str,
    doctor_name: str,
) -> dict[str, Any]:
    if doctor_validated_change not in {"improved", "unchanged", "worsened"}:
        raise ValueError("Doctor validated change must be improved, unchanged, or worsened")
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE patient_visits
            SET doctor_validated_change = ?, doctor_observations = ?,
                treatment_stage = ?, doctor_review_status = 'reviewed',
                doctor_email = ?, doctor_name = ?
            WHERE visit_id = ?
            """,
            (
                doctor_validated_change,
                doctor_observations,
                treatment_stage,
                doctor_email,
                doctor_name,
                visit_id,
            ),
        )
        row = connection.execute(
            "SELECT * FROM patient_visits WHERE visit_id = ?",
            (visit_id,),
        ).fetchone()
    if row is None:
        raise KeyError("Visit not found")
    log_audit_event(
        user_email=doctor_email,
        user_role="doctor",
        action="VISIT_REVIEWED",
        resource_id=visit_id,
        details=f"Doctor validated change: {doctor_validated_change}. Stage: {treatment_stage or 'N/A'}. Attending: {doctor_name}",
    )
    return dict(row)


# ─────────────────────────────────────────────────────────────────────────────
# STAGE-WISE TB TREATMENT & RECOVERY MONITORING PROTOCOL (WHO / DOTS)
# ─────────────────────────────────────────────────────────────────────────────

STANDARD_TB_MEDICATIONS: dict[int, list[dict[str, Any]]] = {
    1: [
        {"name": "Rifampicin (RIF)", "dosage": "600 mg", "frequency": "Once daily (empty stomach)", "phase": "Intensive Phase (HRZE)", "instructions": "Potent bactericidal; urine and tears may turn orange-red."},
        {"name": "Isoniazid (INH)", "dosage": "300 mg", "frequency": "Once daily", "phase": "Intensive Phase (HRZE)", "instructions": "Rapid bacillary clearance; monitor liver function (AST/ALT)."},
        {"name": "Pyrazinamide (PZA)", "dosage": "1500 mg", "frequency": "Once daily", "phase": "Intensive Phase (HRZE)", "instructions": "Sterilizing agent in acidic intracellular environments; monitor uric acid."},
        {"name": "Ethambutol (EMB)", "dosage": "1200 mg", "frequency": "Once daily", "phase": "Intensive Phase (HRZE)", "instructions": "Prevents emergence of drug resistance; periodic visual acuity check."},
        {"name": "Pyridoxine (Vit B6)", "dosage": "25 mg", "frequency": "Once daily", "phase": "Adjuvant Neuroprotection", "instructions": "Crucial co-prescription to prevent INH-induced peripheral neuropathy."},
    ],
    2: [
        {"name": "Rifampicin (RIF)", "dosage": "600 mg", "frequency": "Once daily (empty stomach)", "phase": "Continuation Phase (HR)", "instructions": "Eliminates persistent dormant bacilli to prevent relapse."},
        {"name": "Isoniazid (INH)", "dosage": "300 mg", "frequency": "Once daily", "phase": "Continuation Phase (HR)", "instructions": "Maintains sustained bacillary inhibition."},
        {"name": "Pyridoxine (Vit B6)", "dosage": "25 mg", "frequency": "Once daily", "phase": "Adjuvant Neuroprotection", "instructions": "Continue neuroprotective support during continuation therapy."},
    ],
    3: [
        {"name": "Rifampicin (RIF)", "dosage": "600 mg", "frequency": "Once daily", "phase": "Consolidation Phase", "instructions": "Sustained sterilization; sputum conversion confirmation required."},
        {"name": "Isoniazid (INH)", "dosage": "300 mg", "frequency": "Once daily", "phase": "Consolidation Phase", "instructions": "Consolidation antimicrobial coverage."},
    ],
    4: [
        {"name": "Rifampicin (RIF)", "dosage": "600 mg", "frequency": "Once daily", "phase": "Extended Maintenance", "instructions": "Extended regimen for slow-resolving cavitary disease under specialist care."},
        {"name": "Isoniazid (INH)", "dosage": "300 mg", "frequency": "Once daily", "phase": "Extended Maintenance", "instructions": "Extended therapy monitoring."},
        {"name": "Levofloxacin (Optional)", "dosage": "500 mg", "frequency": "Once daily", "phase": "Specialist Adjuvant", "instructions": "If clinically indicated by drug sensitivity profile."},
    ],
    5: [
        {"name": "Post-Treatment Relapse Surveillance", "dosage": "None (Cured)", "frequency": "Quarterly Evaluation", "phase": "Recovery & Surveillance", "instructions": "No active medication. Follow-up chest radiograph at Month 9 and Month 12 to ensure no recurrence."},
    ],
}


def get_default_medications_for_stage(stage: int) -> list[dict[str, Any]]:
    """Returns standardized WHO / DOTS prescribed medications for a given TB treatment stage."""
    clean_stage = max(1, min(5, int(stage)))
    return list(STANDARD_TB_MEDICATIONS.get(clean_stage, STANDARD_TB_MEDICATIONS[1]))


def register_patient(
    patient_hash: str | None,
    name: str,
    age: int | None = None,
    gender: str | None = None,
    contact_phone: str | None = None,
    contact_email: str | None = None,
    emergency_contact: str | None = None,
    medical_history: str | None = None,
    allergies: str | None = None,
    initial_stage: int = 1,
    assigned_doctor_email: str | None = None,
    assigned_doctor_name: str | None = None,
    prescribed_medicines: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Registers a patient in the stage-wise treatment and recovery monitoring protocol."""
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_hash = (
        patient_hash.strip()
        if patient_hash and patient_hash.strip()
        else f"PT-{hashlib.sha256((name + now_iso).encode()).hexdigest()[:8].upper()}"
    )
    clean_stage = max(1, min(5, int(initial_stage or 1)))
    meds = prescribed_medicines if prescribed_medicines is not None else get_default_medications_for_stage(clean_stage)
    meds_json = json.dumps(meds)

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO patients
            (patient_hash, name, age, gender, contact_phone, contact_email,
             emergency_contact, medical_history, allergies, initial_diagnosis_date,
             initial_stage, current_stage, treatment_status, doctor_confirmed_cured,
             prescribed_medicines, assigned_doctor_email, assigned_doctor_name,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, ?, ?, ?)
            ON CONFLICT(patient_hash) DO UPDATE SET
                name=excluded.name,
                age=COALESCE(excluded.age, patients.age),
                gender=COALESCE(excluded.gender, patients.gender),
                contact_phone=COALESCE(excluded.contact_phone, patients.contact_phone),
                contact_email=COALESCE(excluded.contact_email, patients.contact_email),
                emergency_contact=COALESCE(excluded.emergency_contact, patients.emergency_contact),
                medical_history=COALESCE(excluded.medical_history, patients.medical_history),
                allergies=COALESCE(excluded.allergies, patients.allergies),
                assigned_doctor_email=COALESCE(excluded.assigned_doctor_email, patients.assigned_doctor_email),
                assigned_doctor_name=COALESCE(excluded.assigned_doctor_name, patients.assigned_doctor_name),
                updated_at=excluded.updated_at
            """,
            (
                clean_hash,
                name.strip(),
                age,
                gender,
                contact_phone,
                contact_email,
                emergency_contact,
                medical_history,
                allergies,
                now_iso[:10],
                clean_stage,
                clean_stage,
                meds_json,
                assigned_doctor_email,
                assigned_doctor_name,
                now_iso,
                now_iso,
            ),
        )

    log_audit_event(
        user_email=assigned_doctor_email or "doctor@pulmoscan.org",
        user_role="doctor",
        action="PATIENT_REGISTERED",
        resource_id=clean_hash,
        details=f"Patient {name} registered in treatment protocol. Stage: {clean_stage}. Attending: {assigned_doctor_name or 'Clinician'}",
    )
    return get_patient(clean_hash) or {}


def get_patient(patient_hash: str) -> dict[str, Any] | None:
    """Returns complete patient profile, active stage, and clinical trajectory."""
    with get_connection() as connection:
        p_row = connection.execute(
            "SELECT * FROM patients WHERE patient_hash = ?",
            (patient_hash,),
        ).fetchone()

    if not p_row:
        # Fallback: check if exists in users
        with get_connection() as connection:
            u_row = connection.execute(
                "SELECT * FROM users WHERE patient_hash = ? OR email = ?",
                (patient_hash, patient_hash),
            ).fetchone()
        if u_row:
            reg = register_patient(
                patient_hash=u_row["patient_hash"] or patient_hash,
                name=u_row["name"],
                contact_email=u_row["email"],
                initial_stage=1,
            )
            return reg
        return None

    patient_dict = dict(p_row)
    try:
        patient_dict["prescribed_medicines"] = (
            json.loads(patient_dict["prescribed_medicines"])
            if patient_dict.get("prescribed_medicines")
            else get_default_medications_for_stage(patient_dict.get("current_stage", 1))
        )
    except Exception:
        patient_dict["prescribed_medicines"] = get_default_medications_for_stage(patient_dict.get("current_stage", 1))

    visits = get_patient_visits(patient_hash)
    patient_dict["visits"] = visits
    patient_dict["visit_count"] = len(visits)
    patient_dict["latest_visit"] = visits[-1] if visits else None
    patient_dict["follow_ups"] = get_follow_ups(patient_hash)
    return patient_dict


def get_all_patients(
    filter_status: str | None = None,
    search: str | None = None,
    doctor_email: str | None = None,
) -> list[dict[str, Any]]:
    """Lists registered patients with stage progression and review flags."""
    query = "SELECT * FROM patients"
    conditions = []
    params: list[Any] = []

    if filter_status and filter_status != "all":
        if filter_status == "needs_review":
            conditions.append(
                "patient_hash IN (SELECT patient_hash FROM patient_visits WHERE doctor_review_status = 'pending')"
            )
        elif filter_status == "completed":
            conditions.append("doctor_confirmed_cured = 1")
        elif filter_status == "active":
            conditions.append("doctor_confirmed_cured = 0 AND treatment_status = 'active'")
        else:
            conditions.append("treatment_status = ?")
            params.append(filter_status)

    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append("(name LIKE ? OR patient_hash LIKE ? OR contact_phone LIKE ?)")
        params.extend([term, term, term])

    if doctor_email:
        conditions.append("(assigned_doctor_email = ? OR assigned_doctor_email IS NULL)")
        params.append(doctor_email)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY updated_at DESC"

    with get_connection() as connection:
        rows = connection.execute(query, params).fetchall()

    results = []
    for r in rows:
        p = dict(r)
        p_hash = p["patient_hash"]
        try:
            p["prescribed_medicines"] = (
                json.loads(p["prescribed_medicines"])
                if p.get("prescribed_medicines")
                else get_default_medications_for_stage(p.get("current_stage", 1))
            )
        except Exception:
            p["prescribed_medicines"] = get_default_medications_for_stage(p.get("current_stage", 1))

        # Attach latest visit info
        with get_connection() as connection:
            latest_v = connection.execute(
                """
                SELECT visit_id, visit_date, ai_prediction, ai_confidence, treatment_stage,
                       doctor_review_status, doctor_validated_change, doctor_name, created_at,
                       xray_image_path, heatmap_image_path
                FROM patient_visits
                WHERE patient_hash = ?
                ORDER BY visit_date DESC, created_at DESC LIMIT 1
                """,
                (p_hash,),
            ).fetchone()

            v_count = connection.execute(
                "SELECT COUNT(*) AS cnt FROM patient_visits WHERE patient_hash = ?",
                (p_hash,),
            ).fetchone()["cnt"]

            next_fu = connection.execute(
                """
                SELECT scheduled_at, reason FROM follow_ups
                WHERE patient_hash = ? AND status = 'scheduled'
                ORDER BY scheduled_at ASC LIMIT 1
                """,
                (p_hash,),
            ).fetchone()

            pending_rev = connection.execute(
                """
                SELECT COUNT(*) AS cnt FROM patient_visits
                WHERE patient_hash = ? AND doctor_review_status = 'pending'
                """,
                (p_hash,),
            ).fetchone()["cnt"]

        p["visit_count"] = v_count
        p["has_pending_review"] = pending_rev > 0
        p["latest_visit"] = dict(latest_v) if latest_v else None
        p["next_follow_up"] = dict(next_fu) if next_fu else None

        # Calculate days in treatment
        diag_date = p.get("initial_diagnosis_date") or p.get("created_at")[:10]
        try:
            d1 = datetime.strptime(diag_date, "%Y-%m-%d").date()
            d2 = datetime.now(timezone.utc).date()
            p["days_in_treatment"] = max(1, (d2 - d1).days)
        except Exception:
            p["days_in_treatment"] = 1

        results.append(p)
    return results


def update_patient_treatment(
    patient_hash: str,
    current_stage: int | None = None,
    prescribed_medicines: list[dict[str, Any]] | None = None,
    treatment_status: str | None = None,
    doctor_confirmed_cured: bool | None = None,
    doctor_email: str | None = None,
    doctor_name: str | None = None,
    doctor_notes: str | None = None,
) -> dict[str, Any]:
    """Updates patient treatment stage, medications, or doctor-confirmed cure status."""
    now_iso = datetime.now(timezone.utc).isoformat()
    fields: list[str] = ["updated_at = ?"]
    params: list[Any] = [now_iso]

    if current_stage is not None:
        clean_stage = max(1, min(5, int(current_stage)))
        fields.append("current_stage = ?")
        params.append(clean_stage)
        if prescribed_medicines is None:
            prescribed_medicines = get_default_medications_for_stage(clean_stage)

    if prescribed_medicines is not None:
        fields.append("prescribed_medicines = ?")
        params.append(json.dumps(prescribed_medicines))

    if treatment_status is not None:
        fields.append("treatment_status = ?")
        params.append(treatment_status)

    if doctor_confirmed_cured is not None:
        cured_int = 1 if doctor_confirmed_cured else 0
        fields.append("doctor_confirmed_cured = ?")
        params.append(cured_int)
        if cured_int == 1:
            fields.append("doctor_cured_date = ?")
            params.append(now_iso[:10])
            fields.append("treatment_status = 'completed'")
            fields.append("current_stage = 5")

    if doctor_email:
        fields.append("assigned_doctor_email = ?")
        params.append(doctor_email)
    if doctor_name:
        fields.append("assigned_doctor_name = ?")
        params.append(doctor_name)

    params.append(patient_hash)
    sql = f"UPDATE patients SET {', '.join(fields)} WHERE patient_hash = ?"

    with get_connection() as connection:
        connection.execute(sql, params)

    details = f"Treatment plan updated for {patient_hash} by {doctor_name or 'Doctor'}."
    if doctor_confirmed_cured:
        details += " DOCTOR EXPLICITLY CONFIRMED PATIENT CURED & COMPLETED TREATMENT."
    if current_stage:
        details += f" Advanced to Stage {current_stage}."

    log_audit_event(
        user_email=doctor_email or "doctor@pulmoscan.org",
        user_role="doctor",
        action="TREATMENT_PLAN_UPDATED",
        resource_id=patient_hash,
        details=details,
    )
    return get_patient(patient_hash) or {}


def record_patient_followup_visit(
    patient_hash: str,
    symptoms: str | None = None,
    doctor_observations: str | None = None,
    doctor_validated_change: str = "unchanged",
    doctor_treatment_action: str = "continue",
    treatment_stage: int = 1,
    prescribed_medicines: list[dict[str, Any]] | None = None,
    doctor_email: str | None = None,
    doctor_name: str | None = None,
    xray_image_path: str | None = None,
    heatmap_image_path: str | None = None,
    prediction_id: str | None = None,
    ai_prediction: str | None = None,
    ai_confidence: float | None = None,
    next_followup_date: str | None = None,
) -> dict[str, Any]:
    """
    Records a follow-up visit with side-by-side CXR comparison against the previous visit.
    Calculates AI comparative metrics and logs doctor-verified clinical assessment.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    visit_id = f"VST-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    clean_stage = max(1, min(5, int(treatment_stage or 1)))

    with get_connection() as connection:
        # Get previous visit for comparative linkage
        prev_row = connection.execute(
            """
            SELECT * FROM patient_visits
            WHERE patient_hash = ?
            ORDER BY visit_date DESC, created_at DESC LIMIT 1
            """,
            (patient_hash,),
        ).fetchone()

        all_visits_count = connection.execute(
            "SELECT COUNT(*) AS cnt FROM patient_visits WHERE patient_hash = ?",
            (patient_hash,),
        ).fetchone()["cnt"]

    visit_number = all_visits_count + 1
    previous_visit_id = prev_row["visit_id"] if prev_row else None
    prev_conf = float(prev_row["ai_confidence"]) if prev_row and prev_row["ai_confidence"] is not None else None
    curr_conf = float(ai_confidence) if ai_confidence is not None else None

    # Calculate comparative delta
    comparison_delta = None
    ai_comparison_notes = "Baseline screening visit. No previous radiograph for comparison."
    if prev_conf is not None and curr_conf is not None:
        comparison_delta = round(curr_conf - prev_conf, 4)
        pct_delta = round(comparison_delta * 100, 1)

        if curr_conf < prev_conf:
            ai_comparison_notes = (
                f"AI model indicates radiological improvement: confidence decreased by {abs(pct_delta)}% "
                f"(from {round(prev_conf * 100, 1)}% to {round(curr_conf * 100, 1)}%). "
                "Observable reduction in parenchymal infiltrates. Subject to doctor confirmation."
            )
        elif curr_conf > prev_conf:
            ai_comparison_notes = (
                f"AI model indicates persistent or increased lesion density: confidence increased by +{pct_delta}% "
                f"(from {round(prev_conf * 100, 1)}% to {round(curr_conf * 100, 1)}%). "
                "Clinician correlation and adherence review strongly recommended."
            )
        else:
            ai_comparison_notes = (
                f"AI model indicates stable radiologic features (Confidence: {round(curr_conf * 100, 1)}%). "
                "Correlate with clinical symptom improvement."
            )
    elif curr_conf is not None:
        ai_comparison_notes = f"AI CXR screening: {ai_prediction} ({round(curr_conf * 100, 1)}% confidence). Attending clinician evaluation required."

    # Prescribed medicines
    if prescribed_medicines is None:
        prescribed_medicines = get_default_medications_for_stage(clean_stage)
    meds_json = json.dumps(prescribed_medicines)

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO patient_visits
            (visit_id, patient_hash, visit_date, previous_visit_id, symptoms,
             doctor_observations, ai_prediction, ai_confidence, treatment_stage,
             doctor_review_status, doctor_validated_change, doctor_email, doctor_name,
             xray_image_path, heatmap_image_path, prediction_id, visit_number,
             prescribed_medicines, doctor_treatment_action, ai_comparison_notes,
             comparison_delta_confidence, comparison_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                visit_id,
                patient_hash,
                now_iso[:10],
                previous_visit_id,
                symptoms,
                doctor_observations,
                ai_prediction,
                ai_confidence,
                clean_stage,
                doctor_validated_change,
                doctor_email,
                doctor_name,
                xray_image_path,
                heatmap_image_path,
                prediction_id,
                visit_number,
                meds_json,
                doctor_treatment_action,
                ai_comparison_notes,
                comparison_delta,
                doctor_validated_change,
                now_iso,
            ),
        )

    # Update patient record
    doctor_cured = 1 if doctor_treatment_action == "completed_regimen" else 0
    t_status = "completed" if doctor_cured else "active"
    update_patient_treatment(
        patient_hash=patient_hash,
        current_stage=clean_stage,
        prescribed_medicines=prescribed_medicines,
        treatment_status=t_status,
        doctor_confirmed_cured=bool(doctor_cured),
        doctor_email=doctor_email,
        doctor_name=doctor_name,
    )

    # Schedule next follow-up if requested
    if next_followup_date and next_followup_date.strip():
        schedule_follow_up(
            follow_up_id=f"FU-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            patient_hash=patient_hash,
            visit_id=visit_id,
            doctor_email=doctor_email or "doctor@pulmoscan.org",
            scheduled_at=next_followup_date.strip(),
            reason=f"Stage {clean_stage} Review & Sputum Check",
        )

    log_audit_event(
        user_email=doctor_email or "doctor@pulmoscan.org",
        user_role="doctor",
        action="FOLLOWUP_VISIT_RECORDED",
        resource_id=visit_id,
        details=(
            f"Follow-up visit #{visit_number} recorded for {patient_hash}. "
            f"Doctor Verdict: {doctor_validated_change.upper()}. Stage: {clean_stage}. "
            f"Action: {doctor_treatment_action}. Attending: {doctor_name}"
        ),
    )

    with get_connection() as connection:
        v_row = connection.execute(
            "SELECT * FROM patient_visits WHERE visit_id = ?",
            (visit_id,),
        ).fetchone()
    return dict(v_row) if v_row else {}


def get_patient_progress_report(patient_hash: str) -> dict[str, Any]:
    """Generates a complete, tamper-evident clinical progress and recovery report."""
    patient = get_patient(patient_hash)
    if not patient:
        raise KeyError(f"Patient with hash '{patient_hash}' not found.")

    visits = patient.get("visits", [])
    initial_visit = visits[0] if visits else None
    latest_visit = visits[-1] if visits else None

    # Compute trajectory
    trajectory = []
    for v in visits:
        trajectory.append({
            "visit_id": v.get("visit_id"),
            "visit_number": v.get("visit_number", 1),
            "date": v.get("visit_date"),
            "stage": v.get("treatment_stage", 1),
            "ai_prediction": v.get("ai_prediction", "N/A"),
            "ai_confidence_pct": round(float(v["ai_confidence"]) * 100, 1) if v.get("ai_confidence") is not None else None,
            "doctor_validated_change": v.get("doctor_validated_change") or "Pending Review",
            "doctor_observations": v.get("doctor_observations") or "No observations recorded.",
            "attending_doctor": v.get("doctor_name") or "Clinician",
            "xray_url": _normalize_report_img_path(v.get("xray_image_path")),
            "heatmap_url": _normalize_report_img_path(v.get("heatmap_image_path")),
        })

    return {
        "report_id": f"RPT-{patient_hash}-{datetime.now().strftime('%Y%m%d%H%M')}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "patient": {
            "patient_hash": patient.get("patient_hash"),
            "name": patient.get("name"),
            "age": patient.get("age"),
            "gender": patient.get("gender"),
            "contact_phone": patient.get("contact_phone"),
            "contact_email": patient.get("contact_email"),
            "medical_history": patient.get("medical_history"),
            "allergies": patient.get("allergies"),
            "initial_diagnosis_date": patient.get("initial_diagnosis_date"),
            "initial_stage": patient.get("initial_stage", 1),
            "current_stage": patient.get("current_stage", 1),
            "treatment_status": patient.get("treatment_status", "active"),
            "doctor_confirmed_cured": bool(patient.get("doctor_confirmed_cured", 0)),
            "doctor_cured_date": patient.get("doctor_cured_date"),
            "assigned_doctor_name": patient.get("assigned_doctor_name") or "Attending Pulmonologist",
            "assigned_doctor_email": patient.get("assigned_doctor_email") or "doctor@pulmoscan.org",
        },
        "baseline_summary": {
            "date": initial_visit.get("visit_date") if initial_visit else patient.get("initial_diagnosis_date"),
            "ai_prediction": initial_visit.get("ai_prediction") if initial_visit else "TB Positive",
            "confidence_pct": round(float(initial_visit["ai_confidence"]) * 100, 1) if initial_visit and initial_visit.get("ai_confidence") is not None else None,
            "xray_url": _normalize_report_img_path(initial_visit.get("xray_image_path")) if initial_visit else None,
            "heatmap_url": _normalize_report_img_path(initial_visit.get("heatmap_image_path")) if initial_visit else None,
        },
        "current_summary": {
            "date": latest_visit.get("visit_date") if latest_visit else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "stage": patient.get("current_stage", 1),
            "ai_prediction": latest_visit.get("ai_prediction") if latest_visit else "N/A",
            "confidence_pct": round(float(latest_visit["ai_confidence"]) * 100, 1) if latest_visit and latest_visit.get("ai_confidence") is not None else None,
            "validated_change": latest_visit.get("doctor_validated_change") if latest_visit else "Pending",
            "xray_url": _normalize_report_img_path(latest_visit.get("xray_image_path")) if latest_visit else None,
            "heatmap_url": _normalize_report_img_path(latest_visit.get("heatmap_image_path")) if latest_visit else None,
            "prescribed_medicines": patient.get("prescribed_medicines", []),
        },
        "trajectory": trajectory,
        "clinical_disclaimer": (
            "CONFIDENTIAL CLINICAL DOCUMENT: AI predictions are decision-support outputs based on deep learning "
            "radiological pattern analysis and do not constitute autonomous medical judgment. Complete cure or treatment "
            "cessation is determined strictly by the certified attending physician based on holistic clinical, "
            "radiological, and microbiological evaluation."
        ),
    }


def _normalize_report_img_path(path: str | None) -> str | None:
    """Helper to convert local filesystem image paths to web accessible edge-storage URLs."""
    if not path:
        return None
    p = Path(path)
    if "edge_storage" in str(p) or "inferences" in str(p):
        return f"/edge-storage/inferences/{p.name}"
    return path


def get_doctor_recovery_overview(doctor_email: str | None = None) -> dict[str, Any]:
    """Computes high-level stage distribution and treatment progress metrics for the doctor dashboard."""
    with get_connection() as connection:
        total_pts = connection.execute("SELECT COUNT(*) AS c FROM patients").fetchone()["c"]
        cured_pts = connection.execute("SELECT COUNT(*) AS c FROM patients WHERE doctor_confirmed_cured = 1").fetchone()["c"]
        stage_1 = connection.execute("SELECT COUNT(*) AS c FROM patients WHERE current_stage = 1 AND doctor_confirmed_cured = 0").fetchone()["c"]
        stage_2 = connection.execute("SELECT COUNT(*) AS c FROM patients WHERE current_stage = 2 AND doctor_confirmed_cured = 0").fetchone()["c"]
        stage_3 = connection.execute("SELECT COUNT(*) AS c FROM patients WHERE current_stage = 3 AND doctor_confirmed_cured = 0").fetchone()["c"]
        stage_4 = connection.execute("SELECT COUNT(*) AS c FROM patients WHERE current_stage = 4 AND doctor_confirmed_cured = 0").fetchone()["c"]
        stage_5 = connection.execute("SELECT COUNT(*) AS c FROM patients WHERE current_stage = 5 OR doctor_confirmed_cured = 1").fetchone()["c"]
        pending_revs = connection.execute(
            "SELECT COUNT(DISTINCT patient_hash) AS c FROM patient_visits WHERE doctor_review_status = 'pending'"
        ).fetchone()["c"]
        upcoming_fu = connection.execute(
            "SELECT COUNT(*) AS c FROM follow_ups WHERE status = 'scheduled'"
        ).fetchone()["c"]

    return {
        "total_patients": total_pts,
        "doctor_confirmed_cured": cured_pts,
        "active_treatments": total_pts - cured_pts,
        "patients_requiring_review": pending_revs,
        "upcoming_follow_ups": upcoming_fu,
        "stage_distribution": {
            "stage_1_intensive": stage_1,
            "stage_2_continuation": stage_2,
            "stage_3_consolidation": stage_3,
            "stage_4_extended": stage_4,
            "stage_5_recovery": stage_5,
        },
    }


def prediction_exists(prediction_id: str) -> bool:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT 1 FROM predictions WHERE prediction_id = ?",
            (prediction_id,),
        ).fetchone()
    return row is not None


def get_prediction_result(prediction_id: str) -> str | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT result FROM predictions WHERE prediction_id = ?",
            (prediction_id,),
        ).fetchone()
    return None if row is None else str(row["result"])


def get_prediction_row(prediction_id: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM predictions WHERE prediction_id = ?",
            (prediction_id,),
        ).fetchone()
    return None if row is None else dict(row)


def get_prediction_details(prediction_id: str) -> dict[str, Any] | None:
    """Retrieves full prediction record details by prediction_id."""
    return get_prediction_row(prediction_id)


def feedback_exists(prediction_id: str) -> bool:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT 1 FROM feedback WHERE prediction_id = ?",
            (prediction_id,),
        ).fetchone()
    return row is not None


def save_feedback(
    prediction_id: str,
    predicted_result: str,
    true_label: str,
    confirmed_stage: int | None,
    doctor_notes: str | None = None,
    doctor_email: str | None = None,
    doctor_name: str | None = None,
) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO feedback
                (prediction_id, image_id, doctor_email, doctor_name, predicted_result, true_label,
                 confirmed_stage, doctor_notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                prediction_id,
                prediction_id,
                doctor_email,
                doctor_name,
                predicted_result,
                true_label,
                confirmed_stage,
                doctor_notes,
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def enqueue_active_learning(
    prediction_id: str,
    patient_hash: str,
    image_path: str,
    ai_prediction: str,
    ai_confidence: float,
    doctor_label: str,
    doctor_stage: int | None = None,
    doctor_notes: str | None = None,
) -> None:
    """Inserts a doctor-reviewed edge case into the local Active Learning retraining queue."""
    with get_connection() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO active_learning_queue
                (prediction_id, patient_hash, image_path, ai_prediction, ai_confidence,
                 doctor_label, doctor_stage, doctor_notes, pending_active_learning, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                prediction_id,
                patient_hash,
                image_path,
                ai_prediction,
                ai_confidence,
                doctor_label,
                doctor_stage,
                doctor_notes,
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def get_pending_active_learning_records() -> list[dict[str, Any]]:
    """Retrieves all pending edge-case records for the upcoming local FL training epoch."""
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM active_learning_queue
            WHERE pending_active_learning = 1
            ORDER BY id ASC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_active_learning_queue_stats() -> dict[str, Any]:
    with get_connection() as connection:
        total = connection.execute("SELECT COUNT(*) AS c FROM active_learning_queue").fetchone()["c"]
        pending = connection.execute("SELECT COUNT(*) AS c FROM active_learning_queue WHERE pending_active_learning = 1").fetchone()["c"]
        trained = connection.execute("SELECT COUNT(*) AS c FROM active_learning_queue WHERE pending_active_learning = 0").fetchone()["c"]
    return {
        "total_queued": int(total),
        "pending_count": int(pending),
        "trained_count": int(trained),
    }


def mark_active_learning_trained(prediction_ids: list[str]) -> None:
    """Marks queue records as successfully trained and clears pending flag."""
    if not prediction_ids:
        return
    placeholders = ",".join("?" for _ in prediction_ids)
    now_str = datetime.now(timezone.utc).isoformat()
    with get_connection() as connection:
        connection.execute(
            f"""
            UPDATE active_learning_queue
            SET pending_active_learning = 0, trained_at = ?
            WHERE prediction_id IN ({placeholders})
            """,
            [now_str] + prediction_ids,
        )


def get_feedback_count() -> int:
    with get_connection() as connection:
        row = connection.execute("SELECT COUNT(*) AS count FROM feedback").fetchone()
    return int(row["count"])


def get_all_feedback() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, prediction_id, predicted_result, true_label,
                   confirmed_stage, doctor_notes, created_at
            FROM feedback
            ORDER BY id DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Authentication & Role-Based Access Control (RBAC)
# ---------------------------------------------------------------------------

def _hash_password(password: str) -> str:
    """Computes salted SHA-256 password hash."""
    return hashlib.sha256(f"pulmoscan_secure_salt_{password}".encode("utf-8")).hexdigest()


def create_user(
    email: str,
    password: str,
    name: str,
    role: str,
    license_number: str | None = None,
    patient_hash: str | None = None,
    hospital_node: str | None = None,
) -> dict[str, Any]:
    """Registers a new user account with role validation."""
    if role not in {"doctor", "admin", "patient", "hospital"}:
        raise ValueError("Invalid role; must be 'doctor', 'admin', 'patient', or 'hospital'.")

    normalized_email = email.strip().lower()
    hashed = _hash_password(password)
    now_iso = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO users (email, password_hash, name, role, license_number, patient_hash, hospital_node, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                normalized_email,
                hashed,
                name.strip(),
                role,
                license_number.strip() if license_number else None,
                patient_hash.strip() if patient_hash else None,
                hospital_node.strip() if hospital_node else "Node A - Urban Referral",
                now_iso,
            ),
        )
        user_id = cursor.lastrowid

    log_audit_event(
        user_email=normalized_email,
        user_role=role,
        action="USER_REGISTERED",
        resource_id=str(user_id),
        details=f"New user registered with role {role}.",
        user_id=user_id,
    )

    return {
        "id": user_id,
        "email": normalized_email,
        "name": name,
        "role": role,
        "license_number": license_number,
        "patient_hash": patient_hash,
        "hospital_node": hospital_node,
        "created_at": now_iso,
    }


def authenticate_user(email: str, password: str) -> dict[str, Any] | None:
    """Verifies credentials and returns user dictionary without password hash."""
    normalized_email = email.strip().lower()
    hashed = _hash_password(password)

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, email, password_hash, name, role, license_number, patient_hash, hospital_node, created_at
            FROM users
            WHERE email = ?
            """,
            (normalized_email,),
        ).fetchone()

    if row is None or row["password_hash"] != hashed:
        return None

    user_dict = dict(row)
    user_dict.pop("password_hash", None)

    log_audit_event(
        user_email=user_dict["email"],
        user_role=user_dict["role"],
        action="USER_LOGIN",
        resource_id=str(user_dict["id"]),
        details=f"Successful login for {user_dict['role']}.",
        user_id=user_dict["id"],
    )

    return user_dict


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, email, name, role, license_number, patient_hash, hospital_node, created_at
            FROM users
            WHERE email = ?
            """,
            (email.strip().lower(),),
        ).fetchone()
    return None if row is None else dict(row)


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, email, name, role, license_number, patient_hash, hospital_node, created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
    return None if row is None else dict(row)


def get_all_users() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, email, name, role, license_number, patient_hash, hospital_node, created_at
            FROM users
            ORDER BY id ASC
            """
        ).fetchall()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# HIPAA Audit Logging
# ---------------------------------------------------------------------------

def log_audit_event(
    user_email: str,
    user_role: str,
    action: str,
    resource_id: str | None = None,
    details: str | None = None,
    user_id: int | None = None,
) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO audit_logs (user_id, user_email, user_role, action, resource_id, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, user_email, user_role, action, resource_id, details, now_iso),
            )
    except Exception:
        pass


def get_recent_audit_logs(limit: int = 25) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, user_id, user_email, user_role, action, resource_id, details, created_at
            FROM audit_logs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Dynamic Clinical Analytics & Scans (Real-World SQLite Pipeline)
# ---------------------------------------------------------------------------

def get_clinical_stats() -> dict[str, Any]:
    with get_connection() as connection:
        total = connection.execute("SELECT COUNT(*) AS c FROM predictions").fetchone()["c"]
        positives = connection.execute("SELECT COUNT(*) AS c FROM predictions WHERE result LIKE '%Positive%'").fetchone()["c"]
        negatives = connection.execute("SELECT COUNT(*) AS c FROM predictions WHERE result LIKE '%Negative%'").fetchone()["c"]
        feedback_cnt = connection.execute("SELECT COUNT(*) AS c FROM feedback").fetchone()["c"]
        al_pending = connection.execute("SELECT COUNT(*) AS c FROM active_learning_queue WHERE pending_active_learning = 1").fetchone()["c"]
        
        # Pending reviews: predictions without doctor feedback sign-off
        pending_reviews = connection.execute(
            """
            SELECT COUNT(*) AS c FROM predictions 
            WHERE prediction_id NOT IN (SELECT prediction_id FROM feedback WHERE prediction_id IS NOT NULL)
            """
        ).fetchone()["c"]

        # Today's scans count (UTC)
        today_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_scans = connection.execute(
            "SELECT COUNT(*) AS c FROM predictions WHERE created_at LIKE ?",
            (f"{today_prefix}%",),
        ).fetchone()["c"]

        recent = min(total, 10)

    pos_rate = round((positives / max(1, total)) * 100, 1)
    clear_rate = round((negatives / max(1, total)) * 100, 1)

    return {
        "totalScans": total,
        "positiveCases": positives,
        "negativeCases": negatives,
        "positivityRate": pos_rate,
        "clearRate": clear_rate,
        "recentScans": recent,
        "pendingReviews": pending_reviews,
        "todayScans": today_scans,
        "feedbackCount": feedback_cnt,
        "pendingActiveLearning": al_pending,
    }


def get_scans_by_role(role: str, patient_hash: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """Fetches real scan records, applying strict privacy isolation for patients."""
    query = """
        SELECT 
            p.prediction_id,
            p.patient_hash,
            p.patient_name,
            p.filename,
            p.is_dicom,
            p.image_path,
            p.result,
            p.confidence,
            p.stage,
            p.uploaded_by_email,
            p.created_at,
            f.id AS feedback_id,
            f.doctor_email,
            f.doctor_name,
            f.true_label,
            f.confirmed_stage,
            f.doctor_notes
        FROM predictions p
        LEFT JOIN feedback f ON p.prediction_id = f.prediction_id
    """
    params: list[Any] = []

    if role == "patient" and patient_hash:
        query += " WHERE (p.patient_hash = ? OR p.uploaded_by_email = ?) "
        params.extend([patient_hash, patient_hash])

    query += " ORDER BY p.created_at DESC LIMIT ? "
    params.append(limit)

    with get_connection() as connection:
        rows = connection.execute(query, params).fetchall()
        registered_patients = {
            r["patient_hash"]: r["name"]
            for r in connection.execute("SELECT patient_hash, name FROM users WHERE patient_hash IS NOT NULL").fetchall()
        }

    results = []
    for r in rows:
        conf_val = float(r["confidence"])
        conf_pct = round(conf_val if conf_val > 1.0 else conf_val * 100, 1)
        is_pos = "positive" in str(r["result"]).lower()

        p_hash = r["patient_hash"] or f"PT-{r['prediction_id'][:8].upper()}"
        
        # Real patient name determination
        if r["patient_name"] and r["patient_name"].strip():
            p_name = r["patient_name"].strip()
        elif p_hash in registered_patients:
            p_name = registered_patients[p_hash]
        else:
            clean_hash = p_hash.replace("PT-HASH-", "").replace("PT-", "")
            p_name = f"Patient {clean_hash[:6]}" if clean_hash else "Patient"

        date_str = (r["created_at"] or "")[:10] or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        is_confirmed = bool(r["feedback_id"] is not None)
        doc_label = r["true_label"] or r["result"]
        doc_stage = r["confirmed_stage"] if r["confirmed_stage"] is not None else r["stage"]
        notes = r["doctor_notes"] or ("Awaiting clinician diagnosis sign-off." if not is_confirmed else ("Verified normal lung fields." if not is_pos else "Clinical review complete. Follow attending care roadmap."))

        pred_id = r["prediction_id"]
        heatmap_file = EDGE_STORAGE_DIR / "inferences" / f"{pred_id}_heatmap.png"
        heatmap_url = f"/edge-storage/inferences/{pred_id}_heatmap.png" if heatmap_file.exists() else None

        img_file = EDGE_STORAGE_DIR / "inferences" / f"{pred_id}.png"
        image_url = f"/edge-storage/inferences/{pred_id}.png" if img_file.exists() else r["image_path"]

        results.append({
            "id": r["prediction_id"],
            "predictionId": r["prediction_id"],
            "prediction_id": r["prediction_id"],
            "patientId": p_hash,
            "patient_id": p_hash,
            "patient_hash": p_hash,
            "patientName": p_name,
            "patient_name": p_name,
            "filename": r["filename"],
            "isDicom": bool(r["is_dicom"]),
            "is_dicom": bool(r["is_dicom"]),
            "scanDate": date_str,
            "created_at": r["created_at"],
            "result": r["result"],
            "confidence": conf_pct,
            "stage": doc_stage,
            "doctorConfirmed": is_confirmed,
            "doctor_confirmed": is_confirmed,
            "doctorLabel": doc_label,
            "doctor_label": doc_label,
            "notes": notes,
            "doctor_notes": notes,
            "doctorEmail": r["doctor_email"],
            "doctorName": r["doctor_name"],
            "imagePath": image_url,
            "image_path": image_url,
            "imageUrl": image_url,
            "image_url": image_url,
            "heatmapUrl": heatmap_url,
            "heatmap_url": heatmap_url,
        })

    return results


def seed_default_users_and_scans() -> None:
    """Ensures Admin user exists, removes deprecated demo users and mock scans."""
    with get_connection() as connection:
        # 1. Clean up deprecated demo accounts if present
        connection.execute("DELETE FROM users WHERE email IN ('doctor@pulmoscan.org', 'patient@pulmoscan.org')")
        
        # 2. Clean up mock seeded scans and test duplicates
        connection.execute("DELETE FROM feedback WHERE prediction_id IN ('1001', '1002', '1003', '1004', '1005') OR prediction_id LIKE 'test-pred-%'")
        connection.execute("DELETE FROM predictions WHERE prediction_id IN ('1001', '1002', '1003', '1004', '1005') OR prediction_id LIKE 'test-pred-%'")
        connection.execute("DELETE FROM active_learning_queue WHERE prediction_id LIKE 'test-pred-%'")

        # 3. Ensure the single Administrative Account exists
        admin_row = connection.execute("SELECT id FROM users WHERE role = 'admin'").fetchone()

        # 4. Ensure default hospitals exist
        hosp_a = connection.execute("SELECT 1 FROM hospitals WHERE hospital_id = 'hosp_A' OR node_id = 'node_A'").fetchone()
        if not hosp_a:
            connection.execute(
                """
                INSERT OR IGNORE INTO hospitals
                (hospital_id, name, address, contact_email, phone, node_id, status, created_at)
                VALUES ('hosp_A', 'Hospital A (Urban Referral Center)', 'Metro District 1', 'admin@hospital-a.org', '+1-555-0101', 'node_A', 'offline', ?)
                """,
                (datetime.now(timezone.utc).isoformat(),),
            )
        hosp_b = connection.execute("SELECT 1 FROM hospitals WHERE hospital_id = 'hosp_B' OR node_id = 'node_B'").fetchone()
        if not hosp_b:
            connection.execute(
                """
                INSERT OR IGNORE INTO hospitals
                (hospital_id, name, address, contact_email, phone, node_id, status, created_at)
                VALUES ('hosp_B', 'Hospital B (Rural District Clinic)', 'Rural Outreach Zone 4', 'contact@hospital-b.org', '+1-555-0102', 'node_B', 'offline', ?)
                """,
                (datetime.now(timezone.utc).isoformat(),),
            )
        hosp_user = connection.execute("SELECT id FROM users WHERE role = 'hospital'").fetchone()

    # create_user() and log_audit_event() open their own connections. Keep this
    # outside the seed connection's transaction to avoid SQLite database locks.
    if not admin_row:
        create_user(
            email="admin@pulmoscan.org",
            password="AdminPass123!",
            name="System Administrator",
            role="admin",
            hospital_node="Central Aggregation Hub",
        )
        log_audit_event(
            "system@pulmoscan.org",
            "admin",
            "SYSTEM_INITIALIZED",
            "system",
            "Default Admin account initialized with AdminPass123!.",
        )
    if not hosp_user:
        create_user(
            email="hospital_a@pulmoscan.org",
            password="HospitalPass123!",
            name="Hospital A Edge Operator",
            role="hospital",
            hospital_node="node_A",
        )

    # 5. Seed clinical patients if patients table is empty
    with get_connection() as connection:
        pt_cnt = connection.execute("SELECT COUNT(*) AS cnt FROM patients").fetchone()["cnt"]

    if pt_cnt == 0:
        # Populate from existing users who have patient_hash
        with get_connection() as connection:
            user_patients = connection.execute(
                "SELECT email, name, patient_hash FROM users WHERE patient_hash IS NOT NULL"
            ).fetchall()

        for up in user_patients:
            register_patient(
                patient_hash=up["patient_hash"],
                name=up["name"],
                contact_email=up["email"],
                initial_stage=2,
                assigned_doctor_name="Dr Karthik",
                assigned_doctor_email="doctor@pulmoscan.org",
            )

        # Seed clinical benchmark patients demonstrating stage progression
        register_patient(
            patient_hash="PT-2026-081",
            name="Ramesh Kumar",
            age=45,
            gender="Male",
            contact_phone="+91-98765-43210",
            contact_email="ramesh.k@example.com",
            emergency_contact="+91-98765-43211 (Spouse)",
            medical_history="Smoker (10 pack-years), Type 2 Diabetes Mellitus. Primary pulmonary TB.",
            allergies="Penicillin",
            initial_stage=1,
            assigned_doctor_email="doctor@pulmoscan.org",
            assigned_doctor_name="Dr Karthik",
        )

        register_patient(
            patient_hash="PT-2026-094",
            name="Priya Sharma",
            age=32,
            gender="Female",
            contact_phone="+91-98123-45678",
            contact_email="priya.s@example.com",
            emergency_contact="+91-98123-45679 (Father)",
            medical_history="Cavitary right upper lobe lesion. Sputum smear 3+ at presentation.",
            allergies="None known",
            initial_stage=3,
            assigned_doctor_email="doctor@pulmoscan.org",
            assigned_doctor_name="Dr Karthik",
        )

        register_patient(
            patient_hash="PT-2026-112",
            name="Anand Varma",
            age=58,
            gender="Male",
            contact_phone="+91-99887-76655",
            contact_email="anand.v@example.com",
            emergency_contact="+91-99887-76656",
            medical_history="Mild apical infiltrate. Excellent treatment adherence.",
            allergies="Sulfa drugs",
            initial_stage=2,
            assigned_doctor_email="doctor@pulmoscan.org",
            assigned_doctor_name="Dr Karthik",
        )

        # Seed benchmark clinical trajectory for PT-2026-081
        with get_connection() as connection:
            pt_visits = connection.execute("SELECT COUNT(*) AS c FROM patient_visits WHERE patient_hash = 'PT-2026-081'").fetchone()["c"]
        if pt_visits == 0:
            create_patient_visit(
                visit_id="VST-20260901-081001",
                patient_hash="PT-2026-081",
                visit_date="2026-09-01",
                symptoms="Persistent productive cough for 4 weeks, intermittent night sweats, low-grade fever, 3kg weight loss.",
                doctor_observations="Baseline presentation. Bilateral crepitations on auscultation. Commenced standard HRZE Intensive Phase.",
                ai_prediction="TB Positive",
                ai_confidence=0.942,
                treatment_stage=1,
                doctor_email="doctor@pulmoscan.org",
                doctor_name="Dr Karthik",
                xray_image_path="backend/edge_storage/inferences/154d8683-85b8-48bc-88cc-c5200b89a584.png",
                heatmap_image_path="backend/edge_storage/inferences/154d8683-85b8-48bc-88cc-c5200b89a584_heatmap.png",
                prediction_id="154d8683-85b8-48bc-88cc-c5200b89a584",
                prescribed_medicines=get_default_medications_for_stage(1),
            )
            record_patient_followup_visit(
                patient_hash="PT-2026-081",
                symptoms="Cough significantly reduced, no fever over the past 14 days, appetite recovering, 1.5kg weight gain.",
                doctor_observations="Week 8 follow-up radiograph shows marked clearing of right middle lobe consolidation. Cavitary margins regressing.",
                doctor_validated_change="improved",
                doctor_treatment_action="advance_stage",
                treatment_stage=2,
                prescribed_medicines=get_default_medications_for_stage(2),
                doctor_email="doctor@pulmoscan.org",
                doctor_name="Dr Karthik",
                xray_image_path="backend/edge_storage/inferences/272249aa-9642-4f2f-8f2e-cbd30d1226bd.png",
                heatmap_image_path="backend/edge_storage/inferences/154d8683-85b8-48bc-88cc-c5200b89a584_heatmap.png",
                prediction_id="272249aa-9642-4f2f-8f2e-cbd30d1226bd",
                ai_prediction="TB Positive",
                ai_confidence=0.718,
                next_followup_date="2026-12-15",
            )
