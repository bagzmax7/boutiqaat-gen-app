import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  getFlowProjects,
  createFlowProject,
  updateFlowProject,
  deleteFlowProject
} from '@/lib/flow-projects';

export const dynamic = 'force-dynamic';

// GET /api/boutiqaat-flow/projects — list projects for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await getFlowProjects(session.userId);
    return NextResponse.json({ projects });
  } catch (err: any) {
    console.error('[GET /api/boutiqaat-flow/projects Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/boutiqaat-flow/projects — create a new project
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description } = await req.json();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const newProject = await createFlowProject(session.userId, name.trim(), description);
    return NextResponse.json({ success: true, project: newProject }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/boutiqaat-flow/projects Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to create project' }, { status: 500 });
  }
}

// PATCH /api/boutiqaat-flow/projects — rename or update project details
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, description } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const updated = await updateFlowProject(id, session.userId, {
      ...(name ? { name: name.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, project: updated });
  } catch (err: any) {
    console.error('[PATCH /api/boutiqaat-flow/projects Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/boutiqaat-flow/projects — delete a project
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

    await deleteFlowProject(id, session.userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/boutiqaat-flow/projects Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete project' }, { status: 500 });
  }
}
