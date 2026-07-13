import { NextResponse, NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { runApp } from '@/lib/runninghub';

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const localTaskId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const body = await request.json();
    const { imageUrl, webhookUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    // Register initial running task in DB
    const initialNodeInfoList = [
      { nodeId: '7', fieldName: 'image', fieldValue: imageUrl }
    ];

    await supabaseAdmin.from('tasks').insert({
      id: localTaskId,
      app_id: '2076728877666717698', // The Remove Background App ID
      app_name: 'Remove Background',
      api_key_type: 'enterprise',
      status: 'RUNNING',
      node_info_list: initialNodeInfoList,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: session.userId
    });

    console.log(`[Remove Background] Calling RunningHub AI App API...`);
    
    // Call the standard RunningHub App execution endpoint
    const result = await runApp({
      appId: '2076728877666717698',
      nodeInfoList: initialNodeInfoList,
      apiKeyType: 'enterprise',
      webhookUrl: webhookUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/runninghub?secret=${process.env.WEBHOOK_SECRET}`
    });

    if (!result.taskId) {
      const apiError = result.errorMessage || (result as any).error || 'Unknown error';
      throw new Error(`RunningHub API Error: ${apiError}`);
    }

    const taskId = result.taskId;
    
    // Update runninghub_task_id in Supabase
    await supabaseAdmin.from('tasks').update({
      runninghub_task_id: taskId
    }).eq('id', localTaskId);

    console.log(`[Remove Background] Task submitted: ${taskId}. Waiting for webhook...`);

    // Return the local taskId so the client can poll Supabase
    return NextResponse.json({ 
      success: true,
      taskId: localTaskId,
      runningHubTaskId: taskId
    });

  } catch (error: any) {
    console.error('[Remove Background API Error]', error);
    // Update task status to FAILED
    await supabaseAdmin.from('tasks').update({
      status: 'FAILED',
      error_message: error.message || 'Unknown error',
      updated_at: new Date().toISOString()
    }).eq('id', localTaskId);

    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
