import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { queryTask } from '@/lib/runninghub';

// Legacy GET endpoint — forwards to POST /openapi/v2/query and returns results
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
    // Map results to TaskOutput format used in components
    const outputs = (result.results || []).map(r => ({
      fileUrl: r.url,
      fileType: r.outputType,
      nodeId: r.nodeId,
      text: r.text,
    }));
    return NextResponse.json({ data: outputs, status: result.status });
  } catch (error) {
    console.error('[task-output] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get task output', detail: String(error) },
      { status: 500 }
    );
  }
}
