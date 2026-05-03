# Stage 2.5 — Debate Summary
#
# Single Gemini Flash call that synthesizes the full debate transcript into the 3-5
# strongest points per side. Reads key_claim (and optionally concession) from all
# debate_rounds rows for the topic, grouped by speaker.
#
# Output is a DebateSummary object stored to topics.debate_summary (JSONB).
# This is consumed by Stage 3 (script generation) to write the video narration scripts.
# Pipeline status set to "complete" after the summary is saved.
