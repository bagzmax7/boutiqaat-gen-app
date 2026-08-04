'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Loader2, Play, Upload, X, CheckCircle2, Download, Trash2, Eye, CheckSquare, Square, Archive, Sparkles } from 'lucide-react';
import { cn, getFileNameFromUrl } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import { AppDefinition } from '@/lib/types';
import Image from 'next/image';
import JSZip from 'jszip';

interface AppLauncherProps {
  app: AppDefinition;
  onTaskStarted: (taskId: string, appName: string, nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[], apiKeyType?: 'enterprise' | 'consumer') => void;
}

interface BatchFile {
  id: string;
  file: File;
  preview: string;
  prompt: string;
  strength: string;
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'failed';
  runningHubTaskId?: string;
  outputUrl?: string;
  originalUrl?: string;
  error?: string;
}

// Before and After Slider Component
function BeforeAfterSlider({ originalUrl, outputUrl }: { originalUrl: string; outputUrl: string }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseLeave={() => setSliderPosition(50)}
      className="relative w-full h-full overflow-hidden select-none cursor-ew-resize rounded-xl bg-black"
    >
      {/* Before (Original) Image */}
      <img 
        src={originalUrl} 
        alt="Original" 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
      />

      {/* After (Retouched) Image (Clipped) */}
      <img 
        src={outputUrl} 
        alt="Retouched" 
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
      />

      {/* Divider slider handle line */}
      <div 
        className="absolute inset-y-0 w-0.5 bg-lime-400 pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-lime-400 text-black flex items-center justify-center shadow-[0_0_8px_rgba(213,255,64,0.6)] border border-black/20 text-[8px] font-black">
          ↔
        </div>
      </div>

      {/* Badges */}
      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[8px] text-gray-300 font-bold uppercase tracking-wider pointer-events-none">Before</span>
      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-lime-400 text-[8px] text-black font-extrabold uppercase tracking-wider pointer-events-none">After</span>
    </div>
  );
}

