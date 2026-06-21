-- ============================================================
-- Boutiqaat Bundling Studio — Database Migration
-- Table: bundling_sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS bundling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  product_images TEXT[] NOT NULL DEFAULT '{}',
  product_names TEXT[] DEFAULT '{}',
  dimensions_analysis JSONB NOT NULL DEFAULT '{}',
  final_prompt TEXT NOT NULL DEFAULT '',
  generated_image_url TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  rating_feedback TEXT,
  is_favorite BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bundling_sessions_user_id ON bundling_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_bundling_sessions_created_at ON bundling_sessions(created_at DESC);

-- Enable RLS
ALTER TABLE bundling_sessions ENABLE ROW LEVEL SECURITY;

-- Policies (service role key bypasses RLS on server side)
DROP POLICY IF EXISTS "Allow all for service role" ON bundling_sessions;
CREATE POLICY "Allow all for service role" ON bundling_sessions
  FOR ALL USING (true) WITH CHECK (true);
