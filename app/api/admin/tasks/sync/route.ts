import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { queryTask } from '@/lib/runninghub';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Sync billing info for tasks created in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: tasks, error } = await supabaseAdmin
      .from('tasks')
      .select('id, runninghub_task_id, api_key_type, node_info_list')
      .eq('status', 'SUCCESS')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('runninghub_task_id', 'is', null)
      .neq('runninghub_task_id', '');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let syncedCount = 0;
    // Filter tasks that do NOT have a USAGE field in their node_info_list
    const tasksToSync = (tasks || []).filter(t => {
      const nodeInfo = t.node_info_list || [];
      const hasUsage = nodeInfo.some((n: any) => n.nodeId === 'USAGE');
      return !hasUsage;
    });

    console.log(`[Sync Bills] Found ${tasksToSync.length} SUCCESS tasks in last 30 days missing billing data. Syncing...`);

    for (const t of tasksToSync) {
      if (!t.runninghub_task_id) continue;
      try {
        const res = await queryTask(t.runninghub_task_id, t.api_key_type || undefined);
        if (res.usage) {
          const nodeInfo = t.node_info_list || [];
          const filtered = nodeInfo.filter((n: any) => n.nodeId !== 'USAGE');
          filtered.push({
            nodeId: 'USAGE',
            fieldName: 'usage',
            fieldValue: JSON.stringify(res.usage)
          });
          
          await supabaseAdmin
            .from('tasks')
            .update({ node_info_list: filtered })
            .eq('id', t.id);

          syncedCount++;
        }
      } catch (err) {
        console.error(`[Sync Bills] Failed to sync task ${t.runninghub_task_id}:`, err);
      }
    }

    return NextResponse.json({ success: true, syncedCount, totalTargeted: tasksToSync.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
