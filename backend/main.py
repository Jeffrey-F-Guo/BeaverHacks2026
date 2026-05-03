from fastapi import FastAPI
from pydantic import BaseModel

import gemini_client

app = FastAPI(title="GroundTruth backend")


class ResearchRequest(BaseModel):
    query: str


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/gemini/smoke")
def gemini_smoke() -> dict:
    return {"text": gemini_client.smoke()}


@app.post("/research")
def research_start(body: ResearchRequest) -> dict:
    return {"op_id": gemini_client.start_research(body.query)}


@app.get("/research/{op_id}")
def research_status(op_id: str) -> dict:
    return gemini_client.get_research(op_id)
