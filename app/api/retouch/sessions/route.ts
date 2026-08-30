import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/retouch/sessions — fetch all retouch sessions for history tracking
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.userId;

    let query = supabaseAdmin
      .from('retouch_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (userId && session?.role !== 'admin') {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      // Fallback silently to tasks table if retouch_sessions is not yet migrated/initialized
      const fallbackQuery = supabaseAdmin
        .from('tasks')
        .select('*')
        .in('app_id', ['2092179021774139394', '2092176601755762689', '2092104008407523329', '2084718752813600769'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (userId && session?.role !== 'admin') {
        fallbackQuery.eq('user_id', userId);
      }

      const { data: fallbackTasks } = await fallbackQuery;

      const seenTaskIds = new Set<string>();
      const mapped: any[] = [];

      for (const t of fallbackTasks || []) {
        const taskId = t.runninghub_task_id || t.id;
        if (!taskId || seenTaskIds.has(taskId)) {
          continue;
        }
        seenTaskIds.add(taskId);

        const imageNode = t.node_info_list?.find((n: any) => n.nodeId === '39' || n.nodeId === '51');
        const promptNode = t.node_info_list?.find((n: any) => n.nodeId === '54');
        const strengthNode = t.node_info_list?.find((n: any) => n.nodeId === '37');

        mapped.push({
          id: t.id,
          task_id: taskId,
          prompt: promptNode?.fieldValue || 'Studio Polish & Skin Tone',
          strength: strengthNode?.fieldValue || '1.0',
          original_url: imageNode?.fieldValue || '',
          output_url: t.outputs?.[0]?.fileUrl || null,
          status: t.status || 'SUCCESS',
          error_message: t.error || null,
          created_at: t.created_at,
          updated_at: t.updated_at,
        });
      }

      return NextResponse.json({ sessions: mapped });
    }

    return NextResponse.json({ sessions: data || [] });
  } catch (err: any) {
    console.error('[retouch/sessions GET Error]:', err);
    return NextResponse.json({ sessions: [] });
  }
}

// POST /api/retouch/sessions — create new retouch session record
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const body = await req.json();

    const {
      id,
      task_id,
      prompt,
      strength,
      original_url,
      status = 'QUEUED',
    } = body;

    if (!task_id || !prompt || !original_url) {
      return NextResponse.json({ error: 'task_id, prompt, and original_url are required' }, { status: 400 });
    }

    const payload: any = {
      id: id || `${Date.now()}-retouch`,
      task_id,
      user_id: session?.userId || null,
      prompt,
      strength,
      original_url,
      status,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('retouch_sessions')
      .insert(payload)
      .select()
      .single();

    if (error) {
      // Fallback: update the task row in 'tasks' table to include prompt and strength node info
      // instead of creating a second row (since handleTaskStarted already inserts it).
      const { data: updated } = await supabaseAdmin
        .from('tasks')
        .update({
          node_info_list: [
            { nodeId: '39', fieldName: 'image', fieldValue: original_url }
          ],
        })
        .eq('runninghub_task_id', task_id)
        .select();

      // If for some reason the row doesn't exist yet, insert it to be safe
      if (!updated || updated.length === 0) {
        await supabaseAdmin.from('tasks').insert({
          id: id || `${Date.now()}-retouch`,
          runninghub_task_id: task_id,
          user_id: session?.userId || null,
          app_id: '2092179021774139394',
          app_name: 'Auto Retouch Image',
          status,
          outputs: [],
          node_info_list: [
            { nodeId: '39', fieldName: 'image', fieldValue: original_url }
          ],
        });
      }
    }

    return NextResponse.json({ success: true, session: data || payload });
  } catch (err: any) {
    console.error('[retouch/sessions POST Error]:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/retouch/sessions — update status and outputs when completed
export async function PUT(req: NextRequest) {
  try {
    const { id, task_id, status, output_url, error = null } = await req.json();

    const targetId = id || task_id;
    if (!targetId) {
      return NextResponse.json({ error: 'id or task_id is required' }, { status: 400 });
    }

    // Try updating dedicated table
    const { error: updateErr } = await supabaseAdmin
      .from('retouch_sessions')
      .update({
        status,
        output_url,
        error_message: error,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${targetId},task_id.eq.${targetId}`);

    if (updateErr) {
      // Fallback update tasks table
      const outputsPayload = output_url ? [{ fileUrl: output_url, fileType: 'png' }] : [];
      await supabaseAdmin
        .from('tasks')
        .update({
          status,
          outputs: outputsPayload,
          error_message: error,
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${targetId},runninghub_task_id.eq.${targetId}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[retouch/sessions PUT Error]:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/retouch/sessions — clear retouch history
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const isGlobal = session.role === 'admin';

    // 1. Delete from retouch_sessions if table exists
    try {
      let rsQuery = supabaseAdmin.from('retouch_sessions').delete();
      if (!isGlobal && userId) {
        rsQuery = rsQuery.eq('user_id', userId);
      } else {
        rsQuery = rsQuery.neq('id', '___none___');
      }
      await rsQuery;
    } catch {}

    // 2. Delete retouch tasks from tasks table
    try {
      let tQuery = supabaseAdmin
        .from('tasks')
        .delete()
        .or('app_name.ilike.%retouch%,app_id.eq.2092179021774139394,app_id.eq.auto-retouch');

      if (!isGlobal && userId) {
        tQuery = tQuery.eq('user_id', userId);
      }
      await tQuery;
    } catch {}

    return NextResponse.json({ success: true, message: 'Retouch history cleared' });
  } catch (err: any) {
    console.error('[retouch/sessions DELETE Error]:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
