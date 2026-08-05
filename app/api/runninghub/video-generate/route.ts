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

    // ── Model-specific mapping ──
    if (model.includes('kling-v3.0-std') || model.includes('kling-video-o1')) {
      // Kling models
      targetPath = model.includes('kling-v3.0-std') 
        ? 'kling-v3.0-std/image-to-video'
        : 'kling-video-o1/image-to-video';
      
      mappedPayload = {
        prompt,
        firstImageUrl: imageUrls[0] || null,
        lastImageUrl: imageUrls[1] || null,
        duration: String(durationNum),
        sound: useAudio,
        resolution: cleanQuality
      };
    } else if (model.includes('google/veo3.1-pro') || model.includes('rhart-video-v3.1-pro')) {
      // Google Veo 3.1 Pro (Low cost channel)
      targetPath = 'rhart-video-v3.1-pro/start-end-to-video';
      mappedPayload = {
        prompt,
        firstFrameUrl: imageUrls[0] || null,
        lastFrameUrl: imageUrls[1] || null,
        aspectRatio: cleanRatio,
        duration: String(durationNum),
        resolution: cleanQuality
      };
    } else if (model.includes('google/veo3.1-fast') || model.includes('rhart-video-v3.1-fast')) {
      // Google Veo 3.1 Fast (Low cost channel)
      targetPath = 'rhart-video-v3.1-fast/start-end-to-video';
      mappedPayload = {
        prompt,
        firstFrameUrl: imageUrls[0] || null,
        lastFrameUrl: imageUrls[1] || null,
        aspectRatio: cleanRatio,
        duration: String(durationNum),
        resolution: cleanQuality
      };
    } else if (model.includes('sparkvideo-2.0') && model.includes('image-to-video')) {
      // SparkVideo 2.0 (Image to Video)
      targetPath = 'rhart-video/sparkvideo-2.0/image-to-video';
      mappedPayload = {
        prompt,
        firstFrameUrl: imageUrls[0] || null,
        lastFrameUrl: imageUrls[1] || null,
        generateAudio: useAudio,
        duration: String(durationNum),
        resolution: cleanQuality
      };
    } else if (model.includes('seedance-2.0-global-fast') || model.includes('seedance-2.0-global')) {
      // Seedance 2.0 Global / Global Fast (image-to-video)
      const isFast = model.includes('fast') || model.includes('global-fast');
      targetPath = isFast 
        ? 'rhart-video/sparkvideo-2.0-fast/image-to-video'
        : 'rhart-video/sparkvideo-2.0/image-to-video';
      
      mappedPayload = {
        prompt,
        firstFrameUrl: imageUrls[0] || null,
        lastFrameUrl: imageUrls[1] || null,
        generateAudio: useAudio,
        duration: String(durationNum),
        resolution: cleanQuality
      };
    } else if (model.includes('text-to-video')) {
      // Text-to-Video models
      targetPath = 'rhart-video/sparkvideo-2.0/text-to-video';
      mappedPayload = {
        prompt,
        ratio: cleanRatio,
        duration: String(durationNum),
        resolution: cleanQuality
      };
    } else {
      // Default Multimodal or Fallback
      // e.g. rhart-video/sparkvideo-2.0-mini/multimodal-video
      mappedPayload = {
        prompt,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
        audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
        ratio: cleanRatio,
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
