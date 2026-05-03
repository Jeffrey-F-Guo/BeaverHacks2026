"""End-to-end pipeline runner.

Usage:
    python run_pipeline.py "Open source vs. closed AI models"
    python run_pipeline.py "..." --research-only        # stop after Stage 1
    python run_pipeline.py "..." --skip-tts             # skip Stage 4 (audio gen)
    python run_pipeline.py "..." --assemble             # add Stage 4b + final MP4

All stage outputs are cached under .cache/ + output/, so re-runs of the same
query are instant and free. The first run hits paid Deep Research, paid TTS,
and (with --assemble) paid Nano Banana image generation.
"""

import argparse
import sys

from assemble import assemble_all
from gemini_client import deep_research
from pipeline import (
    analyze_perspectives,
    generate_scripts,
    generate_stills,
    synthesize,
)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("query", help="Research question")
    p.add_argument("--research-only", action="store_true", help="Stop after Stage 1")
    p.add_argument("--skip-tts", action="store_true", help="Skip Stage 4 (TTS)")
    p.add_argument(
        "--assemble",
        action="store_true",
        help="After TTS, generate Nano Banana stills + assemble final MP4 reels",
    )
    p.add_argument("--n-scripts", type=int, default=4)
    p.add_argument("--no-cache", action="store_true", help="Bypass disk cache")
    args = p.parse_args()

    use_cache = not args.no_cache

    print(f"\n{'=' * 60}\nStage 1 — Deep Research\n{'=' * 60}")
    research = deep_research(args.query, use_cache=use_cache)
    print(f"[research] {len(research['text'])} chars cached")
    if args.research_only:
        print("\n--- preview ---\n" + research["text"][:600])
        return 0

    print(f"\n{'=' * 60}\nStage 2 — Multi-agent perspective analysis\n{'=' * 60}")
    transcript = analyze_perspectives(research, use_cache=use_cache)
    print(f"[perspectives] {len(transcript)} turns")

    print(f"\n{'=' * 60}\nStage 3 — Script generation\n{'=' * 60}")
    scripts = generate_scripts(
        research, transcript, n=args.n_scripts, use_cache=use_cache
    )
    for i, s in enumerate(scripts):
        print(f"\nReel {i + 1} [{s.perspective}] {s.hook}")
        print(f"  {s.body[:100]}...")

    if args.skip_tts:
        print("\n[done] skipped TTS")
        return 0

    print(f"\n{'=' * 60}\nStage 4 — TTS narration\n{'=' * 60}")
    paths = synthesize(scripts)
    print(f"\n[tts] {len(paths)} audio files written:")
    for p_ in paths:
        print(f"  - {p_}")

    if not args.assemble:
        print("\n[done] skipped assembly (pass --assemble to build MP4 reels)")
        return 0

    print(f"\n{'=' * 60}\nStage 4b — Nano Banana stills\n{'=' * 60}")
    stills = generate_stills(scripts)

    print(f"\n{'=' * 60}\nAssembly — ken-burns + captions → MP4\n{'=' * 60}")
    reels = assemble_all(scripts, stills)
    print(f"\n[done] {len(reels)} reels written:")
    for r in reels:
        print(f"  - {r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
