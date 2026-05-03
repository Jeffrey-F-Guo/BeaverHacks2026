"""Gemini SDK client singleton + thin per-modality helpers.

Every other module imports `client` from here so we don't end up with one
genai.Client per stage. The helpers (tts, generate_image, save_pcm_as_wav)
exist so Stage 4 / Stage 5 don't repeat the same 15-line API call.
"""

import os
import wave
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image

load_dotenv()

_api_key = os.environ.get("GEMINI_API_KEY")
if not _api_key:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Copy .env.example to .env and paste your key."
    )

client = genai.Client(api_key=_api_key)

SMOKE_MODEL = "gemini-3-flash-preview"
# TTS has no Gemini 3 release yet — stay on 2.5 until one ships.
TTS_MODEL = "gemini-2.5-flash-preview-tts"
# Nano Banana Flash. ~5× cheaper than the Gemini 3 Pro variant
# ("gemini-3-pro-image-preview") with comparable quality at 9:16/1K.
IMAGE_MODEL = "gemini-2.5-flash-image"

TTS_SAMPLE_RATE = 24000  # 16-bit mono PCM out of TTS_MODEL


def smoke() -> str:
    """One cheap call. Validates the key + SDK plumbing."""
    interaction = client.interactions.create(
        model=SMOKE_MODEL,
        input="Reply with exactly one word: pong.",
    )
    return interaction.outputs[-1].text


def tts(text: str, voice: str) -> bytes:
    """Synthesize narration to PCM bytes with the given prebuilt voice."""
    response = client.models.generate_content(
        model=TTS_MODEL,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                )
            ),
        ),
    )
    return response.candidates[0].content.parts[0].inline_data.data


def save_pcm_as_wav(pcm: bytes, path: Path, sample_rate: int = TTS_SAMPLE_RATE) -> None:
    """Wrap raw 16-bit mono PCM bytes in a WAV header and write to disk."""
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)


def generate_image(prompt: str, aspect_ratio: str = "9:16", image_size: str = "1K") -> Image.Image:
    """Nano Banana → first PIL Image in the response. Raises if no image returned."""
    response = client.models.generate_content(
        model=IMAGE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            image_config=types.ImageConfig(aspect_ratio=aspect_ratio, image_size=image_size),
        ),
    )
    for part in response.parts:
        img = part.as_image() if hasattr(part, "as_image") else None
        if img is not None:
            return img
    raise RuntimeError(f"Nano Banana returned no image for prompt: {prompt[:80]}")
