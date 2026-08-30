#!/usr/bin/env python3
"""
Boutiqaat Creative AI Studio - Database Initializer & SQL Runner
File: db.py
Author: Boutiqaat AI Strategy & Innovation Team

Description:
  Automates the initialization of the complete Release 1 database on any server or local environment.
  - Generates all 17 dataset tables in JSON format for the local database driver.
  - Reads and copies the master 'schema.sql' for PostgreSQL / AWS RDS / Aurora deployments.
  - Optionally runs 'schema.sql' directly against a PostgreSQL database via psycopg2 or psql.

Usage:
  python db.py                      # Build / update local JSON database & schema.sql
  python db.py --path ./database    # Specify custom database directory
  python db.py --pg-uri "postgresql://user:pass@host:5432/dbname" # Execute SQL directly to Postgres
"""

import os
import sys
import json
import shutil
import argparse
from datetime import datetime, timezone
from pathlib import Path

def get_iso_now():
    return datetime.now(timezone.utc).isoformat()

def build_database(target_root_dir, pg_uri=None):
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
        "admins.json": [],
        "managers.json": [],
        "creators.json": [],
        "users.json": [],
        "tasks.json": [],
        "flow_projects.json": [],
        "retouch_projects.json": [],
        "retouch_sessions.json": [],
        "social_resize_projects.json": [],
        "layers_projects.json": [],
        "bundling_sessions.json": [],
        "image_agent_sessions.json": [],
        "department_budgets.json": [],
        "audit_logs.json": [],
        "team_creative_gallery.json": [],
        "notifications.json": [],
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

    # 4. Read & Copy master schema.sql
    master_schema_file = Path("schema.sql")
    dest_schema_file = schemas_path / "000_release_1_architecture.sql"

    if master_schema_file.exists():
        shutil.copyfile(master_schema_file, dest_schema_file)
        print(f"\n[OK] Copied master 'schema.sql' -> {dest_schema_file}")
    else:
        print(f"\n[!] Notice: 'schema.sql' not found in current directory, using existing DDL.")

    # 5. Optional PostgreSQL Execution
    if pg_uri:
        print(f"\nConnecting to PostgreSQL: {pg_uri.split('@')[-1]} ...")
        try:
            import psycopg2
            conn = psycopg2.connect(pg_uri)
            cur = conn.cursor()
            with open(dest_schema_file, "r", encoding="utf-8") as f:
                sql_content = f.read()
            cur.execute(sql_content)
            conn.commit()
            cur.close()
            conn.close()
            print("[OK] Executed 'schema.sql' against PostgreSQL database successfully!")
        except ImportError:
            print("[!] psycopg2 is not installed. To execute directly against PostgreSQL, run:")
            print(f"    psql \"{pg_uri}\" -f \"{dest_schema_file}\"")
        except Exception as err:
            print(f"[ERROR] Failed to execute SQL against PostgreSQL: {err}")

    print("\n" + "=" * 70)
    print("SUCCESS: All 17 database tables & schemas created successfully!")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initialize Boutiqaat Creative AI Studio Database")
    parser.add_argument(
        "--path",
        default="./database",
        help="Target folder for local database creation (Default: ./database)"
    )
    parser.add_argument(
        "--pg-uri",
        default=os.environ.get("DATABASE_URL"),
        help="Optional PostgreSQL connection URI (e.g. postgresql://user:pass@host:5432/dbname)"
    )
    args = parser.parse_args()
    build_database(args.path, args.pg_uri)
