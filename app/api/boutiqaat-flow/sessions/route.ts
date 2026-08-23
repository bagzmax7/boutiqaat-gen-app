import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { archiveOutputsList } from '@/lib/storage-archiver';
import { updateFlowProject, getFlowProjects } from '@/lib/flow-projects';

export const dynamic = 'force-dynamic';

// GET /api/boutiqaat-flow/sessions — fetch user's isolated generations (scoped per user & project)
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    // Query tasks table scoped strictly to the authenticated user
    let query = supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('user_id', session.userId)
      .or('app_id.like.quick-create%,app_id.like.boutiqaat-flow%')
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: userTasks, error } = await query;

    if (error) {
      console.error('[boutiqaat-flow/sessions GET Error]:', error);
      return NextResponse.json({ sessions: [] });
    }

    let mapped = (userTasks || []).map(t => {
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
        project_id: infoMap.project_id || null,
        mode: infoMap.mode || (t.app_id?.endsWith('video') ? 'video' : 'image'),
        prompt: infoMap.prompt || t.app_name || 'Generation',
        model: infoMap.model || 'Standard',
        ratio: infoMap.ratio || '16:9',
        quality: infoMap.quality || '1k',
        status: t.status || 'SUCCESS',
        attachments,
        outputs: t.outputs || [],
        created_at: t.created_at,
        updated_at: t.updated_at || t.created_at,
      };
    });

    // Filter by projectId if requested
    if (projectId) {
      mapped = mapped.filter(item => {
        // If project matches or if it's default and item has no project_id
        if (item.project_id === projectId) return true;
        if (!item.project_id && projectId.includes('default')) return true;
        return false;
      });
    }

    return NextResponse.json({ sessions: mapped });
  } catch (err: any) {
    console.error('[boutiqaat-flow/sessions GET Exception]:', err);
    return NextResponse.json({ sessions: [] });
  }
}

// POST /api/boutiqaat-flow/sessions — create new Boutiqaat Flow generation record
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      task_id,
      project_id,
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

    // Determine target projectId
    let activeProjectId = project_id;
    if (!activeProjectId) {
      const userProjects = await getFlowProjects(session.userId);
      activeProjectId = userProjects[0]?.id || `flow_proj_default_${session.userId}`;
    }

    const taskIdToSave = id || `${Date.now()}-qc`;

    const nodeInfoList = [
      { nodeId: 'prompt', fieldName: 'prompt', fieldValue: prompt },
      { nodeId: 'model', fieldName: 'model', fieldValue: model || 'Standard' },
      { nodeId: 'ratio', fieldName: 'ratio', fieldValue: ratio },
      { nodeId: 'quality', fieldName: 'quality', fieldValue: quality },
      { nodeId: 'mode', fieldName: 'mode', fieldValue: mode },
      { nodeId: 'project', fieldName: 'project_id', fieldValue: activeProjectId },
      { nodeId: 'attachments', fieldName: 'attachments', fieldValue: JSON.stringify(attachments) },
    ];

    // Insert to Supabase tasks table
    const { error: insertErr } = await supabaseAdmin.from('tasks').insert({
      id: taskIdToSave,
      runninghub_task_id: task_id,
      user_id: session.userId,
      app_id: `boutiqaat-flow-${mode}`,
      app_name: prompt,
      status,
      outputs: [],
      node_info_list: nodeInfoList,
    });

    if (insertErr) {
      console.warn('[boutiqaat-flow/sessions POST DB insert warning]', insertErr);
    }

    return NextResponse.json({
      success: true,
      session: {
        id: taskIdToSave,
        task_id,
        project_id: activeProjectId,
        mode,
        prompt,
        model,
        ratio,
        quality,
        status,
        attachments,
        outputs: [],
        created_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[boutiqaat-flow/sessions POST Error]:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/boutiqaat-flow/sessions — update status and outputs when completed
export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const { id, task_id, project_id, status, outputs = [], error = null } = await req.json();

    const targetId = id || task_id;
    if (!targetId) {
      return NextResponse.json({ error: 'id or task_id is required' }, { status: 400 });
    }

    let finalOutputs = outputs;
    if (Array.isArray(outputs) && outputs.length > 0) {
      finalOutputs = await archiveOutputsList(outputs, session?.userId || 'shared', targetId);
    }

    // Update tasks table
    const { error: updateErr } = await supabaseAdmin
      .from('tasks')
      .update({
        status,
        outputs: finalOutputs,
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${targetId},runninghub_task_id.eq.${targetId}`);

    if (updateErr) {
      console.warn('[boutiqaat-flow/sessions PUT DB update warning]', updateErr);
    }

    // Update project thumbnail if output is available
    if (project_id && session?.userId && finalOutputs.length > 0) {
      const firstUrl = finalOutputs[0].fileUrl || finalOutputs[0].url;
      if (firstUrl) {
        updateFlowProject(project_id, session.userId, { thumbnailUrl: firstUrl }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, outputs: finalOutputs });
  } catch (err: any) {
    console.error('[boutiqaat-flow/sessions PUT Error]:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
