'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { useTasks } from '@/hooks/useTasks';
import {
  Sparkles, Send, Plus, Image as ImageIcon, X, ChevronDown,
  Loader2, CheckCircle2, AlertCircle, Zap, Brain,
  RefreshCw, Download, Copy, Wand2, MessageSquare, Lightbulb,
  LayoutGrid, Upload, ImagePlus, Trash2, Search, Mic, MicOff, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────────────────
interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'image-request' | 'image-result' | 'enhanced-prompt';
  content: string;
  timestamp: number;
  // For image results
  images?: GeneratedImage[];
  taskId?: string;
  taskStatus?: 'queued' | 'running' | 'success' | 'failed';
  enhancedPrompt?: string;
  skillsUsed?: { id: string; name: string; icon: string }[];
  model?: string;
  slicedPrompts?: string[];
}

interface GeneratedImage {
  url: string;
  taskOutputId?: string;
}

interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}

// Model display config (merged with API capabilities at runtime)
const MODEL_DISPLAY: Record<string, { badge: string | null; color: string; hint?: string }> = {
  'nano-banana-2':   { badge: null, color: 'text-emerald-400', hint: 'Text & Image-to-Image' },
  'nano-banana-pro': { badge: 'Edit', color: 'text-amber-400', hint: 'Image editing only — requires reference image' },
  'gpt-2.0':         { badge: 'Popular', color: 'text-blue-400', hint: 'Text & Image-to-Image' },
  'grok-image':      { badge: null, color: 'text-purple-400', hint: 'Choose Grok sub-model below' },
};

const MODEL_ICONS: Record<string, string> = {
  'nano-banana-2': '/assets/icons/Nano Banana-icon.png',
  'nano-banana-pro': '/assets/icons/Nano Banana-icon.png',
  'gpt-2.0': '/assets/icons/Gpt 2-icon.png',
  'grok-image': '/assets/icons/Grok-icon.png',
};

const GROK_SUB_MODELS = ['g-3', 'g-4', 'g-4.1', 'g-4.2'] as const;

const LLM_MODELS_LIST = [
  { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', badge: 'Fastest', color: 'text-emerald-400', desc: 'Google standard fast model' },
  { id: 'anthropic/claude-opus-4.8', name: 'Claude Opus 4.8', badge: 'Creative', color: 'text-orange-400', desc: 'Highly conversational & visual consultant' },
  { id: 'openai/gpt-5.5', name: 'GPT 5.5', badge: 'Reasoning', color: 'text-blue-400', desc: 'OpenAI high intelligence reasoning model' },
  { id: 'deepseek/deepseek-v4-flash', name: 'Deepseek v4 Flash', badge: 'Efficient', color: 'text-purple-400', desc: 'Fast, structured answers' },
];

// Default aspect ratios shown in quick-pick row (updated dynamically per model)
const DEFAULT_ASPECT_RATIOS = ['1:1', '16:9', '4:3', '3:4', '9:16'];

interface ModelConfig {
  id: string;
  name: string;
  supportedModes: string[];
  supportedAspectRatios: string[];
  supportedResolutions: string[];
  defaultResolution: string;
  grokSubModels?: string[];
}

interface ReferenceImage {
  url: string;        // RunningHub CDN URL (for generation)
  previewUrl: string; // local preview URL (blob:...)
}

const SUGGESTED_PROMPTS = [
  "A luxury perfume bottle on a marble surface with soft studio light",
  "Minimalist skincare set with rose petals on white background",
  "Elegant watch on businessman's wrist, city background at sunset",
  "Vibrant summer dress on a model at golden hour beach",
];

const BASE_STORAGE_KEY = 'bqa_image_agent_sessions';

// ─── Utility ───────────────────────────────────────────────────────────────
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getStorageKey(userId?: string | null): string {
  if (!userId) return BASE_STORAGE_KEY;
  return `${BASE_STORAGE_KEY}_${userId}`;
}

// ── Local storage helpers (used as fallback when DB table is missing) ──────
function loadSessionsLocal(userId?: string | null): ConversationSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getStorageKey(userId);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessionsLocal(sessions: ConversationSession[], userId?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(sessions.slice(0, 50)));
  } catch {}
}

// ── API helpers ─────────────────────────────────────────────────────────────
async function fetchSessionsFromApi(): Promise<ConversationSession[]> {
  try {
    const res = await fetch('/api/image-agent/sessions');
    if (!res.ok) return [];
    const data = await res.json();
    if (data.dbTableMissing) return []; // table not yet created
    // Map DB rows to ConversationSession shape
    return (data.sessions || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      createdAt: new Date(s.created_at).getTime(),
      messages: s.messages || [],
    }));
  } catch { return []; }
}

// Strip base64 data-URIs from a sessions array before persisting
// (base64 images are huge and should never leave the browser session)
function stripBase64FromSessions(sessions: ConversationSession[]): ConversationSession[] {
  return sessions.map(s => ({
    ...s,
    messages: s.messages.map(m => ({
      ...m,
      images: m.images
        ?.map(img => ({
          ...img,
          // Replace base64 with empty string; filter these out below
          url: img.url?.startsWith('data:') ? '' : img.url,
        }))
        .filter(img => img.url),
    })),
  }));
}

