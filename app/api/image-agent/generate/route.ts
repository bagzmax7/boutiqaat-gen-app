import { NextResponse } from 'next/server';
import { generateImage } from '@/lib/runninghub';

// ──────────────────────────────────────────────────────────────────────────────
// Model Configuration — aligned with actual RunningHub API docs
// ──────────────────────────────────────────────────────────────────────────────
const IMAGE_MODELS: Record<string, {
  name: string;
  rhModelId: string;           // internal ID used in generateImage()
  supportedModes: ('text-to-image' | 'image-to-image')[];
  supportedAspectRatios: string[];
  supportedResolutions: ('1k' | '2k' | '4k')[];
  defaultResolution: '1k' | '2k' | '4k';
  // Grok sub-model selector
  grokSubModels?: string[];
}> = {
  // ── Nano Banana 2 (Gemini 3.1 Flash) ─────────────────────────────────────
  'nano-banana-2': {
    name: 'Nano Banana 2 (Low Cost)',
    rhModelId: 'nano-banana-2',
    supportedModes: ['text-to-image', 'image-to-image'],
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1'],
    supportedResolutions: ['1k', '2k', '4k'],
    defaultResolution: '1k',
  },

  // ── Nano Banana Pro (Edit endpoint only) ─────────────────────────────────
  'nano-banana-pro': {
    name: 'Nano Banana Pro',
    rhModelId: 'nano-banana-pro',
    supportedModes: ['image-to-image'], // Pro only supports edit/i2i
    supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'],
    supportedResolutions: ['1k', '2k', '4k'],
    defaultResolution: '1k',
  },

  // ── GPT Image 2.0 ─────────────────────────────────────────────────────────
  'gpt-2.0': {
    name: 'GPT Image 2.0 (Edit-Economy)',
    rhModelId: 'gpt-2.0',
    supportedModes: ['text-to-image', 'image-to-image'],
    supportedAspectRatios: ['1:1', '2:3', '3:2', '4:5', '5:4', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21', '2:1', '1:2', '3:1', '1:3'],
    supportedResolutions: ['1k', '2k', '4k'],
    defaultResolution: '1k',
  },

  // ── Grok Image ────────────────────────────────────────────────────────────
  'grok-image': {
    name: 'Grok Image',
    rhModelId: 'grok-image',
    supportedModes: ['text-to-image', 'image-to-image'],
    // Grok uses WxH dimensions as aspect ratio
    supportedAspectRatios: ['960x960', '720x1280', '1280x720', '1168x784', '784x1168'],
    supportedResolutions: ['1k'],
    defaultResolution: '1k',
    grokSubModels: ['g-3', 'g-4', 'g-4.1', 'g-4.2'],
  },
};

export async function GET() {
  // Expose model config to the frontend
  return NextResponse.json({
    models: Object.entries(IMAGE_MODELS).map(([id, cfg]) => ({
      id,
      name: cfg.name,
      supportedModes: cfg.supportedModes,
      supportedAspectRatios: cfg.supportedAspectRatios,
      supportedResolutions: cfg.supportedResolutions,
      defaultResolution: cfg.defaultResolution,
      grokSubModels: cfg.grokSubModels,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const {
      prompt,
      model = 'nano-banana-2',
      imageUrls,          // string[] | undefined
      imageUrl,           // string | undefined (Grok single image)
      aspectRatio,
      resolution,
      grokModel,
      count = 1,
    } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const modelCfg = IMAGE_MODELS[model];
    if (!modelCfg) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 });
    }

    // Validate Nano Banana Pro: requires at least one image
    if (model === 'nano-banana-pro') {
      const hasImage = (imageUrls && imageUrls.length > 0) || !!imageUrl;
      if (!hasImage) {
        return NextResponse.json(
          { error: 'Nano Banana Pro requires at least one reference image (image-to-image / edit mode only)' },
          { status: 400 }
        );
      }
    }

    const resolvedResolution: '1k' | '2k' | '4k' = 
      (resolution && modelCfg.supportedResolutions.includes(resolution))
        ? resolution
        : modelCfg.defaultResolution;

    const countVal = typeof count === 'number' ? Math.max(1, Math.min(4, count)) : 1;

    // Call generateImage concurrently based on selected count
    const taskPromises = Array.from({ length: countVal }).map(() =>
      generateImage({
        model: modelCfg.rhModelId,
        prompt,
        imageUrls,
        imageUrl,
        aspectRatio,
        resolution: resolvedResolution,
        grokModel,
      }, 'enterprise')
    );

    const results = await Promise.all(taskPromises);

    return NextResponse.json({
      taskId: results[0].taskId,
      taskIds: results.map(r => r.taskId),
    });
  } catch (err: any) {
    console.error('[Image Agent Generate Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Image generation failed' },
      { status: 500 }
    );
  }
}
