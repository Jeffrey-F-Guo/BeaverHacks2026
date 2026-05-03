"""Supabase client singleton + Storage helpers + pipeline-status updater."""

import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_supabase: Client | None = None


def get_supabase() -> Client:
    """Singleton service-role client (bypasses RLS for server-side writes)."""
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
    return _supabase


def _bucket() -> str:
    return os.environ["SUPABASE_STORAGE_BUCKET"]


def upload_image(topic_slug: str, filename: str, data: bytes) -> str:
    """Upload PNG bytes to research/{topic_slug}/{filename}; returns public URL."""
    return upload_bytes(f"research/{topic_slug}/{filename}", data, "image/png")


def upload_bytes(path: str, data: bytes, content_type: str) -> str:
    """Upload raw bytes to Storage at the given path. Upserts (safe to re-run)."""
    db = get_supabase()
    db.storage.from_(_bucket()).upload(
        path, data, {"content-type": content_type, "upsert": "true"}
    )
    return db.storage.from_(_bucket()).get_public_url(path)


def download_bytes(path: str) -> bytes:
    """Download bytes from Storage. Used by Stage 5 when ffmpeg needs a WAV."""
    return get_supabase().storage.from_(_bucket()).download(path)


def update_pipeline_status(topic_id: str, stage: str, status: str) -> None:
    """Patch one stage key in the pipeline_status JSONB without clobbering others."""
    db = get_supabase()
    result = db.table("topics").select("pipeline_status").eq("id", topic_id).single().execute()
    current: dict = result.data["pipeline_status"]
    current[stage] = status
    db.table("topics").update({"pipeline_status": current}).eq("id", topic_id).execute()
