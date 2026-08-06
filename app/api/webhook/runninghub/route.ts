import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { queryTask } from '@/lib/runninghub';

/**
 * POST /api/webhook/runninghub
 *
 * Universal webhook receiver for all RunningHub task completions.
 * RunningHub POSTs here when any task finishes (SUCCESS or FAILED).
 *
 * Security: RunningHub appends ?secret=<WEBHOOK_SECRET> to the URL we register.
 *
 * RunningHub webhook payload:
 * {
 *   taskId: string          // RunningHub taskId (= runninghub_task_id in our DB)
 *   status: string          // "SUCCESS" | "FAILED" | "CANCELED"
 *   results: Array<{ url: string; outputType: string }> | null
 *   errorMessage?: string
 *   failedReason?: object
 * }
 */
export async function POST(req: NextRequest) {
  // 1. Verify secret
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    console.warn('[Webhook] Unauthorized — invalid secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { taskId: rhTaskId, status, results, errorMessage, failedReason } = body;

  if (!rhTaskId) {
    return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
  }

  console.log(`[Webhook] taskId=${rhTaskId} status=${status}`);

  // 3. Lookup local task by RunningHub taskId
  const { data: task, error: fetchErr } = await supabaseAdmin
    .from('tasks')
    .select('id, status, api_key_type, node_info_list')
    .eq('runninghub_task_id', rhTaskId)
    .single();

  if (fetchErr || !task) {
    console.warn(`[Webhook] Task not found for runninghub_task_id=${rhTaskId}`);
    return NextResponse.json({ ok: true, note: 'task_not_found' });
  }

  // Avoid duplicate processing
  if (['SUCCESS', 'FAILED', 'CANCELED'].includes(task.status)) {
    console.log(`[Webhook] Task ${task.id} already terminal (${task.status}) — skip`);
    return NextResponse.json({ ok: true });
  }

  // 4. Update Supabase
  if (status === 'SUCCESS') {
    const outputs = (results || []).map((r: any) => ({
      fileUrl: r.url,
      fileType: r.outputType || 'png',
    }));

    // Fetch usage details from RunningHub API
    let usageObj = null;
    try {
      const statusRes = await queryTask(rhTaskId, task.api_key_type || undefined);
      if (statusRes.usage) {
        usageObj = statusRes.usage;
      }
    } catch (queryErr) {
      console.error(`[Webhook] Failed to query usage for RunningHub task ${rhTaskId}:`, queryErr);
    }

    const nodeInfo = task.node_info_list || [];
    if (usageObj) {
      const filtered = nodeInfo.filter((n: any) => n.nodeId !== 'USAGE');
      filtered.push({
        nodeId: 'USAGE',
        fieldName: 'usage',
        fieldValue: JSON.stringify(usageObj)
      });
      task.node_info_list = filtered;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('tasks')
      .update({ 
        status: 'SUCCESS', 
        outputs, 
        node_info_list: task.node_info_list,
        updated_at: new Date().toISOString() 
      })
      .eq('id', task.id);

    if (updateErr) {
      console.error(`[Webhook] DB update failed for task ${task.id}:`, updateErr);
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
    }

    console.log(`[Webhook] Task ${task.id} -> SUCCESS (${outputs.length} outputs, usage updated)`);

  } else if (status === 'FAILED' || status === 'CANCELED') {
    const errorMsg = errorMessage || JSON.stringify(failedReason || {}) || 'Generation failed';

    await supabaseAdmin
      .from('tasks')
      .update({
        status: status === 'CANCELED' ? 'CANCELED' : 'FAILED',
        error_message: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id);

    console.log(`[Webhook] Task ${task.id} -> ${status}: ${errorMsg}`);
  }

  // 5. Always return 200 — RunningHub retries on non-200
  return NextResponse.json({ ok: true });
}
