import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasAdminOrManagerAccess } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/users-summary
 * Aggregates task usage, metrics, duration, costs, and favorite tools per user.
 * Supports date range filtering (from, to).
 * Accessible by Admin and Manager roles only.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!hasAdminOrManagerAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get('from') || '';
  const dateTo = url.searchParams.get('to') || '';

  try {
    // 1. Fetch all registered users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, avatar_url, created_at')
      .order('name', { ascending: true });

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    // 2. Fetch tasks within the date range
    let query = supabaseAdmin
      .from('tasks')
      .select(`
        id,
        runninghub_task_id,
        user_id,
        app_name,
        status,
        created_at,
        node_info_list,
        api_key_type
      `)
      .not('runninghub_task_id', 'is', null);

    if (dateFrom) {
      try {
        const fromIso = dateFrom.includes('T') ? new Date(dateFrom).toISOString() : new Date(`${dateFrom}T00:00:00.000Z`).toISOString();
        query = query.gte('created_at', fromIso);
      } catch {}
    }
    if (dateTo) {
      try {
        const toIso = dateTo.includes('T') ? new Date(dateTo).toISOString() : new Date(`${dateTo}T23:59:59.999Z`).toISOString();
        query = query.lte('created_at', toIso);
      } catch {}
    }

    const { data: rawTasks, error: tasksError } = await query;

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    // Deduplicate tasks by runninghub_task_id / id
    const taskMap = new Map<string, any>();
    for (const t of (rawTasks || [])) {
      const key = (t.runninghub_task_id && String(t.runninghub_task_id).trim()) || t.id;
      if (!key) continue;
      if (!taskMap.has(key)) {
        taskMap.set(key, t);
      } else {
        const existing = taskMap.get(key);
        if (t.status === 'SUCCESS' && existing.status !== 'SUCCESS') {
          taskMap.set(key, t);
        }
      }
    }
    const tasks = Array.from(taskMap.values());

    // 3. Aggregate metrics by user_id
    const userMap: Record<string, {
      userId: string;
      name: string;
      email: string;
      role: string;
      avatarUrl?: string;
      totalTasks: number;
      successCount: number;
      failedCount: number;
      runningCount: number;
      queuedCount: number;
      totalCoins: number;
      totalAmount: number;
      totalDuration: number;
      lastActive: string | null;
      appCounts: Record<string, number>;
      topApp: string;
    }> = {};

    // Initialize map with all registered users
    (users || []).forEach((u: any) => {
      userMap[u.id] = {
        userId: u.id,
        name: u.name || 'Unnamed User',
        email: u.email || '—',
        role: u.role || 'editor',
        avatarUrl: u.avatar_url || '',
        totalTasks: 0,
        successCount: 0,
        failedCount: 0,
        runningCount: 0,
        queuedCount: 0,
        totalCoins: 0,
        totalAmount: 0,
        totalDuration: 0,
        lastActive: null,
        appCounts: {},
        topApp: '—',
      };
    });

    // Fallback container for tasks with unknown / unlinked user_id
    const UNKNOWN_USER_ID = 'unknown-user';

    (tasks || []).forEach((t: any) => {
      const uId = t.user_id && userMap[t.user_id] ? t.user_id : UNKNOWN_USER_ID;
      
      if (!userMap[uId]) {
        userMap[uId] = {
          userId: uId,
          name: 'Boutiqaat Team / System',
          email: 'system@boutiqaat.com',
          role: 'editor',
          totalTasks: 0,
          successCount: 0,
          failedCount: 0,
          runningCount: 0,
          queuedCount: 0,
          totalCoins: 0,
          totalAmount: 0,
          totalDuration: 0,
          lastActive: null,
          appCounts: {},
          topApp: '—',
        };
      }

      const u = userMap[uId];
      u.totalTasks++;

      const s = (t.status || '').toUpperCase();
      if (s === 'SUCCESS') u.successCount++;
      else if (s === 'FAILED') u.failedCount++;
      else if (s === 'RUNNING') u.runningCount++;
      else if (s === 'QUEUED') u.queuedCount++;

      // Parse billing
      const nodeInfoList = t.node_info_list || [];
      const usageNode = nodeInfoList.find((n: any) => n.nodeId === 'USAGE' && n.fieldName === 'usage');
      if (usageNode?.fieldValue) {
        try {
          const usage = JSON.parse(usageNode.fieldValue);
          const coins = usage?.consumeCoins ? parseFloat(usage.consumeCoins) : 0;
          const thirdParty = usage?.thirdPartyConsumeMoney ? parseFloat(usage.thirdPartyConsumeMoney) : 0;
          const amount = usage?.consumeMoney ? parseFloat(usage.consumeMoney) : thirdParty;
          const duration = usage?.taskCostTime ? parseInt(usage.taskCostTime) : 0;

          u.totalCoins += coins;
          u.totalAmount += amount;
          u.totalDuration += duration;
        } catch {}
      }

      // Track last active date
      if (t.created_at) {
        if (!u.lastActive || new Date(t.created_at) > new Date(u.lastActive)) {
          u.lastActive = t.created_at;
        }
      }

      // App frequency
      const appName = t.app_name || 'General App';
      u.appCounts[appName] = (u.appCounts[appName] || 0) + 1;
    });

    // Compute topApp for each user and convert to array
    const userSummaries = Object.values(userMap).map(u => {
      let maxCount = 0;
      let topApp = '—';
      for (const [app, count] of Object.entries(u.appCounts)) {
        if (count > maxCount) {
          maxCount = count;
          topApp = app;
        }
      }
      return {
        ...u,
        topApp,
        successRate: u.totalTasks > 0 ? Math.round((u.successCount / u.totalTasks) * 100) : 0,
      };
    });

    // Sort by totalTasks descending, then totalAmount descending
    userSummaries.sort((a, b) => b.totalTasks - a.totalTasks || b.totalAmount - a.totalAmount);

    // Overall team KPIs
    const activeUsersCount = userSummaries.filter(u => u.totalTasks > 0).length;
    const teamTotalTasks = userSummaries.reduce((sum, u) => sum + u.totalTasks, 0);
    const teamTotalSpend = userSummaries.reduce((sum, u) => sum + u.totalAmount, 0);
    const teamTotalCoins = userSummaries.reduce((sum, u) => sum + u.totalCoins, 0);
    const teamTotalDuration = userSummaries.reduce((sum, u) => sum + u.totalDuration, 0);
    const topSpender = userSummaries.find(u => u.totalAmount > 0) || userSummaries[0] || null;

    return NextResponse.json({
      users: userSummaries,
      kpis: {
        totalUsers: (users || []).length,
        activeUsersCount,
        teamTotalTasks,
        teamTotalSpend,
        teamTotalCoins,
        teamTotalDuration,
        topSpenderName: topSpender ? topSpender.name : '—',
        topSpenderAmount: topSpender ? topSpender.totalAmount : 0,
      }
    });
  } catch (error: any) {
    console.error('[users-summary GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
