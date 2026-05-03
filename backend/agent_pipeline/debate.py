"""Stage 2 — Adversarial Debate (background process, not user-facing).

Inspired by TradingAgents (arxiv 2412.20138): agents use live search, quantitative
reasoning, and structured ReAct prompts to build evidence-backed arguments across
6 escalating rounds. Each side maintains its own server-side conversation thread
via previous_interaction_id — only the opponent's latest argument is injected per turn.

Architecture:
- Model: gemini-3.1-pro-preview with thinking enabled
- Tools: google_search + code_execution per turn
- Context: full research_raw + viz images sent once in Turn 1; retained server-side
- Output: 12 rows in debate_rounds (round 1-6 × red/blue), each with argument,
  key_claim, evidence_cited, and logged search queries/sources
"""

import base64
import json
import os
import re

from db.supabase_client import download_bytes, get_supabase, update_pipeline_status
from gemini_client import client
from models.schemas import AgentTurn, Briefing, SearchSource

DEBATE_MODEL = "gemini-3.1-pro-preview"
NUM_ROUNDS = 6
SPEAKERS = ("red", "blue")
OPPONENT = {"red": "blue", "blue": "red"}

# Tools mirror TradingAgents' data-access pattern: google_search for live evidence,
# code_execution for quantitative reasoning (cost comparisons, growth rates, etc.)
DEBATE_TOOLS = [{"type": "google_search"}, {"type": "code_execution"}]

# Thinking enabled — model reasons before responding, producing thought blocks
# in outputs that precede the final structured JSON text block
DEBATE_GENERATION_CONFIG = {"thinking_level": "high"}


# --- Round directives (ReAct-structured per TradingAgents framework) ---
# Each prompt instructs: reason → act (search/compute) → observe → respond.
# Round phases mirror the TradingAgents Bull/Bear deliberation structure.

_ROUND_DIRECTIVES: dict[int, str] = {
    1: (
        "OPENING ARGUMENT — ReAct protocol:\n"
        "1. REASON: What is your core thesis? What are the three strongest claims from the research briefing?\n"
        "2. ACT: Search for the most recent (2025–2026) developments that reinforce your position.\n"
        "3. OBSERVE: What did the search reveal? Does it strengthen or require nuancing your argument?\n"
        "4. RESPOND: Deliver your opening argument. State your thesis, cite 3 specific facts or statistics "
        "(include at least one from your live search), and end with your key_claim in one sentence."
    ),
    2: (
        "EVIDENCE EXCHANGE — ReAct protocol:\n"
        "1. REASON: What is the single most damaging statistic or precedent from the briefing against your opponent?\n"
        "2. ACT: Search to confirm or update that figure with the latest data.\n"
        "3. OBSERVE: Does current evidence support your position more or less than the briefing suggested?\n"
        "4. RESPOND: Present your evidence with precision. Cite the specific number, date, and source. "
        "Show why this data is decisive. List the key facts you used in evidence_cited."
    ),
    3: (
        "DIRECT ATTACK — ReAct protocol:\n"
        "1. REASON: What factual claim in your opponent's last argument is most vulnerable to empirical challenge?\n"
        "2. ACT: Search for counter-evidence that directly contradicts or contextualizes that claim.\n"
        "3. OBSERVE: What did you find? How strong is the counter-evidence?\n"
        "4. RESPOND: Deliver the rebuttal with the precision of cross-examination. Name the specific claim you "
        "are attacking, cite your counter-evidence, and explain why it is fatal to their position."
    ),
    4: (
        "QUANTITATIVE COUNTER — ReAct protocol:\n"
        "1. REASON: What numerical comparison, growth rate, or cost calculation would best defend your position?\n"
        "2. ACT: Use code_execution to compute the relevant figures. Use google_search if you need current data first.\n"
        "3. OBSERVE: What do the numbers show?\n"
        "4. RESPOND: Ground your rebuttal in the computed output. Show your reasoning. Concrete numbers beat "
        "abstract arguments. List every figure you cite in evidence_cited."
    ),
    5: (
        "SYNTHESIS ATTACK — ReAct protocol:\n"
        "1. REASON: What is the single strongest point your opponent has made in this entire debate? "
        "What is its real-world limit or failure mode?\n"
        "2. ACT: Search the Consequences section of the briefing plus live sources for evidence of that failure.\n"
        "3. OBSERVE: Where has this approach actually failed at scale, in practice, or under likely conditions?\n"
        "4. RESPOND: Acknowledge the point honestly — then dismantle it. Explain precisely why it fails in the "
        "conditions most likely to prevail. End with what is truly at stake."
    ),
    6: (
        "CLOSING ARGUMENT — ReAct protocol:\n"
        "1. REASON: What three arguments from this debate most decisively support your position?\n"
        "2. ACT: No search needed — draw from the evidence you have established across rounds 1-5.\n"
        "3. OBSERVE: What has this debate proven that was not obvious at the start?\n"
        "4. RESPOND: Deliver your closing statement. Synthesize your three strongest points into a cohesive "
        "policy prescription. Explain precisely what decision-makers should do, why the evidence compels it, "
        "and what irreversible harm follows from choosing your opponent's path. Make it memorable."
    ),
}


