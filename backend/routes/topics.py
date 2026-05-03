from fastapi import APIRouter, HTTPException
from db.supabase_client import get_supabase

router = APIRouter(prefix="/topics")


# Returns all topics — used by the frontend feed to list available topics
@router.get("")
async def list_topics():
    db = get_supabase()
    result = (
        db.table("topics")
        .select("id, topic, pole_a, pole_b, topic_slug, pipeline_status, video_urls, scripts")
        .execute()
    )
    return result.data or []


# Returns the full topic row — frontend fetches this after polling /pipeline/status shows research complete
@router.get("/{topic_id}")
async def get_topic(topic_id: str):
    db = get_supabase()
    result = db.table("topics").select("*").eq("id", topic_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Topic not found")
    return result.data


@router.get("/{topic_id}/rounds")
async def get_debate_rounds(topic_id: str):
    db = get_supabase()
    result = (
        db.table("debate_rounds")
        .select("round_number, speaker, argument, key_claim, concession, evidence_cited, search_queries, search_sources")
        .eq("topic_id", topic_id)
        .order("round_number")
        .order("speaker")
        .execute()
    )
    return result.data
