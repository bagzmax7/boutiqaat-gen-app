/**
 * POST /api/bundling/upload
 * Receives multipart/form-data with up to 5 product images.
 * Uploads each to Supabase Storage bucket 'product-images'.
 * Returns array of public URLs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { validateAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // Auth check
  const auth = await validateAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    if (files.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 images allowed' }, { status: 400 });
    }

    const urls: string[] = [];

    for (const file of files) {
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only JPG, PNG, WebP allowed.` },
          { status: 400 }
        );
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 10MB limit` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const fileName = `${auth.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('product-images')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return NextResponse.json(
          { error: `Failed to upload ${file.name}: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('product-images')
        .getPublicUrl(fileName);

      urls.push(urlData.publicUrl);
    }

    return NextResponse.json({ urls });
  } catch (err) {
    console.error('Upload route error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
