-- ============================================================================
-- BOUTIQAAT CREATIVE AI STUDIO - MASTER DATABASE SCHEMA (RELEASE 1)
-- Target: PostgreSQL 14+ / AWS RDS / Amazon Aurora Serverless v2 / Local DB
-- Compatible with: Microsoft Graph SSO & Email-Driven Role Architecture
-- ============================================================================

-- Enable UUID Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. DEPARTMENTS TABLE (Team Partitioning & Budgets) ────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,             -- 'CONTENT', 'DIGITAL_MARKETING', 'MARKETING'
  name VARCHAR(150) NOT NULL,                    -- 'Content Production Team'
  description TEXT,
  default_user_budget_usd DECIMAL(10,2) DEFAULT 100.00,
  monthly_budget_ceiling_usd DECIMAL(10,2) DEFAULT 500.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Official Boutiqaat Departments
INSERT INTO departments (id, code, name, description, default_user_budget_usd, monthly_budget_ceiling_usd)
VALUES 
  ('dept_content_01', 'CONTENT', 'Content Production Team', 'Photo editing, model cutout & creative image retouching', 100.00, 500.00),
  ('dept_dm_02', 'DIGITAL_MARKETING', 'Digital Marketing Team', 'Social banners, paid ad resize, 9:16 story variations', 100.00, 500.00),
  ('dept_marketing_03', 'MARKETING', 'Marketing & Brand Strategy', 'Campaign hero imagery, brand standardisation & promotions', 100.00, 500.00)
ON CONFLICT (code) DO NOTHING;

-- ── 2. USERS TABLE (Microsoft Graph SSO Account Store) ─────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_graph_id VARCHAR(100) UNIQUE,               -- Permanent Azure Entra Object ID (oid)
  ms_tenant_id VARCHAR(100),                     -- Boutiqaat Azure Tenant ID (tid)
  email VARCHAR(255) UNIQUE NOT NULL,            -- Corporate userPrincipalName
  name VARCHAR(150) NOT NULL,                    -- Display Name from M365
  auth_provider VARCHAR(50) DEFAULT 'microsoft_graph',
  avatar_url TEXT,                               -- Synced photo from Graph API
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_ms_graph_id ON users(ms_graph_id);

-- ── 3. ADMINS REGISTRY (Platform Super Admins - Scope: All) ────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,            -- Admin Corporate Email
  ms_graph_id VARCHAR(100) UNIQUE,               -- Auto-linked upon first login
  name VARCHAR(150) NOT NULL,
  title VARCHAR(100) DEFAULT 'Studio Admin',
  can_manage_billing BOOLEAN DEFAULT TRUE,
  can_manage_apikeys BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. MANAGERS REGISTRY (Department Leads - Scope: Team) ─────────────────────
CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,            -- Manager Corporate Email
  ms_graph_id VARCHAR(100) UNIQUE,               -- Auto-linked upon first login
  name VARCHAR(150) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  monthly_budget_ceiling_usd DECIMAL(10,2) DEFAULT 500.00,
  can_export_reports BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_managers_dept ON managers(department_id);

-- ── 5. CREATORS REGISTRY (Editors - Scope: Own) ───────────────────────────────
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,            -- Creator Corporate Email
  ms_graph_id VARCHAR(100) UNIQUE,               -- Auto-linked upon first login
  name VARCHAR(150) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  manager_id UUID REFERENCES managers(id) ON DELETE SET NULL,
  monthly_quota_usd DECIMAL(10,2) DEFAULT 100.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creators_dept ON creators(department_id);
CREATE INDEX IF NOT EXISTS idx_creators_mgr ON creators(manager_id);

