-- Table: retouch_sessions
-- Run this in Supabase SQL editor to isolate retouch task data
CREATE TABLE IF NOT EXISTS retouch_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  strength TEXT NOT NULL,
  original_url TEXT NOT NULL,
  output_url TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retouch_user_id ON retouch_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_retouch_created_at ON retouch_sessions(created_at DESC);

ALTER TABLE retouch_sessions DISABLE ROW LEVEL SECURITY;
