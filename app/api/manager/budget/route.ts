import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasAdminOrManagerAccess } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasAdminOrManagerAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { departmentId, monthlyBudgetUsd, criticalThresholdPercent, autoPauseOnCritical } = body;

    const targetDeptId = session.role === 'admin' ? (departmentId || session.departmentId) : session.departmentId;

    if (!targetDeptId) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (monthlyBudgetUsd !== undefined) updates.monthly_budget_usd = parseFloat(monthlyBudgetUsd);
    if (criticalThresholdPercent !== undefined) updates.critical_threshold_percent = parseInt(criticalThresholdPercent);
    if (autoPauseOnCritical !== undefined) updates.auto_pause_on_critical = Boolean(autoPauseOnCritical);

    const { data, error } = await supabaseAdmin
      .from('departments')
      .update(updates)
      .eq('id', targetDeptId)
      .select()
      .single();

    if (error) {
      // If table row doesn't exist yet, insert it
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('departments')
        .insert({
          id: targetDeptId,
          name: 'Creative Production',
          ...updates
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return NextResponse.json({ success: true, department: inserted });
    }

    return NextResponse.json({ success: true, department: data });
  } catch (error: any) {
    console.error('[POST /api/manager/budget]', error);
    return NextResponse.json({ error: error.message || 'Failed to update budget settings' }, { status: 500 });
  }
}
