import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SQL = `
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

CREATE INDEX IF NOT EXISTS idx_layers_projects_user_id ON layers_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_layers_projects_updated_at ON layers_projects(updated_at DESC);
ALTER TABLE layers_projects DISABLE ROW LEVEL SECURITY;
`.trim();

export async function POST(req: NextRequest) {
  try {
    // Try running via Supabase RPC exec_sql
    const { error: rpcError } = await (supabaseAdmin as any).rpc('exec_sql', { sql: SQL });

    if (rpcError) {
      console.warn('[migrate-layers] exec_sql RPC not available:', rpcError.message);
      return NextResponse.json({
        success: false,
        message: 'Please run the SQL migration in Supabase SQL Editor if not already executed.',
        sql: SQL,
      });
    }

    return NextResponse.json({ success: true, message: 'Table layers_projects initialized successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, sql: SQL }, { status: 500 });
  }
}
