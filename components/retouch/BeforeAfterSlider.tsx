'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string | null;
  versionLabel?: string;
  className?: string;
  aspectRatio?: string;
  isProcessing?: boolean;
  onOpenFullView?: () => void;
}

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  versionLabel = 'v1',
  className,
  aspectRatio = '1/1',
  isProcessing = false,
  onOpenFullView,
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 - 100)
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(pos);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  if (!afterUrl || isProcessing) {
    return (
      <div
        className={cn(
          "relative w-full bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/10 select-none",
          className
        )}
        style={{ aspectRatio }}
      >
        <img
          src={beforeUrl}
          alt="Original"
          className="w-full h-full object-contain filter brightness-90"
        />
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#a3e635] border-t-transparent animate-spin" />
            <span className="text-[11px] font-bold text-[#a3e635] uppercase tracking-widest">
              Retouching {versionLabel}...
            </span>
          </div>
        )}
        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[9px] text-white/80 font-mono">
          Before
        </span>
      </div>
    );
  }

  // Hide labels if slider moves past them to avoid confusion
  const showBeforeBadge = sliderPosition > 14;
  const showAfterBadge = sliderPosition < 86;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/10 select-none cursor-ew-resize group",
        className
      )}
      style={{ aspectRatio }}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      {/* 1. Background Layer: BEFORE (Original) */}
      <img
        src={beforeUrl}
        alt="Original Before"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />

      {/* 2. Clipped Layer: AFTER (Retouched) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
      >
        <img
          src={afterUrl}
          alt="Retouched After"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
      </div>

      {/* 3. Slider Divider Line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-[#a3e635] z-10 shadow-[0_0_10px_rgba(163,230,53,0.9)] pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Handle Knob */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#a3e635] text-[#0d0e12] flex items-center justify-center shadow-lg border-2 border-black font-black text-[9px]">
          ↔
        </div>
      </div>

      {/* 4. Overlay Badges (Conditionally visible based on slider position) */}
      {showBeforeBadge && (
        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none transition-opacity duration-200">
          <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-[9px] text-white font-medium">
            Before
          </span>
        </div>
      )}

      {showAfterBadge && (
        <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none transition-opacity duration-200">
          <span className="px-2 py-0.5 rounded-md bg-[#a3e635] text-[#0d0e12] font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-md">
            <Sparkles className="w-2.5 h-2.5" /> After ({versionLabel})
          </span>
        </div>
      )}

      {/* 5. Fullscreen Zoom Trigger Button */}
      {onOpenFullView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenFullView();
          }}
          className="absolute bottom-2.5 right-2.5 z-20 p-1.5 rounded-lg bg-black/75 hover:bg-[#a3e635] hover:text-black text-white/80 transition-all opacity-0 group-hover:opacity-100 shadow-md border border-white/10"
          title="Full View / Zoom"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
