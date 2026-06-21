'use client';

import { Task, TaskOutput } from '@/lib/types';
import { isImageUrl, isVideoUrl, getFileNameFromUrl, formatRelativeTime } from '@/lib/utils';
import { Download, ImageIcon, Film, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface RecentOutputsProps {
  tasks: Task[];
}

export default function RecentOutputs({ tasks }: RecentOutputsProps) {
  const completed = tasks
    .filter(t => t.status === 'SUCCESS' && t.outputs && t.outputs.length > 0)
    .slice(0, 8);

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

  if (completed.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-6 shadow-card">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Recent Outputs</h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center mb-3">
            <ImageIcon className="w-5 h-5 text-text-muted" />
          </div>
          <p className="text-text-secondary text-sm">No outputs yet</p>
          <p className="text-text-muted text-xs mt-1">Completed tasks will show previews here</p>
        </div>
      </div>
    );
  }

  const allOutputs: { output: TaskOutput; task: Task }[] = completed.flatMap(task =>
    (task.outputs || []).map(output => ({ output, task }))
  ).slice(0, 8);

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-primary">Recent Outputs</h2>
        <Link
          href="/tasks"
          className="text-xs text-accent-gold hover:text-accent-gold-light flex items-center gap-1 transition-colors"
        >
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {allOutputs.map(({ output, task }, i) => {
          const isImg = isImageUrl(output.fileUrl);
          const isVid = isVideoUrl(output.fileUrl);

          return (
            <div
              key={i}
              className="group relative bg-bg-secondary border border-border rounded-xl overflow-hidden aspect-square hover:border-accent-gold/30 transition-all"
            >
              {isImg ? (
                <Image
                  src={output.fileUrl}
                  alt={task.appName}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              ) : isVid ? (
                <div className="w-full h-full flex items-center justify-center bg-bg-primary">
                  <Film className="w-8 h-8 text-accent-purple" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-bg-primary">
                  <ImageIcon className="w-8 h-8 text-text-muted" />
                </div>
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                <p className="text-white text-xs font-medium truncate mb-1">{task.appName}</p>
                <p className="text-white/60 text-xs">{formatRelativeTime(task.updatedAt)}</p>
                <button
                  onClick={() => handleDownload(output.fileUrl)}
                  className="absolute top-2 right-2 w-7 h-7 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center hover:bg-accent-gold/80 transition-all"
                >
                  <Download className="w-3 h-3 text-white" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
