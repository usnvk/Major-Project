from fastapi import FastAPI, UploadFile, File
import json
from database import init_db, get_connection
from pydantic import BaseModel

init_db()

with open("stages.json", "r") as f:
    stage_data = json.load(f)

app = FastAPI()

@app.get("/")
def root():
    return {"status": "TB backend running"}

# @app.post("/predict")
# async def predict(file: UploadFile = File(...)):
#     contents = await file.read()
#     # dummy response for now — real model comes in Week 3
#     return {"result": "TB Positive", "confidence": 0.82, "stage": 2}


@app.get("/stage/{stage_id}")
def get_stage(stage_id: str):
    stage_id = str(stage_id)
    if stage_id not in stage_data:
        return {"error": "Invalid stage number"}
    return stage_data[stage_id]


def get_stage_from_confidence(confidence: float) -> int:
    """
    Maps model confidence score (0.0 to 1.0) to a TB stage.
    """
    if confidence >= 0.95:
        return 4
    elif confidence >= 0.85:
        return 3
    elif confidence >= 0.70:
        return 2
    elif confidence >= 0.60:
        return 1
    else:
        return 0  # below threshold — likely TB negative


class FeedbackInput(BaseModel):
    image_id: str
    predicted_result: str
    true_label: str
    confirmed_stage: int

@app.post("/feedback")
def submit_feedback(data: FeedbackInput):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO feedback (image_id, predicted_result, true_label, confirmed_stage) VALUES (?, ?, ?, ?)",
        (data.image_id, data.predicted_result, data.true_label, data.confirmed_stage)
    )
    conn.commit()
    conn.close()
    return {"status": "feedback saved"}

@app.get("/feedback/all")
def get_all_feedback():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM feedback")
    rows = cursor.fetchall()
    conn.close()
    return rows

@app.get("/retrain-check")
def retrain_check():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM feedback")
    count = cursor.fetchone()[0]
    conn.close()

    threshold = 5  # arbitrary — retrain after 5 feedback entries
    if count >= threshold:
        return {"retrain_needed": True, "feedback_count": count}
    return {"retrain_needed": False, "feedback_count": count}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()

    # --- dummy confidence for now, until real model is wired in Week 3 ---
    confidence = 0.82

    stage = get_stage_from_confidence(confidence)

    if stage == 0:
        return {"result": "TB Negative", "confidence": confidence, "stage": None}

    return {
        "result": "TB Positive",
        "confidence": confidence,
        "stage": stage,
        "stage_info": stage_data.get(str(stage), {})
    }

