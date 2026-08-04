import { NextResponse } from 'next/server';
import { generateVideoStandard } from '@/lib/runninghub';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { model, prompt, imageUrls, videoUrls, audioUrls, ratio, aspect_ratio, quality, resolution, duration, realPerson, audio, generateAudio, realPersonMode, apiKeyType } = payload;

    if (!model || !prompt) {
      return NextResponse.json({ error: 'Model and prompt are required' }, { status: 400 });
    }

    const resVal = resolution || quality || '720p';
    const rawRatio = ratio || aspect_ratio;
    const ratioVal = (rawRatio && rawRatio !== 'Auto') ? rawRatio : undefined;

    // Parse duration string like "10s" into integer number 10 as required by API
    let durationNum: number | undefined = undefined;
    if (duration !== undefined && duration !== null) {
      const parsed = parseInt(String(duration).replace(/[^0-9-]/g, ''), 10);
      if (!isNaN(parsed)) {
        durationNum = parsed;
      }
    }

    const result = await generateVideoStandard(
      {
        model,
        prompt,
        imageUrls,
        videoUrls,
        audioUrls,
        ratio: ratioVal,
        aspect_ratio: ratioVal,
        quality: resVal,
        resolution: resVal,
        duration: durationNum as any,
        generateAudio: audio !== undefined ? audio : generateAudio,
        realPersonMode: realPerson !== undefined ? realPerson : realPersonMode,
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
