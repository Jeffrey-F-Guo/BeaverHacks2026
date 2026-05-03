from db.supabase_client import get_supabase
from pipeline.research import run_research


# Top-level pipeline orchestrator — fetches the topic row and runs each stage in order,
# skipping any stage already marked "complete" (safe to re-call on retry)
def run_pipeline(topic_id: str) -> None:
    db = get_supabase()
    result = db.table("topics").select("*").eq("id", topic_id).single().execute()
    row = result.data

    status: dict = row["pipeline_status"]
    topic = row["topic"]
    topic_slug = row["topic_slug"]
    pole_a = row["pole_a"] or ""
    pole_b = row["pole_b"] or ""

    if status["research"] != "complete":
        run_research(topic_id, topic, topic_slug, pole_a, pole_b)

    # Stage 2 (debate) and Stage 2.5 (summary) — TODO
