'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Download, Loader2, Sparkles, Wand2, X, ChevronDown, Clock, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '@/components/layout/Sidebar';
import { cn } from '@/lib/utils';
import { SOCIAL_PRESETS, SocialPreset } from '@/lib/social-resize/presets';
import PreviewCard, { PreviewCardRef } from '@/components/social-resize/PreviewCard';
import { downloadBatchZip } from '@/lib/social-resize/export';

const AI_MODELS = [
  { id: 'nano-banana-pro', name: 'Nano Banana Pro (Recommended)', logo: '/model-logos/Gemini.png', stats: ['1K-4K', 'High Quality'] },
  { id: 'nano-banana-2', name: 'Nano Banana 2 (Recommended)', logo: '/model-logos/Gemini.png', stats: ['1K-4K', 'Balanced'] },
  { id: 'nano-banana-2-lite', name: 'Nano Banana 2 Lite (Faster Low Quality)', logo: '/model-logos/Gemini.png', stats: ['1K-2K', 'Fastest'] },
  { id: 'gpt-2.0', name: 'GPT Image 2.0 (New)', logo: '/model-logos/GPT.png', stats: ['1K-4K', 'Standard'] },
  { id: 'flux-2-edit', name: 'Flux 2 Edit (Standard)', logo: '/model-logos/Flux.png', stats: ['1K-4K', 'Pro Edit'] }
];

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
  } else if (cleanText.includes('FASTER LOW QUALITY')) {
    colorClass = 'bg-amber-500/20 text-amber-400 font-extrabold italic px-1.5 py-0.5 rounded border border-amber-500/30 text-[8px] tracking-wider';
  } else if (cleanText.includes('EXCLUSIVE')) {
    colorClass = 'bg-[#a3e635] text-[#0d0e10] font-black italic px-1.5 py-0.5 rounded text-[8px] tracking-wider';
  } else {
    colorClass = 'bg-white/10 text-gray-300 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-wider';
  }
  return <span className={cn("uppercase text-[8px] font-bold px-1 py-0.5 rounded scale-90 inline-block align-middle", colorClass)}>{text}</span>;
}

export default function SocialResizePage() {
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [focalPoint, setFocalPoint] = useState({ x: 0.5, y: 0.5 });
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [resolution, setResolution] = useState<'1k' | '2k' | '4k'>('1k');
  const [activeCategory, setActiveCategory] = useState<'all' | 'social' | 'ads' | 'web' | 'boutiqaat'>('all');
  
  const [uploading, setUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [generatedPresets, setGeneratedPresets] = useState<Set<string>>(new Set());
  
  const canvasRefs = useRef<Record<string, HTMLCanvasElement>>({});
  const cardRefs = useRef<Record<string, PreviewCardRef | null>>({});
  
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Filter Presets
  const activePresets = SOCIAL_PRESETS.filter(p => activeCategory === 'all' || p.category === activeCategory);

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

  // Handle Focal Point Click
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Clamp to 0-1 just in case
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
        // Reset focal point to center for new images
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
          baseName: 'social_resize_ai',
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
      <div className="w-[380px] flex-shrink-0 border-r border-border bg-bg-secondary flex flex-col overflow-y-auto">
        <div className="p-5 border-b border-border">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-indigo-600 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </span>
            Social Resize
          </h1>
          <p className="text-xs text-text-muted mt-2">Adapt one image to all social formats instantly with AI Generative Fill & Focal Cropping.</p>
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
                  <Wand2 className="w-3 h-3" /> Click on the image to set the Focal Point
                </p>
                <div 
                  className="relative rounded-xl border border-border overflow-hidden bg-black aspect-auto cursor-crosshair group max-h-[300px]"
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

          {/* AI Resolution Settings */}
          <div>
            <label className="text-sm font-semibold block mb-2">AI Output Resolution</label>
            <p className="text-[10px] text-text-muted mb-3">Select output resolution (2K and 4K consume more tokens/time).</p>
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

          {/* AI Settings */}
          <div>
            <label className="text-sm font-semibold block mb-2">AI Generative Model</label>
            <p className="text-[10px] text-text-muted mb-3">Model used when you click "AI Fill" on a preview card.</p>
            
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
        </div>
      </div>

      {/* RIGHT PANEL - Previews */}
      <div className="flex-1 flex flex-col bg-bg-card relative">
        <div className="p-4 border-b border-border bg-bg-secondary flex items-center justify-between sticky top-0 z-10 shadow-sm">
          {/* Filters & Selection */}
          <div className="flex items-center gap-4">
            <div className="flex bg-bg-card border border-border p-1 rounded-lg gap-1">
              {['all', 'social', 'ads', 'web', 'boutiqaat'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat as any)}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all",
                    activeCategory === cat ? "bg-bg-secondary text-text-primary shadow-sm" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {cat === 'boutiqaat' ? 'Boutiqaat Size' : cat}
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
                Select All
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
