import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager/gallery
 * Returns curated team creative gallery items and company presets.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type'); // 'all' | 'image' | 'video' | 'presets'
  const search = url.searchParams.get('search') || '';
  const departmentIdParam = url.searchParams.get('departmentId');
  const targetDeptId = session.role === 'admin' ? (departmentIdParam || session.departmentId) : session.departmentId;

  try {
    let query = supabaseAdmin
      .from('team_creative_gallery')
      .select('*, users!created_by_user_id(name, email)')
      .order('created_at', { ascending: false });

    if (targetDeptId) {
      query = query.eq('department_id', targetDeptId);
    }

    if (type === 'presets') {
      query = query.eq('is_company_preset', true);
    } else if (type && type !== 'all') {
      query = query.eq('media_type', type);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,prompt.ilike.%${search}%,model_used.ilike.%${search}%`);
    }

    const { data: items, error } = await query;
    if (error) {
      // Table might not exist yet or empty
      console.warn('[GET /api/manager/gallery query error]', error.message);
      return NextResponse.json({ items: [] });
    }

    const formatted = (items || []).map((i: any) => ({
      id: i.id,
      department_id: i.department_id,
      task_id: i.task_id,
      title: i.title,
      media_url: i.media_url,
      media_type: i.media_type,
      prompt: i.prompt,
      model_used: i.model_used,
      settings_snapshot: i.settings_snapshot || {},
      created_by_user_id: i.created_by_user_id,
      creator_name: i.users?.name || 'Studio Designer',
      creator_email: i.users?.email || '',
      starred_by_manager_id: i.starred_by_manager_id,
      is_company_preset: Boolean(i.is_company_preset),
      created_at: i.created_at,
    }));

    return NextResponse.json({ items: formatted });
  } catch (error: any) {
    console.error('[GET /api/manager/gallery]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch gallery' }, { status: 500 });
  }
}

/**
 * POST /api/manager/gallery
 * Stars an asset, snapshots its prompt and specs, or marks as company style preset.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only manager or admin can star/curate
  if (session.role !== 'admin' && session.role !== 'manager') {
    return NextResponse.json({ error: 'Only Managers can star items to the Creative Gallery' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      taskId,
      title,
      mediaUrl,
      mediaType,
      prompt,
      modelUsed,
      settingsSnapshot,
      isCompanyPreset,
      createdByUserId,
    } = body;

    if (!mediaUrl || !prompt) {
      return NextResponse.json({ error: 'Media URL and Prompt are required' }, { status: 400 });
    }

    const targetDeptId = session.departmentId || 'a0000000-0000-0000-0000-000000000001';

    const { data: item, error } = await supabaseAdmin
      .from('team_creative_gallery')
      .insert({
        department_id: targetDeptId,
        task_id: taskId || null,
        title: title || 'Curated Studio Masterpiece',
        media_url: mediaUrl,
        media_type: mediaType || 'image',
        prompt: prompt,
        model_used: modelUsed || 'Creative AI Model',
        settings_snapshot: settingsSnapshot || {},
        created_by_user_id: createdByUserId || session.userId,
        starred_by_manager_id: session.userId,
        is_company_preset: Boolean(isCompanyPreset),
      })
      .select()
      .single();

    if (error) throw error;

    // Dispatch real-time notification to department
    try {
      await supabaseAdmin.from('notifications').insert({
        department_id: targetDeptId,
        type: 'GALLERY_STAR',
        title: 'New Curated Asset Starred ⭐',
        message: `${session.name} curated "${title || 'Masterpiece'}" into the Team Creative Gallery.`,
        link_url: '/manager/gallery',
      });
    } catch {}

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error('[POST /api/manager/gallery]', error);
    return NextResponse.json({ error: error.message || 'Failed to curate asset' }, { status: 500 });
  }
}

/**
 * DELETE /api/manager/gallery
 * Removes an item from the gallery.
 */
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Item ID required' }, { status: 400 });

  try {
    let query = supabaseAdmin.from('team_creative_gallery').delete().eq('id', id);
    if (session.role !== 'admin' && session.departmentId) {
      query = query.eq('department_id', session.departmentId);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Item unstarred' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
