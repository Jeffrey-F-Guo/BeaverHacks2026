# Stage 2 — Adversarial Debate (background process, not user-facing)
#
# Runs two stateful Gemini Flash sessions (Red agent vs Blue agent) for 6 rounds.
# Purely a content generation step — its output feeds Stage 3 script generation,
# which turns the debate into video narration. Users watch the resulting videos;
# they never interact with the debate agents directly.
#
# Red argues for Pole A, Blue argues for Pole B, using the persona prompts from Stage 1.
# Each agent maintains its own turn history server-side via previous_interaction_id —
# only the opponent's latest argument is injected each turn.
#
# Every turn is written to debate_rounds immediately after the API call returns (not batched)
# so the pipeline can resume from any point on retry.
#
# Output: 12 rows in debate_rounds (6 rounds × 2 speakers), each with argument, key_claim,
# and optional concession. Pipeline status set to "complete" after all 12 turns are saved.
