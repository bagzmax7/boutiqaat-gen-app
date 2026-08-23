import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { CanvasLayerItem } from '@/lib/types';
import { queryTaskOutputs } from '@/lib/runninghub';

export const maxDuration = 300;

const BASE_URL = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.ai';
const API_KEY = process.env.RUNNINGHUB_API_KEY_ENTERPRISE || process.env.RUNNINGHUB_API_KEY_CONSUMER || process.env.RUNNINGHUB_API_KEY || '';

async function pollRunningHubTask(taskId: string, maxWaitMs = 180000): Promise<any> {
  const startTime = Date.now();
  console.log(`[ReCreate API] Started polling task ${taskId}...`);

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
      console.warn(`[ReCreate API] Network glitch while querying task ${taskId}, retrying...`);
      continue;
    }

    if (!res || !res.ok) {
      console.warn(`[ReCreate API] HTTP query response not OK for task ${taskId}`);
      continue;
    }

    const data = await res.json();
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`[ReCreate API] Task ${taskId} status: ${data.status} (elapsed: ${elapsedSec}s)`);

    if (data.status === 'SUCCESS') {
      return data;
    }

    if (data.status === 'FAILED' || data.status === 'CANCELED') {
      let reason = 'Re-Create task failed';
      if (data.failedReason) {
        if (typeof data.failedReason === 'string') reason = data.failedReason;
        else if (data.failedReason.text) reason = data.failedReason.text;
        else if (data.failedReason.message) reason = data.failedReason.message;
        else {
          try { reason = JSON.stringify(data.failedReason); } catch {}
        }
      } else if (data.errorMessage) {
        reason = data.errorMessage;
      }
      console.error(`[ReCreate API] ❌ RunningHub returned FAILURE for task ${taskId}:`, {
        status: data.status,
        reason,
        raw: data
      });
      throw new Error(reason);
    }
  }
  throw new Error('Re-Create task timed out after 3 minutes');
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
    const {
      layer,
      prompt,
      model = 'nano-banana-2',
      stylePreset,
      preserveShape = true,
      projectId,
      referenceImageUrl,
    } = body;

    if (!layer || !layer.currentUrl) {
      return NextResponse.json({ error: 'Layer with currentUrl is required' }, { status: 400 });
    }

    // 1. Construct high-fidelity prompt
    let masterPrompt = prompt || '';
    if (stylePreset && stylePreset !== 'none') {
      masterPrompt = `${masterPrompt}, style: ${stylePreset}`;
    }
    if (preserveShape) {
      masterPrompt = `${masterPrompt}, maintain precise object silhouette and boundaries, high fidelity commercial render 2K, ultra sharp`;
    }

    const payload: Record<string, any> = {
      prompt: masterPrompt,
      image_url: layer.currentUrl,
      aspect_ratio: 'auto',
      resolution: '2k',
      model_version: 'nano-banana-2',
    };

    if (referenceImageUrl) {
      payload.reference_image = referenceImageUrl;
    }

    console.log('[Re-Create API] Submitting payload to dola-banana-2/image-to-image:', payload);

    const submitRes = await fetch(`${BASE_URL}/openapi/v2/dola-banana-2/image-to-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      console.error('[Re-Create API] Submit error:', errText);
      return NextResponse.json({ error: `RunningHub API error: ${errText}` }, { status: submitRes.status });
    }

    const submitData = await submitRes.json();
    const taskId = submitData.taskId;
    runninghubTaskId = taskId;

    if (!taskId) {
      return NextResponse.json({ error: submitData.errorMessage || 'Failed to obtain taskId' }, { status: 500 });
    }

    // 2. Immediately record RUNNING task in Supabase
    dbTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await supabaseAdmin.from('tasks').insert({
        id: dbTaskId,
        runninghub_task_id: taskId,
        user_id: session.userId,
        app_id: 'boutiqaat-layers',
        app_name: `Boutiqaat Layers: Re-Create (${layer.name})`,
        status: 'RUNNING',
        api_key_type: 'enterprise',
        node_info_list: [
          { nodeId: 'INPUT', fieldName: 'prompt', fieldValue: masterPrompt },
          { nodeId: 'CONFIG', fieldName: 'model', fieldValue: model },
          { nodeId: 'CONFIG', fieldName: 'resolution', fieldValue: '2k' },
        ],
        outputs: [],
        created_at: new Date().toISOString(),
      });
    } catch (insertErr) {
      console.warn('[Record initial recreate task error]', insertErr);
    }

    // 3. Poll for completion
    const queryData = await pollRunningHubTask(taskId);
    const results = queryData.results || [];

    if (results.length === 0 || !results[0].url) {
      throw new Error('No image returned from 2K AI model');
    }

    const generatedUrl = results[0].url;
    let finalUrl = generatedUrl;
    const nextVersion = (layer.version || 1) + 1;
    const pId = projectId || `proj_${Date.now()}`;

    // 4. Save permanently to Supabase Storage
    try {
      const imgRes = await fetch(generatedUrl);
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const filePath = `users/${session.userId}/projects/${pId}/${layer.id}_v${nextVersion}.png`;

        const { error: upErr } = await supabaseAdmin.storage
          .from('layers_assets')
          .upload(filePath, buffer, { contentType: 'image/png', upsert: true });

        if (!upErr) {
          const { data: publicUrlData } = supabaseAdmin.storage
            .from('layers_assets')
            .getPublicUrl(filePath);
          finalUrl = publicUrlData.publicUrl;
        }
      }
    } catch (saveErr) {
      console.warn('[Re-Create Storage backup warning]', saveErr);
    }

    // 5. Query precise billing cost from RunningHub /task/openapi/outputs
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
          taskName: first.taskName || `Boutiqaat Layers: Re-Create (${layer.name})`,
        };
      }
    } catch (costErr) {
      console.warn('[Query recreate billing cost warning]', costErr);
    }

    // 6. Build updated layer with complete non-destructive history
    const history = Array.isArray(layer.history) ? [...layer.history] : [];
    history.push({
      url: finalUrl,
      version: nextVersion,
      timestamp: Date.now(),
      model: model === 'nano-banana-2' ? 'Nano Banana 2 (2K)' : model,
      prompt: masterPrompt,
    });

    const updatedLayer: CanvasLayerItem = {
      ...layer,
      currentUrl: finalUrl,
      version: nextVersion,
      modelUsed: 'Nano Banana 2 (2K)',
      history,
    };

    // 7. Update task in Supabase to SUCCESS with complete usage metrics
    if (dbTaskId) {
      try {
        await supabaseAdmin.from('tasks').update({
          status: 'SUCCESS',
          outputs: [{ url: finalUrl, name: layer.name, version: nextVersion }],
          node_info_list: [
            { nodeId: 'USAGE', fieldName: 'usage', fieldValue: JSON.stringify(usageData) },
            { nodeId: 'INPUT', fieldName: 'prompt', fieldValue: masterPrompt },
            { nodeId: 'CONFIG', fieldName: 'model', fieldValue: model },
            { nodeId: 'CONFIG', fieldName: 'resolution', fieldValue: '2k' },
          ],
          updated_at: new Date().toISOString(),
        }).eq('id', dbTaskId);
      } catch (updateErr) {
        console.warn('[Update recreate task SUCCESS warning]', updateErr);
      }
    }

    return NextResponse.json({
      success: true,
      taskId,
      updatedLayer,
      usage: usageData,
    });
  } catch (error: any) {
    console.error('[POST /api/layers/recreate error]', error);

    if (dbTaskId) {
      try {
        await supabaseAdmin.from('tasks').update({
          status: 'FAILED',
          error_message: error.message || 'Re-creation failed',
          updated_at: new Date().toISOString(),
        }).eq('id', dbTaskId);
      } catch {}
    }

    return NextResponse.json({ error: error.message || 'Re-creation failed' }, { status: 500 });
  }
}
