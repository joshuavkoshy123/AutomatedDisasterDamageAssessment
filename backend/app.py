from fastapi import FastAPI
from fastapi.responses import FileResponse
from nemotron import answer_query

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

# returns pre or post disaster GeoJSON at specified path
@app.get("/files/{file_path:path}")
def fetch_geojson(file_path: str):
    # make sure filepath correctly fetches GeoJSON file in backend/GeoJSON directory (confirm path)
    #return FileResponse(f"./GeoJSON/output_{file_path}")
    return {"response": file_path}

# returns pre or post disaster image at specified path
@app.get("/images/{file_path:path}")
def fetch_image(file_path: str):
    # make sure filepath correctly fetches image file in images directory (confirm path)
    #return FileResponse(f"../images/{file_path}")
    return {"response": file_path}

# returns model response to query (used by chatbot)
@app.get("/query/")
def query_model(q: str = ""):
    response = answer_query(q)

# gets overall stats or stats for a specific disaster site is disaster id is provided. Will retrieve data from SQL db (don't worry about this for now, we will implement later).
@app.get("/stats/")
def get_stats(disaster_id: str | None = None):
    accuracy = 0
    num_no_damage = 0
    num_minor_damage = 0
    num_major_damage = 0
    num_severe_damage = 0
    return {"disaster_id": disaster_id, "accuracy": accuracy, "num_no_damage": num_no_damage, "num_minor_damage": num_minor_damage, "num_major_damage": num_major_damage, "num_severe_damage": num_severe_damage}
