import sqlite3

def get_connection():
    conn = sqlite3.connect("feedback.db")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id TEXT,
            predicted_result TEXT,
            true_label TEXT,
            confirmed_stage INTEGER
        )
    """)
    conn.commit()
    conn.close()