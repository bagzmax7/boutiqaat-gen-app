import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from './supabase';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'boutiqaat_gen_app_fallback_secret'
);
const COOKIE_NAME = 'bqa_session';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: 'editor' | 'admin' | 'manager';
  departmentId?: string | null;
  iat?: number;
  exp?: number;
}

export function isManagementRole(role?: string): boolean {
  return role === 'admin' || role === 'manager';
}

export function hasAdminOrManagerAccess(session: SessionPayload | null): boolean {
  if (!session) return false;
  return isManagementRole(session.role);
}

export async function signToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  return new SignJWT(cleanPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<SessionPayload | null> {
  try {
    const cleanEmail = email.toLowerCase().trim();

    // Query user record safely
    let user: any = null;
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, password_hash')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (!error && data) {
      user = data;
    }

    if (!user || !user.password_hash) return null;

    let valid = false;
    if (user.password_hash.startsWith('$2')) {
      valid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Plain text fallback
      valid = (password === user.password_hash);
      if (valid) {
        // Auto-upgrade plain password to secure bcrypt hash
        const hashed = await bcrypt.hash(password, 12);
        supabaseAdmin.from('users').update({ password_hash: hashed }).eq('id', user.id).then(() => {}, () => {});
      }
    }

    if (!valid) return null;

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: (user.role || 'editor') as 'editor' | 'admin' | 'manager',
      departmentId: user.department_id || null,
    };
  } catch (err) {
    console.error('[loginWithEmail error]', err);
    return null;
  }
}

export { COOKIE_NAME };

/** Convenience alias used by bundling API routes */
export const validateAuth = getSessionFromRequest;

