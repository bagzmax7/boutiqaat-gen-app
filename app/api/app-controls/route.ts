import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getAppControls, updateAppControl, AppStatus } from '@/lib/app-controls';

export const dynamic = 'force-dynamic';

/**
 * GET /api/app-controls
 * Returns live status of all apps.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const controls = await getAppControls();

    const isAdmin = session?.role === 'admin';

    // Map whether each app is accessible for current caller
    const resolvedControls = Object.entries(controls).map(([key, item]) => {
      const isLockedForUser = !isAdmin && item.status !== 'ACTIVE';
      return {
        ...item,
        isLockedForUser,
        accessible: !isLockedForUser,
      };
    });

    return NextResponse.json({
      success: true,
      isAdmin,
      controls,
      list: resolvedControls,
    });
  } catch (error: any) {
    console.error('[GET /api/app-controls]', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch app controls' }, { status: 500 });
  }
}

/**
 * POST /api/app-controls
 * Super Admin only: Update app status in real-time.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Super Admin access required to update app controls' }, { status: 403 });
    }

    const { appKey, status } = await req.json();

    const validStatuses: AppStatus[] = ['ACTIVE', 'COMING_SOON', 'UNDER_MAINTENANCE', 'UPDATE_PROCESS'];
    if (!appKey || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid appKey or status' }, { status: 400 });
    }

    const updated = await updateAppControl(appKey, status, session.email);
    if (!updated) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      app: updated,
      message: `App status updated to ${status} successfully`,
    });
  } catch (error: any) {
    console.error('[POST /api/app-controls]', error);
    return NextResponse.json({ error: error?.message || 'Failed to update app control' }, { status: 500 });
  }
}
