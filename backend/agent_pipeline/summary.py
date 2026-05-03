"""Stage 2.5 — Debate Summary.

One Gemini Flash call distills the full debate transcript into 3-5 strongest
points per side. Output (DebateSummary) is stored to topics.debate_summary and
consumed by Stage 3 script generation.
"""

from google.genai import types

from db.supabase_client import get_supabase, update_pipeline_status
from gemini_client import client
from models.schemas import DebateSummary

SUMMARY_MODEL = "gemini-3-flash-preview"


def _bullet(items: list[str]) -> str:
    return "\n".join(f"- {x}" for x in items if x) or "(none)"


def _build_prompt(red_claims: list[str], blue_claims: list[str], red_conc: list[str], blue_conc: list[str]) -> str:
    return f"""You are synthesizing a structured 6-round AI debate into the strongest case for each side.

Red (Pole A) key claims across the debate:
{_bullet(red_claims)}

Red concessions to Pole B:
{_bullet(red_conc)}

Blue (Pole B) key claims across the debate:
{_bullet(blue_claims)}

Blue concessions to Pole A:
{_bullet(blue_conc)}

Produce 3-5 of the STRONGEST distinct points for each side. Each point is one sentence, falsifiable, specific. Drop weak / redundant claims. Treat each side at its rhetorical best."""


def run_summary(topic_id: str) -> None:
    db = get_supabase()
    update_pipeline_status(topic_id, "summary", "running")

    try:
        rows = (
            db.table("debate_rounds")
            .select("speaker, key_claim, concession")
            .eq("topic_id", topic_id)
            .order("round_number")
            .execute()
        ).data

        red_claims = [r["key_claim"] for r in rows if r["speaker"] == "red"]
        blue_claims = [r["key_claim"] for r in rows if r["speaker"] == "blue"]
        red_conc = [r["concession"] for r in rows if r["speaker"] == "red" and r["concession"]]
        blue_conc = [r["concession"] for r in rows if r["speaker"] == "blue" and r["concession"]]

        response = client.models.generate_content(
            model=SUMMARY_MODEL,
            contents=_build_prompt(red_claims, blue_claims, red_conc, blue_conc),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DebateSummary,
            ),
        )
        summary = DebateSummary.model_validate_json(response.text)

        db.table("topics").update({
            "debate_summary": summary.model_dump(),
        }).eq("id", topic_id).execute()

        update_pipeline_status(topic_id, "summary", "complete")

    except Exception:
        update_pipeline_status(topic_id, "summary", "failed")
        raise
