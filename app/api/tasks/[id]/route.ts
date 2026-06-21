import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// PATCH /api/tasks/[id] — update task status + outputs (called by polling)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { status, outputs, error } = await req.json();
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (outputs) updates.outputs = outputs;
    if (error) updates.error_message = error;

    await supabaseAdmin.from('tasks').update(updates).eq('id', params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[tasks PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
