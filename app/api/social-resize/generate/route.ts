import { NextResponse, NextRequest } from 'next/server';
import { generateImageI2I, queryTask, uploadResource } from '@/lib/runninghub';
import { mapToAllowedRatio } from '@/lib/social-resize/presets';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import sharp from 'sharp';


const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60; // 60 * 2s = 120 seconds

function getCustomDimensions(width: number, height: number): { w: number, h: number } {
  const MIN_SIZE = 256;
  const MAX_SIZE = 1536;

  let w = width;
  let h = height;

  // Scale down if larger than MAX_SIZE
  if (w > MAX_SIZE || h > MAX_SIZE) {
    const scale = MAX_SIZE / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  // Scale up if smaller than MIN_SIZE
  if (w < MIN_SIZE && h < MIN_SIZE) {
    const scale = MIN_SIZE / Math.min(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  // Final clamp to ensure boundary limits
  w = Math.max(MIN_SIZE, Math.min(MAX_SIZE, w));
  h = Math.max(MIN_SIZE, Math.min(MAX_SIZE, h));

  return { w, h };
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
      model = 'nano-banana-pro',
      resolution = '1k',
      aspectRatio,
    } = body;

    // Resolve allowed aspect ratio for RunningHub (e.g. 1080:1350 -> 4:5)
    let rhAspectRatio = '1:1';
    let customWidth: number | undefined;
    let customHight: number | undefined;
    
    if (aspectRatio) {
      const parts = aspectRatio.split(':');
      if (parts.length === 2) {
        const w = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (!isNaN(w) && !isNaN(h)) {
          rhAspectRatio = mapToAllowedRatio(w, h);
          if (model === 'flux-2-edit') {
            const dims = getCustomDimensions(w, h);
            customWidth = dims.w;
            customHight = dims.h;
          }
        }
      }
    }

    // Dynamic, aspect-ratio-aware prompt
    let prompt = body.prompt;
    if (!prompt) {
      if (model === 'flux-2-edit') {
        prompt = `Please fill in the black area, seamlessly extend the background, match style and colors. 请补全黑色区域，无缝延伸背景，匹配风格和颜色。`;
      } else {
        prompt = `Extrapolate and fill the background of this image to a ${rhAspectRatio} aspect ratio. Maintain the subject, style, and lighting of the original. Keep the subject centered, seamlessly extend background areas that are cropped or missing. High resolution, seamless, photorealistic extension.`;
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    // Register initial running task in DB
    const initialNodeInfoList = [
      { nodeId: 'INPUT', fieldName: 'aspectRatio', fieldValue: aspectRatio || '1:1' },
      { nodeId: 'INPUT', fieldName: 'model', fieldValue: model },
      { nodeId: 'INPUT', fieldName: 'resolution', fieldValue: resolution }
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

    let finalImageUrl = imageUrl;

    if (model === 'flux-2-edit' && customWidth && customHight) {
      console.log(`[Social Resize] Pre-padding input image to custom dimensions ${customWidth}x${customHight} using solid black background...`);
      try {
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) throw new Error(`Failed to fetch input image for padding: ${imageRes.statusText}`);
        const inputBuffer = Buffer.from(await imageRes.arrayBuffer());

        // sharp handles ALL formats: WebP, AVIF, JPEG, PNG, TIFF, etc.
        const sourceMeta = await sharp(inputBuffer).metadata();
        const srcW = sourceMeta.width ?? customWidth;
        const srcH = sourceMeta.height ?? customHight;

        // Scale to fit inside target canvas, maintaining aspect ratio
        const scale = Math.min(customWidth / srcW, customHight / srcH);
        const scaledW = Math.round(srcW * scale);
        const scaledH = Math.round(srcH * scale);

        const offsetX = Math.round((customWidth - scaledW) / 2);
        const offsetY = Math.round((customHight - scaledH) / 2);

        // Resize the source and place it centered on a black canvas
        const resizedInput = await sharp(inputBuffer)
          .resize(scaledW, scaledH, { fit: 'fill' })
          .toFormat('png')
          .toBuffer();

        const paddedBuffer = await sharp({
          create: {
            width: customWidth,
            height: customHight,
            channels: 3,
            background: { r: 0, g: 0, b: 0 },
          },
        })
          .composite([{ input: resizedInput, left: offsetX, top: offsetY }])
          .png()
          .toBuffer();

        const uploadResult = await uploadResource(paddedBuffer, 'padded_input.png', 'image/png');
        if (uploadResult.code === 0 && uploadResult.data?.download_url) {
          finalImageUrl = uploadResult.data.download_url;
          console.log(`[Social Resize] ✓ Padded image uploaded:`, finalImageUrl.substring(0, 80) + '...');
        } else {
          console.error('[Social Resize] Padding upload failed, using original image:', uploadResult.message);
        }
      } catch (err: any) {
        console.error('[Social Resize] Pre-padding failed, falling back to original:', err.message);
      }
    }

    if (model === 'flux-2-edit') {
      console.log(`[Social Resize] Target ratio: ${aspectRatio} -> Custom dimensions: ${customWidth}x${customHight}`);
    } else {
      console.log(`[Social Resize] Target ratio: ${aspectRatio} -> Mapped allowed ratio: ${rhAspectRatio}`);
    }
    console.log(`[Social Resize] Calling RunningHub I2I API directly with URL:`, finalImageUrl.substring(0, 80) + '...');

    // ── Step 1: Call Standard Image API with the COS URL directly ────────────────
    const result = await generateImageI2I({
      model,
      prompt,
      imageUrls: (model !== 'grok-image' && model !== 'flux-2-edit') ? [finalImageUrl] : undefined,
      imageUrl: (model === 'grok-image' || model === 'flux-2-edit') ? finalImageUrl : undefined,
      resolution,
      aspectRatio: rhAspectRatio,
      customWidth,
      customHight,
      outputFormat: 'png',
    }, 'enterprise');

    console.log(`[Social Resize] generateImageI2I raw response:`, JSON.stringify(result, null, 2));

    // Update runninghub_task_id in Supabase
    if (result.taskId) {
      await supabaseAdmin.from('tasks').update({
        runninghub_task_id: result.taskId
      }).eq('id', localTaskId);
    }

    // Handle immediate success (some models may return synchronously)
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
        width: customWidth,
        height: customHight
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

    // ── Step 2: Poll using queryTask ──
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      let statusData;
      try {
        statusData = await queryTask(taskId, 'enterprise');
      } catch (pollErr) {
        console.warn(`[Social Resize Poll] Attempt ${i + 1} query failed:`, pollErr);
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
          width: customWidth,
          height: customHight
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
