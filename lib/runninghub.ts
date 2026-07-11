import {
  RunAppRequest,
  RunAppResponse,
  QueryResponse,
  UploadResponse,
} from './types';

// RunningHub OpenAPI v2
// Docs: https://www.runninghub.ai/runninghub-api-doc-en/
const BASE_URL = process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.ai';
const UPLOAD_URL = process.env.RUNNINGHUB_UPLOAD_URL || 'https://www.runninghub.cn';

const ENTERPRISE_KEY = process.env.RUNNINGHUB_API_KEY_ENTERPRISE || process.env.RUNNINGHUB_API_KEY_CONSUMER || process.env.RUNNINGHUB_API_KEY || '';
const CONSUMER_KEY = process.env.RUNNINGHUB_API_KEY_CONSUMER || process.env.RUNNINGHUB_API_KEY || '';
const FORCE_KEY_TYPE = process.env.RUNNINGHUB_FORCE_KEY_TYPE as 'enterprise' | 'consumer' | undefined;

function getAuthHeaders(apiKeyType?: 'enterprise' | 'consumer') {
  const resolvedType = FORCE_KEY_TYPE || apiKeyType || 'enterprise';
  const key = resolvedType === 'consumer' ? CONSUMER_KEY : ENTERPRISE_KEY;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
  };
}

