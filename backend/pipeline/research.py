import base64
import os
import time

from google import genai
from google.genai import types
from pydantic import BaseModel

from db.supabase_client import get_supabase, upload_image
from models.schemas import Briefing

RESEARCH_AGENT = "deep-research-max-preview-04-2026"
FLASH_MODEL = "gemini-3-flash-preview"
POLL_INTERVAL = 10  # seconds between status checks


# Private schema for the extraction pass — Briefing minus viz_urls,
# which are attached separately after image uploads
class _BriefingExtract(BaseModel):
    origin: str
    key_players: str
    case_for_a: str
    case_for_b: str
    consequences: str
    current_state: str
    persona_red_prompt: str
    persona_blue_prompt: str


# Patches a single stage key in the pipeline_status JSONB field without clobbering other stages
def _update_status(topic_id: str, stage: str, status: str) -> None:
    db = get_supabase()
    result = db.table("topics").select("pipeline_status").eq("id", topic_id).single().execute()
    current: dict = result.data["pipeline_status"]
    current[stage] = status
    db.table("topics").update({"pipeline_status": current}).eq("id", topic_id).execute()


# Builds the prompt sent to the deep research agent — covers all 6 briefing dimensions
def _build_research_prompt(topic: str, pole_a: str, pole_b: str) -> str:
    return f"""You are producing a comprehensive research briefing on a contested social and policy topic.

**Topic:** {topic}
**Position A:** {pole_a}
**Position B:** {pole_b}

Produce a structured research report with these six sections. Each must be thorough, evidence-based, and cite sources inline.

## 1. Origin
The historical background of this issue. When and how did it emerge? What events, technologies, or forces gave rise to it?

## 2. Key Players
Who holds power in this debate? List major stakeholders — governments, corporations, researchers, advocacy groups — and explain what each wants and why. Cover both sides.

## 3. The Case For {pole_a} (Steelmanned)
The strongest possible argument for {pole_a}, argued at full rigor. Include supporting data, precedents, and expert consensus. Do not strawman the opposing view.

## 4. The Case For {pole_b} (Steelmanned)
The strongest possible argument for {pole_b}, argued at full rigor. Include supporting data, precedents, and expert consensus. Do not strawman the opposing view.

## 5. Consequences
What happened where each position was adopted? Cite real-world outcomes — policy experiments, national strategies, corporate decisions — and measurable effects. Contrast diverging paths where possible.

## 6. Current State
What is the live tension today? What specific decisions, legislation, or events are actively contested? What is at stake in the near term?

Include data tables, statistics, and charts where relevant to illustrate key trends. Cite all sources inline."""


# Builds the prompt for the extraction Flash call — asks it to parse the raw report into structured fields
# and generate two debate persona system prompts (one per side)
def _build_extraction_prompt(raw_report: str, topic: str, pole_a: str, pole_b: str) -> str:
    return f"""Extract structured fields from this research report on: {topic}

Positions being debated:
- Position A: {pole_a}
- Position B: {pole_b}

Research Report:
---
{raw_report}
---

Instructions:
- Extract each field from the report. Be comprehensive — preserve key facts, data, and arguments.
- For `persona_red_prompt`: Write a system prompt for an AI debate agent who argues strongly for "{pole_a}". Give them a believable name and professional title. Include the strongest facts and arguments from the report for their side. Tell the agent to stay in character, argue vigorously, and never concede their core position.
- For `persona_blue_prompt`: Same structure, but for an agent arguing strongly for "{pole_b}".

Return JSON matching the provided schema."""


# Full Stage 1 execution: fires the deep research agent, polls until done, uploads any
# generated visualizations to Supabase Storage, then runs a cheap Flash extraction pass
# to parse the raw report into a structured Briefing and generate debate persona prompts
def run_research(topic_id: str, topic: str, topic_slug: str, pole_a: str, pole_b: str) -> None:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    db = get_supabase()

    _update_status(topic_id, "research", "running")

    try:
        # --- Stage 1a: Deep research agent ---
        interaction = client.interactions.create(
            agent=RESEARCH_AGENT,
            input=_build_research_prompt(topic, pole_a, pole_b),
            background=True,  # required for all agent calls
        )

        # Poll every POLL_INTERVAL seconds — deep research typically takes 1-5 minutes
        while True:
            interaction = client.interactions.get(interaction.id)
            if interaction.status == "completed":
                break
            if interaction.status in ("failed", "cancelled"):
                raise RuntimeError(f"Deep research agent {interaction.status}: {getattr(interaction, 'error', '')}")
            time.sleep(POLL_INTERVAL)

        # Walk outputs array — concatenate ALL text blocks (report + sources come as separate outputs),
        # collect image blocks as visualizations
        text_parts: list[str] = []
        viz_urls: list[str] = []

        for i, output in enumerate(interaction.outputs):
            if output.type == "text":
                text_parts.append(output.text)
            elif output.type == "image":
                image_data = getattr(output, "data", None)
                if image_data:
                    image_bytes = base64.b64decode(image_data)
                    url = upload_image(topic_slug, f"viz_{i}.png", image_bytes)
                    viz_urls.append(url)

        raw_markdown = "\n\n".join(text_parts)

        # Persist raw outputs — needed for crash recovery and for the extraction prompt
        db.table("topics").update({
            "research_raw": raw_markdown,
            "research_viz_urls": viz_urls,
            "research_interaction_id": interaction.id,
        }).eq("id", topic_id).execute()

        # --- Stage 1b: Extraction pass (cheap Flash call, structured output) ---
        extraction_response = client.models.generate_content(
            model=FLASH_MODEL,
            contents=_build_extraction_prompt(raw_markdown, topic, pole_a, pole_b),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_BriefingExtract,
            ),
        )

        extracted = _BriefingExtract.model_validate_json(extraction_response.text)

        # Attach viz_urls from storage (extraction call only saw raw markdown, not images)
        briefing = Briefing(
            origin=extracted.origin,
            key_players=extracted.key_players,
            case_for_a=extracted.case_for_a,
            case_for_b=extracted.case_for_b,
            consequences=extracted.consequences,
            current_state=extracted.current_state,
            persona_red_prompt=extracted.persona_red_prompt,
            persona_blue_prompt=extracted.persona_blue_prompt,
            viz_urls=viz_urls,
        )

        db.table("topics").update({
            "briefing": briefing.model_dump(),
        }).eq("id", topic_id).execute()

        _update_status(topic_id, "research", "complete")

    except Exception:
        _update_status(topic_id, "research", "failed")
        raise
