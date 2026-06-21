/**
 * lib/bundling.ts
 * Boutiqaat Bundling Studio — prompt generation & utilities.
 *
 * Prompt generation follows the official Boutiqaat Studio Guidelines:
 * - Canvas: 1200 × 1200 px, white background (#ffffff)
 * - Safe Zone: products between Y=100px (top) and Y=1100px (baseline)
 * - Volume-based height scaling (per guidelines p.6)
 * - Reflection (not shadow) for all cosmetics, skincare, makeup, haircare
 * - Shadow for fragrances, footwear, apparel, caps
 * - EXACT product identity: brand, color, label, shape, texture preserved
 */

// ============================================================
// Types
// ============================================================

export interface ProductAnalysis {
  product_id: string;
  product_name: string;
  category: 'makeup' | 'skincare' | 'haircare' | 'bodycare' | 'perfume' | string;
  estimated_volume: string;
  dimensions_cm: {
    height: number;
    width: number;
    depth: number;
  };
  visual_description: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface BundlingProduct {
  id: string; // local UUID for UI
  file?: File;
  previewUrl: string; // object URL or Supabase storage URL
  uploadedUrl?: string; // Supabase storage URL after upload
  name: string;
  analysis?: ProductAnalysis;
}

export interface BundlingPromptOptions {
  lighting?: 'Soft' | 'Hard' | 'Cinematic';
  shadowIntensity?: 'Light' | 'Natural' | 'Strong';
  background?: 'Pure white' | 'Gradient white';
  promptStyle?: 'lifestyle' | 'studio' | 'creative';
}

export interface BundlingSession {
  id?: string;
  user_id: string;
  session_name: string;
  created_at?: string;
  product_images: string[];
  product_names: string[];
  dimensions_analysis: { products: ProductAnalysis[] };
  final_prompt: string;
  generated_image_url?: string;
  rating?: number;
  rating_feedback?: string;
  is_favorite?: boolean;
}

// ============================================================
// Boutiqaat Studio Guidelines — Volume-Based Scaling
// Source: Studio Guidelines 1.pdf, page 6 (03.02 IMAGE SIZE)
//
// Canvas: 1200 × 1200 px
// Safe zone: products between Y=100px (top) and Y=1100px (baseline)
//
// Volume        Top (Y)    Height in canvas
// 6–12 ml/gm    600 px     500 px
// 25–30 ml/gm   500 px     600 px
// 50–80 ml/gm   300 px     800 px
// 100 ml/gm+    100 px     1000 px
// ============================================================

interface VolumeScale {
  topPx: number;
  heightPx: number;
  label: string;
}

function getVolumeScale(volumeStr: string): VolumeScale {
  // Parse numeric value from strings like "50ml", "100gm", "30 ml", "200mL", "10g"
  const num = parseFloat(volumeStr.replace(/[^\d.]/g, '')) || 0;

  if (num > 0 && num <= 12) {
    return { topPx: 600, heightPx: 500, label: '6–12 ml/gm (small)' };
  } else if (num <= 30) {
    return { topPx: 500, heightPx: 600, label: '25–30 ml/gm (medium-small)' };
  } else if (num <= 80) {
    return { topPx: 300, heightPx: 800, label: '50–80 ml/gm (medium-large)' };
  } else {
    return { topPx: 100, heightPx: 1000, label: '100 ml/gm+ (large)' };
  }
}

/**
 * Determine whether to use mirror reflection or drop shadow
 * per Boutiqaat Studio Guidelines page 9 (03.05 Reflection & shadow):
 * - SHADOW: Fragrances, Footwear, Apparel, Caps
 * - REFLECTION: All other products (cosmetics, skincare, makeup, haircare, bodycare)
 */
function getFinishingEffect(category: string): 'reflection' | 'shadow' {
  const shadowCategories = ['perfume', 'fragrance', 'footwear', 'apparel', 'cap', 'hat'];
  const cat = category.toLowerCase();
  if (shadowCategories.some((s) => cat.includes(s))) return 'shadow';
  return 'reflection';
}

function getLightingDescription(lighting: 'Soft' | 'Hard' | 'Cinematic' = 'Soft'): string {
  switch (lighting) {
    case 'Hard':
      return 'sharp, direct studio lighting from upper left at 45°, high contrast with defined shadows';
    case 'Cinematic':
      return 'dramatic cinematic lighting from upper left at 45°, warm golden tones, strong specular highlights on surfaces';
    default:
      return 'soft, even studio lighting from upper left at 45° with a gentle fill light from the right — no harsh shadows on the background';
  }
}

// ============================================================
// Prompt Generator
// Follows Boutiqaat Studio Guidelines exactly
// ============================================================

/**
 * Generate the bundling prompt per Boutiqaat Studio Guidelines.
 * @param products - ordered list of products (left to right in final image)
 * @param options  - optional overrides for lighting/shadow/background
 */
export function generateBundlingPrompt(
  products: Array<{ name: string; analysis: ProductAnalysis; imageIndex: number }>,
  options: BundlingPromptOptions = {}
): string {
  const { promptStyle = 'lifestyle' } = options;
  if (promptStyle === 'studio') {
    return generateStrictStudioPrompt(products, options);
  } else if (promptStyle === 'creative') {
    return generateCreativePrompt(products, options);
  }
  return generateLifestylePrompt(products, options);
}

function getCreativeThemeAndBackground(
  products: Array<{ name: string; analysis: ProductAnalysis; imageIndex: number }>
): { theme: string; composition: string } {
  const categories = products.map((p) => (p.analysis.category || 'other').toLowerCase());
  
  const isPerfume = categories.some((c) => c.includes('perfume') || c.includes('fragrance'));
  const isSkincare = categories.some((c) => c.includes('moisturizer') || c.includes('serum') || c.includes('mask') || c.includes('skincare'));
  const isHaircare = categories.some((c) => c.includes('hair') || c.includes('shampoo'));
  const isMakeup = categories.some((c) => c.includes('lipstick') || c.includes('eyeliner') || c.includes('palette') || c.includes('foundation') || c.includes('makeup'));

  if (isPerfume) {
    return {
      theme: "A premium, ultra-luxury aromatic fragrance boutique setting. The products are arranged on a stepped, polished dark Nero Marquina marble slab with thin, sharp gold veins and a brushed brass rim. The backdrop is a dramatic, out-of-focus background of dark mahogany wood panels and glowing warm amber backlighting. Moody, expensive, high-contrast chiaroscuro studio lighting with elegant volumetric light rays and crisp contact shadows.",
      composition: "Arrange the fragrance bottles standing side-by-side with clear, non-overlapping spacing. Warm, cinematic backlight shining through the bottles to create refraction highlights and soft golden shadows."
    };
  } else if (isHaircare) {
    return {
      theme: "A serene, natural spa-inspired haircare scene. The products stand atop organic, rough-edged beige sandstone blocks and raw travertine stone pedestals of slightly staggered heights. The background is a warm-toned, textured plaster wall with soft, realistic shadows of eucalyptus branches and monstera leaves cast by gentle morning sunlight filtering through a window. Natural, bright, diffused lighting with soft ambient occlusion shadows.",
      composition: "Arranged side-by-side on sandstone pedestals of varying heights, forming an elegant, staggered horizontal line with zero overlapping. Natural morning light casting soft, realistic shadows."
    };
  } else if (isSkincare) {
    return {
      theme: "An ultra-clean, clinical luxury skincare sanctuary. The products are placed on sleek, smooth off-white cream travertine stone pedestals. The background is a soft, warm cream matte wall with elegant water rippling reflections and caustic light patterns cast onto the surface. Transparent glass plates, micro water droplets on the surface, and subtle round acrylic blocks are arranged around the products to convey deep hydration, purity, and scientific luxury. Bright, clinical studio lighting with soft, clean reflections.",
      composition: "Arranged side-by-side on travertine pedestals with clean horizontal baseline alignment and no overlapping. Bright, diffused studio light with gentle fill shadows reflecting hydration."
    };
  } else if (isMakeup) {
    return {
      theme: "A chic, high-fashion luxury cosmetics vanity stage. The products are arranged on a minimalist matte black steel display platform with brushed rose-gold metallic accents. The background is a textured, soft dusty rose and nude pink clay plaster wall. Professional studio ring-light illumination casts clean, circular highlights on the product containers, with sharp, fashion-forward shadows and specular reflections on the packaging.",
      composition: "Perfectly arranged horizontally with distinct spacing, no overlapping. Highlights and specular reflections on packaging materials are crisp and bright, lit by premium studio ring light."
    };
  } else {
    return {
      theme: "A high-end modern minimalist e-commerce presentation stage. The products are placed on sleek geometric concrete and matte ceramic pedestals in soft neutral beige and warm gray tones. The background is a clean, abstract architectural wall with dramatic diagonal geometric shadows cast by an unseen window frame. Balanced, high-end commercial studio lighting.",
      composition: "Staggered horizontally side-by-side with clear gaps, no overlapping. Aligned and harmonized under balanced studio lighting."
    };
  }
}

function generateCreativePrompt(
  products: Array<{ name: string; analysis: ProductAnalysis; imageIndex: number }>,
  options: BundlingPromptOptions = {}
): string {
  if (!products.length) return '';

  const anchorProduct = [...products].reduce((max, p) =>
    p.analysis.dimensions_cm.height > max.analysis.dimensions_cm.height ? p : max
  , products[0]);
  const anchorIndex = products.indexOf(anchorProduct);
  const anchorLetter = String.fromCharCode(65 + anchorIndex);

  const scaleLogicLines = products.map((p, i) => {
    const letter = String.fromCharCode(65 + i);
    if (p === anchorProduct) {
      return `[Product ${letter}/Largest: ${p.name}] acts as the anchor for scale.`;
    }
    const hPct = Math.round((p.analysis.dimensions_cm.height / anchorProduct.analysis.dimensions_cm.height) * 100);
    const wPct = Math.round((p.analysis.dimensions_cm.width / anchorProduct.analysis.dimensions_cm.width) * 100);
    
    const isShorter = p.analysis.dimensions_cm.height < anchorProduct.analysis.dimensions_cm.height;
    const isTaller = p.analysis.dimensions_cm.height > anchorProduct.analysis.dimensions_cm.height;
    const isThinner = p.analysis.dimensions_cm.width < anchorProduct.analysis.dimensions_cm.width;
    const isWider = p.analysis.dimensions_cm.width > anchorProduct.analysis.dimensions_cm.width;
    
    let note = '';
    if (isShorter && isThinner) {
      note = ` It is a slim item, significantly shorter and thinner than [Product ${anchorLetter}/Largest].`;
    } else if (isShorter && isWider) {
      note = ` It is a wide, tub-like container, much shorter but wider than [Product ${anchorLetter}/Largest].`;
    } else if (isTaller && isThinner) {
      note = ` It is a tall, slender item, taller but thinner than [Product ${anchorLetter}/Largest].`;
    } else if (isTaller && isWider) {
      note = ` It is a larger item, both taller and wider than [Product ${anchorLetter}/Largest].`;
    } else if (isShorter) {
      note = ` It is a shorter item compared to [Product ${anchorLetter}/Largest].`;
    } else if (isTaller) {
      note = ` It is a taller item compared to [Product ${anchorLetter}/Largest].`;
    } else if (isThinner) {
      note = ` It is a thinner/slimmer item compared to [Product ${anchorLetter}/Largest].`;
    } else if (isWider) {
      note = ` It is a wider item compared to [Product ${anchorLetter}/Largest].`;
    }
    return `[Product ${letter}: ${p.name}] is exactly ${hPct}% the height and ${wPct}% the width of [Product ${anchorLetter}/Largest].${note}`;
  });

  const identityLines = products.map((p, i) => {
    const letter = String.fromCharCode(65 + i);
    return `[Product ${letter}]: ${p.analysis.visual_description}`;
  });

  const { theme, composition } = getCreativeThemeAndBackground(products);

  return `Creative high-end e-commerce product photography of ${products.length} products from image references, themed as a: ${theme}

PROPORTIONAL SCALE LOGIC: Execute strict size ratio analysis between all referenced items.
${scaleLogicLines.join('\n')}

COMPOSITION: ${composition} Maintain consistent texture and label clarity across all ${products.length} items. Photorealistic, 8k resolution, commercial aesthetic.

IDENTITY PRESERVATION:
${identityLines.join('\n')}
Not a single letter, logo, shape, color tone, or brand element must change.`;
}

function generateLifestylePrompt(
  products: Array<{ name: string; analysis: ProductAnalysis; imageIndex: number }>,
  options: BundlingPromptOptions = {}
): string {
  if (!products.length) return '';

  const anchorProduct = [...products].reduce((max, p) =>
    p.analysis.dimensions_cm.height > max.analysis.dimensions_cm.height ? p : max
  , products[0]);
  const anchorIndex = products.indexOf(anchorProduct);
  const anchorLetter = String.fromCharCode(65 + anchorIndex);

  const scaleLogicLines = products.map((p, i) => {
    const letter = String.fromCharCode(65 + i);
    if (p === anchorProduct) {
      return `[Product ${letter}/Largest: ${p.name}] acts as the anchor for scale.`;
    }
    const hPct = Math.round((p.analysis.dimensions_cm.height / anchorProduct.analysis.dimensions_cm.height) * 100);
    const wPct = Math.round((p.analysis.dimensions_cm.width / anchorProduct.analysis.dimensions_cm.width) * 100);
    
    const isShorter = p.analysis.dimensions_cm.height < anchorProduct.analysis.dimensions_cm.height;
    const isTaller = p.analysis.dimensions_cm.height > anchorProduct.analysis.dimensions_cm.height;
    const isThinner = p.analysis.dimensions_cm.width < anchorProduct.analysis.dimensions_cm.width;
    const isWider = p.analysis.dimensions_cm.width > anchorProduct.analysis.dimensions_cm.width;
    
    let note = '';
    if (isShorter && isThinner) {
      note = ` It is a slim item, significantly shorter and thinner than [Product ${anchorLetter}/Largest].`;
    } else if (isShorter && isWider) {
      note = ` It is a wide, tub-like container, much shorter but wider than [Product ${anchorLetter}/Largest].`;
    } else if (isTaller && isThinner) {
      note = ` It is a tall, slender item, taller but thinner than [Product ${anchorLetter}/Largest].`;
    } else if (isTaller && isWider) {
      note = ` It is a larger item, both taller and wider than [Product ${anchorLetter}/Largest].`;
    } else if (isShorter) {
      note = ` It is a shorter item compared to [Product ${anchorLetter}/Largest].`;
    } else if (isTaller) {
      note = ` It is a taller item compared to [Product ${anchorLetter}/Largest].`;
    } else if (isThinner) {
      note = ` It is a thinner/slimmer item compared to [Product ${anchorLetter}/Largest].`;
    } else if (isWider) {
      note = ` It is a wider item compared to [Product ${anchorLetter}/Largest].`;
    }
    return `[Product ${letter}: ${p.name}] is exactly ${hPct}% the height and ${wPct}% the width of [Product ${anchorLetter}/Largest].${note}`;
  });

  const identityLines = products.map((p, i) => {
    const letter = String.fromCharCode(65 + i);
    return `[Product ${letter}]: ${p.analysis.visual_description}`;
  });

  return `Professional e-commerce bundle photography of ${products.length} products from image references, arranged in a balanced lifestyle composition.

PROPORTIONAL SCALE LOGIC: Execute strict size ratio analysis between all referenced items.
${scaleLogicLines.join('\n')}

COMPOSITION: High-end studio lighting, clean minimal background, realistic shadows that define the physical contact between products of different volumes. Maintain consistent texture and label clarity across all ${products.length} items. Photorealistic, 8k resolution, commercial aesthetic.

IDENTITY PRESERVATION:
${identityLines.join('\n')}
Not a single letter, logo, shape, color tone, or brand element must change.`;
}

function generateStrictStudioPrompt(
  products: Array<{ name: string; analysis: ProductAnalysis; imageIndex: number }>,
  options: BundlingPromptOptions = {}
): string {
  if (!products.length) return '';

  const productSpecs = products.map((p, i) => {
    const effect = getFinishingEffect(p.analysis.category);
    const d = p.analysis.dimensions_cm;

    return `Product ${i + 1} — "${p.name}" (from Image ${p.imageIndex}):
- Category: ${p.analysis.category}
- Real-world dimensions: H=${d.height}cm × W=${d.width}cm × D=${d.depth}cm
- Layout constraint: Keep the exact shape, height, width, rotation, and custom coordinates/position exactly as arranged in the composite Image 1. Do NOT move, resize, swap, or rearrange any products.
- Visual description: ${p.analysis.visual_description}
- Finishing effect: ${effect === 'reflection' ? 'mirror REFLECTION (semi-transparent, fading vertically)' : 'soft DROP SHADOW (below product, soft-edge)'}
- Confidence: ${p.analysis.confidence}`;
  }).join('\n');

  const allEffects = products.map((p) => getFinishingEffect(p.analysis.category));
  const hasReflection = allEffects.includes('reflection');
  const hasShadow = allEffects.includes('shadow');

  const finishingNote = hasReflection && hasShadow
    ? 'Apply mirror REFLECTION to cosmetics/skincare/haircare products; apply soft DROP SHADOW to fragrances.'
    : hasReflection
    ? 'Apply mirror REFLECTION beneath all products (semi-transparent, gradually fading downward over ~30% of product height).'
    : 'Apply soft DROP SHADOW beneath all products (diffused, offset slightly down-right).';

  const mappingRules = products.map((p, i) => {
    const verb = i === 0 ? 'sized' : 'resized';
    return `The product at coordinates defined in Image 1 for Product ${i + 1} must look EXACTLY like Image ${p.imageIndex} (Product ${i + 1} high-res), just cropped and ${verb}.`;
  }).join(' ');

  return `IMAGE EDITING TASK: PHOTOREALISTIC PIXEL-PERFECT PRODUCT COMPOSITE (CLIPPING MASK)
This is a STRICT "Cut and Paste" Clipping Mask and Collage Task. Do NOT generate new products. Do NOT re-imagine, redraw, or hallucinate any item. You must keep the exact shapes, sizes, rotations, baselines, and layouts of the products from Image 1. 

Do NOT apply any creative lighting, shadows, or re-render the surface of the products. You must take the exact pixels of the original products from Image 2, Image 3, etc. and map them onto the layout in Image 1.

═══════════════════════════════════════════════════════
CANVAS & LAYOUT SPECIFICATIONS
═══════════════════════════════════════════════════════
• Output size: 1200 × 1200 pixels (square 1:1)
• Background: Pure solid white, hex #ffffff — no gradients, no textures, no props
• Reference Layout: Image 1 is the composite canvas arranged by the user. The final output MUST maintain the exact layout, sizes, proportions, shapes, baseline heights, rotations, and coordinates of the products exactly as arranged in Image 1.
• No Overlapping: Products must be arranged side-by-side with clear, distinct spacing. They must NOT overlap, touch, block, or obstruct one another. If products are placed overlapping on the canvas, resolve the overlap in the generated output by placing them side-by-side.
• Flat Coplanar Depth: All products must reside on the exact same depth plane in 3D space. Do not push any product backward or forward (no 3D depth offset).
• Perfectly Aligned Baselines: The bottom contact edge of every product must align to the exact same horizontal baseline level. No product should appear higher, lower, or floating compared to others. All products must stand perfectly level on the white floor.
• Neat Studio Arrangement: The products are arranged horizontally, side-by-side in a neat row. Ensure the baseline contact with the white floor is perfectly clean, flat, and sharp, exactly reflecting the arrangement shown in Image 1.
• Safe zone: ALL product elements must stay between Y=100px (top margin) and Y=1100px (bottom baseline)
═══════════════════════════════════════════════════════
PRODUCT ARRANGEMENT & SIZING (${products.length} items)
═══════════════════════════════════════════════════════
${productSpecs}
═══════════════════════════════════════════════════════
FINISHING EFFECTS
═══════════════════════════════════════════════════════
${finishingNote}
═══════════════════════════════════════════════════════
CRITICAL IDENTITY PRESERVATION — ZERO TOLERANCE FOR HALLUCINATION
═══════════════════════════════════════════════════════
You must act as a Photoshop expert executing a clipping mask and collage. Each product must be VISUALLY IDENTICAL to its high-resolution reference image:
1. TEXT & LOGOS: Preserve every letter and word exactly. Do not misspell, mutate, or blur text. Retrieve exact typography, numbers, volume measurements (e.g. "200ml", "50ml", "1.69 FL.OZ"), and brand labels from the high-res original reference images (Image 2, Image 3, etc.). Do not hallucinate or alter any lettering. NOT A SINGLE letter, logo, shape, color tone, or brand element must change. For example, do not change "fl. oz" to "flog", do not change "ACIDES" to "ABIDES", and do not change "3 MONATEN" to "2 MONNTEN". All Arabic script and foreign typography must be copied character-for-character with 100% precision.
2. FINE GRAPHIC DETAILS: Keep all internal elements exactly as photographed. The internal packaging elements must match the reference image exactly.
3. COLOR: Keep the exact color and hue of the reference.
4. SHAPE & TEXTURE: Keep the exact bottle/tube/package shape and material reflection (glass, matte, etc.).
5. ONLY permitted changes: placing them on the white canvas according to the exact layout, rotations, and coordinates of Image 1. ${mappingRules} (Apply this rule to all provided images.)`;
}

// ============================================================
// Helpers
// ============================================================

/** Generate a human-readable session name from current timestamp */
export function generateSessionName(productNames: string[]): string {
  const date = new Date();
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const names = productNames.filter(Boolean).slice(0, 2).join(' + ');
  return names ? `${names} — ${dateStr} ${timeStr}` : `Bundle ${dateStr} ${timeStr}`;
}

/** Check if any product analysis has Low confidence */
export function hasLowConfidence(products: ProductAnalysis[]): boolean {
  return products.some((p) => p.confidence === 'Low');
}

/** Confidence badge color */
export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'High': return 'text-accent-green border-accent-green/30 bg-accent-green/10';
    case 'Medium': return 'text-accent-gold border-accent-gold/30 bg-accent-gold/10';
    case 'Low': return 'text-accent-red border-accent-red/30 bg-accent-red/10';
    default: return 'text-text-muted border-border bg-bg-secondary';
  }
}

/** Convert a File to base64 string for API calls */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (data:image/jpeg;base64,)
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
