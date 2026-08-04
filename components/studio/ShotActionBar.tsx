'use client';

import {
  Sparkles, Film, RotateCcw, Maximize2, RefreshCw,
  UserCheck, Crop, Compass, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ShotActionBarProps {
  onRecreate?: () => void;
  onImageToVideo?: () => void;
  onChangeAngle?: () => void;
  onUpscale?: () => void;
  onFaceSwap?: () => void;
  onSocialResize?: () => void;
}

export default function ShotActionBar({
  onRecreate,
  onImageToVideo,
  onChangeAngle,
  onUpscale,
  onFaceSwap,
  onSocialResize,
}: ShotActionBarProps) {
  const ACTIONS = [
    { label: 'Recreate', icon: Sparkles, color: 'text-purple-400', onClick: onRecreate || (() => toast.success('Recreating shot with current prompt')) },
    { label: 'Image to Video', icon: Film, color: 'text-pink-400', onClick: onImageToVideo || (() => toast.success('Converting image shot to Video')) },
    { label: 'Change Angle', icon: Compass, color: 'text-blue-400', onClick: onChangeAngle || (() => toast.success('Generating alternative camera angles')) },
    { label: 'Upscale 4K', icon: Maximize2, color: 'text-emerald-400', onClick: onUpscale || (() => toast.success('Upscaling shot to 4K resolution')) },
    { label: 'Face Swap', icon: UserCheck, color: 'text-amber-400', onClick: onFaceSwap || (() => toast.success('Opening Face Swap talent selector')) },
    { label: 'Social Resize', icon: Crop, color: 'text-indigo-400', onClick: onSocialResize || (() => toast.success('Resizing to 9:16 / 1:1 format')) },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-bg-card/80 border-t border-border/60 backdrop-blur-xl">
      {ACTIONS.map((action, idx) => {
        const Icon = action.icon;
        return (
          <button
            key={idx}
            type="button"
            onClick={action.onClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-primary/80 border border-border/60 hover:border-accent-pink/40 text-xs font-semibold text-text-secondary hover:text-text-primary transition-all hover:scale-105"
          >
            <Icon className={cn('w-3.5 h-3.5', action.color)} />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
