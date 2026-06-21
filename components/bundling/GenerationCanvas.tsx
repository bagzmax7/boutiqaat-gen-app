'use client';

/**
 * components/bundling/GenerationCanvas.tsx
 * Shows loading state during generation, then displays the result.
 * Features:
 * - Floating download button overlay on the image (top-right corner)
 * - Regenerate dropdown with preset options
 * - Loading / error / empty states
 */

import { useState } from 'react';
import { Download, RefreshCw, Sparkles, ChevronDown, ImageOff, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BundlingPromptOptions } from '@/lib/bundling';

type RegeneratePreset = 'same' | 'soft' | 'hard' | 'cinematic' | 'light-shadow' | 'strong-shadow' | 'gradient-bg';

interface Props {
  imageUrls: string[];
  loading: boolean;
  onRegenerate: (options: BundlingPromptOptions) => void;
  onDownload: () => void;
  error?: string | null;
}

const PRESETS: { key: RegeneratePreset; label: string; options: BundlingPromptOptions }[] = [
  { key: 'same', label: 'Same settings', options: {} },
  { key: 'soft', label: '💡 Soft lighting', options: { lighting: 'Soft' } },
  { key: 'hard', label: '🔆 Hard lighting', options: { lighting: 'Hard' } },
  { key: 'cinematic', label: '🎬 Cinematic lighting', options: { lighting: 'Cinematic' } },
  { key: 'light-shadow', label: '☁️ Light shadows', options: { shadowIntensity: 'Light' } },
  { key: 'strong-shadow', label: '🌑 Strong shadows', options: { shadowIntensity: 'Strong' } },
  { key: 'gradient-bg', label: '🤍 Gradient white BG', options: { background: 'Gradient white' } },
];

export default function GenerationCanvas({ imageUrls, loading, onRegenerate, onDownload, error }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="flex flex-col h-full gap-3 w-full">
      {/* Canvas area — fills available height */}
      <div
        className={cn(
          'relative flex-1 min-h-0 rounded-2xl border overflow-hidden flex items-center justify-center',
          'bg-bg-secondary border-border transition-all'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {loading ? (
          /* Loading state */
          <div className="flex flex-col items-center gap-4 p-8">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-purple/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-accent-gold animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-2xl border-2 border-accent-gold/30 animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-text-primary">Generating bundle image...</p>
              <p className="text-xs text-text-muted">This may take 15–30 seconds</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-accent-gold/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-accent-red/10 flex items-center justify-center">
              <ImageOff className="w-6 h-6 text-accent-red" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary mb-1">Generation failed</p>
              <p className="text-xs text-text-muted max-w-[240px]">{error}</p>
            </div>
          </div>
        ) : imageUrls.length > 0 ? (
          /* Generated images with floating action buttons */
          <>
            <div className={cn("w-full h-full flex items-center justify-center gap-4 p-4", imageUrls.length > 1 ? "flex-row" : "flex-col")}>
              {imageUrls.map((url, i) => (
                <div key={i} className="relative w-full h-full flex flex-col items-center">
                  {imageUrls.length > 1 && (
                    <span className="absolute top-2 left-2 z-10 text-xs font-bold text-text-primary bg-bg-card/80 backdrop-blur-md px-2 py-1 rounded border border-border shadow-sm">
                      {i === 0 ? "Lifestyle" : "Studio"}
                    </span>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Generated product bundle ${i + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ))}
            </div>

            {/* Floating toolbar — appears on hover */}
            <div
              className={cn(
                'absolute top-3 right-3 flex items-center gap-2 transition-all duration-200 z-20',
                isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
              )}
            >
              {/* Regenerate */}
              <button
                onClick={() => onRegenerate({})}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-card/90 backdrop-blur border border-border text-sm font-semibold text-text-primary hover:border-accent-gold/40 hover:text-accent-gold shadow-sm transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>

              {/* Download */}
              <button
                onClick={onDownload}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-bg-card/90 backdrop-blur border border-border text-text-primary hover:bg-accent-gold hover:border-accent-gold hover:text-white shadow-sm transition-all"
                title="Download image(s)"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Subtle bottom gradient */}
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-bg-secondary/40 to-transparent pointer-events-none z-10" />
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-card border border-dashed border-border flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-text-muted/30" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary">Bundle preview will appear here</p>
              <p className="text-xs text-text-muted mt-1">Upload products → Analyze → Generate</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar — always visible when image exists */}
      {imageUrls.length > 0 && !loading && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Download — primary action */}
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-green to-emerald-600 text-white hover:opacity-90 transition-all shadow-lg flex-1 justify-center"
          >
            <Download className="w-4 h-4" />
            Download PNG(s)
          </button>

          {/* Regenerate dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-accent-gold/30 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Regen
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', dropdownOpen && 'rotate-180')} />
            </button>

            {dropdownOpen && (
              <div className="absolute bottom-full mb-2 right-0 w-52 bg-bg-card border border-border rounded-xl shadow-card overflow-hidden z-10 animate-fade-in">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => {
                      onRegenerate(preset.options);
                      setDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
