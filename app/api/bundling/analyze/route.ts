/**
 * POST /api/bundling/analyze
 * Receives { images: string[], product_names: string[] }
 * Returns { products: ProductAnalysis[] }
 *
 * Strategy (in order):
 *  1. Hugging Face Router — Qwen2.5-VL-72B (best free vision, OVHcloud)
 *  2. Hugging Face Router — Qwen2.5-VL-7B  (faster, Hyperbolic)
 *  3. Hugging Face Router — Gemma 4 31B    (Google multimodal, Novita)
 *  4. Google Gemini 1.5 Flash direct       (guaranteed fallback)
 *
 * HF Router docs: https://huggingface.co/docs/inference-providers
 * Get a free token at: https://huggingface.co/settings/tokens
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Removed Hugging Face Router logic per user request. 
// Now exclusively using Gemini 3.1 Flash Lite for all Vision and LLM tasks.

const SYSTEM_PROMPT =
  'You are a cosmetics packaging expert. Return ONLY valid JSON as specified. No text outside the JSON.';

const USER_PROMPT = (productNames: string[]) => `Analyze these product images and return JSON ONLY:
{
  "products": [
    {
      "product_id": "image_1",
      "product_name": "name from label or user input",
      "category": "makeup or skincare or haircare or bodycare or perfume",
      "estimated_volume": "e.g. 200ml",
      "dimensions_cm": { "height": 18.0, "width": 6.5, "depth": 4.0 },
      "visual_description": "Detailed visual description. Crucial: Extract and spell out ALL text, logos, and typography exactly as seen on the bottle/packaging. Include packaging color, material (glass, matte plastic, etc.), shape, cap style, and logo placement. Be extremely precise to preserve identity.",
      "confidence": "High or Medium or Low"
    }
  ]
}

Product names provided by user:
${productNames.map((n, i) => `Image ${i + 1}: ${n || '(not provided)'}`).join('\n')}

Rules:
- Return ONLY the JSON object above — no markdown, no explanation, no code blocks
- Use standard cosmetic, skincare, and haircare packaging dimensions as reference:
  * Standard 200ml shampoo/conditioner bottles (e.g., RAUSCH Shampoo bottles) are typically H=18.0cm, W=6.5cm, D=4.0cm.
  * Standard 200ml hair tincture/tonic bottles (e.g., RAUSCH Haartinktur) are typically H=16.5cm, W=6.0cm, D=3.5cm.
  * Standard 250ml to 400ml shampoo bottles are typically H=18.0cm to 21.0cm, W=6.5cm to 7.5cm.
  * A standard eyeliner or lip pencil (e.g., K7L Lip Pencil) is H=12.0cm to 14.0cm, W=0.8cm.
  * A standard liquid eyeliner pen is H=12.5cm to 13.5cm, W=1.0cm.
  * A standard false lash box (e.g., KISS Trio Lashes) is H=8.0cm to 9.0cm, W=10.0cm to 11.5cm.
  * A standard 30ml serum dropper bottle is H=9.0cm to 10.5cm, W=3.0cm to 3.5cm.
  * A standard lipstick bullet is H=7.2cm to 7.8cm, W=2.0cm to 2.2cm.
- STRICT BOTTLE/PACKAGING CONSISTENCY RULE:
  You must perform a comparison across all provided images:
  1. Identify all products that share the same manufacturer/brand (e.g. "RAUSCH") and basic category.
  2. If they have the same shape, cap style, and volume (even if they are different colors or have different labels—such as RAUSCH After-sun shampoo and RAUSCH Caffeine shampoo), they are manufactured in the exact same physical bottle.
  3. Therefore, their "dimensions_cm" (height, width, depth) MUST be exactly identical in your JSON output. Do NOT assign slightly different dimensions (like 16.5cm for one and 17.5cm for the other) for identical bottle types.
  4. Compare all products in the list. If they have the same shape/volume, their dimensions must be equal.
- Height/width/depth must be numbers in centimetres
- product_id must be "image_1", "image_2", etc. to match each uploaded image in sequential order
- confidence: High = clearly visible, Medium = partially visible, Low = unclear`;

/** Parse LLM text → products array (strips markdown if present) */
function parseProducts(rawText: string): Record<string, unknown>[] {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  
  let productsArray: unknown[] = [];
  if (Array.isArray(parsed)) {
    productsArray = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).products)) {
    productsArray = (parsed as any).products;
  } else {
    throw new Error('Missing products array in response. Preview: ' + rawText.slice(0, 100));
  }

  return productsArray.map((p, i) => {
    const prod = p as Record<string, unknown>;
    return { ...prod, product_id: prod.product_id || `image_${i + 1}` };
  });
}

// Highly compatible Vision Model Chain (GA, stable, high multimodal accuracy)
const VISION_MODELS = [
  'gemini-1.5-pro',       // Gold standard for high-accuracy text extraction & vision reasoning
  'gemini-1.5-flash',     // High-speed multimodal
  'gemini-3.1-flash-lite' // Lightweight stable fallback
];

async function tryAnalyzeGemini(
  model: string,
  parts: unknown[]
): Promise<string | null> {
  console.log(`[analyze] Trying Gemini vision model: ${model}`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        },
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[analyze] Gemini vision model ${model} failed: ${res.status} - ${err.slice(0, 150)}`);
      return null;
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err: any) {
    console.warn(`[analyze] Gemini vision model ${model} failed:`, err?.message || err);
    return null;
  }
}

/** ── Primary Strategy: Google Gemini Multimodal Vision ────────── */
async function analyzeViaGemini(
  imageUrls: string[],
  productNames: string[]
): Promise<Record<string, unknown>[]> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  // Fetch + encode images
  console.log(`[analyze] Gemini: fetching ${imageUrls.length} images...`);
  const imageDataList = await Promise.all(
    imageUrls.map(async (url) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
      return { data: buffer.toString('base64'), mimeType };
    })
  );

  const parts: unknown[] = [
    { text: USER_PROMPT(productNames) },
    { text: "\n--- START OF PRODUCT IMAGES ---" },
    ...imageDataList.flatMap((img, idx) => [
      { text: `\n[Image ${idx + 1} Reference File]:` },
      { inlineData: { mimeType: img.mimeType, data: img.data } }
    ]),
    { text: "\n--- END OF PRODUCT IMAGES ---\nNow, analyze the images in order and output the JSON." }
  ];

  let rawText: string | null = null;
  for (const model of VISION_MODELS) {
    rawText = await tryAnalyzeGemini(model, parts);
    if (rawText) break;
  }

  if (!rawText) throw new Error('All Gemini vision models returned no response or failed');

  const products = parseProducts(rawText);
  console.log(`[analyze] ✓ Gemini vision success → ${products.length} products`);
  return products;
}

export async function POST(req: NextRequest) {
  const auth = await validateAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { images, product_names } = body as { images: string[]; product_names: string[] };

    if (!images || images.length < 1) {
      return NextResponse.json({ error: 'At least 1 image required' }, { status: 400 });
    }
    if (images.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 images allowed' }, { status: 400 });
    }

    let products: Record<string, unknown>[];

    // Exclusively use Gemini 3.1 Flash Lite
    try {
      products = await analyzeViaGemini(images, product_names || []);
      return NextResponse.json({ products });
    } catch (geminiErr) {
      console.error('[analyze] Gemini failed:', geminiErr);
      return NextResponse.json(
        { error: 'Analysis failed — check API keys in .env.local' },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error('[analyze] Route error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
