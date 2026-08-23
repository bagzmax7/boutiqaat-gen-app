import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/admin/setup'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and all API routes (API routes handle their own JSON 401 responses)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p)) || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow Next.js internals and static files
  if (pathname.startsWith('/_next') || pathname.includes('.')) return NextResponse.next();

  const session = await getSessionFromRequest(req);

  // Not logged in → redirect to login page
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Super Admin routes (/admin) → only Super Admin allowed (Managers redirected to /manager, Editors to /)
  if (pathname.startsWith('/admin')) {
    if (session.role === 'manager') return NextResponse.redirect(new URL('/manager', req.url));
    if (session.role !== 'admin') return NextResponse.redirect(new URL('/', req.url));
  }

  // Manager Portal routes (/manager) → only Managers and Super Admin allowed
  if (pathname.startsWith('/manager') && session.role !== 'admin' && session.role !== 'manager') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
