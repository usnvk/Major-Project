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
            CREATE TABLE IF NOT EXISTS predictions (
                prediction_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
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
                created_at TEXT NOT NULL,
                FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
            );
            """
        )
        columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(feedback)")
        }
        if "prediction_id" not in columns:
            connection.execute("ALTER TABLE feedback ADD COLUMN prediction_id TEXT")
        if "created_at" not in columns:
            connection.execute("ALTER TABLE feedback ADD COLUMN created_at TEXT")


def save_prediction(
    prediction_id: str,
    filename: str,
    result: str,
    confidence: float,
    stage: int | None,
) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO predictions
                (prediction_id, filename, result, confidence, stage, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                prediction_id,
                filename,
                result,
                confidence,
                stage,
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
) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO feedback
                (prediction_id, image_id, predicted_result, true_label,
                 confirmed_stage, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                prediction_id,
                prediction_id,
                predicted_result,
                true_label,
                confirmed_stage,
                datetime.now(timezone.utc).isoformat(),
            ),
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
                   confirmed_stage, created_at
            FROM feedback
            ORDER BY id DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]
