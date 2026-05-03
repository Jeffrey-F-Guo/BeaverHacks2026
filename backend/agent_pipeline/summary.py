"""Stage 2.5 — Debate Summary + Facilitator Verdict.

One Gemini Flash call over the full debate transcript:
  - Distills 3-5 strongest points per side (from full argument text + evidence_cited)
  - Acts as a neutral facilitator that selects the prevailing side on evidence

Output (DebateSummary with nested DebateFacilitatorVerdict) stored to
topics.debate_summary and consumed by Stage 3 script generation.

Inspired by TradingAgents: the facilitator "reviews the debate history, selects
the prevailing perspective, and records it as a structured entry."
"""

from google.genai import types

from db.supabase_client import get_supabase, update_pipeline_status
from gemini_client import client
from models.schemas import DebateSummary

SUMMARY_MODEL = "gemini-3-flash-preview"


def _format_turns(rows: list[dict], side: str) -> str:
    """Build a round-numbered full transcript for one side, including evidence."""
    parts: list[str] = []
    for r in rows:
        if r["speaker"] != side:
            continue
        evidence = r.get("evidence_cited") or []
        evidence_block = ""
        if evidence:
            evidence_block = "\n  Evidence cited: " + "; ".join(evidence)
        parts.append(
            f"Round {r['round_number']}: {r['argument']}{evidence_block}"
        )
    return "\n\n".join(parts) or "(no turns)"


def _build_prompt(rows: list[dict]) -> str:
    red_transcript = _format_turns(rows, "red")
    blue_transcript = _format_turns(rows, "blue")
    return f"""You are analyzing a 6-round adversarial AI debate and acting as both a synthesizer and a neutral facilitator.

=== RED SIDE (Pole A) — Full Transcript ===
{red_transcript}

=== BLUE SIDE (Pole B) — Full Transcript ===
{blue_transcript}

Your task has two parts:

PART 1 — SYNTHESIS
Extract the 3-5 strongest distinct points for each side. Each point must be:
- One sentence, falsifiable, and specific (cite the concrete evidence or statistic if available)
- The best version of that side's argument — treat each side at its rhetorical best
- Distinct — do not repeat the same point in different words

PART 2 — FACILITATOR VERDICT
As a neutral facilitator, review the full debate and determine which side made the stronger evidence-based case. Consider:
- Quality and specificity of evidence cited (statistics, precedents, live search results)
- Whether claims were successfully rebutted or left standing
- Strength of closing argument

Return a structured JSON with:
- side_a_points: list of 3-5 strongest points for Red/Pole A
- side_b_points: list of 3-5 strongest points for Blue/Pole B
- facilitator_verdict: {{prevailing_side: "red"|"blue"|"tie", reasoning: "2-3 sentence explanation", decisive_argument: "the single argument that tipped the verdict"}}"""


def run_summary(topic_id: str) -> None:
    db = get_supabase()
    update_pipeline_status(topic_id, "summary", "running")

    try:
        rows = (
            db.table("debate_rounds")
            .select("speaker, round_number, argument, key_claim, concession, evidence_cited")
            .eq("topic_id", topic_id)
            .order("round_number")
            .execute()
        ).data

        response = client.models.generate_content(
            model=SUMMARY_MODEL,
            contents=_build_prompt(rows),
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
