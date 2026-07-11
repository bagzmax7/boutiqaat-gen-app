-- ============================================================
-- Boutiqaat Image Agent — Database Migration
-- Table: image_agent_sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS image_agent_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_image_agent_sessions_user_id ON image_agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_image_agent_sessions_updated_at ON image_agent_sessions(updated_at DESC);

-- Enable RLS
ALTER TABLE image_agent_sessions ENABLE ROW LEVEL SECURITY;

-- Policies (service role key bypasses RLS on server side)
DROP POLICY IF EXISTS "Allow all for service role" ON image_agent_sessions;
CREATE POLICY "Allow all for service role" ON image_agent_sessions
  FOR ALL USING (true) WITH CHECK (true);
