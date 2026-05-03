"""Top-level pipeline orchestrator.

Fetches the topic row and runs each stage in order. Each stage is guarded by
its pipeline_status key so retries skip completed work. Missing keys (older
rows from before stages 3-5 existed) are treated as "pending".
"""

from agent_pipeline.audio import run_audio
from agent_pipeline.debate import run_debate
from agent_pipeline.research import run_research
from agent_pipeline.scripts import run_scripts
from agent_pipeline.summary import run_summary
from agent_pipeline.video import run_video

from db.supabase_client import get_supabase


def run_pipeline(topic_id: str) -> None:
    db = get_supabase()
    row = db.table("topics").select("*").eq("id", topic_id).single().execute().data

    status: dict = row["pipeline_status"]
    topic = row["topic"]
    topic_slug = row["topic_slug"]
    pole_a = row["pole_a"] or ""
    pole_b = row["pole_b"] or ""

    if status.get("research") != "complete":
        run_research(topic_id, topic, topic_slug, pole_a, pole_b)

    if status.get("debate") != "complete":
        run_debate(topic_id)

    if status.get("summary") != "complete":
        run_summary(topic_id)

    if status.get("scripts") != "complete":
        run_scripts(topic_id)

    if status.get("audio") != "complete":
        run_audio(topic_id)

    if status.get("video") != "complete":
        run_video(topic_id)
