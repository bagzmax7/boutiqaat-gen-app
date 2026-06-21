'use client';

import { Task } from '@/lib/types';
import { cn, formatRelativeTime, formatDuration, getStatusColor, getStatusBg } from '@/lib/utils';
import { Loader2, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface ActiveTasksProps {
  tasks: Task[];
  onCancel: (taskId: string) => void;
}

export default function ActiveTasks({ tasks, onCancel }: ActiveTasksProps) {
  const activeTasks = tasks.filter(t => t.status === 'RUNNING' || t.status === 'QUEUED');

  if (activeTasks.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-6 shadow-card">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
          Active Tasks
        </h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center mb-3">
            <Loader2 className="w-5 h-5 text-text-muted" />
          </div>
          <p className="text-text-secondary text-sm">No active tasks</p>
          <p className="text-text-muted text-xs mt-1">Tasks will appear here when running</p>
        </div>
      </div>
    );
  }

  async function handleCancel(taskId: string, task: Task) {
    try {
      const res = await fetch('/api/runninghub/cancel-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.taskId }),
      });
      if (res.ok) {
        toast.success('Task cancelled');
        onCancel(taskId);
      } else {
        toast.error('Failed to cancel task');
      }
    } catch {
      toast.error('Error cancelling task');
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 shadow-card">
      <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
        Active Tasks
        <span className="ml-auto text-xs bg-accent-blue/10 text-accent-blue border border-accent-blue/20 px-2 py-0.5 rounded-full">
          {activeTasks.length} running
        </span>
      </h2>

      <div className="space-y-3">
        {activeTasks.map(task => (
          <div
            key={task.id}
            className={cn(
              'rounded-xl border p-4 transition-all pulse-running',
              getStatusBg(task.status)
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Loader2 className="w-3 h-3 animate-spin text-accent-blue flex-shrink-0" />
                  <p className="text-sm font-medium text-text-primary truncate">{task.appName}</p>
                </div>
                <p className="text-xs text-text-muted font-mono">ID: {task.taskId.slice(0, 16)}...</p>
                <p className="text-xs text-text-secondary mt-1">
                  Running for {formatDuration(task.createdAt)}
                  <span className="mx-1">·</span>
                  Started {formatRelativeTime(task.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Link
                  href={`/tasks?id=${task.id}`}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 transition-all"
                  title="View task"
                >
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  onClick={() => handleCancel(task.id, task)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
                  title="Cancel task"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
