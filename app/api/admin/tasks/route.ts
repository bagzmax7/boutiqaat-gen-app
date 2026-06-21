import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function parseUsage(nodeInfoList: any[]) {
  if (!nodeInfoList || !Array.isArray(nodeInfoList)) return null;
  const usageNode = nodeInfoList.find((n: any) => n.nodeId === 'USAGE' && n.fieldName === 'usage');
  if (usageNode && usageNode.fieldValue) {
    try {
      return JSON.parse(usageNode.fieldValue);
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('size') || '20');
  const keyword = url.searchParams.get('keyword') || '';
  const status = url.searchParams.get('status') || '';
  const dateFrom = url.searchParams.get('from') || '';
  const dateTo = url.searchParams.get('to') || '';

  // Build filters for both main query and stats query
  let query = supabaseAdmin
    .from('tasks')
    .select('*, users(name, email)', { count: 'exact' });

  let statsQuery = supabaseAdmin
    .from('tasks')
    .select('api_key_type, node_info_list');

  if (status) {
    query = query.eq('status', status);
    statsQuery = statsQuery.eq('status', status);
  }
  if (dateFrom) {
    const fromStr = dateFrom.includes(' ') ? dateFrom : dateFrom + ' 00:00:00';
    const fromIso = new Date(fromStr).toISOString();
    query = query.gte('created_at', fromIso);
    statsQuery = statsQuery.gte('created_at', fromIso);
  }
  if (dateTo) {
    const toStr = dateTo.includes(' ') ? dateTo : dateTo + ' 23:59:59';
    const toIso = new Date(toStr).toISOString();
    query = query.lte('created_at', toIso);
    statsQuery = statsQuery.lte('created_at', toIso);
  }
  if (keyword) {
    const filter = `app_name.ilike.%${keyword}%,runninghub_task_id.ilike.%${keyword}%`;
    query = query.or(filter);
    statsQuery = statsQuery.or(filter);
  }

  // Calculate dynamic stats matching current filters
  const { data: allMatchingForStats } = await statsQuery;

  let totalRecords = 0;
  let totalEnterprise = 0;
  let totalConsumer = 0;
  let durationAll = 0;
  let coinNumAll = 0;
  let amountAll = 0;

  if (allMatchingForStats) {
    totalRecords = allMatchingForStats.length;
    allMatchingForStats.forEach(t => {
      if (t.api_key_type === 'enterprise') {
        totalEnterprise++;
      } else {
        totalConsumer++;
      }
      
      const usage = parseUsage(t.node_info_list);
      if (usage) {
        const time = parseInt(usage.taskCostTime || '0');
        const coins = parseFloat(usage.consumeCoins || '0');
        const money = parseFloat(usage.consumeMoney || '0');
        
        durationAll += time;
        coinNumAll += coins;
        amountAll += money;
      }
    });
  }

  // Paginated main list
  query = query.order('created_at', { ascending: false });
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: tasks, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records = (tasks || []).map(t => {
    const usage = parseUsage(t.node_info_list);
    return {
      taskId: t.runninghub_task_id || t.id,
      taskName: t.app_name,
      taskStartTime: t.created_at, // Send raw timestamp for client formatting
      taskStatus: t.status,
      callTypeDisplay: 'API',
      moneyDuration: usage ? usage.taskCostTime || '0' : '0',
      coinAmount: usage ? parseFloat(usage.consumeCoins || '0') : 0,
      moneyAmount: usage ? parseFloat(usage.consumeMoney || '0') : 0,
      currency: 'USD',
      apiKeyType: t.api_key_type || 'consumer',
      userAccount: t.users?.name || t.users?.email || 'Unknown',
      userEmail: t.users?.email || '',
      userId: t.user_id || '',
      outputs: t.outputs || [],
      errorMessage: t.error_message || '',
      nodeInfoList: t.node_info_list || [],
    };
  });

  return NextResponse.json({
    records,
    stats: {
      total: count !== null ? count : totalRecords,
      totalEnterprise,
      totalConsumer,
      durationAll,
      coinNumAll,
      amountAll,
    },
  });
}
