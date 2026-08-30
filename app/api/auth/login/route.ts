import { NextRequest, NextResponse } from 'next/server';
import { loginWithEmail, signToken, COOKIE_NAME } from '@/lib/auth';
import { ensureUserWorkspace } from '@/lib/workspace-provisioner';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const session = await loginWithEmail(email, password);
    if (!session) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Auto-provision user workspace and re-map tasks on login
    ensureUserWorkspace(session.userId, session.email, session.name).catch(() => {});

    const token = await signToken(session);

    const response = NextResponse.json({
      success: true,
      user: { email: session.email, name: session.name, role: session.role },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('[login]', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

