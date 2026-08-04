'use client';

import { useState } from 'react';
import {
  Sparkles, ImageIcon, Film, Plus, ArrowUp,
  ChevronDown, Sliders, Ratio, Zap, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface FloatingStudioDockProps {
  onGenerate: (data: { prompt: string; mode: string; model: string; ratio: string }) => void;
  isGenerating?: boolean;
}

const MODES = [
  { id: 'image', label: 'AI Image', icon: ImageIcon, color: 'text-purple-400' },
  { id: 'video', label: 'AI Video', icon: Film, color: 'text-pink-400' },
];

const RUNNINGHUB_MODELS = [
  { id: 'seedream-5', name: 'Seedream 5.0 Pro', badge: 'RunningHub' },
  { id: 'flux-1', name: 'FLUX.1 Ultra', badge: 'RunningHub' },
  { id: 'sdxl-turbo', name: 'SDXL Turbo', badge: 'RunningHub' },
  { id: 'kling-o3', name: 'Kling O3 (4K Video)', badge: 'RunningHub' },
  { id: 'veo-3.1', name: 'Google Veo 3.1', badge: 'RunningHub' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square' },
  { id: '9:16', label: '9:16 Vertical (Reels/TikTok)' },
  { id: '16:9', label: '16:9 Landscape' },
  { id: '4:3', label: '4:3 Catalog' },
];

export default function FloatingStudioDock({ onGenerate, isGenerating }: FloatingStudioDockProps) {
  const [selectedMode, setSelectedMode] = useState<'image' | 'video'>('image');
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(RUNNINGHUB_MODELS[0].id);
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showRatioMenu, setShowRatioMenu] = useState(false);

  const activeModelObj = RUNNINGHUB_MODELS.find(m => m.id === selectedModel) || RUNNINGHUB_MODELS[0];

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    onGenerate({
      prompt,
      mode: selectedMode,
      model: selectedModel,
      ratio: selectedRatio,
    });
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative rounded-3xl bg-bg-card/95 border border-border/80 p-4 shadow-2xl backdrop-blur-2xl transition-all hover:border-accent-gold/40">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Textarea Prompt */}
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={`Describe your vision in ${selectedMode.toUpperCase()} mode... Type @ to reference product asset`}
              rows={2}
              className="w-full bg-bg-primary/90 border border-border/60 rounded-2xl p-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-gold/60 focus:ring-1 focus:ring-accent-gold/40 resize-none transition-all"
            />
          </div>

          {/* Bottom Dock Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            
            {/* Left Tools (Mode & Ratio) */}
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Mode Selector */}
              <div className="flex items-center gap-1 bg-bg-primary p-1 rounded-xl border border-border/60">
                {MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = selectedMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSelectedMode(mode.id as any)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                        isActive
                          ? 'bg-accent-gold/20 text-accent-gold shadow-sm'
                          : 'text-text-muted hover:text-text-primary'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Aspect Ratio Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRatioMenu(!showRatioMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-primary border border-border/60 text-xs text-text-primary font-medium hover:border-accent-gold/40 transition-all"
                >
                  <Ratio className="w-3.5 h-3.5 text-text-muted" />
                  <span>{selectedRatio}</span>
                  <ChevronDown className="w-3 h-3 text-text-muted" />
                </button>

                {showRatioMenu && (
                  <div className="absolute left-0 bottom-full mb-2 w-48 bg-bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase">Aspect Ratio</div>
                    {ASPECT_RATIOS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRatio(r.id);
                          setShowRatioMenu(false);
                        }}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all',
                          selectedRatio === r.id
                            ? 'bg-accent-gold/15 text-accent-gold font-semibold'
                            : 'text-text-secondary hover:bg-white/5'
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Attach Asset Button */}
              <button
                type="button"
                onClick={() => setPrompt((p) => p + ' @Product ')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-bg-primary border border-border/60 text-xs text-text-muted hover:text-accent-gold hover:border-accent-gold/40 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Asset</span>
              </button>
            </div>

            {/* Right Tools (Model & Generate) */}
            <div className="flex items-center gap-2">
              
              {/* RunningHub Model Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-primary border border-border/60 text-xs text-text-primary font-medium hover:border-accent-gold/40 transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{activeModelObj.name}</span>
                  <ChevronDown className="w-3 h-3 text-text-muted" />
                </button>

                {showModelMenu && (
                  <div className="absolute right-0 bottom-full mb-2 w-52 bg-bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase">RunningHub Model Engine</div>
                    {RUNNINGHUB_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.id);
                          setShowModelMenu(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left',
                          selectedModel === m.id
                            ? 'bg-accent-gold/15 text-accent-gold font-semibold'
                            : 'text-text-secondary hover:bg-white/5'
                        )}
                      >
                        <span>{m.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <button
                type="submit"
                disabled={isGenerating}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-gold text-white font-semibold text-xs shadow-lg glow-gold hover:opacity-95 transition-all disabled:opacity-50 btn-lift"
              >
                {isGenerating ? (
                  <span>Generating...</span>
                ) : (
                  <>
                    <span>Generate</span>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
