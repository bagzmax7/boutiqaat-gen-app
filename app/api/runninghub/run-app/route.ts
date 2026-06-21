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

    return NextResponse.json({ ...result, apiKeyType });
  } catch (error) {
    console.error('[run-app] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start task', detail: String(error) },
      { status: 500 }
    );
  }
}
