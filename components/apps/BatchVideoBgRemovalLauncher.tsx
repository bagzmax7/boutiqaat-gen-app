'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Loader2, Play, Upload, X, CheckCircle2, Download, Trash2, Film, AlertCircle } from 'lucide-react';
import { cn, getFileNameFromUrl } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import { AppDefinition } from '@/lib/types';

interface AppLauncherProps {
  app: AppDefinition;
  onTaskStarted: (
    taskId: string,
    appName: string,
    nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[],
    apiKeyType?: 'enterprise' | 'consumer'
  ) => void;
}

interface BatchVideoFile {
  id: string;
  file: File;
  preview: string;
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'failed';
  runningHubTaskId?: string;
  outputUrl?: string;
  originalUrl?: string;
  error?: string;
}

export default function BatchVideoBgRemovalLauncher({ app, onTaskStarted }: AppLauncherProps) {
  const [batchFiles, setBatchFiles] = useState<BatchVideoFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { tasks } = useTasks();

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    // Handle rejected files (e.g. > 50MB)
    if (fileRejections.length > 0) {
      fileRejections.forEach(rejection => {
        const errorMsg = rejection.errors[0]?.message || 'Invalid file';
        toast.error(`${rejection.file.name}: ${errorMsg}`);
      });
    }

    if (acceptedFiles.length === 0) return;

    // Check 10 files limit (since video processing is heavy, let's limit to 10 at once)
    setBatchFiles(prev => {
      const newFiles = acceptedFiles.map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        preview: URL.createObjectURL(file),
        status: 'idle' as const,
      }));
      
      const totalFiles = [...prev, ...newFiles];
      if (totalFiles.length > 10) {
        toast.error("You can only process up to 10 videos at once.");
        return totalFiles.slice(0, 10);
      }
      return totalFiles;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.webm'] },
    maxFiles: 10,
    maxSize: 50 * 1024 * 1024, // 50 MB
  });

  const removeFile = (id: string) => {
    setBatchFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleRunBatch = async () => {
    const filesToProcess = batchFiles.filter(f => f.status === 'idle' || f.status === 'failed');
    if (filesToProcess.length === 0) return;

    setIsProcessing(true);

    // Process all files in parallel
    await Promise.all(filesToProcess.map(async (batchFile, index) => {
      try {
        // 1. Set status to uploading
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'uploading' } : f));
        
        // 2. Upload video file
        const formData = new FormData();
        formData.append('file', batchFile.file);
        const uploadRes = await fetch('/api/runninghub/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        
        if (!uploadData.fileUrl) throw new Error(uploadData.error || 'Upload failed');
        const originalUrl = uploadData.fileUrl;

        // 3. Set status to processing
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'processing', originalUrl } : f));
        
        // 4. Start RunningHub task with 'plus' instance type and 'enterprise' api key type
        const nodeInfoList = [
          { nodeId: '2', fieldName: 'video', fieldValue: originalUrl }
        ];

        const runRes = await fetch('/api/runninghub/run-app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId: app.id,
            nodeInfoList,
            instanceType: 'plus', // Force 'plus' instance type as requested
            apiKeyType: 'enterprise', // Explicitly target enterprise key (falls back to consumer)
            isWorkflow: true,
            addMetadata: true,
          }),
        });
        const runData = await runRes.json();
        
        if (!runData.taskId) throw new Error(runData.errorMessage || runData.error || 'Task failed');
        
        // 5. Success! Wait for polling via useTasks hook
        onTaskStarted(runData.taskId, `${app.name} (${index + 1})`, nodeInfoList, 'enterprise');
        
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, runningHubTaskId: runData.taskId } : f));
        
      } catch (err: any) {
        setBatchFiles(prev => prev.map(f => f.id === batchFile.id ? { ...f, status: 'failed', error: err.message } : f));
        toast.error(`Failed to process ${batchFile.file.name}: ${err.message}`);
      }
    }));

    setIsProcessing(false);
  };

  const clearCompleted = () => {
    setBatchFiles(prev => prev.filter(f => {
      const task = tasks.find(t => t.taskId === f.runningHubTaskId);
      const isSuccess = task?.status === 'SUCCESS';
      if (isSuccess && f.preview) {
        URL.revokeObjectURL(f.preview);
      }
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
          Max 10 Videos · Instance: Plus (48G)
        </div>
      </div>

      {/* Modern Drag & Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer mb-6 overflow-hidden",
          batchFiles.length === 0 ? "py-20" : "py-10",
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
          <Film className="w-8 h-8" />
        </div>
        <h4 className={cn("text-lg font-bold mb-2 transition-colors", isDragActive ? "text-accent-gold" : "text-text-primary")}>
          {isDragActive ? "Drop videos here!" : "Drag & drop videos here"}
        </h4>
        <p className="text-sm text-text-muted text-center max-w-sm px-4">
          Supports MP4, MOV, WEBM up to 50MB per file. You can select up to 10 videos at once.
        </p>
      </div>

      {/* Queue & Results Grid */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {batchFiles.map(file => {
              // Check task status from global store
              const task = tasks.find(t => t.taskId === file.runningHubTaskId);
              const isTaskRunning = task?.status === 'RUNNING' || task?.status === 'QUEUED';
              const isTaskSuccess = task?.status === 'SUCCESS';
              const isTaskFailed = task?.status === 'FAILED';
              
              // Only consider local processing if task hasn't succeeded/failed yet
              const isLocalProcessing = (file.status === 'uploading' || file.status === 'processing') && !isTaskSuccess && !isTaskFailed;
              const showSkeleton = isLocalProcessing || isTaskRunning;
              
              const outputUrl = task?.outputs?.[0]?.fileUrl || file.outputUrl;

              return (
                <div key={file.id} className="relative rounded-xl border border-border overflow-hidden bg-bg-secondary shadow-sm transition-all hover:shadow-md flex flex-col h-full">
                  
                  {/* Video Display Area */}
                  <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
                    {isTaskSuccess && outputUrl ? (
                      <video 
                        src={outputUrl} 
                        controls 
                        className="w-full h-full object-contain"
                        preload="metadata"
                      />
                    ) : (
                      <video 
                        src={file.preview} 
                        muted 
                        loop 
                        className="w-full h-full object-contain opacity-50 pointer-events-none"
                      />
                    )}

                    {/* Processing/Uploading Loader Overlay */}
                    {showSkeleton && (
                      <div className="absolute inset-0 bg-bg-card/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
                        <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
                        <div className="text-xs font-bold text-accent-gold tracking-widest uppercase">
                          {file.status === 'uploading' ? 'Uploading Video...' : 'Running AI Workflow...'}
                        </div>
                      </div>
                    )}

                    {/* Success Overlay */}
                    {isTaskSuccess && (
                      <div className="absolute top-3 left-3 bg-accent-green text-white rounded-full p-1.5 shadow-md z-20">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}

                    {/* Error Overlay */}
                    {(file.status === 'failed' || isTaskFailed) && (
                      <div className="absolute inset-0 bg-accent-red/90 flex flex-col items-center justify-center p-4 text-center z-20">
                        <AlertCircle className="w-8 h-8 text-white mb-2" />
                        <span className="text-xs text-white font-semibold mb-1">
                          Processing Failed
                        </span>
                        <span className="text-[10px] text-white/90 max-w-[80%] line-clamp-3">
                          {task?.error || file.error || 'Unknown error occurred'}
                        </span>
                      </div>
                    )}

                    {/* Remove button (only before processing starts) */}
                    {!showSkeleton && !isTaskFailed && file.status !== 'failed' && !isTaskSuccess && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center z-30">
                        <button
                          onClick={() => removeFile(file.id)}
                          className="w-10 h-10 rounded-full bg-accent-red/90 hover:bg-accent-red text-white flex items-center justify-center transition-all shadow-lg scale-90 hover:scale-100"
                          title="Remove video"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Info & Action Footer */}
                  <div className="p-4 bg-bg-card border-t border-border flex flex-col justify-between flex-grow">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <span className="text-xs font-semibold text-text-primary truncate" title={file.file.name}>
                        {file.file.name}
                      </span>
                      <span className="text-[10px] text-text-muted flex-shrink-0">
                        {(file.file.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>

                    {isTaskSuccess && outputUrl && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(outputUrl);
                            const blob = await res.blob();
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = getFileNameFromUrl(outputUrl) || 'removed-bg.mp4';
                            a.click();
                            URL.revokeObjectURL(a.href);
                          } catch {
                            window.open(outputUrl, '_blank');
                          }
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-accent-gold/10 hover:bg-accent-gold text-accent-gold hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all border border-accent-gold/25 hover:border-accent-gold"
                      >
                        <Download className="w-4 h-4" /> Download Processed Video
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Run Button */}
          {batchFiles.some(f => f.status === 'idle' || f.status === 'failed') && (
            <button
              onClick={handleRunBatch}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 bg-gradient-gold text-white font-semibold py-3.5 rounded-xl btn-lift glow-gold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Launching tasks...</>
              ) : (
                <><Play className="w-5 h-5" /> Start Processing {batchFiles.filter(f => f.status === 'idle' || f.status === 'failed').length} Video(s)</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
