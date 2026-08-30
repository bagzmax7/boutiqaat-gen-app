import { NextResponse, NextRequest } from 'next/server';
import { generateImageI2I, queryTask } from '@/lib/runninghub';
import { mapToAllowedRatio } from '@/lib/social-resize/presets';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60; // 60 * 2s = 120 seconds

/**
 * RunningHub Flux 2 Klein (/rhart-image/f-2-klein-9b/edit) custom dimension constraints:
 * - customWidth: strictly 256 to 1536
 * - customHight: strictly 256 to 1536
 * - aspectRatio: 'custom'
 * - outputFormat: 'png' | 'jpeg' | 'webp(lossless)' | 'webp(lossy)'
 */
/**
 * RunningHub Flux 2 Klein (/rhart-image/f-2-klein-9b/edit) custom dimension constraints:
 * - Scales target dimensions 1.5x for superior detail
 * - customWidth: strictly 256 to 1536 (multiples of 16)
 * - customHight: strictly 256 to 1536 (multiples of 16)
 * - aspectRatio: 'custom'
 * - outputFormat: 'png'
 */
function getCustomDimensions(width: number, height: number): { w: number, h: number } {
  const MIN_SIDE = 256;  // Strict minimum required by RunningHub API
  const MAX_SIDE = 1536; // Strict maximum required by RunningHub API
  const SCALE_FACTOR = 1.5;

  const ratio = width / height;
  let w = Math.round(width * SCALE_FACTOR);
  let h = Math.round(height * SCALE_FACTOR);

  // Preserve aspect ratio if scaled dimension falls below minimum
  if (h < MIN_SIDE) {
    h = MIN_SIDE;
    w = Math.round(h * ratio);
  }
  if (w < MIN_SIDE) {
    w = MIN_SIDE;
    h = Math.round(w / ratio);
  }

  // Preserve aspect ratio if scaled dimension exceeds maximum
  if (w > MAX_SIDE) {
    w = MAX_SIDE;
    h = Math.round(w / ratio);
  }
  if (h > MAX_SIDE) {
    h = MAX_SIDE;
    w = Math.round(h * ratio);
  }

  // Snap to multiples of 16 for clean neural network diffusion processing
  w = Math.floor(w / 16) * 16;
  h = Math.floor(h / 16) * 16;

  // Strict boundary clamp
  w = Math.max(MIN_SIDE, Math.min(MAX_SIDE, w));
  h = Math.max(MIN_SIDE, Math.min(MAX_SIDE, h));

  return { w, h };
}

/**
 * RunningHub SeeDream V5 Pro (/seedream-v5-pro/image-to-image) dimensions:
 * - Scales target dimensions 1.5x for superior resolution
 * - width & height range: 256 - 8192 (minimum 256)
 */
function getSeedreamDimensions(width: number, height: number): { w: number, h: number } {
  const MIN_SIDE = 256;  // Minimum 256 for clean processing
  const MAX_SIDE = 8192; // Maximum required by RunningHub API
  const SCALE_FACTOR = 1.5;

  const ratio = width / height;
  let w = Math.round(width * SCALE_FACTOR);
  let h = Math.round(height * SCALE_FACTOR);

  // Preserve aspect ratio if scaled dimension falls below minimum 256
  if (h < MIN_SIDE) {
    h = MIN_SIDE;
    w = Math.round(h * ratio);
  }
  if (w < MIN_SIDE) {
    w = MIN_SIDE;
    h = Math.round(w / ratio);
  }

  // Preserve aspect ratio if scaled dimension exceeds maximum
  if (w > MAX_SIDE) {
    w = MAX_SIDE;
    h = Math.round(w / ratio);
  }
  if (h > MAX_SIDE) {
    h = MAX_SIDE;
    w = Math.round(h * ratio);
  }

  // Snap to multiples of 16 for clean neural network diffusion processing
  w = Math.floor(w / 16) * 16;
  h = Math.floor(h / 16) * 16;

  w = Math.max(MIN_SIDE, Math.min(MAX_SIDE, w));
  h = Math.max(MIN_SIDE, Math.min(MAX_SIDE, h));

  return { w, h };
}

/**
 * Universal & Highly Flexible Master Prompt Engine:
 * 100% Task-Agnostic — works seamlessly for products, fashion models, cosmetics, food,
 * electronics, graphic banners, typography, and any commercial creative asset.
 */
