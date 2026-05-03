"""Stage 3 — Script generation.

One Gemini Flash call with structured output produces 6 ShortScript records,
one per fixed role (origin, key_players, case_for_a, case_for_b, consequences,
where_we_stand). Saved to topics.scripts (JSONB).
"""

from typing import get_args

from google.genai import types

from db.supabase_client import get_supabase, update_pipeline_status
from gemini_client import client
from models.schemas import Briefing, DebateSummary, ShortRole, ShortScriptSet

SCRIPT_MODEL = "gemini-3-flash-preview"

# Voice mapping per role. Persona-coded for the two "case for" videos so the
# advocate is implicitly characterized; neutral voices for narration roles.
VOICE_BY_ROLE: dict[str, str] = {
    "origin": "Charon",
    "key_players": "Charon",
    "case_for_a": "Puck",
    "case_for_b": "Charon",
    "consequences": "Charon",
    "where_we_stand": "Aoede",
}

ROLE_GUIDE: dict[str, str] = {
    "origin": "Where this issue came from. Historical arc — when, how, what events made it matter.",
    "key_players": "Who holds power in this debate today and what each side wants.",
    "case_for_a": "The strongest steelmanned case for Pole A, told from inside that worldview.",
    "case_for_b": "The strongest steelmanned case for Pole B, told from inside that worldview.",
    "consequences": "What's actually happened where each path was taken — real-world outcomes, evidence.",
    "where_we_stand": "What's at stake right now. The live tension. Why the viewer should care today.",
}


def _build_prompt(
    topic: str,
    pole_a: str,
    pole_b: str,
    briefing: Briefing,
    summary: DebateSummary,
) -> str:
    role_block = "\n".join(f"  - {r}: {ROLE_GUIDE[r]}" for r in get_args(ShortRole))
    side_a = "\n".join(f"  - {p}" for p in summary.side_a_points) or "  (none)"
    side_b = "\n".join(f"  - {p}" for p in summary.side_b_points) or "  (none)"
    return f"""You are writing 6 short-form vertical-video reels (~25 seconds each) on a contested topic. The full series is the educational arc that unlocks the user's vote. Each reel stands alone but they read in order.

**Topic:** {topic}
**Pole A:** {pole_a}
**Pole B:** {pole_b}

Generate exactly 6 ShortScript objects, one per role IN THIS ORDER (use the literal `role` value as listed):
{role_block}

Hard rules per script:
- `headline` ≤ 12 words. Punchy, on-screen text overlay shown at the top.
- `narration` ~60 words / under 400 characters TOTAL. ~25-30 seconds when spoken aloud. NO citations like "(Source 7)" — they don't read.
- `image_prompts` is exactly 4 vertical 9:16 portrait scene descriptions for ken-burns stills. Each is 1-2 sentences, fully visual, NO wide / panoramic / landscape shots, NO on-screen text. Lead each prompt with a consistent aesthetic preamble: "VERTICAL 9:16 PORTRAIT, cinematic, no text overlays".
- For `case_for_a` and `case_for_b`: write narration FROM INSIDE that worldview, in the voice of an advocate. Don't hedge.
- For all other roles: neutral, documentary tone. No editorial.
- `voice` MUST be exactly: origin/key_players/consequences="Charon", case_for_a="Puck", case_for_b="Charon", where_we_stand="Aoede".
- `title` is the human-readable section name (e.g. "Origin", "The Case For Acceleration").

--- BRIEFING ---
# Origin
{briefing.origin}

# Key Players
{briefing.key_players}

# Case for {pole_a}
{briefing.case_for_a}

# Case for {pole_b}
{briefing.case_for_b}

# Consequences
{briefing.consequences}

# Current State
{briefing.current_state}

--- DEBATE SUMMARY ({pole_a} side) ---
{side_a}

--- DEBATE SUMMARY ({pole_b} side) ---
{side_b}
"""


def run_scripts(topic_id: str) -> None:
    """Stage 3: read briefing + summary → 6 ShortScript objects → topics.scripts."""
    db = get_supabase()
    row = (
        db.table("topics")
        .select("topic, pole_a, pole_b, briefing, debate_summary")
        .eq("id", topic_id)
        .single()
        .execute()
    ).data

    briefing = Briefing(**row["briefing"])
    summary = DebateSummary(**row["debate_summary"])

    update_pipeline_status(topic_id, "scripts", "running")
    try:
        prompt = _build_prompt(row["topic"], row["pole_a"] or "", row["pole_b"] or "", briefing, summary)
        print(f"[scripts] generating 6 scripts with {SCRIPT_MODEL}")
        response = client.models.generate_content(
            model=SCRIPT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ShortScriptSet,
            ),
        )
        parsed = ShortScriptSet.model_validate_json(response.text)

        # Defensive: enforce voice mapping in case the model strayed.
        for s in parsed.scripts:
            s.voice = VOICE_BY_ROLE[s.role]

        db.table("topics").update({
            "scripts": parsed.model_dump()["scripts"],
        }).eq("id", topic_id).execute()

        update_pipeline_status(topic_id, "scripts", "complete")

    except Exception:
        update_pipeline_status(topic_id, "scripts", "failed")
        raise
