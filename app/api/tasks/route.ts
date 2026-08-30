import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { archiveOutputsList } from '@/lib/storage-archiver';

// GET /api/tasks — return current user's task history from Supabase
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isManagement = session.role === 'admin' || session.role === 'manager';
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const filterUserId = url.searchParams.get('userId');
  const scope = url.searchParams.get('scope');

  // Fetch up to 3x limit to ensure deduplicated count matches requested limit
  let query = supabaseAdmin
    .from('tasks')
    .select('*, users(name, email)')
    .order('created_at', { ascending: false })
    .limit(limit * 3);

  if (isManagement && scope === 'all') {
    // Admin / Manager requesting platform-wide overview
    if (filterUserId) {
      query = query.eq('user_id', filterUserId);
    }
  } else {
    // Default personal view (for editors, and for admin personal history / studio)
    query = query.eq('user_id', session.userId);
  }

  const { data: rawTasks } = await query;
  
  // Deduplicate tasks
  const map = new Map<string, any>();
  for (const t of (rawTasks || [])) {
    const key = (t.runninghub_task_id && String(t.runninghub_task_id).trim()) || t.id;
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, t);
    } else {
      const existingSuccess = existing.status === 'SUCCESS';
      const currentSuccess = t.status === 'SUCCESS';
      const existingHasOut = Array.isArray(existing.outputs) && existing.outputs.length > 0;
      const currentHasOut = Array.isArray(t.outputs) && t.outputs.length > 0;
      
      const shouldReplace = 
        (!existingHasOut && currentHasOut) || 
        (currentSuccess && !existingSuccess) || 
        (new Date(t.created_at).getTime() > new Date(existing.created_at).getTime());

      if (shouldReplace) {
        map.set(key, {
          ...existing,
          ...t,
          app_name: (t.app_name && !t.app_name.startsWith('App 20')) ? t.app_name : existing.app_name,
          outputs: currentHasOut ? t.outputs : existing.outputs,
        });
      }
    }
  }

  // Deduplicate tasks sharing identical output media URLs
  const urlMap = new Map<string, any>();
  const deduplicated: any[] = [];
  for (const t of Array.from(map.values())) {
    const firstOut = t.outputs && t.outputs.length > 0 
      ? (typeof t.outputs[0] === 'string' ? t.outputs[0] : t.outputs[0]?.fileUrl || t.outputs[0]?.url)
      : null;

    if (firstOut && t.status === 'SUCCESS') {
      if (!urlMap.has(firstOut)) {
        urlMap.set(firstOut, t);
        deduplicated.push(t);
      }
    } else {
      deduplicated.push(t);
    }
  }

  deduplicated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ tasks: deduplicated.slice(0, limit) });
}

// POST /api/tasks — persist a new task to Supabase (called internally after run-app)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, runninghub_task_id, app_id, app_name, api_key_type, node_info_list } = await req.json();

    // Check if task with runninghub_task_id already exists to prevent duplicates
    if (runninghub_task_id) {
      const { data: existing } = await supabaseAdmin
        .from('tasks')
        .select('id, app_name, node_info_list')
        .eq('runninghub_task_id', runninghub_task_id)
        .maybeSingle();

      if (existing) {
        // Update existing row with better app_name / node_info_list
        await supabaseAdmin
          .from('tasks')
          .update({
            app_id: app_id || undefined,
            app_name: (app_name && !app_name.startsWith('App 20')) ? app_name : existing.app_name,
            api_key_type: api_key_type || undefined,
            node_info_list: (node_info_list && node_info_list.length > 0) ? node_info_list : existing.node_info_list,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        return NextResponse.json({ success: true, id: existing.id });
      }
    }

    await supabaseAdmin.from('tasks').insert({
      id: id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      runninghub_task_id,
      user_id: session.userId,
      app_id,
      app_name,
      status: 'QUEUED',
      api_key_type: api_key_type || 'consumer',
      node_info_list: node_info_list || [],
      outputs: [],
      created_at: new Date().toISOString(),
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

    const updates: any = { status, updated_at: new Date().toISOString() };
    if (outputs !== undefined) {
      if (Array.isArray(outputs) && outputs.length > 0) {
        const archivedOutputs = await archiveOutputsList(outputs, session.userId, id);
        updates.outputs = archivedOutputs;
      } else {
        updates.outputs = outputs;
      }
    }
    if (taskError !== undefined) updates.error_message = taskError;
    if (node_info_list !== undefined) updates.node_info_list = node_info_list;

    // We can only update tasks belonging to the current user (enforced by RLS or user_id check)
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
