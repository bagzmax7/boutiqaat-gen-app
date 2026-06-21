import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// One-time setup endpoint — creates initial admin + dev-editor accounts
// Call: POST /api/admin/setup (only works if no users exist yet)
export async function POST(req: NextRequest) {
  // Basic secret check to avoid accidental calls
  const { secret } = await req.json().catch(() => ({ secret: '' }));
  if (secret !== (process.env.AUTH_SECRET || 'boutiqaat_gen_app_fallback_secret')) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
  }

  try {
    const bcrypt = await import('bcryptjs');

    // Check if users already exist
    const { count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) {
      return NextResponse.json({ message: 'Users already seeded', count });
    }

    const adminHash = await bcrypt.hash('Admin@Studio2026!', 12);
    const editorHash = await bcrypt.hash('Editor@Studio2026!', 12);

    const { error } = await supabaseAdmin.from('users').insert([
      {
        email: 'admin@boutiqaat.com',
        name: 'Studio Admin',
        password_hash: adminHash,
        role: 'admin',
      },
      {
        email: 'dev-editor@boutiqaat.com',
        name: 'Dev Editor',
        password_hash: editorHash,
        role: 'editor',
      },
    ]);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Initial accounts created!',
      accounts: [
        { email: 'admin@boutiqaat.com', password: 'Admin@Studio2026!', role: 'admin' },
        { email: 'dev-editor@boutiqaat.com', password: 'Editor@Studio2026!', role: 'editor' },
      ],
    });
  } catch (error) {
    console.error('[setup]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
