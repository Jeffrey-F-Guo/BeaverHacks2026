from pydantic import BaseModel


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
