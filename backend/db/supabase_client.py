import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_supabase: Client | None = None


# Returns a singleton Supabase client authenticated with the service role key (bypasses RLS)
def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
    return _supabase


# Uploads raw image bytes to Supabase Storage under research/{topic_slug}/{filename} and returns the public URL
def upload_image(topic_slug: str, filename: str, data: bytes) -> str:
    bucket = os.environ["SUPABASE_STORAGE_BUCKET"]
    db = get_supabase()
    path = f"research/{topic_slug}/{filename}"
    db.storage.from_(bucket).upload(path, data, {"content-type": "image/png"})
    return db.storage.from_(bucket).get_public_url(path)
