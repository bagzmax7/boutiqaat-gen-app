import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasAdminOrManagerAccess } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getAllMemberSettings, getMemberSettings, updateMemberSettings } from '@/lib/team-settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/team
 * Returns the list of team members (editors) managed by this manager.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasAdminOrManagerAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, avatar_url, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter to editors or current user's team
    const allSettings = getAllMemberSettings();
    const editors = (users || []).filter(u => {
      if (session.role === 'admin') return true;
      const setting = allSettings[u.id];
      return u.role === 'editor' || u.id === session.userId || setting?.managerId === session.userId;
    });

    // Fetch this month's task count for each editor
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthTasks } = await supabaseAdmin
      .from('tasks')
      .select('id, user_id, status, node_info_list')
      .gte('created_at', startOfMonth.toISOString());

    const userSpendMap: Record<string, { totalTasks: number; spendUsd: number; successCount: number }> = {};

    (monthTasks || []).forEach(t => {
      if (!t.user_id) return;
      if (!userSpendMap[t.user_id]) {
        userSpendMap[t.user_id] = { totalTasks: 0, spendUsd: 0, successCount: 0 };
      }
      const u = userSpendMap[t.user_id];
      u.totalTasks++;
      if (t.status === 'SUCCESS') u.successCount++;

      const nodeInfoList = t.node_info_list || [];
      const usageNode = nodeInfoList.find((n: any) => n.nodeId === 'USAGE' && n.fieldName === 'usage');
      if (usageNode?.fieldValue) {
        try {
          const usage = JSON.parse(usageNode.fieldValue);
          const thirdParty = usage?.thirdPartyConsumeMoney ? parseFloat(usage.thirdPartyConsumeMoney) : 0;
          const cost = usage?.consumeMoney ? parseFloat(usage.consumeMoney) : thirdParty;
          u.spendUsd += cost;
        } catch {}
      }
    });

    const enrichedEditors = editors.map(e => {
      const setting = getMemberSettings(e.id);
      const stats = userSpendMap[e.id] || { totalTasks: 0, spendUsd: 0, successCount: 0 };
      const limit = setting.monthlyCreditLimitUsd || 100.0;
      const spent = Number(stats.spendUsd.toFixed(3));
      const remaining = Number(Math.max(0, limit - spent).toFixed(3));
      const usagePercent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

      return {
        ...e,
        name: e.name || e.email.split('@')[0],
        monthly_credit_limit_usd: limit,
        credit_used_usd: spent,
        remaining_credit_usd: remaining,
        usage_percent: usagePercent,
        total_tasks_this_month: stats.totalTasks,
        success_tasks_this_month: stats.successCount,
        allowed_models: setting.allowedModels || ['image', 'video', 'social-resize', 'bundling'],
        status: setting.status || 'active',
      };
    });

    return NextResponse.json({ editors: enrichedEditors });
  } catch (error: any) {
    console.error('[GET /api/manager/team]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch team' }, { status: 500 });
  }
}

/**
 * POST /api/manager/team
 * Provisions a new editor account for the manager's team.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasAdminOrManagerAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const bcrypt = await import('bcryptjs');
    const body = await req.json();
    const { name, email, password, monthlyCreditLimitUsd, allowedModels } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        name: name.trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'editor',
      })
      .select('id, name, email, role, created_at')
      .single();

    if (insertError) throw insertError;

    // Save quota & settings
    const limit = monthlyCreditLimitUsd ? parseFloat(monthlyCreditLimitUsd) : 100.0;
    const models = allowedModels || ['image', 'video', 'social-resize', 'bundling'];

    updateMemberSettings(newUser.id, {
      monthlyCreditLimitUsd: limit,
      allowedModels: models,
      status: 'active',
      managerId: session.userId,
    });

    return NextResponse.json({
      success: true,
      user: {
        ...newUser,
        monthly_credit_limit_usd: limit,
        allowed_models: models,
        status: 'active',
      }
    });
  } catch (error: any) {
    console.error('[POST /api/manager/team]', error);
    return NextResponse.json({ error: error.message || 'Failed to create team member' }, { status: 500 });
  }
}
