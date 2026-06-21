'use client';

import { Task } from '@/lib/types';
import { getStatusColor, getStatusBg, formatDuration, isImageUrl, isVideoUrl, getFileNameFromUrl } from '@/lib/utils';
import { X, CheckCircle2, Loader2, MinusCircle, AlertCircle, Download, ImageIcon, Film, Clock } from 'lucide-react';
import Image from 'next/image';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
}

export default function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
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

  const cost = (Math.random() * 0.05).toFixed(3); // Placeholder for cost

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-bg-card w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-bg-secondary">
          <h2 className="text-lg font-semibold text-text-primary">Call Record Detail</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Information */}
          <div className="bg-bg-primary rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-bg-secondary/50">
              <AlertCircle className="w-4 h-4 text-text-muted" />
              <h3 className="text-sm font-semibold text-text-primary">Basic Information</h3>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs text-text-muted font-medium border-b border-border">
                    <th className="pb-3 px-4 font-normal">Task ID</th>
                    <th className="pb-3 px-4 font-normal">API Name</th>
                    <th className="pb-3 px-4 font-normal">API Type</th>
                    <th className="pb-3 px-4 font-normal">Key Type</th>
                    <th className="pb-3 px-4 font-normal">Status</th>
                    <th className="pb-3 px-4 font-normal">Call Time</th>
                    <th className="pb-3 px-4 font-normal">Task Time</th>
                    <th className="pb-3 px-4 font-normal text-right">($) Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-sm text-text-primary whitespace-nowrap">
                    <td className="pt-3 px-4 font-mono">{task.taskId}</td>
                    <td className="pt-3 px-4">{task.appName}</td>
                    <td className="pt-3 px-4">AI Application API</td>
                    <td className="pt-3 px-4">
                      <span className="px-2 py-1 rounded-md bg-accent-purple/10 text-accent-purple text-xs font-medium border border-accent-purple/20">
                        Enterprise Shared
                      </span>
                    </td>
                    <td className="pt-3 px-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBg(task.status)} ${getStatusColor(task.status)}`}>
                        {task.status === 'SUCCESS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                         task.status === 'FAILED' ? <X className="w-3.5 h-3.5" /> : 
                         task.status === 'CANCELED' ? <MinusCircle className="w-3.5 h-3.5" /> : 
                         task.status === 'QUEUED' ? <Clock className="w-3.5 h-3.5" /> : 
                         <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {task.status}
                      </div>
                    </td>
                    <td className="pt-3 px-4">{new Date(task.createdAt).toLocaleString()}</td>
                    <td className="pt-3 px-4">{formatDuration(task.createdAt, task.updatedAt)}</td>
                    <td className="pt-3 px-4 text-right text-text-muted">{cost}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Inputs */}
          {task.nodeInfoList && task.nodeInfoList.length > 0 && (
             <div className="bg-bg-primary rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 p-4 border-b border-border bg-bg-secondary/50">
                  <AlertCircle className="w-4 h-4 text-text-muted" />
                  <h3 className="text-sm font-semibold text-text-primary">Input Parameters</h3>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {task.nodeInfoList.map((node, i) => {
                      const isImg = isImageUrl(node.fieldValue);
                      return (
                        <div key={i} className="flex flex-col gap-2 p-3 rounded-xl bg-bg-secondary border border-border">
                           <span className="text-xs text-text-muted font-mono">Node: {node.nodeId} / {node.fieldName}</span>
                           {isImg ? (
                             <div className="relative aspect-square w-full max-h-32 rounded-lg overflow-hidden bg-bg-card">
                               <Image src={node.fieldValue} alt="Input" fill className="object-contain" sizes="150px" />
                             </div>
                           ) : (
                             <div className="text-sm text-text-primary break-all bg-bg-card p-2 rounded-lg border border-border">
                               {node.fieldValue}
                             </div>
                           )}
                        </div>
                      )
                    })}
                  </div>
                </div>
             </div>
          )}

          {/* Generate Result */}
          <div className="bg-bg-primary rounded-xl border border-border overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-border bg-bg-secondary/50 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-text-primary text-bg-primary flex items-center justify-center rounded text-[10px] font-bold">!</div>
                <h3 className="text-sm font-semibold text-text-primary">Generate Result</h3>
                <span className="text-xs text-text-muted ml-2">Files are retained in the cloud for only 24 hours. Please download them in time.</span>
              </div>
            </div>
            
            <div className="p-6">
              {task.status === 'SUCCESS' && task.outputs && task.outputs.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {task.outputs.map((out, idx) => {
                    const isImg = isImageUrl(out.fileUrl);
                    const isVid = isVideoUrl(out.fileUrl);
                    const isPsd = out.fileUrl.toLowerCase().endsWith('.psd');
                    
                    return (
                      <div key={idx} className="group relative w-48 h-48 rounded-xl border border-border overflow-hidden bg-white">
                        {isImg ? (
                          <Image src={out.fileUrl} alt="Output" fill className="object-contain p-2" sizes="200px" />
                        ) : isVid ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-accent-purple bg-accent-purple/5">
                            <Film className="w-8 h-8 mb-2"/>
                            <span className="text-xs font-medium">VIDEO</span>
                          </div>
                        ) : isPsd ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-accent-blue bg-accent-blue/5">
                            <ImageIcon className="w-8 h-8 mb-2"/>
                            <span className="text-xs font-bold">PSD DOCUMENT</span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
                            <ImageIcon className="w-8 h-8 mb-2"/>
                            <span className="text-xs font-medium">FILE</span>
                          </div>
                        )}

                        {/* Download overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => handleDownload(out.fileUrl)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white text-white hover:text-black transition-all shadow-lg text-sm font-medium backdrop-blur-md"
                          >
                            <Download className="w-4 h-4" /> Download
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : task.status === 'FAILED' ? (
                 <div className="text-sm text-accent-red p-4 bg-accent-red/10 border border-accent-red/20 rounded-lg">
                   {task.error || "Generation failed."}
                 </div>
              ) : task.status === 'RUNNING' || task.status === 'QUEUED' ? (
                 <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-accent-blue" />
                    <p className="text-sm">Processing in progress...</p>
                 </div>
              ) : (
                <p className="text-sm text-text-muted">No results generated.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
