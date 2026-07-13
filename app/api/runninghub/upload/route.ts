import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { uploadResource } from '@/lib/runninghub';

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

    const result = await uploadResource(buffer, file.name, file.type);

    // Normalize response: return fileUrl for easy use in components
    if (result.code === 0 && result.data?.download_url) {
      return NextResponse.json({
        success: true,
        fileUrl: result.data.download_url,
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
