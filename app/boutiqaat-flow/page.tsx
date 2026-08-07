'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { useTasks } from '@/hooks/useTasks';
import {
  Sparkles, Send, Plus, Image as ImageIcon, Film, X, ChevronDown,
  Loader2, CheckCircle2, AlertCircle, Zap, RefreshCw, Download,
  Upload, FileVideo, FileAudio, Clock, Settings2, User2, ArrowRight,
  RotateCcw, Maximize2, Layers, Info, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Model Configs ─────────────────────────────────────────────────────────
const IMAGE_MODELS = [
  { id: 'nano-banana-pro', name: 'Nano Banana Pro (Recommended)', logo: '/model-logos/Gemini.png', stats: ['1K-4K', 'High Quality'] },
  { id: 'nano-banana-2', name: 'Nano Banana 2 (Recommended)', logo: '/model-logos/Gemini.png', stats: ['1K-4K', 'Balanced'] },
  { id: 'nano-banana-2-lite', name: 'Nano Banana 2 Lite (Faster Low Quality)', logo: '/model-logos/Gemini.png', stats: ['1K-2K', 'Fastest'] },
  { id: 'gpt-2.0', name: 'GPT Image 2.0 (New)', logo: '/model-logos/GPT.png', stats: ['1K-4K', 'Standard'] },
  { id: 'flux-2-edit', name: 'Flux 2 Edit (Standard)', logo: '/model-logos/Flux.png', stats: ['1K-4K', 'Pro Edit'] },
  { id: 'grok-image', name: 'Grok Image', logo: '/model-logos/Flux.png', stats: ['1K-2K', 'Dynamic'] },
];

const VIDEO_MODELS = [
  { id: 'seedance-2.0-mini', name: 'Seedance 2.0 Mini (Recommended)', logo: '/model-logos/Seedance.png', stats: ['720p-4K', '4s-15s'] },
  { id: 'seedance-2.0-official', name: 'Seedance 2.0 (Official)', logo: '/model-logos/Seedance.png', stats: ['720p-4K', '4s-15s'] },
  { id: 'gemini-omni-flash', name: 'Gemini Omni Flash (Recommended)', logo: '/model-logos/Gemini.png', stats: ['720p-4K', '4s-10s'] },
  { id: 'veo-3.1-fast', name: 'Veo 3.1 Fast (Recommended)', logo: '/model-logos/Gemini.png', stats: ['720p-4K', '8s'] },
  { id: 'minimax-h3', name: 'MiniMax H3 (New)', logo: '/model-logos/MiniMax.png', stats: ['768p-2K', '5s-15s'] },
  { id: 'ltx-2.3', name: 'LTX 2.3 (New)', logo: '/model-logos/Ltx.png', stats: ['480p-1080p', '5s-15s'] },
];

interface VideoModelConfig {
  ratios: string[];
  resolutions: string[];
  defaultResolution: string;
  durationMode: 'slider' | 'tiles';
  durations: string[];
  minDuration?: number;
  maxDuration?: number;
  defaultDuration: string;
  supportsRealPerson: boolean;
  supportsAudio: boolean;
}

const VIDEO_MODEL_CONFIGS: Record<string, VideoModelConfig> = {
  'seedance-2.0-mini': {
    ratios: ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['480p', '720p', '1080p', '2k', '4k'],
    defaultResolution: '720p',
    durationMode: 'slider',
    durations: [],
    minDuration: 4,
    maxDuration: 15,
    defaultDuration: '6s',
    supportsRealPerson: true,
    supportsAudio: true,
  },
  'seedance-2.0-official': {
    ratios: ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['480p', '720p', '1080p', '2k', '4k'],
    defaultResolution: '720p',
    durationMode: 'slider',
    durations: [],
    minDuration: 4,
    maxDuration: 15,
    defaultDuration: '6s',
    supportsRealPerson: true,
    supportsAudio: true,
  },
  'gemini-omni-flash': {
    ratios: ['Auto', '16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    durationMode: 'tiles',
    durations: ['4s', '6s', '8s', '10s'],
    defaultDuration: '6s',
    supportsRealPerson: false,
    supportsAudio: false,
  },
  'veo-3.1-fast': {
    ratios: ['Auto', '16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    durationMode: 'tiles',
    durations: ['8s'],
    defaultDuration: '8s',
    supportsRealPerson: false,
    supportsAudio: true,
  },
  'minimax-h3': {
    ratios: ['Auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    resolutions: ['768P', '2K'],
    defaultResolution: '768P',
    durationMode: 'slider',
    durations: [],
    minDuration: 5,
    maxDuration: 15,
    defaultDuration: '5s',
    supportsRealPerson: false,
    supportsAudio: true,
  },
  'ltx-2.3': {
    ratios: ['Auto', '16:9', '9:16'],
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '720p',
    durationMode: 'slider',
    durations: [],
    minDuration: 5,
    maxDuration: 15,
    defaultDuration: '5s',
    supportsRealPerson: false,
    supportsAudio: false,
  },
};

const NANO_BANANA_RATIOS = ['Auto', '1:1', '2:3', '3:2', '4:5', '5:4', '4:3', '3:4', '16:9', '9:16', '21:9', '1:4', '4:1', '1:8', '8:1'];
const GPT_IMAGE_RATIOS = ['Auto', '1:1', '2:3', '3:2', '4:5', '5:4', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21', '2:1', '1:2', '3:1', '1:3'];
const GROK_IMAGE_RATIOS = ['Auto', '960x960', '720x1280', '1280x720', '1168x784', '784x1168'];
const VIDEO_RATIOS = ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];
const IMAGE_QUALITIES = ['1k', '2k', '4k'];
const VIDEO_QUALITIES = ['480p', '720p', '1080p', '2k', '4k'];

// Helper SVG graphic icon for aspect ratio tiles
function AspectRatioGraphic({ ratio, className = "w-4 h-4" }: { ratio: string; className?: string }) {
  if (ratio === 'Auto') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 3" />
        <rect x="8" y="8" width="8" height="8" rx="1" />
      </svg>
    );
  }

  let width = 16;
  let height = 16;

  if (ratio === '1:1' || ratio === '960x960') { width = 16; height = 16; }
  else if (ratio === '2:3' || ratio === '3:4' || ratio === '4:5' || ratio === '784x1168') { width = 12; height = 18; }
  else if (ratio === '3:2' || ratio === '4:3' || ratio === '5:4' || ratio === '1168x784') { width = 18; height = 12; }
  else if (ratio === '16:9' || ratio === '1280x720' || ratio === '2:1' || ratio === '3:1') { width = 20; height = 11; }
  else if (ratio === '9:16' || ratio === '720x1280' || ratio === '1:2' || ratio === '1:3') { width = 11; height = 20; }
  else if (ratio === '21:9' || ratio === '4:1' || ratio === '8:1') { width = 22; height = 9; }
  else if (ratio === '1:4' || ratio === '1:8' || ratio === '9:21') { width = 9; height = 22; }

  const x = (24 - width) / 2;
  const y = (24 - height) / 2;

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="2">
      <rect x={x} y={y} width={width} height={height} rx="2" />
    </svg>
  );
}

function parseModelName(fullName: string) {
  const match = fullName.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    return {
      displayName: match[1].trim(),
      badge: match[2].trim()
    };
  }
  return {
    displayName: fullName.trim(),
    badge: null
  };
}

