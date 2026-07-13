import { NextResponse, NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.ai';
const ENTERPRISE_KEY = process.env.RUNNINGHUB_API_KEY_ENTERPRISE || process.env.RUNNINGHUB_API_KEY_CONSUMER || process.env.RUNNINGHUB_API_KEY || '';

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
      app_id: 'remove-background-workflow',
      app_name: 'Remove Background',
      api_key_type: 'enterprise',
      status: 'RUNNING',
      node_info_list: initialNodeInfoList,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: session.userId
    });

    // 1. Read the workflow JSON template
    const workflowPath = path.join(process.cwd(), 'lib', 'workflows', 'remove-background.json');
    const workflowStr = fs.readFileSync(workflowPath, 'utf8');
    const workflowJson = JSON.parse(workflowStr);

    // 2. Inject the imageUrl into the LoadImage node (Node 7 in the provided JSON)
    if (workflowJson['7'] && workflowJson['7'].class_type === 'LoadImage') {
      workflowJson['7'].inputs.image = imageUrl;
    } else {
      throw new Error('Invalid workflow JSON: Node 7 is not LoadImage');
    }

    // 3. Prepare the request for RunningHub Enterprise Task API
    const rhBody = {
      apiKey: ENTERPRISE_KEY,
      promptTips: JSON.stringify(workflowJson),
      webhookUrl: webhookUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/runninghub?secret=${process.env.WEBHOOK_SECRET}`
    };

    console.log(`[Remove Background] Calling RunningHub raw workflow API directly...`);
    const res = await fetch(`${BASE_URL}/task/openapi/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rhBody)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`RunningHub API Error ${res.status}: ${errText}`);
    }

    const result = await res.json();
    console.log(`[Remove Background] raw response:`, JSON.stringify(result, null, 2));

    if (result.code !== 0 || !result.data?.taskId) {
      const apiError = result.msg || result.errorMessage || 'Unknown error';
      throw new Error(`RunningHub API Error: ${apiError}`);
    }

    const taskId = result.data.taskId;
    
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
