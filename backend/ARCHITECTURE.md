# GroundTruth — Backend Architecture

## What Is GroundTruth

GroundTruth is a short-form video platform for contested social issues. Each topic is a debate between two positions (Pole A vs. Pole B). A user lands on a topic, watches a series of short videos that present the research, then casts a spectrum vote (0.0 = fully Pole A, 1.0 = fully Pole B).

The backend's job is to fully automate all content production for a topic after it is created. No human writes scripts, records audio, or edits video. Given a topic string and two poles, the backend produces six ~30-second videos ready for a mobile feed.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| API server | FastAPI | Async-native; background task dispatch for long-running pipeline stages; Pydantic integration for schema enforcement at API boundaries |
| AI | Gemini Interactions API (`google-genai >= 1.55`) | Unified interface for models, agents, tools, and multimodal I/O; server-side conversation state via `previous_interaction_id` eliminates local history management; only platform with a production Deep Research agent |
| Database | Supabase Postgres | JSONB columns for pipeline state and structured AI outputs; Realtime subscriptions for live vote updates on the frontend; Row Level Security for anonymous public access |
| File storage | Supabase Storage | CDN-backed object storage; public URLs for media served directly to clients |
| Video | ffmpeg | Ken Burns pan/zoom effect, ASS subtitle burn-in, H.264 encoding — no Python library covers all three |

---

## Data Model

Three tables. All pipeline output for a topic lives in a single `topics` row to keep reads simple.

### `topics`
One row per topic. Contains everything needed to render the frontend — research, debate, scripts, media URLs — as JSONB columns populated by each pipeline stage.

Key columns:
- `topic`, `pole_a`, `pole_b`, `topic_slug` — the topic's identity
- `pipeline_status` — a JSONB object with one key per stage (`research`, `debate`, `summary`, `scripts`, `audio`, `video`), each holding `pending | running | complete | failed`. This is the heartbeat the frontend polls and the mechanism that makes the pipeline idempotent.
- `research_raw` — full markdown research report (50K–200K tokens)
- `briefing` — structured extraction of the research: 6 thematic sections + two debate persona prompts
- `debate_summary` — synthesized debate output including a facilitator verdict
- `scripts` — 6 short-form video scripts
- `audio_urls`, `video_urls` — Storage URLs for the final media

### `debate_rounds`
12 rows per topic (6 rounds × 2 speakers). The full debate transcript, written one row at a time as each turn completes. Serves two purposes: crash recovery for the debate stage, and source material for the summary stage.

Each row stores: the full argument text, a single key claim sentence, any concession to the opponent, a list of specific stats/facts cited, and the search queries and web sources the agent used during that turn.

### `votes`
Anonymous spectrum votes. Any client can insert a vote (RLS allows public insert + read). The backend aggregates these into a 20-bucket histogram with a running mean. The frontend can subscribe via Supabase Realtime to show the histogram updating live as other users vote.

---

## The Pipeline

Six stages run sequentially, orchestrated by `run_pipeline.py`. Every stage follows the same pattern:

1. Check `pipeline_status[stage]` — if `"complete"`, skip entirely
2. Set status to `"running"`
3. Do the work
4. Set status to `"complete"` on success, `"failed"` on any exception

This makes the entire pipeline **idempotent**: a restart after any failure resumes from the last incomplete stage. No stage re-runs work that already succeeded.

```
topics INSERT
     │
     ▼
Stage 1 — Research       →  topics.research_raw, topics.briefing
     │
     ▼
Stage 2 — Debate         →  debate_rounds (12 rows)
     │
     ▼
Stage 2.5 — Summary      →  topics.debate_summary
     │
     ▼
Stage 3 — Scripts        →  topics.scripts
     │
     ▼
Stage 4 — Audio (TTS)    →  topics.audio_urls  (6 WAV files → Storage)
     │
     ▼
Stage 5 — Video Assembly →  topics.video_urls  (6 MP4 files → Storage)
```

---

## Stage 1 — Deep Research

**Model:** `deep-research-max-preview-04-2026`

The research agent is not a standard language model call. It is a multi-step agentic system that performs web searches, synthesizes sources, and produces a structured report with inline visualizations (charts, tables, timelines). A single call to a standard model cannot replicate this — the agent performs dozens of search iterations internally before returning.

**How it works:**

*Substage 1a — Agent call:* The pipeline fires the research agent in background mode (it can run for 5–15 minutes) and polls for completion every 10 seconds. The prompt requests a six-section structured report: Origin, Key Players, Case For A (steelmanned), Case For B (steelmanned), Consequences, Current State. The `visualization: "auto"` agent config instructs it to generate inline charts and infographics where quantitative data exists. On completion, the agent returns text parts and base64-encoded image outputs. Images are uploaded to Storage; the full markdown is saved to `topics.research_raw`.

