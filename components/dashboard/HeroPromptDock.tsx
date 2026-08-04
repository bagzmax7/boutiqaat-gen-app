'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, ImageIcon, Film, Mic, ArrowUp, Plus,
  Layers, Volume2, UserCheck, ChevronDown, Wand2, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const MODES = [
  { id: 'image', label: 'AI Image', icon: ImageIcon, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  { id: 'video', label: 'AI Video', icon: Film, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/30' },
  { id: 'audio', label: 'AI Audio', icon: Volume2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  { id: 'avatar', label: 'AI Avatar', icon: UserCheck, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
];

const RUNNINGHUB_MODELS = [
  { id: 'seedream-5', name: 'Seedream 5.0 Pro', badge: 'RunningHub', type: 'image' },
  { id: 'kling-o3', name: 'Kling O3 Pro (4K)', badge: 'RunningHub', type: 'video' },
  { id: 'veo-3.1', name: 'Google Veo 3.1', badge: 'RunningHub', type: 'video' },
  { id: 'sora-2', name: 'Sora 2 Pro', badge: 'RunningHub', type: 'video' },
  { id: 'hailuo-2.3', name: 'Hailuo 2.3 Pro', badge: 'RunningHub', type: 'video' },
  { id: 'wan-2.6', name: 'Wan 2.6 Flash', badge: 'RunningHub', type: 'video' },
  { id: 'flux-1', name: 'FLUX.1 Ultra', badge: 'RunningHub', type: 'image' },
];

const PROMPT_SUGGESTIONS = [
  { label: '30s Luxury Perfume Ad', mode: 'video', prompt: 'Cinematic 30-second commercial for a luxury perfume bottle on a golden sand beach at sunset, 4K resolution, slow motion' },
  { label: 'Virtual Garment Try-On', mode: 'image', prompt: 'High fashion model wearing silk evening dress, studio lighting, Boutiqaat luxury aesthetic, 8K' },
  { label: 'Social Media Banner 9:16', mode: 'image', prompt: 'Vertical beauty product showcase with floating rose petals and soft neon studio glow' },
  { label: 'Lipstick Color Promo Video', mode: 'video', prompt: 'Extreme close up shot of vibrant red lipstick application, high gloss finish, 60fps' },
];

interface HeroPromptDockProps {
  onInitialPromptSubmit?: (prompt: string, model: string) => void;
}

export default function HeroPromptDock({ onInitialPromptSubmit }: HeroPromptDockProps) {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<'image' | 'video' | 'audio' | 'avatar'>('image');
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(RUNNINGHUB_MODELS[0].id);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const activeModelObj = RUNNINGHUB_MODELS.find(m => m.id === selectedModel) || RUNNINGHUB_MODELS[0];

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      toast.error('Please enter a prompt or select a suggestion');
      return;
    }

    router.push(`/boutiqaat-flow?mode=${selectedMode}&prompt=${encodeURIComponent(prompt)}&model=${selectedModel}`);
  }

  function handleSuggestionClick(s: typeof PROMPT_SUGGESTIONS[0]) {
    setPrompt(s.prompt);
    if (s.mode) {
      setSelectedMode(s.mode as any);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* ── Main Hero Card ────────────────────────────────────────── */}
      <div className="relative rounded-3xl bg-gradient-to-b from-bg-card/90 via-bg-card/70 to-bg-secondary/90 border border-border/80 p-6 shadow-2xl backdrop-blur-xl transition-all hover:border-accent-gold/40">
        
        {/* Top Glow & Title */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-gold flex items-center justify-center shadow-lg glow-gold">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary tracking-tight">
                Vibe Direct Your Next Content
              </h2>
              <p className="text-xs text-text-muted">
                Powered directly by RunningHub API models
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs bg-bg-primary/60 border border-border px-3 py-1.5 rounded-full text-text-secondary">
            <Zap className="w-3.5 h-3.5 text-accent-gold fill-accent-gold" />
            <span>RunningHub Ready</span>
          </div>
        </div>

        {/* Textarea Prompt Box */}
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={`Describe what you want to create in ${selectedMode.toUpperCase()} mode... (e.g. "@Product Bottle on marble pedestal with soft sunlight")`}
            rows={3}
            className="w-full bg-bg-primary/80 border border-border/60 rounded-2xl p-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-gold/60 focus:ring-1 focus:ring-accent-gold/40 resize-none transition-all"
          />

          {/* Bottom Dock Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-border/40">
            
            {/* Mode Switchers */}
            <div className="flex items-center gap-1.5 bg-bg-primary/90 p-1 rounded-xl border border-border/60">
              {MODES.map((mode) => {
                const Icon = mode.icon;
                const isActive = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSelectedMode(mode.id as any)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      isActive
                        ? `${mode.bg} ${mode.color} shadow-sm font-semibold`
                        : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Model Engine Selector & Tools */}
            <div className="flex items-center gap-2">
              
              {/* Model Dropdown Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-primary/90 border border-border/60 text-xs text-text-primary font-medium hover:border-accent-gold/40 transition-all"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{activeModelObj.name}</span>
                  <ChevronDown className="w-3 h-3 text-text-muted" />
                </button>

                {showModelDropdown && (
                  <div className="absolute right-0 bottom-full mb-2 w-56 bg-bg-card border border-border rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Select RunningHub Model
                    </div>
                    {RUNNINGHUB_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.id);
                          setShowModelDropdown(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left',
                          selectedModel === m.id
                            ? 'bg-accent-gold/15 text-accent-gold font-semibold'
                            : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                        )}
                      >
                        <span>{m.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-primary border border-border text-text-muted">
                          {m.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Attach Asset Tag Button */}
              <button
                type="button"
                onClick={() => setPrompt((p) => p + ' @Product ')}
                title="Attach Product Reference (@)"
                className="w-8 h-8 rounded-xl bg-bg-primary border border-border/60 flex items-center justify-center text-text-muted hover:text-accent-gold hover:border-accent-gold/40 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-gold text-white font-semibold text-xs shadow-lg glow-gold hover:opacity-95 transition-all btn-lift"
              >
                <span>Generate</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>

            </div>
          </div>
        </form>
      </div>

      {/* ── Prompt Suggestions Chips ───────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-2">
        <span className="text-xs text-text-muted font-medium mr-1 flex items-center gap-1">
          <Wand2 className="w-3 h-3 text-accent-gold" /> Try:
        </span>
        {PROMPT_SUGGESTIONS.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSuggestionClick(s)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-card/80 border border-border/60 text-xs text-text-secondary hover:text-text-primary hover:border-accent-gold/40 hover:bg-bg-secondary transition-all"
          >
            <span>{s.label}</span>
            <span className="text-[10px] text-text-muted font-mono uppercase">{s.mode}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
