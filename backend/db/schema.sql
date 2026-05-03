CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    topic_slug TEXT NOT NULL UNIQUE,
    pole_a TEXT,
    pole_b TEXT,
    pipeline_status JSONB NOT NULL DEFAULT '{"research": "pending", "debate": "pending", "summary": "pending"}',
    research_raw TEXT,
    research_viz_urls JSONB DEFAULT '[]',
    research_interaction_id TEXT,
    briefing JSONB,
    debate_summary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debate_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    speaker TEXT NOT NULL CHECK (speaker IN ('red', 'blue')),
    argument TEXT NOT NULL,
    key_claim TEXT NOT NULL,
    concession TEXT,
    interaction_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_rounds ENABLE ROW LEVEL SECURITY;