*Substage 1b — Extraction pass:* The raw report is 50K–200K tokens of unstructured markdown. A cheap Flash call extracts it into a typed `Briefing` schema with one field per section, plus two debate persona prompts (one for each side). This structured object is stored to `topics.briefing` and consumed by Stage 2.

**Why generate visualizations at Stage 1:** The debate agents (Stage 2) receive the visualization images in their first turn. An agent that can see a chart showing tuition cost trends over time will make more grounded arguments than one reading the same data as prose.

---

## Stage 2 — Adversarial Debate

**Inspired by:** TradingAgents (arxiv 2412.20138), a multi-agent framework that pits Bull and Bear analysts against each other with live data access and structured reasoning.

**Model:** `gemini-3.1-pro-preview` with `thinking_level: "high"`

Thinking mode causes the model to reason internally before producing a response. For debate, this means the agent evaluates its position, considers counter-arguments, and plans its response before committing — producing materially more sophisticated arguments than a direct generation call.

**Tools:** `google_search` (live web evidence) and `code_execution` (quantitative reasoning — the agent can write and run Python to compute growth rates, cost comparisons, etc.) are available every turn.

### How the two-agent architecture works

Red argues Pole A. Blue argues Pole B. Each side is a separate Gemini interaction thread, maintained across all 6 rounds via `previous_interaction_id`.

**Turn 1 (per side):** Sends a multimodal payload — the full `research_raw` markdown plus all visualization images from Stage 1, plus the Round 1 directive. This is the agent's factual foundation for the entire debate.

**Turns 2–6 (per side):** Sends only the opponent's latest argument plus the round directive. The server retains the full Turn 1 context, so the agent always has the complete briefing without the pipeline re-sending 50K–200K tokens each turn.

**Why not RAG or chunking:** The 1M-token context window eliminates the retrieval problem. Chunking the research report and embedding it for retrieval adds an entire engineering layer to solve a problem that doesn't exist at this scale. TradingAgents itself uses full-context injection for the same reason.

### The 6-round ReAct structure

Each round follows the ReAct framework: **Reason** (assess position) → **Act** (use tools) → **Observe** (evaluate findings) → **Respond** (deliver argument). The round directives escalate:

| Round | Phase | Primary tool |
|---|---|---|
| 1 | Opening — state thesis, cite 3 facts, end with key claim | `google_search` |
| 2 | Evidence exchange — find the most damaging stat, confirm it live | `google_search` |
| 3 | Direct attack — find opponent's most vulnerable claim, search counter-evidence | `google_search` |
| 4 | Quantitative counter — compute the relevant figures, show the math | `code_execution` |
| 5 | Synthesis attack — acknowledge opponent's strongest point, then dismantle it | `google_search` |
| 6 | Closing — policy prescription, what irreversible harm follows the other path | (synthesis, no search required) |

### Crash recovery

Each turn is written to `debate_rounds` immediately after the API call returns — never batched. On restart, the pipeline loads which `(round_number, speaker)` pairs already exist in the DB and skips them. A crash mid-debate resumes from the next unfinished turn, not from the beginning.

### JSON extraction and the thinking model problem

`thinking_level: "high"` produces thought blocks in the output before the final text block. The Gemini structured output parameters (`response_mime_type` + `response_format`) are unreliable when thinking and tools are both active — the constraint breaks down and the model produces malformed JSON.

Solution: the JSON schema is injected as a mandatory instruction in the system prompt instead. On the parsing side, `json.JSONDecoder().raw_decode()` scans forward to the first `{` and consumes exactly one valid JSON object, ignoring any preamble from the thinking output and any trailing content.

---

## Stage 2.5 — Summary + Facilitator Verdict

**Model:** `gemini-3-flash-preview`

After the debate, a single Flash call reads the full transcript (all 12 turns with argument text and evidence cited) and produces two things:

1. **Synthesis:** 3–5 strongest distinct, falsifiable points per side — not key-claim bullet points, but the full best-case argument for each position.

2. **Facilitator verdict:** Which side made the stronger evidence-based case (or "tie"), a 2–3 sentence reasoning, and the single decisive argument that tipped the verdict.

This mirrors the TradingAgents facilitator agent pattern: a neutral reviewer who reads the full debate record and selects the prevailing perspective.

The output is stored to `topics.debate_summary` and flows into Stage 3 as context for script generation.

---

## Stage 3 — Script Generation

**Model:** `gemini-3-flash-preview`

One call returns all 6 `ShortScript` objects simultaneously, using `response_schema` to enforce the exact output structure. Each script maps to one of six fixed roles that correspond 1:1 to the six sections of the research briefing:

| Role | Content |
|---|---|
| `origin` | Where did this issue come from? |
| `key_players` | Who holds power in this debate? |
| `case_for_a` | The strongest argument for Pole A |
| `case_for_b` | The strongest argument for Pole B |
| `consequences` | What happened where each path was taken? |
| `where_we_stand` | What is actively contested right now? |

