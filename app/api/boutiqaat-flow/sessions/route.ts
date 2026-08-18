import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/boutiqaat-flow/sessions — fetch all Boutiqaat Flow generations for history tracking
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const userId = session?.userId;
    const isManagement = session?.role === 'admin' || session?.role === 'manager';

    let query = supabaseAdmin
      .from('quick_create_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (userId && !isManagement) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      // Fallback to tasks table if quick_create_sessions is not yet initialized
      let fallbackQuery = supabaseAdmin
        .from('tasks')
        .select('*')
        .or('app_id.like.quick-create%,app_id.like.boutiqaat-flow%')
        .order('created_at', { ascending: false })
        .limit(50);

      if (userId && !isManagement) {
        fallbackQuery = fallbackQuery.eq('user_id', userId);
      }

      const { data: fallbackTasks } = await fallbackQuery;

      const mapped = (fallbackTasks || []).map(t => {
        const infoMap: Record<string, string> = {};
        (t.node_info_list || []).forEach((n: any) => {
          if (n.fieldName && n.fieldValue) infoMap[n.fieldName] = n.fieldValue;
        });

        let attachments = [];
        try {
          if (infoMap.attachments) attachments = JSON.parse(infoMap.attachments);
        } catch {}

        return {
          id: t.id,
          task_id: t.runninghub_task_id || t.id,
          mode: infoMap.mode || (t.app_id?.endsWith('video') ? 'video' : 'image'),
          prompt: infoMap.prompt || t.app_name || 'Generation',
          model: infoMap.model || 'Standard',
          ratio: infoMap.ratio || '16:9',
          quality: infoMap.quality || '1k',
          status: t.status || 'SUCCESS',
          attachments,
          outputs: t.outputs || [],
          created_at: t.created_at,
          updated_at: t.updated_at,
        };
      });

      return NextResponse.json({ sessions: mapped });
    }

    return NextResponse.json({ sessions: data || [] });
  } catch (err: any) {
    console.error('[boutiqaat-flow/sessions GET Error]:', err);
    return NextResponse.json({ sessions: [] });
  }
}

// POST /api/boutiqaat-flow/sessions — create new Boutiqaat Flow generation record
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const body = await req.json();

    const {
      id,
      task_id,
      mode = 'image',
      prompt,
      model,
      ratio = '16:9',
      quality = '1k',
      attachments = [],
      status = 'QUEUED',
    } = body;

    if (!task_id || !prompt) {
      return NextResponse.json({ error: 'task_id and prompt are required' }, { status: 400 });
    }

    const payload: any = {
      id: id || `${Date.now()}-qc`,
      task_id,
      user_id: session?.userId || null,
      mode,
      prompt,
      model: model || 'Standard',
      ratio,
      quality,
      status,
      attachments,
      outputs: [],
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('quick_create_sessions')
      .insert(payload)
      .select()
      .single();

    if (error) {
      // Fallback: insert to tasks table if dedicated table not yet migrated
      await supabaseAdmin.from('tasks').insert({
        id: payload.id,
        runninghub_task_id: task_id,
        user_id: session?.userId || null,
        app_id: `boutiqaat-flow-${mode}`,
        app_name: prompt,
        status,
        outputs: [],
        node_info_list: [
          { nodeId: 'prompt', fieldName: 'prompt', fieldValue: prompt },
          { nodeId: 'model', fieldName: 'model', fieldValue: model },
          { nodeId: 'ratio', fieldName: 'ratio', fieldValue: ratio },
          { nodeId: 'quality', fieldName: 'quality', fieldValue: quality },
          { nodeId: 'mode', fieldName: 'mode', fieldValue: mode },
          { nodeId: 'attachments', fieldName: 'attachments', fieldValue: JSON.stringify(attachments) },
        ],
      });
    }

    return NextResponse.json({ success: true, session: data || payload });
  } catch (err: any) {
    console.error('[boutiqaat-flow/sessions POST Error]:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/boutiqaat-flow/sessions — update status and outputs when completed
export async function PUT(req: NextRequest) {
  try {
    const { id, task_id, status, outputs = [], error = null } = await req.json();

    const targetId = id || task_id;
    if (!targetId) {
      return NextResponse.json({ error: 'id or task_id is required' }, { status: 400 });
    }

    // Try updating dedicated table
    const { error: updateErr } = await supabaseAdmin
      .from('quick_create_sessions')
      .update({
        status,
        outputs,
        error,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${targetId},task_id.eq.${targetId}`);

    if (updateErr) {
      // Fallback update tasks table
      await supabaseAdmin
        .from('tasks')
        .update({
          status,
          outputs,
          updated_at: new Date().toISOString(),
        })
        .or(`id.eq.${targetId},runninghub_task_id.eq.${targetId}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[boutiqaat-flow/sessions PUT Error]:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
