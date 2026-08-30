import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureUserWorkspace } from '@/lib/workspace-provisioner';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, avatar_url, created_at')
      .eq('id', session.userId)
      .single();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Asynchronously guarantee workspace initialization and orphan task recovery
    ensureUserWorkspace(user.id, user.email, user.name).catch(() => {});

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[me]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

