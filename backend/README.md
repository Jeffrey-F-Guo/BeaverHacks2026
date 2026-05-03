# GroundTruth backend

Python pipeline that turns a contested-topic seed (a row in `topics`) into 6 vertical-reel MP4s, end-to-end on Google's Gemini stack, with state and assets persisted to Supabase.

End-to-end verified on the topic `open-source-vs-closed-source-llms` — produced cited research, 12 debate turns, 6 scripts, 6 WAVs, 24 stills, 6 MP4s, all in Supabase Storage. ~$1–2 per topic.

## Pipeline

| Stage | Module | Model | Output |
|---|---|---|---|
| 1. Deep Research | `agent_pipeline/research.py` | `deep-research-max-preview-04-2026` + `gemini-3-flash-preview` extraction | `topics.briefing` (structured) + `research_raw` markdown + `research_viz_urls` (PNG uploads) |
| 2. Adversarial Debate | `agent_pipeline/debate.py` | `gemini-3-flash-preview` × 2 sides × 6 rounds (stateful via `previous_interaction_id`) | 12 rows in `debate_rounds` |
| 2.5 Summary | `agent_pipeline/summary.py` | `gemini-3-flash-preview` (one call, structured `DebateSummary`) | `topics.debate_summary` |
| 3. Scripts | `agent_pipeline/scripts.py` | `gemini-3-flash-preview` (one call, structured `ShortScriptSet`) | `topics.scripts` (6 ShortScripts, fixed roles) |
| 4. TTS | `agent_pipeline/audio.py` | `gemini-2.5-flash-preview-tts` (no Gemini 3 release yet) | 6 WAVs in Storage; URLs on `topics.audio_urls` |
| 5. Video | `agent_pipeline/video.py` | `gemini-2.5-flash-image` (Nano Banana Flash) + ffmpeg ken-burns | 6 MP4s in Storage; URLs on `topics.video_urls` |

The 6 scripts have fixed roles (one of each per topic):

| Role | Voice | What's in it |
|---|---|---|
| `origin` | Charon | History — when, how, what made this matter |
| `key_players` | Charon | Who holds power and what they want |
| `case_for_a` | Puck | Steelmanned argument from inside Pole A's worldview |
| `case_for_b` | Charon | Steelmanned argument from inside Pole B's worldview |
| `consequences` | Charon | What's actually happened where each path was taken |
| `where_we_stand` | Aoede | Live tension; what's at stake right now |

Each stage is idempotent — guarded by `pipeline_status[stage] != "complete"`, so retries skip completed work.

## Setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Paste your keys: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY,
# SUPABASE_ANON_KEY, SUPABASE_STORAGE_BUCKET
```

ffmpeg with libass + libfreetype is required for Stage 5:
```bash
brew install ffmpeg-full   # NOT the bare `ffmpeg` formula — that one strips libass
```

Apply the schema in Supabase (SQL editor → paste `backend/db/schema.sql` → Run). Idempotent; safe on existing data.

## Run the API server

```bash
.venv/bin/uvicorn main:app --reload
```

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | liveness check |
| GET | `/gemini/smoke` | one cheap Gemini call — validates the key |
| POST | `/pipeline/start` | webhook target; kicks off `run_pipeline(topic_id)` as background task |
| POST | `/pipeline/retry` | manual re-trigger; skips completed stages |
| GET | `/pipeline/status/{topic_id}` | returns the `pipeline_status` JSONB |
| GET | `/topics/{topic_id}` | full topic row (frontend reads this once research completes) |
| POST | `/votes` | submit one vote (float 0.0..1.0); returns updated distribution |
| GET | `/votes/{topic_id}/distribution` | 20-bucket histogram + mean |

## Run the pipeline manually (no webhook needed)

For dev / before the webhook is wired, kick off the pipeline directly:

```bash
.venv/bin/python -c "
from agent_pipeline.run_pipeline import run_pipeline
run_pipeline('YOUR-TOPIC-UUID-HERE')
"
```

Or, equivalently, hit the API:
```bash
curl -X POST http://localhost:8000/pipeline/start \
  -H "Content-Type: application/json" \
  -d '{"topic_id":"YOUR-TOPIC-UUID-HERE"}'
