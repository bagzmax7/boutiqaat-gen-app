import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasAdminOrManagerAccess } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/rh-billing
 * Returns all tasks with billing data from our Supabase database.
 * Supports date range, status, keyType, and userId filtering.
 *
 * Billing field mapping from RunningHub /task/openapi/outputs:
 *   consumeCoins       → RH Coins consumed (the primary billing unit)
 *   consumeMoney       → Final Amount in USD (what RunningHub charges)
 *   taskCostTime       → Duration in seconds
 *   thirdPartyConsumeMoney → 3rd party API cost (e.g. OpenAI fees)
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!hasAdminOrManagerAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get('from') || '';
  const dateTo = url.searchParams.get('to') || '';
  const status = url.searchParams.get('status') || '';
  const keyType = url.searchParams.get('keyType') || '';
  const userId = url.searchParams.get('userId') || '';

  let query = supabaseAdmin
    .from('tasks')
    .select(`
      id,
      runninghub_task_id,
      app_name,
      status,
      created_at,
      user_id,
      outputs,
      node_info_list,
      api_key_type,
      users(name, email)
    `)
    .not('runninghub_task_id', 'is', null);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (keyType) {
    query = query.eq('api_key_type', keyType);
  }

  if (status) query = query.eq('status', status.toUpperCase());

  if (dateFrom) {
    try {
      const d = new Date(dateFrom);
      d.setHours(0, 0, 0, 0);
      query = query.gte('created_at', d.toISOString());
    } catch {}
  }
  if (dateTo) {
    try {
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      query = query.lte('created_at', d.toISOString());
    } catch {}
  }

  query = query.order('created_at', { ascending: false }).limit(2000);

  const { data: tasks, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ─── Stats Aggregates ───────────────────────────────────────
  let totalDuration = 0;
  let totalCoins = 0;
  let totalAmount = 0;
  let totalThirdParty = 0;
  let successCount = 0;
  let failedCount = 0;
  let runningCount = 0;
  let queuedCount = 0;
  let missingBillingCount = 0;

  const records = (tasks || []).map((t: any) => {
    const nodeInfoList: any[] = t.node_info_list || [];

    // Find USAGE node — this is set by our sync/webhook
    const usageNode = nodeInfoList.find(
      (n: any) => n.nodeId === 'USAGE' && n.fieldName === 'usage'
    );

    let usage: any = null;
    if (usageNode?.fieldValue) {
      try { usage = JSON.parse(usageNode.fieldValue); } catch {}
    }

    // ── Parse billing fields ──────────────────────────────────
    // consumeCoins  = RH coins used  (shown as "RH Coin" in RunningHub)
    // consumeMoney  = USD amount     (shown as "Final Amount($)" in RunningHub)
    // thirdPartyConsumeMoney = external API cost in USD (used when consumeMoney is null)
    // taskCostTime  = seconds        (shown as "Duration" in RunningHub)
    const coins = usage?.consumeCoins != null ? parseFloat(usage.consumeCoins) : 0;
    const thirdParty = usage?.thirdPartyConsumeMoney != null ? parseFloat(usage.thirdPartyConsumeMoney) : 0;
    const amount = usage?.consumeMoney != null ? parseFloat(usage.consumeMoney) : thirdParty;
    const duration = usage?.taskCostTime != null ? parseInt(usage.taskCostTime) : 0;
    const hasBilling = usage !== null && (coins > 0 || amount > 0 || duration > 0 || thirdParty > 0);

    // ── Status counters ───────────────────────────────────────
    const s = (t.status || '').toUpperCase();
    if (s === 'SUCCESS') {
      successCount++;
      if (hasBilling) {
        totalDuration += duration;
        totalCoins += coins;
        totalAmount += amount;
        totalThirdParty += thirdParty;
      } else {
        missingBillingCount++;
      }
    } else if (s === 'FAILED') failedCount++;
    else if (s === 'RUNNING') runningCount++;
    else if (s === 'QUEUED') queuedCount++;

    // ── Task name resolution ──────────────────────────────────
    // Priority: stored app_name > usage.taskName > "Untitled Task"
    const taskName = t.app_name 
      || usage?.taskName 
      || 'Untitled Task';

    // ── Outputs ───────────────────────────────────────────────
    const outputs = Array.isArray(t.outputs) ? t.outputs : [];

    const apiKeyType = t.api_key_type || 'enterprise';
    const apiKeyMasked = apiKeyType === 'consumer' ? 'c24e****6772' : '1c81****e474';
    const apiKeyFull = apiKeyType === 'consumer' 
      ? (process.env.RUNNINGHUB_API_KEY_CONSUMER || 'c24e4bca14ef43dc8d58bdd255786772') 
      : (process.env.RUNNINGHUB_API_KEY_ENTERPRISE || '1c813062e2bc4f18880178167ce5e474');

    return {
      taskId: t.runninghub_task_id || t.id,
      dbId: t.id,
      taskName,
      taskStatus: t.status,
      taskStartTime: t.created_at,
      userAccount: (t.users as any)?.name || (t.users as any)?.email || 'Boutiqaat Team',
      userEmail: (t.users as any)?.email || '',
      userId: t.user_id || '',
      outputs,
      apiKeyType,
      apiKeyMasked,
      apiKeyFull,
      // Billing
      duration,          // seconds
      coins,             // RH Coins
      amount,            // USD final amount
      thirdParty,        // USD 3rd party
      hasBilling,
      // Raw for debugging
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
      queuedCount,
      missingBillingCount,
      totalDuration,
      totalCoins,
      totalAmount,
      totalThirdParty,
    },
  });
}
