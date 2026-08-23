-- Migration 006: Dedicated Schema for Boutiqaat Layers Studio Projects & History

CREATE TABLE IF NOT EXISTS layers_projects (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  thumbnail_url TEXT,
  canvas_width INTEGER DEFAULT 1200,
  canvas_height INTEGER DEFAULT 1200,
  layers JSONB NOT NULL DEFAULT '[]',
  revision_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_layers_projects_user_id
  ON layers_projects(user_id);

CREATE INDEX IF NOT EXISTS idx_layers_projects_updated_at
  ON layers_projects(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_layers_projects_department_id
  ON layers_projects(department_id);

ALTER TABLE layers_projects DISABLE ROW LEVEL SECURITY;
