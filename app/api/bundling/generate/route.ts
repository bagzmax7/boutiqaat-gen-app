/**
 * POST /api/bundling/generate
 * Receives { prompt, image_urls: string[] }
 * Calls Google Gemini Nano Banana 2 image generation API.
 * Stores result in Supabase Storage 'generated-results'.
 * Returns { imageUrl: string }
 *
 * Docs: https://ai.google.dev/gemini-api/docs/image-generation
 * Model: gemini-3.1-flash-image-preview (Nano Banana 2)
 * REST format: x-goog-api-key header, no responseModalities needed
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Nano Banana 2 — fast image generation model (as of May 2026)
// Fallback chain: try newest first, fall back to older stable
const IMAGE_MODELS = [
  'gemini-3.1-flash-image',          // Nano Banana 2 (GA - stable, fast) — Primary Model
  'gemini-3-pro-image',              // Nano Banana Pro (GA - best quality, reasoning)
  'gemini-3.1-flash-image-preview', // Legacy fallback (deprecated)
  'gemini-2.5-flash-image',          // Nano Banana (stable)
  'gemini-2.0-flash-preview-image-generation', // legacy fallback
];

async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return { data: buffer.toString('base64'), mimeType };
}

async function tryGenerateImage(
  model: string,
  parts: unknown[]
): Promise<{ imageBase64: string; imageMimeType: string } | null> {
  console.log(`[generate] Trying model: ${model}`);
  
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    // The SDK automatically handles the correct protobuf mapping for AspectRatio and ImageSize
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: parts as any }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "2K",
        }
      }
    });

    // The SDK returns image parts as inlineData or similar
    const imagePart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!imagePart || !imagePart.data) {
      console.warn(`[generate] ${model} failed to return inlineData image part.`);
      return null;
    }

    return {
      imageBase64: imagePart.data,
      imageMimeType: imagePart.mimeType || 'image/jpeg'
    };
  } catch (err: any) {
    console.warn(`[generate] ${model} failed:`, err?.message || err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await validateAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { prompt, image_urls } = body as { prompt: string; image_urls: string[] };

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    if (!image_urls || image_urls.length < 1) {
      return NextResponse.json({ error: 'At least 1 reference image required' }, { status: 400 });
    }

    // Fetch and encode all reference images
    console.log(`[generate] Fetching ${image_urls.length} reference images...`);
    const imageDataList = await Promise.all(image_urls.map(urlToBase64));

    const isStudio = prompt.includes('IMAGE EDITING TASK');
    const isCreative = prompt.includes('Creative high-end');
    const reminderText = isStudio
      ? '\n\nREMINDER: This must be a 1200×1200px square composite image on a pure solid white background (#ffffff). Keep the exact positions, sizes, orientations, shapes, and layout for each product as shown in the composite Image 1. Do NOT rearrange them, do NOT move them, and do NOT change their spacing. The products are already arranged side-by-side in a neat row in Image 1—preserve this arrangement with 100% fidelity. Apply elegant mirror reflections fading downward for cosmetics/skincare. Photorealistic, ultra-HD quality.'
      : isCreative
      ? '\n\nREMINDER: Render the products exactly as arranged in the composite Image 1, keeping their relative sizes, layouts, and orientations. Do NOT hallucinate, mutate, or change any brand text, logos, or packaging designs. Place the products into the dynamically themed, highly detailed background described in the prompt (e.g. sandstone pedestals, polished marble, water droplets, custom lighting, shadows). Ensure the background matches the prompt description perfectly with rich textures, photorealistic depth, and realistic shadows/reflections.'
      : '\n\nREMINDER: This must be a photorealistic rendering of the exact composite scene shown in Image 1, keeping the exact same positions, sizes, orientations, shapes, and layout for each product. Do NOT rearrange them. Maintain custom placements, rotations, and overlaps exactly as arranged in Image 1. Apply elegant semi-transparent reflections or soft shadows matching the scene on the clean background.';

    const parts: unknown[] = [
      { text: prompt },
      { text: reminderText },
      ...imageDataList.map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.data },
      })),
    ];

    // Try each model in order until one returns an image
    let result: { imageBase64: string; imageMimeType: string } | null = null;

    for (const model of IMAGE_MODELS) {
      result = await tryGenerateImage(model, parts);
      if (result) break;
    }

    if (!result) {
      return NextResponse.json(
        { error: 'No image generated — all Gemini models returned no image data. Check API key and prompt.' },
        { status: 500 }
      );
    }

    // Upload to Supabase Storage
    const imageBuffer = Buffer.from(result.imageBase64, 'base64');
    const ext = result.imageMimeType === 'image/png' ? 'png' : 'jpg';
    const fileName = `${auth.userId}/${Date.now()}-bundle.${ext}`;

    const { error: storageError } = await supabaseAdmin.storage
      .from('generated-results')
      .upload(fileName, imageBuffer, {
        contentType: result.imageMimeType,
        upsert: false,
      });

    if (storageError) {
      console.error('[generate] Storage upload error:', storageError);
      return NextResponse.json(
        { error: 'Generated image could not be stored', details: storageError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('generated-results')
      .getPublicUrl(fileName);

    console.log(`[generate] ✓ Stored at: ${urlData.publicUrl}`);
    return NextResponse.json({ imageUrl: urlData.publicUrl });
  } catch (err) {
    console.error('[generate] Route error:', err);
    return NextResponse.json(
      { error: 'Generation failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
