"""Pipeline stages 2-4 of the GroundTruth reel generator.

Stage 2 — `analyze_perspectives`: two opposing Gemini Flash agents debate via
          stateful turns (`previous_interaction_id`), each side keeping its own
          conversation thread.
Stage 3 — `generate_scripts`: one Gemini Flash call with `response_json_schema`
          turns the research + transcript into structured reel scripts.
Stage 4 — `synthesize`: TTS narration per script via `gemini-2.5-flash-preview-tts`,
          one voice per perspective.
Stage 4b — `derive_visual_prompts` + `generate_stills`: Nano Banana stills used as
          ken-burns backdrops. Final MP4 assembly lives in `assemble.py`.
"""

import wave
from pathlib import Path
from typing import Literal

from google.genai import types
from pydantic import BaseModel

from gemini_client import cached_json, client

# --- model + voice + path config -----------------------------------------

PERSPECTIVE_MODEL = "gemini-2.5-flash"
SCRIPT_MODEL = "gemini-2.5-flash"
TTS_MODEL = "gemini-2.5-flash-preview-tts"
# Nano Banana (cheap). Pro variant: "gemini-3-pro-image-preview".
IMAGE_MODEL = "gemini-2.5-flash-image"

# TTS cost cap: ~15 chars/sec of speech → 450 chars ≈ 30s. Hard truncation in
# synthesize() guarantees we never pay for >30s of audio per reel.
MAX_NARRATION_CHARS = 450

NUM_TURNS_PER_SIDE = 3
STILLS_PER_REEL = 4

OUTPUT_DIR = Path(__file__).parent / "output"
STILLS_DIR = OUTPUT_DIR / "stills"
OUTPUT_DIR.mkdir(exist_ok=True)
STILLS_DIR.mkdir(exist_ok=True)

# Two contrasting personas. Edit per topic; everything downstream just reads "A"/"B".
PERSPECTIVES: dict[str, dict[str, str]] = {
    "A": {
        "label": "Accelerationist",
        "voice": "Puck",
        "system": (
            "You are a Silicon Valley AI accelerationist. You believe the benefits "
            "of advanced AI vastly outweigh the risks. Argue with confidence using "
            "concrete examples — economic productivity, scientific breakthroughs, "
            "geopolitical necessity. Never preachy. 2-3 sentences per turn."
        ),
        "image_style": (
            "VERTICAL 9:16 PORTRAIT composition (taller than wide). Subject fills "
            "frame top-to-bottom. Optimistic tech-utopian aesthetic. Neon cyan and "
            "warm orange palette. Anamorphic lens flares. Cinematic, high-detail. "
            "NEVER wide / panoramic / landscape shots. NO text or watermarks."
        ),
    },
    "B": {
        "label": "Safety researcher",
        "voice": "Charon",
        "system": (
            "You are a rigorous AI safety researcher concerned about systemic risks "
            "from frontier AI: alignment failures, misuse, concentration of power. "
            "Make falsifiable arguments, cite specific failure modes, avoid vague "
            "doom-talk. 2-3 sentences per turn."
        ),
        "image_style": (
            "VERTICAL 9:16 PORTRAIT composition (taller than wide). Subject fills "
            "frame top-to-bottom. Ominous documentary aesthetic. Desaturated palette "
            "with cold blue and warning-red accents. Tight, slightly handheld framing. "
            "Realistic, not stylized. NEVER wide / panoramic / landscape shots. "
            "NO text or watermarks."
        ),
    },
}


# --- Stage 2: multi-agent perspective analysis ---------------------------


class TranscriptTurn(BaseModel):
    speaker: Literal["A", "B"]
    label: str
    text: str


def _persona_seed(persona_key: str, research_text: str) -> str:
    p = PERSPECTIVES[persona_key]
    return (
        f"{p['system']}\n\n"
        "Below is a deep research report on a contested topic. Use it as your "
        "source of truth — quote facts from it where possible.\n\n"
        f"--- RESEARCH ---\n{research_text[:8000]}\n--- END RESEARCH ---"
    )


def _turn(
    system_instruction: str, prompt: str, prev_id: str | None
) -> tuple[str, str]:
    interaction = client.interactions.create(
        model=PERSPECTIVE_MODEL,
        input=prompt,
        system_instruction=system_instruction,
        previous_interaction_id=prev_id,
    )
    return interaction.outputs[-1].text, interaction.id


