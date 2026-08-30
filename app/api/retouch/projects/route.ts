import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getUserRetouchProjects, createRetouchProject } from '@/lib/retouch/projects';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await getUserRetouchProjects(session.userId);
    return NextResponse.json({ projects });
  } catch (err: any) {
    console.error('[retouch/projects GET]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, defaultModel } = body;

    const project = await createRetouchProject({
      userId: session.userId,
      name: name || 'Untitled Retouch Project',
      description,
      defaultModel: defaultModel || 'flux-2-edit',
    });

    return NextResponse.json({ project });
  } catch (err: any) {
    console.error('[retouch/projects POST]', err);
    return NextResponse.json({ error: err.message || 'Failed to create project' }, { status: 500 });
  }
}
