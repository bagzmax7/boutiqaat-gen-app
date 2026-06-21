// ============================================
// RunningHub OpenAPI v2 Types
// ============================================

export type TaskStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED' | 'QUEUED';

export interface NodeInfo {
  nodeId: string;
  fieldName: string;
  fieldValue: string;
  description?: string;
}

export interface RunAppRequest {
  appId: string;
  nodeInfoList?: NodeInfo[];
  instanceType?: 'default' | 'plus';
  usePersonalQueue?: string;
  retainSeconds?: number;
  webhookUrl?: string;
  apiKeyType?: 'enterprise' | 'consumer';
}

// POST /openapi/v2/run/ai-app/{appId} response
export interface RunAppResponse {
  taskId: string;
  status: TaskStatus;
  errorCode: string;
  errorMessage: string;
  results: TaskResult[] | null;
  clientId: string;
  promptTips: string;
}

// Result item in query response
export interface TaskResult {
  url: string;
  nodeId: string;
  outputType: string;
  text: string | null;
}

// POST /openapi/v2/query response
export interface QueryResponse {
  taskId: string;
  status: TaskStatus;
  errorCode: string;
  errorMessage: string;
  failedReason: object;
  usage: {
    consumeMoney: string | null;
    consumeCoins: string | null;
    taskCostTime: string;
    thirdPartyConsumeMoney: string | null;
  };
  results: TaskResult[] | null;
  clientId: string;
  promptTips: string;
}

// Upload response from /openapi/v2/media/upload/binary
export interface UploadResponse {
  code: number;
  message: string;
  data?: {
    type: string;
    download_url: string;
    fileName: string;
    size: string;
  };
}

// Legacy alias for TaskOutput (used in components)
export interface TaskOutput {
  fileUrl: string;
  fileType: string;
}

// ============================================
// Internal App Types
// ============================================

export interface Task {
  id: string;
  taskId: string;
  appId: string;
  appName: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  outputs?: TaskOutput[];
  nodeInfoList?: NodeInfo[];
  error?: string;
  apiKeyType?: 'enterprise' | 'consumer';
}

export interface AppDefinition {
  id: string;
  name: string;
  description: string;
  category: AppCategory;
  icon: string;
  pinned?: boolean;
  batchMode?: boolean;
  nodeInfoSchema?: NodeInfoSchema[];
}

export type AppCategory =
  | 'image-generation'
  | 'video-generation'
  | 'image-editing'
  | 'text-generation'
  | 'comfyui'
  | 'other';

export interface NodeInfoSchema {
  nodeId: string;
  fieldName: string;
  label: string;
  type: 'text' | 'textarea' | 'image-url' | 'select' | 'number';
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  options?: { label: string; value: string }[];
}

export interface DashboardStats {
  totalToday: number;
  running: number;
  completed: number;
  failed: number;
}

export interface AuthPayload {
  userId: string;
  email: string;
  name: string;
  role: 'editor' | 'admin';
  iat: number;
  exp: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'editor' | 'admin';
  avatar_url?: string | null;
  created_at?: string;
}

