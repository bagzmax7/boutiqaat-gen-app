import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TaskStatus, DashboardStats, Task } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatDuration(startMs: number, endMs?: number): string {
  const duration = (endMs || Date.now()) - startMs;
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'RUNNING': return 'text-accent-blue';
    case 'SUCCESS': return 'text-accent-green';
    case 'FAILED': return 'text-accent-red';
    case 'CANCELED': return 'text-text-secondary';
    case 'QUEUED': return 'text-accent-gold';
    default: return 'text-text-secondary';
  }
}

export function getStatusBg(status: TaskStatus): string {
  switch (status) {
    case 'RUNNING': return 'bg-accent-blue/10 border-accent-blue/30';
    case 'SUCCESS': return 'bg-accent-green/10 border-accent-green/30';
    case 'FAILED': return 'bg-accent-red/10 border-accent-red/30';
    case 'CANCELED': return 'bg-text-muted/10 border-text-muted/30';
    case 'QUEUED': return 'bg-accent-gold/10 border-accent-gold/30';
    default: return 'bg-border/10 border-border/30';
  }
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url);
}

export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(url);
}

export function computeStats(tasks: Task[]): DashboardStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const todayTasks = tasks.filter(t => t.createdAt >= todayMs);

  return {
    totalToday: todayTasks.length,
    running: tasks.filter(t => t.status === 'RUNNING' || t.status === 'QUEUED').length,
    completed: tasks.filter(t => t.status === 'SUCCESS').length,
    failed: tasks.filter(t => t.status === 'FAILED').length,
  };
}

export function getFileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    return parts[parts.length - 1] || 'output';
  } catch {
    return 'output';
  }
}

export const PINNED_APP_ID = process.env.PINNED_APP_ID || '2054414719020216321';
