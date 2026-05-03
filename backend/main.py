"""FastAPI surface over the GroundTruth pipeline.

For batch / repeatable runs prefer the CLI in `run_pipeline.py` — these endpoints
are mostly for the demo client and quick exploration.
"""

from fastapi import FastAPI
from pydantic import BaseModel

import gemini_client
import pipeline

app = FastAPI(title="GroundTruth backend")


class ResearchRequest(BaseModel):
    query: str


class PipelineRequest(BaseModel):
    query: str
    n_scripts: int = 4
    skip_tts: bool = False


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


@app.post("/pipeline")
def pipeline_run(body: PipelineRequest) -> dict:
    """Run stages 1-4 synchronously. Slow on first call (5-20 min for Deep
    Research); cached + instant on repeat runs of the same query.

    Does NOT run Stage 4b (stills) or final assembly — use the CLI for that."""
    research = gemini_client.deep_research(body.query)
    transcript = pipeline.analyze_perspectives(research)
    scripts = pipeline.generate_scripts(research, transcript, n=body.n_scripts)
    audio_paths = (
        [str(p) for p in pipeline.synthesize(scripts)] if not body.skip_tts else []
    )
    return {
        "research_id": research["id"],
        "transcript": transcript,
        "scripts": [s.model_dump() for s in scripts],
        "audio_paths": audio_paths,
    }
