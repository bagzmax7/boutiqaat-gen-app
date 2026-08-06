import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { uploadResource } from '@/lib/runninghub';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 60; // 60 seconds to allow for 4K image uploads

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload to Supabase Storage for permanent hosting
    let permanentUrl = '';
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `${session.userId || 'anonymous'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from('product-images')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (!uploadError) {
        const { data: urlData } = supabaseAdmin.storage
          .from('product-images')
          .getPublicUrl(fileName);
        permanentUrl = urlData.publicUrl;
      } else {
        console.error('[Supabase Storage Upload Error]:', uploadError);
      }
    } catch (storageErr) {
      console.error('[Supabase Storage Exception]:', storageErr);
    }

    // 2. Upload to RunningHub
    const result = await uploadResource(buffer, file.name, file.type);

    // Normalize response: return fileUrl for easy use in components
    if (result.code === 0 && result.data?.download_url) {
      return NextResponse.json({
        success: true,
        fileUrl: permanentUrl || result.data.download_url,
        fileName: result.data.fileName,
        raw: result,
      });
    }

    return NextResponse.json({
      success: false,
      error: result.message || 'Upload failed',
      raw: result,
    }, { status: 400 });

  } catch (error) {
    console.error('[upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', detail: String(error) },
      { status: 500 }
    );
  }
}
