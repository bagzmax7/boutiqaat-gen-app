import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET — Fetch all image agent sessions for the current user
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: dbSessions, error } = await supabaseAdmin
      .from('image_agent_sessions')
      .select('*')
      .eq('user_id', session.userId)
      .order('updated_at', { ascending: false });

    if (error) {
      // 42P01 is Postgres code for undefined_table, PGRST205 is PostgREST code for missing schema cache table
      if (error.code === '42P01' || error.code === 'PGRST205') {
        console.warn('[image-agent sessions GET] Table "image_agent_sessions" does not exist in DB. Falling back to local storage.');
        return NextResponse.json({ sessions: [], dbTableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ sessions: dbSessions || [] });
  } catch (error: any) {
    console.error('[image-agent sessions GET] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch sessions' }, { status: 500 });
  }
}

// POST — Create or update an image agent session
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, title, messages } = body;

    if (!id || !title) {
      return NextResponse.json({ error: 'Missing session ID or title' }, { status: 400 });
    }

    // Upsert session
    const { data, error } = await supabaseAdmin
      .from('image_agent_sessions')
      .upsert({
        id,
        user_id: session.userId,
        title,
        messages: messages || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        console.warn('[image-agent sessions POST] Table "image_agent_sessions" does not exist in DB. Falling back to local storage.');
        return NextResponse.json({ success: true, dbTableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ success: true, session: data });
  } catch (error: any) {
    console.error('[image-agent sessions POST] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save session' }, { status: 500 });
  }
}

// DELETE — Delete a specific session
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('image_agent_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', session.userId);

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ success: true, dbTableMissing: true });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[image-agent sessions DELETE] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete session' }, { status: 500 });
  }
}
