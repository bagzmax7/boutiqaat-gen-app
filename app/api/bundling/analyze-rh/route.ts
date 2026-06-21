import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { chatCompletion } from '@/lib/runninghub';

const STUDIO_SYSTEM_PROMPT = `You are a Creative Director and Expert Prompt Engineer for luxury e-commerce product photography.
You will analyze N high-resolution product images, user-defined dimensions, and product details.
Your goal is to write a highly detailed, structured JSON-formatted prompt in English to guide an image generation model to create a realistic, high-end composite studio photo.

Format your output strictly as a JSON object:
{
  "prompt": "The generated prompt (MUST be a stringified JSON object matching the Prompt JSON Schema below)...",
  "products": [
    {
      "product_id": "image_2",
      "visual_description": "..."
    }
  ]
}

The "prompt" field MUST be a stringified JSON object adhering to this Prompt JSON Schema:
{
  "canvas_specifications": {
    "size": "1200 x 1200 pixels",
    "background": "Pure solid white background (#ffffff) - no gradients, no textures, no props",
    "surface": "Clean reflective solid white floor",
    "safe_zone": "All product visual content must stay between Y=100px (top margin) and Y=1100px (bottom baseline)"
  },
  "studio_lighting": {
    "description": "Even, soft commercial studio lighting from the upper left at 45 degrees, with gentle fill light from the right."
  },
  "composition": {
    "arrangement": "All products stand perfectly straight and upright (0 degrees tilt) side-by-side in a neat horizontal row.",
    "spacing": "Symmetrical, equal horizontal spacing (uniform gaps) between all adjacent products. Clear distinct spacing, no overlapping.",
    "depth": "Flat coplanar depth (all products on the same 3D depth plane)",
    "baseline_alignment": "Perfect baseline alignment on Y=1100px. The bottom contact point of every single product with the reflective white floor must align perfectly to the exact same horizontal baseline line. No product should float or be vertically offset compared to others."
  },
  "products": [
    {
      "product_id": "image_2",
      "name": "Product Name",
      "position": "Left/Middle/Right",
      "scale": "Proportional height relative to largest product (e.g. '100% (Anchor product)' or 'exactly 85% of the height of Product A')",
      "visual_description": "A brief description of the product container shape and color (e.g. 'Frosted white glass bottle with silver pump cap'), followed by the exact sentence: 'Product [Index] is exactly same like Image [Index + 1] in every single detail, including all logos, texts, shapes, and colors.'",
      "finishing_effect": "Clean, semi-transparent mirror reflections fade vertically downwards over 30% of each product's height"
    }
  ],
  "brand_preservation": "All brand text, logos, Swiss flag graphics, and volume details must remain 100% sharp, legible, unmutated, and identical to reference images."
}

Follow these strict guidelines based on Boutiqaat Studio Guidelines to fill the fields in the Prompt JSON:
1. SCENE & BACKGROUND:
   - Background: Pure solid white background (#ffffff). The surface under the products must be a clean, reflective solid white floor.
   - Lighting: Even, soft commercial studio lighting from the upper left at 45 degrees, with gentle fill light from the right.
   - No props, no flowers, no fabrics, no decorative materials. Only the products on the white background.
2. FINISHING EFFECTS (SHADOW vs. REFLECTION):
   - SHADOWS: Apply a clean, soft drop shadow (diffused, offset slightly down-right) ONLY if the product is in these categories: Fragrances/Perfumes, Footwear, Apparel, Caps/Hats.
   - REFLECTIONS: Apply a clean mirror reflection (semi-transparent, fading vertically downwards over 30% of the product height) for ALL other products (e.g. Cosmetics, Skincare, Haircare, Makeup, Bodycare, Tools).
3. CANVAS & SAFE ZONE:
   - Output canvas size: 1200 x 1200 pixels.
   - Safe zone height boundaries: products must stay between Y=100px (top margin) and Y=1100px (bottom baseline).
4. COMPOSITION & BASELINE ALIGNMENT:
   - BASELINE ALIGNMENT: All products must be aligned perfectly at the bottom to stand on the exact same horizontal baseline (Y=1100px). Make sure the contact point of every product with the white floor is perfectly level, straight, and aligned on the same horizontal axis. No floating or offset products.
   - EQUAL SPACING: All adjacent products must have exactly equal, uniform horizontal gaps between them. The distance between Product 1 and Product 2, Product 2 and Product 3, and so on, must be identical and symmetric. Any slight misalignment from the user's manual canvas layout (Image 1) must be corrected to be perfectly uniform and neat in the final output.
   - UPRIGHT STANDING: All products must stand perfectly straight and upright, perfectly vertical with 0 degrees of rotation or tilt.
   - Zero overlapping. Products must have clear, distinct spacing between them.
   - EXCEPTIONS:
     * Sunglasses: Do NOT place on the Y=1100px baseline. Sunglasses must be centered vertically in the canvas.
     * Footwear: Must be displayed in a side-angle shot.
     * Derma Beauty: Always include the original product packaging/box standing next to the product in the row.
5. PROPORTIONAL SCALE LOGIC:
   - Calculate mathematical height and width proportions between all products relative to the largest product (acts as the Anchor). Write this out explicitly in the prompt (e.g., 'Product B is exactly 75% of the height of Product A').
6. IDENTITY PRESERVATION:
   - For each product, under the "visual_description" field, you MUST write: "Product [Index] is exactly same like Image [Index + 1] in every single detail."
   - Do NOT transcribe or write out all the text/details of the label in the prompt, as this causes the image generator to hallucinate new text. Instead, force it to copy the original image reference exactly (clipping mask style).
   - Explicitly instruct: 'Not a single letter, logo, shape, color tone, or brand element must change. Do not mutate or blur any brand text (e.g., keep "RAUSCH" exactly as is).'`;

