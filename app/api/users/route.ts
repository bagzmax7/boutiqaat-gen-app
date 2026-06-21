import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/users — admin: list all users
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, email, name, role, avatar_url, created_at')
    .order('created_at', { ascending: false });

  return NextResponse.json({ users: users || [] });
}

// POST /api/users — admin: create a new editor account
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { email, name, password, role = 'editor' } = await req.json();
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'email, name, and password are required' }, { status: 400 });
    }

    const bcrypt = await import('bcryptjs');
    const password_hash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({ email: email.toLowerCase().trim(), name, password_hash, role })
      .select('id, email, name, role, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
      throw error;
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('[users POST]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
