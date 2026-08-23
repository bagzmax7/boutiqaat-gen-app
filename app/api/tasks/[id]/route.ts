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

// PATCH /api/tasks/[id] — update task status, outputs, or feedback rating
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { status, outputs, error, feedback, isOverride } = await req.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (outputs) updates.outputs = outputs;
    if (error) updates.error_message = error;

    // Handle feedback rating or override in node_info_list
    if (feedback || isOverride !== undefined) {
      const { data: existing } = await supabaseAdmin
        .from('tasks')
        .select('node_info_list')
        .eq('id', params.id)
        .single();

      let nodeList = existing?.node_info_list || [];
      if (!Array.isArray(nodeList)) nodeList = [];

      if (feedback) {
        nodeList = nodeList.filter((n: any) => n.nodeId !== 'FEEDBACK');
        nodeList.push({ nodeId: 'FEEDBACK', fieldName: 'rating', fieldValue: feedback });
      }

      if (isOverride) {
        nodeList = nodeList.filter((n: any) => n.nodeId !== 'OVERRIDE');
        nodeList.push({ nodeId: 'OVERRIDE', fieldName: 'override', fieldValue: 'true' });
      }

      updates.node_info_list = nodeList;
    }

    await supabaseAdmin.from('tasks').update(updates).eq('id', params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[tasks PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

