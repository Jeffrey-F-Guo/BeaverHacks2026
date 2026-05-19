-- =====================================================================
-- Verdict schema. Run in Supabase SQL editor.
-- Idempotent: re-running on an existing DB is safe.
-- =====================================================================

CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    topic_slug TEXT NOT NULL UNIQUE,
    pole_a TEXT,
    pole_b TEXT,
    pipeline_status JSONB NOT NULL DEFAULT '{"research": "pending", "debate": "pending", "summary": "pending", "scripts": "pending", "audio": "pending", "video": "pending"}',
    research_raw TEXT,
    research_viz_urls JSONB DEFAULT '[]',
    research_interaction_id TEXT,
    briefing JSONB,
    debate_summary JSONB,
    scripts JSONB,                          -- list[ShortScript]
    audio_urls JSONB DEFAULT '[]',          -- 6 Storage URLs
    video_urls JSONB DEFAULT '[]',          -- 6 Storage URLs
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- New columns for stages 3-5 (additive — safe on existing databases)
ALTER TABLE topics ADD COLUMN IF NOT EXISTS scripts JSONB;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS audio_urls JSONB DEFAULT '[]';
ALTER TABLE topics ADD COLUMN IF NOT EXISTS video_urls JSONB DEFAULT '[]';

-- Backfill new pipeline_status keys on rows created before stages 3-5 existed.
-- Uses '||' (JSONB concat with right-side precedence on duplicate keys) to
-- preserve any existing stage values while filling in the missing ones.
UPDATE topics
SET pipeline_status = '{"scripts": "pending", "audio": "pending", "video": "pending"}'::jsonb || pipeline_status
WHERE NOT (pipeline_status ? 'scripts' AND pipeline_status ? 'audio' AND pipeline_status ? 'video');


CREATE TABLE IF NOT EXISTS debate_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    speaker TEXT NOT NULL CHECK (speaker IN ('red', 'blue')),
    argument TEXT NOT NULL,
    key_claim TEXT NOT NULL,
    concession TEXT,
    evidence_cited JSONB DEFAULT '[]',    -- model-generated list of specific stats/facts cited
    search_queries JSONB DEFAULT '[]',    -- queries extracted from google_search_call outputs
    search_sources JSONB DEFAULT '[]',    -- {url, title} pairs from google_search_result outputs
    interaction_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Additive columns for existing databases
ALTER TABLE debate_rounds ADD COLUMN IF NOT EXISTS evidence_cited JSONB DEFAULT '[]';
ALTER TABLE debate_rounds ADD COLUMN IF NOT EXISTS search_queries JSONB DEFAULT '[]';
ALTER TABLE debate_rounds ADD COLUMN IF NOT EXISTS search_sources JSONB DEFAULT '[]';


CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    position REAL NOT NULL CHECK (position >= 0.0 AND position <= 1.0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_topic ON votes(topic_id);


ALTER TABLE topics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_rounds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes          ENABLE ROW LEVEL SECURITY;

-- Public read on topics + read-and-insert on votes (so anon clients can vote
-- and see distributions). The service-role key (used by the backend) bypasses
-- RLS, so writes from FastAPI work regardless.
DROP POLICY IF EXISTS "topics_public_read"  ON topics;
DROP POLICY IF EXISTS "votes_public_read"   ON votes;
DROP POLICY IF EXISTS "votes_public_insert" ON votes;

CREATE POLICY "topics_public_read"  ON topics FOR SELECT USING (true);
CREATE POLICY "votes_public_read"   ON votes  FOR SELECT USING (true);
CREATE POLICY "votes_public_insert" ON votes  FOR INSERT WITH CHECK (true);
