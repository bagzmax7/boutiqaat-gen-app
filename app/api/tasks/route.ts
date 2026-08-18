import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/tasks — return current user's task history from Supabase
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isManagement = session.role === 'admin' || session.role === 'manager';
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const filterUserId = url.searchParams.get('userId');
  const scope = url.searchParams.get('scope');

  let query = supabaseAdmin
    .from('tasks')
    .select('*, users(name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (isManagement && scope === 'all') {
    // Admin / Manager requesting platform-wide overview
    if (filterUserId) {
      query = query.eq('user_id', filterUserId);
    }
  } else {
    // Default personal view (for editors, and for admin personal history / studio)
    query = query.eq('user_id', session.userId);
  }

  const { data: tasks } = await query;
  return NextResponse.json({ tasks: tasks || [] });
}

// POST /api/tasks — persist a new task to Supabase (called internally after run-app)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, runninghub_task_id, app_id, app_name, api_key_type, node_info_list } = await req.json();

    await supabaseAdmin.from('tasks').insert({
      id,
      runninghub_task_id,
      user_id: session.userId,
      app_id,
      app_name,
      status: 'QUEUED',
      api_key_type: api_key_type || 'consumer',
      node_info_list: node_info_list || [],
      outputs: [],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[tasks POST]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// PUT /api/tasks — update an existing task (called to save outputs/status)
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, status, outputs, error: taskError, node_info_list } = await req.json();

    if (!id) return NextResponse.json({ error: 'Missing task ID' }, { status: 400 });

    const updates: any = { status };
    if (outputs !== undefined) updates.outputs = outputs;
    if (taskError !== undefined) updates.error_message = taskError;
    if (node_info_list !== undefined) updates.node_info_list = node_info_list;

    // We can only update tasks belonging to the current user (enforced by RLS or user_id check)
    // Here we explicitly check user_id if not admin
    let query = supabaseAdmin.from('tasks').update(updates).eq('id', id);
    
    if (session.role !== 'admin') {
      query = query.eq('user_id', session.userId);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[tasks PUT]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
