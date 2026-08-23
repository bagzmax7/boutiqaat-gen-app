import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { CanvasLayerItem } from '@/lib/types';
import { queryTaskOutputs } from '@/lib/runninghub';
import sharp from 'sharp';

export const maxDuration = 300; // 5 minutes for decomposition task

const BASE_URL = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.ai';
const API_KEY = process.env.RUNNINGHUB_API_KEY_ENTERPRISE || process.env.RUNNINGHUB_API_KEY_CONSUMER || process.env.RUNNINGHUB_API_KEY || '';

function cleanErrorMessage(raw: string): string {
  if (!raw) return 'Layer decomposition failed';
  let msg = raw;
  if (msg.includes('|')) {
    const parts = msg.split('|').map(s => s.trim());
    const englishPart = parts.find(p => /[a-zA-Z]/.test(p) && !/[\u4e00-\u9fa5]/.test(p));
    if (englishPart) return englishPart;
  }
  msg = msg.replace(/[\u4e00-\u9fa5]/g, '').trim();
  msg = msg.replace(/^[:\s|,-]+|[:\s|,-]+$/g, '').trim();
  return msg || 'Layer decomposition request was rejected by AI service.';
}

function extractRunningHubErrorMessage(data: any): string {
  if (data?.failedReason) {
    if (typeof data.failedReason === 'string') return cleanErrorMessage(data.failedReason);
    if (data.failedReason.text) return cleanErrorMessage(data.failedReason.text);
    if (data.failedReason.message) return cleanErrorMessage(data.failedReason.message);
    if (data.failedReason.error) return cleanErrorMessage(data.failedReason.error);
    if (data.failedReason.reason) return cleanErrorMessage(data.failedReason.reason);
    try {
      const s = JSON.stringify(data.failedReason);
      if (s !== '{}' && s !== 'null') return cleanErrorMessage(s);
    } catch {}
  }
  if (data?.errorMessage && data.errorMessage.trim() !== '') {
    return cleanErrorMessage(data.errorMessage);
  }
  if (data?.errorCode) {
    return `RunningHub API Error Code (${data.errorCode})`;
  }
  return 'Layer decomposition failed or was rejected by AI security audit.';
}

async function pollRunningHubTask(taskId: string, maxWaitMs = 240000): Promise<any> {
  const startTime = Date.now();
  console.log(`[Decompose API] Started polling task ${taskId}...`);

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 2500));
    
    let res;
    try {
      res = await fetch(`${BASE_URL}/openapi/v2/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ taskId }),
      });
    } catch (netErr) {
      console.warn(`[Decompose API] Network glitch while querying task ${taskId}, retrying...`);
      continue;
    }

    if (!res || !res.ok) {
      console.warn(`[Decompose API] HTTP query response not OK for task ${taskId}`);
      continue;
    }

    const data = await res.json();
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Decompose API] Task ${taskId} status: ${data.status} (elapsed: ${elapsedSec}s)`);

    if (data.status === 'SUCCESS') {
      return data;
    }

    if (data.status === 'FAILED' || data.status === 'CANCELED') {
      const errorReason = extractRunningHubErrorMessage(data);
      console.error(`[Decompose API] ❌ RunningHub returned FAILURE for task ${taskId}:`, {
        status: data.status,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        failedReason: data.failedReason,
        extractedReason: errorReason,
      });
      throw new Error(errorReason);
    }
  }
  throw new Error('Decomposition task timed out after 4 minutes');
}