-- ── 6. TASKS TABLE (Release 1 Image Suite Generation Pipeline) ────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(100) PRIMARY KEY,                   -- UUID v4
  runninghub_task_id VARCHAR(100),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  module VARCHAR(50) NOT NULL,                   -- 'flow', 'social_resize', 'bg_remove', 'retouch'
  app_name VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',  -- 'QUEUED', 'RUNNING', 'SUCCESS', 'FAILED'
  api_key_type VARCHAR(20) DEFAULT 'consumer',
  generation_params JSONB DEFAULT '{}',
  node_info_list JSONB DEFAULT '[]',
  outputs JSONB DEFAULT '[]',
  cost_usd DECIMAL(10,4) DEFAULT 0.0000,
  coins_used DECIMAL(10,2) DEFAULT 0.00,
  duration_seconds INTEGER DEFAULT 0,
  error_message TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_dept_date ON tasks(department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_module_status ON tasks(module, status, created_at DESC);

-- ── 7. INDIVIDUAL APP PROJECT STORES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_projects (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  viewport JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retouch_sessions (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  original_image_url TEXT NOT NULL,
  retouched_image_url TEXT,
  mask_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layers_projects (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  source_image_url TEXT NOT NULL,
  layers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bundling_sessions (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200),
  elements JSONB DEFAULT '[]',
  background_settings JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. GOVERNANCE, FINANCIAL LEDGERS & AUDIT TRAIL ────────────────────────────
CREATE TABLE IF NOT EXISTS department_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL,                -- 'YYYY-MM'
  allocated_budget_usd DECIMAL(10,2) NOT NULL,
  actual_spend_usd DECIMAL(10,4) DEFAULT 0.0000,
  actual_coins_used DECIMAL(10,2) DEFAULT 0.00,
  total_task_count INTEGER DEFAULT 0,
  success_task_count INTEGER DEFAULT 0,
  failed_task_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, month_year)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,                   -- 'GENERATE', 'RETRY', 'DELETE', 'EXPORT', 'BUDGET_SET'
  target_type VARCHAR(50) NOT NULL,              -- 'task', 'user', 'department'
  target_id VARCHAR(100),
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_dept_date ON audit_logs(department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_date ON audit_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS team_creative_gallery (
  id VARCHAR(100) PRIMARY KEY,
  task_id VARCHAR(100) REFERENCES tasks(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  starred_by_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_company_preset BOOLEAN DEFAULT FALSE,
  title VARCHAR(200),
  prompt TEXT,
  media_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. REAL-TIME APP CONTROLS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_controls (
  id VARCHAR(50) PRIMARY KEY,
  app_id VARCHAR(50) UNIQUE NOT NULL,
  app_name VARCHAR(150) NOT NULL,
  route_path VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- 'ACTIVE', 'COMING_SOON', 'UNDER_MAINTENANCE'
  custom_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_controls (id, app_id, app_name, route_path, status, custom_message)
VALUES
  ('ctrl_flow', 'boutiqaat_flow', 'Boutiqaat Flow Studio', '/boutiqaat-flow', 'ACTIVE', 'Online and operating normally.'),
  ('ctrl_resize', 'social_resize', 'Social Resize Studio', '/studio/social-resize', 'ACTIVE', 'Online and operating normally.'),
  ('ctrl_retouch', 'auto_retouch', 'Auto-Retouch Studio', '/studio/auto-retouch', 'ACTIVE', 'Online and operating normally.'),
  ('ctrl_bg_remove', 'batch_remove_bg', 'Batch Background Removal', '/studio', 'ACTIVE', 'Online and operating normally.'),
  ('ctrl_layers', 'boutiqaat_layers', 'Boutiqaat Layers Studio', '/layers', 'COMING_SOON', 'This feature is currently in preparation and will be available in the next release.'),
  ('ctrl_bundling', 'boutiqaat_bundling', 'Boutiqaat Bundling Studio', '/bundling', 'COMING_SOON', 'This feature is currently in preparation and will be available in the next release.'),
  ('ctrl_video', 'video_studio', 'Video Studio', '/video', 'COMING_SOON', 'This feature is currently in preparation and will be available in the next release.')
ON CONFLICT (app_id) DO UPDATE SET status = EXCLUDED.status, custom_message = EXCLUDED.custom_message;

-- ── 10. ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_select_policy ON tasks
  FOR SELECT
  USING (
    auth.role() = 'admin'
    OR (auth.role() = 'manager' AND department_id = auth.department_id())
    OR (auth.role() = 'creator' AND user_id = auth.uid())
  );

CREATE POLICY tasks_insert_policy ON tasks
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY tasks_update_policy ON tasks
  FOR UPDATE
  USING (
    auth.role() = 'admin'
    OR (auth.role() = 'manager' AND department_id = auth.department_id())
    OR (auth.role() = 'creator' AND user_id = auth.uid())
  );

CREATE POLICY tasks_delete_policy ON tasks
  FOR DELETE
  USING (
    auth.role() = 'admin'
    OR user_id = auth.uid()
  );

CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  USING (
    auth.role() = 'admin'
    OR (auth.role() = 'manager' AND department_id = auth.department_id())
  );

CREATE POLICY department_budgets_select_policy ON department_budgets
  FOR SELECT
  USING (
    auth.role() = 'admin'
    OR (auth.role() = 'manager' AND department_id = auth.department_id())
  );
