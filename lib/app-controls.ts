import { supabaseAdmin } from './supabase';
import { readJsonStore, writeJsonStore } from './local-store';

export type AppStatus = 'ACTIVE' | 'COMING_SOON' | 'UNDER_MAINTENANCE' | 'UPDATE_PROCESS';

export interface AppControlItem {
  id: string;
  name: string;
  category: 'studio' | 'generation' | 'utility';
  route: string;
  status: AppStatus;
  description: string;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_APP_CONTROLS: Record<string, AppControlItem> = {
  'boutiqaat-flow': {
    id: 'boutiqaat-flow',
    name: 'Boutiqaat Flow Studio',
    category: 'generation',
    route: '/boutiqaat-flow',
    status: 'ACTIVE',
    description: 'Multi-Model AI Visual Studio for Image & Video Generation',
    updatedAt: new Date().toISOString(),
  },
  'auto-retouch': {
    id: 'auto-retouch',
    name: 'Auto-Retouch Studio',
    category: 'studio',
    route: '/studio/auto-retouch',
    status: 'ACTIVE',
    description: 'Automated E-Commerce Packshot & Commercial Polish',
    updatedAt: new Date().toISOString(),
  },
  'social-resize': {
    id: 'social-resize',
    name: 'Social Resize Studio',
    category: 'studio',
    route: '/studio/social-resize',
    status: 'ACTIVE',
    description: 'AI Generative Outpaint & Multi-Aspect Ratio Adapter',
    updatedAt: new Date().toISOString(),
  },
  'batch-remove-bg': {
    id: 'batch-remove-bg',
    name: 'Batch Background Removal',
    category: 'utility',
    route: '/apps',
    status: 'ACTIVE',
    description: 'High-Throughput Batch Alpha Matting & Transparent PNGs',
    updatedAt: new Date().toISOString(),
  },
  'image-agent': {
    id: 'image-agent',
    name: 'AI Image Agent',
    category: 'utility',
    route: '/image-agent',
    status: 'ACTIVE',
    description: 'Creative Director & AI Prompt Enhancement Assistant',
    updatedAt: new Date().toISOString(),
  },
  'boutiqaat-layers': {
    id: 'boutiqaat-layers',
    name: 'Boutiqaat Layers Studio',
    category: 'studio',
    route: '/layers',
    status: 'COMING_SOON',
    description: 'AI Photo Decomposition, Canvas Workspace & PSD Export',
    updatedAt: new Date().toISOString(),
  },
  'bundling-studio': {
    id: 'bundling-studio',
    name: 'Bundling Studio',
    category: 'studio',
    route: '/bundling',
    status: 'COMING_SOON',
    description: 'Multi-SKU Commercial Packshot & Promo Bundle Generator',
    updatedAt: new Date().toISOString(),
  },
  'boutiqaat-video-gen': {
    id: 'boutiqaat-video-gen',
    name: 'Boutiqaat Video Gen Hub',
    category: 'generation',
    route: '/video',
    status: 'COMING_SOON',
    description: 'Text/Image-to-Video Generation with Seedance, Veo & Kling',
    updatedAt: new Date().toISOString(),
  },
};

const APP_CONTROLS_FILE = 'app_controls.json';
const DB_TASK_ID = 'system_config_app_controls';

/**
 * Fetch all App Control settings (from Supabase tasks table with local-store fallback)
 */
export async function getAppControls(): Promise<Record<string, AppControlItem>> {
  let controls = readJsonStore<Record<string, AppControlItem>>(APP_CONTROLS_FILE, { ...DEFAULT_APP_CONTROLS });

  try {
    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select('id, node_info_list, updated_at')
      .eq('app_id', 'boutiqaat-app-controls')
      .eq('id', DB_TASK_ID)
      .maybeSingle();

    if (!error && data && data.node_info_list && Array.isArray(data.node_info_list) && data.node_info_list.length > 0) {
      const stored = data.node_info_list[0]?.config as Record<string, AppControlItem> | undefined;
      if (stored && typeof stored === 'object') {
        controls = { ...DEFAULT_APP_CONTROLS, ...stored };
        writeJsonStore(APP_CONTROLS_FILE, controls);
      }
    } else {
      // First-time seed into Supabase
      await supabaseAdmin.from('tasks').upsert({
        id: DB_TASK_ID,
        runninghub_task_id: DB_TASK_ID,
        app_id: 'boutiqaat-app-controls',
        app_name: 'Boutiqaat System App Controls',
        status: 'SUCCESS',
        node_info_list: [{ config: controls }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[getAppControls database sync warning, using local store]', err);
  }

  return controls;
}

/**
 * Update the status of a specific app in real-time
 */
export async function updateAppControl(
  appKey: string,
  newStatus: AppStatus,
  adminEmail?: string
): Promise<AppControlItem | null> {
  const all = await getAppControls();
  if (!all[appKey]) return null;

  const updatedItem: AppControlItem = {
    ...all[appKey],
    status: newStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail || 'admin',
  };

  all[appKey] = updatedItem;

  // 1. Write local store
  writeJsonStore(APP_CONTROLS_FILE, all);

  // 2. Persist to Supabase
  try {
    await supabaseAdmin.from('tasks').upsert({
      id: DB_TASK_ID,
      runninghub_task_id: DB_TASK_ID,
      app_id: 'boutiqaat-app-controls',
      app_name: 'Boutiqaat System App Controls',
      status: 'SUCCESS',
      node_info_list: [{ config: all }],
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[updateAppControl Supabase write warning]', err);
  }

  return updatedItem;
}
