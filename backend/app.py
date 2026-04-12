from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from nemotron import answer_query

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# returns model response to query (used by chatbot)
@app.get("/query/")
def query_model(q: str = ""):
    response = answer_query(q)
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
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
