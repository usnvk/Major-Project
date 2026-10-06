import hashlib
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DATABASE_PATH = Path(__file__).resolve().parent / "feedback.db"


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
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

        # High performance query indexes
        connection.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_predictions_patient_hash ON predictions(patient_hash);
            CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);
            CREATE INDEX IF NOT EXISTS idx_feedback_pred_id ON feedback(prediction_id);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_al_pending ON active_learning_queue(pending_active_learning);
            """
        )

    seed_default_users_and_scans()


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
    if role not in {"doctor", "admin", "patient"}:
        raise ValueError("Invalid role; must be 'doctor', 'admin', or 'patient'.")

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
            "imagePath": r["image_path"],
            "image_path": r["image_path"],
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
        if not admin_row:
            create_user(
                email="admin@pulmoscan.org",
                password="AdminPass123!",
                name="System Administrator",
                role="admin",
                hospital_node="Central Aggregation Hub",
            )
            log_audit_event("system@pulmoscan.org", "admin", "SYSTEM_INITIALIZED", "system", "Default Admin account initialized with AdminPass123!.")
