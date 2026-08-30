#!/usr/bin/env python3
"""
Boutiqaat Creative AI Studio - Database Initializer
File: db.py
Author: Boutiqaat AI Strategy & Innovation Team

Description:
  Automates the initialization of the complete Release 1 database on any server or local environment.
  Creates all 17 dataset tables, schema DDL, permission matrix, and storage bucket directories.

Usage:
  python db.py
  python db.py --path /custom/path/to/database
  python db.py --help
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone
from pathlib import Path

def get_iso_now():
    return datetime.now(timezone.utc).isoformat()

def build_database(target_root_dir):
    print("=" * 70)
    print("BOUTIQAAT CREATIVE AI STUDIO - DATABASE INITIALIZER (RELEASE 1)")
    print("=" * 70)
    print(f"Target Directory: {os.path.abspath(target_root_dir)}\n")

    root_path = Path(target_root_dir)
    tables_path = root_path / "tables"
    schemas_path = root_path / "schemas"
    storage_path = root_path / "storage"
    backups_path = root_path / "backups"

    # 1. Create directory structure
    for d in [root_path, tables_path, schemas_path, storage_path, backups_path]:
        d.mkdir(parents=True, exist_ok=True)
    print("[OK] Created directory hierarchy: tables/, schemas/, storage/, backups/")

    # 2. Create Storage Buckets
    buckets = ["generated-results", "product-images", "layers_assets"]
    for b in buckets:
        (storage_path / b).mkdir(parents=True, exist_ok=True)
    print("[OK] Created storage cache buckets: generated-results, product-images, layers_assets")

    now = get_iso_now()

    # 3. Define All 17 Database Tables
    database_tables = {
        # --- 1. Identity & Role Layer ---
        "departments.json": [
            {
                "id": "dept_content_01",
                "code": "CONTENT",
                "name": "Content Production Team",
                "description": "Photo editing, model cutout & creative image retouching",
                "default_user_budget_usd": 100.0,
                "monthly_budget_ceiling_usd": 500.0,
                "is_active": True,
                "created_at": now,
                "updated_at": now
            },
            {
                "id": "dept_dm_02",
                "code": "DIGITAL_MARKETING",
                "name": "Digital Marketing Team",
                "description": "Social banners, paid ad resize, 9:16 story variations",
                "default_user_budget_usd": 100.0,
                "monthly_budget_ceiling_usd": 500.0,
                "is_active": True,
                "created_at": now,
                "updated_at": now
            },
            {
                "id": "dept_marketing_03",
                "code": "MARKETING",
                "name": "Marketing & Brand Strategy",
                "description": "Campaign hero imagery, brand standardisation & promotions",
                "default_user_budget_usd": 100.0,
                "monthly_budget_ceiling_usd": 500.0,
                "is_active": True,
                "created_at": now,
                "updated_at": now
            }
        ],
        "admins.json": [],      # Clean registry for Super Admins
        "managers.json": [],    # Clean registry for Supervisors
        "creators.json": [],    # Clean registry for Editors / Creators
        "users.json": [],       # Clean Microsoft Graph SSO Account Store

        # --- 2. Core Generation Pipeline ---
        "tasks.json": [],       # Clean 0 tasks

        # --- 3. App-Specific Project Stores ---
        "flow_projects.json": [],          # Boutiqaat Flow Studio
        "retouch_projects.json": [],        # Auto-Retouch Projects
        "retouch_sessions.json": [],        # Auto-Retouch Polish Sessions
        "social_resize_projects.json": [],  # Social Resize Outpaint
        "layers_projects.json": [],         # Layers Decomposition
        "bundling_sessions.json": [],       # Bundling Studio Multi-SKU
        "image_agent_sessions.json": [],    # Image Agent Workflows

        # --- 4. Governance & Financial Layer ---
        "department_budgets.json": [],   # Monthly Spend Ledgers
        "audit_logs.json": [],           # Action Tracking
        "team_creative_gallery.json": [],# Manager Starred Assets & Presets
        "notifications.json": [],        # Notification Stream

        # --- 5. System Controls ---
        "app_controls.json": [
            {
                "id": "ctrl_flow",
                "app_id": "boutiqaat_flow",
                "app_name": "Boutiqaat Flow Studio",
                "route_path": "/boutiqaat-flow",
                "status": "ACTIVE",
                "custom_message": "Online and operating normally.",
                "updated_at": now
            },
            {
                "id": "ctrl_resize",
                "app_id": "social_resize",
                "app_name": "Social Resize Studio",
                "route_path": "/studio/social-resize",
                "status": "ACTIVE",
                "custom_message": "Online and operating normally.",
                "updated_at": now
            },
            {
                "id": "ctrl_retouch",
                "app_id": "auto_retouch",
                "app_name": "Auto-Retouch Studio",
                "route_path": "/studio/auto-retouch",
                "status": "ACTIVE",
                "custom_message": "Online and operating normally.",
                "updated_at": now
            },
            {
                "id": "ctrl_bg_remove",
                "app_id": "batch_remove_bg",
                "app_name": "Batch Background Removal",
                "route_path": "/studio",
                "status": "ACTIVE",
                "custom_message": "Online and operating normally.",
                "updated_at": now
            },
            {
                "id": "ctrl_layers",
                "app_id": "boutiqaat_layers",
                "app_name": "Boutiqaat Layers Studio",
                "route_path": "/layers",
                "status": "COMING_SOON",
                "custom_message": "This feature is currently in preparation and will be available in the next release.",
                "updated_at": now
            },
            {
                "id": "ctrl_bundling",
                "app_id": "boutiqaat_bundling",
                "app_name": "Boutiqaat Bundling Studio",
                "route_path": "/bundling",
                "status": "COMING_SOON",
                "custom_message": "This feature is currently in preparation and will be available in the next release.",
                "updated_at": now
            },
            {
                "id": "ctrl_video",
                "app_id": "video_studio",
                "app_name": "Video Studio",
                "route_path": "/video",
                "status": "COMING_SOON",
                "custom_message": "This feature is currently in preparation and will be available in the next release.",
                "updated_at": now
            }
        ],

        # --- 6. Machine-Readable Permissions & RLS Matrix ---
        "permissions_matrix.json": {
            "version": "1.0.0",
            "release": "Release 1 (Image Suite)",
            "roles": {
                "creator": {
                    "scope": "Own Only",
                    "can_perform": [
                        "Generate / dispatch new asset (Social Resize, Bg Remove, Retouch, Flow)",
                        "Regenerate / retry own previous tasks",
                        "Edit generation parameters on own tasks",
                        "Delete a generation from own history",
                        "Download own generated asset (instant, no approval gate)",
                        "View own generation history",
                        "View own individual usage stats",
                        "View own profile"
                    ],
                    "cannot_perform": [
                        "View or download assets from team members",
                        "View team generation history or team roster",
                        "Access team or cross-department KPI reports",
                        "Access the Task Monitor / Console",
                        "Add, edit, or remove user accounts",
                        "View or modify department budgets and ceilings",
                        "View the audit trail",
                        "Manage external API keys (RunningHub, Supabase)"
                    ]
                },
                "manager": {
                    "scope": "Own + Department Team",
                    "can_perform": [
                        "Generate / dispatch new asset (Own workspace)",
                        "Regenerate / retry own tasks AND team members tasks",
                        "Edit generation parameters (Own drafts)",
                        "Delete generation from history (Own tasks ONLY)",
                        "Download own generated assets AND team assets (No approval gate)",
                        "View team generation history and team roster",
                        "View and export team KPI reports (productivity, quality, adoption, cost)",
                        "View team audit trail"
                    ],
                    "cannot_perform": [
                        "Delete tasks generated by team members",
                        "View platform-wide / other departments generation history",
                        "Access cross-department KPIs or platform-wide cost analytics",
                        "Access global Task Monitor / Console",
                        "Export platform billing data",
                        "Add or remove user accounts",
                        "Assign user roles or assign managers to teams",
                        "Adjust user or department budget ceilings",
                        "Manage platform API keys (RunningHub, Supabase)"
                    ]
                },
                "admin": {
                    "scope": "Platform-Wide / All",
                    "can_perform": [
                        "Generate / dispatch new asset (Own workspace)",
                        "Regenerate / retry ANY task across all departments",
                        "Delete ANY generation from platform history",
                        "Download ANY generated asset across all departments",
                        "View full platform generation history and global Task Monitor Console",
                        "View cross-department KPIs and export billing/cost ledgers",
                        "Add / remove user accounts and assign roles / departments",
                        "Assign managers to teams",
                        "Set department and user monthly budget ceilings",
                        "View complete platform-wide audit trails",
                        "Manage external API keys (RunningHub, Supabase)",
                        "Configure Brand Kit & Catalog Connector (Roadmap items)"
                    ],
                    "cannot_perform": [
                        "Modify active draft parameters belonging to another user directly (dispatches under Own scope)"
                    ]
                }
            },
            "api_endpoint_rls_mapping": [
                { "route": "/api/tasks/generate", "method": "POST", "min_role": "creator", "rls_filter": "user_id = auth.uid()" },
                { "route": "/api/tasks/{id}/retry", "method": "POST", "min_role": "creator", "rls_filter": "Creator: user_id = auth.uid() | Manager: department_id = auth.dept_id | Admin: TRUE" },
                { "route": "/api/tasks/{id}/delete", "method": "DELETE", "min_role": "creator", "rls_filter": "Creator & Manager: user_id = auth.uid() | Admin: TRUE" },
                { "route": "/api/tasks/{id}/download", "method": "GET", "min_role": "creator", "rls_filter": "Creator: user_id = auth.uid() | Manager: department_id = auth.dept_id | Admin: TRUE" },
                { "route": "/api/tasks/history", "method": "GET", "min_role": "creator", "rls_filter": "Creator: user_id = auth.uid() | Manager: department_id = auth.dept_id | Admin: TRUE" },
                { "route": "/api/analytics/team", "method": "GET", "min_role": "manager", "rls_filter": "Manager: department_id = auth.dept_id | Admin: TRUE" },
                { "route": "/api/analytics/platform", "method": "GET", "min_role": "admin", "rls_filter": "Admin: TRUE (Creator/Manager -> 403 Forbidden)" },
                { "route": "/api/users/manage", "method": "POST / PUT", "min_role": "admin", "rls_filter": "Admin: TRUE (Creator/Manager -> 403 Forbidden)" },
                { "route": "/api/budgets/ceiling", "method": "PUT", "min_role": "admin", "rls_filter": "Admin: TRUE (Creator/Manager -> 403 Forbidden)" },
                { "route": "/api/audit-logs", "method": "GET", "min_role": "manager", "rls_filter": "Manager: department_id = auth.dept_id | Admin: TRUE" }
            ]
        }
    }

    # Write each JSON table to disk
    print("\nWriting Database Tables to Disk:")
    for filename, content in database_tables.items():
        file_path = tables_path / filename
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(content, f, indent=2)
        count_label = f"{len(content)} records" if isinstance(content, list) else "config"
        print(f"   [OK] {filename:<30} ({count_label})")

    # 4. Write SQL Schema DDL (PostgreSQL / AWS RDS Ready)
    sql_schema = """-- ============================================================================
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
"""
    sql_file_path = schemas_path / "000_release_1_architecture.sql"
    with open(sql_file_path, "w", encoding="utf-8") as f:
        f.write(sql_schema)
    print(f"\n[OK] Generated SQL DDL schema: {sql_file_path}")

    print("\n" + "=" * 70)
    print("SUCCESS: All 17 database tables & schemas created successfully!")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initialize Boutiqaat Creative AI Studio Database")
    parser.add_argument(
        "--path",
        default="./database",
        help="Target folder for database creation (Default: ./database)"
    )
    args = parser.parse_args()
    build_database(args.path)
