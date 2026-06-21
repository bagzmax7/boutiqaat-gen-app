import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { queryTask } from '@/lib/runninghub';

// Legacy GET endpoint — forwards to POST /openapi/v2/query
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get('taskId');
  const apiKeyType = req.nextUrl.searchParams.get('apiKeyType') as 'enterprise' | 'consumer' | null;
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  try {
    const result = await queryTask(taskId, apiKeyType || undefined);
    // Map to legacy format expected by older components
    return NextResponse.json({
      status: result.status,
      taskId: result.taskId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
  } catch (error) {
    console.error('[task-status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get task status', detail: String(error) },
      { status: 500 }
    );
  }
}
