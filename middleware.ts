import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/admin/setup'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Allow Next.js internals and static files
  if (pathname.startsWith('/_next') || pathname.includes('.')) return NextResponse.next();

  const session = await getSessionFromRequest(req);

  // Not logged in → redirect to login
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes → non-management roles (e.g. editors) get blocked
  if (pathname.startsWith('/admin') && session.role !== 'admin' && session.role !== 'manager') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
