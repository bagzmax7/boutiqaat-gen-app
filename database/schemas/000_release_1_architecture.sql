-- ============================================================================
-- BOUTIQAAT CREATIVE AI STUDIO - RELEASE 1 DATABASE SCHEMA & RLS POLICIES
-- Target: PostgreSQL 14+ / AWS RDS / Amazon Aurora Serverless v2 / Local DB
-- Date: August 2026
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DEPARTMENTS
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  default_user_budget_usd DECIMAL(10,2) DEFAULT 100.00,
  monthly_budget_ceiling_usd DECIMAL(10,2) DEFAULT 500.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (Microsoft Graph SSO)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_graph_id VARCHAR(100) UNIQUE,
  ms_tenant_id VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  auth_provider VARCHAR(50) DEFAULT 'microsoft_graph',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_ms_graph_id ON users(ms_graph_id);

-- 3. ADMINS (Scope: All)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  ms_graph_id VARCHAR(100) UNIQUE,
  name VARCHAR(150) NOT NULL,
  title VARCHAR(100) DEFAULT 'Studio Admin',
  can_manage_billing BOOLEAN DEFAULT TRUE,
  can_manage_apikeys BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MANAGERS (Scope: Team)
CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  ms_graph_id VARCHAR(100) UNIQUE,
  name VARCHAR(150) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  monthly_budget_ceiling_usd DECIMAL(10,2) DEFAULT 500.00,
  can_export_reports BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CREATORS (Scope: Own)
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  ms_graph_id VARCHAR(100) UNIQUE,
  name VARCHAR(150) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  manager_id UUID REFERENCES managers(id) ON DELETE SET NULL,
  monthly_quota_usd DECIMAL(10,2) DEFAULT 100.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TASKS (Release 1 Image Suite: Social Resize, BG Remove, Retouch, Flow)
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(100) PRIMARY KEY,
  runninghub_task_id VARCHAR(100),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  module VARCHAR(50) NOT NULL,
  app_name VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
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

-- 7. DEPARTMENT BUDGETS
CREATE TABLE IF NOT EXISTS department_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL,
  allocated_budget_usd DECIMAL(10,2) NOT NULL,
  actual_spend_usd DECIMAL(10,4) DEFAULT 0.0000,
  actual_coins_used DECIMAL(10,2) DEFAULT 0.00,
  total_task_count INTEGER DEFAULT 0,
  success_task_count INTEGER DEFAULT 0,
  failed_task_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, month_year)
);

-- 8. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100),
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_dept_date ON audit_logs(department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_date ON audit_logs(user_id, created_at DESC);
