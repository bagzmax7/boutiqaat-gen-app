/**
 * GET/PATCH/DELETE /api/bundling/sessions/[id]
 * GET: Fetch a single session
 * PATCH: Update rating, feedback, or favorite status
 * DELETE: Remove a session
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await validateAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('bundling_sessions')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', auth.userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await validateAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const allowedFields = ['rating', 'rating_feedback', 'is_favorite', 'session_name', 'generated_image_url'];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('bundling_sessions')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', auth.userId)
      .select()
      .single();

    if (error) {
      console.error('Session update error:', error);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (err) {
    console.error('PATCH session error:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await validateAuth(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabaseAdmin
    .from('bundling_sessions')
    .delete()
    .eq('id', params.id)
    .eq('user_id', auth.userId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
