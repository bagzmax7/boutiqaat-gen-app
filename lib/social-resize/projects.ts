import { supabaseAdmin } from '../supabase';
import { readJsonStore, writeJsonStore } from '../local-store';

export interface CardVariation {
  url: string;
  modelId: string;
  modelName: string;
  resolution: string;
  timestamp: number;
}

export interface CardState {
  history: CardVariation[];
  currentIndex: number;
  useAIFill: boolean;
}

export interface SocialResizeProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  sourceImageUrl: string | null;
  focalPoint: { x: number; y: number };
  selectedModel: string;
  resolution: '1k' | '2k' | '4k';
  activeCategory: 'all' | 'boutiqaat' | 'social';
  customPrompt: string;
  cardStates: Record<string, CardState>;
  createdAt: string;
  updatedAt: string;
}

const SOCIAL_RESIZE_PROJECTS_FILE = 'social_resize_projects.json';

function readLocalStore(): Record<string, SocialResizeProject[]> {
  return readJsonStore<Record<string, SocialResizeProject[]>>(SOCIAL_RESIZE_PROJECTS_FILE, {});
}

function writeLocalStore(store: Record<string, SocialResizeProject[]>) {
  writeJsonStore(SOCIAL_RESIZE_PROJECTS_FILE, store);
}

/**
 * Fetch all Social Resize projects for a user.
 */
export async function getSocialResizeProjects(userId: string): Promise<SocialResizeProject[]> {
  if (!userId) return [];

  const localStore = readLocalStore();
  let userProjects: SocialResizeProject[] = localStore[userId] || [];

  // Try fetching from Supabase tasks table (app_id = 'social-resize-project')
  try {
    const { data: dbProjects, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('app_id', 'social-resize-project')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (!error && dbProjects && dbProjects.length > 0) {
      const mapped: SocialResizeProject[] = dbProjects.map((t: any) => {
        let meta: any = {};
        const pNode = (t.node_info_list || []).find((n: any) => n.fieldName === 'project_state');
        if (pNode?.fieldValue) {
          try { meta = JSON.parse(pNode.fieldValue); } catch {}
        }
        return {
          id: t.id,
          userId: t.user_id,
          name: t.app_name || meta.name || 'Untitled Campaign',
          description: meta.description || '',
          sourceImageUrl: meta.sourceImageUrl || null,
          focalPoint: meta.focalPoint || { x: 0.5, y: 0.5 },
          selectedModel: meta.selectedModel || 'nano-banana-2',
          resolution: meta.resolution || '1k',
          activeCategory: meta.activeCategory || 'all',
          customPrompt: meta.customPrompt || '',
          cardStates: meta.cardStates || {},
          createdAt: t.created_at,
          updatedAt: t.updated_at || t.created_at,
        };
      });

      const projectMap = new Map<string, SocialResizeProject>();
      userProjects.forEach(p => projectMap.set(p.id, p));
      mapped.forEach(p => projectMap.set(p.id, p));

      userProjects = Array.from(projectMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
  } catch (err) {
    console.warn('[getSocialResizeProjects DB fetch warning]', err);
  }

  // Auto-initialize default project if none exists
  if (userProjects.length === 0) {
    const defaultProj = await createSocialResizeProject(userId, 'Main Resize Workspace');
    return [defaultProj];
  }

  localStore[userId] = userProjects;
  writeLocalStore(localStore);

  return userProjects;
}

/**
 * Create a new Social Resize Project
 */
export async function createSocialResizeProject(
  userId: string,
  name: string,
  initialData?: Partial<SocialResizeProject>
): Promise<SocialResizeProject> {
  const projectId = `resize_proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const newProject: SocialResizeProject = {
    id: projectId,
    userId,
    name: name.trim() || 'Untitled Project',
    description: initialData?.description || '',
    sourceImageUrl: initialData?.sourceImageUrl || null,
    focalPoint: initialData?.focalPoint || { x: 0.5, y: 0.5 },
    selectedModel: initialData?.selectedModel || 'nano-banana-2',
    resolution: initialData?.resolution || '1k',
    activeCategory: initialData?.activeCategory || 'all',
    customPrompt: initialData?.customPrompt || '',
    cardStates: initialData?.cardStates || {},
    createdAt: now,
    updatedAt: now,
  };

  const localStore = readLocalStore();
  const list = localStore[userId] || [];
  localStore[userId] = [newProject, ...list];
  writeLocalStore(localStore);

  try {
    await supabaseAdmin.from('tasks').insert({
      id: projectId,
      user_id: userId,
      app_id: 'social-resize-project',
      app_name: newProject.name,
      status: 'SUCCESS',
      outputs: newProject.sourceImageUrl ? [{ fileUrl: newProject.sourceImageUrl }] : [],
      node_info_list: [
        {
          nodeId: 'PROJECT',
          fieldName: 'project_state',
          fieldValue: JSON.stringify(newProject),
        },
      ],
    });
  } catch (err) {
    console.warn('[createSocialResizeProject DB sync warning]', err);
  }

  return newProject;
}

/**
 * Save / Update Project State (Upsert)
 */
export async function saveSocialResizeProject(
  id: string,
  userId: string,
  projectData: Partial<SocialResizeProject>
): Promise<SocialResizeProject | null> {
  const localStore = readLocalStore();
  const list = localStore[userId] || [];
  const index = list.findIndex(p => p.id === id);

  let existing = index >= 0 ? list[index] : null;

  if (!existing) {
    const projects = await getSocialResizeProjects(userId);
    existing = projects.find(p => p.id === id) || null;
  }

  if (!existing) {
    // Create new if id not found
    return createSocialResizeProject(userId, projectData.name || 'New Campaign', projectData);
  }

  const updated: SocialResizeProject = {
    ...existing,
    ...projectData,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    list[index] = updated;
  } else {
    list.unshift(updated);
  }
  localStore[userId] = list;
  writeLocalStore(localStore);

  // Sync to Supabase tasks table
  try {
    await supabaseAdmin
      .from('tasks')
      .update({
        app_name: updated.name,
        updated_at: updated.updatedAt,
        outputs: updated.sourceImageUrl ? [{ fileUrl: updated.sourceImageUrl }] : [],
        node_info_list: [
          {
            nodeId: 'PROJECT',
            fieldName: 'project_state',
            fieldValue: JSON.stringify(updated),
          },
        ],
      })
      .eq('id', id)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('[saveSocialResizeProject DB update warning]', err);
  }

  return updated;
}

/**
 * Delete a Social Resize Project
 */
export async function deleteSocialResizeProject(id: string, userId: string): Promise<boolean> {
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
    console.warn('[deleteSocialResizeProject DB delete warning]', err);
  }

  return true;
}
