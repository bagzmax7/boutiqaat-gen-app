import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { queryTask } from '@/lib/runninghub';

// Unified query endpoint — returns both status AND results
// POST /api/runninghub/query  body: { taskId }
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { taskId, apiKeyType } = await req.json();
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const result = await queryTask(taskId, apiKeyType);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[query] Error:', error);
    return NextResponse.json(
      { error: 'Failed to query task', detail: String(error) },
      { status: 500 }
    );
  }
}