# Appended to every system instruction because response_mime_type + response_format
# are not reliably enforced when thinking_level="high" and tools are active together.
_JSON_OUTPUT_INSTRUCTION = """

--- OUTPUT Format (MANDATORY) ---
Your ENTIRE response must be one valid JSON object. No markdown fences, no preamble, no text outside the braces.
Schema:
{
  "speaker": "<red or blue>",
  "argument": "<your full argument as plain prose — no JSON special characters unescaped>",
  "key_claim": "<one sentence: your single most important point this round>",
  "concession": "<one sentence granting a point to your opponent, or null>",
  "evidence_cited": ["<specific stat, figure, or fact you used>", ...]
}"""


def _system_instruction(briefing: Briefing, side: str) -> str:
    # Persona + mandatory JSON output format. Re-specified every turn
    # (interaction-scoped). Full research context passed once in Turn 1.
    persona = briefing.persona_red_prompt if side == "red" else briefing.persona_blue_prompt
    return persona + _JSON_OUTPUT_INSTRUCTION


def _storage_path_from_url(public_url: str) -> str:
    """Extract the storage path from a Supabase public URL.
    Format: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
    """
    bucket = os.environ["SUPABASE_STORAGE_BUCKET"]
    marker = f"/object/public/{bucket}/"
    idx = public_url.find(marker)
    if idx == -1:
        raise ValueError(f"Cannot parse storage path from URL: {public_url}")
    return public_url[idx + len(marker):]


def _build_first_turn_input(briefing: Briefing, research_raw: str, side: str) -> list[dict]:
    """Multimodal first-turn payload: full research markdown + viz images + Round 1 directive.

    Sent once per agent thread. The server retains this via previous_interaction_id so
    subsequent turns only need the opponent's argument — not the full context again.
    """
    parts: list[dict] = []

    # Full research report — the agent's sole factual foundation
    parts.append({
        "type": "text",
        "text": (
            "Below is the complete research briefing you must draw from throughout this debate. "
            "Do not invent statistics or events not present here or found via live search.\n\n"
            "--- FULL RESEARCH BRIEFING ---\n\n"
            f"{research_raw}\n\n"
            "--- END BRIEFING ---"
        ),
    })

    # Visualization images — embedded inline so the agent can reason over charts
    for url in briefing.viz_urls:
        try:
            path = _storage_path_from_url(url)
            img_bytes = download_bytes(path)
            parts.append({
                "type": "image",
                "data": base64.b64encode(img_bytes).decode("utf-8"),
                "mime_type": "image/png",
            })
        except Exception as exc:
            # Non-fatal: fall back to a text reference if download fails
            parts.append({"type": "text", "text": f"[Visualization: {url}]"})
            print(f"[debate] viz download failed for {url}: {exc}")

    # Round 1 directive
    parts.append({"type": "text", "text": _round_prompt(1, side, None)})
    return parts


def _round_prompt(round_number: int, side: str, opponent_argument: str | None) -> str:
    """Builds the user-turn prompt for a given round, following the ReAct framework."""
    directive = _ROUND_DIRECTIVES[round_number]
    if round_number == 1 or not opponent_argument:
        return directive
    return (
        f"Your opponent's last argument:\n\n"
        f"\"{opponent_argument}\"\n\n"
        f"--- YOUR INSTRUCTION FOR ROUND {round_number} ---\n"
        f"{directive}"
    )


def _extract_json(text: str) -> str:
    """Extract the first valid JSON object from text.

    Handles three cases that arise with thinking models:
    1. Clean JSON — returned as-is.
    2. Markdown code fence wrapping — stripped then parsed.
    3. Preamble before the opening brace — raw_decode from first '{' ignores
       both leading preamble and trailing content, which the greedy regex
       approach cannot do reliably when the JSON contains nested braces.
    """
    text = text.strip()
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    # Strip ```json ... ``` fences if present
    fenced = re.sub(r"^```(?:json)?\s*", "", text)
    fenced = re.sub(r"\s*```$", "", fenced).strip()
    try:
        json.loads(fenced)
        return fenced
    except json.JSONDecodeError:
        pass

    # Scan forward to the first '{' and let the stdlib decoder handle the rest.
    # raw_decode stops at the end of the first complete JSON value, ignoring
    # any trailing text — far more robust than a greedy regex over nested braces.
    start = text.find("{")
    if start != -1:
        try:
            obj, _ = json.JSONDecoder().raw_decode(text, start)
            return json.dumps(obj)
        except json.JSONDecodeError:
            pass

    print(f"[debate] _extract_json failed. Full output ({len(text)} chars):\n{text[:2000]}")
    raise ValueError(f"No JSON object found in model output: {text[:300]}")


