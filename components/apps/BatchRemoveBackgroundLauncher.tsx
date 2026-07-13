'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Loader2, Play, Upload, X, CheckCircle2, Download, Layers, Trash2 } from 'lucide-react';
import { cn, getFileNameFromUrl } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import { AppDefinition } from '@/lib/types';
import Image from 'next/image';

interface AppLauncherProps {
  app: AppDefinition;
  onTaskStarted: (taskId: string, appName: string, nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[], apiKeyType?: 'enterprise' | 'consumer') => void;
}

interface BatchFile {
  id: string;
  file: File;
  preview: string;
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'failed';
  runningHubTaskId?: string;
  outputUrl?: string;
  originalUrl?: string; // We store the uploaded URL to generate PSD later
  error?: string;
  // PSD state
  psdStatus?: 'idle' | 'converting' | 'ready' | 'error';
  psdBlob?: Blob;
  psdError?: string;
}

export default function BatchRemoveBackgroundLauncher({ app, onTaskStarted }: AppLauncherProps) {
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  // Track which task IDs we've already started PSD conversion for (to avoid double-triggering)
  const convertingRef = useRef<Set<string>>(new Set());
  const { tasks } = useTasks();

  // ── Auto-convert to PSD when a task reaches SUCCESS ──────────────────────
  useEffect(() => {
    batchFiles.forEach(file => {
      const task = tasks.find(t => t.taskId === file.runningHubTaskId);
      const outputUrl = task?.outputs?.[0]?.fileUrl;

      // Only trigger once per file: task succeeded, has output, has original, and PSD not yet started
      if (
        task?.status === 'SUCCESS' &&
        outputUrl &&
        file.originalUrl &&
        (!file.psdStatus || file.psdStatus === 'idle') &&
        !convertingRef.current.has(file.id)
      ) {
        convertingRef.current.add(file.id);
        convertToPsd(file.id, file.file || file.originalUrl, outputUrl, task.taskId || file.id);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, batchFiles]);

  const convertToPsd = async (fileId: string, originalSource: File | string, maskUrl: string, taskId: string) => {
    setBatchFiles(prev =>
      prev.map(f => f.id === fileId ? { ...f, psdStatus: 'converting' } : f)
    );

    try {
      const { generatePsdClient } = await import('@/lib/psd-helper');
      const blob = await generatePsdClient(originalSource, maskUrl);
      
      setBatchFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, psdStatus: 'ready', psdBlob: blob } : f)
      );
    } catch (err: any) {
      setBatchFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, psdStatus: 'error', psdError: err.message } : f)
      );
      toast.error(`PSD generation failed: ${err.message}`);
    } finally {
      convertingRef.current.delete(fileId);
    }
  };

  const downloadPsd = (file: BatchFile, taskId: string) => {
    if (!file.psdBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file.psdBlob);
    a.download = `masked-output-${taskId}.psd`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    // Handle rejected files (e.g. > 10MB)
    if (fileRejections.length > 0) {
      fileRejections.forEach(rejection => {
        const errorMsg = rejection.errors[0]?.message || 'Invalid file';
        toast.error(`${rejection.file.name}: ${errorMsg}`);
      });
    }

    if (acceptedFiles.length === 0) return;

    // Check 20 files limit
    setBatchFiles(prev => {
      const newFiles = acceptedFiles.map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        preview: URL.createObjectURL(file),
        status: 'idle' as const,
      }));
      
      const totalFiles = [...prev, ...newFiles];
      if (totalFiles.length > 20) {
        toast.error("You can only process up to 20 images at once.");
        return totalFiles.slice(0, 20);
      }
      return totalFiles;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 20,
    maxSize: 10 * 1024 * 1024, // 10 MB
  });

  const removeFile = (id: string) => {
    setBatchFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleRunBatch = async () => {
    const filesToProcess = batchFiles.filter(f => f.status === 'idle' || f.status === 'failed');
    if (filesToProcess.length === 0) return;

    setIsProcessing(true);

    // Process files strictly sequentially (1 by 1) to maximize the "retainSeconds" 
    // hot-cache on RunningHub. This saves cost and reduces overall wait time for batches.
    for (const batchFile of filesToProcess) {
      const index = filesToProcess.indexOf(batchFile);
      try {
        // 1. Set status to uploading
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'uploading' } : f));
        
        // 2. Upload file
        const formData = new FormData();
        formData.append('file', batchFile.file);
        const uploadRes = await fetch('/api/runninghub/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        
        if (!uploadData.fileUrl) throw new Error(uploadData.error || 'Upload failed');
        const originalUrl = uploadData.fileUrl;

        // 3. Set status to processing
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'processing', originalUrl } : f));
        
        // 4. Start RunningHub task via our new enterprise endpoint
        const nodeInfoList = [
          { nodeId: '7', fieldName: 'image', fieldValue: originalUrl }
        ];

        const runRes = await fetch('/api/remove-background/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: originalUrl }),
        });
        const runData = await runRes.json();
        
        if (!runData.taskId) throw new Error(runData.error || runData.errorMessage || 'Task failed');
        
        // 5. Success! Register task for webhook/UI
        onTaskStarted(runData.runningHubTaskId, `${app.name} (${index + 1})`, nodeInfoList, 'enterprise');
        
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, runningHubTaskId: runData.runningHubTaskId } : f));
        
        // 6. Polling loop: Wait for this task to finish before starting the next file.
        // This ensures the next task lands on the exact same warmed-up GPU instance.
        let isDone = false;
        while (!isDone) {
          // Wait 3 seconds before querying
          await new Promise(r => setTimeout(r, 3000));
          try {
            const queryRes = await fetch('/api/runninghub/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId: runData.runningHubTaskId, apiKeyType: 'enterprise' })
            });
            const queryData = await queryRes.json();
            if (queryData.status === 'SUCCESS' || queryData.status === 'FAILED') {
              isDone = true;
            }
          } catch (e) {
            // Ignore polling fetch errors, will retry
          }
        }
        
      } catch (err: any) {
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'failed', error: err.message } : f));
        toast.error(`Failed to process ${batchFile.file.name}: ${err.message}`);
      }
    }

    setIsProcessing(false);
  };

  const clearCompleted = () => {
    setBatchFiles(prev => prev.filter(f => {
      const task = tasks.find(t => t.taskId === f.runningHubTaskId);
      const isSuccess = task?.status === 'SUCCESS';
      return !isSuccess;
    }));
  };

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{app.name}</h3>
          <p className="text-sm text-text-secondary mt-0.5">{app.description}</p>
        </div>
        <div className="text-xs bg-accent-gold/10 text-accent-gold border border-accent-gold/20 px-3 py-1 rounded-full font-medium flex-shrink-0">
          Max 20 Images
        </div>
      </div>

      {/* Modern Drag & Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer mb-6 overflow-hidden",
          batchFiles.length === 0 ? "py-24" : "py-10",
          isDragActive 
            ? "border-accent-gold bg-accent-gold/10 scale-[1.02]" 
            : "border-border hover:border-accent-gold/50 bg-bg-secondary hover:bg-bg-card"
        )}
      >
        <input {...getInputProps()} />
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
          isDragActive ? "bg-accent-gold text-white shadow-lg shadow-accent-gold/20" : "bg-bg-card border border-border text-text-muted"
        )}>
          <Upload className="w-8 h-8" />
        </div>
        <h4 className={cn("text-lg font-bold mb-2 transition-colors", isDragActive ? "text-accent-gold" : "text-text-primary")}>
          {isDragActive ? "Drop images here!" : "Drag & drop images here"}
        </h4>
        <p className="text-sm text-text-muted text-center max-w-sm">
          Supports PNG, JPG up to 10MB per file. You can select up to 20 images at once.
        </p>
      </div>

      {/* Inline Results & Uploaded Files Grid */}
      {batchFiles.length > 0 && (
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">
              Processing Queue ({batchFiles.length})
            </h3>
            <button 
              onClick={clearCompleted}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Clear Completed
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {batchFiles.map(file => {
              // Check task status from global store
              const task = tasks.find(t => t.taskId === file.runningHubTaskId);
              const isTaskRunning = task?.status === 'RUNNING' || task?.status === 'QUEUED';
              const isTaskSuccess = task?.status === 'SUCCESS';
              const isTaskFailed = task?.status === 'FAILED';
              
              // Only consider local processing if task hasn't succeeded/failed yet
              const isLocalProcessing = (file.status === 'uploading' || file.status === 'processing') && !isTaskSuccess && !isTaskFailed;
              
              const showSkeleton = isLocalProcessing || isTaskRunning;
              const isConvertingPsd = file.psdStatus === 'converting';
              
              const outputUrl = task?.outputs?.[0]?.fileUrl || file.outputUrl;

              return (
                <div key={file.id} className="relative rounded-xl border border-border overflow-hidden bg-bg-secondary shadow-sm transition-all hover:shadow-md flex flex-col">
                  
                  {/* Image Display */}
                  <div className="relative aspect-square w-full">
                    {isTaskSuccess && outputUrl ? (
                      <Image src={outputUrl} alt="Output" fill className={cn("object-cover transition-all", isConvertingPsd ? "blur-md scale-105" : "")} sizes="200px" />
                    ) : (
                      <Image src={file.preview} alt="Preview" fill className="object-cover opacity-80" sizes="200px" />
                    )}

                    {/* Converting to PSD Overlay */}
                    {isConvertingPsd && (
                      <div className="absolute inset-0 bg-bg-card/40 flex flex-col items-center justify-center gap-2 z-20">
                        <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent-blue animate-spin" />
                        <span className="text-[10px] font-bold text-accent-blue tracking-wider">CREATING PSD...</span>
                      </div>
                    )}

                    {/* Skeleton Overlay when processing */}
                    {showSkeleton && (
                      <div className="absolute inset-0 bg-bg-card/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
                        <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent-gold animate-spin" />
                        <div className="text-[10px] font-bold text-accent-gold tracking-widest uppercase">
                          {file.status === 'uploading' ? 'Uploading...' : 'Processing...'}
                        </div>
                      </div>
                    )}

                    {/* Success Overlay */}
                    {isTaskSuccess && !isConvertingPsd && (
                      <div className="absolute top-2 left-2 bg-accent-green text-white rounded-full p-1 shadow-md z-20">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}

                    {/* Error Overlay */}
                    {(file.status === 'failed' || isTaskFailed) && (
                      <div className="absolute inset-0 bg-accent-red/90 flex flex-col items-center justify-center p-3 text-center z-20">
                        <X className="w-8 h-8 text-white mb-2" />
                        <span className="text-[10px] text-white font-medium line-clamp-3">
                          {task?.error || file.error || 'Failed'}
                        </span>
                      </div>
                    )}

                    {/* Remove button (only before processing) */}
                    {!showSkeleton && !isTaskFailed && file.status !== 'failed' && !isTaskSuccess && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center z-30">
                        <button
                          onClick={() => removeFile(file.id)}
                          className="w-8 h-8 rounded-full bg-accent-red/90 hover:bg-accent-red text-white flex items-center justify-center transition-all shadow-lg"
                          title="Remove image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar (Always visible for success) */}
                  {isTaskSuccess && outputUrl && (
                    <div className="p-3 bg-bg-card border-t border-border flex flex-col gap-2">
                      {/* Download PNG */}
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(outputUrl);
                            const blob = await res.blob();
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = getFileNameFromUrl(outputUrl);
                            a.click();
                            URL.revokeObjectURL(a.href);
                          } catch {
                            window.open(outputUrl, '_blank');
                          }
                        }}
                        className="w-full py-1.5 px-2 rounded-lg bg-bg-secondary hover:bg-white/10 text-xs font-medium text-text-primary flex items-center justify-center gap-1.5 transition-colors border border-border"
                      >
                        <Download className="w-3.5 h-3.5" /> Download PNG
                      </button>

                      {/* Download PSD — replaces the old "Convert to PSD" button */}
                      {file.psdStatus === 'converting' && (
                        <button
                          disabled
                          className="w-full py-1.5 px-2 rounded-lg bg-accent-blue/60 text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-not-allowed"
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating PSD...
                        </button>
                      )}
                      {file.psdStatus === 'ready' && (
                        <button
                          onClick={() => downloadPsd(file, task?.taskId || file.id)}
                          className="w-full py-1.5 px-2 rounded-lg bg-accent-blue/90 hover:bg-accent-blue text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Layers className="w-3.5 h-3.5" /> Download PSD
                        </button>
                      )}
                      {file.psdStatus === 'error' && (
                        <button
                          onClick={() => {
                            if (file.originalUrl && outputUrl) {
                              convertingRef.current.add(file.id);
                              convertToPsd(file.id, file.file || file.originalUrl, outputUrl, task?.taskId || file.id);
                            }
                          }}
                          className="w-full py-1.5 px-2 rounded-lg bg-accent-red/80 hover:bg-accent-red text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                          title={file.psdError}
                        >
                          <Layers className="w-3.5 h-3.5" /> Retry PSD
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Run Button */}
          {batchFiles.some(f => f.status === 'idle' || f.status === 'failed') && (
            <button
              onClick={handleRunBatch}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 bg-gradient-gold text-white font-semibold py-3.5 rounded-xl btn-lift glow-gold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Preparing Batch...</>
              ) : (
                <><Play className="w-5 h-5" /> Process {batchFiles.filter(f => f.status === 'idle' || f.status === 'failed').length} Images</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