Each script includes a headline (punchy overlay text, ≤12 words), narration (~60 words / ~25–30s of speech), four vertical 9:16 image prompts for Stage 5, and a fixed voice assignment. Voices are assigned by tone: Charon for analytical delivery, Puck for advocacy, Aoede for synthesis.

**Why 6 fixed roles:** The roles are static by design. They guarantee complete coverage of the issue — a user who watches all 6 gets the full arc from history to current stakes. Each short is independently watchable, but together they form a complete briefing.

---

## Stage 4 — Audio (TTS)

**Model:** `gemini-2.5-flash-preview-tts`

One TTS call per script. The input is `headline + ". " + narration`, capped at 450 characters. The output is raw PCM bytes, which are wrapped in a WAV header before being written to disk and uploaded to Storage.

Audio files are disk-cached by topic slug and script index. A retry of Stage 4 skips scripts whose WAV files already exist locally, making the stage fast to re-run after a partial failure.

---

## Stage 5 — Video Assembly

Two substages per script, then upload.

**Image generation:** Four vertical (9:16) still images are generated via `gemini-2.5-flash-image` using the `image_prompts` from Stage 3. Images are cached to disk — regenerating 24 images per topic is expensive and unnecessary on retry.

**ffmpeg assembly:** The four stills and one WAV file are composed into a single MP4:
- Stills are scaled to 2× the target resolution (1080×1920) to give the Ken Burns effect room to zoom without going below native resolution
- A slow zoom (1.0× → 1.30×) is applied over each still's duration, with 0.5s crossfades between stills
- Subtitles are generated in ASS format — narration text chunked ~6 words at a time with timing distributed evenly across the audio duration — and burned directly into the video via `libass`
- Output: H.264, yuv420p, crf=20, 30fps, AAC 192k audio

The final MP4 is uploaded to Storage and its URL stored to `topics.video_urls`.

---

## API Surface

### Pipeline
| Endpoint | Purpose |
|---|---|
| `POST /pipeline/start` | Launch `run_pipeline` as a FastAPI background task. Triggered by Supabase webhook on topics INSERT, or called manually from the test UI. |
| `POST /pipeline/retry` | Re-trigger a failed or stuck topic without deleting any data. The idempotency of each stage means this safely resumes from the last failure point. |
| `GET /pipeline/status/{topic_id}` | Return the `pipeline_status` JSONB. The frontend polls this at 8-second intervals to animate the loading screen. |

### Topics
| Endpoint | Purpose |
|---|---|
| `GET /topics` | List all topics, newest first. Used to populate the topic selector. |
| `GET /topics/{topic_id}` | Full topic row. The frontend fetches this once research is complete to render the research report and briefing, and again once summary is complete. |
| `GET /topics/{topic_id}/rounds` | The full debate transcript. Returns all 12 turns with arguments, evidence, search queries, and search sources. |

### Votes
| Endpoint | Purpose |
|---|---|
| `POST /votes` | Submit an anonymous spectrum vote (0.0–1.0). Returns the updated distribution immediately so the client can render the post-vote view without a second fetch. |
| `GET /votes/{topic_id}/distribution` | 20-bucket histogram + mean for a topic. The frontend can also subscribe to this data via Supabase Realtime for a live updating counter. |

---

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| JSONB `pipeline_status` with per-stage keys | Single column tracks all six stages. Idempotent restarts, granular failure visibility, no extra status table. Stages can be reset individually by patching the JSON without touching any other data. |
| `previous_interaction_id` for debate thread state | The server holds the conversation history across all 6 rounds per agent. The pipeline sends only new content each turn. No local history array to maintain, serialize, or re-send. |
| Full research markdown in Turn 1, no RAG | A 1M-token context window makes retrieval unnecessary at this document size. Chunking and embedding the research report would add an entire engineering layer to solve a problem that doesn't exist. |
| Per-turn DB write in debate (no batching) | Each row written immediately after the API call is the crash recovery mechanism. If the process dies mid-debate, the next run resumes from the next unwritten turn. Batching would lose a full round on crash. |
| JSON schema in system prompt, not `response_format` | `response_mime_type` + `response_format` are not reliably enforced when `thinking_level: high` and tools are both active. An explicit schema block in the system prompt achieves the same contract without the reliability issue. |
| 6 fixed short roles | The roles are an intentional constraint, not a limitation. Fixed roles guarantee every topic gets the same complete coverage. The Stage 3 model fills the content; the structure is the product. |
| Local disk cache for audio and video | Generated media is expensive. The local `output/` directory acts as a development cache — re-runs after partial failures are fast. Supabase Storage is the authoritative copy served to clients. |
| Service-role key in backend only | The backend uses the Supabase service-role key, which bypasses RLS. RLS governs only anonymous frontend access: public read on topics, public read+insert on votes. The backend never touches the anon key. |
