import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hasAdminOrManagerAccess } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getMemberSettings, updateMemberSettings } from '@/lib/team-settings';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/manager/team/[id]
 * Modifies an editor's credit limit, resets password, updates allowed models, or toggles status.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasAdminOrManagerAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const editorId = params.id;
  if (!editorId) {
    return NextResponse.json({ error: 'Editor ID required' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { name, password, monthlyCreditLimitUsd, allowedModels, status } = body;

    // 1. Update persistent member settings (quota limit, allowed models, status)
    const settingsUpdate: Record<string, any> = {};
    if (monthlyCreditLimitUsd !== undefined) {
      settingsUpdate.monthlyCreditLimitUsd = parseFloat(monthlyCreditLimitUsd);
    }
    if (allowedModels !== undefined) {
      settingsUpdate.allowedModels = allowedModels;
    }
    if (status !== undefined) {
      settingsUpdate.status = status;
    }

    const updatedSettings = updateMemberSettings(editorId, settingsUpdate);

    // 2. Update user basic info in Supabase (if name or password changed)
    const userUpdates: Record<string, any> = {};
    if (name) userUpdates.name = name.trim();
    if (password) {
      const bcrypt = await import('bcryptjs');
      userUpdates.password_hash = await bcrypt.hash(password, 10);
    }

    let updatedUserRecord: any = null;
    if (Object.keys(userUpdates).length > 0) {
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .update(userUpdates)
        .eq('id', editorId)
        .select('id, name, email, role, avatar_url, created_at')
        .single();

      if (userError) throw userError;
      updatedUserRecord = user;
    } else {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role, avatar_url, created_at')
        .eq('id', editorId)
        .single();
      updatedUserRecord = user;
    }

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUserRecord,
        monthly_credit_limit_usd: updatedSettings.monthlyCreditLimitUsd,
        allowed_models: updatedSettings.allowedModels,
        status: updatedSettings.status,
      }
    });
  } catch (error: any) {
    console.error('[PATCH /api/manager/team/[id]]', error);
    return NextResponse.json({ error: error.message || 'Failed to update editor' }, { status: 500 });
  }
}

/**
 * DELETE /api/manager/team/[id]
 * Deletes an editor account.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasAdminOrManagerAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const editorId = params.id;
  try {
    const { error } = await supabaseAdmin.from('users').delete().eq('id', editorId);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Editor account deleted' });
  } catch (error: any) {
    console.error('[DELETE /api/manager/team/[id]]', error);
    return NextResponse.json({ error: error.message || 'Failed to delete editor' }, { status: 500 });
  }
}
