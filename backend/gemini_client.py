"""Gemini SDK client + Stage 1 (Deep Research) + disk cache."""

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any, Callable, TypedDict

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

CACHE_DIR = Path(__file__).parent / ".cache"
CACHE_DIR.mkdir(exist_ok=True)

SMOKE_MODEL = "gemini-2.5-flash"
DEEP_RESEARCH_AGENT = "deep-research-preview-04-2026"

TERMINAL_STATUSES = {"completed", "failed", "cancelled"}


class ResearchStatus(TypedDict):
    id: str
    status: str  # API returns "in_progress" while running, plus the terminal set above
    output: str | None


def cached_json(key: str, fn: Callable[[], dict]) -> dict:
    """Memoize a dict-returning fn to .cache/{sha256(key)[:16]}.json."""
    path = CACHE_DIR / f"{hashlib.sha256(key.encode()).hexdigest()[:16]}.json"
    if path.exists():
        return json.loads(path.read_text())
    result = fn()
    path.write_text(json.dumps(result, indent=2))
    return result


def smoke() -> str:
    """One cheap call to validate the API key + SDK plumbing."""
    interaction = client.interactions.create(
        model=SMOKE_MODEL,
        input="Reply with exactly one word: pong.",
    )
    return interaction.outputs[-1].text


def start_research(query: str, agent: str = DEEP_RESEARCH_AGENT) -> str:
    """Kick off a background Deep Research task; returns the interaction id."""
    interaction = client.interactions.create(
        input=query,
        agent=agent,
        background=True,
    )
    return interaction.id


def get_research(op_id: str) -> ResearchStatus:
    """Non-blocking status check on a Deep Research interaction."""
    interaction = client.interactions.get(id=op_id)
    output = None
    if interaction.status == "completed" and interaction.outputs:
        output = interaction.outputs[-1].text
    return {"id": op_id, "status": interaction.status, "output": output}


def poll_research(
    op_id: str,
    interval_s: int = 15,
    timeout_s: int = 1500,
    on_tick: Callable[[ResearchStatus, int], None] | None = None,
) -> ResearchStatus:
    """Block until the Deep Research task reaches a terminal state or timeout."""
    deadline = time.monotonic() + timeout_s
    start = time.monotonic()
    while True:
        result = get_research(op_id)
        if on_tick:
            on_tick(result, int(time.monotonic() - start))
        if result["status"] in TERMINAL_STATUSES:
            return result
        if time.monotonic() >= deadline:
            return result
        time.sleep(interval_s)


def deep_research(
    query: str,
    agent: str = DEEP_RESEARCH_AGENT,
    use_cache: bool = True,
    verbose: bool = True,
) -> dict[str, Any]:
    """Stage 1: kick off Deep Research, poll to completion, cache the result."""

    def _run() -> dict[str, Any]:
        if verbose:
            print(f"[research] starting ({agent}): {query[:80]}")
        op_id = start_research(query, agent=agent)
        if verbose:
            print(f"[research] op_id={op_id}")

        def tick(result: ResearchStatus, elapsed: int) -> None:
            if verbose:
                print(f"[research] {elapsed:>4}s status={result['status']}")

        final = poll_research(op_id, on_tick=tick if verbose else None)
        if final["status"] != "completed":
            raise RuntimeError(f"Deep Research ended with status: {final['status']}")
        return {
            "id": final["id"],
            "agent": agent,
            "query": query,
            "text": final["output"],
        }

    if not use_cache:
        return _run()
    return cached_json(f"research:{agent}:{query}", _run)
