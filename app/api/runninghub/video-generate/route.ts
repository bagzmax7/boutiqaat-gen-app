import { NextResponse } from 'next/server';
import { generateVideoStandard } from '@/lib/runninghub';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const {
      model,
      prompt,
      imageUrls = [],
      videoUrls = [],
      audioUrls = [],
      ratio,
      aspect_ratio,
      quality,
      resolution,
      duration,
      realPerson,
      audio,
      generateAudio,
      realPersonMode,
      apiKeyType
    } = payload;

    if (!model || !prompt) {
      return NextResponse.json({ error: 'Model and prompt are required' }, { status: 400 });
    }

    const cleanRatio = (ratio || aspect_ratio) === 'Auto' ? '16:9' : (ratio || aspect_ratio || '16:9');
    const cleanQuality = resolution || quality || '720p';
    
    // Parse duration to a clean integer number
    let durationNum = 5;
    if (duration !== undefined && duration !== null) {
      const parsed = parseInt(String(duration).replace(/[^0-9-]/g, ''), 10);
      if (!isNaN(parsed)) {
        durationNum = parsed;
      }
    }

    let targetPath = model.replace(/^\/+/, '');
    let mappedPayload: Record<string, any> = { prompt };

    const useAudio = audio !== undefined ? audio : (generateAudio !== undefined ? generateAudio : true);
    const useRealPerson = realPerson !== undefined ? realPerson : (realPersonMode !== undefined ? realPersonMode : false);

    const hasImages = imageUrls.length > 0;
    const hasVideos = videoUrls.length > 0;
    const hasAudio = audioUrls.length > 0;
    const isMultimodal = (imageUrls.length > 1 && model !== 'veo-3.1-fast') || hasVideos || hasAudio;

    // ── Model-specific endpoint path routing ──
    if (model === 'seedance-2.0-mini') {
      if (isMultimodal) {
        targetPath = 'rhart-video/sparkvideo-2.0-mini/multimodal-video';
      } else if (hasImages) {
        targetPath = 'rhart-video/sparkvideo-2.0-mini/image-to-video';
      } else {
        targetPath = 'rhart-video/sparkvideo-2.0-mini/text-to-video';
      }
    } else if (model === 'seedance-2.0-official') {
      if (isMultimodal) {
        targetPath = 'rhart-video/sparkvideo-2.0/multimodal-video';
      } else if (hasImages) {
        targetPath = 'rhart-video/sparkvideo-2.0/image-to-video';
      } else {
        targetPath = 'rhart-video/sparkvideo-2.0/text-to-video';
      }
    } else if (model === 'gemini-omni-flash') {
      if (isMultimodal) {
        targetPath = 'gemini-omni-flash/video-edit';
      } else if (hasImages) {
        targetPath = 'gemini-omni-flash/image-to-video';
      } else {
        targetPath = 'gemini-omni-flash/text-to-video';
      }
    } else if (model === 'veo-3.1-fast') {
      if (imageUrls.length === 2) {
        targetPath = 'rhart-video-v3.1-fast/start-end-to-video';
      } else if (hasImages) {
        targetPath = 'rhart-video-v3.1-fast/image-to-video';
      } else {
        targetPath = 'rhart-video-v3.1-fast/text-to-video';
      }
    } else if (model === 'minimax-h3') {
      if (isMultimodal) {
        targetPath = 'minimax/hailuo-h3/multimodal-to-video';
      } else if (hasImages) {
        targetPath = 'minimax/hailuo-h3/image-to-video';
      } else {
        targetPath = 'minimax/hailuo-h3/text-to-video';
      }
    } else if (model === 'ltx-2.3') {
      if (hasImages) {
        targetPath = 'rhart-video/ltx-2.3/image-to-video';
      } else {
        targetPath = 'rhart-video/ltx-2.3/text-to-video';
      }
    }

    // ── Build payload parameters based on target endpoint ──
    if (targetPath.endsWith('/text-to-video')) {
      mappedPayload = {
        prompt,
        ratio: cleanRatio,
        aspectRatio: cleanRatio,
        duration: String(durationNum),
        resolution: cleanQuality
      };
    } else if (targetPath.endsWith('/image-to-video') || targetPath.endsWith('/start-end-to-video')) {
      if (targetPath === 'rhart-video-v3.1-fast/image-to-video') {
        mappedPayload = {
          prompt,
          image: imageUrls[0],
          aspectRatio: cleanRatio,
          duration: String(durationNum),
          resolution: cleanQuality,
          generateAudio: useAudio
        };
      } else {
        mappedPayload = {
          prompt,
          firstFrameUrl: imageUrls[0] || null,
          lastFrameUrl: imageUrls[1] || null,
          duration: String(durationNum),
          resolution: cleanQuality,
          generateAudio: useAudio,
          aspectRatio: cleanRatio,
          ratio: cleanRatio
        };
      }
    } else {
      // Multimodal / Video Edit endpoints
      mappedPayload = {
        prompt,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
        audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
        ratio: cleanRatio,
        aspectRatio: cleanRatio,
        resolution: cleanQuality,
        duration: String(durationNum),
        generateAudio: useAudio,
        realPersonMode: useRealPerson
      };
    }

    // Filter out undefined, null, or empty elements to keep payload clean
    const bodyPayload: Record<string, any> = { model: targetPath };
    for (const [key, value] of Object.entries(mappedPayload)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'string' && value.trim() === '') continue;
      bodyPayload[key] = value;
    }

    const result = await generateVideoStandard(bodyPayload as any, apiKeyType || 'enterprise');
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Video Generate Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate video' }, { status: 500 });
  }
}
