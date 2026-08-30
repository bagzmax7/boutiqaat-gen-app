import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { generateImageI2I, queryTask } from '@/lib/runninghub';
import { AUTO_RETOUCH_MASTER_PROMPT } from '@/lib/retouch/master-prompt';
import { calculateFluxDimensions, matchClosestAspectRatio } from '@/lib/retouch/dimensions';
import { getRetouchProjectById, saveRetouchProject } from '@/lib/retouch/projects';
import { RetouchModelId, RetouchVersion } from '@/lib/retouch/types';
import { supabaseAdmin } from '@/lib/supabase';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60; // 60 * 2s = 120 seconds

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      projectId,
      itemId,
      itemName,
      originalUrl,
      width,
      height,
      model = 'flux-2-edit',
      isRegeneration = false,
    }: {
      projectId: string;
      itemId: string;
      itemName?: string;
      originalUrl: string;
      width?: number;
      height?: number;
      model?: RetouchModelId;
      isRegeneration?: boolean;
    } = body;

    if (!projectId || !itemId || !originalUrl) {
      return NextResponse.json({ error: 'projectId, itemId, and originalUrl are required' }, { status: 400 });
    }

    // 1. Fetch project
    const project = await getRetouchProjectById(projectId, session.userId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Find or create item in project
    let item = project.items.find(it => it.id === itemId);
    const imgWidth = width || item?.originalWidth || 1024;
    const imgHeight = height || item?.originalHeight || 1024;

    if (!item) {
      item = {
        id: itemId,
        name: itemName || `Retouch Item ${project.items.length + 1}`,
        originalUrl, // Stored ONCE
        originalWidth: imgWidth,
        originalHeight: imgHeight,
        detectedAspectRatio: matchClosestAspectRatio(imgWidth, imgHeight),
        versions: [],
        activeVersionIndex: 0,
        status: 'processing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      project.items.push(item);
    } else {
      item.status = 'processing';
      if (itemName) item.name = itemName;
      if (width) item.originalWidth = width;
      if (height) item.originalHeight = height;
      item.detectedAspectRatio = matchClosestAspectRatio(imgWidth, imgHeight);
    }

    const currentVersionNumber = item.versions.length + 1;
    const modelName = model === 'flux-2-edit' ? 'Boutiqaat Klein' : 'Boutiqaat Pro';

    // 3. Prepare Model-Specific Payload according to user specifications:
    // - Always uses AUTO_RETOUCH_MASTER_PROMPT
    // - For nano-banana-2: always 2K resolution, with closest matched aspectRatio
    // - For flux-2-edit: max 1536px scaled dimensions
    let runResult;
    let customDims: { customWidth: number; customHight: number } | undefined;
    let matchedRatio: string | undefined;

    if (model === 'flux-2-edit') {
      customDims = calculateFluxDimensions(imgWidth, imgHeight);
      console.log(`[Auto Retouch] Calling Boutiqaat Klein for item ${itemId} (Version v${currentVersionNumber}) with dims ${customDims.customWidth}x${customDims.customHight}`);

      runResult = await generateImageI2I({
        model: 'flux-2-edit',
        prompt: AUTO_RETOUCH_MASTER_PROMPT,
        imageUrl: originalUrl,
        customWidth: customDims.customWidth,
        customHight: customDims.customHight,
        outputFormat: 'png',
      }, 'enterprise');
    } else {
      matchedRatio = matchClosestAspectRatio(imgWidth, imgHeight);
      console.log(`[Auto Retouch] Calling Boutiqaat Pro for item ${itemId} (Version v${currentVersionNumber}) with 2K ratio ${matchedRatio}`);

      runResult = await generateImageI2I({
        model: 'nano-banana-2',
        prompt: AUTO_RETOUCH_MASTER_PROMPT,
        imageUrls: [originalUrl],
        aspectRatio: matchedRatio,
        resolution: '2k',
      }, 'enterprise');
    }

    if (!runResult || !runResult.taskId) {
      throw new Error(runResult?.errorMessage || 'Failed to trigger RunningHub retouch task');
    }

    const taskId = runResult.taskId;

    // 4. Create Version Record
    const newVersion: RetouchVersion = {
      versionNumber: currentVersionNumber,
      taskId,
      outputUrl: '',
      modelId: model,
      modelName,
      aspectRatio: matchedRatio,
      customDimensions: customDims,
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };

    item.versions.push(newVersion);
    item.activeVersionIndex = item.versions.length - 1; // Focus newly created version
    await saveRetouchProject(project);

    // 5. Record task in Supabase tasks table for admin logging/billing (without duplicate insert)
    try {
      await supabaseAdmin.from('tasks').insert({
        id: `retouch_task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        runninghub_task_id: taskId,
        user_id: session.userId,
        app_id: 'auto-retouch',
        app_name: `Auto Retouch: ${modelName} (v${currentVersionNumber})`,
        status: 'RUNNING',
        api_key_type: 'enterprise',
        node_info_list: [
          { nodeId: 'INPUT', fieldName: 'image', fieldValue: originalUrl },
          { nodeId: 'CONFIG', fieldName: 'model', fieldValue: model },
          { nodeId: 'CONFIG', fieldName: 'version', fieldValue: `v${currentVersionNumber}` },
          { nodeId: 'CONFIG', fieldName: 'project_id', fieldValue: projectId },
        ],
        outputs: [],
        created_at: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.warn('[Auto Retouch] Task db record warning:', dbErr);
    }

    // 6. Return response immediately or poll for completion
    return NextResponse.json({
      success: true,
      taskId,
      version: newVersion,
      item,
      project,
    });
  } catch (err: any) {
    console.error('[retouch/generate POST Error]:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
