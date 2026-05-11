import shutil
import tempfile
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn

from backend.nemotron import call_model
from backend.query_gateway import intent_detector

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# returns model response to query (used by chatbot)
@app.get("/query/")
def query_model(q: str = "", session_id: str | None = None):
    #response = answer_query(q)
    print("Hello!")
    return intent_detector(q, session_id=session_id)

# returns result of pre and post disaster image analysis (for Upload Page)
@app.post("/evaluate/")
def evaluate(
    pre: Annotated[UploadFile, File()],
    post: Annotated[UploadFile, File()]
):
    if not pre.filename or not post.filename:
        raise HTTPException(status_code=400, detail="Both pre and post images are required.")

    pre_suffix = Path(pre.filename).suffix or ".png"
    post_suffix = Path(post.filename).suffix or ".png"

    with tempfile.TemporaryDirectory(prefix="damage_eval_") as tmp_dir:
        tmp_root = Path(tmp_dir)
        pre_path = tmp_root / f"pre{pre_suffix}"
        post_path = tmp_root / f"post{post_suffix}"

        with pre_path.open("wb") as f:
            shutil.copyfileobj(pre.file, f)
        with post_path.open("wb") as f:
            shutil.copyfileobj(post.file, f)

        predicted, status, raw, latency = call_model(pre_path, post_path, "uploaded-eval")

    if predicted == "ERROR":
        raise HTTPException(
            status_code=502,
            detail=f"Model evaluation failed (status={status}). Raw response: {raw[:300]}",
        )

    summary = f"Predicted damage classification: {predicted}."
    return {
        "summary": summary,
        "predicted": predicted,
        "status": status,
        "latency_s": round(latency, 3),
    }

# gets overall stats or stats for a specific disaster site is disaster id is provided. Will retrieve data from SQL db (don't worry about this for now, we will implement later).
@app.get("/stats/")
def get_stats(disaster_id: str | None = None):
    accuracy = 0
    num_no_damage = 0
    num_minor_damage = 0
    num_major_damage = 0
    num_severe_damage = 0
    return {"disaster_id": disaster_id, "accuracy": accuracy, "num_no_damage": num_no_damage, "num_minor_damage": num_minor_damage, "num_major_damage": num_major_damage, "num_severe_damage": num_severe_damage}

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
