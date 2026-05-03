# GroundTruth backend

FastAPI service wrapping the Gemini Interactions API. First-pass scope: validate the API key with a smoke test and expose a working Deep Research polling wrapper.

## Setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and paste your key from https://aistudio.google.com/apikey
```

## Run

```bash
uvicorn main:app --reload
```

Then in another terminal:

```bash
# Health check (no API call)
curl http://localhost:8000/health

# Smoke test — one cheap Gemini call, proves the key works
curl http://localhost:8000/gemini/smoke

# Kick off a Deep Research job (returns immediately with an op_id)
curl -X POST http://localhost:8000/research \
  -H "Content-Type: application/json" \
  -d '{"query":"What are the strongest arguments for and against open-source AI models?"}'

# Poll the job (run repeatedly until status is "completed")
curl http://localhost:8000/research/<op_id>
```

## Notes

- **Deep Research is paid-tier only.** Smoke test works on free tier; the `/research` call will fail with a billing error if billing isn't enabled on Google AI Studio.
- **Deep Research takes 5–20 min.** `/research` returns instantly; `/research/{op_id}` returns a status check (no blocking poll). Hit it on an interval from the client.
- **Agent name** is `deep-research-preview-04-2026`. The SDK accepts three values — `deep-research-pro-preview-12-2025`, `deep-research-preview-04-2026`, `deep-research-max-preview-04-2026`. Change `DEEP_RESEARCH_AGENT` in `gemini_client.py` to swap.
- **SDK is in beta.** Version pinned in `requirements.txt`.
</content>
</invoke>