// Multi-scale spatial matcher to locate layer in master canvas
async function detectLayerBoundingBox(
  layerBuffer: Buffer,
  masterRaw: { data: Buffer; info: { width: number; height: number } },
  canvasWidth: number,
  canvasHeight: number
): Promise<{ x: number; y: number; width: number; height: number }> {
  try {
    const meta = await sharp(layerBuffer).metadata();
    if (!meta.width || !meta.height) {
      return { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
    }

    const mW = masterRaw.info.width;
    const mH = masterRaw.info.height;
    const mData = masterRaw.data;

    let bestMatch = {
      scale: 1,
      x: Math.max(0, Math.round((canvasWidth - meta.width) / 2)),
      y: Math.max(0, Math.round((canvasHeight - meta.height) / 2)),
      width: meta.width,
      height: meta.height,
      diff: Infinity,
    };

    // Test scales from 0.15 to 1.05
    for (let scale = 0.15; scale <= 1.05; scale += 0.08) {
      const targetW = Math.max(16, Math.round(meta.width * scale));
      const targetH = Math.max(16, Math.round(meta.height * scale));
      if (targetW > mW || targetH > mH) continue;

      const scaledRaw = await sharp(layerBuffer)
        .resize(targetW, targetH)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const sData = scaledRaw.data;

      const samples: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
      const step = Math.max(1, Math.floor(Math.min(targetW, targetH) / 10));
      for (let y = 0; y < targetH; y += step) {
        for (let x = 0; x < targetW; x += step) {
          const idx = (y * targetW + x) * 4;
          if (sData[idx + 3] > 220) {
            samples.push({
              x, y,
              r: sData[idx],
              g: sData[idx + 1],
              b: sData[idx + 2]
            });
          }
        }
      }

      if (samples.length < 6) continue;

      const searchStep = 8;
      for (let candY = 0; candY <= mH - targetH; candY += searchStep) {
        for (let candX = 0; candX <= mW - targetW; candX += searchStep) {
          let diffSum = 0;
          for (let sIdx = 0; sIdx < samples.length; sIdx++) {
            const s = samples[sIdx];
            const mIdx = ((candY + s.y) * mW + (candX + s.x)) * 4;
            diffSum += Math.abs(s.r - mData[mIdx]) +
                       Math.abs(s.g - mData[mIdx + 1]) +
                       Math.abs(s.b - mData[mIdx + 2]);
          }
          const avg = diffSum / samples.length;
          if (avg < bestMatch.diff) {
            bestMatch = {
              scale,
              x: candX,
              y: candY,
              width: targetW,
              height: targetH,
              diff: avg,
            };
          }
        }
      }
    }

    if (bestMatch.diff < 120) {
      console.log(`[Auto-Align] Found match with diff ${bestMatch.diff}: x=${bestMatch.x}, y=${bestMatch.y}, w=${bestMatch.width}, h=${bestMatch.height}`);
      return {
        x: bestMatch.x,
        y: bestMatch.y,
        width: bestMatch.width,
        height: bestMatch.height,
      };
    }
  } catch (err) {
    console.warn('[Auto-Align Warning]:', err);
  }

  // Proportional scale fallback if element is larger than canvas
  return {
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
  };
}

export async function POST(req: NextRequest) {
  let dbTaskId: string | null = null;
  let runninghubTaskId: string | null = null;

  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl, prompt, resolution, outputFormat, projectId, canvas_width, canvas_height } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    // 1. Fetch input image and convert/normalize to pristine PNG Base64 Data URI
    console.log('[Decompose API] Fetching input image buffer from:', imageUrl.substring(0, 100));
    const imgFetchRes = await fetch(imageUrl);
    if (!imgFetchRes.ok) {
      throw new Error(`Failed to download master image (${imgFetchRes.status})`);
    }
    const rawImageBuffer = Buffer.from(await imgFetchRes.arrayBuffer());

    // Normalize image format using sharp
    const normalizedPngBuffer = await sharp(rawImageBuffer).png({ compressionLevel: 6 }).toBuffer();
    const normalizedMetadata = await sharp(normalizedPngBuffer).metadata();
    const b64DataUri = `data:image/png;base64,${normalizedPngBuffer.toString('base64')}`;

    console.log(`[Decompose API] Normalized image to PNG: ${normalizedMetadata.width}x${normalizedMetadata.height}, ${normalizedPngBuffer.length} bytes`);

    // Prepare raw master buffer for fast multi-scale alignment
    const masterRaw = await sharp(normalizedPngBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 2. Submit request to Seedream 5.0 Pro Layer Decomposition
    const payload: Record<string, any> = {
      imageUrl: b64DataUri,
      prompt: prompt ? String(prompt).trim() : null,
      resolution: resolution || 'auto',
      outputFormat: outputFormat || 'png',
    };

    console.log('[Decompose API] Submitting payload to dola-Seedream-5.0-pro/layer-decomposition with resolution:', payload.resolution);

    const submitRes = await fetch(`${BASE_URL}/openapi/v2/dola-Seedream-5.0-pro/layer-decomposition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      let errorMsg = `RunningHub API error: ${errText}`;
      try {
        const parsed = JSON.parse(errText);
        errorMsg = extractRunningHubErrorMessage(parsed) || errorMsg;
      } catch {}
      console.error('[Decompose API] Submit error:', errorMsg);
      return NextResponse.json({ error: cleanErrorMessage(errorMsg) }, { status: submitRes.status });
    }

    const submitData = await submitRes.json();
    const taskId = submitData.taskId;
    runninghubTaskId = taskId;

    if (!taskId) {
      const errorMsg = extractRunningHubErrorMessage(submitData) || 'Failed to obtain taskId from RunningHub';
      return NextResponse.json({ error: cleanErrorMessage(errorMsg) }, { status: 500 });
    }

    // 3. Immediately record RUNNING task in Supabase
    dbTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await supabaseAdmin.from('tasks').insert({
        id: dbTaskId,
        runninghub_task_id: taskId,
        user_id: session.userId,
        app_id: 'boutiqaat-layers',
        app_name: 'Boutiqaat Layers: Decomposition',
        status: 'RUNNING',
        api_key_type: 'enterprise',
        node_info_list: [
          { nodeId: 'INPUT', fieldName: 'prompt', fieldValue: prompt || 'Auto Decomposition' },
          { nodeId: 'CONFIG', fieldName: 'resolution', fieldValue: resolution || 'auto' },
        ],
        outputs: [],
        created_at: new Date().toISOString(),
      });
    } catch (insertErr) {
      console.warn('[Record initial task error]', insertErr);
    }

    // 4. Poll for completion
    const queryData = await pollRunningHubTask(taskId);
    const results = queryData.results || [];

    if (results.length === 0) {
      throw new Error('No output results returned from model');
    }

    // 5. Download, extract bounding boxes and process layers
    const pId = projectId || `proj_${Date.now()}`;
    const layers: CanvasLayerItem[] = [];

    let finalCanvasWidth = normalizedMetadata.width || Number(canvas_width) || 1200;
    let finalCanvasHeight = normalizedMetadata.height || Number(canvas_height) || 1200;

    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      const remoteUrl = item.url;
      let finalUrl = remoteUrl;
      let downloadedBuffer: Buffer | null = null;

      try {
        const imgRes = await fetch(remoteUrl);
        if (imgRes.ok) {
          downloadedBuffer = Buffer.from(await imgRes.arrayBuffer());
          const ext = item.outputType || (i === 0 ? 'jpg' : 'png');
          const filePath = `users/${session.userId}/projects/${pId}/layer_${i}_v1.${ext}`;
          
          const { error: upErr } = await supabaseAdmin.storage
            .from('layers_assets')
            .upload(filePath, downloadedBuffer, { contentType: i === 0 ? 'image/jpeg' : 'image/png', upsert: true });

          if (!upErr) {
            const { data: publicUrlData } = supabaseAdmin.storage
              .from('layers_assets')
              .getPublicUrl(filePath);
            finalUrl = publicUrlData.publicUrl;
          }
        }
      } catch (saveErr) {
        console.warn('[Storage backup warning]', saveErr);
      }

      const isBaseBg = i === 0;
      let box = {
        x: 0,
        y: 0,
        width: finalCanvasWidth,
        height: finalCanvasHeight,
      };

      if (isBaseBg) {
        // Layer 0 is full canvas background
        box = { x: 0, y: 0, width: finalCanvasWidth, height: finalCanvasHeight };
      } else if (downloadedBuffer) {
        // Run smart spatial bounding box detector to match original flat image position
        box = await detectLayerBoundingBox(downloadedBuffer, masterRaw, finalCanvasWidth, finalCanvasHeight);
      }

      layers.push({
        id: `layer_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: isBaseBg ? 'Background (Inpainted)' : `Layer ${i} (Segment)`,
        originalUrl: finalUrl,
        currentUrl: finalUrl,
        version: 1,
        zIndex: i,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1.0,
        visible: true,
        locked: isBaseBg,
        blendMode: 'normal',
        isBackground: isBaseBg,
        modelUsed: 'Boutiqaat Pro Layers',
        history: [{ url: finalUrl, version: 1, timestamp: Date.now(), model: 'Boutiqaat Pro Layers' }],
      });
    }

    // 6. Query precise billing cost from RunningHub /task/openapi/outputs
    let usageData: any = {
      consumeMoney: null,
      consumeCoins: null,
      taskCostTime: '0',
      thirdPartyConsumeMoney: null,
    };

    try {
      const outputsRes = await queryTaskOutputs(taskId, 'enterprise');
      if (outputsRes?.code === 0 && Array.isArray(outputsRes.data) && outputsRes.data.length > 0) {
        const first = outputsRes.data[0];
        usageData = {
          consumeMoney: first.consumeMoney !== undefined && first.consumeMoney !== null ? String(first.consumeMoney) : null,
          consumeCoins: first.consumeCoins !== undefined && first.consumeCoins !== null ? String(first.consumeCoins) : null,
          taskCostTime: first.taskCostTime !== undefined && first.taskCostTime !== null ? String(first.taskCostTime) : '0',
          thirdPartyConsumeMoney: first.thirdPartyConsumeMoney !== undefined && first.thirdPartyConsumeMoney !== null ? String(first.thirdPartyConsumeMoney) : null,
          taskName: first.taskName || 'Boutiqaat Layers: Decomposition',
        };
      }
    } catch (costErr) {
      console.warn('[Query billing cost warning]', costErr);
    }

    // 7. Update task in Supabase to SUCCESS with complete usage metrics
    if (dbTaskId) {
      try {
        await supabaseAdmin.from('tasks').update({
          status: 'SUCCESS',
          outputs: layers.map(l => ({ url: l.currentUrl, name: l.name })),
          node_info_list: [
            { nodeId: 'USAGE', fieldName: 'usage', fieldValue: JSON.stringify(usageData) },
            { nodeId: 'INPUT', fieldName: 'prompt', fieldValue: prompt || 'Auto Decomposition' },
            { nodeId: 'CONFIG', fieldName: 'resolution', fieldValue: resolution || 'auto' },
          ],
          updated_at: new Date().toISOString(),
        }).eq('id', dbTaskId);
      } catch (updateErr) {
        console.warn('[Update task SUCCESS warning]', updateErr);
      }
    }

    return NextResponse.json({
      success: true,
      taskId,
      layers,
      canvas_width: finalCanvasWidth,
      canvas_height: finalCanvasHeight,
      usage: usageData,
    });
  } catch (error: any) {
    console.error('[POST /api/layers/decompose error]', error);

    const cleanErr = cleanErrorMessage(error.message || 'Decomposition failed');

    if (dbTaskId) {
      try {
        await supabaseAdmin.from('tasks').update({
          status: 'FAILED',
          error_message: cleanErr,
          updated_at: new Date().toISOString(),
        }).eq('id', dbTaskId);
      } catch {}
    }

    return NextResponse.json({ error: cleanErr }, { status: 500 });
  }
}
