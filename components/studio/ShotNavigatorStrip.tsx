'use client';

import { useState } from 'react';
import { Plus, Layers, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Shot {
  id: string;
  shotNumber: number;
  label: string;
  thumbnail: string;
  prompt: string;
}

interface ShotNavigatorStripProps {
  shots: Shot[];
  activeShotId: string;
  onSelectShot: (id: string) => void;
  onAddShot: () => void;
  onAddScene: () => void;
}

export default function ShotNavigatorStrip({
  shots,
  activeShotId,
  onSelectShot,
  onAddShot,
  onAddScene,
}: ShotNavigatorStripProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto p-2 bg-bg-card/60 border-b border-border/60 backdrop-blur-md">
      <div className="flex items-center gap-2">
        {shots.map((shot) => {
          const isActive = shot.id === activeShotId;
          return (
            <button
              key={shot.id}
              onClick={() => onSelectShot(shot.id)}
              className={cn(
                'group relative flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden border-2 transition-all',
                isActive
                  ? 'border-accent-pink shadow-lg scale-105'
                  : 'border-border/60 hover:border-text-muted opacity-70 hover:opacity-100'
              )}
            >
              <img
                src={shot.thumbnail}
                alt={shot.label}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              
              {/* Shot Badge */}
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-bold text-white uppercase">
                S{shot.shotNumber}
              </span>

              {isActive && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-pink flex items-center justify-center text-white">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
            </button>
          );
        })}

        {/* Add Shot Button */}
        <button
          onClick={onAddShot}
          className="flex-shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-border/80 hover:border-accent-pink/60 bg-bg-primary/40 hover:bg-bg-primary/80 flex flex-col items-center justify-center text-text-muted hover:text-accent-pink transition-all"
          title="Add Next Shot"
        >
          <Plus className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold">Add Shot</span>
        </button>

        {/* Add Scene Divider Button */}
        <button
          onClick={onAddScene}
          className="flex-shrink-0 px-3 h-16 rounded-xl border border-border/60 bg-bg-primary/30 hover:bg-bg-primary/80 flex flex-col items-center justify-center text-text-muted hover:text-accent-gold transition-all"
        >
          <Layers className="w-4 h-4 mb-1" />
          <span className="text-[10px] font-semibold">New Scene</span>
        </button>
      </div>
    </div>
  );
}
