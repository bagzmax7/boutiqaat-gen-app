import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// DELETE /api/users/[id] — admin only
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (params.id === session.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  await supabaseAdmin.from('users').delete().eq('id', params.id);
  return NextResponse.json({ success: true });
}

// PATCH /api/users/[id] — admin: update role or name
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, string> = {};
  if (body.name) updates.name = body.name;
  if (body.role && ['editor', 'admin'].includes(body.role)) updates.role = body.role;

  await supabaseAdmin.from('users').update(updates).eq('id', params.id);
  return NextResponse.json({ success: true });
}
