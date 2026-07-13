'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { SocialPreset } from '@/lib/social-resize/presets';
import { Download, Loader2, Wand2, Crop, ChevronLeft, ChevronRight, Trash2, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadSingleImage, downloadUrlDirectly, sanitizeFilename } from '@/lib/social-resize/export';
import toast from 'react-hot-toast';

export interface PreviewCardRef {
  triggerAIFill: () => void;
}

interface PreviewCardProps {
  preset: SocialPreset;
  sourceImage: HTMLImageElement | null;
  focalPoint: { x: number, y: number }; // 0 to 1
  aiModel: string;
  resolution: '1k' | '2k' | '4k';
  isSelected: boolean;
  onToggleSelect: () => void;
  onCanvasReady: (id: string, canvas: HTMLCanvasElement) => void;
}

interface GeneratedImage {
  url: string;
  modelId: string;
  modelName: string;
  resolution: string;
  timestamp: number;
}

const PreviewCard = forwardRef<PreviewCardRef, PreviewCardProps>(({ 
  preset, 
  sourceImage, 
  focalPoint, 
  aiModel, 
  resolution,
  isSelected,
  onToggleSelect,
  onCanvasReady 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // AI Fill states
  const [useAIFill, setUseAIFill] = useState(false);
  const [generatedHistory, setGeneratedHistory] = useState<GeneratedImage[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    triggerAIFill: () => {
      if (!isGenerating && sourceImage && !useAIFill) {
        handleAIFill(false);
      }
    }
  }));

  // Active image URL for drawing
  const activeImageUrl = historyIndex >= 0 && generatedHistory[historyIndex] 
    ? generatedHistory[historyIndex].url 
    : null;

  // ── Draw canvas (manual crop or AI result) ─────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;

    if (useAIFill && activeImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Dynamic full-resolution canvas size based on generated image to preserve 2K/4K quality
        const canvasRatio = preset.width / preset.height;
        const imgRatio = img.width / img.height;

        if (imgRatio > canvasRatio) {
          // Generated image is wider than target ratio
          canvas.height = img.height;
          canvas.width = Math.round(img.height * canvasRatio);
        } else {
          // Generated image is taller than target ratio
          canvas.width = img.width;
          canvas.height = Math.round(img.width / canvasRatio);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Center-cover crop calculation (avoid warping/stretching)
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (imgRatio > canvasRatio) {
          sw = img.height * canvasRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / canvasRatio;
          sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        onCanvasReady(preset.id, canvas);
      };
      img.onerror = () => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = preset.width;
          canvas.height = preset.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawManualCrop(ctx, canvas);
        }
        onCanvasReady(preset.id, canvas);
      };
      img.src = activeImageUrl;
      return;
    }

    // Manual Crop Mode dimensions
    canvas.width = preset.width;
    canvas.height = preset.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawManualCrop(ctx, canvas);
    onCanvasReady(preset.id, canvas);
  }, [sourceImage, focalPoint, preset, useAIFill, activeImageUrl, onCanvasReady]);

  function drawManualCrop(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    if (!sourceImage) return;
    const srcRatio = sourceImage.width / sourceImage.height;
    const targetRatio = preset.width / preset.height;

    let srcW = sourceImage.width;
    let srcH = sourceImage.height;
    let srcX = 0;
    let srcY = 0;

    if (srcRatio > targetRatio) {
      // Source is wider → crop horizontally based on focal X
      srcW = sourceImage.height * targetRatio;
      srcX = (sourceImage.width * focalPoint.x) - (srcW / 2);
      srcX = Math.max(0, Math.min(srcX, sourceImage.width - srcW));
    } else {
      // Source is taller → crop vertically based on focal Y
      srcH = sourceImage.width / targetRatio;
      srcY = (sourceImage.height * focalPoint.y) - (srcH / 2);
      srcY = Math.max(0, Math.min(srcY, sourceImage.height - srcH));
    }

    ctx.drawImage(sourceImage, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
  }

  // Re-draw whenever any relevant state changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Resolve user-friendly model name
  function getFriendlyModelName(modelId: string) {
    const maps: Record<string, string> = {
      'nano-banana-pro': 'Nano Banana Pro',
      'nano-banana-2': 'Nano Banana 2',
      'nano-banana-2-lite': 'Nano Banana 2 Lite',
      'gpt-2.0': 'GPT Image 2.0',
      'flux-2-edit': 'Flux 2 Edit'
    };
    return maps[modelId] || modelId;
  }

  // ── Trigger Generative Fill ────────────────────────────────────────────────
  async function handleAIFill(forceNew = false) {
    if (!sourceImage?.src) return;

    // Case 1: Re-activating existing generation from history
    if (!forceNew && generatedHistory.length > 0 && !useAIFill) {
      setUseAIFill(true);
      if (historyIndex === -1) {
        setHistoryIndex(generatedHistory.length - 1);
      }
      return;
    }

    // Case 2: Generating a new image (either first time or explicitly regenerating)
    setIsGenerating(true);
    const fillLabel = aiModel === 'flux-2-edit' ? 'Custom' : resolution.toUpperCase();
    const toastId = toast.loading(`Generating ${fillLabel} Fill with ${getFriendlyModelName(aiModel)}...`);

    try {
      const res = await fetch('/api/social-resize/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: sourceImage.src,
          model: aiModel,
          aspectRatio: `${preset.width}:${preset.height}`,
          resolution: resolution
        })
      });

      const data = await res.json();

      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'AI generation returned no image URL');
      }

      const resolvedResolutionLabel = aiModel === 'flux-2-edit' && data.width && data.height
        ? `${data.width}×${data.height}`
        : resolution.toUpperCase();

      const newImg: GeneratedImage = {
        url: data.imageUrl,
        modelId: aiModel,
        modelName: getFriendlyModelName(aiModel),
        resolution: resolvedResolutionLabel,
        timestamp: Date.now()
      };

      setGeneratedHistory(prev => {
        const next = [...prev, newImg];
        setHistoryIndex(next.length - 1);
        return next;
      });
      setUseAIFill(true);
      toast.success(`AI Fill completed successfully!`, { id: toastId });

    } catch (err: any) {
      toast.error(err.message || 'AI Fill failed', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  }

  // ── History Navigation ─────────────────────────────────────────────────────
  function handlePrev() {
    if (generatedHistory.length <= 1) return;
    setHistoryIndex(prev => (prev - 1 + generatedHistory.length) % generatedHistory.length);
  }

  function handleNext() {
    if (generatedHistory.length <= 1) return;
    setHistoryIndex(prev => (prev + 1) % generatedHistory.length);
  }

  function handleDeleteCurrent() {
    if (generatedHistory.length === 0) return;
    const nextHistory = generatedHistory.filter((_, idx) => idx !== historyIndex);
    setGeneratedHistory(nextHistory);
    
    if (nextHistory.length === 0) {
      setUseAIFill(false);
      setHistoryIndex(-1);
    } else {
      setHistoryIndex(Math.max(0, historyIndex - 1));
    }
    toast.success('Variation removed from history');
  }

  return (
    <div className={cn(
      "bg-bg-card border rounded-2xl overflow-hidden flex flex-col shadow-card transition-all",
      isSelected ? "border-accent-purple ring-1 ring-accent-purple" : "border-border"
    )}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-bg-secondary">
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={onToggleSelect}
            className="w-4 h-4 rounded border-border bg-bg-card accent-accent-purple cursor-pointer"
          />
          <div>
            <h4 className="text-xs font-semibold text-text-primary">{preset.platform}</h4>
            <p className="text-[10px] text-text-muted">{preset.name} • {preset.width}×{preset.height}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Action Buttons */}
          {useAIFill ? (
            <>
              {/* Reset to focal cropping */}
              <button
                onClick={() => setUseAIFill(false)}
                className="w-6 h-6 flex items-center justify-center rounded-lg border bg-bg-card text-text-muted border-border hover:text-text-primary hover:border-text-primary transition-all"
                title="Back to Manual Crop"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Regenerate with Current Sidebar Settings */}
              <button
                onClick={() => handleAIFill(true)}
                disabled={isGenerating}
                className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all border bg-bg-hover text-text-primary border-border hover:border-accent-purple/50"
                title={`Regenerate with current model: ${getFriendlyModelName(aiModel)} (${resolution.toUpperCase()})`}
              >
                <Wand2 className="w-3.5 h-3.5 text-accent-purple" />
                Regenerate
              </button>
            </>
          ) : (
            /* AI Fill Trigger Button */
            <button
              onClick={() => handleAIFill(false)}
              disabled={isGenerating}
              className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all border bg-accent-purple/10 text-accent-purple border-accent-purple/30 hover:bg-accent-purple/20"
              title="Use AI Generative Fill"
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              {generatedHistory.length > 0 ? "Use AI Fill" : "AI Fill"}
            </button>
          )}

        </div>
      </div>

      {/* Canvas Area */}
      <div className="p-4 flex-1 flex flex-col items-center justify-center bg-black/40 relative min-h-[160px] group/canvas">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-[240px] object-contain rounded-lg shadow-xl"
          style={{
            opacity: isGenerating ? 0.3 : 1,
            transition: 'opacity 0.3s'
          }}
        />

        {/* Loading Indicator */}
        {isGenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px]">
            <Loader2 className="w-7 h-7 text-accent-purple animate-spin mb-2" />
            <span className="text-[10px] text-accent-purple font-black bg-black/80 px-2 py-1 rounded shadow-lg border border-accent-purple/20">
              {aiModel === 'flux-2-edit' ? 'GENERATING CUSTOM DIMS...' : `GENERATING ${resolution.toUpperCase()}...`}
            </span>
          </div>
        )}

        {/* Hover Action Overlay */}
        {!isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/60 opacity-0 group-hover/canvas:opacity-100 transition-opacity duration-200 rounded-xl pointer-events-none group-hover/canvas:pointer-events-auto z-10">
            {/* Eye / Preview button (only for AI fill result) */}
            {useAIFill && activeImageUrl && (
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/25 shadow-lg transition-all transform hover:scale-105 active:scale-95"
                title="Preview full size image"
              >
                <Eye className="w-5 h-5" />
              </button>
            )}

            {/* Download Button (for both modes) */}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (useAIFill && activeImageUrl) {
                  const toastId = toast.loading('Downloading high-res image...');
                  try {
                    const safePlatform = sanitizeFilename(preset.platform);
                    const safePreset = sanitizeFilename(preset.name);
                    const ext = activeImageUrl.split('.').pop()?.split('?')[0] || 'png';
                    const filename = `image_${safePlatform}_${safePreset}_ai.${ext}`;
                    await downloadUrlDirectly(activeImageUrl, filename);
                    toast.success('Download completed!', { id: toastId });
                  } catch (err: any) {
                    toast.error('Download failed, opening in new tab', { id: toastId });
                    window.open(activeImageUrl, '_blank');
                  }
                } else if (canvasRef.current) {
                  downloadSingleImage(canvasRef.current, 'image', preset.name, preset.platform);
                }
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-accent-purple hover:bg-accent-purple/85 text-white shadow-lg transition-all transform hover:scale-105 active:scale-95 border border-accent-purple/20"
              title="Download image"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Carousel controls Footer (renders if AI image is active and placed outside canvas) */}
      {useAIFill && generatedHistory.length > 0 && !isGenerating && (
        <div className="border-t border-border px-3 py-2 bg-bg-secondary flex items-center justify-between text-[10px] shadow-sm">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={generatedHistory.length <= 1}
              className="p-1 rounded-lg bg-bg-card hover:bg-bg-hover text-text-primary border border-border disabled:opacity-30 disabled:pointer-events-none"
              title="Previous variation"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNext}
              disabled={generatedHistory.length <= 1}
              className="p-1 rounded-lg bg-bg-card hover:bg-bg-hover text-text-primary border border-border disabled:opacity-30 disabled:pointer-events-none"
              title="Next variation"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="flex flex-col text-center overflow-hidden max-w-[150px]">
            <span className="font-bold text-text-primary truncate">
              {generatedHistory[historyIndex]?.modelName}
            </span>
            <span className="text-[8px] text-text-muted mt-0.5">
              Variation {historyIndex + 1} of {generatedHistory.length} • {generatedHistory[historyIndex]?.resolution}
            </span>
          </div>

          <button
            onClick={handleDeleteCurrent}
            className="p-1 rounded-lg hover:bg-accent-red/10 text-text-muted hover:text-accent-red transition-colors"
            title="Delete this variation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Full screen Lightbox Preview Modal */}
      {isPreviewOpen && activeImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-6 backdrop-blur-md animate-fade-in">
          {/* Modal Header */}
          <div className="w-full max-w-[90vw] flex items-center justify-between gap-4 z-50 bg-black/40 p-3 rounded-xl border border-border/10">
            <div className="text-left text-xs">
              <p className="font-bold text-text-primary">{preset.platform} — {preset.name}</p>
              <p className="text-[10px] text-text-muted mt-0.5">
                {generatedHistory[historyIndex]?.modelName} ({generatedHistory[historyIndex]?.resolution})
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Download in lightbox */}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const toastId = toast.loading('Downloading high-res image...');
                  try {
                    const safePlatform = sanitizeFilename(preset.platform);
                    const safePreset = sanitizeFilename(preset.name);
                    const ext = activeImageUrl.split('.').pop()?.split('?')[0] || 'png';
                    const filename = `image_${safePlatform}_${safePreset}_ai.${ext}`;
                    await downloadUrlDirectly(activeImageUrl, filename);
                    toast.success('Download completed!', { id: toastId });
                  } catch (err: any) {
                    toast.error('Download failed, opening in new tab', { id: toastId });
                    window.open(activeImageUrl, '_blank');
                  }
                }}
                className="p-2 rounded-lg bg-accent-purple hover:bg-accent-purple/80 text-white transition-colors flex items-center justify-center"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Close modal */}
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 rounded-lg bg-bg-card hover:bg-bg-hover text-text-primary border border-border transition-colors flex items-center justify-center"
                title="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Image container */}
          <div className="flex-1 w-full max-w-[90vw] my-4 flex items-center justify-center min-h-0 relative select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={activeImageUrl} 
              alt={`${preset.platform} ${preset.name} Full Size Preview`}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-border/20" 
            />
          </div>
          
          {/* Spacer footer to balance the layout */}
          <div className="h-2 w-full" />
        </div>
      )}
    </div>
  );
});

PreviewCard.displayName = 'PreviewCard';
export default PreviewCard;
