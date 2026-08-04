-- ============================================================
-- Boutiqaat Quick Create Studio — Database Migration
-- Table: quick_create_sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS quick_create_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'image',
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  ratio TEXT NOT NULL DEFAULT '16:9',
  quality TEXT NOT NULL DEFAULT '1k',
  status TEXT NOT NULL DEFAULT 'QUEUED',
  attachments JSONB DEFAULT '[]',
  outputs JSONB DEFAULT '[]',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quick_create_user_id ON quick_create_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_quick_create_created_at ON quick_create_sessions(created_at DESC);

-- Disable RLS
ALTER TABLE quick_create_sessions DISABLE ROW LEVEL SECURITY;
