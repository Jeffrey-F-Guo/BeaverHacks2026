from typing import Literal

from pydantic import BaseModel, Field


# Structured research output stored to topics.briefing after Stage 1
class Briefing(BaseModel):
    origin: str           # historical background of the issue
    key_players: str      # major stakeholders on both sides
    case_for_a: str       # steelmanned argument for Pole A
    case_for_b: str       # steelmanned argument for Pole B
    consequences: str     # real-world outcomes where each path was taken
    current_state: str    # live tensions and what is at stake today
    persona_red_prompt: str   # system prompt for the Red debate agent (argues Pole A)
    persona_blue_prompt: str  # system prompt for the Blue debate agent (argues Pole B)
    viz_urls: list[str]   # Supabase Storage URLs for research visualizations


# One turn in the adversarial debate — stored to debate_rounds after each API call
class AgentTurn(BaseModel):
    speaker: str          # "red" | "blue"
    argument: str         # full natural language argument
    key_claim: str        # single sentence — the core point of this turn
    concession: str | None = None  # what this agent grants the other side, if anything


# Synthesis of the full debate transcript — stored to topics.debate_summary after Stage 2.5
class DebateSummary(BaseModel):
    side_a_points: list[str]  # 3-5 strongest points for Pole A
    side_b_points: list[str]  # 3-5 strongest points for Pole B


# --- Stage 3 short scripts (6 fixed roles per topic) ---------------------

ShortRole = Literal[
    "origin",          # Short 1 — Where did this come from?
    "key_players",     # Short 2 — Who holds power?
    "case_for_a",      # Short 3 — The Case For Pole A
    "case_for_b",      # Short 4 — The Case For Pole B
    "consequences",    # Short 5 — Real-world outcomes
    "where_we_stand",  # Short 6 — Live tension, what's at stake
]


class ShortScript(BaseModel):
    role: ShortRole
    title: str        # human-readable section title for on-screen heading
    headline: str     # punchy 1-sentence text overlay shown at the top
    narration: str    # ~70 words → ~25-30s TTS, fits MAX_NARRATION_CHARS=450
    image_prompts: list[str]  # 4 vertical 9:16 prompts for ken-burns stills
    voice: str        # prebuilt Gemini voice name; varies by role


class ShortScriptSet(BaseModel):
    """Wrapper used as response_schema for Stage 3 — one Flash call returns all 6."""
    scripts: list[ShortScript] = Field(min_length=6, max_length=6)


# --- Stage 6 votes -------------------------------------------------------


class VoteRequest(BaseModel):
    topic_id: str
    position: float = Field(ge=0.0, le=1.0)  # 0 = full Pole A, 1 = full Pole B


class VoteDistribution(BaseModel):
    topic_id: str
    total: int
    histogram: list[int]  # 20 buckets evenly spanning 0.0..1.0
    mean: float | None    # None when total == 0
