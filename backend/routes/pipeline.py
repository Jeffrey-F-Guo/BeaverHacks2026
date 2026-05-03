from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from db.supabase_client import get_supabase
from agent_pipeline.run_pipeline import run_pipeline

router = APIRouter(prefix="/pipeline")


class PipelineRequest(BaseModel):
    topic_id: str


# Triggered by the Supabase webhook on topics INSERT — launches the pipeline as a background task
# and returns 200 immediately so the webhook doesn't time out
@router.post("/start")
async def pipeline_start(payload: PipelineRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_pipeline, payload.topic_id)
    return {"status": "started", "topic_id": payload.topic_id}


# Manual re-trigger for a failed or stuck topic — identical to /start, stages skip if already complete
@router.post("/retry")
async def pipeline_retry(payload: PipelineRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_pipeline, payload.topic_id)
    return {"status": "queued", "topic_id": payload.topic_id}


# Returns the pipeline_status JSONB for a topic — frontend polls this to drive the loading screen
@router.get("/status/{topic_id}")
async def pipeline_status(topic_id: str):
    db = get_supabase()
    result = db.table("topics").select("pipeline_status").eq("id", topic_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Topic not found")
    return result.data["pipeline_status"]