```

Stages already marked `complete` in `pipeline_status` are skipped; `running` and `failed` get retried.

## Costs / latency (rough, per topic)

| Stage | First call | Cached |
|---|---|---|
| Deep Research (Max variant) | ~5–15 min, ~$5 | instant, free |
| Debate (12 turns × Flash) | ~1 min, ~$0.05–0.15 | instant, free |
| Summary (1 Flash) | ~10s, cents | instant, free |
| Scripts (1 Flash w/ JSON schema) | ~10s, cents | instant, free |
| Audio (6 TTS, capped at ~30s/reel) | ~1 min, ~$0.50 | instant, free |
| Video (24 Nano Banana Flash + ffmpeg) | ~3 min, ~$0.30 | instant, free |

Use the cheaper `deep-research-preview-04-2026` variant during dev: edit `RESEARCH_AGENT` in `agent_pipeline/research.py`. ~$1 vs ~$5 per Stage 1 call. For higher-quality stills, flip `IMAGE_MODEL` in `gemini_client.py` to `gemini-3-pro-image-preview` (Nano Banana Pro) — bumps Stage 5 from ~$0.30 to ~$1.50 per topic.

## Layout

```
backend/
├── .env / .env.example           # secrets (gitignored)
├── README.md
├── requirements.txt
├── main.py                       # FastAPI app + router includes
├── gemini_client.py              # SDK client singleton + smoke + tts/generate_image/save_pcm_as_wav helpers
├── assemble.py                   # ReelScript + ffmpeg ken-burns + ASS captions (used by Stage 5)
├── output/                       # local working dir (gitignored, see below)
├── agent_pipeline/
│   ├── research.py    debate.py    summary.py
│   ├── scripts.py     audio.py     video.py
│   └── run_pipeline.py           # orchestrator — calls all 6 stages in order
├── db/
│   ├── schema.sql                # idempotent — paste into Supabase SQL editor
│   └── supabase_client.py        # singleton + Storage upload/download + update_pipeline_status
├── models/schemas.py             # all Pydantic models (single source of truth)
└── routes/
    ├── pipeline.py    topics.py    votes.py
```

### `output/` (local working directory)

Pipeline writes binary assets here, then uploads to Supabase Storage. Two reasons:
1. **ffmpeg needs local files** — Stage 5's `ffmpeg -i still.png -i audio.wav` can't read Supabase URLs.
2. **Cheap re-run cache** — if `output/topics/{slug}/audio/short_00_origin.wav` already exists, Stage 4 skips the TTS API call entirely. Same for stills (skip Nano Banana) and MP4s (skip ffmpeg).

Layout per topic:
```
output/topics/{topic_slug}/
├── audio/      # 6 WAVs (~7 MB total)
├── stills/     # 24 PNGs (~10 MB)
└── videos/     # 6 MP4s (~80 MB)
output/reels/   # ffmpeg working dir for ASS subtitle files
```

Gitignored. Safe to `rm -rf output/` to reset all caches; next pipeline run will regenerate.

## Database schema (Supabase Postgres)

Three tables (full DDL in [`db/schema.sql`](db/schema.sql)):

- **`topics`** — one row per debate topic. Holds the seed (topic, pole_a, pole_b), the per-stage `pipeline_status`, and the structured outputs of every stage (`briefing`, `debate_summary`, `scripts`, `audio_urls`, `video_urls`).
- **`debate_rounds`** — 12 rows per topic (6 rounds × red/blue). Each row is one structured `AgentTurn`. Inserted immediately after each turn so a crash mid-debate loses at most one turn.
- **`votes`** — one row per vote. `position` is `REAL` in `[0.0, 1.0]`. Public read + insert via RLS so anonymous frontends can vote and read distributions; the backend uses the service-role key (bypasses RLS).

## Conventions

- **One Gemini client.** `from gemini_client import client` everywhere — no per-file `genai.Client(...)`.
- **One status updater.** `from db.supabase_client import update_pipeline_status` — never inline.
- **All Pydantic models in one place.** `models/schemas.py`.
- **Stage idempotency.** Every stage queries `pipeline_status` first and writes `running` / `complete` / `failed` around its work.
- **Two layers.** Root files (`gemini_client.py`, `assemble.py`) are utility primitives — atomic API calls and ffmpeg ops. `agent_pipeline/*.py` are stage orchestrators that loop, talk to Supabase, and call the primitives.

## Notes & known gaps

- **Deep Research is paid-tier only.** Smoke test works on free tier; the pipeline will fail with a billing error if billing isn't enabled on the Google AI Studio project.
- **`/pipeline/start` returns immediately.** The actual pipeline runs as a FastAPI BackgroundTask. Frontend polls `/pipeline/status/{topic_id}` to drive the loading UI.
- **Webhook not wired yet.** The Supabase webhook on `topics` INSERT → `POST /pipeline/start` isn't configured in the dashboard. For now, kick off the pipeline manually (see "Run the pipeline manually" above) or expose your local server via ngrok and add the webhook.
- **Server not deployed.** Runs locally via `uvicorn`. For frontend + webhook integration, deploy to Cloud Run / Railway / Render or use `ngrok http 8000`.
- **Watch-gate is frontend-side.** The `votes` endpoint accepts any vote from anyone; the "must watch all 6 videos to vote" UX gate lives in the frontend.
- **SDK is in beta.** Versions pinned in `requirements.txt`.
