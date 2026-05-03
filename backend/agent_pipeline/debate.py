"""Stage 2 — Adversarial Debate.

Two stateful Gemini Flash sessions (Red argues Pole A, Blue argues Pole B) for
6 rounds. Each side keeps its own conversation thread server-side via
previous_interaction_id; only the opponent's latest argument is injected each
turn. Every turn is written to `debate_rounds` immediately so the pipeline can
resume from any failure point.
"""

from db.supabase_client import get_supabase, update_pipeline_status
from gemini_client import client
from models.schemas import AgentTurn, Briefing

DEBATE_MODEL = "gemini-3-flash-preview"
NUM_ROUNDS = 6
SPEAKERS = ("red", "blue")  # Red speaks first each round
OPPONENT = {"red": "blue", "blue": "red"}


def _briefing_context(briefing: Briefing) -> str:
    """Full briefing text appended to the persona system prompt — grounds the
    debate in the research, not the model's priors."""
    viz_block = (
        "\n\nVisualizations (Supabase URLs you may reference verbally):\n"
        + "\n".join(f"- {u}" for u in briefing.viz_urls)
        if briefing.viz_urls
        else ""
    )
    return f"""

--- RESEARCH BRIEFING (your sole source of factual grounding) ---

# Origin
{briefing.origin}

# Key Players
{briefing.key_players}

# Case for Pole A
{briefing.case_for_a}

# Case for Pole B
{briefing.case_for_b}

# Consequences
{briefing.consequences}

# Current State
{briefing.current_state}{viz_block}
--- END BRIEFING ---"""


def _system_instruction(briefing: Briefing, side: str) -> str:
    persona = briefing.persona_red_prompt if side == "red" else briefing.persona_blue_prompt
    return persona + _briefing_context(briefing)


def _opening_prompt() -> str:
    return (
        "Open the debate. Make your strongest opening argument. "
        "Stay in character. End with a single-sentence key_claim."
    )


def _rebuttal_prompt(opponent_argument: str) -> str:
    return (
        "Your opponent just argued:\n\n"
        f'"{opponent_argument}"\n\n'
        "Rebut directly. Stay in character. Cite specifics from the briefing where it strengthens you."
    )


def _resume_state(topic_id: str) -> tuple[dict[str, str | None], dict[str, str | None], set[tuple[int, str]]]:
    """Returns last-interaction-id-per-side, last-argument-per-side, set of
    completed (round, speaker) so we skip already-saved turns on retry."""
    rows = (
        get_supabase()
        .table("debate_rounds")
        .select("round_number, speaker, argument, interaction_id")
        .eq("topic_id", topic_id)
        .order("round_number")
        .order("speaker")
        .execute()
    ).data
    last_iid: dict[str, str | None] = {"red": None, "blue": None}
    last_arg: dict[str, str | None] = {"red": None, "blue": None}
    completed: set[tuple[int, str]] = set()
    for r in rows:
        completed.add((r["round_number"], r["speaker"]))
        last_iid[r["speaker"]] = r["interaction_id"]
        last_arg[r["speaker"]] = r["argument"]
    return last_iid, last_arg, completed


def _save_turn(topic_id: str, round_number: int, speaker: str, turn: AgentTurn, interaction_id: str) -> None:
    """Single-row insert — happens after every API call so a crash mid-debate loses at most one turn."""
    get_supabase().table("debate_rounds").insert({
        "topic_id": topic_id,
        "round_number": round_number,
        "speaker": speaker,
        "argument": turn.argument,
        "key_claim": turn.key_claim,
        "concession": turn.concession,
        "interaction_id": interaction_id,
    }).execute()


def _run_turn(system_instruction: str, user_input: str, previous_interaction_id: str | None) -> tuple[AgentTurn, str]:
    # Interactions API: response_format is the JSON schema directly (NOT
    # OpenAI's wrapped {"type": "json_schema", ...} shape), and
    # response_mime_type must be set alongside it. Don't put either in
    # generation_config — that's the client.models.generate_content idiom.
    interaction = client.interactions.create(
        model=DEBATE_MODEL,
        input=user_input,
        system_instruction=system_instruction,
        previous_interaction_id=previous_interaction_id,
        response_mime_type="application/json",
        response_format=AgentTurn.model_json_schema(),
    )
    raw = interaction.outputs[-1].text
    return AgentTurn.model_validate_json(raw), interaction.id


def run_debate(topic_id: str) -> None:
    """Stage 2: 6 rounds × 2 sides = 12 turns into debate_rounds. Idempotent."""
    db = get_supabase()
    row = db.table("topics").select("briefing").eq("id", topic_id).single().execute().data
    briefing = Briefing(**row["briefing"])

    update_pipeline_status(topic_id, "debate", "running")
    try:
        system_instructions = {side: _system_instruction(briefing, side) for side in SPEAKERS}
        last_iid, last_arg, completed = _resume_state(topic_id)

        for round_number in range(1, NUM_ROUNDS + 1):
            for side in SPEAKERS:
                if (round_number, side) in completed:
                    continue
                # Round 1 Red has no opponent yet; everyone else rebuts.
                if round_number == 1 and side == "red":
                    user_input = _opening_prompt()
                else:
                    opp_arg = last_arg[OPPONENT[side]]
                    user_input = _opening_prompt() if not opp_arg else _rebuttal_prompt(opp_arg)

                print(f"[debate] round {round_number} {side}")
                turn, iid = _run_turn(system_instructions[side], user_input, last_iid[side])
                turn.speaker = side  # Force label — model sometimes echoes the wrong one.
                _save_turn(topic_id, round_number, side, turn, iid)
                last_iid[side] = iid
                last_arg[side] = turn.argument

        update_pipeline_status(topic_id, "debate", "complete")

    except Exception:
        update_pipeline_status(topic_id, "debate", "failed")
        raise
