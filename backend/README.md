# GroundTruth backend

Python pipeline that turns a contested-topic query into a set of vertical-reel MP4s, end-to-end on Google's Gemini stack. Wraps the four stages described in [`../docs/project.md`](../docs/project.md):

| Stage | Module | Model | Output |
|---|---|---|---|
| 1. Deep Research | `gemini_client.deep_research` | `deep-research-preview-04-2026` | cited research text |
| 2. Multi-agent perspectives | `pipeline.analyze_perspectives` | `gemini-2.5-flash` × 2 | stateful debate transcript |
| 3. Script generation | `pipeline.generate_scripts` | `gemini-2.5-flash` | structured `ReelScript[]` |
| 4. TTS narration | `pipeline.synthesize` | `gemini-2.5-flash-preview-tts` | WAV per reel, distinct voice per perspective |
| 4b. Stills | `pipeline.generate_stills` | `gemini-2.5-flash-image` | 4 vertical 9:16 PNGs per reel |
| 4c. Assembly | `assemble.assemble_all` | ffmpeg (local) | one MP4 per reel: ken-burns stills + audio + burned-in captions |

Veo (real video generation) and Remotion (richer assembly) are out of scope for this backend; the assembly step gets us "watchable" reels for testing and offline iteration.

## Setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Paste your key from https://aistudio.google.com/apikey
```

For the assembly stage you also need an ffmpeg build with libass + libfreetype:

```bash
brew install ffmpeg-full   # not the bare `ffmpeg` formula — that's stripped
```

## Run the pipeline (CLI)

```bash
.venv/bin/python run_pipeline.py "Open source vs. closed AI models"

# Stop after Stage 1 (just the research):
.venv/bin/python run_pipeline.py "..." --research-only

# Skip TTS (no paid audio gen):
.venv/bin/python run_pipeline.py "..." --skip-tts

# Default: stops at Stage 4 (WAVs only). Add --assemble for stills + final MP4:
.venv/bin/python run_pipeline.py "..." --assemble

# Generate fewer scripts:
.venv/bin/python run_pipeline.py "..." --n-scripts 6

# Force re-run, bypass cache:
.venv/bin/python run_pipeline.py "..." --no-cache
```

Audio drops into `output/`, stills into `output/stills/`, MP4s into `output/reels/`. Cache lives in `.cache/` keyed by `(query, agent)` upstream and `research.id` downstream — repeat runs of the same query are instant and free.

## Run the API server

```bash
.venv/bin/uvicorn main:app --reload
```

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | liveness check |
| GET | `/gemini/smoke` | one cheap call, validates the key |
| POST | `/research` | kicks off Deep Research, returns `op_id` immediately |
| GET | `/research/{op_id}` | non-blocking status check |
| POST | `/pipeline` | stages 1-4 synchronously (no stills / assembly — use the CLI for that) |

```bash
curl http://localhost:8000/gemini/smoke

curl -X POST http://localhost:8000/research \
  -H "Content-Type: application/json" \
  -d '{"query":"Open-source vs closed AI models"}'

curl -X POST http://localhost:8000/pipeline \
  -H "Content-Type: application/json" \
  -d '{"query":"Open-source vs closed AI models", "n_scripts": 4}'
```

## Costs / latency (rough)

| Stage | First call | Cached |
|---|---|---|
| Deep Research (preview variant) | ~5–15 min, ~$1 | instant, free |
| Perspectives (6 turns × Flash) | ~30s, cents | instant, free |
| Scripts (one Flash call w/ JSON schema) | ~10s, cents | instant, free |
| TTS (per reel × 4, capped at ~30s/reel) | ~1 min total, ~$0.50 | instant, free |
| Stills (16 Nano Banana calls) | ~2 min total, ~$0.30 | instant, free |
| Assembly (ffmpeg local) | ~30s, $0 | always re-runs |

The cache is keyed on `(query, agent)` for research and on `research.id` downstream — change the query to invalidate the chain. Stage outputs sit in `.cache/`; renderable artifacts (WAVs, PNGs, MP4s) sit in `output/` and are reused by filename.

## Configuration

- **Personas + voices + visual style**: `PERSPECTIVES` in `pipeline.py`. Two slots (`A`, `B`); each has `label`, `voice` (any prebuilt Gemini voice — Kore, Puck, Charon, Aoede, etc.), `system` prompt, and `image_style` aesthetic preamble.
- **Deep Research agent**: `DEEP_RESEARCH_AGENT` in `gemini_client.py`. Valid values: `deep-research-pro-preview-12-2025`, `deep-research-preview-04-2026`, `deep-research-max-preview-04-2026`. The Max variant is deeper (~160 searches, ~$5) and slower; the preview variant is the dev default.
- **Models for stages 2-4 and image gen**: constants at the top of `pipeline.py`. Swap `IMAGE_MODEL` to `gemini-3-pro-image-preview` (Nano Banana Pro) for higher-quality stills at ~5-10× the cost.
- **Caption pacing**: `WORDS_PER_CAPTION` in `assemble.py`.

## Layout

```
backend/
├── .env                 # GEMINI_API_KEY (gitignored)
├── .env.example
├── .venv/
├── .cache/              # stage outputs cached by hash of inputs (gitignored)
├── output/              # WAVs (gitignored)
│   ├── stills/          # PNGs (gitignored)
│   └── reels/           # final MP4s + ASS subtitle files (gitignored)
├── README.md
├── requirements.txt
├── gemini_client.py     # SDK client + Stage 1 (Deep Research) + cache helper
├── pipeline.py          # Stages 2-4 + 4b: perspectives, scripts, TTS, stills
├── assemble.py          # Stage 4c: ffmpeg ken-burns + caption burn-in
├── main.py              # FastAPI routes
└── run_pipeline.py      # CLI: one-shot end-to-end run
```

## Notes

- **Deep Research is paid-tier only.** Smoke test works on free tier; `/research` and the CLI will fail with a billing error if billing isn't enabled on Google AI Studio.
- **`/pipeline` blocks for the full duration** of the first run (5–20 min). Don't call it from a UI thread; either call from a worker, or pre-warm the cache with the CLI before the demo.
- **SDK is in beta.** Version pinned in `requirements.txt`.
