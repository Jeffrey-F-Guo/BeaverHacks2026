"""FastAPI surface over the GroundTruth pipeline.

The actual pipeline runs as a background task triggered by a Supabase webhook
(`POST /pipeline/start`); these top-level routes are just a liveness check
and a smoke test for the API key.
"""

# load_dotenv must run BEFORE any module imports that read os.environ
# (gemini_client.py reads GEMINI_API_KEY at import time).
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import gemini_client
from routes.pipeline import router as pipeline_router
from routes.topics import router as topics_router
from routes.votes import router as votes_router

app = FastAPI(title="GroundTruth backend")

# Allow all origins so the frontend (file:// or any port) can call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipeline_router)  # /pipeline/start, /pipeline/retry, /pipeline/status/{topic_id}
app.include_router(topics_router)    # /topics/{topic_id}
app.include_router(votes_router)     # /votes, /votes/{topic_id}/distribution


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "status": "ok"}


@app.get("/gemini/smoke")
def gemini_smoke() -> dict:
    """One cheap Gemini call. Validates the key + SDK plumbing end-to-end."""
    return {"text": gemini_client.smoke()}