async function persistSessionToApi(session: ConversationSession): Promise<boolean> {
  try {
    // Strip base64 before sending — only persist HTTP URLs
    const [sanitised] = stripBase64FromSessions([session]);
    const res = await fetch('/api/image-agent/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sanitised.id,
        title: sanitised.title,
        messages: sanitised.messages,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.success === true;
  } catch { return false; }
}

async function deleteSessionFromApi(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/image-agent/sessions?id=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  } catch {}
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function ImageAgentPage() {
  const { addTask, tasks, updateTask } = useTasks();

  // Session state
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Helper to collect all network image URLs uploaded by the user in this session.
  // IMPORTANT: local base64/blob previews are intentionally excluded.
  const getAllSessionImages = useCallback(() => {
    const urls: string[] = [];
    messages.forEach(m => {
      if (m.role === 'user' && m.images) {
        m.images.forEach(img => {
          if (img.url && !img.url.startsWith('data:') && !img.url.startsWith('blob:') && !urls.includes(img.url)) {
            urls.push(img.url);
          }
        });
      }
    });
    return urls;
  }, [messages]);

  // Debounce timer ref for DB persistence — avoids flooding the API on every
  // intermediate state update (e.g. polling task status changes).
  const dbSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-current session ID ref — lets effects read the latest value without
  // stale-closure issues (safe to read inside setTimeout/async callbacks).
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  // Always-current messages ref — used by the auto-save effect below.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Trigger a debounced DB save (fires 1.5 s after the last call)
  const scheduleDbSync = useCallback((session: ConversationSession) => {
    if (dbSyncTimerRef.current) clearTimeout(dbSyncTimerRef.current);
    dbSyncTimerRef.current = setTimeout(() => {
      persistSessionToApi(session);
    }, 1500);
  }, []);

  // Input state
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('nano-banana-2');
  const [selectedCount, setSelectedCount] = useState<number>(1);
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [selectedResolution, setSelectedResolution] = useState<'1k' | '2k' | '4k'>('1k');
  const [selectedGrokModel, setSelectedGrokModel] = useState<string>('g-4.2');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  // Image upload state (for I2I / edit mode)
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]); //CDN URLs, base64 and previews
  const [uploadingCount, setUploadingCount] = useState<number>(0);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Model capabilities from API
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  const activeModelConfig = modelConfigs.find(m => m.id === selectedModel);
  const isI2IMode = referenceImages.length > 0;
  const aspectRatios = activeModelConfig?.supportedAspectRatios.slice(0, 6) || DEFAULT_ASPECT_RATIOS;
  const requiresImage = selectedModel === 'nano-banana-pro';

  // UI state
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [isRatioMenuOpen, setIsRatioMenuOpen] = useState(false);
  const [isSkillsPanelOpen, setIsSkillsPanelOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // LLM settings
  const [selectedLlmModel, setSelectedLlmModel] = useState('google/gemini-3.5-flash');
  const [isLlmMenuOpen, setIsLlmMenuOpen] = useState(false);
  const [isBrainstormMode, setIsBrainstormMode] = useState(true);
  const isAgentMode = isBrainstormMode;

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'id-ID'; // default language

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setInput(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + finalTranscript);
          }
        };

        rec.onerror = (e: any) => {
          console.error('Speech recognition error', e);
          if (e.error !== 'no-speech') {
            toast.error(`Voice error: ${e.error}`);
          }
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Voice input is not supported in this browser. Please use Chrome/Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      toast.success('Voice input stopped.');
    } else {
      recognitionRef.current.start();
      toast.success('Listening... Speak your prompt now.');
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Load skills & model configs ─────────────────────────────────────────
  useEffect(() => {
    fetch('/api/image-agent/skills')
      .then(r => r.json())
      .then(d => setSkills(d.skills || []))
      .catch(() => toast.error('Failed to load skills'))
      .finally(() => setIsLoadingSkills(false));

    fetch('/api/image-agent/generate')
      .then(r => r.json())
      .then(d => {
        if (d.models) setModelConfigs(d.models);
      })
      .catch(() => {}); // non-critical
  }, []);

  // ── Drag & Drop File Handlers ──────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    // Check if pointer actually left the container boundaries
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageFiles(e.dataTransfer.files);
    }
  };

  // ── Handle image file upload with background CDN uploading ─────────────
  function handleImageFiles(files: FileList | null) {
    if (!files) return;
    const maxImages = selectedModel === 'grok-image' ? 1 : 10;
    const remaining = maxImages - referenceImages.length;
    const toProcess = Array.from(files).slice(0, remaining);

    toProcess.forEach(async (file) => {
      if (file.size > 30 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 30MB)`);
        return;
      }

      // 1. Create a local preview URL for instant UI feedback
      const localUrl = URL.createObjectURL(file);
      
      // Add local preview placeholder immediately to state
      setReferenceImages(prev => [...prev, { url: '', previewUrl: localUrl }]);
      setUploadingCount(c => c + 1);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/runninghub/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadResult = await res.json();

        if (uploadResult && uploadResult.success && uploadResult.fileUrl) {
          // Replace placeholder with final values
          setReferenceImages(prev => prev.map(img => 
            img.previewUrl === localUrl 
              ? { url: uploadResult.fileUrl, previewUrl: localUrl } 
              : img
          ));
        } else {
          setReferenceImages(prev => prev.filter(img => img.previewUrl !== localUrl));
          toast.error(`Upload failed for ${file.name}: ${uploadResult?.error || 'Unknown error'}`);
        }
      } catch (err) {
        setReferenceImages(prev => prev.filter(img => img.previewUrl !== localUrl));
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setUploadingCount(c => Math.max(0, c - 1));
      }
    });
  }

  function removeReferenceImage(index: number) {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  }


  // Current user ID for scoping sessions
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // ── Load sessions: try API first, fall back to localStorage ──────────
  useEffect(() => {
    async function loadSessionsHybrid() {
      try {
        const meRes = await fetch('/api/auth/me');
        const meData = await meRes.json();
        const uId = meData?.user?.id || null;
        setCurrentUserId(uId);

        // 1. Load from localStorage immediately for instant render (scoped per user)
        const local = loadSessionsLocal(uId);
        if (local.length > 0) setSessions(local);

        // 2. Fetch from DB (authoritative, scoped to logged-in user)
        const remote = await fetchSessionsFromApi();
        if (remote.length > 0) {
          setSessions(remote);
          // Keep localStorage in sync with what the server returned
          saveSessionsLocal(remote, uId);
        } else if (local.length > 0) {
          setSessions(local);
        } else {
          setSessions([]);
        }
      } catch (err) {
        console.error('Failed to load image agent sessions:', err);
      }
    }
    loadSessionsHybrid();
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Sync task status updates into message bubbles ──────────────────────
  useEffect(() => {
    let hasNewCompletions = false;

    setMessages(prev => {
      const updated: ChatMessage[] = prev.map(msg => {
        if (!msg.taskId) return msg;
        const task = tasks.find(t => t.taskId === msg.taskId);
        if (!task) return msg;

        const statusMap: Record<string, ChatMessage['taskStatus']> = {
          QUEUED: 'queued', RUNNING: 'running', SUCCESS: 'success', FAILED: 'failed',
        };
        const newStatus = statusMap[task.status] ?? msg.taskStatus;

        if (task.status === 'SUCCESS' && task.outputs && task.outputs.length > 0) {
          if (msg.taskStatus !== 'success') hasNewCompletions = true;
          return {
            ...msg,
            taskStatus: 'success' as const,
            images: task.outputs.map(o => ({ url: o.fileUrl })),
          };
        }

        if (task.status === 'FAILED') {
          if (msg.taskStatus !== 'failed') hasNewCompletions = true;
          return { ...msg, taskStatus: 'failed' as const };
        }

        return { ...msg, taskStatus: newStatus };
      });

      // Persist session immediately when a task completes so images are
      // available in history on the next page load.
      if (hasNewCompletions) {
        const sessionId = activeSessionIdRef.current;
        if (sessionId) {
          // Defer so React has committed the new state before we read it
          setTimeout(() => {
            const latestMessages = messagesRef.current;
            updateSession(sessionId, latestMessages);
          }, 200);
        }
      }

      return updated;
    });
  }, [tasks]);

  // ── Session management ─────────────────────────────────────────────────
  function startNewSession() {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  }

  function loadSession(session: ConversationSession) {
    setActiveSessionId(session.id);
    setMessages(session.messages);
  }

  function deleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      saveSessionsLocal(next, currentUserId);
      return next;
    });
    deleteSessionFromApi(sessionId);
    if (activeSessionId === sessionId) startNewSession();
  }

  function updateSession(sessionId: string, newMessages: ChatMessage[]) {
    setSessions(prev => {
      const existing = prev.find(s => s.id === sessionId);
      const userMsg = newMessages.find(m => m.role === 'user');
      const title = userMsg?.content?.slice(0, 40) || 'New Session';

      let next: ConversationSession[];
      if (existing) {
        next = prev.map(s => s.id === sessionId ? { ...s, messages: newMessages } : s);
      } else {
        const newSession: ConversationSession = {
          id: sessionId,
          title,
          createdAt: Date.now(),
          messages: newMessages,
        };
        next = [newSession, ...prev];
      }

      saveSessionsLocal(next, currentUserId);
      return next;
    });

    setSessions(current => {
      const sessionToSave = current.find(s => s.id === sessionId);
      if (sessionToSave) scheduleDbSync(sessionToSave);
      return current;
    });
  }

  // ── Direct Image generation trigger (from brainstorm/enhanced bubbles) ─
  const handleGenerateImageDirect = useCallback(async (promptText: string, attachedImages?: string[]) => {
    setIsGenerating(true);
    const sessionId = activeSessionId || generateId();
    if (!activeSessionId) setActiveSessionId(sessionId);

    const combinedImageUrls = attachedImages || [];

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      type: 'image-request',
      content: `🎨 Generate image from brainstorm prompt...`,
      timestamp: Date.now(),
      images: combinedImageUrls.map(url => ({ url })),
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const genRes = await fetch('/api/image-agent/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          model: selectedModel,
          aspectRatio: selectedRatio,
          resolution: selectedResolution,
          imageUrls: combinedImageUrls.length > 0 ? combinedImageUrls : undefined,
          grokModel: selectedModel === 'grok-image' ? selectedGrokModel : undefined,
          count: selectedCount,
        }),
      });

      const genData = await genRes.json();
      if (!genRes.ok || !genData.taskId) {
        throw new Error(genData.error || genData.errorMessage || 'Image generation failed');
      }

      const taskIdsList = genData.taskIds || [genData.taskId];

      taskIdsList.forEach((tId: string) => {
        addTask(
          tId,
          'image-agent',
          `Image Agent: ${promptText.slice(0, 30)}...`,
          [{ nodeId: 'prompt', fieldName: 'text', fieldValue: promptText }],
          'enterprise'
        );
      });

      const modelDisplayName = modelConfigs.find(m => m.id === selectedModel)?.name || selectedModel;
      const newImageMsgList = taskIdsList.map((tId: string) => {
        const imageMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          type: 'image-result',
          content: promptText,
          timestamp: Date.now(),
          taskId: tId,
          taskStatus: 'queued',
          model: modelDisplayName,
          enhancedPrompt: promptText,
          images: combinedImageUrls.map(url => ({ url })),
        };
        return imageMsg;
      });

      setMessages(prev => {
        const withImages = [...prev, ...newImageMsgList];
        updateSession(sessionId, withImages);
        return withImages;
      });
      toast.success(`Started generating ${taskIdsList.length} image(s)!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  }, [activeSessionId, selectedModel, selectedCount, selectedRatio, selectedResolution, selectedGrokModel, modelConfigs, addTask, getAllSessionImages]);
  // ── Main submit handler ────────────────────────────────────────────────
  const handleSubmit = useCallback(async (promptText?: string) => {
    const finalInput = (promptText || input).trim();
    if (!finalInput && referenceImages.length === 0) return;
    if (isGenerating) return;

    const currentRefImages = referenceImages.map(img => img.url).filter(Boolean);
    const combinedImageUrls = currentRefImages;

    const attachedImagesCopy = combinedImageUrls.length > 0 
      ? combinedImageUrls.map(url => ({ url }))
      : undefined;

    setInput('');
    setReferenceImages([]);
    setIsGenerating(true);

    const sessionId = activeSessionId || generateId();
    if (!activeSessionId) setActiveSessionId(sessionId);

    // Add user message with attached reference images
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      type: 'image-request',
      content: finalInput || `[Attached ${attachedImagesCopy?.length || 0} image(s)]`,
      timestamp: Date.now(),
      images: attachedImagesCopy,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    try {
      let promptToGenerate = finalInput || 'Generate image from reference';
      let brainstormResponse: string | undefined = undefined;
      let skillsUsed: { id: string; name: string; icon: string }[] = [];
      let thinkingMsgId: string | null = null;

      // ── Step 1: LLM Agent Enhancement / Brainstorm ──────────────────
      if (isAgentMode) {
        const thinkingMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          type: 'enhanced-prompt',
          content: '...',
          timestamp: Date.now(),
        };
        thinkingMsgId = thinkingMsg.id;
        const withThinking = [...updatedMessages, thinkingMsg];
        setMessages(withThinking);

        const enhanceRes = await fetch('/api/image-agent/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userPrompt: finalInput || 'Analyze the attached image and describe details',
            skillIds: selectedSkillIds,
            conversationHistory: messages
              .filter(m => m.role !== 'system')
              .map(m => ({ role: m.role, content: m.content })),
            isBrainstorm: isBrainstormMode,
            llmModel: selectedLlmModel,
            imageUrls: currentRefImages.length > 0 ? currentRefImages : undefined,
          }),
        });

        const enhanceData = await enhanceRes.json();
        promptToGenerate = enhanceData.enhancedPrompt || finalInput || 'Generate image from reference';
        brainstormResponse = enhanceData.brainstormResponse;
        skillsUsed = enhanceData.skillsUsed || [];

        // Check if LLM returned sliced concepts to generate
        if (enhanceData.slicedPrompts && enhanceData.slicedPrompts.length > 0) {
          toast(`Smart Slice detected! Generating images for ${enhanceData.slicedPrompts.length} concepts...`);

          // Update the thinking bubble to show generation status
          setMessages(prev => prev.map(m =>
            m.id === thinkingMsg.id
              ? { ...m, content: `Loading:Smart Slice: Generating ${enhanceData.slicedPrompts.length} concept image(s)...` }
              : m
          ));

          const genPromises = enhanceData.slicedPrompts.map(async (promptText: string, index: number) => {
            try {
              const genRes = await fetch('/api/image-agent/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: promptText,
                  model: selectedModel,
                  aspectRatio: selectedRatio,
                  resolution: selectedResolution,
                  imageUrls: combinedImageUrls.length > 0 ? combinedImageUrls : undefined,
                  grokModel: selectedModel === 'grok-image' ? selectedGrokModel : undefined,
                  count: 1, // Generate 1 image per concept
                }),
              });
              const genData = await genRes.json();
              if (genRes.ok && genData.taskId) {
                const taskIdsList = genData.taskIds || [genData.taskId];
                taskIdsList.forEach((tId: string) => {
                  addTask(
                    tId,
                    'image-agent',
                    `Concept ${index + 1}: ${promptText.slice(0, 30)}...`,
                    [{ nodeId: 'prompt', fieldName: 'text', fieldValue: promptText }],
                    'enterprise'
                  );
                });

                const modelDisplayName2 = modelConfigs.find(m => m.id === selectedModel)?.name || selectedModel;
                return taskIdsList.map((tId: string) => ({
                  id: generateId(),
                  role: 'assistant' as const,
                  type: 'image-result' as const,
                  content: promptText,
                  timestamp: Date.now(),
                  taskId: tId,
                  taskStatus: 'queued' as const,
                  model: modelDisplayName2,
                  enhancedPrompt: promptText,
                  skillsUsed,
                }));
              }
            } catch (err) {
              console.error(`Failed to generate concept ${index + 1}:`, err);
            }
            return [];
          });

          const nestedMsgLists = await Promise.all(genPromises);
          const newImageMsgs = nestedMsgLists.flat();

          const enhancedMsg: ChatMessage = {
            id: thinkingMsg.id,
            role: 'assistant',
            type: 'enhanced-prompt',
            content: brainstormResponse || 'Generating all proposed concepts...',
            timestamp: Date.now(),
            skillsUsed,
            slicedPrompts: enhanceData.slicedPrompts,
          };

          const finalMessages = [...updatedMessages, enhancedMsg, ...newImageMsgs];
          setMessages(finalMessages);
          updateSession(sessionId, finalMessages);
          setIsGenerating(false);
          return;
        }

        const enhancedMsg: ChatMessage = {
          id: thinkingMsg.id,
          role: 'assistant',
          type: 'enhanced-prompt',
          content: brainstormResponse || promptToGenerate,
          timestamp: Date.now(),
          skillsUsed,
          enhancedPrompt: promptToGenerate !== finalInput ? promptToGenerate : undefined,
        };

        setMessages(prev => prev.map(m => m.id === thinkingMsg.id ? enhancedMsg : m));
      }

      // ── Step 2: Image Generation (Skip if in Brainstorm Consultation Mode) ─
      if (isBrainstormMode && isAgentMode) {
        // Brainstorm mode is conversational; let user read advice and click generate when ready.
        const finalMessages = [...updatedMessages, {
          id: generateId(),
          role: 'assistant' as const,
          type: 'enhanced-prompt' as const,
          content: brainstormResponse || promptToGenerate,
          timestamp: Date.now(),
          skillsUsed,
          enhancedPrompt: promptToGenerate !== finalInput ? promptToGenerate : undefined,
        }];
        setMessages(finalMessages);
        updateSession(sessionId, finalMessages);
        setIsGenerating(false);
        return;
      }

      // Direct Mode / Auto-Enhance: Generate image immediately
      if (thinkingMsgId) {
        setMessages(prev => prev.map(m =>
          m.id === thinkingMsgId
            ? { ...m, content: `Loading:Directing task to AI Engine...` }
            : m
        ));
      }

      const genRes = await fetch('/api/image-agent/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToGenerate,
          model: selectedModel,
          aspectRatio: selectedRatio,
          resolution: selectedResolution,
          imageUrls: combinedImageUrls.length > 0 ? combinedImageUrls : undefined,
          grokModel: selectedModel === 'grok-image' ? selectedGrokModel : undefined,
          count: selectedCount,
        }),
      });

      const genData = await genRes.json();

      if (!genRes.ok || !genData.taskId) {
        throw new Error(genData.error || genData.errorMessage || 'Image generation failed');
      }

      const taskIdsList = genData.taskIds || [genData.taskId];

      taskIdsList.forEach((tId: string) => {
        addTask(
          tId,
          'image-agent',
          `Image Agent: ${(finalInput || 'Image reference').slice(0, 30)}...`,
          [{ nodeId: 'prompt', fieldName: 'text', fieldValue: promptToGenerate }],
          'enterprise'
        );
      });

      const modelDisplayName2 = modelConfigs.find(m => m.id === selectedModel)?.name || selectedModel;
      const newImageMsgList = taskIdsList.map((tId: string) => {
        const imageMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          type: 'image-result',
          content: promptToGenerate,
          timestamp: Date.now(),
          taskId: tId,
          taskStatus: 'queued',
          model: modelDisplayName2,
          enhancedPrompt: isAgentMode ? promptToGenerate : undefined,
          skillsUsed,
        };
        return imageMsg;
      });

      const finalMessages = [...messages, userMsg, ...(isAgentMode ? [{
        id: generateId(),
        role: 'assistant' as const,
        type: 'enhanced-prompt' as const,
        content: promptToGenerate,
        timestamp: Date.now(),
        skillsUsed,
      }] : []), ...newImageMsgList];

      setMessages(finalMessages);
      updateSession(sessionId, finalMessages);

      toast.success(`Started generating ${taskIdsList.length} image(s)!`);

    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        type: 'text',
        content: `❌ Error: ${err.message}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  }, [input, messages, isGenerating, isAgentMode, isBrainstormMode, selectedLlmModel, selectedModel, selectedCount, selectedRatio, selectedResolution, selectedSkillIds, activeSessionId, addTask, modelConfigs, referenceImages, selectedGrokModel, getAllSessionImages]);

  // ── Keyboard handler ───────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isEmptyState = messages.length === 0;

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />

      {/* Chat History Sidebar */}
      <div className={cn(
        'flex flex-col bg-bg-secondary border-r border-border transition-all duration-300 flex-shrink-0 overflow-hidden',
        isSidebarCollapsed ? 'w-0 opacity-0' : 'w-60'
      )}>
        <div className="flex items-center justify-between p-4 border-b border-border h-16 flex-shrink-0">
          <span className="text-sm font-semibold text-text-primary">History</span>
          <button
            onClick={startNewSession}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-accent-gold hover:bg-accent-gold/10 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6 px-3">No history yet. Start generating!</p>
          ) : (
            sessions.map(session => (
              <button
                key={session.id}
                onClick={() => loadSession(session)}
                className={cn(
                  'group w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between gap-2',
                  activeSessionId === session.id
                    ? 'bg-accent-gold/10 text-accent-gold border border-accent-gold/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent'
                )}
              >
                <span className="truncate flex-1">
                  <MessageSquare className="w-3 h-3 inline mr-1.5 opacity-60" />
                  {session.title}
                </span>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-all flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />

        <main className="flex-1 overflow-hidden flex flex-col">

          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Toggle history sidebar */}
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
                title="Toggle history"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>

              {/* New chat */}
              <button
                onClick={startNewSession}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all border border-transparent hover:border-border"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            <div className="flex items-center gap-3">

              {/* Model selector */}
              <div className="relative">
                <button
                  onClick={() => { setIsModelMenuOpen(!isModelMenuOpen); setIsSkillsPanelOpen(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium bg-bg-card border border-border hover:border-border-light text-text-secondary hover:text-text-primary transition-all shadow-sm"
                >
                  {/* Miniature brand icon representing current model */}
                  {MODEL_ICONS[selectedModel] ? (
                    <img
                      src={MODEL_ICONS[selectedModel]}
                      alt="Model Icon"
                      className="w-4 h-4 object-contain rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded bg-bg-secondary flex items-center justify-center text-[10px] font-bold">G</div>
                  )}
                  <span className="text-text-primary font-semibold">
                    {modelConfigs.find(m => m.id === selectedModel)?.name || selectedModel}
                  </span>
                  {isI2IMode && <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">I2I</span>}
                  <ChevronDown className="w-3 h-3 text-text-muted" />
                </button>
                {isModelMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-bg-card border border-border rounded-2xl shadow-card-hover z-50 py-1 overflow-hidden animate-fade-in">
                    {/* Search filter input inside dropdown */}
                    <div className="p-3 border-b border-border bg-bg-secondary/40">
                      <div className="relative flex items-center bg-bg-secondary rounded-xl px-2.5 border border-border focus-within:border-accent-gold/40">
                        <Search className="w-3.5 h-3.5 text-text-muted mr-1.5 flex-shrink-0" />
                        <input
                          type="text"
                          placeholder="Search models..."
                          value={modelSearch}
                          onChange={e => setModelSearch(e.target.value)}
                          className="w-full bg-transparent py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none"
                        />
                        {modelSearch && (
                          <button onClick={() => setModelSearch('')} className="text-text-muted hover:text-text-primary">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Model List */}
                    <div className="max-h-96 overflow-y-auto p-1.5 space-y-0.5">
                      {(modelConfigs.length > 0 ? modelConfigs : Object.keys(MODEL_DISPLAY).map(id => ({ id, name: id, supportedModes: [] as string[] })))
                        .filter(m => m.name.toLowerCase().includes(modelSearch.toLowerCase()))
                        .map(m => {
                          const display = MODEL_DISPLAY[m.id] || { color: 'text-text-secondary', badge: null };
                          
                          // Determine correct badge and styling
                          let badgeText = m.id === 'nano-banana-2' ? 'RECOMMENDED' : 'PREMIUM';
                          let isRecommended = m.id === 'nano-banana-2';

                          // Custom brand icons mapping
                          const isGoogle = m.id.includes('banana');
                          const isGPT = m.id.includes('gpt');
                          
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                setSelectedModel(m.id);
                                setModelSearch('');
                                setIsModelMenuOpen(false);
                                // Reset ratio to 1:1 if current ratio not supported
                                const cfg = modelConfigs.find(c => c.id === m.id);
                                if (cfg && !cfg.supportedAspectRatios.includes(selectedRatio)) {
                                  setSelectedRatio(cfg.supportedAspectRatios[0] || '1:1');
                                }
                              }}
                              className={cn(
                                "w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 hover:bg-bg-hover",
                                selectedModel === m.id ? "bg-bg-hover" : ""
                              )}
                            >
                              {/* Brand logo container */}
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-bg-secondary border border-border/40 shadow-sm overflow-hidden">
                                {MODEL_ICONS[m.id] ? (
                                  <img
                                    src={MODEL_ICONS[m.id]}
                                    alt={m.name}
                                    className="w-6 h-6 object-contain"
                                  />
                                ) : (
                                  <span className="text-xs font-bold">AI</span>
                                )}
                              </div>

                              {/* Model Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={cn(
                                    "text-sm font-semibold text-text-primary",
                                    selectedModel === m.id && "gradient-text-gold"
                                  )}>
                                    {m.name}
                                  </span>
                                  {/* Yellow-Green lime/premium badge styling */}
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide bg-[#ccff00] text-black">
                                    {m.id === 'nano-banana-2' ? 'RECOMMENDED' :
                                     m.id === 'nano-banana-pro' ? 'EDITING' :
                                     m.id === 'gpt-2.0' ? 'INFOGRAPHIC' :
                                     m.id === 'grok-image' ? 'NOT BAD' : 'PREMIUM'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
                                  {m.id === 'nano-banana-2' ? "Google's standard generation model" :
                                   m.id === 'nano-banana-pro' ? "Google's high-fidelity image editor" :
                                   m.id === 'gpt-2.0' ? "True-color precision image rendering" :
                                   "Versatile image styles by xAI"}
                                </p>
                              </div>

                              {selectedModel === m.id && (
                                <CheckCircle2 className="w-4 h-4 text-accent-gold flex-shrink-0 mt-0.5" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* LLM Model Selector */}
              {isBrainstormMode && (
                <div className="relative">
                  <button
                    onClick={() => { setIsLlmMenuOpen(!isLlmMenuOpen); setIsModelMenuOpen(false); setIsRatioMenuOpen(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium bg-bg-card border border-border hover:border-border-light text-text-secondary hover:text-text-primary transition-all shadow-sm"
                  >
                    <Brain className="w-3.5 h-3.5 text-accent-gold" />
                    <span>LLM: {LLM_MODELS_LIST.find(l => l.id === selectedLlmModel)?.name || 'Gemini'}</span>
                    <ChevronDown className="w-3 h-3 text-text-muted" />
                  </button>
                  {isLlmMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-72 bg-bg-card border border-border rounded-2xl shadow-card-hover z-50 py-1 overflow-hidden animate-fade-in">
                      <div className="p-2.5 border-b border-border bg-bg-secondary/40">
                        <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider px-2">Compare LLM Models</span>
                      </div>
                      <div className="p-1 space-y-0.5 max-h-80 overflow-y-auto">
                        {LLM_MODELS_LIST.map(l => (
                          <button
                            key={l.id}
                            onClick={() => {
                              setSelectedLlmModel(l.id);
                              setIsLlmMenuOpen(false);
                            }}
                            className={cn(
                              "w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 hover:bg-bg-hover",
                              selectedLlmModel === l.id ? "bg-bg-hover" : ""
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={cn("text-xs font-semibold text-text-primary", selectedLlmModel === l.id && l.color)}>
                                  {l.name}
                                </span>
                                <span className="text-[8px] bg-bg-secondary text-text-muted px-1.5 py-0.5 rounded font-extrabold uppercase">
                                  {l.badge}
                                </span>
                              </div>
                              <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">{l.desc}</p>
                            </div>
                            {selectedLlmModel === l.id && <CheckCircle2 className="w-4 h-4 text-accent-gold flex-shrink-0 mt-0.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Skills Panel Button */}
              <button
                onClick={() => { setIsSkillsPanelOpen(!isSkillsPanelOpen); setIsModelMenuOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border",
                  isSkillsPanelOpen || selectedSkillIds.length > 0
                    ? "bg-accent-purple/10 text-accent-purple border-accent-purple/25"
                    : "text-text-muted border-border hover:border-border-light"
                )}
              >
                <Zap className="w-4 h-4" />
                Skills {selectedSkillIds.length > 0 && `(${selectedSkillIds.length})`}
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">

            {/* Skills Panel */}
            {isSkillsPanelOpen && (
              <div className="w-72 border-r border-border bg-bg-secondary flex flex-col animate-slide-in-right flex-shrink-0">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Zap className="w-4 h-4 text-accent-purple" /> Agent Skills
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">Combine modules to shape Iris's behavior</p>
                  </div>
                  <button onClick={() => setIsSkillsPanelOpen(false)} className="text-text-muted hover:text-text-primary">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {isLoadingSkills ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-accent-purple" />
                    </div>
                  ) : (
                    skills.map(skill => {
                      const active = selectedSkillIds.includes(skill.id);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => setSelectedSkillIds(prev =>
                            active ? prev.filter(id => id !== skill.id) : [...prev, skill.id]
                          )}
                          className={cn(
                            "w-full text-left p-3 rounded-xl border transition-all",
                            active
                              ? "bg-accent-purple/10 border-accent-purple/30 text-text-primary"
                              : "bg-bg-card border-border hover:border-border-light text-text-secondary hover:text-text-primary"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">{skill.icon}</span>
                            <span className="text-xs font-semibold">{skill.name}</span>
                            {active && <CheckCircle2 className="w-3 h-3 text-accent-purple ml-auto flex-shrink-0" />}
                          </div>
                          <p className="text-[11px] text-text-muted leading-relaxed">{skill.description}</p>
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {skill.tags.map(tag => (
                              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-bg-hover text-text-muted font-medium">{tag}</span>
                            ))}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedSkillIds.length > 0 && (
                  <div className="p-3 border-t border-border">
                    <button
                      onClick={() => setSelectedSkillIds([])}
                      className="w-full text-xs text-text-muted hover:text-accent-red transition-colors"
                    >
                      Clear all skills
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Chat Window */}
            <div 
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              className="flex-1 flex flex-col overflow-hidden relative"
            >

              {/* Drag and Drop File Overlay */}
              {isDraggingFile && (
                <div 
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="absolute inset-0 bg-accent-gold/10 backdrop-blur-md z-50 flex flex-col items-center justify-center border-2 border-dashed border-accent-gold/50 m-4 rounded-3xl animate-fade-in"
                >
                  <div className="p-8 rounded-2xl bg-bg-secondary/95 border border-border shadow-card flex flex-col items-center gap-4 text-center pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-accent-gold/10 flex items-center justify-center animate-bounce">
                      <ImagePlus className="w-8 h-8 text-accent-gold" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-text-primary">Drop images to upload</p>
                      <p className="text-xs text-text-muted mt-1 max-w-[240px]">Release your product images here to attach them to your conversation</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto">
                {isEmptyState ? (
                  /* ── Empty State ──────────────────────────────────── */
                  <div className="flex flex-col items-center justify-center h-full px-6 py-12 animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-gold to-amber-600 flex items-center justify-center mb-6 shadow-gold">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary mb-2">Iris Image Agent</h1>
                    <p className="text-sm text-text-muted text-center max-w-md mb-8">
                      Describe what you want to create in simple words. Iris will understand your vision, enhance your prompt intelligently, and generate stunning images.
                    </p>

                    {/* Suggestions */}
                    <div className="w-full max-w-5xl">
                      <p className="text-xs text-text-muted mb-3 text-center font-medium uppercase tracking-widest">Try asking:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {SUGGESTED_PROMPTS.map((prompt, i) => (
                          <button
                            key={i}
                            onClick={() => handleSubmit(prompt)}
                            className="group text-left p-4 rounded-xl bg-bg-card border border-border hover:border-accent-gold/30 hover:bg-bg-hover transition-all text-sm text-text-secondary hover:text-text-primary"
                          >
                            <Lightbulb className="w-3.5 h-3.5 text-accent-gold mb-2 opacity-70 group-hover:opacity-100 transition-opacity" />
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Messages ────────────────────────────────────── */
                  <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
                    {messages.map(msg => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        onRegenerate={() => handleSubmit(msg.content)}
                        onGenerateDirect={handleGenerateImageDirect}
                        onReusePrompt={(p) => setInput(p)}
                        onPreviewImage={(url) => setPreviewImageUrl(url)}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-border/50 bg-bg-primary p-4 flex-shrink-0">
                <div className="max-w-5xl mx-auto">

                  {/* Active skills indicator */}
                  {selectedSkillIds.length > 0 && isAgentMode && (
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-[10px] text-text-muted uppercase font-semibold tracking-wider">Active Skills:</span>
                      {selectedSkillIds.map(id => {
                        const skill = skills.find(s => s.id === id);
                        if (!skill) return null;
                        return (
                          <span key={id} className="flex items-center gap-1 text-[11px] bg-accent-purple/10 text-accent-purple border border-accent-purple/20 px-2 py-0.5 rounded-full">
                            {skill.icon} {skill.name}
                            <button onClick={() => setSelectedSkillIds(prev => prev.filter(x => x !== id))}>
                              <X className="w-3 h-3 ml-0.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Main input box */}
                  <div className={cn(
                    "relative flex flex-col rounded-2xl border transition-all duration-300",
                    "bg-bg-card",
                    "border-border focus-within:border-accent-gold/50 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.08)]"
                  )}>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isAgentMode
                        ? "Describe your vision in simple words... Iris will enhance it ✨"
                        : "Enter your detailed image prompt..."
                      }
                      rows={1}
                      className="w-full bg-transparent px-4 pt-4 pb-2 text-sm text-text-primary placeholder:text-text-muted resize-none outline-none max-h-32 overflow-y-auto"
                      style={{ minHeight: '52px' }}
                      onInput={e => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = Math.min(el.scrollHeight, 128) + 'px';
                      }}
                    />

                    {/* Reference images preview (for I2I) */}
                    {referenceImages.length > 0 && (
                      <div className="flex gap-2 px-4 pb-2 flex-wrap">
                        {referenceImages.map((img, i) => {
                          const isUploading = !img.url;
                           const displaySrc = img.previewUrl || img.url;
                          return (
                            <div key={i} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-border flex-shrink-0">
                              <img src={displaySrc} alt={`ref ${i + 1}`} className={cn("w-full h-full object-cover", isUploading && "opacity-40")} />
                              {isUploading ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <Loader2 className="w-4 h-4 animate-spin text-accent-gold" />
                                </div>
                              ) : (
                                <button
                                  onClick={() => removeReferenceImage(i)}
                                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {requiresImage && referenceImages.length === 0 && (
                          <span className="text-[10px] text-amber-400">⚠ This model requires a reference image</span>
                        )}
                      </div>
                    )}

                    {/* Bottom bar */}
                    <div className="flex items-center justify-between px-4 pb-3 pt-1 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">

                        {/* Image upload button */}
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          multiple={selectedModel !== 'grok-image'}
                          onChange={e => handleImageFiles(e.target.files)}
                          className="hidden"
                        />
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className={cn(
                            "w-8 h-8 rounded-lg border transition-all flex items-center justify-center flex-shrink-0",
                            referenceImages.length > 0
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                              : requiresImage
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-400 animate-pulse"
                                : "bg-bg-secondary border-border text-text-muted hover:text-text-secondary hover:border-border-light"
                          )}
                          title="Upload reference image for Image-to-Image"
                        >
                          <ImagePlus className="w-4 h-4" />
                        </button>

                        {/* Aspect Ratio selector */}
                        <div className="relative">
                          <button
                            onClick={() => { setIsRatioMenuOpen(!isRatioMenuOpen); setIsModelMenuOpen(false); }}
                            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border bg-bg-secondary border-border text-text-muted hover:text-text-secondary hover:border-border-light transition-all"
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>Ratio: {selectedRatio}</span>
                            <ChevronDown className="w-3 h-3 text-text-muted" />
                          </button>
                          {isRatioMenuOpen && (
                            <div className="absolute bottom-full left-0 mb-2 w-56 bg-bg-card border border-border rounded-xl shadow-card-hover z-50 p-2 animate-fade-in">
                              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1.5 px-1">Select Aspect Ratio</p>
                              <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-1">
                                {(activeModelConfig?.supportedAspectRatios || DEFAULT_ASPECT_RATIOS).map(r => {
                                  // Determine visual aspect box dimensions
                                  let widthClass = 'w-4';
                                  let heightClass = 'h-4';
                                  if (r === '16:9') { widthClass = 'w-5.5'; heightClass = 'h-3'; }
                                  else if (r === '9:16') { widthClass = 'w-3'; heightClass = 'h-5.5'; }
                                  else if (r === '4:3') { widthClass = 'w-5'; heightClass = 'h-3.5'; }
                                  else if (r === '3:4') { widthClass = 'w-3.5'; heightClass = 'h-5'; }
                                  else if (r === '21:9') { widthClass = 'w-6'; heightClass = 'h-2.5'; }
                                  else if (r === '9:21') { widthClass = 'w-2.5'; heightClass = 'h-6'; }
                                  else if (r === '3:2') { widthClass = 'w-5'; heightClass = 'h-3.5'; }
                                  else if (r === '2:3') { widthClass = 'w-3.5'; heightClass = 'h-5'; }
                                  else if (r === '1:4') { widthClass = 'w-2'; heightClass = 'h-6.5'; }
                                  else if (r === '4:1') { widthClass = 'w-6.5'; heightClass = 'h-2'; }
                                  else if (r === '1:8') { widthClass = 'w-1.5'; heightClass = 'h-7'; }
                                  else if (r === '8:1') { widthClass = 'w-7'; heightClass = 'h-1.5'; }

                                  return (
                                    <button
                                      key={r}
                                      onClick={() => { setSelectedRatio(r); setIsRatioMenuOpen(false); }}
                                      className={cn(
                                        "flex items-center gap-2 p-1.5 rounded-lg border text-[11px] transition-all justify-start",
                                        selectedRatio === r
                                          ? "bg-accent-gold/10 border-accent-gold/45 text-accent-gold font-semibold"
                                          : "bg-bg-secondary/40 border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                                      )}
                                    >
                                      {/* Icon representation of ratio box */}
                                      <div className="w-8 h-8 rounded bg-bg-secondary flex items-center justify-center flex-shrink-0">
                                        <div className={cn("border border-current rounded-sm opacity-70", widthClass, heightClass)} />
                                      </div>
                                      <span>{r}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Brainstorm Mode Toggle */}
                        <button
                          type="button"
                          onClick={() => setIsBrainstormMode(!isBrainstormMode)}
                          className={cn(
                            "flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-bold transition-all select-none",
                            isBrainstormMode
                              ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-400"
                              : "bg-bg-secondary border-border text-text-muted hover:text-text-secondary hover:border-border-light"
                          )}
                          title="Collaborative brainstorming consultation mode"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Brainstorm: {isBrainstormMode ? 'ON' : 'OFF'}</span>
                        </button>

                        {/* Grok sub-model selector */}
                        {selectedModel === 'grok-image' && (
                          <div className="flex items-center bg-bg-secondary rounded-lg p-0.5 gap-0.5">
                            {GROK_SUB_MODELS.map(gm => (
                              <button
                                key={gm}
                                onClick={() => setSelectedGrokModel(gm)}
                                className={cn(
                                  "text-[10px] px-2 py-1 rounded-md font-medium transition-all",
                                  selectedGrokModel === gm
                                    ? "bg-purple-500 text-white shadow-sm"
                                    : "text-text-muted hover:text-text-secondary"
                                )}
                              >
                                {gm}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Resolution selector */}
                        {activeModelConfig && activeModelConfig.supportedResolutions.length > 1 && (
                          <div className="flex items-center bg-bg-secondary rounded-lg p-0.5 gap-0.5">
                            {activeModelConfig.supportedResolutions.map(res => (
                              <button
                                key={res}
                                type="button"
                                onClick={() => setSelectedResolution(res as '1k' | '2k' | '4k')}
                                className={cn(
                                  "text-[10px] px-2 py-1 rounded-md font-medium transition-all",
                                  selectedResolution === res
                                    ? "bg-blue-500 text-white shadow-sm"
                                    : "text-text-muted hover:text-text-secondary"
                                )}
                              >
                                {res}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Batch Count selector (1x-4x) */}
                        <div className="flex items-center bg-bg-secondary rounded-lg p-0.5 gap-0.5">
                          {[1, 2, 3, 4].map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setSelectedCount(num)}
                              className={cn(
                                "text-[10px] px-2 py-1 rounded-md font-bold transition-all",
                                selectedCount === num
                                  ? "bg-blue-500 text-white shadow-sm"
                                  : "text-text-muted hover:text-text-secondary"
                              )}
                              title={`Generate ${num} image(s)`}
                            >
                              {num}x
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Mic voice input button */}
                        <button
                          type="button"
                          onClick={toggleListening}
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center transition-all border",
                            isListening
                              ? "bg-red-500/20 border-red-500/35 text-red-400 animate-pulse"
                              : "bg-bg-secondary border-border text-text-muted hover:text-text-secondary hover:border-border-light"
                          )}
                          title={isListening ? "Stop voice recognition" : "Type with voice"}
                        >
                          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSubmit()}
                          disabled={(!input.trim() && referenceImages.length === 0) || isGenerating || uploadingCount > 0 || (requiresImage && referenceImages.length === 0)}
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                            (input.trim() || (isI2IMode && !requiresImage)) && !isGenerating && uploadingCount === 0 && !(requiresImage && referenceImages.length === 0)
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:shadow-[0_0_15px_rgba(16,185,129,0.45)] hover:scale-105"
                              : "bg-bg-hover text-text-muted cursor-not-allowed opacity-60"
                          )}
                        >
                          {isGenerating || uploadingCount > 0
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Send className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>

                  {requiresImage && referenceImages.length === 0 && (
                    <p className="text-center text-[10px] text-amber-400/80 mt-1.5">
                      ⚠ Nano Banana Pro requires a reference image to edit.
                    </p>
                  )}
                  {uploadingCount > 0 && (
                    <p className="text-center text-[10px] text-accent-gold mt-1.5 animate-pulse">
                      Uploading image(s) to secure CDN...
                    </p>
                  )}
                  <p className="text-center text-[10px] text-text-muted mt-2">
                    Press <kbd className="px-1 py-0.5 bg-bg-card border border-border rounded text-[9px]">Enter</kbd> to send · <kbd className="px-1 py-0.5 bg-bg-card border border-border rounded text-[9px]">Shift+Enter</kbd> for new line
                  </p>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* Lightbox / Image Preview Modal */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          {/* Close trigger on backdrop click */}
          <div className="absolute inset-0" onClick={() => setPreviewImageUrl(null)} />
          
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center z-10 animate-scale-up">
            {/* Top bar controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button
                onClick={() => downloadImage(previewImageUrl)}
                className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all shadow-md"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="p-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all shadow-md"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image display */}
            <img
              src={proxySrc(previewImageUrl)}
              alt="High-resolution preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-card"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.startsWith(previewImageUrl)) target.src = previewImageUrl;
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}


// Helper function to compress images locally before sending to LLM vision completions
const compressImage = (file: File, maxW = 512, maxH = 512): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
        } else {
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string); // Fallback to raw base64 if canvas context creation fails
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress to JPEG with 0.7 quality to output a tiny ~30KB string
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedBase64);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};


// Proxy RunningHub CDN URLs through our API to avoid CORS.
// Falls back gracefully if /api/proxy-image is unreachable.
const proxySrc = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('/api/') || url.startsWith('blob:')) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

// Global download image helper
const downloadImage = async (url: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `iris-generated-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank');
  }
};