function ModelBadge({ text }: { text: string }) {
  let colorClass = 'bg-lime-500/10 text-lime-400 border border-lime-500/20';
  const cleanText = text.toUpperCase();
  if (cleanText.includes('NEW')) {
    colorClass = 'bg-[#a3e635] text-[#0d0e10] font-black italic px-1.5 py-0.5 rounded text-[8px] tracking-wider';
  } else if (cleanText.includes('EXCLUSIVE')) {
    colorClass = 'bg-[#a3e635] text-[#0d0e10] font-black italic px-1.5 py-0.5 rounded text-[8px] tracking-wider';
  } else if (cleanText.includes('RECOMMENDED')) {
    colorClass = 'bg-lime-500/20 text-lime-400 font-extrabold italic px-1.5 py-0.5 rounded border border-lime-500/30 text-[8px] tracking-wider';
  } else if (cleanText.includes('FASTER LOW QUALITY')) {
    colorClass = 'bg-amber-500/20 text-amber-400 font-extrabold italic px-1.5 py-0.5 rounded border border-amber-500/30 text-[8px] tracking-wider';
  } else if (cleanText.includes('STANDARD')) {
    colorClass = 'bg-white/10 text-gray-300 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-wider';
  } else if (cleanText.includes('COMING SOON')) {
    colorClass = 'bg-blue-500/20 text-blue-400 font-extrabold italic px-1.5 py-0.5 rounded border border-blue-500/30 text-[8px] tracking-wider';
  } else {
    colorClass = 'bg-white/10 text-gray-300 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-wider';
  }
  return <span className={cn("uppercase text-[8px] font-bold px-1 py-0.5 rounded scale-90 inline-block align-middle", colorClass)}>{text}</span>;
}

// Convert ratio string to CSS aspect-ratio class
function getAspectRatioClass(ratio: string): string {
  if (ratio === '9:16' || ratio === '720x1280' || ratio === '1:2') return 'aspect-[9/16]';
  if (ratio === '16:9' || ratio === '1280x720' || ratio === '2:1') return 'aspect-[16/9]';
  if (ratio === '3:4' || ratio === '784x1168') return 'aspect-[3/4]';
  if (ratio === '4:3' || ratio === '1168x784') return 'aspect-[4/3]';
  if (ratio === '2:3') return 'aspect-[2/3]';
  if (ratio === '3:2') return 'aspect-[3/2]';
  if (ratio === '4:5') return 'aspect-[4/5]';
  if (ratio === '5:4') return 'aspect-[5/4]';
  if (ratio === '21:9') return 'aspect-[21/9]';
  return 'aspect-square';
}

interface CanvasCardItem {
  id: string;
  taskId: string;
  mode: 'image' | 'video';
  prompt: string;
  model: string;
  ratio: string;
  quality: string;
  timestamp: number;
  attachments?: { url: string; type: 'image' | 'video' | 'audio' }[];
  status?: string;
  outputs?: { fileUrl: string; fileType: string }[];
}