function buildMasterSystemPrompt(
  targetWidth: number,
  targetHeight: number,
  rhRatio: string,
  model: string,
  customPrompt?: string
): string {
  const ratio = targetWidth / targetHeight;
  const userInstruction = customPrompt?.trim();

  // 1. Reference & Goal
  const goal = `Use the uploaded Image 1 as the primary visual reference. Adapt and outpaint the scene into a clean commercial ${rhRatio} format (${targetWidth}x${targetHeight} px).`;

  // 2. Universal Fidelity Lock (Color, Texture, Subject, Typography)
  const fidelity = `Preserve the exact subjects, products, models, typography, text, branding, materials, and authentic details from Image 1 with 100% fidelity. Strictly preserve the original color palette, background hues, lighting style, and overall visual aesthetic of Image 1 without any color shifting.`;

  // 3. Dynamic Composition & Outpainting (Task-agnostic)
  let layout = '';
  if (ratio >= 2.0) {
    layout = `Keep the complete main visual composition from Image 1 centered and intact as a unified subject. Seamlessly outpaint and expand the background scenery, environment, and ambient lighting horizontally to the left and right to naturally fill the wide frame with balanced negative space.`;
  } else if (ratio <= 0.5) {
    layout = `Keep the complete main visual composition from Image 1 intact and well-proportioned. Seamlessly outpaint and extend the background scenery, environment, and lighting vertically upwards and downwards to naturally fill the tall vertical frame.`;
  } else {
    layout = `Keep the main visual composition from Image 1 intact and centered, seamlessly extending the surrounding background environment to naturally fit the ${rhRatio} canvas.`;
  }

  // 4. Custom Directive / Creative styling
  const customBlock = userInstruction
    ? `Creative directive: ${userInstruction}. Apply this directive while strictly preserving the authentic core elements and color fidelity of Image 1.`
    : `Seamlessly blend all expanded areas with the exact atmosphere, textures, and lighting of Image 1.`;

  // 5. Commercial Quality & Constraints
  const constraints = `Commercial advertising quality, 8K ultra-sharp details, high-end commercial retouching, no distortion, no borders or watermarks.`;

  // Language suffix for Chinese-trained models (Flux / SeeDream)
  const modelSuffix = (model === 'flux-2-edit' || model === 'seedream-v5-pro')
    ? ` 严格保持Image 1原图主体、背景颜色、产品外观及文字完全一致，无缝扩展画面。`
    : '';

  return `${goal}\n\n${fidelity}\n\n${layout}\n\n${customBlock}\n\n${constraints}${modelSuffix}`;
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const localTaskId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const body = await request.json();
    const {
      imageUrl,
      model = 'nano-banana-2',
      resolution = '1k',
      aspectRatio,
      customPrompt,
    } = body;

    let targetW = 1080;
    let targetH = 1080;
    let rhAspectRatio = '1:1';
    let customWidth: number | undefined;
    let customHight: number | undefined;
    let seedreamW: number | undefined;
    let seedreamH: number | undefined;

    if (aspectRatio) {
      const parts = aspectRatio.split(':');
      if (parts.length === 2) {
        const w = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
          targetW = w;
          targetH = h;
          rhAspectRatio = mapToAllowedRatio(w, h, model);
          if (model === 'flux-2-edit') {
            const dims = getCustomDimensions(w, h);
            customWidth = dims.w;
            customHight = dims.h;
          } else if (model === 'seedream-v5-pro') {
            const sDims = getSeedreamDimensions(w, h);
            seedreamW = sDims.w;
            seedreamH = sDims.h;
          }
        }
      }
    }

    // Dynamic, intelligent universal master prompt system
    const prompt = buildMasterSystemPrompt(
      targetW,
      targetH,
      rhAspectRatio,
      model,
      customPrompt || body.prompt
    );

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    // Register initial running task in DB
    const initialNodeInfoList = [
      { nodeId: 'INPUT', fieldName: 'aspectRatio', fieldValue: aspectRatio || '1:1' },
      { nodeId: 'INPUT', fieldName: 'model', fieldValue: model },
      { nodeId: 'INPUT', fieldName: 'resolution', fieldValue: resolution },
      { nodeId: 'INPUT', fieldName: 'prompt', fieldValue: prompt },
      ...(customPrompt ? [{ nodeId: 'INPUT', fieldName: 'customPrompt', fieldValue: customPrompt }] : [])
    ];

    await supabaseAdmin.from('tasks').insert({
      id: localTaskId,
      runninghub_task_id: '',
      user_id: session.userId,
      app_id: 'social-resize',
      app_name: 'Social Resize',
      status: 'RUNNING',
      api_key_type: 'enterprise',
      node_info_list: initialNodeInfoList,
      outputs: [],
    });

    // Directly use the uploaded Image 1 without server-side black canvas padding
    const finalImageUrl = imageUrl;

    console.log(`[Social Resize] Model: ${model} | Target: ${aspectRatio} (${targetW}x${targetH}) | RH Ratio: ${rhAspectRatio}`);
    console.log(`[Social Resize] Universal Master Prompt:\n${prompt}`);

    // ── Call RunningHub Standard I2I / Edit API ────────────────────────────────
    const result = await generateImageI2I({
      model,
      prompt,
      imageUrls: (model !== 'grok-image' && model !== 'flux-2-edit') ? [finalImageUrl] : undefined,
      imageUrl: (model === 'grok-image' || model === 'flux-2-edit') ? finalImageUrl : undefined,
      resolution,
      aspectRatio: rhAspectRatio,
      width: seedreamW,
      height: seedreamH,
      customWidth,
      customHight,
      outputFormat: 'png',
    }, 'enterprise');

    console.log(`[Social Resize] generateImageI2I submission result:`, JSON.stringify(result, null, 2));

    // Update runninghub_task_id in Supabase
    if (result.taskId) {
      await supabaseAdmin.from('tasks').update({
        runninghub_task_id: result.taskId
      }).eq('id', localTaskId);
    }

    // Handle immediate success (if synchronous)
    if (result.status === 'SUCCESS' && result.results && result.results.length > 0) {
      const outputUrl = (result.results[0] as any)?.url || result.results[0];
      console.log(`[Social Resize] Immediate success: ${outputUrl}`);
      
      await supabaseAdmin.from('tasks').update({
        status: 'SUCCESS',
        outputs: [{ fileUrl: outputUrl, fileType: 'png' }]
      }).eq('id', localTaskId);

      return NextResponse.json({ 
        imageUrl: outputUrl, 
        taskId: result.taskId,
        width: customWidth || seedreamW,
        height: customHight || seedreamH
      });
    }

    if (result.status === 'FAILED') {
      throw new Error(result.errorMessage || 'Generation failed on submission');
    }

    const taskId = result.taskId;
    if (!taskId) {
      const apiError = (result as any).errorMessage || (result as any).message || (result as any).error || 'Unknown error';
      throw new Error(`RunningHub API Error: ${apiError}`);
    }

    console.log(`[Social Resize] Task submitted: ${taskId}. Polling...`);

    // ── Poll for task completion ──────────────────────────────────────────────
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      let statusData;
      try {
        statusData = await queryTask(taskId, 'enterprise');
      } catch (pollErr) {
        console.warn(`[Social Resize Poll] Attempt ${i + 1} query error:`, pollErr);
        continue;
      }

      console.log(`[Social Resize Poll] Attempt ${i + 1}/${MAX_POLL_ATTEMPTS} — status: ${statusData.status}`);

      if (statusData.status === 'SUCCESS') {
        const outputUrl = statusData.results?.[0]?.url;
        if (!outputUrl) throw new Error('Task succeeded but no image URL in results');
        console.log(`[Social Resize] ✓ Generated successfully: ${outputUrl}`);

        const finalNodeInfoList = [
          ...initialNodeInfoList,
          { nodeId: 'USAGE', fieldName: 'usage', fieldValue: JSON.stringify(statusData.usage || {}) }
        ];

        await supabaseAdmin.from('tasks').update({
          status: 'SUCCESS',
          outputs: [{ fileUrl: outputUrl, fileType: 'png' }],
          node_info_list: finalNodeInfoList
        }).eq('id', localTaskId);

        return NextResponse.json({ 
          imageUrl: outputUrl, 
          taskId,
          width: customWidth || seedreamW,
          height: customHight || seedreamH
        });
      }

      if (statusData.status === 'FAILED' || statusData.status === 'CANCELED') {
        const errorMsg = statusData.errorMessage || JSON.stringify(statusData.failedReason || {});
        await supabaseAdmin.from('tasks').update({
          status: 'FAILED',
          error_message: errorMsg
        }).eq('id', localTaskId);

        throw new Error(`Generation failed: ${errorMsg}`);
      }
    }

    await supabaseAdmin.from('tasks').update({
      status: 'FAILED',
      error_message: 'Generation timed out after 2 minutes'
    }).eq('id', localTaskId);

    throw new Error('Generation timed out after 2 minutes');

  } catch (err: any) {
    console.error('[Social Resize Generate Error]:', err.message || err);
    
    try {
      await supabaseAdmin.from('tasks').update({
        status: 'FAILED',
        error_message: err.message || 'Image generation failed'
      }).eq('id', localTaskId);
    } catch (dbErr) {
      console.error('[Social Resize DB Update Error]:', dbErr);
    }

    return NextResponse.json(
      { error: err.message || 'Image generation failed' },
      { status: 500 }
    );
  }
}