const AESTHETIC_SYSTEM_PROMPT = `You are a Creative Director and Expert Prompt Engineer for luxury e-commerce product photography.
You will analyze N high-resolution product images, user-defined dimensions, and product details.
Your goal is to write a single paragraph of ultra-high-end prompt in English to guide an image generation model to create a realistic, aesthetically pleasing composite photo.

Format your output strictly as a JSON object:
{
  "prompt": "The generated prompt...",
  "products": [
    {
      "product_id": "image_2",
      "visual_description": "..."
    }
  ]
}

Follow these strict guidelines:
1. SCENE & BACKGROUND:
   - Background: Clean white (#ffffff) or minimalist soft white/off-white background.
   - Theme: Premium, minimalist, and artistic.
   - Lighting: Elegant, soft light casting natural shadows and reflections.
2. FINISHING EFFECTS (SHADOW vs. REFLECTION):
   - SHADOWS: Apply a clean, soft drop shadow ONLY if the product is in these categories: Fragrances/Perfumes, Footwear, Apparel, Caps/Hats.
   - REFLECTIONS: Apply a clean mirror reflection for ALL other products (e.g. Cosmetics, Skincare, Haircare, Makeup, Bodycare, Tools).
3. PROPORTIONAL SCALE LOGIC:
   - Calculate mathematical height and width proportions between all products relative to the largest product (acts as the Anchor). Write this out explicitly in the prompt (e.g., 'Product B is exactly 75% of the height of Product A').
4. COMPOSITION:
   - You are allowed to be creative with composition. Allow slight artistic overlapping, staggered depths, or elegant angles, while maintaining a clean, premium visual layout.
   - EXCEPTIONS:
     * Sunglasses: Centered vertically in the canvas.
     * Footwear: Displayed in a side-angle shot.
     * Derma Beauty: Always include the original product packaging/box next to the product.
5. IDENTITY PRESERVATION:
   - Describe in high detail: packaging color, material texture (matte glass, glossy plastic, metal, wood, paper), shape, and caps.
   - Transcribe every single brand name, logo text, volume, or typographical character from the packaging with 100% precision.
   - Explicitly instruct: 'Not a single letter, logo, shape, color tone, or brand element must change. Do not mutate or blur any brand text (e.g., keep "RAUSCH" exactly as is).'`;

