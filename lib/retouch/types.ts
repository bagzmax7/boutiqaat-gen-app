export type RetouchModelId = 'flux-2-edit' | 'nano-banana-2';

export interface RetouchModelConfig {
  id: RetouchModelId;
  name: string;
  badge: 'RECOMMENDED' | 'NEW';
}

export const RETOUCH_MODELS: RetouchModelConfig[] = [
  {
    id: 'flux-2-edit',
    name: 'Boutiqaat Klein',
    badge: 'RECOMMENDED',
  },
  {
    id: 'nano-banana-2',
    name: 'Boutiqaat Pro',
    badge: 'NEW',
  },
];

export interface RetouchVersion {
  versionNumber: number; // 1, 2, 3...
  taskId: string;
  outputUrl: string;
  modelId: RetouchModelId;
  modelName: string;
  aspectRatio?: string;
  customDimensions?: { customWidth: number; customHight: number };
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  error?: string;
  createdAt: string;
}

export interface RetouchItem {
  id: string;
  name: string;
  originalUrl: string; // Stored ONCE, reused across all versions without re-upload
  originalWidth?: number;
  originalHeight?: number;
  detectedAspectRatio?: string;
  versions: RetouchVersion[]; // [v1, v2, v3]
  activeVersionIndex: number; // currently viewed version index in before/after slider (0-based)
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface RetouchProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  defaultModel: RetouchModelId;
  items: RetouchItem[];
  createdAt: string;
  updatedAt: string;
}