def analyze_perspectives(research: dict, use_cache: bool = True) -> list[dict]:
    """Run NUM_TURNS_PER_SIDE turns per persona, alternating, stateful per side."""

    def _run() -> dict:
        seeds = {k: _persona_seed(k, research["text"]) for k in PERSPECTIVES}
        prev: dict[str, str | None] = {"A": None, "B": None}
        last_text: dict[str, str | None] = {"A": None, "B": None}
        transcript: list[TranscriptTurn] = []

        for turn_idx in range(NUM_TURNS_PER_SIDE):
            for side in ("A", "B"):
                opponent = "B" if side == "A" else "A"
                if turn_idx == 0:
                    prompt = "Make your strongest opening argument on this topic."
                else:
                    prompt = (
                        f"Your opponent ({PERSPECTIVES[opponent]['label']}) just said:\n\n"
                        f'"{last_text[opponent]}"\n\nRebut directly.'
                    )
                print(f"[perspectives] turn {turn_idx + 1} side {side}")
                text, iid = _turn(seeds[side], prompt, prev[side])
                prev[side] = iid
                last_text[side] = text
                transcript.append(
                    TranscriptTurn(
                        speaker=side, label=PERSPECTIVES[side]["label"], text=text
                    )
                )

        return {"turns": [t.model_dump() for t in transcript]}

    if not use_cache:
        return _run()["turns"]
    return cached_json(f"perspectives:{research['id']}", _run)["turns"]


# --- Stage 3: script generation -----------------------------------------


class ReelScript(BaseModel):
    perspective: Literal["A", "B"]
    hook: str
    body: str
    cta_to_next: str


class ScriptSet(BaseModel):
    scripts: list[ReelScript]


def generate_scripts(
    research: dict,
    transcript: list[dict],
    n: int = 4,
    use_cache: bool = True,
) -> list[ReelScript]:
    """Stage 3: Gemini Flash w/ structured JSON output → reel scripts, interleaved."""

    transcript_md = "\n\n".join(
        f"**{t['label']} ({t['speaker']})**: {t['text']}" for t in transcript
    )
    prompt = f"""You are writing scripts for short vertical-video reels. The full narration (hook + body) MUST fit in 25 seconds when read aloud — roughly 60 words / 400 characters TOTAL combined.

Generate exactly {n} reel scripts based on the research and the perspective debate below.
Rules:
- Interleave perspectives — alternate A/B/A/B/... so viewers can't game the watch-gate by only consuming one side.
- Each `hook` is one punchy sentence (<=12 words). This is the FIRST thing read aloud.
- Each `body` is ~45 words of narration in the perspective's voice. KEEP IT SHORT.
- Each `cta_to_next` is one sentence that teases the next reel. (NOT spoken; on-screen text only.)
- Cite specifics from the research where it strengthens the argument.
- Hook + body combined MUST be under 400 characters. Cut citations like "(Source 7)" — they don't read well aloud.

--- RESEARCH SUMMARY ---
{research["text"][:4000]}

--- PERSPECTIVE DEBATE ---
{transcript_md}
"""

    def _run() -> dict:
        print(f"[scripts] generating {n} scripts with {SCRIPT_MODEL}")
        response = client.models.generate_content(
            model=SCRIPT_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScriptSet,
            ),
        )
        return ScriptSet.model_validate_json(response.text).model_dump()

    if not use_cache:
        return [ReelScript(**s) for s in _run()["scripts"]]
    cache_key = f"scripts:{research['id']}:{n}:max{MAX_NARRATION_CHARS}"
    return [ReelScript(**s) for s in cached_json(cache_key, _run)["scripts"]]


# --- Stage 4: TTS narration ---------------------------------------------


def _save_pcm_as_wav(pcm: bytes, path: Path, sample_rate: int = 24000) -> None:
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)


