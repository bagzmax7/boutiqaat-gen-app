import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

// Note: RunningHub OpenAPI v2 does not expose a cancel endpoint.
// We return success here so the frontend can mark the task as canceled locally.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { taskId } = await req.json();
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    // RunningHub v2 API has no cancel endpoint — mark as canceled locally
    return NextResponse.json({ success: true, taskId, message: 'Marked as canceled locally' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to cancel task', detail: String(error) },
      { status: 500 }
    );
  }
}
