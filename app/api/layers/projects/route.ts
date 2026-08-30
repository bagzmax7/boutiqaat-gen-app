import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { LayersProject } from '@/lib/types';
import fs from 'fs';
import path from 'path';

// Local file storage fallback
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'layers_projects.json');

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
    }
  } catch (err) {
    console.warn('[Data dir init warning]', err);
  }
}

function readLocalProjects(): Record<string, LayersProject[]> {
  try {
    ensureDataFile();
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw || '{}');
      // Sanitize
      for (const k of Object.keys(data)) {
        if (Array.isArray(data[k])) {
          data[k] = data[k].filter((p: any) => p && p.id && p.name);
        }
      }
      return data;
    }
  } catch {}
  return {};
}

function writeLocalProjects(store: Record<string, LayersProject[]>) {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Write local projects error]', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('id');
    const viewUserId = searchParams.get('viewUserId');
    const isManagement = session.role === 'admin' || session.role === 'manager';

    const targetUserId = (isManagement && viewUserId) ? viewUserId : session.userId;

    const projectMap = new Map<string, LayersProject>();

    // 1. Try querying Supabase tasks table (app_id = 'boutiqaat-layers')
    try {
      let taskQuery = supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('app_id', 'boutiqaat-layers')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (projectId) {
        taskQuery = taskQuery.eq('id', projectId);
      }

      const { data: taskData, error: taskErr } = await taskQuery;
      if (!taskErr && taskData && taskData.length > 0) {
        for (const t of taskData) {
          const pNode = (t.node_info_list || []).find((n: any) => n.fieldName === 'project_data');
          if (pNode && pNode.fieldValue) {
            try {
              const parsed: LayersProject = JSON.parse(pNode.fieldValue);
              if (parsed && parsed.id && parsed.name) {
                projectMap.set(parsed.id, {
                  ...parsed,
                  user_id: targetUserId,
                  thumbnail_url: parsed.thumbnail_url || (Array.isArray(t.outputs) && t.outputs[0]?.url) || null,
                  created_at: parsed.created_at || t.created_at,
                  updated_at: parsed.updated_at || t.updated_at || t.created_at,
                });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('[GET /api/layers/projects Supabase error]', err);
    }

    // 2. Merge with Local filesystem store fallback
    const localStore = readLocalProjects();
    const userProjects = (localStore[targetUserId] || []).filter(p => p && p.id && p.name);
    for (const p of userProjects) {
      if (!projectMap.has(p.id)) {
        projectMap.set(p.id, p);
      }
    }

    const allProjects = Array.from(projectMap.values()).sort(
      (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    );

    if (projectId) {
      const proj = projectMap.get(projectId) || allProjects.find(p => p.id === projectId) || null;
      return NextResponse.json({ project: proj });
    }

    return NextResponse.json({ projects: allProjects });
  } catch (error: any) {
    console.error('[GET /api/layers/projects error]', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, project, projectId } = body;

    const localStore = readLocalProjects();
    const userProjects = (localStore[session.userId] || []).filter(p => p && p.id && p.name);

    // Action: Create Project
    if (action === 'create' || (!action && project && !project.id)) {
      const newProj: LayersProject = {
        id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: session.userId,
        department_id: session.departmentId || null,
        name: project.name || 'Untitled Layers Project',
        category: project.category || 'general',
        thumbnail_url: project.thumbnail_url || (project.layers?.[0]?.currentUrl || null),
        canvas_width: project.canvas_width || 1200,
        canvas_height: project.canvas_height || 1200,
        layers: project.layers || [],
        revision_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Save to Supabase tasks table
      try {
        await supabaseAdmin.from('tasks').upsert({
          id: newProj.id,
          runninghub_task_id: newProj.id,
          user_id: session.userId,
          app_id: 'boutiqaat-layers',
          app_name: `Boutiqaat Layers: ${newProj.name}`,
          status: 'SUCCESS',
          api_key_type: 'enterprise',
          node_info_list: [
            { nodeId: 'PROJECT', fieldName: 'project_data', fieldValue: JSON.stringify(newProj) }
          ],
          outputs: [{ url: newProj.thumbnail_url, name: newProj.name }],
          created_at: newProj.created_at,
          updated_at: newProj.updated_at,
        });
      } catch (err) {
        console.warn('[Supabase tasks layer project save error]', err);
      }

      // 2. Local filesystem store
      localStore[session.userId] = [newProj, ...userProjects];
      writeLocalProjects(localStore);

      return NextResponse.json({ success: true, project: newProj });
    }

    // Action: Save / Update Project
    if (action === 'update' || (!action && project && project.id)) {
      const targetProj = project as LayersProject;
      const updatedProj: LayersProject = {
        ...targetProj,
        user_id: session.userId,
        updated_at: new Date().toISOString(),
      };

      // 1. Update Supabase tasks table
      try {
        await supabaseAdmin.from('tasks').upsert({
          id: updatedProj.id,
          runninghub_task_id: updatedProj.id,
          user_id: session.userId,
          app_id: 'boutiqaat-layers',
          app_name: `Boutiqaat Layers: ${updatedProj.name}`,
          status: 'SUCCESS',
          api_key_type: 'enterprise',
          node_info_list: [
            { nodeId: 'PROJECT', fieldName: 'project_data', fieldValue: JSON.stringify(updatedProj) }
          ],
          outputs: [{ url: updatedProj.thumbnail_url, name: updatedProj.name }],
          created_at: updatedProj.created_at || new Date().toISOString(),
          updated_at: updatedProj.updated_at,
        });
      } catch (err) {
        console.warn('[Supabase tasks layer project update error]', err);
      }

      // 2. Update local store
      const idx = userProjects.findIndex(p => p.id === updatedProj.id);
      if (idx !== -1) {
        userProjects[idx] = updatedProj;
      } else {
        userProjects.unshift(updatedProj);
      }
      localStore[session.userId] = userProjects;
      writeLocalProjects(localStore);

      return NextResponse.json({ success: true, project: updatedProj });
    }

    // Action: Duplicate Project (Fork Revision)
    if (action === 'duplicate' && projectId) {
      // Find source from local or DB
      let source = userProjects.find(p => p.id === projectId);
      if (!source) {
        const { data: dbTask } = await supabaseAdmin.from('tasks').select('*').eq('id', projectId).maybeSingle();
        const pNode = (dbTask?.node_info_list || []).find((n: any) => n.fieldName === 'project_data');
        if (pNode?.fieldValue) {
          try { source = JSON.parse(pNode.fieldValue); } catch {}
        }
      }

      if (!source) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const forked: LayersProject = {
        ...source,
        id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: session.userId,
        name: `${source.name} (Rev ${source.revision_count + 1})`,
        revision_count: source.revision_count + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        await supabaseAdmin.from('tasks').upsert({
          id: forked.id,
          runninghub_task_id: forked.id,
          user_id: session.userId,
          app_id: 'boutiqaat-layers',
          app_name: `Boutiqaat Layers: ${forked.name}`,
          status: 'SUCCESS',
          api_key_type: 'enterprise',
          node_info_list: [
            { nodeId: 'PROJECT', fieldName: 'project_data', fieldValue: JSON.stringify(forked) }
          ],
          outputs: [{ url: forked.thumbnail_url, name: forked.name }],
          created_at: forked.created_at,
          updated_at: forked.updated_at,
        });
      } catch {}

      localStore[session.userId] = [forked, ...userProjects];
      writeLocalProjects(localStore);

      return NextResponse.json({ success: true, project: forked });
    }

    // Action: Delete Project
    if (action === 'delete' && projectId) {
      try {
        await supabaseAdmin
          .from('tasks')
          .delete()
          .eq('id', projectId)
          .eq('user_id', session.userId);
      } catch {}

      localStore[session.userId] = userProjects.filter(p => p.id !== projectId);
      writeLocalProjects(localStore);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[POST /api/layers/projects error]', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
