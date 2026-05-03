"""Stage 4 — TTS narration.

One Gemini TTS call per ShortScript → WAV file. Cached locally under
output/topics/{topic_slug}/audio/short_NN.wav and uploaded to Supabase Storage
at audio/{topic_slug}/short_NN.wav. URLs stored on topics.audio_urls.
"""

from pathlib import Path

from db.supabase_client import get_supabase, update_pipeline_status, upload_bytes
from gemini_client import save_pcm_as_wav, tts
from models.schemas import ShortScript

MAX_NARRATION_CHARS = 450  # ~30 sec hard cap on TTS spend (~15 chars/sec speech)
OUTPUT_ROOT = Path(__file__).parent.parent / "output" / "topics"


def _topic_audio_dir(topic_slug: str) -> Path:
    p = OUTPUT_ROOT / topic_slug / "audio"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _synthesize_one(narration: str, voice: str, out_path: Path) -> Path:
    """Disk-cached: skip API if WAV already exists."""
    if out_path.exists():
        print(f"[audio] cache hit: {out_path.name}")
        return out_path
    if len(narration) > MAX_NARRATION_CHARS:
        narration = narration[:MAX_NARRATION_CHARS].rsplit(" ", 1)[0] + "."
    print(f"[audio] {out_path.name} (voice={voice})")
    save_pcm_as_wav(tts(narration, voice), out_path)
    return out_path


def run_audio(topic_id: str) -> None:
    """Stage 4: TTS each ShortScript → WAV → Supabase Storage. Updates audio_urls."""
    db = get_supabase()
    row = (
        db.table("topics")
        .select("topic_slug, scripts")
        .eq("id", topic_id)
        .single()
        .execute()
    ).data
    topic_slug: str = row["topic_slug"]
    scripts: list[ShortScript] = [ShortScript(**s) for s in (row["scripts"] or [])]
    if len(scripts) != 6:
        raise RuntimeError(f"expected 6 scripts, got {len(scripts)}")

    update_pipeline_status(topic_id, "audio", "running")
    try:
        out_dir = _topic_audio_dir(topic_slug)
        urls: list[str] = []
        for i, s in enumerate(scripts):
            narration = f"{s.headline}. {s.narration}"
            local_path = out_dir / f"short_{i:02d}_{s.role}.wav"
            _synthesize_one(narration, s.voice, local_path)
            url = upload_bytes(
                f"audio/{topic_slug}/{local_path.name}",
                local_path.read_bytes(),
                "audio/wav",
            )
            urls.append(url)

        db.table("topics").update({"audio_urls": urls}).eq("id", topic_id).execute()
        update_pipeline_status(topic_id, "audio", "complete")

    except Exception:
        update_pipeline_status(topic_id, "audio", "failed")
        raise
