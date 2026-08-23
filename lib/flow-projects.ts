import { supabaseAdmin } from './supabase';
import fs from 'fs';
import path from 'path';

export interface FlowProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  thumbnailUrl?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'flow_projects.json');

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
    }
  } catch (err) {
    console.warn('[Flow projects data file init warning]', err);
  }
}

function readLocalStore(): Record<string, FlowProject[]> {
  try {
    ensureDataFile();
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw || '{}');
    }
  } catch {}
  return {};
}

function writeLocalStore(store: Record<string, FlowProject[]>) {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Flow projects write local store error]', err);
  }
}

/**
 * Fetch all projects for a specific user.
 * If user has no projects, creates a default project automatically.
 */
export async function getFlowProjects(userId: string): Promise<FlowProject[]> {
  if (!userId) return [];

  const localStore = readLocalStore();
  let userProjects: FlowProject[] = localStore[userId] || [];

  // 1. Try fetching from Supabase tasks table (app_id = 'boutiqaat-flow-project')
  try {
    const { data: dbProjects, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('app_id', 'boutiqaat-flow-project')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && dbProjects && dbProjects.length > 0) {
      const mapped: FlowProject[] = dbProjects.map((t: any) => {
        let meta: any = {};
        const pNode = (t.node_info_list || []).find((n: any) => n.fieldName === 'project_meta');
        if (pNode?.fieldValue) {
          try { meta = JSON.parse(pNode.fieldValue); } catch {}
        }
        return {
          id: t.id,
          userId: t.user_id,
          name: t.app_name || meta.name || 'Untitled Project',
          description: meta.description || '',
          createdAt: t.created_at,
          updatedAt: t.updated_at || t.created_at,
          itemCount: meta.itemCount || 0,
          thumbnailUrl: meta.thumbnailUrl || (Array.isArray(t.outputs) && t.outputs[0]?.url) || undefined,
        };
      });

      // Merge with local store
      const projectMap = new Map<string, FlowProject>();
      userProjects.forEach(p => projectMap.set(p.id, p));
      mapped.forEach(p => projectMap.set(p.id, p));

      userProjects = Array.from(projectMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
  } catch (err) {
    console.warn('[getFlowProjects DB fetch error]', err);
  }

  // 2. If no project exists for this user, auto-initialize a default project
  if (userProjects.length === 0) {
    const defaultProj = await createFlowProject(userId, 'Main Studio Flow', 'Default campaign workspace');
    return [defaultProj];
  }

  // Update local cache
  localStore[userId] = userProjects;
  writeLocalStore(localStore);

  return userProjects;
}

/**
 * Create a new Flow Project
 */
export async function createFlowProject(
  userId: string,
  name: string,
  description?: string
): Promise<FlowProject> {
  const projectId = `flow_proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const newProject: FlowProject = {
    id: projectId,
    userId,
    name: name.trim() || 'Untitled Project',
    description: description?.trim() || '',
    createdAt: now,
    updatedAt: now,
    itemCount: 0,
  };

  // 1. Save to local storage
  const localStore = readLocalStore();
  const list = localStore[userId] || [];
  localStore[userId] = [newProject, ...list];
  writeLocalStore(localStore);

  // 2. Sync to Supabase tasks table for cloud durability
  try {
    await supabaseAdmin.from('tasks').insert({
      id: projectId,
      user_id: userId,
      app_id: 'boutiqaat-flow-project',
      app_name: newProject.name,
      status: 'SUCCESS',
      outputs: [],
      node_info_list: [
        {
          nodeId: 'PROJECT',
          fieldName: 'project_meta',
          fieldValue: JSON.stringify({
            name: newProject.name,
            description: newProject.description,
            itemCount: 0,
          }),
        },
      ],
    });
  } catch (err) {
    console.warn('[createFlowProject DB sync error]', err);
  }

  return newProject;
}

/**
 * Update Flow Project (e.g. rename, update item count / thumbnail)
 */
export async function updateFlowProject(
  id: string,
  userId: string,
  updates: Partial<FlowProject>
): Promise<FlowProject | null> {
  const localStore = readLocalStore();
  const list = localStore[userId] || [];
  const index = list.findIndex(p => p.id === id);

  let existing = index >= 0 ? list[index] : null;

  if (!existing) {
    // Attempt fetch from DB
    const projects = await getFlowProjects(userId);
    existing = projects.find(p => p.id === id) || null;
  }

  if (!existing) return null;

  const updated: FlowProject = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    list[index] = updated;
  } else {
    list.unshift(updated);
  }
  localStore[userId] = list;
  writeLocalStore(localStore);

  // Sync to Supabase
  try {
    const pMeta = {
      name: updated.name,
      description: updated.description,
      itemCount: updated.itemCount,
      thumbnailUrl: updated.thumbnailUrl,
    };

    await supabaseAdmin
      .from('tasks')
      .update({
        app_name: updated.name,
        updated_at: updated.updatedAt,
        outputs: updated.thumbnailUrl ? [{ url: updated.thumbnailUrl, fileUrl: updated.thumbnailUrl }] : [],
        node_info_list: [
          { nodeId: 'PROJECT', fieldName: 'project_meta', fieldValue: JSON.stringify(pMeta) },
        ],
      })
      .eq('id', id)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[updateFlowProject DB sync error]', err);
  }

  return updated;
}

/**
 * Delete a Flow Project
 */
export async function deleteFlowProject(id: string, userId: string): Promise<boolean> {
  const localStore = readLocalStore();
  const list = localStore[userId] || [];
  localStore[userId] = list.filter(p => p.id !== id);
  writeLocalStore(localStore);

  try {
    await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[deleteFlowProject DB delete error]', err);
  }

  return true;
}
