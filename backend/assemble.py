"""Final reel assembly: ken-burns stills + audio + burned-in subtitles → MP4.

No Gemini calls happen here — pure ffmpeg. Run after stills + WAVs exist.
Requires an ffmpeg build with libass + libfreetype (e.g. `brew install ffmpeg-full`).
"""

import shutil
import subprocess
import wave
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

OUTPUT_DIR = Path(__file__).parent / "output"
ASSEMBLY_DIR = OUTPUT_DIR / "reels"
OUTPUT_DIR.mkdir(exist_ok=True)
ASSEMBLY_DIR.mkdir(exist_ok=True)

FPS = 30
TARGET_W, TARGET_H = 1080, 1920
CROSSFADE_S = 0.5
WORDS_PER_CAPTION = 6


class ReelScript(BaseModel):
    """Adapter shape consumed by `assemble_reel`. Stage 5 (video.py) maps a
    ShortScript → ReelScript before calling assemble. `perspective` is just a
    filename letter; `hook` + `body` become the burned-in subtitle text."""

    perspective: Literal["A", "B", "O", "K", "C", "W", "X"]
    hook: str
    body: str
    cta_to_next: str = ""


# --- subtitles -----------------------------------------------------------


def _wav_duration_s(path: Path) -> float:
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / wf.getframerate()


def _ass_ts(s: float) -> str:
    """ASS timestamp format: h:mm:ss.cs (centiseconds)."""
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    cs = int(round((s - int(s)) * 100))
    return f"{h}:{m:02d}:{sec:02d}.{cs:02d}"


_ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,0,2,40,40,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def make_subs(narration: str, duration_s: float, path: Path) -> Path:
    """Generate an ASS subtitle file with baked-in styling.

    Mechanical timing — chunks of WORDS_PER_CAPTION words distributed across the
    audio duration weighted by char count. Swap to Gemini multimodal forced
    alignment later for tight word-level sync."""
    words = narration.replace("\n", " ").split()
    chunks = [
        words[i : i + WORDS_PER_CAPTION]
        for i in range(0, len(words), WORDS_PER_CAPTION)
    ]
    weights = [sum(len(w) + 1 for w in c) for c in chunks]
    total = sum(weights) or 1

    lines = [_ASS_HEADER]
    cursor = 0.0
    for i, chunk in enumerate(chunks):
        dur = duration_s * weights[i] / total
        start, end = cursor, min(cursor + dur, duration_s)
        cursor = end
        # ASS reserves '{' and '}' for inline override tags; sub them out.
        text = " ".join(chunk).replace("{", "(").replace("}", ")")
        lines.append(
            f"Dialogue: 0,{_ass_ts(start)},{_ass_ts(end)},Default,,0,0,0,,{text}"
        )
    path.write_text("\n".join(lines) + "\n")
    return path


# --- ffmpeg orchestration ------------------------------------------------


def _ken_burns_filter(
    n_stills: int, total_s: float, sub_filename: str
) -> tuple[float, str]:
    """Build the filter_complex chain for n_stills with crossfades + subtitles.

    Returns (per_clip_s, filter_complex). Each clip overlaps the next by
    CROSSFADE_S, so:  total = n*per - (n-1)*xfade  →  per = (total + (n-1)*xfade) / n
    """
    per = (total_s + (n_stills - 1) * CROSSFADE_S) / n_stills
    d_frames = int(round(per * FPS))

    parts: list[str] = []

    # Per-still: scale + crop to 2x target (so we have room to zoom into),
    # then zoompan slowly into a 1080x1920 viewport.
    for i in range(n_stills):
        parts.append(
            f"[{i}:v]"
            f"scale={TARGET_W * 2}:{TARGET_H * 2}:force_original_aspect_ratio=increase,"
            f"crop={TARGET_W * 2}:{TARGET_H * 2},"
            f"zoompan=z='min(zoom+0.0010,1.30)':d={d_frames}"
            f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":s={TARGET_W}x{TARGET_H}:fps={FPS}"
            f"[v{i}]"
        )

    # Crossfade chain.
    last = "v0"
    offset = per - CROSSFADE_S
    for i in range(1, n_stills):
        out = f"x{i}"
        parts.append(
            f"[{last}][v{i}]xfade=transition=fade:"
            f"duration={CROSSFADE_S}:offset={offset:.3f}[{out}]"
        )
        last = out
        offset += per - CROSSFADE_S

    # Subtitles via ASS file. ffmpeg 8 requires explicit `filename=` keyword.
    parts.append(f"[{last}]subtitles=filename={sub_filename}[outv]")
    return per, ";".join(parts)


def assemble_reel(
    reel_idx: int,
    script: ReelScript,
    stills: list[Path],
    wav_path: Path,
    output_path: Path | None = None,
) -> Path:
    """Build one reel MP4: ken-burns stills + WAV + burned-in ASS captions."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not on PATH (install via `brew install ffmpeg-full`)")
    duration = _wav_duration_s(wav_path)
    output_path = output_path or (
        ASSEMBLY_DIR / f"reel_{reel_idx:02d}_{script.perspective}.mp4"
    )

    sub_path = ASSEMBLY_DIR / f"reel_{reel_idx:02d}_{script.perspective}.ass"
    make_subs(f"{script.hook} {script.body}", duration, sub_path)

    per_clip_s, filter_complex = _ken_burns_filter(
        len(stills), duration, sub_path.name
    )

    # cwd=ASSEMBLY_DIR so the subtitles filter can reference the ASS by basename
    # (avoids escaping ':' / spaces in absolute paths).
    inputs: list[str] = []
    for s in stills:
        inputs += ["-loop", "1", "-t", f"{per_clip_s:.3f}", "-i", str(s)]
    inputs += ["-i", str(wav_path)]

    cmd = [
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        filter_complex,
        "-map",
        "[outv]",
        "-map",
        f"{len(stills)}:a",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        str(output_path),
    ]
    print(f"[assemble] reel {reel_idx} → {output_path.name} ({duration:.1f}s)")
    subprocess.run(cmd, check=True, cwd=ASSEMBLY_DIR)
    return output_path
