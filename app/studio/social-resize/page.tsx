'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  Download,
  Loader2,
  Sparkles,
  Wand2,
  ChevronDown,
  Clock,
  Zap,
  MessageSquareQuote,
  FolderOpen,
  Plus,
  Trash2,
  Check,
  Edit2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '@/components/layout/Sidebar';
import { cn } from '@/lib/utils';
import { SOCIAL_PRESETS } from '@/lib/social-resize/presets';
import PreviewCard, { PreviewCardRef, CardState } from '@/components/social-resize/PreviewCard';
import { downloadBatchZip } from '@/lib/social-resize/export';
import { SocialResizeProject } from '@/lib/social-resize/projects';

const AI_MODELS = [
  { id: 'nano-banana-2', name: 'Nano Banana 2 (Recommended)', logo: '/model-logos/Gemini.png', stats: ['1K-4K', 'Best Quality & Fast'] },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro (Recommended)', logo: '/model-logos/Gemini.png', stats: ['1K-4K', 'Pro Outpainting'] },
  { id: 'seedream-v5-pro', name: 'SeeDream V5 Pro (New)', logo: '/model-logos/Seedance.png', stats: ['1K-2K', 'Exact Custom Size'] },
  { id: 'gpt-2.0', name: 'GPT Image 2.0 Edit (New)', logo: '/model-logos/GPT.png', stats: ['1K-4K', 'Wide Aspect Ratios'] },
  { id: 'flux-2-edit', name: 'Flux 2 Klein (Exclusive)', logo: '/model-logos/Flux.png', stats: ['Exact Custom Sizes', 'Precision Inpaint'] },
  { id: 'nano-banana-2-lite', name: 'Nano Banana 2 Lite (Fast)', logo: '/model-logos/Gemini.png', stats: ['1K-2K', 'Fastest'] }
];

const QUICK_PROMPT_SUGGESTIONS = [
  'Extend background seamlessly with matching studio atmosphere',
  'Put all product on the left and text on the right',
  'Keep product centered with wide luxury studio background',
  'Match exact color palette and floral podium textures'
];

const LOCAL_STORAGE_ACTIVE_PROJ_KEY = 'bqa_social_resize_active_project';

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
  if (cleanText.includes('RECOMMENDED')) {
    colorClass = 'bg-lime-500/20 text-lime-400 font-extrabold italic px-1.5 py-0.5 rounded border border-lime-500/30 text-[8px] tracking-wider';
  } else if (cleanText.includes('NEW')) {
    colorClass = 'bg-[#a3e635] text-[#0d0e10] font-black italic px-1.5 py-0.5 rounded text-[8px] tracking-wider';
  } else if (cleanText.includes('EXCLUSIVE')) {
    colorClass = 'bg-purple-500/20 text-purple-300 font-black italic px-1.5 py-0.5 rounded border border-purple-500/30 text-[8px] tracking-wider';
  } else if (cleanText.includes('FAST')) {
    colorClass = 'bg-amber-500/20 text-amber-400 font-extrabold italic px-1.5 py-0.5 rounded border border-amber-500/30 text-[8px] tracking-wider';
  } else {
    colorClass = 'bg-white/10 text-gray-300 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-wider';
  }
  return <span className={cn("uppercase text-[8px] font-bold px-1 py-0.5 rounded scale-90 inline-block align-middle", colorClass)}>{text}</span>;
}

