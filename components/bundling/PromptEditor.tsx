'use client';

/**
 * components/bundling/PromptEditor.tsx
 * Editable textarea showing the generated bundling prompt.
 * Includes regenerate, copy, and lighting/shadow/background options.
 */

import { useState } from 'react';
import { RefreshCw, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BundlingPromptOptions } from '@/lib/bundling';

interface Props {
  prompt: string;
  onChange: (prompt: string) => void;
  onRegenerate: (options: BundlingPromptOptions) => void;
  loading?: boolean;
}

const LIGHTING_OPTIONS = ['Soft', 'Hard', 'Cinematic'] as const;
const SHADOW_OPTIONS = ['Light', 'Natural', 'Strong'] as const;
const BG_OPTIONS = ['Pure white', 'Gradient white'] as const;

export default function PromptEditor({ prompt, onChange, onRegenerate, loading }: Props) {
  const [options, setOptions] = useState<BundlingPromptOptions>({
    lighting: 'Soft',
    shadowIntensity: 'Natural',
    background: 'Pure white',
  });
  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setLighting = (v: BundlingPromptOptions['lighting']) =>
    setOptions((o) => ({ ...o, lighting: v }));
  const setShadow = (v: BundlingPromptOptions['shadowIntensity']) =>
    setOptions((o) => ({ ...o, shadowIntensity: v }));
  const setBackground = (v: BundlingPromptOptions['background']) =>
    setOptions((o) => ({ ...o, background: v }));

  return (
    <div className="space-y-3">
      {/* Prompt textarea */}
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
          rows={10}
          placeholder="Bundling prompt will appear here after dimension analysis..."
          className={cn(
            'w-full bg-bg-card border border-border rounded-xl px-3 py-3 text-xs text-text-primary placeholder:text-text-muted resize-none outline-none transition-colors leading-relaxed',
            'focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20',
            loading && 'opacity-50 cursor-not-allowed'
          )}
        />
        {/* Character count */}
        <span className="absolute bottom-2.5 right-3 text-[10px] text-text-muted">
          {prompt.length} chars
        </span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        {/* Copy button */}
        <button
          onClick={handleCopy}
          disabled={!prompt || loading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
            copied
              ? 'border-accent-green/40 bg-accent-green/10 text-accent-green'
              : 'border-border text-text-secondary hover:border-border-light hover:text-text-primary',
            (!prompt || loading) && 'opacity-40 cursor-not-allowed'
          )}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>

        {/* Options toggle */}
        <button
          onClick={() => setShowOptions(!showOptions)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-text-secondary hover:border-border-light hover:text-text-primary transition-all"
        >
          Options
          {showOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Regenerate prompt */}
        <button
          onClick={() => onRegenerate(options)}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ml-auto',
            loading
              ? 'border-border text-text-muted cursor-not-allowed'
              : 'border-accent-gold/40 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20'
          )}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Regen Prompt
        </button>
      </div>

      {/* Expandable options panel */}
      {showOptions && (
        <div className="bg-bg-card border border-border rounded-xl p-3 space-y-3 animate-fade-in">
          {/* Lighting */}
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Lighting</p>
            <div className="flex gap-1.5">
              {LIGHTING_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setLighting(v)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    options.lighting === v
                      ? 'border-accent-gold/50 bg-accent-gold/15 text-accent-gold'
                      : 'border-border text-text-secondary hover:border-border-light'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Shadow */}
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Shadow Intensity</p>
            <div className="flex gap-1.5">
              {SHADOW_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setShadow(v)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    options.shadowIntensity === v
                      ? 'border-accent-purple/50 bg-accent-purple/15 text-accent-purple'
                      : 'border-border text-text-secondary hover:border-border-light'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Background</p>
            <div className="flex gap-1.5">
              {BG_OPTIONS.map((v) => (
                <button
                  key={v}
                  onClick={() => setBackground(v)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    options.background === v
                      ? 'border-accent-blue/50 bg-accent-blue/15 text-accent-blue'
                      : 'border-border text-text-secondary hover:border-border-light'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
