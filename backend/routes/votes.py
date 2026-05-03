"""POST /votes  +  GET /votes/{topic_id}/distribution.

Spectrum vote (float 0.0..1.0) + histogram. Anonymous — anyone can submit.
RLS allows public insert + read on the votes table. Frontend can subscribe to
realtime changes for the live counter wow moment.
"""

from fastapi import APIRouter, HTTPException

from db.supabase_client import get_supabase
from models.schemas import VoteDistribution, VoteRequest

router = APIRouter(prefix="/votes")

NUM_BUCKETS = 20


def _distribution(topic_id: str) -> VoteDistribution:
    rows = (
        get_supabase()
        .table("votes")
        .select("position")
        .eq("topic_id", topic_id)
        .execute()
    ).data
    positions = [r["position"] for r in rows]
    histogram = [0] * NUM_BUCKETS
    for p in positions:
        # Clamp p == 1.0 into the last bucket instead of overflowing.
        idx = min(int(p * NUM_BUCKETS), NUM_BUCKETS - 1)
        histogram[idx] += 1
    mean = (sum(positions) / len(positions)) if positions else None
    return VoteDistribution(
        topic_id=topic_id, total=len(positions), histogram=histogram, mean=mean
    )


@router.post("")
def submit_vote(payload: VoteRequest) -> VoteDistribution:
    """Insert one vote, return the updated distribution so the client can
    immediately render the post-vote consensus view."""
    db = get_supabase()
    topic = db.table("topics").select("id").eq("id", payload.topic_id).execute().data
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.table("votes").insert({
        "topic_id": payload.topic_id,
        "position": payload.position,
    }).execute()
    return _distribution(payload.topic_id)


@router.get("/{topic_id}/distribution")
def get_distribution(topic_id: str) -> VoteDistribution:
    return _distribution(topic_id)
