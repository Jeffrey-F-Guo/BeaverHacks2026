"""
Smoke test — verifies all Supabase operations needed by the pipeline.
Run with: python smoke_test.py
"""
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "groundtruth")

sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

TOPIC_SLUG = "smoke-test-topic"
DOG_PATH = "../dog.avif"
STORAGE_PATH = "research/smoke-test/dog.avif"


def ok(label: str):
    print(f"  [OK] {label}")


def fail(label: str, err):
    print(f"  [FAIL] {label}: {err}")
    sys.exit(1)


# ── 1. Storage upload ─────────────────────────────────────────────────────────
print("\n[1] Storage upload")
try:
    with open(DOG_PATH, "rb") as f:
        data = f.read()
    sb.storage.from_(BUCKET).upload(STORAGE_PATH, data, {"content-type": "image/avif", "upsert": "true"})
    public_url = sb.storage.from_(BUCKET).get_public_url(STORAGE_PATH)
    ok(f"Uploaded dog.avif → {public_url}")
except Exception as e:
    fail("storage upload", e)


# ── 2. INSERT topic ───────────────────────────────────────────────────────────
print("\n[2] INSERT topic")
try:
    res = sb.table("topics").insert({
        "topic": "Smoke Test Topic",
        "topic_slug": TOPIC_SLUG,
        "pole_a": "Position A",
        "pole_b": "Position B",
    }).execute()
    topic_id = res.data[0]["id"]
    ok(f"Inserted topic id={topic_id}")
except Exception as e:
    fail("insert topic", e)


# ── 3. UPDATE pipeline_status (stage transitions) ────────────────────────────
print("\n[3] UPDATE pipeline_status")
try:
    # Set research → running
    sb.table("topics").update({
        "pipeline_status": {"research": "running", "debate": "pending", "summary": "pending"}
    }).eq("id", topic_id).execute()
    ok("research → running")

    # Set research → complete
    sb.table("topics").update({
        "pipeline_status": {"research": "complete", "debate": "pending", "summary": "pending"}
    }).eq("id", topic_id).execute()
    ok("research → complete")
except Exception as e:
    fail("update pipeline_status", e)


# ── 4. UPDATE research fields ─────────────────────────────────────────────────
print("\n[4] UPDATE research fields")
try:
    sb.table("topics").update({
        "research_raw": "# Raw Research\n\nThis is the raw markdown from the deep research agent.",
        "research_viz_urls": json.dumps([public_url]),
        "research_interaction_id": "mock-interaction-id-abc123",
    }).eq("id", topic_id).execute()
    ok("research_raw, research_viz_urls, research_interaction_id written")
except Exception as e:
    fail("update research fields", e)


# ── 5. UPDATE briefing JSONB ──────────────────────────────────────────────────
print("\n[5] UPDATE briefing")
mock_briefing = {
    "origin": "Historical origin of the issue.",
    "key_players": "Key players and their stances.",
    "case_for_a": "Steelmanned argument for Position A.",
    "case_for_b": "Steelmanned argument for Position B.",
    "consequences": "Real-world consequences of each path.",
    "current_state": "What is at stake today.",
    "persona_red_prompt": "You are Red, a passionate advocate for Position A...",
    "persona_blue_prompt": "You are Blue, a rigorous defender of Position B...",
    "viz_urls": [public_url],
}
try:
    sb.table("topics").update({"briefing": mock_briefing}).eq("id", topic_id).execute()
    ok("briefing JSONB written")
except Exception as e:
    fail("update briefing", e)


# ── 6. INSERT debate_rounds (all 12 turns) ────────────────────────────────────
print("\n[6] INSERT debate_rounds (12 turns)")
try:
    rounds = []
    for r in range(1, 7):
        for speaker, pos in [("red", "A"), ("blue", "B")]:
            rounds.append({
                "topic_id": topic_id,
                "round_number": r,
                "speaker": speaker,
                "argument": f"Round {r} full argument for Position {pos}.",
                "key_claim": f"Round {r} core claim for {pos}.",
                "concession": f"I grant the other side has a point on sub-issue {r}." if r > 1 else None,
                "interaction_id": f"mock-{speaker}-interaction-r{r}",
            })
    sb.table("debate_rounds").insert(rounds).execute()
    ok("12 debate turns inserted")
except Exception as e:
    fail("insert debate_rounds", e)


# ── 7. SELECT debate_rounds (resume logic) ────────────────────────────────────
print("\n[7] SELECT debate_rounds (resume query)")
try:
    res = sb.table("debate_rounds") \
        .select("round_number, speaker, interaction_id") \
        .eq("topic_id", topic_id) \
        .order("round_number") \
        .order("speaker") \
        .execute()
    last = res.data[-1]
    ok(f"Retrieved {len(res.data)} turns — last: round={last['round_number']} speaker={last['speaker']} iid={last['interaction_id']}")

    # Verify resume: find last red and blue interaction_ids
    red_turns = [t for t in res.data if t["speaker"] == "red"]
    blue_turns = [t for t in res.data if t["speaker"] == "blue"]
    last_red_iid = red_turns[-1]["interaction_id"]
    last_blue_iid = blue_turns[-1]["interaction_id"]
    ok(f"Resume IDs — red: {last_red_iid} | blue: {last_blue_iid}")
except Exception as e:
    fail("select debate_rounds", e)


# ── 8. UPDATE debate complete + summary ───────────────────────────────────────
print("\n[8] UPDATE debate complete + summary")
try:
    sb.table("topics").update({
        "pipeline_status": {"research": "complete", "debate": "complete", "summary": "pending"}
    }).eq("id", topic_id).execute()
    ok("debate → complete")

    mock_summary = {
        "side_a_points": ["Point A1", "Point A2", "Point A3"],
        "side_b_points": ["Point B1", "Point B2", "Point B3"],
    }
    sb.table("topics").update({
        "debate_summary": mock_summary,
        "pipeline_status": {"research": "complete", "debate": "complete", "summary": "complete"},
    }).eq("id", topic_id).execute()
    ok("debate_summary written, summary → complete")
except Exception as e:
    fail("update debate complete + summary", e)


# ── 9. GET pipeline_status (what /pipeline/status reads) ─────────────────────
print("\n[9] GET pipeline_status")
try:
    res = sb.table("topics").select("pipeline_status").eq("id", topic_id).single().execute()
    ok(f"pipeline_status: {res.data['pipeline_status']}")
except Exception as e:
    fail("get pipeline_status", e)


# ── 10. Cleanup ───────────────────────────────────────────────────────────────
# print("\n[10] Cleanup")
# try:
#     sb.table("topics").delete().eq("id", topic_id).execute()
#     ok("test topic + debate_rounds deleted (cascade)")
#     sb.storage.from_(BUCKET).remove([STORAGE_PATH])
#     ok("dog.avif removed from storage")
# except Exception as e:
#     fail("cleanup", e)


print("\nAll smoke tests passed.\n")
