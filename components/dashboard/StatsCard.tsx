'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: 'gold' | 'blue' | 'green' | 'red' | 'purple';
  trend?: string;
  loading?: boolean;
}

const colorMap = {
  gold: {
    bg: 'bg-accent-gold/10',
    border: 'border-accent-gold/20',
    icon: 'text-accent-gold',
    value: 'text-accent-gold',
    glow: 'hover:shadow-gold-sm',
  },
  blue: {
    bg: 'bg-accent-blue/10',
    border: 'border-accent-blue/20',
    icon: 'text-accent-blue',
    value: 'text-accent-blue',
    glow: '',
  },
  green: {
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/20',
    icon: 'text-accent-green',
    value: 'text-accent-green',
    glow: '',
  },
  red: {
    bg: 'bg-accent-red/10',
    border: 'border-accent-red/20',
    icon: 'text-accent-red',
    value: 'text-accent-red',
    glow: '',
  },
  purple: {
    bg: 'bg-accent-purple/10',
    border: 'border-accent-purple/20',
    icon: 'text-accent-purple',
    value: 'text-accent-purple',
    glow: '',
  },
};

export default function StatsCard({ title, value, icon: Icon, color, trend, loading }: StatsCardProps) {
  const c = colorMap[color];

  if (loading) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-5 shadow-card">
        <div className="shimmer rounded-lg h-4 w-24 mb-4" />
        <div className="shimmer rounded-lg h-8 w-16 mb-2" />
        <div className="shimmer rounded-lg h-3 w-20" />
      </div>
    );
  }

  return (
    <div className={cn(
      'bg-bg-card border rounded-2xl p-5 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 cursor-default',
      c.border,
      c.glow
    )}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm text-text-secondary font-medium">{title}</p>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', c.bg)}>
          <Icon className={cn('w-4 h-4', c.icon)} />
        </div>
      </div>
      <p className={cn('text-3xl font-bold tabular-nums', c.value)}>{value}</p>
      {trend && (
        <p className="text-xs text-text-muted mt-1">{trend}</p>
      )}
    </div>
  );
}
