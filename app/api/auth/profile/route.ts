import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// PATCH /api/auth/profile — update name, avatar_url, or password
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const updates: Record<string, string> = {};

    if (body.name) updates.name = body.name.trim();
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

    if (body.currentPassword && body.newPassword) {
      const bcrypt = await import('bcryptjs');
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('password_hash')
        .eq('id', session.userId)
        .single();

      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const valid = await bcrypt.compare(body.currentPassword, user.password_hash);
      if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

      updates.password_hash = await bcrypt.hash(body.newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await supabaseAdmin.from('users').update(updates).eq('id', session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[profile]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
