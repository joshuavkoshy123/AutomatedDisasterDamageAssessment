from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# always equals this backend/ directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.get("/")
def read_root():
    return {"Hello": "World"}

# returns pre or post disaster GeoJSON at specified path
@app.get("/data/metadata.json")
def fetch_metadata():
    return FileResponse(os.path.join(BASE_DIR, "metadata.json"))

@app.get("/files/{file_path:path}")
def fetch_geojson(file_path: str):
    return FileResponse(os.path.join(BASE_DIR, "GeoJSON", file_path))

# returns pre or post disaster image at specified path
@app.get("/images/{file_path:path}")
def fetch_image(file_path: str):
    return FileResponse(os.path.join(BASE_DIR, "..", "images", file_path))

# returns model response to query (used by chatbot)
@app.get("/query/")
def query_model(q: str = "", img: str | None = None):
    # get model response from nemotron (could be called from a new nemotron script with the query as a parameter)
    response = "MODEL RESPONSE"
    return {"response": response}

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
