import { supabaseAdmin } from './supabase';
import { FlowProject, getFlowProjects, createFlowProject } from './flow-projects';

/**
 * Universal Workspace Provisioner & Multi-Tenant Mapping Engine.
 * 
 * Ensures that every user (newly created or legacy existing user)
 * has a fully initialized, persistent, and properly isolated workspace:
 * 1. Default Boutiqaat Flow project ("Main Studio Flow" -> flow_proj_default_{userId})
 * 2. Unassigned task auto-migration & recovery
 * 3. Seeded with valid runninghub_task_id to guarantee database constraint satisfaction
 */

const provisionedCache = new Set<string>();

export async function ensureUserWorkspace(userId: string, email?: string, name?: string): Promise<{
  success: boolean;
  defaultFlowProjectId: string;
}> {
  if (!userId) {
    return { success: false, defaultFlowProjectId: '' };
  }

  const defaultFlowProjectId = `flow_proj_default_${userId}`;

  // If already provisioned in current process life-cycle, skip DB queries
  if (provisionedCache.has(userId)) {
    return { success: true, defaultFlowProjectId };
  }

  try {
    // 1. Ensure user's default project exists in Supabase tasks table
    const { data: existingFlowProject } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('id', defaultFlowProjectId)
      .maybeSingle();

    if (!existingFlowProject) {
      await supabaseAdmin.from('tasks').upsert({
        id: defaultFlowProjectId,
        runninghub_task_id: defaultFlowProjectId,
        user_id: userId,
        app_id: 'boutiqaat-flow-project',
        app_name: 'Main Studio Flow',
        status: 'SUCCESS',
        outputs: [],
        node_info_list: [
          {
            nodeId: 'PROJECT',
            fieldName: 'project_meta',
            fieldValue: JSON.stringify({
              name: 'Main Studio Flow',
              description: 'Default campaign workspace',
              isDefault: true,
            }),
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // 2. Scan and re-link any orphan/unassigned tasks created by this user
    const { data: orphanTasks } = await supabaseAdmin
      .from('tasks')
      .select('id, node_info_list')
      .eq('user_id', userId)
      .or('app_id.like.quick-create%,app_id.like.boutiqaat-flow%')
      .neq('app_id', 'boutiqaat-flow-project');

    if (orphanTasks && orphanTasks.length > 0) {
      for (const t of orphanTasks) {
        const nodes = t.node_info_list || [];
        const pNode = nodes.find((n: any) => n.fieldName === 'project_id');
        if (!pNode || !pNode.fieldValue || pNode.fieldValue === 'NONE') {
          const updatedNodes = [
            ...nodes.filter((n: any) => n.fieldName !== 'project_id'),
            { nodeId: 'project', fieldName: 'project_id', fieldValue: defaultFlowProjectId }
          ];

          await supabaseAdmin
            .from('tasks')
            .update({ node_info_list: updatedNodes, updated_at: new Date().toISOString() })
            .eq('id', t.id);
        }
      }
    }

    provisionedCache.add(userId);
    return { success: true, defaultFlowProjectId };
  } catch (err) {
    console.warn('[ensureUserWorkspace warning]', err);
    return { success: false, defaultFlowProjectId };
  }
}
