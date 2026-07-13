import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/tasks/[id] — fetch a single task by local ID (frontend polls this after fire-and-forget)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: task, error } = await supabaseAdmin
    .from('tasks')
    .select('id, status, outputs, error_message, runninghub_task_id, updated_at')
    .eq('id', params.id)
    .single();

  if (error || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Security: non-admin users can only see their own tasks
  if (session.role !== 'admin') {
    const { data: owned } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', session.userId)
      .single();
    if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(task);
}

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

