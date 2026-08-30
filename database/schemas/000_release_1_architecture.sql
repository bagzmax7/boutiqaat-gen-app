-- ============================================================================
-- BOUTIQAAT CREATIVE AI STUDIO - RELEASE 1 DATABASE SCHEMA & RLS POLICIES
-- Target: PostgreSQL 14+ / AWS RDS / Amazon Aurora Serverless v2 / Local DB
-- Specification: User Profiles, Permitted vs Forbidden Actions (Release 1)
-- Date: August 2026
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DEPARTMENTS TABLE
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

-- 2. USERS TABLE (Microsoft Graph SSO Account Store)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_graph_id VARCHAR(100) UNIQUE,               -- Permanent Azure Entra Object ID (oid)
  ms_tenant_id VARCHAR(100),                     -- Boutiqaat Tenant ID (tid)
  email VARCHAR(255) UNIQUE NOT NULL,            -- Corporate email (userPrincipalName)
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

-- 3. ADMINS TABLE (Platform Super Admins - Scope: All)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,            -- Admin Email
  ms_graph_id VARCHAR(100) UNIQUE,               -- Auto-linked upon login
  name VARCHAR(150) NOT NULL,
  title VARCHAR(100) DEFAULT 'Studio Admin',
  can_manage_billing BOOLEAN DEFAULT TRUE,
  can_manage_apikeys BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MANAGERS TABLE (Department Leads - Scope: Own + Department Team)
CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,            -- Manager Email
  ms_graph_id VARCHAR(100) UNIQUE,               -- Auto-linked upon login
  name VARCHAR(150) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  monthly_budget_ceiling_usd DECIMAL(10,2) DEFAULT 500.00,
  can_export_reports BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_managers_dept ON managers(department_id);

-- 5. CREATORS TABLE (Content Creators / Editors - Scope: Own Only)
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,            -- Creator Email
  ms_graph_id VARCHAR(100) UNIQUE,               -- Auto-linked upon login
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

-- 6. TASKS TABLE (Release 1 Image Suite: Social Resize, BG Remove, Retouch, Flow)
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

-- 7. DEPARTMENT BUDGETS (Pre-aggregated Monthly Ledgers)
CREATE TABLE IF NOT EXISTS department_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL,                -- 'YYYY-MM' (e.g. '2026-08')
  allocated_budget_usd DECIMAL(10,2) NOT NULL,
  actual_spend_usd DECIMAL(10,4) DEFAULT 0.0000,
  actual_coins_used DECIMAL(10,2) DEFAULT 0.00,
  total_task_count INTEGER DEFAULT 0,
  success_task_count INTEGER DEFAULT 0,
  failed_task_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, month_year)
);

-- 8. AUDIT LOGS TABLE (Governance & Action Tracking)
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

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES ENFORCING PERMISSION MATRIX
-- ============================================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_budgets ENABLE ROW LEVEL SECURITY;

-- TASKS: SELECT / DOWNLOAD / HISTORY
-- Creator: user_id = auth.uid()
-- Manager: department_id = auth.dept_id()
-- Admin: TRUE
CREATE POLICY tasks_select_policy ON tasks
  FOR SELECT
  USING (
    auth.role() = 'admin'
    OR (auth.role() = 'manager' AND department_id = auth.department_id())
    OR (auth.role() = 'creator' AND user_id = auth.uid())
  );

-- TASKS: INSERT / GENERATE
-- Dispatches always belong to current authenticated user
CREATE POLICY tasks_insert_policy ON tasks
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- TASKS: UPDATE / RETRY
-- Creator: user_id = auth.uid()
-- Manager: department_id = auth.dept_id()
-- Admin: TRUE
CREATE POLICY tasks_update_policy ON tasks
  FOR UPDATE
  USING (
    auth.role() = 'admin'
    OR (auth.role() = 'manager' AND department_id = auth.department_id())
    OR (auth.role() = 'creator' AND user_id = auth.uid())
  );

-- TASKS: DELETE
-- Creator & Manager: user_id = auth.uid() (Managers CANNOT delete team members' tasks!)
-- Admin: TRUE
CREATE POLICY tasks_delete_policy ON tasks
  FOR DELETE
  USING (
    auth.role() = 'admin'
    OR user_id = auth.uid()
  );

-- AUDIT LOGS: SELECT
-- Manager: department_id = auth.dept_id()
-- Admin: TRUE
-- Creator: FALSE
CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  USING (
    auth.role() = 'admin'
    OR (auth.role() = 'manager' AND department_id = auth.department_id())
  );

-- BUDGETS: SELECT
-- Manager: department_id = auth.dept_id()
-- Admin: TRUE
-- Creator: FALSE
CREATE POLICY department_budgets_select_policy ON department_budgets
  FOR SELECT
  USING (
    auth.role() = 'admin'
    OR (auth.role() = 'manager' AND department_id = auth.department_id())
  );
