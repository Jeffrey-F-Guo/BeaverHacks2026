import os
import uuid
import json
import queue
import asyncio
import threading
from typing import AsyncIterator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from pydantic import BaseModel
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.5-flash")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store ───────────────────────────────────────────────────

sessions: dict[str, "DebateSession"] = {}
session_pause_events: dict[str, asyncio.Event] = {}

# ── Pydantic models ───────────────────────────────────────────────────────────

class AgentPersona(BaseModel):
    name: str
    side: str               # "pro" | "con"
    stance: str
    key_arguments: list[str]

class DebateTurn(BaseModel):
    agent_name: str
    side: str
    content: str
    is_interrupt_ack: bool = False

class DebateSession(BaseModel):
    session_id: str
    topic: str
    agents: list[AgentPersona]
    total_turns: int
    debate_history: list[DebateTurn] = []
    status: str = "active"          # "active" | "completed"
    interrupt_queue: list[str] = []

class GenerateSetupRequest(BaseModel):
    topic: str

class GenerateSetupResponse(BaseModel):
    topic: str
    agents: list[AgentPersona]

class StartDebateRequest(BaseModel):
    topic: str
    agents: list[AgentPersona]
    total_turns: int = 6

class StartDebateResponse(BaseModel):
    session_id: str
    topic: str
    agents: list[AgentPersona]
    total_turns: int

class InterruptRequest(BaseModel):
    comment: str

class InterruptResponse(BaseModel):
    status: str

# ── Prompt templates ──────────────────────────────────────────────────────────

SETUP_PROMPT = """You are a debate system designer. Given the following AI ethics topic, generate exactly 2 debate agent personas.

Topic: {topic}

Return a JSON object with this exact structure (no markdown, no explanation, just raw JSON):
{{
  "agents": [
    {{
      "name": "<creative debater name>",
      "side": "pro",
      "stance": "<one sentence describing their pro position on the topic>",
      "key_arguments": ["<argument 1>", "<argument 2>", "<argument 3>"]
    }},
    {{
      "name": "<creative debater name>",
      "side": "con",
      "stance": "<one sentence describing their con position on the topic>",
      "key_arguments": ["<argument 1>", "<argument 2>", "<argument 3>"]
    }}
  ]
}}

Rules:
- Each stance must directly address the topic, not be generic
- Each agent must have exactly 3 key arguments
- Agents must be genuinely adversarial"""

# ── Helper functions ──────────────────────────────────────────────────────────

def format_sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def build_turn_prompt(agent: AgentPersona, session: DebateSession) -> str:
    history_text = "\n\n".join(
        f"[{t.agent_name} ({t.side})]: {t.content}"
        for t in session.debate_history
    ) or "No prior arguments yet."

    last_opponent_turn = next(
        (t for t in reversed(session.debate_history)
         if t.agent_name != agent.name and not t.is_interrupt_ack),
        None,
    )
    last_opponent_text = (
        last_opponent_turn.content if last_opponent_turn else "This is the opening argument."
    )

    return (
        f'You are {agent.name}, someone who knows a lot about this topic and genuinely believes '
        f'the {agent.side.upper()} side on: "{session.topic}".\n\n'
        f"Your take: {agent.stance}\n\n"
        f"Things you care about in this conversation:\n"
        + "\n".join(f"- {arg}" for arg in agent.key_arguments)
        + f"\n\nConversation so far:\n{history_text}\n\n"
        f"What your opponent just said:\n{last_opponent_text}\n\n"
        f"Respond naturally — like you're actually talking to this person, not giving a speech. "
        f"Important: do NOT repeat or rephrase points you've already made — check the history above. "
        f"If your opponent just made a fair point, briefly admit it, then pivot to a NEW angle you haven't covered yet. "
        f"Call out something specific they said and advance to fresh ground. If a question comes naturally, ask it — but don't force one. "
        f"Keep it to 2-3 sentences. Casual and direct is better than formal and impressive."
    )


async def generate_interrupt_ack(agent: AgentPersona, comment: str, session: DebateSession) -> str:
    prompt = (
        f'You are {agent.name}, mid-conversation about: "{session.topic}".\n\n'
        f'Someone just jumped in with this:\n"{comment}"\n\n'
        f"Respond naturally in 1-2 sentences — like someone actually interrupted you mid-thought. "
        f"Acknowledge it briefly and casually, then get back to the conversation."
    )
    response = await asyncio.to_thread(model.generate_content, prompt)
    return response.text.strip()


def _stream_to_queue(prompt: str, q: queue.Queue) -> None:
    try:
        for chunk in model.generate_content(prompt, stream=True):
            q.put(chunk.text or "")
        q.put(None)  # sentinel
    except Exception as exc:
        q.put(exc)


