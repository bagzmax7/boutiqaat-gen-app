/**
 * POST /api/image-agent/migrate
 * One-time endpoint to create the image_agent_sessions table via Supabase RPC.
 * Protected by AUTH_SECRET. Call this once after deployment.
 *
 * curl -X POST http://localhost:3000/api/image-agent/migrate \
 *   -H "Content-Type: application/json" \
 *   -d '{"secret":"<your AUTH_SECRET>"}'
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SQL = `
CREATE TABLE IF NOT EXISTS image_agent_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_agent_sessions_user_id
  ON image_agent_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_image_agent_sessions_updated_at
  ON image_agent_sessions(updated_at DESC);

ALTER TABLE image_agent_sessions DISABLE ROW LEVEL SECURITY;
`.trim();

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json().catch(() => ({ secret: '' }));
    const expectedSecret = process.env.AUTH_SECRET || 'boutiqaat_gen_app_fallback_secret';

    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
    }

    // Try running via Supabase RPC exec_sql (if it exists on the project)
    const { error: rpcError } = await (supabaseAdmin as any).rpc('exec_sql', { sql: SQL });

    if (rpcError) {
      // RPC not available — return the SQL for manual execution
      console.warn('[migrate] exec_sql RPC not available:', rpcError.message);
      return NextResponse.json({
        success: false,
        message: 'Auto-migration not available. Please run the SQL below manually in your Supabase Dashboard → SQL Editor.',
        sql: SQL,
      }, { status: 200 });
    }

    return NextResponse.json({ success: true, message: 'Table image_agent_sessions created successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
