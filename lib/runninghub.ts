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

// ── Standard Image Generation API ──────────────────────────
// POST /openapi/v2/rhart-image-n-g31-flash/image-to-image
export async function generateImageStandard(payload: {
  imageUrls: string[];
  prompt: string;
  aspectRatio?: string;
  resolution: string;
}, apiKeyType?: 'enterprise' | 'consumer'): Promise<{ taskId: string; status: string; errorCode: string; errorMessage: string; results: any[]; clientId: string; promptTips: string }> {
  const headers = getAuthHeaders(apiKeyType);
  const res = await fetch(`${BASE_URL}/openapi/v2/rhart-image-n-g31-flash/image-to-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RunningHub Image API error ${res.status}: ${errText}`);
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
