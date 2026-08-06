'use client';

import { Task } from '@/lib/types';
import {
  cn,
  formatRelativeTime,
  formatDuration,
  getStatusColor,
  getStatusBg,
  isImageUrl,
  isVideoUrl,
  getFileNameFromUrl,
} from '@/lib/utils';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  Download,
  ChevronDown,
  ChevronUp,
  Film,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';

const STATUS_ICONS = {
  RUNNING: <Loader2 className="w-4 h-4 animate-spin text-accent-blue" />,
  QUEUED: <Clock className="w-4 h-4 text-accent-gold" />,
  SUCCESS: <CheckCircle2 className="w-4 h-4 text-accent-green" />,
  FAILED: <XCircle className="w-4 h-4 text-accent-red" />,
  CANCELED: <MinusCircle className="w-4 h-4 text-text-muted" />,
};

interface TaskCardProps {
  task: Task;
  onCancel?: (id: string) => void;
  defaultExpanded?: boolean;
}

export default function TaskCard({ task, onCancel, defaultExpanded = false }: TaskCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [cancelling, setCancelling] = useState(false);

  async function handleDownload(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = getFileNameFromUrl(url);
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch('/api/runninghub/cancel-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.taskId }),
      });
      if (res.ok) {
        toast.success('Task cancelled');
        onCancel?.(task.id);
      } else {
        toast.error('Failed to cancel task');
      }
    } catch {
      toast.error('Error cancelling task');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className={cn('rounded-2xl border transition-all shadow-card', getStatusBg(task.status))}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-shrink-0">{STATUS_ICONS[task.status]}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text-primary truncate">{task.appName}</p>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0',
              getStatusBg(task.status), getStatusColor(task.status)
            )}>
              {task.status}
            </span>
          </div>
          <p className="text-xs text-text-muted font-mono mt-0.5">
            {task.taskId}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 text-xs text-text-secondary">
          <span className="hidden sm:block">{formatRelativeTime(task.createdAt)}</span>
          {(task.status === 'RUNNING' || task.status === 'QUEUED') && onCancel && (
            <button
              onClick={e => { e.stopPropagation(); handleCancel(); }}
              disabled={cancelling}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent-red/10 hover:text-accent-red text-text-muted transition-all"
              title="Cancel task"
            >
              {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-4 animate-slide-up">
          {/* Meta info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-bg-primary/50 rounded-xl p-3">
              <p className="text-xs text-text-muted mb-1">App ID</p>
              <p className="text-xs text-text-secondary font-mono truncate">{task.appId}</p>
            </div>
            <div className="bg-bg-primary/50 rounded-xl p-3">
              <p className="text-xs text-text-muted mb-1">Duration</p>
              <p className="text-xs text-text-secondary">
                {formatDuration(task.createdAt, task.updatedAt)}
              </p>
            </div>
            <div className="bg-bg-primary/50 rounded-xl p-3">
              <p className="text-xs text-text-muted mb-1">Created</p>
              <p className="text-xs text-text-secondary">{new Date(task.createdAt).toLocaleTimeString()}</p>
            </div>
          </div>

          {/* Node Info */}
          {task.nodeInfoList && task.nodeInfoList.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Input Parameters</p>
              <div className="space-y-2">
                {task.nodeInfoList.map((node, i) => (
                  <div key={i} className="flex gap-2 bg-bg-primary/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-text-muted font-mono min-w-0 flex-shrink-0">
                      {node.nodeId} / {node.fieldName}:
                    </span>
                    <span className="text-xs text-text-secondary truncate">{node.fieldValue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {task.error && (
            <div className="mb-4 bg-accent-red/10 border border-accent-red/20 rounded-xl px-4 py-3">
              <p className="text-xs text-accent-red font-medium mb-1">Error</p>
              <p className="text-xs text-text-secondary">{task.error}</p>
            </div>
          )}

          {/* Outputs */}
          {task.outputs && task.outputs.length > 0 && (
            <div>
              <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">Outputs ({task.outputs.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {task.outputs.map((output, i) => {
                  const isImg = isImageUrl(output.fileUrl);
                  const isVid = isVideoUrl(output.fileUrl);
                  return (
                    <div key={i} className="group relative bg-bg-primary rounded-xl overflow-hidden border border-border">
                      {isImg ? (
                        <div className="aspect-square relative">
                          <Image
                            src={output.fileUrl}
                            alt={`Output ${i + 1}`}
                            fill
                            className="object-cover"
                            sizes="200px"
                          />
                        </div>
                      ) : isVid ? (
                        <div className="aspect-square relative w-full h-full">
                          <video
                            src={output.fileUrl}
                            className="w-full h-full object-cover absolute inset-0"
                            autoPlay
                            muted
                            loop
                            playsInline
                          />
                        </div>
                      ) : (
                        <div className="aspect-square flex flex-col items-center justify-center gap-2">
                          <ImageIcon className="w-8 h-8 text-text-muted" />
                          <p className="text-xs text-text-muted">File</p>
                        </div>
                      )}
                      <button
                        onClick={() => handleDownload(output.fileUrl)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Download className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
