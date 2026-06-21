/**
 * GET/POST /api/bundling/sessions
 * GET: Fetch user's bundling session history
 * POST: Save a new bundling session
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET — fetch user sessions
export async function GET(req: NextRequest) {
  const auth = await validateAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { data, error, count } = await supabaseAdmin
      .from('bundling_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Sessions fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    return NextResponse.json({ sessions: data, total: count });
  } catch (err) {
    console.error('GET sessions error:', err);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// POST — save a new session
export async function POST(req: NextRequest) {
  const auth = await validateAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      session_name,
      product_images,
      product_names,
      dimensions_analysis,
      final_prompt,
      generated_image_url,
    } = body;

    if (!session_name || !product_images || !dimensions_analysis || !final_prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('bundling_sessions')
      .insert({
        user_id: auth.userId,
        session_name,
        product_images,
        product_names: product_names || [],
        dimensions_analysis,
        final_prompt,
        generated_image_url: generated_image_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Session insert error:', error);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (err) {
    console.error('POST session error:', err);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}
