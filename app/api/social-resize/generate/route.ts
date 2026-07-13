import { NextResponse, NextRequest } from 'next/server';
import { generateImageI2I, uploadResource } from '@/lib/runninghub';
import { mapToAllowedRatio } from '@/lib/social-resize/presets';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import sharp from 'sharp';

function getCustomDimensions(width: number, height: number): { w: number, h: number } {
  const MIN_SIZE = 256;
  const MAX_SIZE = 1536;

  let w = width;
  let h = height;

  if (w > MAX_SIZE || h > MAX_SIZE) {
    const scale = MAX_SIZE / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  if (w < MIN_SIZE && h < MIN_SIZE) {
    const scale = MIN_SIZE / Math.min(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

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

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    // Resolve aspect ratio
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

    // Dynamic prompt
    let prompt = body.prompt;
    if (!prompt) {
      if (model === 'flux-2-edit') {
        prompt = `Please fill in the black area, seamlessly extend the background, match style and colors. è¯·è¡¥å…¨é»‘è‰²åŒºåŸŸï¼Œæ— ç¼å»¶ä¼¸èƒŒæ™¯ï¼ŒåŒ¹é…é£Žæ ¼å’Œé¢œè‰²ã€‚`;
      } else {
        prompt = `Extrapolate and fill the background of this image to a ${rhAspectRatio} aspect ratio. Maintain the subject, style, and lighting of the original. Keep the subject centered, seamlessly extend background areas that are cropped or missing. High resolution, seamless, photorealistic extension.`;
      }
    }

    const initialNodeInfoList = [
      { nodeId: 'INPUT', fieldName: 'aspectRatio', fieldValue: aspectRatio || '1:1' },
      { nodeId: 'INPUT', fieldName: 'model', fieldValue: model },
      { nodeId: 'INPUT', fieldName: 'resolution', fieldValue: resolution }
    ];

    // Register task in Supabase as RUNNING immediately
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

    // Pre-padding for flux-2-edit (must run before RunningHub call)
    let finalImageUrl = imageUrl;

    if (model === 'flux-2-edit' && customWidth && customHight) {
      console.log(`[Social Resize] Pre-padding input image to custom dimensions ${customWidth}x${customHight}...`);
      try {
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) throw new Error(`Failed to fetch input image: ${imageRes.statusText}`);
        const inputBuffer = Buffer.from(await imageRes.arrayBuffer());

        const sourceMeta = await sharp(inputBuffer).metadata();
        const srcW = sourceMeta.width ?? customWidth;
        const srcH = sourceMeta.height ?? customHight;

        const scale = Math.min(customWidth / srcW, customHight / srcH);
        const scaledW = Math.round(srcW * scale);
        const scaledH = Math.round(srcH * scale);
        const offsetX = Math.round((customWidth - scaledW) / 2);
        const offsetY = Math.round((customHight - scaledH) / 2);

        const resizedInput = await sharp(inputBuffer)
          .resize(scaledW, scaledH, { fit: 'fill' })
          .toFormat('png')
          .toBuffer();

        const paddedBuffer = await sharp({
          create: { width: customWidth, height: customHight, channels: 3, background: { r: 0, g: 0, b: 0 } },
        })
          .composite([{ input: resizedInput, left: offsetX, top: offsetY }])
          .png()
          .toBuffer();

        const uploadResult = await uploadResource(paddedBuffer, 'padded_input.png', 'image/png');
        if (uploadResult.code === 0 && uploadResult.data?.download_url) {
          finalImageUrl = uploadResult.data.download_url;
          console.log(`[Social Resize] âœ“ Padded image uploaded: ${finalImageUrl.substring(0, 80)}...`);
        } else {
          console.error('[Social Resize] Padding upload failed, using original:', uploadResult.message);
        }
      } catch (err: any) {
        console.error('[Social Resize] Pre-padding failed, fallback to original:', err.message);
      }
    }

    // Build webhook URL â€” RunningHub will POST here when task completes
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const webhookSecret = process.env.WEBHOOK_SECRET || '';
    const webhookUrl = appBaseUrl && webhookSecret
      ? `${appBaseUrl}/api/webhook/runninghub?secret=${webhookSecret}`
      : undefined;

    if (webhookUrl) {
      console.log(`[Social Resize] Webhook registered: ${appBaseUrl}/api/webhook/runninghub`);
    } else {
      console.warn('[Social Resize] No NEXT_PUBLIC_APP_URL or WEBHOOK_SECRET set â€” webhook disabled');
    }

    if (model === 'flux-2-edit') {
      console.log(`[Social Resize] Target: ${aspectRatio} -> Custom: ${customWidth}x${customHight}`);
    } else {
      console.log(`[Social Resize] Target: ${aspectRatio} -> Mapped: ${rhAspectRatio}`);
    }

    // â”€â”€ Submit to RunningHub (fire-and-forget) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      webhookUrl,
    }, 'enterprise');

    console.log(`[Social Resize] Submitted: taskId=${result.taskId} status=${result.status}`);

    if (result.status === 'FAILED') {
      throw new Error(result.errorMessage || 'Generation failed on submission');
    }

    if (!result.taskId) {
      const apiError = (result as any).errorMessage || (result as any).message || 'Unknown API error';
      throw new Error(`RunningHub API Error: ${apiError}`);
    }

    // Update runninghub_task_id in DB
    await supabaseAdmin.from('tasks').update({
      runninghub_task_id: result.taskId,
    }).eq('id', localTaskId);

    // Handle rare case: RunningHub returns SUCCESS synchronously
    if (result.status === 'SUCCESS' && result.results && result.results.length > 0) {
      const outputUrl = (result.results[0] as any)?.url || result.results[0];
      await supabaseAdmin.from('tasks').update({
        status: 'SUCCESS',
        outputs: [{ fileUrl: outputUrl, fileType: 'png' }],
      }).eq('id', localTaskId);

      return NextResponse.json({
        localTaskId,
        taskId: result.taskId,
        status: 'SUCCESS',
        imageUrl: outputUrl,
        width: customWidth,
        height: customHight,
      });
    }

    // â”€â”€ Return immediately â€” webhook will update DB when done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return NextResponse.json({
      localTaskId,
      taskId: result.taskId,
      status: 'RUNNING',
      width: customWidth,
      height: customHight,
    });

  } catch (err: any) {
    console.error('[Social Resize Error]:', err.message || err);

    try {
      await supabaseAdmin.from('tasks').update({
        status: 'FAILED',
        error_message: err.message || 'Image generation failed',
      }).eq('id', localTaskId);
    } catch (dbErr) {
      console.error('[Social Resize DB Error]:', dbErr);
    }

    return NextResponse.json(
      { error: err.message || 'Image generation failed' },
      { status: 500 }
    );
  }
}
