-- ==============================================================================
-- 005_multi_division_manager_system.sql
-- Enterprise Multi-Division Multi-Tenancy, Team Creative Gallery & Notifications
-- ==============================================================================

-- 1. Departments / Divisions Table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  monthly_budget_usd NUMERIC(10, 3) DEFAULT 500.000,
  critical_threshold_percent INT DEFAULT 90,
  auto_pause_on_critical BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Extended Users Table
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_credit_limit_usd NUMERIC(10, 3) DEFAULT 50.000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_used_usd NUMERIC(10, 3) DEFAULT 0.000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_models JSONB DEFAULT '["image", "video", "social-resize", "bundling"]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- 3. Team Creative Gallery & Style Presets Table
CREATE TABLE IF NOT EXISTS team_creative_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(50) NOT NULL, -- 'image' | 'video' | 'psd'
  prompt TEXT NOT NULL,
  model_used VARCHAR(100) NOT NULL,
  settings_snapshot JSONB NOT NULL DEFAULT '{}',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  starred_by_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_company_preset BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_department_id ON team_creative_gallery(department_id);
CREATE INDEX IF NOT EXISTS idx_gallery_created_at ON team_creative_gallery(created_at DESC);

-- 4. Real-Time Notification Center Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'BUDGET_ALERT' | 'QUOTA_WARNING' | 'GALLERY_STAR' | 'TASK_DONE'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_department_id ON notifications(department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- 5. Seed Initial Default Departments
INSERT INTO departments (id, name, description, monthly_budget_usd, critical_threshold_percent, auto_pause_on_critical)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Social Media Marketing', 'Social Media and campaign assets generation', 500.000, 90, false),
  ('b0000000-0000-0000-0000-000000000002', 'E-Commerce Catalog', 'Product catalog, bundling, and e-commerce visuals', 800.000, 90, false)
ON CONFLICT (id) DO NOTHING;

-- 6. Disable Row Level Security for custom API service-role management
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_creative_gallery DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