export default function AutoRetouchLauncher({ app, onTaskStarted }: AppLauncherProps) {
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [previewImages, setPreviewImages] = useState<{ before: string; after: string } | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const { tasks } = useTasks();

  // Load initial files from existing tasks history on mount
  useEffect(() => {
    async function loadRetouchHistory() {
      try {
        const res = await fetch('/api/retouch/sessions');
        if (!res.ok) return;
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          const restored: BatchFile[] = data.sessions.map((s: any) => ({
            id: s.id,
            file: null as any,
            preview: s.original_url || s.output_url || '',
            prompt: s.prompt || 'Human, women model',
            strength: s.strength || '0.55',
            status: (s.status === 'SUCCESS' ? 'success' : s.status === 'FAILED' ? 'failed' : s.status === 'RUNNING' || s.status === 'QUEUED' ? 'processing' : 'idle') as any,
            runningHubTaskId: s.task_id,
            outputUrl: s.output_url || undefined,
            originalUrl: s.original_url || '',
            error: s.error_message || undefined,
          }));
          setBatchFiles(restored);
        }
      } catch (e) {
        console.error('Failed to load Retouch history:', e);
      }
    }
    loadRetouchHistory();
  }, []);

  // Sync tasks outputs and persist to DB
  useEffect(() => {
    batchFiles.forEach(file => {
      if (file.runningHubTaskId) {
        const task = tasks.find(t => t.taskId === file.runningHubTaskId);
        if (task && (task.status === 'SUCCESS' || task.status === 'FAILED')) {
          const isSuccess = task.status === 'SUCCESS';
          const outputUrl = task.outputs?.[0]?.fileUrl || null;
          const isDbUpdateNeeded = 
            (isSuccess && !file.outputUrl) || 
            (task.status === 'FAILED' && file.status !== 'failed');

          if (isDbUpdateNeeded) {
            // Update local state
            setBatchFiles(prev =>
              prev.map(f => f.id === file.id 
                ? { 
                    ...f, 
                    status: isSuccess ? 'success' : 'failed', 
                    outputUrl: outputUrl || undefined,
                    error: isSuccess ? undefined : task.error || 'Failed'
                  } 
                : f
              )
            );

            // Update database session
            fetch('/api/retouch/sessions', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: file.id,
                task_id: file.runningHubTaskId,
                status: task.status,
                output_url: outputUrl,
                error: task.error || null,
              })
            }).catch(() => {});
          }
        }
      }
    });
  }, [tasks, batchFiles]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      fileRejections.forEach(rejection => {
        const errorMsg = rejection.errors[0]?.message || 'Invalid file';
        toast.error(`${rejection.file.name}: ${errorMsg}`);
      });
    }

    if (acceptedFiles.length === 0) return;

    setBatchFiles(prev => {
      const newFiles = acceptedFiles.map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        preview: URL.createObjectURL(file),
        prompt: 'Human, women model',
        strength: '0.55',
        status: 'idle' as const,
      }));
      
      const totalFiles = [...prev, ...newFiles];
      if (totalFiles.length > 10) {
        toast.error("You can only process up to 10 images at once.");
        return totalFiles.slice(0, 10);
      }
      return totalFiles;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 10,
    maxSize: 10 * 1024 * 1024,
  });

  const removeFile = (id: string) => {
    setBatchFiles(prev => prev.filter(f => f.id !== id));
  };

  const updatePrompt = (id: string, value: string) => {
    setBatchFiles(prev => prev.map(f => f.id === id ? { ...f, prompt: value } : f));
  };

  const updateStrength = (id: string, value: string) => {
    setBatchFiles(prev => prev.map(f => f.id === id ? { ...f, strength: value } : f));
  };

  const handleRunBatch = async () => {
    const filesToProcess = batchFiles.filter(f => f.status === 'idle' || f.status === 'failed');
    if (filesToProcess.length === 0) return;

    setIsProcessing(true);

    const promises = filesToProcess.map(async (batchFile, index) => {
      try {
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'uploading' } : f));
        
        let originalUrl = batchFile.originalUrl;
        if (!originalUrl && batchFile.file) {
          const formData = new FormData();
          formData.append('file', batchFile.file);
          const uploadRes = await fetch('/api/runninghub/upload', { method: 'POST', body: formData });
          const uploadData = await uploadRes.json();
          
          if (!uploadData.fileUrl) throw new Error(uploadData.error || 'Upload failed');
          originalUrl = uploadData.fileUrl;
        }

        if (!originalUrl) throw new Error('No source image available');

        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'processing', originalUrl } : f));
        
        const nodeInfoList = [
          { nodeId: '51', fieldName: 'image', fieldValue: originalUrl },
          { nodeId: '54', fieldName: 'text', fieldValue: batchFile.prompt },
          { nodeId: '37', fieldName: 'value', fieldValue: batchFile.strength }
        ];

        const runRes = await fetch('/api/runninghub/run-app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            appId: app.id, 
            nodeInfoList, 
            apiKeyType: 'enterprise' 
          }),
        });
        const runData = await runRes.json();
        
        if (!runData.taskId) throw new Error(runData.error || runData.errorMessage || 'Task failed');
        
        onTaskStarted(runData.taskId, `${app.name} (${index + 1})`, nodeInfoList, 'enterprise');
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, runningHubTaskId: runData.taskId } : f));

        // Persist retouch session to dedicated table
        await fetch('/api/retouch/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: batchFile.id,
            task_id: runData.taskId,
            prompt: batchFile.prompt,
            strength: batchFile.strength,
            original_url: originalUrl,
            status: 'QUEUED',
          })
        }).catch(() => {});
        
        // Wait polling
        let isDone = false;
        while (!isDone) {
          await new Promise(r => setTimeout(r, 4000));
          try {
            const queryRes = await fetch('/api/runninghub/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId: runData.taskId, apiKeyType: 'enterprise' })
            });
            const queryData = await queryRes.json();
            if (queryData.status === 'SUCCESS' || queryData.status === 'FAILED') {
              isDone = true;
            }
          } catch (e) {}
        }
        
      } catch (err: any) {
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'failed', error: err.message } : f));
        toast.error(`Failed to process ${batchFile.file?.name || 'image'}: ${err.message}`);
      }
    });

    await Promise.all(promises);
    setIsProcessing(false);
  };

  const clearCompleted = () => {
    setBatchFiles(prev => prev.filter(f => f.status !== 'success'));
    setSelectedFiles(new Set());
  };

  const toggleSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) newSet.delete(fileId);
      else newSet.add(fileId);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const successFiles = batchFiles.filter(f => f.status === 'success');
    if (selectedFiles.size === successFiles.length && successFiles.length > 0) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(successFiles.map(f => f.id)));
    }
  };

  const downloadSelectedAsZip = async () => {
    if (selectedFiles.size === 0) return;
    setIsZipping(true);
    const toastId = toast.loading('Preparing ZIP file...');
    try {
      const zip = new JSZip();
      let addedCount = 0;

      for (const fileId of Array.from(selectedFiles)) {
        const file = batchFiles.find(f => f.id === fileId);
        if (file && file.outputUrl) {
          const response = await fetch(file.outputUrl);
          const blob = await response.blob();
          const fileName = `retouched-${file.file.name.split('.')[0] || addedCount}.png`;
          zip.file(fileName, blob);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Boutiqaat-Retouched-Batch-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Successfully downloaded ${addedCount} images as ZIP!`, { id: toastId });
        setSelectedFiles(new Set());
      } else {
        toast.error('No valid images found to zip.', { id: toastId });
      }
    } catch (error) {
      toast.error('Failed to create ZIP file.', { id: toastId });
    } finally {
      setIsZipping(false);
    }
  };

  const completedHistory = batchFiles.filter(f => f.status === 'success' || f.status === 'failed');
  const activeQueue = batchFiles.filter(f => f.status === 'idle' || f.status === 'uploading' || f.status === 'processing');

  return (
    <div className="bg-[#121212] border border-[#1c1c1c] rounded-2xl p-6 shadow-card space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{app.name}</h3>
          <p className="text-sm text-text-secondary mt-0.5">{app.description}</p>
        </div>
        <div className="text-xs bg-lime-400/10 text-lime-400 border border-lime-400/20 px-3 py-1 rounded-full font-medium flex-shrink-0">
          Max 10 Images
        </div>
      </div>

      {/* 1. COMPLETED HISTORY (Laying ABOVE the upload box) */}
      {completedHistory.length > 0 && (
        <div className="animate-slide-up space-y-6 border-b border-[#1c1c1c] pb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-semibold text-text-primary">
                Retouch History ({completedHistory.length})
              </h3>
              
              {completedHistory.some(f => f.status === 'success') && (
                <div className="flex items-center gap-2 border-l border-[#1c1c1c] pl-4">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {selectedFiles.size > 0 && selectedFiles.size === completedHistory.filter(f => f.status === 'success').length ? (
                      <CheckSquare className="w-4 h-4 text-lime-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    Select All
                  </button>
                  
                  {selectedFiles.size > 0 && (
                    <button
                      onClick={downloadSelectedAsZip}
                      disabled={isZipping}
                      className="flex items-center gap-1.5 text-xs bg-lime-400 text-black px-2 py-1 rounded-md hover:bg-lime-300 transition-colors disabled:opacity-50 font-bold"
                    >
                      {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                      Download ZIP ({selectedFiles.size})
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <button 
              onClick={clearCompleted}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Clear Completed
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {completedHistory.map(file => {
              const isSuccess = file.status === 'success';
              const isFailed = file.status === 'failed';

              return (
                <div 
                  key={file.id} 
                  className="relative rounded-2xl border border-[#1c1c1c] hover:border-lime-400/30 overflow-hidden bg-gradient-to-b from-[#141414] to-[#0a0a0a] flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_40px_rgba(213,255,64,0.1)] hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Media Display Container (Draggable) */}
                  <div 
                    draggable={isSuccess && !!file.outputUrl}
                    onDragStart={(e) => {
                      if (file.outputUrl) {
                        e.dataTransfer.setData('text/plain', file.outputUrl);
                        e.dataTransfer.setData('application/json', JSON.stringify({ url: file.outputUrl, type: 'image' }));
                        e.dataTransfer.effectAllowed = 'copy';
                      }
                    }}
                    className="relative aspect-square w-full bg-black/30 overflow-hidden"
                  >
                    {isSuccess && file.outputUrl && file.originalUrl ? (
                      /* Interactive Before/After Image Slider */
                      <BeforeAfterSlider 
                        originalUrl={file.originalUrl} 
                        outputUrl={file.outputUrl} 
                      />
                    ) : (
                      /* Original Thumbnail Preview */
                      <Image 
                        src={file.preview} 
                        alt="Preview" 
                        fill 
                        className="object-cover opacity-80" 
                        sizes="200px" 
                      />
                    )}

                    {/* Success Select Checkbox & Preview Trigger */}
                    {isSuccess && (
                      <>
                        <div className="absolute top-2 left-2 bg-lime-400 text-black rounded-full p-1 shadow-md z-20">
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <button
                          onClick={() => toggleSelection(file.id)}
                          className="absolute top-2 right-2 bg-black/40 hover:bg-black/60 rounded-md p-1 backdrop-blur-sm z-30 transition-colors"
                        >
                          {selectedFiles.has(file.id) ? (
                            <CheckSquare className="w-4 h-4 text-lime-400" />
                          ) : (
                            <Square className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <button
                          onClick={() => setPreviewImages({ before: file.originalUrl!, after: file.outputUrl! })}
                          className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 rounded-full p-1.5 backdrop-blur-sm z-30 transition-colors shadow-lg"
                          title="View Full Resolution slider"
                        >
                          <Eye className="w-4 h-4 text-white" />
                        </button>
                      </>
                    )}

                    {/* Error Overlay */}
                    {isFailed && (
                      <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center p-3 text-center z-20">
                        <X className="w-8 h-8 text-red-400 mb-2" />
                        <span className="text-[10px] text-red-200 font-medium line-clamp-3">
                          {file.error || 'Failed'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Settings / Parameters Underneath each Image */}
                  <div className="p-3 bg-[#0a0a0a] border-t border-[#1c1c1c] flex-1 flex flex-col justify-between">
                    <div className="space-y-1 text-[9px] text-text-secondary">
                      <p className="font-semibold line-clamp-2">
                        <span className="text-gray-500 uppercase tracking-wide mr-1 font-bold">Prompt:</span>
                        "{file.prompt}"
                      </p>
                      <p className="font-mono">
                        <span className="text-gray-500 uppercase tracking-wide mr-1 font-bold">Strength:</span>
                        {file.strength}
                      </p>
                    </div>

                    {/* Download single PNG Button */}
                    {isSuccess && file.outputUrl && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(file.outputUrl!);
                            const blob = await res.blob();
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = getFileNameFromUrl(file.outputUrl!);
                            a.click();
                            URL.revokeObjectURL(a.href);
                          } catch {
                            window.open(file.outputUrl!, '_blank');
                          }
                        }}
                        className="w-full mt-2.5 py-1.5 px-2 rounded-lg bg-black hover:bg-white/10 text-[10px] font-semibold text-lime-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors border border-[#1c1c1c]"
                      >
                        <Download className="w-3 h-3" /> Download PNG
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. MODERN DRAG & DROP ZONE (Middle Section) */}
      <div
        {...getRootProps()}
        className={cn(
          "relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer overflow-hidden",
          batchFiles.length === 0 ? "py-24" : "py-10",
          isDragActive 
            ? "border-lime-400 bg-lime-950/10 scale-[1.02]" 
            : "border-border hover:border-lime-400/50 bg-black hover:bg-[#121212]"
        )}
      >
        <input {...getInputProps()} />
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
          isDragActive ? "bg-lime-400 text-black shadow-lg shadow-lime-400/20" : "bg-[#121212] border border-[#1c1c1c] text-text-muted"
        )}>
          <Upload className="w-8 h-8" />
        </div>
        <h4 className={cn("text-lg font-bold mb-2 transition-colors", isDragActive ? "text-lime-400" : "text-text-primary")}>
          {isDragActive ? "Drop images here!" : "Drag & drop images here"}
        </h4>
        <p className="text-sm text-text-secondary text-center max-w-sm">
          Supports PNG, JPG up to 10MB per file. You can select up to 10 images at once.
        </p>
      </div>

      {/* 3. ACTIVE QUEUE / NEW TASKS (Laying BELOW the upload box) */}
      {activeQueue.length > 0 && (
        <div className="animate-slide-up space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              New Retouch Tasks ({activeQueue.length})
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {activeQueue.map(file => {
              const showSkeleton = file.status === 'uploading' || file.status === 'processing';

              return (
                <div 
                  key={file.id} 
                  className="relative rounded-2xl border border-[#1c1c1c] hover:border-lime-400/30 overflow-hidden bg-gradient-to-b from-[#141414] to-[#0a0a0a] flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_40px_rgba(213,255,64,0.1)] hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Media Display Container */}
                  <div className="relative aspect-square w-full bg-black/30 overflow-hidden">
                    <Image 
                      src={file.preview} 
                      alt="Preview" 
                      fill 
                      className="object-cover opacity-80" 
                      sizes="200px" 
                    />

                    {/* Processing loading state overlay */}
                    {showSkeleton && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-10">
                        <div className="w-9 h-9 rounded-full border-2 border-[#1c1c1c] border-t-lime-400 animate-spin" />
                        <div className="text-[10px] font-black text-lime-400 tracking-widest uppercase">
                          {file.status === 'uploading' ? 'Uploading...' : 'Retouching...'}
                        </div>
                      </div>
                    )}

                    {/* Remove button (only before processing) */}
                    {!showSkeleton && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center z-30">
                        <button
                          onClick={() => removeFile(file.id)}
                          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg"
                          title="Remove image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Settings / Parameters Underneath each Image */}
                  <div className="p-3 bg-[#0a0a0a] border-t border-[#1c1c1c] flex-1 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      {/* Prompt Input */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                          Prompt
                        </label>
                        <textarea
                          value={file.prompt}
                          onChange={(e) => updatePrompt(file.id, e.target.value)}
                          placeholder="Describe scene..."
                          rows={2}
                          className="w-full bg-black border border-[#1c1c1c] rounded-xl px-2.5 py-1.5 text-xs text-text-primary placeholder-text-muted focus:border-lime-400/50 outline-none transition-all resize-none"
                        />
                      </div>

                      {/* Effect Strength Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
                            Strength
                          </label>
                          <span className="text-[9px] font-mono text-lime-400 font-bold">{file.strength}</span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.05"
                          value={file.strength}
                          onChange={(e) => updateStrength(file.id, e.target.value)}
                          className="w-full accent-lime-400 h-1 bg-black rounded-lg cursor-pointer appearance-none border border-[#1c1c1c]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Run Batch Processing Button */}
          {activeQueue.some(f => f.status === 'idle') && (
            <button
              onClick={handleRunBatch}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 bg-gradient-gold text-black font-extrabold py-3 rounded-xl btn-lift disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(213,255,64,0.4)]"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Preparing Batch...</>
              ) : (
                <><Play className="w-5 h-5 stroke-[3]" /> Run Retouching ({activeQueue.filter(f => f.status === 'idle').length} Images)</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Full Screen Image Preview Slider Lightbox */}
      {previewImages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <button 
            onClick={() => setPreviewImages(null)}
            className="absolute top-6 right-6 text-white hover:text-lime-400 transition-colors bg-black/50 p-2.5 rounded-full z-50"
            title="Close Lightbox"
          >
            <X className="w-7 h-7" />
          </button>
          <div className="relative w-full max-w-2xl aspect-square mx-auto rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-[#1c1c1c]">
            <BeforeAfterSlider 
              originalUrl={previewImages.before} 
              outputUrl={previewImages.after} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