const CREATIVE_SYSTEM_PROMPT = `You are a Creative Director and Expert Prompt Engineer for luxury e-commerce product photography.
You will analyze N high-resolution product images, user-defined dimensions, and product details.
Your goal is to write a single paragraph of ultra-high-end prompt in English to guide an image generation model to create a highly creative, beautifully themed composite photo.

Format your output strictly as a JSON object:
{
  "prompt": "The generated prompt...",
  "products": [
    {
      "product_id": "image_2",
      "visual_description": "..."
    }
  ]
}

Follow these strict guidelines:
1. SCENE & BACKGROUND:
   - Theme: Design a highly creative, luxurious themed background matching the product categories (e.g., stepped black marble slabs with gold veins for luxury items/fragrances, travertine stone with water ripples for skincare, custom-colored clay plaster for makeup, organic wood planks for natural/organic goods, sleek technical pedestals for electronics/tools).
   - Lighting: Dramatic, high-end commercial or cinematic lighting (warm tones, golden highlights, diagonal window shadows, or caustics).
2. FINISHING EFFECTS (SHADOW vs. REFLECTION):
   - SHADOWS: Apply a clean, soft drop shadow ONLY if the product is in these categories: Fragrances/Perfumes, Footwear, Apparel, Caps/Hats.
   - REFLECTIONS: Apply a clean mirror reflection for ALL other products (e.g. Cosmetics, Skincare, Haircare, Makeup, Bodycare, Tools).
3. PROPORTIONAL SCALE LOGIC:
   - Calculate mathematical height and width proportions between all products relative to the largest product (acts as the Anchor). Write this out explicitly in the prompt (e.g., 'Product B is exactly 75% of the height of Product A').
4. COMPOSITION:
   - Be highly creative. Staggered heights, placing products on platforms or pedestals, and vertical stacking are encouraged. Creative overlapping is allowed to create depth and a rich artistic composition.
   - EXCEPTIONS:
     * Sunglasses: Centered vertically in the canvas.
     * Footwear: Displayed in a side-angle shot.
     * Derma Beauty: Always include the original product packaging/box next to the product.
5. IDENTITY PRESERVATION:
   - Describe in high detail: packaging color, material texture (matte glass, glossy plastic, metal, wood, paper), shape, and caps.
   - Transcribe every single brand name, logo text, volume, or typographical character from the packaging with 100% precision.
   - Explicitly instruct: 'Not a single letter, logo, shape, color tone, or brand element must change. Do not mutate or blur any brand text (e.g., keep "RAUSCH" exactly as is).'`;

const USER_PROMPT = (productsInput: any[], genMode: string) => `You are requested to generate a luxury product photography prompt in "${genMode}" mode.

Image 1 is the composite layout canvas showing where and how the user positioned the products.
Image 2, Image 3, Image 4, etc. are the individual high-resolution product photos.

Below is the user-provided product details and specifications (in order from left to right):
${productsInput.map((p, idx) => `Product ${idx + 1} (corresponding to high-res Image ${idx + 2}):
- User Name: "${p.name}"
- Specified Category: ${p.category}
- Manual Dimensions (cm): Height=${p.dimensions_cm.height}, Width=${p.dimensions_cm.width}, Depth=${p.dimensions_cm.depth}
- Manual Volume: ${p.volume_ml}ml`).join('\n\n')}

Analyze the canvas layout in Image 1 and the high-res details in the individual product images (Image 2 onwards) to extract detailed visual descriptions, brand names, and logo texts.
Then, write the final, detailed prompt string in English and compile the products list as requested in the JSON schema.
Return ONLY valid JSON. No explanation text outside the JSON.`;