// ── Start AI App Task ──────────────────────────────────────
// POST /openapi/v2/run/ai-app/{appId}
export async function runApp(payload: RunAppRequest): Promise<RunAppResponse> {
  const { appId, nodeInfoList, instanceType, usePersonalQueue, retainSeconds, webhookUrl, apiKeyType } = payload;

  const body: Record<string, unknown> = {
    nodeInfoList: nodeInfoList || [],
    instanceType: instanceType || 'default',
    usePersonalQueue: usePersonalQueue || 'false',
  };
  if (retainSeconds) body.retainSeconds = retainSeconds;
  if (webhookUrl) body.webhookUrl = webhookUrl;

  const res = await fetch(`${BASE_URL}/openapi/v2/run/ai-app/${appId}`, {
    method: 'POST',
    headers: getAuthHeaders(apiKeyType),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub API error ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── Start ComfyUI Workflow Task ────────────────────────────
// POST /openapi/v2/run/workflow/{workflowId}
export async function runWorkflow(payload: RunAppRequest & { addMetadata?: boolean }): Promise<RunAppResponse> {
  const { appId, nodeInfoList, instanceType, usePersonalQueue, retainSeconds, webhookUrl, apiKeyType, addMetadata } = payload;

  const body: Record<string, unknown> = {
    nodeInfoList: nodeInfoList || [],
    instanceType: instanceType || 'default',
    usePersonalQueue: usePersonalQueue || 'false',
  };
  if (addMetadata !== undefined) body.addMetadata = addMetadata;
  if (retainSeconds) body.retainSeconds = retainSeconds;
  if (webhookUrl) body.webhookUrl = webhookUrl;

  const res = await fetch(`${BASE_URL}/openapi/v2/run/workflow/${appId}`, {
    method: 'POST',
    headers: getAuthHeaders(apiKeyType),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub Workflow error ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── Query Task Outputs & Cost ──────────────────────────────
// POST /task/openapi/outputs
export async function queryTaskOutputs(taskId: string, apiKeyType?: 'enterprise' | 'consumer'): Promise<any> {
  const resolvedType = FORCE_KEY_TYPE || apiKeyType || 'enterprise';
  const key = resolvedType === 'consumer' ? CONSUMER_KEY : ENTERPRISE_KEY;

  const res = await fetch(`${BASE_URL}/task/openapi/outputs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      apiKey: key,
      taskId,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub Outputs error ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── Query Task Status & Results ────────────────────────────
// POST /openapi/v2/query
export async function queryTask(taskId: string, apiKeyType?: 'enterprise' | 'consumer'): Promise<QueryResponse> {
  const res = await fetch(`${BASE_URL}/openapi/v2/query`, {
    method: 'POST',
    headers: getAuthHeaders(apiKeyType),
    body: JSON.stringify({ taskId }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub Query error ${res.status}: ${errText}`);
  }

  const data = await res.json();

  // If task status is SUCCESS, enrich it with cost usage details by calling outputs endpoint
  if (data.status === 'SUCCESS') {
    try {
      const outputsResult = await queryTaskOutputs(taskId, apiKeyType);
      if (outputsResult && outputsResult.code === 0 && Array.isArray(outputsResult.data) && outputsResult.data.length > 0) {
        const firstOutput = outputsResult.data[0];
        data.usage = {
          consumeMoney: firstOutput.consumeMoney !== undefined && firstOutput.consumeMoney !== null ? String(firstOutput.consumeMoney) : null,
          consumeCoins: firstOutput.consumeCoins !== undefined && firstOutput.consumeCoins !== null ? String(firstOutput.consumeCoins) : null,
          taskCostTime: firstOutput.taskCostTime !== undefined && firstOutput.taskCostTime !== null ? String(firstOutput.taskCostTime) : '0',
          thirdPartyConsumeMoney: firstOutput.thirdPartyConsumeMoney !== undefined && firstOutput.thirdPartyConsumeMoney !== null ? String(firstOutput.thirdPartyConsumeMoney) : null,
        };
      }
    } catch (err) {
      console.error('[queryTask] Failed to fetch usage details:', err);
    }
  }

  return data;
}

// ── Upload Resource ────────────────────────────────────────
// POST https://www.runninghub.cn/openapi/v2/media/upload/binary
export async function uploadResource(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  apiKeyType?: 'enterprise' | 'consumer'
): Promise<UploadResponse> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer as any], { type: mimeType });
  formData.append('file', blob, fileName);

  const headers = getAuthHeaders(apiKeyType);
  const uploadHeaders: Record<string, string> = { ...headers };
  // Note: Do NOT set Content-Type for multipart/form-data — let browser/node-fetch boundary set it automatically
  delete uploadHeaders['Content-Type'];

  const res = await fetch(`${UPLOAD_URL}/openapi/v2/media/upload/binary`, {
    method: 'POST',
    headers: uploadHeaders,
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub Upload error ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── Image Generation API ────────────────────────────────────────────────────
// Covers all image model endpoints from the RunningHub Standard API:
//
//  Model ID               | Mode              | RH Endpoint Path
//  ─────────────────────────────────────────────────────────────────────────
//  nano-banana-2          | text-to-image     | rhart-image-n-g31-flash/text-to-image
//  nano-banana-2          | image-to-image    | rhart-image-n-g31-flash/image-to-image
//  nano-banana-pro        | edit              | rhart-image-n-pro/edit
//  gpt-2.0                | text-to-image     | rhart-image-g-2/text-to-image
//  gpt-2.0                | image-to-image    | rhart-image-g-2/image-to-image
//  grok-image             | text-to-image     | rhart-image-g/text-to-image
//  grok-image             | image-to-image    | rhart-image-g/image-to-image

type ImageTaskResponse = {
  taskId: string;
  status: string;
  errorCode: string;
  errorMessage: string;
  results: any[] | null;
  clientId: string;
  promptTips: string;
};

// ── Model → Endpoint routing map ────────────────────────────────────────────
const IMAGE_ENDPOINT_MAP: Record<string, { text: string; image: string }> = {
  'nano-banana-2':   { text: 'rhart-image-n-g31-flash/text-to-image', image: 'rhart-image-n-g31-flash/image-to-image' },
  'nano-banana-2-lite': { text: 'rhart-image-n-g31-flash-lite/text-to-image', image: 'rhart-image-n-g31-flash-lite/image-to-image' },
  'nano-banana-pro': { text: 'rhart-image-n-pro/edit',                 image: 'rhart-image-n-pro/edit' }, // pro only has edit endpoint
  'gpt-2.0':         { text: 'rhart-image-g-2/text-to-image',          image: 'rhart-image-g-2/image-to-image' },
  'grok-image':      { text: 'rhart-image-g/text-to-image',            image: 'rhart-image-g/image-to-image' },
  'flux-2-edit':     { text: 'rhart-image/f-2-klein-9b/edit',          image: 'rhart-image/f-2-klein-9b/edit' },
};

// ── Text-to-Image ─────────────────────────────────────────────────────────
export async function generateImageT2I(payload: {
  model: string;           // One of: nano-banana-2 | nano-banana-pro | gpt-2.0 | grok-image
  prompt: string;          // Required
  aspectRatio?: string;    // Optional — valid values vary by model
  resolution?: '1k' | '2k' | '4k'; // Optional for GPT; Required for nano/grok
  grokModel?: 'g-3' | 'g-4' | 'g-4.1' | 'g-4.2'; // Only for grok-image
}, apiKeyType?: 'enterprise' | 'consumer'): Promise<ImageTaskResponse> {
  const { model, prompt, aspectRatio, resolution, grokModel } = payload;
  const endpointPath = IMAGE_ENDPOINT_MAP[model]?.text;
  if (!endpointPath) throw new Error(`Unknown image model: ${model}`);

  const body: Record<string, unknown> = { prompt };
  if (aspectRatio) body.aspectRatio = aspectRatio;
  if (resolution) body.resolution = resolution;
  // Grok-image requires an explicit sub-model name
  if (model === 'grok-image') body.model = grokModel || 'g-4.2';

  const res = await fetch(`${BASE_URL}/openapi/v2/${endpointPath}`, {
    method: 'POST',
    headers: getAuthHeaders(apiKeyType),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub Image T2I error ${res.status}: ${errText}`);
  }
  return res.json();
}

// ── Image-to-Image / Edit ────────────────────────────────────────────────────
export async function generateImageI2I(payload: {
  model: string;           // One of: nano-banana-2 | nano-banana-pro | gpt-2.0 | grok-image
  prompt: string;          // Required
  imageUrls?: string[];    // For nano-banana-2, nano-banana-pro, gpt-2.0 — array of public URLs or base64
  imageUrl?: string;       // For grok-image / flux-2-edit — single URL
  aspectRatio?: string;    // Optional
  resolution?: '1k' | '2k' | '4k'; // Required for nano; optional for gpt
  grokModel?: 'g-3' | 'g-4' | 'g-4.1' | 'g-4.2'; // Only for grok-image
  customWidth?: number;    // Only for flux-2-edit
  customHight?: number;    // Only for flux-2-edit (spelled customHight in API)
  outputFormat?: string;   // Only for flux-2-edit
}, apiKeyType?: 'enterprise' | 'consumer'): Promise<ImageTaskResponse> {
  const { 
    model, 
    prompt, 
    imageUrls, 
    imageUrl, 
    aspectRatio, 
    resolution, 
    grokModel,
    customWidth,
    customHight,
    outputFormat
  } = payload;
  const endpointPath = IMAGE_ENDPOINT_MAP[model]?.image;
  if (!endpointPath) throw new Error(`Unknown image model: ${model}`);

  const body: Record<string, unknown> = { prompt };

  // Grok and Flux 2 Edit use a single `imageUrl` field; all others use `imageUrls[]`
  if (model === 'grok-image' || model === 'flux-2-edit') {
    if (imageUrl) body.imageUrl = imageUrl;
    else if (imageUrls && imageUrls.length > 0) body.imageUrl = imageUrls[0]; // auto-normalize
    
    if (model === 'grok-image') {
      body.model = grokModel || 'g-4.2';
    }
  } else {
    if (imageUrls && imageUrls.length > 0) body.imageUrls = imageUrls;
  }

  // Flux 2 Edit specific parameter payload structuring
  if (model === 'flux-2-edit') {
    body.aspectRatio = 'custom';
    body.customWidth = customWidth || 1024;
    body.customHight = customHight || 1024;
    body.outputFormat = outputFormat || 'png';
  } else {
    if (aspectRatio) body.aspectRatio = aspectRatio;
    if (resolution) body.resolution = resolution;
  }

  const res = await fetch(`${BASE_URL}/openapi/v2/${endpointPath}`, {
    method: 'POST',
    headers: getAuthHeaders(apiKeyType),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub Image I2I error ${res.status}: ${errText}`);
  }
  return res.json();
}

// ── Unified Image Generation helper (auto-routes based on payload) ──────────
// Use this when you want a single call point regardless of mode.
export async function generateImage(payload: {
  model: string;
  prompt: string;
  imageUrls?: string[];    // If provided AND non-empty → I2I mode
  imageUrl?: string;       // Single image (Grok I2I)
  aspectRatio?: string;
  resolution?: '1k' | '2k' | '4k';
  grokModel?: 'g-3' | 'g-4' | 'g-4.1' | 'g-4.2';
}, apiKeyType?: 'enterprise' | 'consumer'): Promise<ImageTaskResponse> {
  const hasImages = (payload.imageUrls && payload.imageUrls.length > 0) || !!payload.imageUrl;

  if (hasImages) {
    return generateImageI2I(payload, apiKeyType);
  }
  return generateImageT2I(payload, apiKeyType);
}

// ── Query Standard Image API Task Status ─────────────────────────────────────
// Standard Image API tasks need to be polled via the same I2I/T2I endpoint GET,
// or by calling the task status endpoint.
// RunningHub Standard API returns: { taskId, status, results, errorCode, errorMessage }
// Status values: QUEUED | RUNNING | SUCCESS | FAILED
// We poll by re-calling /openapi/v2/task/{taskId}/status or using the
// dedicated query endpoint for Standard API tasks.
export async function queryStandardImageTask(
  taskId: string,
  apiKeyType?: 'enterprise' | 'consumer'
): Promise<{ status: string; results: Array<{ url: string }> | null; errorMessage?: string }> {
  const res = await fetch(`${BASE_URL}/openapi/v2/task/${taskId}/status`, {
    method: 'GET',
    headers: getAuthHeaders(apiKeyType),
  });

  if (!res.ok) {
    // Fallback: try the unified query endpoint
    const res2 = await fetch(`${BASE_URL}/openapi/v2/query`, {
      method: 'POST',
      headers: getAuthHeaders(apiKeyType),
      body: JSON.stringify({ taskId }),
    });
    if (res2.ok) {
      const data = await res2.json();
      return {
        status: data.status || 'RUNNING',
        results: data.results || null,
        errorMessage: data.errorMessage,
      };
    }
    throw new Error(`Failed to query Standard Image task ${taskId}: ${res.status}`);
  }

  const data = await res.json();
  return {
    status: data.status || 'RUNNING',
    results: data.results || null,
    errorMessage: data.errorMessage,
  };
}


// Keep legacy alias for backward compatibility with existing callers
export async function generateImageStandard(payload: {
  imageUrls: string[];
  prompt: string;
  aspectRatio?: string;
  resolution: string;
}, apiKeyType?: 'enterprise' | 'consumer'): Promise<ImageTaskResponse> {
  return generateImageI2I({
    model: 'nano-banana-2',
    prompt: payload.prompt,
    imageUrls: payload.imageUrls,
    aspectRatio: payload.aspectRatio,
    resolution: payload.resolution as '1k' | '2k' | '4k',
  }, apiKeyType);
}



// ── Standard Video Generation API ──────────────────────────
// POST /openapi/v2/{modelPath}
export async function generateVideoStandard(payload: {
  model: string;
  prompt: string;
  imageUrls?: string[];
  videoUrls?: string[];
  ratio?: string;
  quality?: string;
  duration?: string;
  realPerson?: boolean;
  audio?: boolean;
}, apiKeyType?: 'enterprise' | 'consumer'): Promise<{ taskId: string; status: string; errorCode: string; errorMessage: string; results: any[]; clientId: string; promptTips: string }> {
  const headers = getAuthHeaders(apiKeyType);
  const { model, ...bodyPayload } = payload;
  const res = await fetch(`${BASE_URL}/openapi/v2/${model}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub Video API error ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── Standard LLM Chat Completions API ──────────────────────
// POST https://llm.runninghub.ai/v1/chat/completions
export async function chatCompletion(payload: {
  model: string;
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  reasoning_effort?: string;
}, apiKeyType?: 'enterprise' | 'consumer'): Promise<any> {
  const headers = getAuthHeaders(apiKeyType);
  const res = await fetch(`https://llm.runninghub.ai/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      max_tokens: 2048,
      temperature: 1,
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0,
      reasoning_effort: "none",
      ...payload
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub LLM API error ${res.status}: ${errText}`);
  }

  return res.json();
}
