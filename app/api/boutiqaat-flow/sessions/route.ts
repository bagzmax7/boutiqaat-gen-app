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
    const viewUserId = searchParams.get('viewUserId');
    const isManagement = session.role === 'admin' || session.role === 'manager';

    // Target user ID: admin/manager can view a specific user if requested, otherwise strictly session.userId
    const targetUserId = (isManagement && viewUserId) ? viewUserId : session.userId;
    const defaultProjectId = `flow_proj_default_${targetUserId}`;

    // Query tasks table scoped to the target user
    let query = supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('user_id', targetUserId)
      .or('app_id.like.quick-create%,app_id.like.boutiqaat-flow%')
      .neq('app_id', 'boutiqaat-flow-project')
      .order('created_at', { ascending: false })
      .limit(300);

    const { data: userTasks, error } = await query;

    if (error) {
      console.error('[boutiqaat-flow/sessions GET Error]:', error);
      return NextResponse.json({ sessions: [] });
    }

    // Smart Map for Deduplication: Merge multiple rows with same runninghub_task_id
    const taskMap = new Map<string, any>();

    for (const t of (userTasks || [])) {
      if (t.app_id === 'boutiqaat-flow-project') continue;
      const taskId = t.runninghub_task_id || t.id;
      if (!taskId) continue;

      const infoMap: Record<string, string> = {};
      (t.node_info_list || []).forEach((n: any) => {
        if (n.fieldName && n.fieldValue) infoMap[n.fieldName] = n.fieldValue;
      });

      let attachments = [];
      try {
        if (infoMap.attachments) attachments = JSON.parse(infoMap.attachments);
      } catch {}

      const sessionItem = {
        id: t.id,
        task_id: taskId,
        project_id: infoMap.project_id || defaultProjectId,
        mode: infoMap.mode || (t.app_id?.endsWith('video') ? 'video' : 'image'),
        prompt: infoMap.prompt || infoMap.text || t.app_name || 'Generation',
        model: infoMap.model || 'Standard',
        ratio: infoMap.ratio || '16:9',
        quality: infoMap.quality || '1k',
        status: t.status || 'SUCCESS',
        attachments,
        outputs: Array.isArray(t.outputs) ? t.outputs : [],
        created_at: t.created_at,
        updated_at: t.updated_at || t.created_at,
      };

      if (!taskMap.has(taskId)) {
        taskMap.set(taskId, sessionItem);
      } else {
        const existing = taskMap.get(taskId);
        const existingHasOutputs = existing.outputs && existing.outputs.length > 0;
        const currentHasOutputs = sessionItem.outputs && sessionItem.outputs.length > 0;

        // Prefer the row that has real output files and SUCCESS status
        if (!existingHasOutputs && currentHasOutputs) {
          taskMap.set(taskId, { ...existing, ...sessionItem, outputs: sessionItem.outputs });
        } else if (sessionItem.status === 'SUCCESS' && existing.status !== 'SUCCESS') {
          taskMap.set(taskId, { ...existing, ...sessionItem, status: 'SUCCESS' });
        }
      }
    }

    let mapped = Array.from(taskMap.values());

    // Filter by projectId if specified
    if (projectId) {
      const isSelectingDefault = (projectId === defaultProjectId || projectId.includes('default') || projectId.includes('main'));
      mapped = mapped.filter(item => {
        if (item.project_id === projectId) return true;
        if (isSelectingDefault && (!item.project_id || item.project_id === defaultProjectId || item.project_id === 'NONE')) {
          return true;
        }
        return false;
      });
    }

    // Sort chronologically (newest first)
    mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ sessions: mapped });
  } catch (err: any) {
    console.error('[boutiqaat-flow/sessions GET Exception]:', err);
    return NextResponse.json({ sessions: [] });
  }
}

// POST /api/boutiqaat-flow/sessions — create or update Boutiqaat Flow generation record
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

    const taskIdToSave = id || task_id;

    const nodeInfoList = [
      { nodeId: 'prompt', fieldName: 'prompt', fieldValue: prompt },
      { nodeId: 'model', fieldName: 'model', fieldValue: model || 'Standard' },
      { nodeId: 'ratio', fieldName: 'ratio', fieldValue: ratio },
      { nodeId: 'quality', fieldName: 'quality', fieldValue: quality },
      { nodeId: 'mode', fieldName: 'mode', fieldValue: mode },
      { nodeId: 'project', fieldName: 'project_id', fieldValue: activeProjectId },
      { nodeId: 'attachments', fieldName: 'attachments', fieldValue: JSON.stringify(attachments) },
    ];

    // Check if task already exists in DB to prevent duplicate rows
    const { data: existingTask } = await supabaseAdmin
      .from('tasks')
      .select('id, outputs')
      .or(`id.eq.${task_id},runninghub_task_id.eq.${task_id}`)
      .maybeSingle();

    if (existingTask) {
      await supabaseAdmin
        .from('tasks')
        .update({
          app_id: `boutiqaat-flow-${mode}`,
          app_name: prompt,
          node_info_list: nodeInfoList,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTask.id);
    } else {
      await supabaseAdmin.from('tasks').insert({
        id: taskIdToSave,
        runninghub_task_id: task_id,
        user_id: session.userId,
        app_id: `boutiqaat-flow-${mode}`,
        app_name: prompt,
        status,
        outputs: [],
        node_info_list: nodeInfoList,
      });
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

    // Update tasks table matching by id OR runninghub_task_id
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
      const firstOut = finalOutputs[0];
      const firstUrl = typeof firstOut === 'string' ? firstOut : (firstOut.fileUrl || firstOut.url);
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

