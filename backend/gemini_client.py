"""Gemini SDK wrapper: client init, smoke test, Deep Research polling."""

import os
import time
from typing import Literal, TypedDict

from dotenv import load_dotenv
from google import genai

load_dotenv()

_api_key = os.environ.get("GEMINI_API_KEY")
if not _api_key:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Copy .env.example to .env "
        "and paste your key from https://aistudio.google.com/apikey."
    )

client = genai.Client(api_key=_api_key)

SMOKE_MODEL = "gemini-2.5-flash"
DEEP_RESEARCH_AGENT = "deep-research-preview-04-2026"

TERMINAL_STATUSES = {"completed", "failed", "cancelled"}
Status = Literal["pending", "running", "completed", "failed", "cancelled"]


class ResearchStatus(TypedDict):
    id: str
    status: Status
    output: str | None


def smoke() -> str:
    interaction = client.interactions.create(
        model=SMOKE_MODEL,
        input="Reply with exactly one word: pong.",
    )
    return interaction.outputs[-1].text


def start_research(query: str) -> str:
    interaction = client.interactions.create(
        input=query,
        agent=DEEP_RESEARCH_AGENT,
        background=True,
    )
    return interaction.id


def get_research(op_id: str) -> ResearchStatus:
    interaction = client.interactions.get(id=op_id)
    output = None
    if interaction.status == "completed" and interaction.outputs:
        output = interaction.outputs[-1].text
    return {"id": op_id, "status": interaction.status, "output": output}


def poll_research(
    op_id: str,
    interval_s: int = 15,
    timeout_s: int = 1500,
) -> ResearchStatus:
    deadline = time.monotonic() + timeout_s
    while True:
        result = get_research(op_id)
        if result["status"] in TERMINAL_STATUSES:
            return result
        if time.monotonic() >= deadline:
            return result
        time.sleep(interval_s)


def run_research(query: str, **poll_kwargs) -> ResearchStatus:
    return poll_research(start_research(query), **poll_kwargs)
