import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.cn';
const ENTERPRISE_KEY = process.env.RUNNINGHUB_API_KEY_ENTERPRISE || '';

/**
 * GET /api/admin/tasks/rh-billing
 * Fetch billing records directly from RunningHub API for the Enterprise key.
 * RunningHub API: POST /task/openapi/outputs
 * Used to get the raw outputs + billing info for all tasks via enterprise key.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch enterprise tasks from our DB within date range
  const url = new URL(req.url);
  const dateFrom = url.searchParams.get('from') || '';
  const dateTo = url.searchParams.get('to') || '';
  const status = url.searchParams.get('status') || '';

  let query = supabaseAdmin
    .from('tasks')
    .select('id, runninghub_task_id, app_name, status, created_at, user_id, outputs, node_info_list, users(name, email)')
    .eq('api_key_type', 'enterprise')
    .not('runninghub_task_id', 'is', null);

  if (status) query = query.eq('status', status);

  if (dateFrom) {
    const fromStr = dateFrom.includes(' ') ? dateFrom : dateFrom + ' 00:00:00';
    query = query.gte('created_at', new Date(fromStr).toISOString());
  }
  if (dateTo) {
    const toStr = dateTo.includes(' ') ? dateTo : dateTo + ' 23:59:59';
    query = query.lte('created_at', new Date(toStr).toISOString());
  }

  query = query.order('created_at', { ascending: false }).limit(500);

  const { data: tasks, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate summary stats
  let totalDuration = 0;
  let totalCoins = 0;
  let totalAmount = 0;
  let successCount = 0;
  let failedCount = 0;
  let runningCount = 0;

  const records = (tasks || []).map((t: any) => {
    const nodeInfoList = t.node_info_list || [];
    const usageNode = nodeInfoList.find((n: any) => n.nodeId === 'USAGE' && n.fieldName === 'usage');
    let usage: any = null;
    if (usageNode?.fieldValue) {
      try { usage = JSON.parse(usageNode.fieldValue); } catch {}
    }

    const duration = usage ? parseInt(usage.taskCostTime || '0') : 0;
    const coins = usage ? parseFloat(usage.consumeCoins || '0') : 0;
    const amount = usage ? parseFloat(usage.consumeMoney || '0') : 0;
    const thirdParty = usage ? parseFloat(usage.thirdPartyConsumeMoney || '0') : 0;

    if (t.status === 'SUCCESS') successCount++;
    else if (t.status === 'FAILED') failedCount++;
    else if (t.status === 'RUNNING') runningCount++;

    if (t.status === 'SUCCESS') {
      totalDuration += duration;
      totalCoins += coins;
      totalAmount += amount;
    }

    return {
      taskId: t.runninghub_task_id || t.id,
      dbId: t.id,
      taskName: t.app_name || 'Untitled',
      taskStatus: t.status,
      taskStartTime: t.created_at,
      userAccount: (t.users as any)?.name || (t.users as any)?.email || 'Unknown',
      userEmail: (t.users as any)?.email || '',
      userId: t.user_id || '',
      outputs: t.outputs || [],
      apiKeyType: 'enterprise',
      apiKeyMasked: '1c81****e474',
      apiKeyFull: ENTERPRISE_KEY,
      // Billing
      duration,
      coins,
      amount,
      thirdParty,
      // Raw
      nodeInfoList,
    };
  });

  return NextResponse.json({
    records,
    stats: {
      total: records.length,
      successCount,
      failedCount,
      runningCount,
      totalDuration,
      totalCoins,
      totalAmount,
    },
  });
}
