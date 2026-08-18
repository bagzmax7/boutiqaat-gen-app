import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { queryTaskOutputs } from '@/lib/runninghub';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min timeout

/**
 * POST /api/admin/tasks/sync
 * Syncs billing data from RunningHub for all SUCCESS tasks missing usage data.
 * - No date limit — scans entire history
 * - Fetches consumeMoney, consumeCoins, taskCostTime from /task/openapi/outputs
 * - Also tries to fill in app_name if missing via webhook metadata
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const days = body.days ? parseInt(body.days) : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Fetch ALL SUCCESS tasks that are missing billing data (both enterprise and consumer)
    const { data: tasks, error } = await supabaseAdmin
      .from('tasks')
      .select('id, runninghub_task_id, api_key_type, node_info_list, app_name, status')
      .eq('status', 'SUCCESS')
      .gte('created_at', cutoff.toISOString())
      .not('runninghub_task_id', 'is', null)
      .neq('runninghub_task_id', '');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter tasks that are missing billing data
    const tasksToSync = (tasks || []).filter((t: any) => {
      // Must have numeric RunningHub task ID
      if (!/^\d{15,}$/.test(t.runninghub_task_id || '')) return false;

      const nodeInfo = t.node_info_list || [];
      const hasUsage = nodeInfo.some((n: any) => n.nodeId === 'USAGE');
      if (hasUsage) {
        // Also check if the existing usage has actual data
        const usageNode = nodeInfo.find((n: any) => n.nodeId === 'USAGE' && n.fieldName === 'usage');
        if (usageNode?.fieldValue) {
          try {
            const usage = JSON.parse(usageNode.fieldValue);
            // Re-sync if all billing values are null/0
            if (!usage.consumeCoins && !usage.consumeMoney && !usage.thirdPartyConsumeMoney && !usage.taskCostTime) return true;
            return false;
          } catch { return true; }
        }
        return true; // Has USAGE node but can't parse — re-sync
      }
      return true; // No USAGE node at all — needs sync
    });

    console.log(`[Sync Bills] Found ${tasksToSync.length} tasks needing billing sync out of ${tasks?.length || 0} total SUCCESS tasks.`);

    let syncedCount = 0;
    let failedCount = 0;

    for (const t of tasksToSync) {
      if (!t.runninghub_task_id) continue;
      
      try {
        const keyType = (t.api_key_type as 'enterprise' | 'consumer') || 'enterprise';
        // Use the outputs endpoint which returns billing info
        const outputsResult = await queryTaskOutputs(t.runninghub_task_id, keyType);

        if (outputsResult?.code === 0 && Array.isArray(outputsResult.data) && outputsResult.data.length > 0) {
          const firstOutput = outputsResult.data[0];
          
          const usageData = {
            consumeMoney: firstOutput.consumeMoney !== undefined && firstOutput.consumeMoney !== null 
              ? String(firstOutput.consumeMoney) : null,
            consumeCoins: firstOutput.consumeCoins !== undefined && firstOutput.consumeCoins !== null 
              ? String(firstOutput.consumeCoins) : null,
            taskCostTime: firstOutput.taskCostTime !== undefined && firstOutput.taskCostTime !== null 
              ? String(firstOutput.taskCostTime) : '0',
            thirdPartyConsumeMoney: firstOutput.thirdPartyConsumeMoney !== undefined && firstOutput.thirdPartyConsumeMoney !== null 
              ? String(firstOutput.thirdPartyConsumeMoney) : null,
            // Store the raw task name from RunningHub if available
            taskName: firstOutput.taskName || null,
          };

          // Update node_info_list with USAGE data
          const nodeInfo = (t.node_info_list || []).filter((n: any) => n.nodeId !== 'USAGE');
          nodeInfo.push({
            nodeId: 'USAGE',
            fieldName: 'usage',
            fieldValue: JSON.stringify(usageData),
          });

          // Build update object
          const updateObj: any = { node_info_list: nodeInfo };

          // If app_name is missing or generic, try to use RunningHub task name
          if ((!t.app_name || t.app_name === 'Generation' || t.app_name === 'Untitled') 
              && usageData.taskName) {
            updateObj.app_name = usageData.taskName;
          }

          await supabaseAdmin
            .from('tasks')
            .update(updateObj)
            .eq('id', t.id);

          syncedCount++;
        } else {
          // API returned no data — mark as attempted with empty usage
          console.warn(`[Sync Bills] No outputs data for task ${t.runninghub_task_id}. Response: ${JSON.stringify(outputsResult)}`);
          failedCount++;
        }
      } catch (err) {
        console.error(`[Sync Bills] Failed to sync task ${t.runninghub_task_id}:`, err);
        failedCount++;
      }

      // Rate limit: avoid hammering RunningHub API
      await new Promise(r => setTimeout(r, 150));
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      failedCount,
      totalTargeted: tasksToSync.length,
      totalScanned: tasks?.length || 0,
      dayRange: days,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
