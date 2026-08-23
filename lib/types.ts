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
  role: 'editor' | 'admin' | 'manager';
  departmentId?: string | null;
  iat: number;
  exp: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'editor' | 'admin' | 'manager';
  avatar_url?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  manager_id?: string | null;
  monthly_credit_limit_usd?: number;
  credit_used_usd?: number;
  allowed_models?: string[];
  status?: 'active' | 'suspended';
  created_at?: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  monthly_budget_usd: number;
  critical_threshold_percent: number;
  auto_pause_on_critical: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreativeGalleryItem {
  id: string;
  department_id: string;
  task_id?: string | null;
  title: string;
  media_url: string;
  media_type: 'image' | 'video' | 'psd';
  prompt: string;
  model_used: string;
  settings_snapshot: Record<string, any>;
  created_by_user_id?: string | null;
  creator_name?: string;
  creator_email?: string;
  starred_by_manager_id?: string | null;
  is_company_preset: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  department_id?: string | null;
  type: 'BUDGET_ALERT' | 'QUOTA_WARNING' | 'GALLERY_STAR' | 'TASK_DONE';
  title: string;
  message: string;
  read: boolean;
  link_url?: string | null;
  created_at: string;
}

// ============================================
// Boutiqaat Layers Studio Types
// ============================================

export interface CanvasLayerItem {
  id: string;
  name: string;
  originalUrl: string;
  currentUrl: string;
  version: number;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';
  isBackground: boolean;
  modelUsed?: string;
  history?: Array<{
    url: string;
    version: number;
    timestamp: number;
    model?: string;
    prompt?: string;
  }>;
}

export interface LayerDecompositionParams {
  imageUrl: string;
  prompt?: string | null;
  resolution?: 'auto' | '1k' | '1.5k' | '2k';
  outputFormat?: 'jpeg' | 'png';
}

export interface LayersProject {
  id: string;
  user_id: string;
  department_id?: string | null;
  name: string;
  category: 'banner-ads' | 'product-photo' | 'catalog' | 'social-media' | 'general';
  thumbnail_url?: string | null;
  canvas_width: number;
  canvas_height: number;
  layers: CanvasLayerItem[];
  revision_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReCreatePayload {
  layerId: string;
  model: 'nano-banana-2' | 'flux-pro' | 'gpt-2';
  prompt: string;
  intentCategory?: 'material' | 'replace-product' | 'lighting' | 'props' | 'label';
  referenceImageUrl?: string | null;
  preserveLighting?: boolean;
}