/** Parse LLM text → JSON object */
function parseCreativeDirectorResponse(rawText: string): { prompt: string; products: any[] } {
  const cleaned = rawText.trim();
  
  // Find the boundaries of the JSON object
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.error("No JSON boundaries found in response:", rawText);
    throw new Error('LLM response did not contain a valid JSON object.');
  }
  
  const jsonStr = cleaned.slice(startIdx, endIdx + 1);
  
  try {
    const parsed = JSON.parse(jsonStr);
    
    let promptStr = parsed.prompt;
    if (typeof promptStr === 'object') {
      promptStr = JSON.stringify(promptStr, null, 2);
    }
    
    if (!promptStr) {
      // If the LLM returned the prompt JSON directly as the root object:
      if (parsed.canvas_specifications || parsed.products) {
        promptStr = JSON.stringify(parsed, null, 2);
      } else {
        throw new Error("Missing prompt field in JSON response");
      }
    }

    let products = parsed.products;
    if (!Array.isArray(products)) {
      // Try to extract products from prompt if it is a JSON string
      try {
        if (typeof promptStr === 'string' && promptStr.trim().startsWith('{')) {
          const parsedPrompt = JSON.parse(promptStr);
          if (Array.isArray(parsedPrompt.products)) {
            products = parsedPrompt.products;
          }
        }
      } catch (e) {
        console.warn("Failed to extract products from prompt JSON string:", e);
      }
    }

    if (!Array.isArray(products)) {
      products = [];
    }

    return {
      prompt: promptStr,
      products
    };
  } catch (err: any) {
    console.error("JSON parsing error:", err?.message || err);
    console.error("Raw response content was:\n", rawText);
    throw new Error('LLM response was not valid JSON matching the schema.');
  }
}

// Fallback chain for LLMs on RunningHub (strictly vision-supported models)
const LLM_MODELS = [
  'google/gemini-3.5-flash',
  'qwen/qwen3.6-plus'
];

async function urlToBase64Uri(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function tryCallRunningHubLLM(
  model: string,
  messages: any[]
): Promise<string | null> {
  console.log(`[analyze-rh] Trying RunningHub LLM model: ${model}`);
  try {
    const res = await chatCompletion({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 4096,
    }, 'enterprise');
    
    return res.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    console.warn(`[analyze-rh] RunningHub LLM model ${model} failed:`, err?.message || err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await validateAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { images, products, genMode = 'Studio', selectedLlm } = body as {
      images: string[];
      products: any[];
      genMode: 'Studio' | 'Aesthetic' | 'Creative';
      selectedLlm?: string;
    };

    if (!images || images.length < 1) {
      return NextResponse.json({ error: 'At least 1 image required' }, { status: 400 });
    }
    if (images.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 images allowed' }, { status: 400 });
    }

    // Select the system prompt based on selected Scene Setting
    let systemPrompt = STUDIO_SYSTEM_PROMPT;
    if (genMode === 'Aesthetic') {
      systemPrompt = AESTHETIC_SYSTEM_PROMPT;
    } else if (genMode === 'Creative') {
      systemPrompt = CREATIVE_SYSTEM_PROMPT;
    }

    // Fetch and encode all reference images as Base64 URIs
    console.log(`[analyze-rh] Fetching ${images.length} reference images...`);
    const imageDataUris = await Promise.all(images.map(urlToBase64Uri));

    // Construct OpenAI-compatible vision payload
    const contentParts: any[] = [
      { type: "text", text: USER_PROMPT(products || [], genMode) },
      { type: "text", text: "\n--- START OF PRODUCT IMAGES ---" }
    ];

    imageDataUris.forEach((uri, idx) => {
      contentParts.push({ type: "text", text: `\n[Image ${idx + 1} Reference File]:` });
      contentParts.push({
        type: "image_url",
        image_url: { url: uri }
      });
    });

    contentParts.push({ type: "text", text: "\n--- END OF PRODUCT IMAGES ---\nNow, analyze the images in order and output the JSON." });

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentParts }
    ];

    // Build the execution queue prioritizing the user's selected LLM
    let modelQueue = [...LLM_MODELS];
    if (selectedLlm && modelQueue.includes(selectedLlm)) {
      modelQueue = [selectedLlm, ...modelQueue.filter(m => m !== selectedLlm)];
    }

    let rawText: string | null = null;
    for (const model of modelQueue) {
      rawText = await tryCallRunningHubLLM(model, messages);
      if (rawText) break;
    }

    if (!rawText) {
      return NextResponse.json(
        { error: 'All RunningHub LLM models failed or returned no response.' },
        { status: 502 }
      );
    }

    const result = parseCreativeDirectorResponse(rawText);
    console.log(`[analyze-rh] ✓ Creative Director Vision success.`);
    return NextResponse.json({
      prompt: result.prompt,
      products: result.products
    });

  } catch (err) {
    console.error('[analyze-rh] Route error:', err);
    return NextResponse.json({ error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