async def yield_gemini_stream(prompt: str) -> AsyncIterator[str]:
    q: queue.Queue = queue.Queue()
    t = threading.Thread(target=_stream_to_queue, args=(prompt, q), daemon=True)
    t.start()
    while True:
        item = await asyncio.to_thread(q.get)
        if item is None:
            break
        if isinstance(item, Exception):
            raise item
        yield item
    t.join()


# ── SSE debate stream generator ───────────────────────────────────────────────

async def stream_debate(session_id: str) -> AsyncIterator[str]:
    session = sessions.get(session_id)
    if not session:
        yield format_sse({"event": "error", "payload": {"message": "Session not found"}})
        return

    try:
        for turn_number in range(session.total_turns):
            # Drain interrupt queue before each turn
            while session.interrupt_queue:
                comment = session.interrupt_queue.pop(0)
                for agent in session.agents:
                    ack_text = await generate_interrupt_ack(agent, comment, session)
                    yield format_sse({
                        "event": "interrupt_ack",
                        "payload": {"agent_name": agent.name, "side": agent.side, "ack_text": ack_text},
                    })
                    session.debate_history.append(DebateTurn(
                        agent_name=agent.name,
                        side=agent.side,
                        content=f"[Acknowledging audience question: {comment}] {ack_text}",
                        is_interrupt_ack=True,
                    ))

            agent = session.agents[turn_number % 2]

            yield format_sse({
                "event": "turn_start",
                "payload": {"turn_number": turn_number, "agent_name": agent.name, "side": agent.side},
            })

            prompt = build_turn_prompt(agent, session)
            full_text = ""

            async for chunk_text in yield_gemini_stream(prompt):
                full_text += chunk_text
                yield format_sse({
                    "event": "chunk",
                    "payload": {"turn_number": turn_number, "agent_name": agent.name, "text": chunk_text},
                })

            session.debate_history.append(DebateTurn(
                agent_name=agent.name,
                side=agent.side,
                content=full_text,
            ))

            yield format_sse({
                "event": "turn_end",
                "payload": {"turn_number": turn_number, "agent_name": agent.name, "full_text": full_text},
            })

            # Pause after each full round (every 2 turns), except after the last turn
            if (turn_number + 1) % 2 == 0 and turn_number + 1 < session.total_turns:
                round_num = (turn_number + 1) // 2
                pause_event = session_pause_events.get(session_id)
                if pause_event:
                    pause_event.clear()
                    yield format_sse({"event": "round_end", "payload": {"round": round_num}})
                    await pause_event.wait()

        session.status = "completed"
        session_pause_events.pop(session_id, None)
        yield format_sse({"event": "debate_end", "payload": {"total_turns": session.total_turns}})

    except Exception as exc:
        session.status = "error"
        session_pause_events.pop(session_id, None)
        yield format_sse({"event": "error", "payload": {"message": str(exc)}})


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"message": "Debate API is running"}


@app.post("/debate/generate-setup", response_model=GenerateSetupResponse)
async def generate_setup(req: GenerateSetupRequest):
    prompt = SETUP_PROMPT.format(topic=req.topic)
    try:
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text.strip()
        # Strip markdown code fences if Gemini wraps in them
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text.strip())
        agents = [AgentPersona(**a) for a in data["agents"]]
    except (json.JSONDecodeError, KeyError) as exc:
        raise HTTPException(status_code=502, detail=f"Gemini returned unexpected format: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini error: {exc}")
    return GenerateSetupResponse(topic=req.topic, agents=agents)


@app.post("/debate/start", response_model=StartDebateResponse)
async def start_debate(req: StartDebateRequest):
    if len(req.agents) != 2:
        raise HTTPException(status_code=400, detail="Exactly 2 agents required")
    session_id = str(uuid.uuid4())
    session = DebateSession(
        session_id=session_id,
        topic=req.topic,
        agents=req.agents,
        total_turns=req.total_turns,
    )
    sessions[session_id] = session
    pause_event = asyncio.Event()
    pause_event.set()
    session_pause_events[session_id] = pause_event
    return StartDebateResponse(
        session_id=session_id,
        topic=req.topic,
        agents=req.agents,
        total_turns=req.total_turns,
    )


@app.get("/debate/{session_id}/stream")
async def debate_stream(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return StreamingResponse(
        stream_debate(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/debate/{session_id}/continue")
async def continue_debate(session_id: str):
    event = session_pause_events.get(session_id)
    if not event:
        raise HTTPException(status_code=404, detail="Session not found or not paused")
    event.set()
    return {"status": "ok"}


@app.post("/debate/{session_id}/interrupt", response_model=InterruptResponse)
async def interrupt_debate(session_id: str, req: InterruptRequest):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        return InterruptResponse(status="debate_not_active")
    session.interrupt_queue.append(req.comment)
    return InterruptResponse(status="queued")