def synthesize(scripts: list[ReelScript], prefix: str = "reel") -> list[Path]:
    """Stage 4: render each script to a WAV file, voice keyed to perspective.

    Disk-cached by output filename — if the WAV already exists it's reused."""
    out: list[Path] = []
    for i, s in enumerate(scripts):
        narration = f"{s.hook}\n\n{s.body}"
        if len(narration) > MAX_NARRATION_CHARS:
            narration = narration[:MAX_NARRATION_CHARS].rsplit(" ", 1)[0] + "."
            print(
                f"[tts] truncated reel {i} narration to "
                f"{len(narration)} chars (~{len(narration) / 15:.0f}s)"
            )
        voice = PERSPECTIVES[s.perspective]["voice"]
        path = OUTPUT_DIR / f"{prefix}_{i:02d}_{s.perspective}.wav"
        if path.exists():
            print(f"[tts] cache hit: {path.name}")
            out.append(path)
            continue
        print(f"[tts] {path.name} (voice={voice})")
        response = client.models.generate_content(
            model=TTS_MODEL,
            contents=narration,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice
                        )
                    )
                ),
            ),
        )
        audio = response.candidates[0].content.parts[0].inline_data.data
        _save_pcm_as_wav(audio, path)
        out.append(path)
    return out


# --- Stage 4b: Nano Banana stills for ken-burns backdrops ----------------


class VisualPrompts(BaseModel):
    prompts: list[str]


def derive_visual_prompts(
    script: ReelScript, n: int = STILLS_PER_REEL, use_cache: bool = True
) -> list[str]:
    """One Flash call → n distinct visual prompts mapped to beats of the reel."""
    p = PERSPECTIVES[script.perspective]
    instr = f"""You are a director storyboarding a {n}-shot VERTICAL 9:16 PORTRAIT reel for a 25-second narration. Each shot will be sent to a text-to-image model that respects portrait framing.

Persona: {p["label"]} ({script.perspective}).
Aesthetic preamble (LEAD EVERY PROMPT WITH THIS VERBATIM):
"{p["image_style"]}"

Narration:
"{script.hook} {script.body}"

Produce exactly {n} concise visual scene descriptions, one per beat (~6s each). Hard rules:
- Each prompt is 1-2 sentences, fully visual, cinematically shootable.
- Subject must fit a TALL VERTICAL frame: a person standing, a close-up face, a tower, a hand reaching up, a vertical streak of light. NO wide rooms, NO panoramic landscapes, NO "wide shot" / "establishing shot" language.
- Compose for portrait: vertical lines, stacked elements, top-to-bottom action.
- The {n} shots should flow narratively — opening, build, climax, resolution.
- Lead each prompt verbatim with the aesthetic preamble above."""

    def _run() -> dict:
        response = client.models.generate_content(
            model=SCRIPT_MODEL,
            contents=instr,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VisualPrompts,
            ),
        )
        return VisualPrompts.model_validate_json(response.text).model_dump()

    if not use_cache:
        return _run()["prompts"]
    # v2 key: bumped after vertical-composition prompt rewrite.
    return cached_json(
        f"viz:v2:{script.perspective}:{script.hook}:{n}", _run
    )["prompts"]


def generate_stills(
    scripts: list[ReelScript], n_per_reel: int = STILLS_PER_REEL
) -> dict[int, list[Path]]:
    """Generate `n_per_reel` stills per reel via Nano Banana. Disk-cached by filename."""
    out: dict[int, list[Path]] = {}
    for i, s in enumerate(scripts):
        prompts = derive_visual_prompts(s, n=n_per_reel)
        reel_paths: list[Path] = []
        for j, prompt in enumerate(prompts):
            path = STILLS_DIR / f"reel_{i:02d}_{s.perspective}_still_{j:02d}.png"
            if path.exists():
                print(f"[stills] cache hit: {path.name}")
                reel_paths.append(path)
                continue
            print(f"[stills] {path.name}")
            response = client.models.generate_content(
                model=IMAGE_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    image_config=types.ImageConfig(
                        aspect_ratio="9:16",
                        image_size="1K",
                    ),
                ),
            )
            saved = False
            for part in response.parts:
                img = part.as_image() if hasattr(part, "as_image") else None
                if img is not None:
                    img.save(path)
                    saved = True
                    break
            if not saved:
                raise RuntimeError(
                    f"Nano Banana returned no image for reel {i} still {j}"
                )
            reel_paths.append(path)
        out[i] = reel_paths
    return out
