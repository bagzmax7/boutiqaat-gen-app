import { supabaseAdmin } from '../supabase';
import { RetouchProject, RetouchItem } from './types';
import { readJsonStore, writeJsonStore } from '../local-store';

const RETOUCH_PROJECTS_FILE = 'retouch_projects.json';

function readLocalStore(): Record<string, RetouchProject[]> {
  return readJsonStore<Record<string, RetouchProject[]>>(RETOUCH_PROJECTS_FILE, {});
}

function writeLocalStore(store: Record<string, RetouchProject[]>) {
  writeJsonStore(RETOUCH_PROJECTS_FILE, store);
}

// ── Read User Projects ──────────────────────────────────────────────────────
export async function getUserRetouchProjects(userId: string): Promise<RetouchProject[]> {
  const projectMap = new Map<string, RetouchProject>();

  // 1. Fetch from Supabase tasks table (app_id = 'boutiqaat-retouch')
  try {
    const { data: dbTasks, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('app_id', 'boutiqaat-retouch')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error && dbTasks && dbTasks.length > 0) {
      dbTasks.forEach((t: any) => {
        const pNode = (t.node_info_list || []).find((n: any) => n.fieldName === 'project_data');
        if (pNode?.fieldValue) {
          try {
            const parsed: RetouchProject = JSON.parse(pNode.fieldValue);
            if (parsed && parsed.id) {
              projectMap.set(parsed.id, {
                ...parsed,
                userId,
                updatedAt: parsed.updatedAt || t.updated_at || t.created_at,
                createdAt: parsed.createdAt || t.created_at,
              });
            }
          } catch {}
        }
      });
    }
  } catch (err) {
    console.warn('[Retouch Projects Supabase fetch warning]', err);
  }

  // 2. Merge with local store fallback
  const store = readLocalStore();
  const localList = store[userId] || [];
  localList.forEach(p => {
    if (!projectMap.has(p.id)) {
      projectMap.set(p.id, p);
    }
  });

  return Array.from(projectMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ── Get Single Project ──────────────────────────────────────────────────────
export async function getRetouchProjectById(projectId: string, userId: string): Promise<RetouchProject | null> {
  // 1. Try Supabase tasks table
  try {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      const pNode = (data.node_info_list || []).find((n: any) => n.fieldName === 'project_data');
      if (pNode?.fieldValue) {
        return JSON.parse(pNode.fieldValue);
      }
    }
  } catch {}

  // 2. Fallback to local store
  const store = readLocalStore();
  const userProjects = store[userId] || [];
  return userProjects.find(p => p.id === projectId) || null;
}

// ── Create Project ──────────────────────────────────────────────────────────
export async function createRetouchProject(params: {
  userId: string;
  name: string;
  description?: string;
  defaultModel?: 'flux-2-edit' | 'nano-banana-2';
}): Promise<RetouchProject> {
  const newProject: RetouchProject = {
    id: `retouch_proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: params.userId,
    name: params.name || 'Untitled Retouch Project',
    description: params.description || '',
    thumbnailUrl: undefined,
    defaultModel: params.defaultModel || 'flux-2-edit',
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save to Supabase tasks table
  try {
    await supabaseAdmin.from('tasks').upsert({
      id: newProject.id,
      runninghub_task_id: newProject.id,
      user_id: newProject.userId,
      app_id: 'boutiqaat-retouch',
      app_name: `Retouch: ${newProject.name}`,
      status: 'SUCCESS',
      api_key_type: 'enterprise',
      outputs: [],
      node_info_list: [
        {
          nodeId: 'PROJECT',
          fieldName: 'project_data',
          fieldValue: JSON.stringify(newProject),
        },
      ],
      created_at: newProject.createdAt,
      updated_at: newProject.updatedAt,
    });
  } catch (err) {
    console.warn('[Retouch Projects Supabase insert warning]', err);
  }

  // Always keep local store in sync
  const store = readLocalStore();
  if (!store[params.userId]) store[params.userId] = [];
  store[params.userId].unshift(newProject);
  writeLocalStore(store);

  return newProject;
}

// ── Save / Update Project ───────────────────────────────────────────────────
export async function saveRetouchProject(project: RetouchProject): Promise<void> {
  project.updatedAt = new Date().toISOString();

  // Pick first item's latest output or original as thumbnail
  const firstSuccessfulItem = project.items.find(it => it.versions.some(v => v.status === 'SUCCESS'));
  if (firstSuccessfulItem) {
    const successVersion = firstSuccessfulItem.versions.find(v => v.status === 'SUCCESS');
    project.thumbnailUrl = successVersion?.outputUrl || firstSuccessfulItem.originalUrl;
  } else if (project.items.length > 0) {
    project.thumbnailUrl = project.items[0].originalUrl;
  }

  // Save to Supabase tasks table
  try {
    await supabaseAdmin.from('tasks').upsert({
      id: project.id,
      runninghub_task_id: project.id,
      user_id: project.userId,
      app_id: 'boutiqaat-retouch',
      app_name: `Retouch: ${project.name}`,
      status: 'SUCCESS',
      api_key_type: 'enterprise',
      outputs: project.thumbnailUrl ? [{ url: project.thumbnailUrl, name: project.name }] : [],
      node_info_list: [
        {
          nodeId: 'PROJECT',
          fieldName: 'project_data',
          fieldValue: JSON.stringify(project),
        },
      ],
      created_at: project.createdAt || new Date().toISOString(),
      updated_at: project.updatedAt,
    });
  } catch (err) {
    console.warn('[Retouch Projects Supabase update warning]', err);
  }

  // Always keep local store in sync
  const store = readLocalStore();
  if (!store[project.userId]) store[project.userId] = [];
  const idx = store[project.userId].findIndex(p => p.id === project.id);
  if (idx !== -1) {
    store[project.userId][idx] = project;
  } else {
    store[project.userId].unshift(project);
  }
  writeLocalStore(store);
}

// ── Delete Project ──────────────────────────────────────────────────────────
export async function deleteRetouchProject(projectId: string, userId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[Retouch Projects Supabase delete warning]', err);
  }

  const store = readLocalStore();
  if (store[userId]) {
    store[userId] = store[userId].filter(p => p.id !== projectId);
    writeLocalStore(store);
  }
}