export default function SocialResizePage() {
  // Project state
  const [projects, setProjects] = useState<SocialResizeProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('Main Resize Campaign');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  // Studio canvas state
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [focalPoint, setFocalPoint] = useState({ x: 0.5, y: 0.5 });
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [resolution, setResolution] = useState<'1k' | '2k' | '4k'>('1k');
  const [activeCategory, setActiveCategory] = useState<'all' | 'boutiqaat' | 'social'>('all');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  
  // Card states map (persists generated image history per preset id)
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  
  const [uploading, setUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [generatedPresets, setGeneratedPresets] = useState<Set<string>>(new Set());
  
  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const cardRefs = useRef<Record<string, PreviewCardRef | null>>({});
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Filter Presets (Boutiqaat Size includes Google Size)
  const activePresets = SOCIAL_PRESETS.filter(p => activeCategory === 'all' || p.category === activeCategory);

  // ── 1. Fetch & Initialize Projects from API / Local Storage ──────────────
  useEffect(() => {
    async function loadProjects() {
      try {
        // Try local storage for instant render
        const cachedProj = localStorage.getItem(LOCAL_STORAGE_ACTIVE_PROJ_KEY);
        if (cachedProj) {
          try {
            const parsed = JSON.parse(cachedProj);
            setActiveProjectId(parsed.id);
            setProjectName(parsed.name || 'Main Resize Campaign');
            setSourceImageUrl(parsed.sourceImageUrl || null);
            setFocalPoint(parsed.focalPoint || { x: 0.5, y: 0.5 });
            setSelectedModel(parsed.selectedModel || AI_MODELS[0].id);
            setResolution(parsed.resolution || '1k');
            setActiveCategory(parsed.activeCategory || 'all');
            setCustomPrompt(parsed.customPrompt || '');
            setCardStates(parsed.cardStates || {});
          } catch {}
        }

        const res = await fetch('/api/social-resize/projects');
        if (res.ok) {
          const data = await res.json();
          if (data.projects && data.projects.length > 0) {
            setProjects(data.projects);
            
            // If no active project or active project not in list, select first
            const active = data.projects.find((p: SocialResizeProject) => p.id === activeProjectId) || data.projects[0];
            if (active) {
              setActiveProjectId(active.id);
              setProjectName(active.name);
              setSourceImageUrl(active.sourceImageUrl || null);
              setFocalPoint(active.focalPoint || { x: 0.5, y: 0.5 });
              setSelectedModel(active.selectedModel || AI_MODELS[0].id);
              setResolution(active.resolution || '1k');
              setActiveCategory(active.activeCategory || 'all');
              setCustomPrompt(active.customPrompt || '');
              setCardStates(active.cardStates || {});
            }
          }
        }
      } catch (err) {
        console.warn('[Social Resize Load Projects Error]:', err);
      } finally {
        setIsInitialLoadDone(true);
      }
    }
    loadProjects();
  }, []);

  // ── 2. Debounced Auto-Save State to Backend and LocalStorage ──────────────
  const triggerAutoSave = useCallback((overrideData?: Partial<SocialResizeProject>) => {
    if (!isInitialLoadDone) return;
    
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      const currentProjectData: Partial<SocialResizeProject> = {
        id: activeProjectId || undefined,
        name: projectName,
        sourceImageUrl,
        focalPoint,
        selectedModel,
        resolution,
        activeCategory,
        customPrompt,
        cardStates,
        ...overrideData,
      };

      // Save to localStorage for instant tab transitions
      try {
        localStorage.setItem(LOCAL_STORAGE_ACTIVE_PROJ_KEY, JSON.stringify(currentProjectData));
      } catch {}

      // Save to Supabase API
      try {
        const res = await fetch('/api/social-resize/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentProjectData),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.project?.id && !activeProjectId) {
            setActiveProjectId(data.project.id);
          }
          // Refresh project list
          setProjects(prev => {
            const index = prev.findIndex(p => p.id === data.project?.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = data.project;
              return updated;
            }
            return [data.project, ...prev];
          });
        }
      } catch (err) {
        console.warn('[Auto-Save Sync Warning]:', err);
      }
    }, 1200);
  }, [
    isInitialLoadDone,
    activeProjectId,
    projectName,
    sourceImageUrl,
    focalPoint,
    selectedModel,
    resolution,
    activeCategory,
    customPrompt,
    cardStates
  ]);

  // Trigger auto-save whenever core states change
  useEffect(() => {
    if (isInitialLoadDone) {
      triggerAutoSave();
    }
  }, [
    sourceImageUrl,
    focalPoint,
    selectedModel,
    resolution,
    activeCategory,
    customPrompt,
    projectName,
    cardStates,
    triggerAutoSave,
    isInitialLoadDone
  ]);

  // Load image object when URL changes
  useEffect(() => {
    if (!sourceImageUrl) {
      setSourceImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setSourceImage(img);
    img.src = sourceImageUrl;
  }, [sourceImageUrl]);

  // ── Project Management Actions ──────────────────────────────────────────
  const handleCreateNewProject = async () => {
    setIsProjectDropdownOpen(false);
    const newProjName = `Campaign #${projects.length + 1}`;
    const toastId = toast.loading('Creating new campaign project...');
    try {
      const res = await fetch('/api/social-resize/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjName,
          sourceImageUrl: null,
          focalPoint: { x: 0.5, y: 0.5 },
          selectedModel: AI_MODELS[0].id,
          resolution: '1k',
          activeCategory: 'all',
          customPrompt: '',
          cardStates: {},
        }),
      });
      const data = await res.json();
      if (data.project) {
        setProjects(prev => [data.project, ...prev]);
        setActiveProjectId(data.project.id);
        setProjectName(data.project.name);
        setSourceImageUrl(null);
        setFocalPoint({ x: 0.5, y: 0.5 });
        setCustomPrompt('');
        setCardStates({});
        setSelectedPresets(new Set());
        setGeneratedPresets(new Set());
        toast.success('New campaign created!', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Failed to create project: ' + err.message, { id: toastId });
    }
  };

  const handleSelectProject = (proj: SocialResizeProject) => {
    setActiveProjectId(proj.id);
    setProjectName(proj.name);
    setSourceImageUrl(proj.sourceImageUrl || null);
    setFocalPoint(proj.focalPoint || { x: 0.5, y: 0.5 });
    setSelectedModel(proj.selectedModel || AI_MODELS[0].id);
    setResolution(proj.resolution || '1k');
    setActiveCategory(proj.activeCategory || 'all');
    setCustomPrompt(proj.customPrompt || '');
    setCardStates(proj.cardStates || {});
    setSelectedPresets(new Set());
    setIsProjectDropdownOpen(false);
    toast.success(`Switched to "${proj.name}"`);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projId: string) => {
    e.stopPropagation();
    if (projects.length <= 1) {
      toast.error('Cannot delete the only project');
      return;
    }
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await fetch(`/api/social-resize/projects?id=${projId}`, { method: 'DELETE' });
      const nextList = projects.filter(p => p.id !== projId);
      setProjects(nextList);
      if (activeProjectId === projId) {
        handleSelectProject(nextList[0]);
      }
      toast.success('Project deleted');
    } catch (err) {
      toast.error('Failed to delete project');
    }
  };

  // Handle Card State Changes from PreviewCard (history, index, useAIFill)
  const handleCardStateChange = useCallback((id: string, nextState: CardState) => {
    setCardStates(prev => {
      const existing = prev[id];
      if (
        existing &&
        existing.currentIndex === nextState.currentIndex &&
        existing.useAIFill === nextState.useAIFill &&
        existing.history.length === nextState.history.length
      ) {
        return prev;
      }
      return {
        ...prev,
        [id]: nextState,
      };
    });
  }, []);

  // Handle Focal Point Click
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setFocalPoint({ 
      x: Math.max(0, Math.min(1, x)), 
      y: Math.max(0, Math.min(1, y)) 
    });
  };

  // Upload Logic
  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/runninghub/upload', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.fileUrl) {
        setSourceImageUrl(data.fileUrl);
        setFocalPoint({ x: 0.5, y: 0.5 });
        toast.success('Image uploaded successfully');
      } else {
        toast.error('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch {
      toast.error('Upload failed. Please check connection.');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  });

  // Export Batch ZIP
  const handleBatchExport = async () => {
    if (generatedPresets.size === 0) return;
    setIsExporting(true);
    const toastId = toast.loading('Bundling generated images into ZIP...');
    try {
      const items = Array.from(generatedPresets).map(id => {
        const p = SOCIAL_PRESETS.find(preset => preset.id === id);
        if (!p) return null;
        const canvas = canvasRefs.current[p.id];
        return {
          canvas,
          baseName: projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'social_resize_ai',
          presetName: p.name,
          platformName: p.platform
        };
      }).filter(i => !!i && !!i.canvas) as any;

      if (items.length === 0) throw new Error("No generated canvases found");

      await downloadBatchZip(items);
      toast.success('ZIP downloaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error('Export failed: ' + err.message, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Selection Logic
  const toggleSelectAll = () => {
    if (selectedPresets.size === activePresets.length) {
      setSelectedPresets(new Set());
    } else {
      setSelectedPresets(new Set(activePresets.map(p => p.id)));
    }
  };

  const togglePresetSelect = (id: string) => {
    const next = new Set(selectedPresets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPresets(next);
  };

  const handleGeneratedStateChange = useCallback((id: string, isGenerated: boolean) => {
    setGeneratedPresets(prev => {
      const next = new Set(prev);
      if (isGenerated) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  // Batch Generate
  const handleBatchGenerate = () => {
    if (selectedPresets.size === 0) return;
    let count = 0;
    selectedPresets.forEach(id => {
      const ref = cardRefs.current[id];
      if (ref) {
        ref.triggerAIFill();
        count++;
      }
    });
    if (count > 0) {
      toast.success(`Triggered AI Fill for ${count} sizes!`);
    }
  };

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden font-sans text-text-primary">
      <Sidebar />
      
      {/* LEFT PANEL - Control Center */}
      <div className="w-[390px] flex-shrink-0 border-r border-border bg-bg-secondary flex flex-col overflow-y-auto">
        
        {/* Header with Project Selector */}
        <div className="p-5 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-bold flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-purple to-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              Social Resize Studio
            </h1>
            
            {/* Create New Project Button */}
            <button
              onClick={handleCreateNewProject}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[11px] font-semibold flex items-center gap-1.5 transition-all"
              title="Create new resize project"
            >
              <Plus className="w-3 h-3 text-lime-400" />
              New
            </button>
          </div>

          {/* Active Project Dropdown & Rename Bar */}
          <div className="relative">
            <div className="flex items-center justify-between bg-[#141518] p-2 rounded-xl border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FolderOpen className="w-3.5 h-3.5 text-lime-400 shrink-0 ml-1" />
                {isEditingName ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                      className="bg-black/60 text-xs px-2 py-0.5 rounded border border-lime-400/50 text-white w-full outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-1 text-lime-400 hover:text-white"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                    className="text-left text-xs font-bold text-gray-200 truncate flex-1 flex items-center justify-between"
                  >
                    <span className="truncate">{projectName}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
                  </button>
                )}
              </div>

              {!isEditingName && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 text-gray-400 hover:text-lime-400 rounded transition-colors"
                  title="Rename Project"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Project List Dropdown */}
            {isProjectDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProjectDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 w-full bg-[#1b1e24] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-2 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                    Saved Campaigns ({projects.length})
                  </div>
                  {projects.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProject(p)}
                      className={cn(
                        "p-2 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-all",
                        p.id === activeProjectId
                          ? "bg-lime-500/15 text-lime-400 border border-lime-500/30"
                          : "text-gray-300 hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs">{p.name}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">
                          {new Date(p.updatedAt).toLocaleDateString()} • {Object.keys(p.cardStates || {}).length} generated sizes
                        </p>
                      </div>
                      {projects.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteProject(e, p.id)}
                          className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors ml-2"
                          title="Delete campaign"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <p className="text-[11px] text-text-muted">Adapt banner & social assets with AI Outpainting & Smart Composition Directives.</p>
        </div>

        <div className="p-5 space-y-6">
          
          {/* Media Upload / Focal Point */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">Source Image</label>
              {sourceImageUrl && (
                <button 
                  onClick={() => setSourceImageUrl(null)}
                  className="text-[10px] text-text-muted hover:text-accent-red"
                >
                  Clear Image
                </button>
              )}
            </div>
            
            {!sourceImageUrl ? (
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-2xl cursor-pointer transition-all aspect-[4/3] flex items-center justify-center',
                  isDragActive
                    ? 'border-accent-purple bg-accent-purple/10'
                    : 'border-border hover:border-accent-purple/50 bg-bg-card hover:bg-accent-purple/5'
                )}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center gap-2 px-4 text-center">
                  {uploading ? (
                    <><Loader2 className="w-6 h-6 text-accent-purple animate-spin" /><p className="text-xs font-semibold">Uploading...</p></>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5 text-text-muted" />
                      </div>
                      <p className="text-xs font-semibold mt-1">Click or drag image here</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] text-accent-gold/80 bg-accent-gold/10 px-2 py-1.5 rounded border border-accent-gold/20 flex items-center gap-1.5">
                  <Wand2 className="w-3 h-3" /> Click on image to set Focal Point for manual crops
                </p>
                <div 
                  className="relative rounded-xl border border-border overflow-hidden bg-black aspect-auto cursor-crosshair group max-h-[260px]"
                  onClick={handleImageClick}
                  ref={imageContainerRef}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sourceImageUrl} alt="Source" className="w-full h-full object-contain" />
                  
                  {/* Focal Point Indicator */}
                  <div 
                    className="absolute w-5 h-5 -ml-2.5 -mt-2.5 pointer-events-none transition-all duration-200"
                    style={{ left: `${focalPoint.x * 100}%`, top: `${focalPoint.y * 100}%` }}
                  >
                    <div className="w-full h-full rounded-full border-2 border-white shadow-[0_0_8px_rgba(0,0,0,0.5)] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-accent-gold rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)]"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Creative Layout & Custom Prompt Directive */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-bg-card/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <MessageSquareQuote className="w-3.5 h-3.5 text-lime-400" />
                Creative Directive (Optional)
              </label>
              {customPrompt && (
                <button 
                  onClick={() => setCustomPrompt('')}
                  className="text-[10px] text-gray-400 hover:text-red-400"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed">
              Add layout or styling directives (e.g. &ldquo;extend background seamlessly with matching studio atmosphere&rdquo;). System will intelligently merge it with master prompts.
            </p>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Extend background seamlessly, maintain exact color palette..."
              rows={2}
              className="w-full p-2.5 rounded-lg border border-border bg-[#141517] text-text-primary text-xs focus:outline-none focus:border-accent-purple placeholder:text-gray-500 resize-none"
            />
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1 pt-1">
              {QUICK_PROMPT_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setCustomPrompt(sug)}
                  className="text-[9px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 text-left transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* AI Generative Model Selection */}
          <div>
            <label className="text-sm font-semibold block mb-1.5">AI Generative Model</label>
            <p className="text-[10px] text-text-muted mb-2.5">Choose the engine for generative fill and banner extrapolation.</p>
            
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-border bg-[#141517] hover:border-white/20 text-text-primary text-xs font-bold transition-all"
              >
                {(() => {
                  const activeModelObj = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[0];
                  const { displayName, badge } = parseModelName(activeModelObj.name);
                  return (
                    <div className="flex items-center gap-2.5 min-w-0">
                      {activeModelObj.logo && (
                        <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                          <img src={activeModelObj.logo} alt="" className="w-3.5 h-3.5 object-contain" />
                        </div>
                      )}
                      <span className="truncate text-left text-gray-200 font-semibold">{displayName}</span>
                      {badge && <ModelBadge text={badge} />}
                    </div>
                  );
                })()}
                <ChevronDown className="w-4 h-4 text-text-muted shrink-0 ml-2" />
              </button>

              {isModelDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsModelDropdownOpen(false)}
                  />
                  <div className="absolute left-0 bottom-full mb-2 w-full bg-[#1e2127] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150 max-h-80 overflow-y-auto">
                    {AI_MODELS.map(m => {
                      const { displayName, badge } = parseModelName(m.name);
                      const isSelected = selectedModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(m.id);
                            setIsModelDropdownOpen(false);
                          }}
                          className={cn(
                            'w-full text-left p-2.5 rounded-xl text-xs font-medium transition-all flex items-center gap-3',
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
                </>
              )}
            </div>
          </div>

          {/* AI Resolution Settings */}
          <div>
            <label className="text-sm font-semibold block mb-2">Output Resolution</label>
            <div className="grid grid-cols-3 gap-2">
              {(['1k', '2k', '4k'] as const).map(res => (
                <button
                  key={res}
                  onClick={() => setResolution(res)}
                  className={cn(
                    "py-2 rounded-lg border text-center font-bold text-xs transition-all",
                    resolution === res
                      ? "bg-accent-purple/10 border-accent-purple text-text-primary"
                      : "bg-bg-card border-border hover:border-border-light text-text-muted"
                  )}
                >
                  {res.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT PANEL - Previews */}
      <div className="flex-1 flex flex-col bg-bg-card relative">
        <div className="p-4 border-b border-border bg-bg-secondary flex items-center justify-between sticky top-0 z-10 shadow-sm">
          {/* Filters & Selection */}
          <div className="flex items-center gap-4">
            <div className="flex bg-bg-card border border-border p-1 rounded-lg gap-1">
              {[
                { id: 'all', label: 'All Sizes' },
                { id: 'boutiqaat', label: 'Boutiqaat Size' },
                { id: 'social', label: 'Social Media' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all",
                    activeCategory === cat.id ? "bg-bg-secondary text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Select All Checkbox */}
            {sourceImageUrl && activePresets.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text-primary bg-bg-card border border-border px-3 py-1.5 rounded-lg hover:border-accent-purple/50 transition-all">
                <input 
                  type="checkbox" 
                  checked={selectedPresets.size === activePresets.length && activePresets.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-border bg-bg-card accent-accent-purple cursor-pointer"
                />
                Select All ({activePresets.length})
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Generate Selected Button */}
            {selectedPresets.size > 0 && (
              <button
                onClick={handleBatchGenerate}
                disabled={!sourceImageUrl}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent-purple text-white font-bold text-xs hover:bg-accent-purple/90 disabled:opacity-50 disabled:grayscale transition-all"
              >
                <Wand2 className="w-4 h-4" />
                Generate Selected ({selectedPresets.size})
              </button>
            )}

            {generatedPresets.size > 0 && (
              <button
                onClick={handleBatchExport}
                disabled={isExporting}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-gold text-white font-bold text-xs hover:brightness-110 disabled:opacity-50 disabled:grayscale transition-all shadow-gold animate-fade-in"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export ZIP ({generatedPresets.size})
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!sourceImageUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-text-muted opacity-50">
              <Sparkles className="w-16 h-16 mb-4" />
              <p className="text-lg font-bold">Upload an image to start resizing</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
              {activePresets.map(preset => (
                <PreviewCard
                  key={preset.id}
                  ref={(el) => { cardRefs.current[preset.id] = el; }}
                  preset={preset}
                  sourceImage={sourceImage}
                  focalPoint={focalPoint}
                  aiModel={selectedModel}
                  resolution={resolution}
                  customPrompt={customPrompt}
                  initialCardState={cardStates[preset.id]}
                  onCardStateChange={handleCardStateChange}
                  isSelected={selectedPresets.has(preset.id)}
                  onToggleSelect={() => togglePresetSelect(preset.id)}
                  onGeneratedStateChange={handleGeneratedStateChange}
                  onCanvasReady={(id, canvas) => {
                    canvasRefs.current[id] = canvas;
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
