import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SQL = `
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

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_credit_limit_usd NUMERIC(10, 3) DEFAULT 50.000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_used_usd NUMERIC(10, 3) DEFAULT 0.000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_models JSONB DEFAULT '["image", "video", "social-resize", "bundling"]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

CREATE TABLE IF NOT EXISTS team_creative_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(50) NOT NULL,
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

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_department_id ON notifications(department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

INSERT INTO departments (id, name, description, monthly_budget_usd, critical_threshold_percent, auto_pause_on_critical)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Social Media Marketing', 'Social Media and campaign assets generation', 500.000, 90, false),
  ('b0000000-0000-0000-0000-000000000002', 'E-Commerce Catalog', 'Product catalog, bundling, and e-commerce visuals', 800.000, 90, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_creative_gallery DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
`.trim();

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json().catch(() => ({ secret: '' }));
    const expectedSecret = process.env.AUTH_SECRET || 'boutiqaat_gen_app_fallback_secret';

    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
    }

    // Try executing SQL via Supabase RPC exec_sql
    const { error: rpcError } = await (supabaseAdmin as any).rpc('exec_sql', { sql: SQL });

    if (rpcError) {
      return NextResponse.json({
        success: false,
        message: 'Auto-migration RPC not present. Run the SQL below in Supabase SQL editor.',
        sql: SQL,
      }, { status: 200 });
    }

    return NextResponse.json({ success: true, message: 'Manager Enterprise system migration completed successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, sql: SQL }, { status: 500 });
  }
}
