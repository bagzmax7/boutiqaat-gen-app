import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getRetouchProjectById, saveRetouchProject, deleteRetouchProject } from '@/lib/retouch/projects';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await getRetouchProjectById(params.id, session.userId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (err: any) {
    console.error('[retouch/projects/[id] GET]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await getRetouchProjectById(params.id, session.userId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, description, defaultModel, items } = body;

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (defaultModel !== undefined) project.defaultModel = defaultModel;
    if (items !== undefined) project.items = items;

    await saveRetouchProject(project);

    return NextResponse.json({ success: true, project });
  } catch (err: any) {
    console.error('[retouch/projects/[id] PUT]', err);
    return NextResponse.json({ error: err.message || 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteRetouchProject(params.id, session.userId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[retouch/projects/[id] DELETE]', err);
    return NextResponse.json({ error: err.message || 'Failed to delete project' }, { status: 500 });
  }
}
