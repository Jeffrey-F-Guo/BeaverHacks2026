"""Stage 5 — Video assembly.

For each ShortScript:
1. Generate 4 vertical stills via Nano Banana (Flash variant, cheap).
2. Run ffmpeg ken-burns + ASS captions + WAV → MP4 (reuses assemble_reel
   from assemble.py).
3. Upload MP4 to Supabase Storage; track URL on topics.video_urls.

Local files cached under output/topics/{topic_slug}/{stills,videos}/ — re-runs
of the same topic skip work that's already on disk.
"""

import shutil
from pathlib import Path

from agent_pipeline.audio import OUTPUT_ROOT
from assemble import ReelScript, assemble_reel
from db.supabase_client import get_supabase, update_pipeline_status, upload_bytes
from gemini_client import generate_image
from models.schemas import ShortScript

STILLS_PER_SHORT = 4

# Map ShortScript.role → "perspective" letter for assemble_reel filenames.
# Doesn't affect output other than the local filename pattern.
ROLE_TO_PERSPECTIVE: dict[str, str] = {
    "origin": "O",
    "key_players": "K",
    "case_for_a": "A",
    "case_for_b": "B",
    "consequences": "C",
    "where_we_stand": "W",
}


def _topic_dirs(topic_slug: str) -> tuple[Path, Path, Path]:
    base = OUTPUT_ROOT / topic_slug
    stills, videos, audio = base / "stills", base / "videos", base / "audio"
    stills.mkdir(parents=True, exist_ok=True)
    videos.mkdir(parents=True, exist_ok=True)
    return stills, videos, audio


def _generate_stills(prompts: list[str], stills_dir: Path, prefix: str) -> list[Path]:
    """Disk-cached per filename. One Nano Banana call per missing prompt."""
    paths: list[Path] = []
    for j, prompt in enumerate(prompts):
        path = stills_dir / f"{prefix}_still_{j:02d}.png"
        if path.exists():
            print(f"[video] cache hit: {path.name}")
        else:
            print(f"[video] still {path.name}")
            generate_image(prompt).save(path)
        paths.append(path)
    return paths


def _adapter(short: ShortScript) -> ReelScript:
    """assemble_reel takes ReelScript (hook/body/perspective). Map ShortScript
    → ReelScript so we don't duplicate the ffmpeg pipeline."""
    return ReelScript(
        perspective=ROLE_TO_PERSPECTIVE.get(short.role, "X"),
        hook=short.headline,
        body=short.narration,
    )


def run_video(topic_id: str) -> None:
    """Stage 5: stills + ffmpeg assembly → MP4 per script → Supabase Storage."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not on PATH (install via `brew install ffmpeg-full`)")

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

    stills_dir, videos_dir, audio_dir = _topic_dirs(topic_slug)
    update_pipeline_status(topic_id, "video", "running")
    try:
        urls: list[str] = []
        for i, short in enumerate(scripts):
            prefix = f"short_{i:02d}_{short.role}"
            wav_path = audio_dir / f"{prefix}.wav"
            if not wav_path.exists():
                raise FileNotFoundError(
                    f"WAV missing — Stage 4 must run before Stage 5: {wav_path}"
                )

            stills = _generate_stills(
                short.image_prompts[:STILLS_PER_SHORT], stills_dir, prefix
            )

            mp4_path = videos_dir / f"{prefix}.mp4"
            if mp4_path.exists():
                print(f"[video] cache hit: {mp4_path.name}")
            else:
                assemble_reel(
                    reel_idx=i,
                    script=_adapter(short),
                    stills=stills,
                    wav_path=wav_path,
                    output_path=mp4_path,
                )

            urls.append(upload_bytes(
                f"videos/{topic_slug}/{mp4_path.name}",
                mp4_path.read_bytes(),
                "video/mp4",
            ))

        db.table("topics").update({"video_urls": urls}).eq("id", topic_id).execute()
        update_pipeline_status(topic_id, "video", "complete")

    except Exception:
        update_pipeline_status(topic_id, "video", "failed")
        raise
