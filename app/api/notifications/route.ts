import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Retrieves real-time alerts and notifications for the logged-in user and their department.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (session.role !== 'admin' && session.departmentId) {
      query = query.or(`department_id.eq.${session.departmentId},user_id.eq.${session.userId}`);
    }

    const { data: list, error } = await query;
    if (error) {
      // Table may not be created in Supabase yet — return empty list gracefully
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const notifications = list || [];
    const unreadCount = notifications.filter((n: any) => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

/**
 * PATCH /api/notifications
 * Marks specific notification or all notifications as read.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { id, all } = body;

    if (all) {
      let query = supabaseAdmin
        .from('notifications')
        .update({ read: true });

      if (session.role !== 'admin' && session.departmentId) {
        query = query.or(`department_id.eq.${session.departmentId},user_id.eq.${session.userId}`);
      } else {
        query = query.eq('read', false);
      }

      await query;
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (id) {
      await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ID or all flag required' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/notifications
 * Dispatches a new notification.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, title, message, linkUrl, departmentId, userId } = body;

    const { data: created, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId || session.userId,
        department_id: departmentId || session.departmentId || null,
        type: type || 'SYSTEM_INFO',
        title: title || 'Notification',
        message: message || '',
        link_url: linkUrl || null,
        read: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, notification: created });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
