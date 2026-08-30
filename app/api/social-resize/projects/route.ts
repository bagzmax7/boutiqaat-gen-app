import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getSocialResizeProjects,
  createSocialResizeProject,
  saveSocialResizeProject,
  deleteSocialResizeProject
} from '@/lib/social-resize/projects';

export const dynamic = 'force-dynamic';

// GET /api/social-resize/projects — list projects for user
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await getSocialResizeProjects(session.userId);
    return NextResponse.json({ projects });
  } catch (err: any) {
    console.error('[GET /api/social-resize/projects Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/social-resize/projects — create or auto-save project
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, ...rest } = body;

    if (id) {
      // Save / update existing project
      const saved = await saveSocialResizeProject(id, session.userId, { name, ...rest });
      return NextResponse.json({ success: true, project: saved });
    } else {
      // Create new project
      const newProject = await createSocialResizeProject(session.userId, name || 'New Campaign', rest);
      return NextResponse.json({ success: true, project: newProject }, { status: 201 });
    }
  } catch (err: any) {
    console.error('[POST /api/social-resize/projects Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to save project' }, { status: 500 });
  }
}

// DELETE /api/social-resize/projects — delete project
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    await deleteSocialResizeProject(id, session.userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/social-resize/projects Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete project' }, { status: 500 });
  }
}