function QuickCreateContent() {
  const searchParams = useSearchParams();
  const { addTask, tasks } = useTasks();

  const [activeMode, setActiveMode] = useState<'image' | 'video'>(
    (searchParams.get('mode') as 'image' | 'video') || 'image'
  );
  const [prompt, setPrompt] = useState(searchParams.get('prompt') || '');
  const [selectedImageModel, setSelectedImageModel] = useState('nano-banana-2');
  const [selectedVideoModel, setSelectedVideoModel] = useState(VIDEO_MODELS[0].id);

  // Settings State
  const [ratio, setRatio] = useState('16:9');
  const [quality, setQuality] = useState('1k');
  const [duration, setDuration] = useState('6s');
  const [realPerson, setRealPerson] = useState('On');
  const [audio, setAudio] = useState('On');
  const [batchCount, setBatchCount] = useState<number>(1); // 1x, 2x, 3x, 4x

  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [showMentionPopup, setShowMentionPopup] = useState(false);

  // Canvas Showcase items & Lightbox Preview state
  const [canvasItems, setCanvasItems] = useState<CanvasCardItem[]>([]);
  const [selectedPreviewMedia, setSelectedPreviewMedia] = useState<{
    url: string;
    type: 'image' | 'video';
    prompt?: string;
    model?: string;
    ratio?: string;
  } | null>(null);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<{ url: string; type: 'image' | 'video' | 'audio' }[]>([]);
  const [attachedUrls, setAttachedUrls] = useState<{ url: string; type: 'image' | 'video' | 'audio' }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputVideoDuration, setInputVideoDuration] = useState<number | null>(null); // seconds, detected from input video
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  /** Detect duration of a video File using HTML5 media element */
  const detectVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const dur = Math.ceil(video.duration);
        URL.revokeObjectURL(url);
        resolve(dur);
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      video.src = url;
    });
  };

  // Sync uploaded files with object URLs and perform resource cleanup on changes
  useEffect(() => {
    const urls = uploadedFiles.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image' as 'image' | 'video' | 'audio'
    }));
    setPreviewUrls(urls);

    // Detect duration of the first video file for smart Gemini video-edit duration
    const firstVideoFile = uploadedFiles.find(f => f.type.startsWith('video/'));
    if (firstVideoFile) {
      detectVideoDuration(firstVideoFile).then(dur => {
        setInputVideoDuration(dur > 0 ? dur : null);
      });
    } else {
      setInputVideoDuration(null);
    }

    return () => {
      urls.forEach(item => URL.revokeObjectURL(item.url));
    };
  }, [uploadedFiles]);

  const currentVideoConfig = VIDEO_MODEL_CONFIGS[selectedVideoModel] || VIDEO_MODEL_CONFIGS['seedance-2.0-mini'];

  // Detect if we're in video-edit mode (Gemini + video input attached)
  const hasVideoAttached = attachedUrls.some(a => a.type === 'video') || uploadedFiles.some(f => f.type.startsWith('video/'));
  const isGeminiVideoEdit = selectedVideoModel === 'gemini-omni-flash' && hasVideoAttached && activeMode === 'video';

  // Compute available ratios based on active mode & model
  const currentAvailableRatios = activeMode === 'video'
    ? currentVideoConfig.ratios
    : selectedImageModel === 'nano-banana-2'
    ? NANO_BANANA_RATIOS
    : selectedImageModel === 'gpt-2.0'
    ? GPT_IMAGE_RATIOS
    : selectedImageModel === 'grok-image'
    ? GROK_IMAGE_RATIOS
    : NANO_BANANA_RATIOS;

  const currentAvailableResolutions = activeMode === 'video'
    ? currentVideoConfig.resolutions
    : selectedImageModel === 'nano-banana-2-lite'
    ? ['1k', '2k']
    : selectedImageModel === 'grok-image'
    ? ['1k']
    : IMAGE_QUALITIES;

  // Auto-adjust ratio and quality when model or mode changes
  useEffect(() => {
    if (currentAvailableRatios.length > 0 && !currentAvailableRatios.includes(ratio)) {
      setRatio(currentAvailableRatios[0]);
    }
    if (currentAvailableResolutions.length > 0 && !currentAvailableResolutions.includes(quality)) {
      setQuality(currentAvailableResolutions[0]);
    }
  }, [selectedImageModel, selectedVideoModel, activeMode, currentAvailableRatios, currentAvailableResolutions, ratio, quality]);

  // Load persistent canvas items from dedicated database API on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('quick_create_canvas_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.sort((a: any, b: any) => b.timestamp - a.timestamp);
          setCanvasItems(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load local canvas items:', e);
    }

    async function loadDbTasks() {
      try {
        const res = await fetch('/api/boutiqaat-flow/sessions');
        if (!res.ok) return;
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          const dbCanvasItems: CanvasCardItem[] = data.sessions.map((s: any) => ({
            id: s.id,
            taskId: s.task_id || s.id,
            mode: s.mode || 'image',
            prompt: s.prompt || 'Generation',
            model: s.model || 'Standard',
            ratio: s.ratio || '16:9',
            quality: s.quality || '1k',
            timestamp: new Date(s.updated_at || s.created_at || Date.now()).getTime(),
            attachments: s.attachments || [],
            status: s.status || (s.outputs && s.outputs.length > 0 ? 'SUCCESS' : 'QUEUED'),
            outputs: s.outputs || [],
          }));

          // Sort chronologically by date modified (newest first)
          dbCanvasItems.sort((a, b) => b.timestamp - a.timestamp);
          setCanvasItems(dbCanvasItems);
        }
      } catch (e) {
        console.error('Failed to load Boutiqaat Flow sessions:', e);
      }
    }

    loadDbTasks();
  }, []);

  // Sync active task updates with dedicated database endpoint
  useEffect(() => {
    if (tasks.length > 0) {
      setCanvasItems(prev => {
        const nextItems = prev.map(item => {
          const match = tasks.find(t => t.id === item.taskId || t.taskId === item.taskId);
          if (match && (match.status === 'SUCCESS' || match.status === 'FAILED')) {
            if (item.status !== match.status || (match.outputs && match.outputs.length !== (item.outputs?.length || 0))) {
              fetch('/api/boutiqaat-flow/sessions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: item.id,
                  task_id: item.taskId,
                  status: match.status,
                  outputs: match.outputs || [],
                  error: match.error || null,
                })
              }).catch(() => {});

              return {
                ...item,
                status: match.status,
                outputs: match.outputs || [],
                timestamp: Date.now(), // Update timestamp to reflect modified time
              };
            }
          }
          return item;
        });

        // Re-sort elements by date modified so completed tasks move to the top
        return [...nextItems].sort((a, b) => b.timestamp - a.timestamp);
      });
    }
  }, [tasks]);

  // Save canvas items to localStorage fallback
  useEffect(() => {
    if (canvasItems.length > 0) {
      try {
        localStorage.setItem('quick_create_canvas_items', JSON.stringify(canvasItems.slice(0, 30)));
      } catch (e) {
        console.error('Failed to save canvas items:', e);
      }
    }
  }, [canvasItems]);

  // Auto-resize the prompt textarea height to fit long prompts dynamically
  useEffect(() => {
    if (promptTextareaRef.current) {
      const textarea = promptTextareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [prompt]);

  // Reset video parameters if they don't match the selected video model's supported enums
  useEffect(() => {
    if (activeMode === 'video') {
      const config = VIDEO_MODEL_CONFIGS[selectedVideoModel];
      if (config) {
        if (!config.resolutions.includes(quality)) {
          setQuality(config.defaultResolution);
        }
        if (!config.ratios.includes(ratio)) {
          setRatio(config.ratios[0]);
        }
        if (config.durationMode === 'slider') {
          const num = parseInt(duration, 10);
          if (isNaN(num) || num < (config.minDuration || 4) || num > (config.maxDuration || 15)) {
            setDuration(config.defaultDuration);
          }
        } else {
          if (!config.durations.includes(duration)) {
            setDuration(config.defaultDuration);
          }
        }
      }
    }
  }, [selectedVideoModel, activeMode]);

  // Handle initial submission from URL params
  const initialTriggerRef = useRef(false);
  useEffect(() => {
    const urlPrompt = searchParams.get('prompt');
    if (urlPrompt && !initialTriggerRef.current) {
      initialTriggerRef.current = true;
      handleGenerate(urlPrompt);
    }
  }, [searchParams]);

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/'));
    if (validFiles.length === 0) {
      toast.error('Please upload images, videos, or audio files.');
      return;
    }
    setUploadedFiles(prev => [...prev, ...validFiles].slice(0, 5));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const types = e.dataTransfer.types;
    const hasFiles = types.includes('Files') || types.includes('application/json') || types.includes('text/plain') || types.includes('text/uri-list');
    if (hasFiles) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Drag & drop into control dock (Supports OS files AND generated card outputs)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // 1. Check if dragging files from OS
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
      return;
    }

    // 2. Check if dragging JSON item from generated canvas card
    const jsonStr = e.dataTransfer.getData('application/json');
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.url) {
          const mediaType: 'image' | 'video' | 'audio' = parsed.type === 'video' ? 'video' : parsed.type === 'audio' ? 'audio' : 'image';
          setAttachedUrls(prev => [...prev, { url: parsed.url, type: mediaType }].slice(0, 5));
          toast.success('Added generated result to reference assets!');
          return;
        }
      } catch (err) {}
    }

    // 3. Fallback plain text URL
    const textUrl = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (textUrl && (textUrl.startsWith('http') || textUrl.startsWith('/'))) {
      const isVid = textUrl.endsWith('.mp4') || textUrl.endsWith('.webm');
      const mediaType: 'image' | 'video' | 'audio' = isVid ? 'video' : 'image';
      setAttachedUrls(prev => [...prev, { url: textUrl, type: mediaType }].slice(0, 5));
      toast.success('Added generated result to reference assets!');
    }
  };

  // ─── Reuse Prompt Function ────────────────────────────────────────────────
  const handleReusePrompt = (item: CanvasCardItem) => {
    setPrompt(item.prompt);
    setActiveMode(item.mode);
    if (item.mode === 'image') setSelectedImageModel(item.model);
    else setSelectedVideoModel(item.model);

    if (item.ratio) setRatio(item.ratio);
    if (item.quality) setQuality(item.quality);

    if (item.attachments && item.attachments.length > 0) {
      setAttachedUrls(item.attachments);
    } else {
      setAttachedUrls([]);
    }

    toast.success('Restored prompt, model & attached reference media!');
  };

  const handleGenerate = async (overridePrompt?: string) => {
    const currentPrompt = (overridePrompt || prompt).trim();
    if (!currentPrompt && uploadedFiles.length === 0 && attachedUrls.length === 0) {
      toast.error('Please enter a prompt or attach media.');
      return;
    }

    setIsGenerating(true);
    try {
      const allAttachments: { url: string; type: 'image' | 'video' | 'audio' }[] = [...attachedUrls];
      const imageUrls: string[] = attachedUrls.filter(a => a.type === 'image').map(a => a.url);
      const videoUrls: string[] = attachedUrls.filter(a => a.type === 'video').map(a => a.url);
      const audioUrls: string[] = attachedUrls.filter(a => a.type === 'audio').map(a => a.url);

      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/runninghub/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.fileUrl) throw new Error(data.error || 'File upload failed');

        let fileType: 'image' | 'video' | 'audio' = 'image';
        if (file.type.startsWith('video/')) {
          fileType = 'video';
          videoUrls.push(data.fileUrl);
        } else if (file.type.startsWith('audio/')) {
          fileType = 'audio';
          audioUrls.push(data.fileUrl);
        } else {
          imageUrls.push(data.fileUrl);
        }

        allAttachments.push({ url: data.fileUrl, type: fileType });
      }

      const activeModel = activeMode === 'image' ? selectedImageModel : selectedVideoModel;

      // Resolve prompt mentions to actual uploaded URLs for the API call
      let processedPrompt = currentPrompt;
      const imagesList = allAttachments.filter(a => a.type === 'image');
      const videosList = allAttachments.filter(a => a.type === 'video');
      const audiosList = allAttachments.filter(a => a.type === 'audio');

      imagesList.forEach((item, idx) => {
        // Handle both case variations and optional index formats
        processedPrompt = processedPrompt
          .replaceAll(`@Image ${idx + 1}`, item.url)
          .replaceAll(`@image ${idx + 1}`, item.url);
      });
      videosList.forEach((item, idx) => {
        processedPrompt = processedPrompt
          .replaceAll(`@Video ${idx + 1}`, item.url)
          .replaceAll(`@video ${idx + 1}`, item.url);
      });
      audiosList.forEach((item, idx) => {
        processedPrompt = processedPrompt
          .replaceAll(`@Audio ${idx + 1}`, item.url)
          .replaceAll(`@audio ${idx + 1}`, item.url);
      });

      // Process batch generation (1x to 4x) cleanly without endpoint collisions
      for (let b = 0; b < batchCount; b++) {
        if (b > 0) {
          await new Promise(r => setTimeout(r, 250));
        }

        let taskId = '';
        if (activeMode === 'image') {
          const res = await fetch('/api/image-agent/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: processedPrompt,
              model: selectedImageModel,
              aspectRatio: ratio !== 'Auto' ? ratio : '16:9',
              resolution: quality.includes('4k') ? '4k' : quality.includes('2k') ? '2k' : '1k',
              imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.taskId) throw new Error(data.errorMessage || data.error || 'Image generation failed');
          taskId = data.taskId;

          addTask(taskId, 'quick-create-image', `Image: ${currentPrompt.slice(0, 25)}...`, [{ nodeId: 'prompt', fieldName: 'text', fieldValue: processedPrompt }], 'enterprise');
        } else {
          const res = await fetch('/api/runninghub/video-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: selectedVideoModel,
              prompt: processedPrompt,
              imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
              videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
              audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
              ratio: ratio !== 'Auto' ? ratio : undefined,
              quality,
              duration,
              // Pass detected input video duration so backend can snap to correct supported value
              inputVideoDuration: inputVideoDuration ?? undefined,
              realPerson: realPerson === 'On',
              audio: audio === 'On',
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.taskId) throw new Error(data.errorMessage || data.error || 'Video generation failed');
          taskId = data.taskId;

          addTask(taskId, 'quick-create-video', `Video: ${currentPrompt.slice(0, 25)}...`, [{ nodeId: 'prompt', fieldName: 'text', fieldValue: processedPrompt }], 'enterprise');
        }

        const localId = `${Date.now()}-${b}-canvas`;

        // Persist to Dedicated Boutiqaat Flow Database Table
        fetch('/api/boutiqaat-flow/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: localId,
            task_id: taskId,
            mode: activeMode,
            prompt: currentPrompt,
            model: activeModel,
            ratio,
            quality,
            attachments: allAttachments,
            status: 'QUEUED',
          })
        }).catch(() => {});

        // Add to Canvas Item List at top position
        const newCanvasItem: CanvasCardItem = {
          id: localId,
          taskId,
          mode: activeMode,
          prompt: currentPrompt,
          model: activeModel,
          ratio,
          quality,
          timestamp: Date.now(),
          attachments: allAttachments,
          status: 'QUEUED',
        };

        setCanvasItems(prev => [newCanvasItem, ...prev]);
      }

      setPrompt('');
      setUploadedFiles([]);
      setAttachedUrls([]);
      toast.success(`Generating ${batchCount}x ${activeMode}...`);

    } catch (err: any) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const activeModelObj = activeMode === 'image'
    ? IMAGE_MODELS.find(m => m.id === selectedImageModel)
    : VIDEO_MODELS.find(m => m.id === selectedVideoModel);

  return (
    <div className="flex h-screen bg-[#070707] text-white overflow-hidden font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative bg-[#070707]">
        {/* Viewport-fixed background gradient to avoid background color splits/cuts on scroll */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-lime-950/15 via-[#070707] to-[#070707] pointer-events-none z-0" />

        {/* Main Background Canvas Workspace */}
        <main className="flex-1 overflow-y-auto relative flex flex-col p-4 sm:p-6 pb-28 z-10">

          {/* Top Banner Heading */}
          <div className="relative z-10 text-center space-y-1 pt-2 flex flex-col items-center">
            <h1 className="text-3xl sm:text-4xl font-black text-lime-400 tracking-tight drop-shadow-[0_0_20px_rgba(163,230,53,0.3)]">
              Boutiqaat Flow Studio
            </h1>
            <p className="text-xs text-gray-400 font-medium tracking-wide max-w-2xl">
              Transform creative prompts into commercial visuals and cinematic campaign assets instantly.
            </p>
          </div>

          {/* Canvas Showcase Gallery */}
          <div className="relative z-10 w-full mt-6 mb-4">
            {canvasItems.length > 0 && (
              <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7 gap-3" style={{columnFill: 'balance'}}>
                {canvasItems.map((item) => {
                  const taskObj = tasks.find(t => t.id === item.taskId || t.taskId === item.taskId);
                  const isSuccess = taskObj?.status === 'SUCCESS' || item.status === 'SUCCESS' || (item.outputs && item.outputs.length > 0);
                  const isFailed = taskObj?.status === 'FAILED' || (item.status === 'FAILED' && (!item.outputs || item.outputs.length === 0));
                  const outputs = (taskObj?.outputs && taskObj.outputs.length > 0) ? taskObj.outputs : (item.outputs || []);

                  const aspectClass = getAspectRatioClass(item.ratio);
                  const mediaType = item.mode === 'video' || (outputs[0]?.fileUrl && (outputs[0].fileUrl.toLowerCase().includes('.mp4') || outputs[0].fileUrl.toLowerCase().includes('.webm') || outputs[0].fileUrl.toLowerCase().includes('.mov'))) ? 'video' : 'image';

                  return (
                    <div
                      key={item.id}
                      className="break-inside-avoid mb-3 relative rounded-3xl overflow-hidden border border-white/10 bg-[#141517] shadow-2xl group transition-all duration-300 hover:border-lime-500/50 hover:shadow-[0_0_25px_rgba(163,230,53,0.15)]"
                    >
                      {/* Aspect Ratio Skeleton Loader / Finished Content */}
                      <div className={cn('w-full relative overflow-hidden bg-black/60', aspectClass)}>
                        {!isSuccess && !isFailed && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-black via-[#1a1e15] to-black flex flex-col items-center justify-center p-6 text-center space-y-3 animate-pulse">
                            <div className="w-12 h-12 rounded-full bg-lime-400/20 border border-lime-400/50 flex items-center justify-center text-lime-400 shadow-lg">
                              <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-lime-400 uppercase tracking-wider block">
                                Generating {item.mode}...
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono block">
                                Task ID: {item.taskId}
                              </span>
                            </div>
                          </div>
                        )}

                        {isFailed && (
                          <div className="absolute inset-0 bg-red-950/20 border border-red-500/30 flex flex-col items-center justify-center p-4 text-center space-y-2">
                            <AlertCircle className="w-8 h-8 text-red-400" />
                            <span className="text-xs font-bold text-red-400">Generation Failed</span>
                          </div>
                        )}

                        {isSuccess && outputs.length > 0 && (
                          <div
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', outputs[0].fileUrl);
                              e.dataTransfer.setData('application/json', JSON.stringify({ url: outputs[0].fileUrl, type: mediaType }));
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            className="w-full h-full relative cursor-grab active:cursor-grabbing group/media"
                          >
                            {mediaType === 'video' ? (
                              <video
                                src={outputs[0].fileUrl}
                                controls
                                autoPlay
                                loop
                                muted
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={outputs[0].fileUrl}
                                alt={item.prompt}
                                onClick={() => setSelectedPreviewMedia({
                                  url: outputs[0].fileUrl,
                                  type: 'image',
                                  prompt: item.prompt,
                                  model: item.model,
                                  ratio: item.ratio
                                })}
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                              />
                            )}

                            {/* Top Action Buttons Bar */}
                            <div className="absolute top-3 right-3 z-30 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              
                              {/* Full Preview Lightbox Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPreviewMedia({
                                    url: outputs[0].fileUrl,
                                    type: mediaType,
                                    prompt: item.prompt,
                                    model: item.model,
                                    ratio: item.ratio
                                  });
                                }}
                                className="p-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-white hover:text-lime-400 transition-all shadow-lg"
                                title="Full screen preview"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>

                              {/* Reuse Prompt Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReusePrompt(item);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-xs font-bold text-lime-400 hover:bg-lime-400 hover:text-black transition-all shadow-lg"
                                title="Reuse prompt & settings"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reuse</span>
                              </button>

                              {/* Download Button */}
                              <a
                                href={outputs[0].fileUrl}
                                download
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-white hover:text-lime-400 transition-all shadow-lg"
                                title="Download full resolution"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>

                            {/* Bottom Info Overlay Badge */}
                            <div 
                              onClick={() => setSelectedPreviewMedia({
                                url: outputs[0].fileUrl,
                                type: mediaType,
                                prompt: item.prompt,
                                model: item.model,
                                ratio: item.ratio
                              })}
                              className="absolute inset-x-0 bottom-0 z-20 p-3 bg-gradient-to-t from-black via-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end space-y-1.5 cursor-pointer"
                            >
                              {/* Reference Media Thumbnails */}
                              {item.attachments && item.attachments.length > 0 && (
                                <div className="flex items-center gap-1 pt-0.5">
                                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Refs:</span>
                                  {item.attachments.map((att, i) => (
                                    <div key={i} className="w-5.5 h-5.5 rounded overflow-hidden border border-white/20 bg-black flex items-center justify-center">
                                      {att.type === 'video' ? (
                                        <video src={att.url} className="w-full h-full object-cover" muted playsInline />
                                      ) : att.type === 'audio' ? (
                                        <FileAudio className="w-3 h-3 text-lime-400" />
                                      ) : (
                                        <img src={att.url} alt="ref" className="w-full h-full object-cover" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <p className="text-[11px] text-gray-200 line-clamp-2 font-semibold leading-snug">
                                {item.prompt}
                              </p>

                              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-lime-500/20 text-lime-400 font-extrabold border border-lime-500/30 truncate max-w-[100px]">
                                  {item.model}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono font-bold">
                                  {item.ratio}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono font-bold">
                                  {item.quality}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Docked Control Panel at Bottom (Centered & Responsive) */}
          <div className="sticky bottom-6 z-40 w-full max-w-4xl px-4 mx-auto mt-auto pointer-events-auto">
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'bg-[#1a1c20]/95 border transition-all rounded-3xl p-4 shadow-2xl flex flex-col justify-between backdrop-blur-2xl relative',
                isDragging ? 'border-lime-400 bg-lime-950/30 shadow-[0_0_35px_rgba(163,230,53,0.4)]' : 'border-white/15'
              )}
            >
              {/* Drag & Drop Overlay Indicator */}
              {isDragging && (
                <div className="absolute inset-0 z-50 rounded-3xl bg-black/90 backdrop-blur-md border-2 border-dashed border-lime-400 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <Upload className="w-10 h-10 text-lime-400 animate-bounce" />
                  <span className="text-sm font-bold text-lime-400">Drop files or generated image here to attach</span>
                </div>
              )}

              {/* Media Attachments Slot & Prompt Area */}
              <div className="flex items-start gap-4">
                
                {/* Mode Switcher Buttons inside dock */}
                <div className="flex flex-col gap-1 bg-[#121316] border border-white/10 p-1 rounded-2xl flex-shrink-0">
                  <button
                    onClick={() => {
                      setActiveMode('image');
                      setQuality('1k');
                    }}
                    className={cn(
                      'p-2 rounded-xl transition-all',
                      activeMode === 'image' ? 'bg-lime-500/20 text-lime-400 border border-lime-500/40 shadow-sm' : 'text-gray-400 hover:text-white'
                    )}
                    title="AI Image Mode"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setActiveMode('video');
                      setQuality('720p');
                    }}
                    className={cn(
                      'p-2 rounded-xl transition-all',
                      activeMode === 'video' ? 'bg-lime-500/20 text-lime-400 border border-lime-500/40 shadow-sm' : 'text-gray-400 hover:text-white'
                    )}
                    title="AI Video Mode"
                  >
                    <Film className="w-4 h-4" />
                  </button>
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                />

                {/* Compact Stacked Media Card Deck (Handles local files + reused attachedUrls) */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-16 h-20 rounded-xl cursor-pointer transition-all flex-shrink-0 group my-auto"
                  title={uploadedFiles.length > 0 || attachedUrls.length > 0 ? `${uploadedFiles.length + attachedUrls.length} media file(s) attached. Click to add more or drag generated image here.` : 'Click to add media or drag generated image here'}
                >
                  {uploadedFiles.length === 0 && attachedUrls.length === 0 ? (
                    <div className="w-full h-full rounded-xl border-2 border-dashed border-white/20 hover:border-lime-400/80 bg-black/40 hover:bg-black/60 flex flex-col items-center justify-center transition-all">
                      <Plus className="w-5 h-5 text-gray-500 group-hover:text-lime-400 transition-colors mb-0.5" />
                      <span className="text-[9px] text-gray-500 group-hover:text-gray-300 font-medium">Add Media</span>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {[...previewUrls, ...attachedUrls].slice(0, 3).map((item, idx) => {
                        const isTop = idx === 0;
                        const offsetRotate = idx === 0 ? '-6deg' : idx === 1 ? '4deg' : '0deg';
                        const offsetTranslateX = idx === 0 ? '-3px' : idx === 1 ? '3px' : '0px';

                        return (
                          <div
                            key={idx}
                            className={cn(
                              'absolute inset-0 rounded-xl overflow-hidden border border-white/30 bg-black shadow-xl transition-all',
                              isTop ? 'z-20 scale-100 border-white/40' : 'z-10 opacity-80'
                            )}
                            style={{
                              transform: `rotate(${offsetRotate}) translateX(${offsetTranslateX})`,
                            }}
                          >
                            {item.type === 'video' ? (
                              <video 
                                src={item.url} 
                                className="w-full h-full object-cover" 
                                autoPlay 
                                muted 
                                loop 
                                playsInline 
                              />
                            ) : item.type === 'audio' ? (
                              <FileAudio className="w-6 h-6 text-lime-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            ) : (
                              <img src={item.url} alt={`stack-${idx}`} className="w-full h-full object-cover" />
                            )}
                          </div>
                        );
                      })}

                      <div className="absolute -bottom-1 -right-1 z-30 w-5 h-5 rounded-full bg-black/90 border border-white/40 flex items-center justify-center text-lime-400 shadow-md group-hover:scale-110 transition-transform">
                        <Plus className="w-3 h-3" />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFiles([]);
                          setAttachedUrls([]);
                        }}
                        className="absolute -top-1.5 -left-1.5 z-30 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                        title="Clear attached media"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Textarea Prompt Field with @ Mention Popup */}
                <div className="flex-1 relative">
                  <textarea
                    value={prompt}
                    onChange={e => {
                      const val = e.target.value;
                      setPrompt(val);

                      const cursorIndex = e.target.selectionStart || val.length;
                      const textBeforeCursor = val.slice(0, cursorIndex);
                      const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

                      if (atMatch && (uploadedFiles.length > 0 || attachedUrls.length > 0)) {
                        setShowMentionPopup(true);
                      } else {
                        setShowMentionPopup(false);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && !showMentionPopup) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    ref={promptTextareaRef}
                    placeholder="Describe the scene you imagine... (Type @ to mention attached media or drag generated images here)"
                    className="w-full bg-transparent border-none outline-none text-sm text-gray-200 placeholder:text-gray-500 resize-none pt-1 max-h-[160px] overflow-y-auto"
                  />

                  {/* Possible Mentions Popup */}
                  {showMentionPopup && (uploadedFiles.length > 0 || attachedUrls.length > 0) && (
                    <div className="absolute left-0 bottom-full mb-2 w-56 bg-[#1a1c20] border border-white/15 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <span className="text-[10px] font-semibold text-gray-400 px-2 py-1 block uppercase tracking-wider">
                        Possible mentions
                      </span>
                      <div className="space-y-1 mt-1 max-h-48 overflow-y-auto">
                        {[...previewUrls, ...attachedUrls].map((item, idx) => {
                          const tagLabel = item.type.includes('video')
                            ? `Video ${idx + 1}`
                            : item.type.includes('audio')
                            ? `Audio ${idx + 1}`
                            : `Image ${idx + 1}`;

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                if (promptTextareaRef.current) {
                                  const textarea = promptTextareaRef.current;
                                  const text = textarea.value;
                                  const cursorIndex = textarea.selectionStart;
                                  
                                  const textBeforeCursor = text.slice(0, cursorIndex);
                                  const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                                  
                                  if (lastAtIndex !== -1) {
                                    const textAfterCursor = text.slice(cursorIndex);
                                    const newText = textBeforeCursor.slice(0, lastAtIndex) + `@${tagLabel} ` + textAfterCursor;
                                    setPrompt(newText);
                                    
                                    const newCursorPos = lastAtIndex + tagLabel.length + 2; // @ + tag + space
                                    setTimeout(() => {
                                      textarea.focus();
                                      textarea.setSelectionRange(newCursorPos, newCursorPos);
                                    }, 10);
                                  }
                                } else {
                                  const newText = prompt.replace(/@([a-zA-Z0-9_]*)$/, `@${tagLabel} `);
                                  setPrompt(newText);
                                }
                                setShowMentionPopup(false);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-lime-500/15 text-left text-xs transition-colors group"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-md overflow-hidden bg-black/60 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                  {item.type.includes('video') ? (
                                    <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                                  ) : item.type.includes('audio') ? (
                                    <FileAudio className="w-4 h-4 text-lime-400" />
                                  ) : (
                                    <img src={item.url} alt="thumb" className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <span className="font-semibold text-gray-200 group-hover:text-lime-400 transition-colors">
                                  {tagLabel}
                                </span>
                              </div>
                              <CheckCircle2 className="w-4 h-4 text-lime-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Controls Bar */}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/10 relative z-20">
                <div className="flex items-center gap-3">
                  
                  {/* Model Selector Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => { setIsModelOpen(!isModelOpen); setIsRatioOpen(false); }}
                      className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#24272e] border border-white/10 text-xs font-medium text-gray-200 hover:border-lime-500/40 transition-all max-w-[260px]"
                    >
                      {activeModelObj?.logo ? (
                        <div className="w-4 h-4 rounded bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                          <img src={activeModelObj.logo} alt="" className="w-3.5 h-3.5 object-contain" />
                        </div>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
                      )}
                      <span className="truncate text-left font-semibold text-gray-200">
                        {parseModelName(activeModelObj?.name || '').displayName}
                      </span>
                      {parseModelName(activeModelObj?.name || '').badge && (
                        <ModelBadge text={parseModelName(activeModelObj?.name || '').badge!} />
                      )}
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-0.5" />
                    </button>

                    {isModelOpen && (
                      <div className="absolute left-0 bottom-full mb-2 w-72 bg-[#1e2127] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 space-y-1">
                        {(activeMode === 'image' ? IMAGE_MODELS : VIDEO_MODELS).map(m => {
                          const { displayName, badge } = parseModelName(m.name);
                          const isSelected = (activeMode === 'image' ? selectedImageModel : selectedVideoModel) === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                if (activeMode === 'image') setSelectedImageModel(m.id);
                                else setSelectedVideoModel(m.id);
                                setIsModelOpen(false);
                              }}
                              className={cn(
                                'w-full text-left p-2 rounded-xl text-xs font-medium transition-all flex items-center gap-3',
                                isSelected
                                  ? 'bg-lime-500/10 text-lime-400 font-bold border border-lime-500/20 shadow-md'
                                  : 'text-gray-300 hover:bg-white/5 border border-transparent'
                              )}
                            >
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                                {m.logo ? (
                                  <img src={m.logo} alt="" className="w-5 h-5 object-contain" />
                                ) : (
                                  <Sparkles className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-gray-200">{displayName}</span>
                                  {badge && <ModelBadge text={badge} />}
                                </div>
                                {m.stats && (
                                  <div className="flex items-center gap-2 mt-1 text-[9px] text-gray-500 font-semibold">
                                    <span className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                      <Zap className="w-2.5 h-2.5 text-lime-400" /> {m.stats[0]}
                                    </span>
                                    <span className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                      <Clock className="w-2.5 h-2.5 text-gray-400" /> {m.stats[1]}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Integrated Graphic Aspect Ratio & Resolution Popover Modal */}
                  <div className="relative">
                    <button
                      onClick={() => { setIsRatioOpen(!isRatioOpen); setIsModelOpen(false); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#24272e] border border-white/10 text-xs font-semibold text-lime-400 hover:border-lime-500/40 transition-all"
                    >
                      <AspectRatioGraphic ratio={ratio} className="w-3.5 h-3.5 text-lime-400" />
                      <span>{ratio} / {quality}{activeMode === 'video' && ` / ${duration}`}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
                    </button>

                    {/* Popover Card Modal */}
                    {isRatioOpen && (
                      <div 
                        onClick={e => e.stopPropagation()}
                        onDragStart={e => e.stopPropagation()}
                        onDragOver={e => e.stopPropagation()}
                        onDragEnter={e => e.stopPropagation()}
                        onDragLeave={e => e.stopPropagation()}
                        onDrop={e => e.stopPropagation()}
                        className="absolute left-0 bottom-full mb-3 w-[340px] bg-[#141517] border border-white/15 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 space-y-4"
                      >
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-gray-400 tracking-wide block">Aspect Ratio</span>
                          <div className="grid grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
                            {currentAvailableRatios.map(r => {
                              const isSelected = ratio === r;
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setRatio(r)}
                                  className={cn(
                                    'flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square gap-1.5',
                                    isSelected
                                      ? 'bg-[#262c1d] border-lime-500/60 text-lime-400 shadow-[0_0_12px_rgba(163,230,53,0.25)] font-bold'
                                      : 'bg-[#1e2127] border-white/5 text-gray-300 hover:border-white/20 hover:bg-white/5'
                                  )}
                                >
                                  <AspectRatioGraphic ratio={r} className={cn('w-5 h-5', isSelected ? 'text-lime-400' : 'text-gray-400')} />
                                  <span className="text-[10px] truncate max-w-full font-mono">{r}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-white/10">
                          <span className="text-xs font-semibold text-gray-400 tracking-wide block">Resolution</span>
                          <div 
                            className="grid gap-2 bg-[#0d0e10] p-1 rounded-xl border border-white/5"
                            style={{ 
                              gridTemplateColumns: `repeat(${
                                activeMode === 'video' ? currentAvailableResolutions.length : 3
                              }, minmax(0, 1fr))` 
                            }}
                          >
                            {currentAvailableResolutions.map(q => {
                              const isSelected = quality === q;
                              return (
                                <button
                                  key={q}
                                  type="button"
                                  onClick={() => setQuality(q)}
                                  className={cn(
                                    'py-2 text-center rounded-lg text-[10px] font-bold transition-all',
                                    isSelected
                                      ? 'bg-[#24272e] text-white border border-white/15 shadow-md font-extrabold'
                                      : 'text-gray-400 hover:text-gray-200'
                                  )}
                                >
                                  {q}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Video Settings Toggles */}
                        {activeMode === 'video' && (
                          <>
                            {/* Duration — hidden for Gemini video-edit (follows input video) */}
                            {isGeminiVideoEdit ? (
                              <div className="space-y-2 pt-2 border-t border-white/10">
                                <label className="text-xs font-semibold text-gray-400 tracking-wide flex items-center gap-2 uppercase">
                                  <Clock className="w-3.5 h-3.5" /> Video Duration
                                </label>
                                <div className="flex items-center gap-2 bg-[#0d0e10] border border-white/5 rounded-xl px-3 py-2.5">
                                  <span className="text-[11px] text-amber-400 font-semibold">⚡ Auto</span>
                                  <span className="text-[11px] text-gray-500">
                                    {inputVideoDuration
                                      ? `Input: ~${inputVideoDuration}s → output: ${[4,6,8,10].find(d => d >= inputVideoDuration) ?? 10}s`
                                      : 'Output duration auto-set based on input video (max 10s)'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                            <div className="space-y-2 pt-2 border-t border-white/10">
                              <label className="text-xs font-semibold text-gray-400 tracking-wide flex items-center justify-between uppercase">
                                <span className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5" /> Video Duration
                                </span>
                                {currentVideoConfig.durationMode === 'slider' && (
                                  <span className="bg-[#242832] border border-white/10 text-white text-xs px-2 py-0.5 rounded-md font-mono">
                                    {duration.replace(/s$/, '')} s
                                  </span>
                                )}
                              </label>

                              {currentVideoConfig.durationMode === 'slider' ? (
                                <div className="flex items-center gap-3 pt-1">
                                  <input 
                                    type="range" 
                                    min={currentVideoConfig.minDuration || 4} 
                                    max={currentVideoConfig.maxDuration || 15} 
                                    step={1}
                                    value={parseInt(duration.replace(/[^0-9]/g, ''), 10) || 6}
                                    onChange={(e) => setDuration(`${e.target.value}s`)}
                                    className="w-full h-2 bg-[#0d0e10] rounded-lg appearance-none cursor-pointer accent-lime-400"
                                  />
                                </div>
                              ) : (
                                <div 
                                  className="grid gap-2 bg-[#0d0e10] p-1 rounded-xl border border-white/5"
                                  style={{ gridTemplateColumns: `repeat(${currentVideoConfig.durations.length}, minmax(0, 1fr))` }}
                                >
                                  {currentVideoConfig.durations.map(d => {
                                    const isSelected = duration === d;
                                    return (
                                      <button 
                                        key={d}
                                        type="button"
                                        onClick={() => setDuration(d)}
                                        className={cn(
                                          "py-1.5 text-center rounded-lg text-xs font-bold transition-all",
                                          isSelected ? "bg-[#24272e] text-white border border-white/15 shadow-md" : "text-gray-500 hover:text-gray-300"
                                        )}
                                      >
                                        {d}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            )}

                            {/* Real Person & Generate Audio Toggles */}
                            {(currentVideoConfig.supportsRealPerson || currentVideoConfig.supportsAudio) && (
                              <div className="flex gap-4 pt-2 border-t border-white/10">
                                {/* Real Person */}
                                {currentVideoConfig.supportsRealPerson && (
                                  <div className="flex-1 space-y-2">
                                    <span className="text-[11px] font-semibold text-gray-400 block uppercase">Real Person</span>
                                    <div className="grid grid-cols-2 gap-1 bg-[#0d0e10] p-0.5 rounded-lg border border-white/5">
                                      {['On', 'Off'].map(v => (
                                        <button 
                                          key={v}
                                          type="button"
                                          onClick={() => setRealPerson(v)}
                                          className={cn(
                                            "py-1.5 text-center rounded text-[10px] font-bold transition-all",
                                            realPerson === v ? "bg-[#24272e] text-white shadow-sm" : "text-gray-500"
                                          )}
                                        >
                                          {v}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Audio */}
                                {currentVideoConfig.supportsAudio && (
                                  <div className="flex-1 space-y-2">
                                    <span className="text-[11px] font-semibold text-gray-400 block uppercase">Audio</span>
                                    <div className="grid grid-cols-2 gap-1 bg-[#0d0e10] p-0.5 rounded-lg border border-white/5">
                                      {['On', 'Off'].map(v => (
                                        <button 
                                          key={v}
                                          type="button"
                                          onClick={() => setAudio(v)}
                                          className={cn(
                                            "py-1.5 text-center rounded text-[10px] font-bold transition-all",
                                            audio === v ? "bg-[#24272e] text-white shadow-sm" : "text-gray-500"
                                          )}
                                        >
                                          {v}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Batch Generator Count Selector (1x - 4x) */}
                  <div className="flex items-center bg-[#24272e] border border-white/10 p-0.5 rounded-xl text-xs font-bold">
                    {[1, 2, 3, 4].map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setBatchCount(count)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg transition-all',
                          batchCount === count ? 'bg-lime-400 text-black shadow-sm font-black' : 'text-gray-400 hover:text-white'
                        )}
                        title={`Generate ${count} result(s) per run`}
                      >
                        {count}x
                      </button>
                    ))}
                  </div>

                </div>

                {/* Standalone Generate Action Button */}
                <div className="flex items-center">
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="w-9 h-9 rounded-full bg-lime-400 hover:bg-lime-300 text-black flex items-center justify-center shadow-[0_0_20px_rgba(163,230,53,0.6)] hover:scale-105 transition-all disabled:opacity-50"
                    title={`Generate (${batchCount}x)`}
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-5 h-5 stroke-[2.5]" />}
                  </button>
                </div>

              </div>
            </div>
          </div>

        </main>
      </div>

      {/* ─── Full Preview Lightbox Modal ─────────────────────────────────────── */}
      {selectedPreviewMedia && (
        <div 
          onClick={() => setSelectedPreviewMedia(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
        >
          {/* Header Action Buttons */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-3">
            <a
              href={selectedPreviewMedia.url}
              download
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-lime-400 text-black hover:bg-lime-300 text-xs font-extrabold transition-all shadow-[0_0_20px_rgba(163,230,53,0.4)]"
            >
              <Download className="w-4 h-4" />
              <span>Download High-Res</span>
            </a>
            <button
              onClick={() => setSelectedPreviewMedia(null)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all shadow-xl"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Center High-Res Media Container */}
          <div 
            onClick={e => e.stopPropagation()}
            className="max-w-5xl max-h-[82vh] w-full flex flex-col items-center justify-center relative my-auto space-y-4"
          >
            {selectedPreviewMedia.type === 'video' ? (
              <video
                src={selectedPreviewMedia.url}
                controls
                autoPlay
                loop
                className="max-w-full max-h-[75vh] rounded-3xl shadow-2xl border border-white/15 object-contain"
              />
            ) : (
              <img
                src={selectedPreviewMedia.url}
                alt="Full Preview"
                className="max-w-full max-h-[75vh] rounded-3xl shadow-2xl border border-white/15 object-contain"
              />
            )}

            {/* Prompt & Meta Details Footer */}
            {selectedPreviewMedia.prompt && (
              <div className="px-6 py-3 rounded-2xl bg-[#141517]/90 border border-white/15 text-center max-w-2xl backdrop-blur-xl shadow-2xl space-y-1">
                <p className="text-xs sm:text-sm text-gray-200 font-medium line-clamp-2">
                  "{selectedPreviewMedia.prompt}"
                </p>
                <div className="flex items-center justify-center gap-2 pt-1 text-[10px] text-gray-400 font-mono">
                  {selectedPreviewMedia.model && (
                    <span className="text-lime-400 font-bold">{selectedPreviewMedia.model}</span>
                  )}
                  {selectedPreviewMedia.ratio && (
                    <span>• {selectedPreviewMedia.ratio}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuickCreatePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-black text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin text-lime-400" />
      </div>
    }>
      <QuickCreateContent />
    </Suspense>
  );
}