// ─── Message Bubble Component ───────────────────────────────────────────────
function MessageBubble({ message, onRegenerate, onGenerateDirect, onReusePrompt, onPreviewImage }: {
  message: ChatMessage;
  onRegenerate: () => void;
  onGenerateDirect?: (prompt: string, attachedImages?: string[]) => void;
  onReusePrompt?: (prompt: string) => void;
  onPreviewImage?: (url: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // User message
  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-3xl space-y-1.5">
          <div className="bg-accent-gold/10 border border-accent-gold/20 rounded-2xl rounded-br-md px-4 py-3">
            <p className="text-sm text-text-primary whitespace-pre-line">{message.content}</p>
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2.5">
                {message.images.map((img, idx) => (
                  <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border/80 bg-bg-secondary shadow-sm">
                    <img
                      src={img.url}
                      alt={`Attached reference ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-text-muted text-right">
            {new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  // Enhanced prompt from agent
  if (message.type === 'enhanced-prompt') {
    const isThinking = message.content === '...' || message.content.startsWith('Loading:');
    return (
      <div className="flex gap-3 animate-slide-up">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold to-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 max-w-4xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-accent-gold">Iris Agent</span>
            {!isThinking && message.skillsUsed && message.skillsUsed.length > 0 && (
              <div className="flex items-center gap-1">
                {message.skillsUsed.map(s => (
                  <span key={s.id} className="text-[10px] bg-accent-purple/10 text-accent-purple px-1.5 py-0.5 rounded-full border border-accent-purple/20">
                    {s.icon} {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="bg-bg-card border border-border rounded-2xl rounded-tl-md p-4">
            {isThinking ? (
              <div className="flex items-center gap-2 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin text-accent-gold" />
                <span className="text-sm italic">
                  {message.content.startsWith('Loading:')
                    ? message.content.substring(8)
                    : "Iris is thinking..."
                  }
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">
                    {message.enhancedPrompt ? "Brainstorm Discussion" : "Enhanced Prompt"}
                  </p>
                  <button
                    onClick={() => copyText(message.content)}
                    className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{message.content}</p>

                {message.enhancedPrompt && onGenerateDirect && (
                  <div className="mt-3.5 p-3 rounded-xl bg-bg-secondary border border-border flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-accent-gold font-bold uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 animate-pulse" /> Ready Prompt Draft
                      </p>
                      <p className="text-xs text-text-muted truncate mt-0.5 italic">"{message.enhancedPrompt}"</p>
                    </div>
                    <button
                      onClick={() => onGenerateDirect(message.enhancedPrompt!, message.images ? message.images.map(img => img.url) : undefined)}
                      className="px-3.5 py-1.5 rounded-lg bg-gradient-gold text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95 transition-all flex-shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate Image
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Image result
  if (message.type === 'image-result') {
    // When loaded from history, taskStatus is already 'success' with images —
    // show them immediately without waiting for the task poller.
    const hasImages = message.images && message.images.length > 0 &&
      message.images.some(img => img.url && img.url.startsWith('http'));
    const isRunning = !hasImages && (message.taskStatus === 'queued' || message.taskStatus === 'running' || !message.taskStatus);
    const isSuccess = hasImages; // show images whenever we have them
    const isFailed = !hasImages && message.taskStatus === 'failed';

    return (
      <div className="flex gap-3 animate-slide-up">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold to-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 max-w-4xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-text-secondary">Iris</span>
            {message.model && (
              <span className="text-[10px] text-text-muted bg-bg-card border border-border px-2 py-0.5 rounded-full">{message.model}</span>
            )}
          </div>

          {/* Image display area */}
          <div className="bg-bg-card border border-border rounded-2xl rounded-tl-md overflow-hidden">
            {isRunning && (
              <div className="flex flex-col items-center justify-center p-12 gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-amber-600/10 flex items-center justify-center">
                    <ImageIcon className="w-7 h-7 text-accent-gold/50" />
                  </div>
                  <div className="absolute inset-0 rounded-2xl border-2 border-accent-gold/30 animate-ping" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-text-primary">Generating your image...</p>
                  <p className="text-xs text-text-muted mt-1">This usually takes 20–60 seconds</p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-accent-gold/50 animate-bounce"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {isFailed && (
              <div className="flex flex-col items-center justify-center p-10 gap-3">
                <AlertCircle className="w-8 h-8 text-accent-red" />
                <p className="text-sm text-text-secondary">Generation failed. Please try again.</p>
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-red/10 hover:bg-accent-red/20 text-accent-red text-sm font-medium transition-colors border border-accent-red/20"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </button>
              </div>
            )}

            {isSuccess && message.images && message.images.length > 0 && (
              <div>
                <div className={cn(
                  "grid gap-2 p-3",
                  message.images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                )}>
                  {message.images.map((img, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden bg-black aspect-square">
                      <img
                        src={proxySrc(img.url)}
                        alt={`Generated image ${i + 1}`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback to direct URL if proxy fails
                          const target = e.target as HTMLImageElement;
                          if (!target.src.startsWith(img.url)) target.src = img.url;
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          onClick={() => onPreviewImage?.(img.url)}
                          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all animate-fade-in"
                          title="Preview full size"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadImage(img.url)}
                          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => copyText(img.url)}
                          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Yellow-green themed prompt metadata card */}
                {message.content && (
                  <div className="mx-3 mb-2.5 border border-[#ccff00]/25 bg-[#ccff00]/5 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] text-[#ccff00] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#ccff00]" />
                        Prompt Metadata (LLM Thinking)
                      </span>
                      {message.skillsUsed && message.skillsUsed.length > 0 && (
                        <div className="flex items-center gap-1 ml-2 mr-auto">
                          {message.skillsUsed.map(s => (
                            <span key={s.id} className="text-[9px] bg-accent-purple/20 text-white px-1.5 py-0.5 rounded-full border border-accent-purple/40">
                              {s.icon} {s.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => copyText(message.content)}
                          className="p-1 rounded bg-bg-card border border-border text-text-muted hover:text-text-primary transition-all flex items-center justify-center"
                          title="Copy Prompt"
                        >
                          {copied ? <CheckCircle2 className="w-3 h-3 text-accent-green" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {onReusePrompt && (
                          <button
                            onClick={() => {
                              onReusePrompt(message.content);
                              toast.success("Prompt copied to chat input!");
                            }}
                            className="px-2 py-0.5 rounded bg-bg-card border border-border text-text-muted hover:text-emerald-400 hover:border-emerald-500/30 transition-all flex items-center gap-1"
                            title="Reuse/Edit in Chatbot"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span className="text-[9px] font-bold">Reuse/Edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed bg-bg-card/50 p-2.5 rounded-lg border border-border/40 max-h-20 overflow-y-auto select-all scrollbar-thin">
                      {message.content}
                    </p>
                  </div>
                )}

                <div className="px-4 pb-3 flex items-center justify-between">
                  <p className="text-[11px] text-text-muted">
                    {message.images.length} image{message.images.length > 1 ? 's' : ''} generated
                  </p>
                  <button
                    onClick={onRegenerate}
                    className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Generic text message
  return (
    <div className="flex gap-3 animate-slide-up">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold to-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 max-w-4xl bg-bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3">
        <p className="text-sm text-text-secondary">{message.content}</p>
      </div>
    </div>
  );
}