def _extract_search_evidence(outputs: list) -> tuple[list[str], list[dict]]:
    """Walk interaction.outputs and collect google_search queries and result sources."""
    queries: list[str] = []
    sources: list[dict] = []
    for output in outputs:
        if output.type == "google_search_call":
            qs = getattr(output, "queries", None) or []
            queries.extend(qs)
        elif output.type == "google_search_result":
            result_list = getattr(output, "result", None) or []
            for r in result_list:
                url = getattr(r, "url", None) or (r.get("url", "") if isinstance(r, dict) else "")
                title = getattr(r, "title", None) or (r.get("title", "") if isinstance(r, dict) else "")
                if url:
                    sources.append({"url": url, "title": title})
    return queries, sources


def _run_turn(
    system_instruction: str,
    user_input: str | list,
    previous_interaction_id: str | None,
) -> tuple[AgentTurn, str, list[str], list[dict]]:
    """Execute one debate turn. Returns (AgentTurn, interaction_id, queries, sources).

    Uses reversed scan over outputs to find the last text block — thinking models
    emit thought blocks before the final structured JSON, so outputs[-1] is not
    guaranteed to be the text output.
    """
    interaction = client.interactions.create(
        model=DEBATE_MODEL,
        input=user_input,
        system_instruction=system_instruction,
        previous_interaction_id=previous_interaction_id,
        tools=DEBATE_TOOLS,
        generation_config=DEBATE_GENERATION_CONFIG,
    )

    raw_json = next(
        (o.text for o in reversed(interaction.outputs) if o.type == "text"),
        None,
    )
    if raw_json is None:
        types_seen = [o.type for o in interaction.outputs]
        raise RuntimeError(f"No text output in interaction {interaction.id}. Output types: {types_seen}")

    turn = AgentTurn.model_validate_json(_extract_json(raw_json))
    queries, sources = _extract_search_evidence(interaction.outputs)
    return turn, interaction.id, queries, sources


def _resume_state(topic_id: str) -> tuple[dict, dict, set]:
    """Load existing debate_rounds to support crash recovery.

    Returns:
        last_iid: last interaction_id per speaker (for previous_interaction_id)
        last_arg: last argument per speaker (for opponent injection)
        completed: set of (round_number, speaker) already saved
    """
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


def _save_turn(
    topic_id: str,
    round_number: int,
    speaker: str,
    turn: AgentTurn,
    interaction_id: str,
    search_queries: list[str],
    search_sources: list[dict],
) -> None:
    """Write one turn to debate_rounds immediately after the API call returns.

    Never batched — this is the crash recovery mechanism. A restart can resume
    from the last saved (round_number, speaker) pair.
    """
    get_supabase().table("debate_rounds").insert({
        "topic_id": topic_id,
        "round_number": round_number,
        "speaker": speaker,
        "argument": turn.argument,
        "key_claim": turn.key_claim,
        "concession": turn.concession,
        "evidence_cited": turn.evidence_cited,
        "interaction_id": interaction_id,
        "search_queries": search_queries,
        "search_sources": search_sources,
    }).execute()


def run_debate(topic_id: str) -> None:
    """Stage 2: 6 rounds × 2 sides = 12 turns. Idempotent — skips completed turns."""
    db = get_supabase()
    row = (
        db.table("topics")
        .select("briefing, research_raw")
        .eq("id", topic_id)
        .single()
        .execute()
    ).data
    briefing = Briefing(**row["briefing"])
    research_raw = row.get("research_raw") or ""

    update_pipeline_status(topic_id, "debate", "running")
    try:
        system_instructions = {side: _system_instruction(briefing, side) for side in SPEAKERS}
        last_iid, last_arg, completed = _resume_state(topic_id)

        for round_number in range(1, NUM_ROUNDS + 1):
            for side in SPEAKERS:
                if (round_number, side) in completed:
                    continue

                opp_arg = last_arg[OPPONENT[side]]

                if round_number == 1 and last_iid[side] is None:
                    # First turn: send full multimodal context (research + images + directive)
                    user_input = _build_first_turn_input(briefing, research_raw, side)
                else:
                    # Subsequent turns: lean prompt only — server retains context
                    user_input = _round_prompt(round_number, side, opp_arg)

                print(f"[debate] round {round_number} {side}")
                turn, iid, queries, sources = _run_turn(
                    system_instructions[side], user_input, last_iid[side]
                )
                turn.speaker = side  # force label — model occasionally echoes wrong speaker
                _save_turn(topic_id, round_number, side, turn, iid, queries, sources)
                last_iid[side] = iid
                last_arg[side] = turn.argument

        update_pipeline_status(topic_id, "debate", "complete")

    except Exception:
        update_pipeline_status(topic_id, "debate", "failed")
        raise
