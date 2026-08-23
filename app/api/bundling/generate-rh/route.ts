import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { generateImageStandard, queryTask } from '@/lib/runninghub';

async function urlToBase64Uri(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export async function POST(req: NextRequest) {
  const auth = await validateAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { prompt, image_urls, genMode } = body as { prompt: string; image_urls: string[]; genMode?: 'Studio' | 'Aesthetic' | 'Creative' };

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }
    if (!image_urls || image_urls.length < 1) {
      return NextResponse.json({ error: 'At least 1 reference image required' }, { status: 400 });
    }

    // Fetch and encode all reference images as Base64 URIs
    console.log(`[generate-rh] Fetching ${image_urls.length} reference images...`);
    const imageDataUris = await Promise.all(image_urls.map(urlToBase64Uri));

    // Resolve genMode fallback if not passed directly
    const isJson = prompt.trim().startsWith('{') && prompt.trim().endsWith('}');
    const resolvedMode = genMode || (
      (prompt.includes('solid white') || (isJson && (prompt.includes('canvas_specifications') || prompt.includes('reflective_floor'))))
        ? 'Studio'
        : (prompt.includes('travertine') || prompt.includes('marble') ? 'Creative' : 'Aesthetic')
    );

    const reminderText = resolvedMode === 'Studio'
      ? 'This must be a 1200x1200px square composite image on a pure solid white background (#ffffff) with a clean reflective white floor. The products must stand perfectly straight and upright (0 degrees tilt) side-by-side in a neat horizontal row. Ensure perfect baseline alignment: the bottom contact edge of every product must align to the exact same horizontal baseline level on the floor (no floating or vertically offset products). Distribute the products with perfectly equal, uniform horizontal spacing (symmetrical gaps) between adjacent products. Do NOT mutate, alter, or smudge any brand names, logo scripts, or typographical characters on the packaging. The brand logo and text MUST remain perfectly readable and identical to the original references. Apply clean reflections (mirror reflection) or drop shadows according to product category guidelines. Photorealistic, ultra-HD quality.'
      : resolvedMode === 'Aesthetic'
      ? 'Render the products on a clean white (#ffffff) or soft white background, keeping their relative sizes, layouts, and orientations exactly as shown in the reference images. Do NOT mutate, hallucinate, or alter any brand texts, logos, or packaging designs. Place the products into a premium, clean aesthetic scene with realistic shadows/reflections.'
      : 'Render the products exactly as arranged in the composite Image 1, keeping their relative sizes, layouts, and orientations. Do NOT hallucinate, mutate, or change any brand text, logos, or packaging designs. Place the products into the dynamically themed, highly detailed background described in the prompt (e.g. sandstone pedestals, polished marble, custom lighting, shadows). Ensure the background matches the prompt description perfectly with rich textures, photorealistic depth, and realistic shadows/reflections.';

    let finalPrompt = prompt;
    if (isJson) {
      try {
        const parsed = JSON.parse(prompt);
        parsed.identity_preservation_reminders = reminderText;
        finalPrompt = JSON.stringify(parsed, null, 2);
      } catch (err) {
        console.warn('[generate-rh] Failed to parse JSON prompt, falling back to string concatenation:', err);
        finalPrompt = prompt + '\n\nREMINDER: ' + reminderText;
      }
    } else {
      finalPrompt = prompt + '\n\nREMINDER: ' + reminderText;
    }

    console.log(`[generate-rh] Calling RunningHub Image API...`);
    
    // Call RunningHub API
    const runRes = await generateImageStandard({
      imageUrls: imageDataUris,
      prompt: finalPrompt,
      resolution: '2k' // Or '1k' based on testing
    }, 'enterprise');

    if (!runRes.taskId) {
      throw new Error(`Task submission failed: ${runRes.errorMessage || 'No taskId returned'}`);
    }

    console.log(`[generate-rh] Task submitted: ${runRes.taskId}. Polling for completion...`);

    const dbTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { supabaseAdmin } = await import('@/lib/supabase');
    try {
      await supabaseAdmin.from('tasks').insert({
        id: dbTaskId,
        runninghub_task_id: runRes.taskId,
        user_id: auth.userId,
        app_id: 'bundling',
        app_name: `Bundling: ${resolvedMode}`,
        status: 'RUNNING',
        api_key_type: 'enterprise',
        node_info_list: [
          { nodeId: 'INPUT', fieldName: 'prompt', fieldValue: prompt },
          { nodeId: 'CONFIG', fieldName: 'genMode', fieldValue: resolvedMode },
        ],
        outputs: [],
        created_at: new Date().toISOString(),
      });
    } catch (insertErr) {
      console.warn('[generate-rh] Initial task insert warning:', insertErr);
    }

    // Poll for completion
    let maxRetries = 60; // 60 * 2s = 120 seconds
    while (maxRetries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2s
      const statusRes = await queryTask(runRes.taskId, 'enterprise');
      
      console.log(`[generate-rh] Task ${runRes.taskId} status: ${statusRes.status}`);
      
      if (statusRes.status === 'SUCCESS') {
        const imageUrl = statusRes.results?.[0]?.url;
        if (!imageUrl) throw new Error('Task succeeded but no image URL was found in results.');
        console.log(`[generate-rh] ✓ Generated successfully: ${imageUrl}`);

        // Update task with SUCCESS and billing usage
        try {
          await supabaseAdmin.from('tasks').update({
            status: 'SUCCESS',
            outputs: [{ url: imageUrl, name: `Bundling ${resolvedMode}` }],
            node_info_list: [
              { nodeId: 'USAGE', fieldName: 'usage', fieldValue: JSON.stringify(statusRes.usage || {}) },
              { nodeId: 'INPUT', fieldName: 'prompt', fieldValue: prompt },
              { nodeId: 'CONFIG', fieldName: 'genMode', fieldValue: resolvedMode },
            ],
            updated_at: new Date().toISOString(),
          }).eq('id', dbTaskId);
        } catch {}

        return NextResponse.json({ imageUrl });
      } else if (statusRes.status === 'FAILED' || statusRes.status === 'CANCELED') {
        try {
          await supabaseAdmin.from('tasks').update({
            status: 'FAILED',
            error_message: statusRes.errorMessage || 'Generation failed',
            updated_at: new Date().toISOString(),
          }).eq('id', dbTaskId);
        } catch {}

        throw new Error(`Generation failed: ${statusRes.errorMessage || JSON.stringify(statusRes.failedReason)}`);
      }
      
      maxRetries--;
    }

    throw new Error('Timeout waiting for image generation');
  } catch (err) {
    console.error('[generate-rh] Route error:', err);
    return NextResponse.json(
      { error: 'Generation failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
