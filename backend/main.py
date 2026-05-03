# load_dotenv must run before any module imports that read os.environ
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.pipeline import router as pipeline_router
from routes.topics import router as topics_router

app = FastAPI(title="GroundTruth API")

# Allow all origins so the HTML preview (file:// or any port) can call the API
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(pipeline_router)
app.include_router(topics_router)


# Liveness check — used to confirm the server is up before the demo
@app.get("/health")
async def health():
    return {"status": "ok"}
