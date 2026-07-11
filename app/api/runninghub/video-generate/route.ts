import { NextResponse } from 'next/server';
import { generateVideoStandard } from '@/lib/runninghub';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { model, prompt, imageUrls, videoUrls, ratio, quality, duration, realPerson, audio, apiKeyType } = payload;

    if (!model || !prompt) {
      return NextResponse.json({ error: 'Model and prompt are required' }, { status: 400 });
    }

    const result = await generateVideoStandard(
      {
        model,
        prompt,
        imageUrls,
        videoUrls,
        ratio,
        quality,
        duration,
        realPerson,
        audio,
      },
      apiKeyType || 'enterprise'
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Video Generate Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate video' }, { status: 500 });
  }
}
