import { supabaseAdmin } from './supabase';
import { readJsonStore, writeJsonStore } from './local-store';

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

const FLOW_PROJECTS_FILE = 'flow_projects.json';

function readLocalStore(): Record<string, FlowProject[]> {
  return readJsonStore<Record<string, FlowProject[]>>(FLOW_PROJECTS_FILE, {});
}

function writeLocalStore(store: Record<string, FlowProject[]>) {
  writeJsonStore(FLOW_PROJECTS_FILE, store);
}

/**
 * Fetch all projects for a specific user.
 * If user has no projects, creates a default project automatically.
 */
export async function getFlowProjects(userId: string): Promise<FlowProject[]> {
  if (!userId) return [];

  const defaultProjectId = `flow_proj_default_${userId}`;
  const localStore = readLocalStore();
  let userProjects: FlowProject[] = localStore[userId] || [];

  // 1. Fetch from Supabase tasks table (app_id = 'boutiqaat-flow-project')
  try {
    const { data: dbProjects, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('app_id', 'boutiqaat-flow-project')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Fetch user generations to compute accurate per-project item counts and latest thumbnails
    const { data: userGenTasks } = await supabaseAdmin
      .from('tasks')
      .select('id, outputs, node_info_list, created_at')
      .eq('user_id', userId)
      .or('app_id.like.quick-create%,app_id.like.boutiqaat-flow%')
      .neq('app_id', 'boutiqaat-flow-project')
      .order('created_at', { ascending: false });

    const projectCounts = new Map<string, number>();
    const projectThumbs = new Map<string, string>();

    (userGenTasks || []).forEach((t: any) => {
      const pNode = (t.node_info_list || []).find((n: any) => n.fieldName === 'project_id');
      // If task has no project_id or is marked default, assign to defaultProjectId
      const pId = (pNode?.fieldValue && pNode.fieldValue !== 'NONE') ? pNode.fieldValue : defaultProjectId;

      projectCounts.set(pId, (projectCounts.get(pId) || 0) + 1);

      if (!projectThumbs.has(pId) && Array.isArray(t.outputs) && t.outputs.length > 0) {
        const firstOut = t.outputs[0];
        const thumb = typeof firstOut === 'string' ? firstOut : (firstOut.fileUrl || firstOut.url || firstOut.download_url);
        if (thumb) projectThumbs.set(pId, thumb);
      }
    });

    const projectMap = new Map<string, FlowProject>();

    if (!error && dbProjects && dbProjects.length > 0) {
      dbProjects.forEach((t: any) => {
        let meta: any = {};
        const pNode = (t.node_info_list || []).find((n: any) => n.fieldName === 'project_meta');
        if (pNode?.fieldValue) {
          try { meta = JSON.parse(pNode.fieldValue); } catch {}
        }

        const thumb = projectThumbs.get(t.id) || meta.thumbnailUrl || (Array.isArray(t.outputs) && t.outputs[0]?.fileUrl) || undefined;
        const count = projectCounts.get(t.id) ?? meta.itemCount ?? 0;

        projectMap.set(t.id, {
          id: t.id,
          userId: t.user_id,
          name: t.app_name || meta.name || 'Main Studio Flow',
          description: meta.description || '',
          createdAt: t.created_at,
          updatedAt: t.updated_at || t.created_at,
          itemCount: count,
          thumbnailUrl: thumb,
        });
      });
    }

    // Merge with local storage projects
    userProjects.forEach(p => {
      if (!projectMap.has(p.id)) {
        projectMap.set(p.id, {
          ...p,
          itemCount: projectCounts.get(p.id) ?? p.itemCount,
          thumbnailUrl: projectThumbs.get(p.id) || p.thumbnailUrl,
        });
      } else {
        const existing = projectMap.get(p.id)!;
        projectMap.set(p.id, {
          ...existing,
          itemCount: projectCounts.get(p.id) ?? existing.itemCount,
          thumbnailUrl: projectThumbs.get(p.id) || existing.thumbnailUrl,
        });
      }
    });

    // Ensure default project exists
    if (!projectMap.has(defaultProjectId)) {
      const defThumb = projectThumbs.get(defaultProjectId);
      const defCount = projectCounts.get(defaultProjectId) || 0;
      projectMap.set(defaultProjectId, {
        id: defaultProjectId,
        userId,
        name: 'Main Studio Flow',
        description: 'Default campaign workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        itemCount: defCount,
        thumbnailUrl: defThumb,
      });

      // Insert default project into DB
      await supabaseAdmin.from('tasks').insert({
        id: defaultProjectId,
        runninghub_task_id: defaultProjectId,
        user_id: userId,
        app_id: 'boutiqaat-flow-project',
        app_name: 'Main Studio Flow',
        status: 'SUCCESS',
        outputs: [],
        node_info_list: [
          {
            nodeId: 'PROJECT',
            fieldName: 'project_meta',
            fieldValue: JSON.stringify({ name: 'Main Studio Flow', description: 'Default campaign workspace', isDefault: true }),
          },
        ],
      });
    }

    userProjects = Array.from(projectMap.values()).sort((a, b) => {
      // Put default project first, then sort by date
      if (a.id === defaultProjectId) return -1;
      if (b.id === defaultProjectId) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  } catch (err) {
    console.warn('[getFlowProjects DB fetch error]', err);
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
      runninghub_task_id: projectId,
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
