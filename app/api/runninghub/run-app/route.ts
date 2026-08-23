import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { runApp, runWorkflow } from '@/lib/runninghub';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { 
      appId, 
      nodeInfoList, 
      instanceType, 
      usePersonalQueue, 
      retainSeconds, 
      webhookUrl, 
      apiKeyType: bodyApiKeyType,
      isWorkflow,
      addMetadata
    } = body;

    if (!appId) {
      return NextResponse.json({ error: 'appId is required' }, { status: 400 });
    }

    const isBackgroundRemoval =
      appId === process.env.PINNED_APP_ID ||
      appId === '2053333317835083777' ||
      appId === '2063548168545071105';
    const apiKeyType = bodyApiKeyType || (isBackgroundRemoval ? 'consumer' : 'enterprise');

    const result = isWorkflow 
      ? await runWorkflow({
          appId,
          nodeInfoList,
          instanceType,
          usePersonalQueue,
          retainSeconds,
          webhookUrl,
          apiKeyType,
          addMetadata: addMetadata !== undefined ? addMetadata : true,
        })
      : await runApp({
          appId,
          nodeInfoList,
          instanceType,
          usePersonalQueue,
          retainSeconds,
          webhookUrl,
          apiKeyType,
        });

    if (result && result.taskId) {
      try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        await supabaseAdmin.from('tasks').insert({
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          runninghub_task_id: result.taskId,
          user_id: session.userId,
          app_id: appId,
          app_name: `App ${appId}`,
          status: 'RUNNING',
          api_key_type: apiKeyType,
          node_info_list: nodeInfoList || [],
          outputs: [],
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[run-app] Task insert warning:', err);
      }
    }

    return NextResponse.json({ ...result, apiKeyType });
  } catch (error) {
    console.error('[run-app] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start task', detail: String(error) },
      { status: 500 }
    );
  }
}
