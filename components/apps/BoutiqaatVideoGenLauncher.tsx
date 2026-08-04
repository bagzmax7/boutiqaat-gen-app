'use client';

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { 
  Loader2, Play, Upload, X, CheckCircle2, AlertCircle, 
  ChevronDown, Image as ImageIcon, Film, FileAudio, FileVideo, 
  MonitorPlay, Maximize, Clock, Settings2, SlidersHorizontal, Mic, User2
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

const MODELS = [
  { id: 'rhart-video/sparkvideo-2.0-mini/multimodal-video', name: 'Seedance 2.0-mini (Multimodal)' },
  { id: 'bytedance/seedance-2.0-global/image-to-video', name: 'Seedance 2.0 Global' },
  { id: 'rhart-video/sparkvideo-2.0/text-to-video', name: 'SparkVideo 2.0 (Text to Video)' },
  { id: 'rhart-video/sparkvideo-2.0/image-to-video', name: 'SparkVideo 2.0 (Image to Video)' },
  { id: 'rhart-video/sparkvideo-2.0/multimodal-video', name: 'SparkVideo 2.0 (Multimodal)' },
  { id: 'seedance-2.0-global-fast/image-to-video', name: 'Seedance 2.0 Global Fast' },
  { id: 'kling-video-o1/image-to-video', name: 'Kling O1 (Image to Video)' },
  { id: 'kling-v3.0-std-image-to-video', name: 'Kling V3.0 Standard' },
  { id: 'google/veo3.1-pro/start-end-to-video-channel-low-price', name: 'Veo 3.1 Pro (Low Cost)' },
  { id: 'google/veo3.1-fast/start-end-to-video-channel-low-price', name: 'Veo 3.1 Fast (Low Cost)' },
];

const RATIOS = ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];
const QUALITIES = ['480p', '720p', '1080p', '2k', '4k'];
const DURATIONS = ['5s', '6s', '10s', '15s'];

export default function BoutiqaatVideoGenLauncher({ app, onTaskStarted }: AppLauncherProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [selectedMode, setSelectedMode] = useState('Multimodal Reference');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);
  
  // Settings State
  const [ratio, setRatio] = useState('16:9');
  const [quality, setQuality] = useState('720p');
  const [duration, setDuration] = useState('6s');
  const [realPerson, setRealPerson] = useState('On');
  const [audio, setAudio] = useState('On');

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { tasks } = useTasks();
  
  // Fake balance state
  const balance = "$ --"; 

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploadedFiles(prev => {
      const newFiles = [...prev, ...acceptedFiles];
      if (newFiles.length > 3) {
        toast.error("You can only upload up to 3 references at once.");
        return newFiles.slice(0, 3);
      }
      return newFiles;
    });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    maxFiles: 3,
    noClick: true, // We will trigger it via the upload button
  });
  
  const dropzoneRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() && uploadedFiles.length === 0) {
      toast.error('Please provide a prompt or upload reference media.');
      return;
    }
    
    // Validation: Image-to-video models require at least one image reference
    if (selectedModel.includes('image-to-video') && uploadedFiles.length === 0) {
      toast.error('This model requires at least 1 image reference file. Please upload an image.');
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Upload files first if any and categorize by type
      const imageUrls: string[] = [];
      const videoUrls: string[] = [];
      const audioUrls: string[] = [];

      for (const file of uploadedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/runninghub/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.fileUrl) throw new Error(uploadData.error || 'Upload failed');

        if (file.type.startsWith('video/')) {
          videoUrls.push(uploadData.fileUrl);
        } else if (file.type.startsWith('audio/')) {
          audioUrls.push(uploadData.fileUrl);
        } else {
          imageUrls.push(uploadData.fileUrl);
        }
      }

      // 2. Call video generation Next.js route
      const payload = {
        model: selectedModel,
        prompt,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
        audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
        ratio,
        aspect_ratio: ratio,
        quality,
        resolution: quality,
        duration,
        realPerson: realPerson === 'On',
        audio: audio === 'On'
      };

      const genRes = await fetch('/api/runninghub/video-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const genData = await genRes.json();
      if (!genRes.ok || !genData.taskId) {
        throw new Error(genData.errorMessage || genData.msg || genData.error || 'Video generation failed');
      }

      // 3. Register task via onTaskStarted
      const nodeInfoList = [
        { nodeId: 'prompt', fieldName: 'text', fieldValue: prompt },
        { nodeId: 'model', fieldName: 'id', fieldValue: selectedModel }
      ];
      onTaskStarted(genData.taskId, `Video Gen: ${prompt.slice(0, 20)}...`, nodeInfoList, 'enterprise');
      
      toast.success('Video generation started successfully!');
      
      // Reset after starting
      setPrompt('');
      setUploadedFiles([]);
    } catch (err: any) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-[#0f1115] border border-white/10 rounded-2xl p-6 shadow-2xl text-white font-sans w-full max-w-5xl mx-auto flex flex-col">
      {/* Header with Balance */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            Boutiqaat Video Gen
          </h2>
          <p className="text-sm text-gray-400 mt-1">Transform concepts into cinematic motion</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm">
            <span className="text-gray-400">Balance:</span>
            <span className="text-green-400 font-mono font-semibold">{balance}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left Vertical Tabs */}
        <div className="flex flex-col gap-2 w-16 flex-shrink-0">
          <button className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-white/5 text-gray-500 transition-colors cursor-not-allowed">
            <User2 className="w-5 h-5 mb-1" />
            <span className="text-[10px]">Agent</span>
          </button>
          <button className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-white/5 text-gray-500 transition-colors cursor-not-allowed">
            <ImageIcon className="w-5 h-5 mb-1" />
            <span className="text-[10px]">Image</span>
          </button>
          <button className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 text-green-400 transition-colors border border-green-500/30">
            <Film className="w-5 h-5 mb-1" />
            <span className="text-[10px]">Video</span>
          </button>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col relative" {...getRootProps()}>
          <input {...getInputProps()} ref={dropzoneRef} />
          
          {/* Prompt Container */}
          <div className="bg-[#171920] border border-white/10 rounded-2xl p-4 flex flex-col relative focus-within:border-green-500/50 transition-colors shadow-inner">
            
            {/* Uploaded Files Preview */}
            {uploadedFiles.length > 0 && (
              <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
                {uploadedFiles.map((f, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/20 bg-black/50 group flex-shrink-0">
                    {f.type.startsWith('video/') ? (
                       <FileVideo className="w-8 h-8 text-white/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    ) : (
                       <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="preview" />
                    )}
                    <button 
                      onClick={() => removeFile(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Upload up to 3 videos, 9 images, and 3 audio clips. Mix and match elements like characters, scenes, and more. Example: Set @Image 1 as the first frame..."
              className="w-full bg-transparent resize-none outline-none text-sm text-gray-200 placeholder:text-gray-600 min-h-[100px]"
            />

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
              <button 
                onClick={() => dropzoneRef.current?.click()}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Upload media"
              >
                <Upload className="w-4 h-4" />
              </button>
              
              <button className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <FileAudio className="w-3.5 h-3.5" />
                Asset Library
              </button>
            </div>
          </div>

          {/* Configuration Row */}
          <div className="flex flex-wrap items-center gap-3 mt-4 relative">
            
            {/* Model Dropdown */}
            <div className="relative">
              <button 
                onClick={() => { setIsModelOpen(!isModelOpen); setIsModeOpen(false); setIsSettingsOpen(false); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171920] border border-white/10 hover:border-white/30 text-sm text-gray-200 transition-all"
              >
                <MonitorPlay className="w-4 h-4 text-green-400" />
                {MODELS.find(m => m.id === selectedModel)?.name}
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 ml-2" />
              </button>

              {isModelOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModel(m.id); setIsModelOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center justify-between",
                        selectedModel === m.id ? "text-green-400 bg-white/5" : "text-gray-300"
                      )}
                    >
                      {m.name}
                      {selectedModel === m.id && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mode Dropdown */}
            <div className="relative">
              <button 
                onClick={() => { setIsModeOpen(!isModeOpen); setIsModelOpen(false); setIsSettingsOpen(false); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171920] border border-white/10 hover:border-white/30 text-sm text-gray-200 transition-all"
              >
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                {selectedMode}
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 ml-2" />
              </button>

              {isModeOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                  {['Multimodal Reference', 'Free Create'].map(m => (
                    <button
                      key={m}
                      onClick={() => { setSelectedMode(m); setIsModeOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center justify-between",
                        selectedMode === m ? "text-emerald-400 bg-white/5" : "text-gray-300"
                      )}
                    >
                      {m}
                      {selectedMode === m && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Settings Trigger */}
            <div className="relative">
              <button 
                onClick={() => { setIsSettingsOpen(!isSettingsOpen); setIsModelOpen(false); setIsModeOpen(false); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171920] border border-white/10 hover:border-white/30 text-sm text-gray-200 transition-all"
              >
                <Settings2 className="w-4 h-4 text-blue-400" />
                {ratio} / {quality} / {duration} / {realPerson} / {audio === 'On' ? 'With Audio' : 'No Audio'}
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 ml-2" />
              </button>

              {isSettingsOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl z-50 p-5 flex flex-col gap-5">
                  
                  {/* Ratio */}
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-2 block uppercase tracking-wider">Video Ratio</label>
                    <div className="flex flex-wrap gap-2">
                      {RATIOS.map(r => (
                        <button 
                          key={r} onClick={() => setRatio(r)}
                          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border", ratio === r ? "bg-blue-500/20 border-blue-500 text-blue-400" : "bg-black/30 border-white/5 text-gray-400 hover:border-white/20")}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality */}
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-2 block uppercase tracking-wider">Video Quality</label>
                    <div className="flex bg-black/30 p-1 rounded-lg border border-white/5">
                      {QUALITIES.map(q => (
                        <button 
                          key={q} onClick={() => setQuality(q)}
                          className={cn("flex-1 py-1.5 rounded-md text-xs font-medium transition-all text-center", quality === q ? "bg-white/10 text-white shadow" : "text-gray-500 hover:text-gray-300")}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-2 flex items-center justify-between uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> Video Duration
                      </span>
                      {selectedModel.toLowerCase().includes('seedance') || selectedModel.toLowerCase().includes('sparkvideo') ? (
                        <span className="bg-[#242832] border border-white/10 text-white text-xs px-2.5 py-1 rounded-md font-mono">
                          {duration.replace(/s$/, '')} s
                        </span>
                      ) : null}
                    </label>
                    
                    {selectedModel.toLowerCase().includes('seedance') || selectedModel.toLowerCase().includes('sparkvideo') ? (
                      <div className="flex items-center gap-3 pt-1">
                        <input 
                          type="range" 
                          min={4} 
                          max={15} 
                          step={1}
                          value={parseInt(duration.replace(/[^0-9]/g, ''), 10) || 5}
                          onChange={(e) => setDuration(`${e.target.value}s`)}
                          className="w-full h-2 bg-[#12141a] rounded-lg appearance-none cursor-pointer accent-lime-400"
                        />
                      </div>
                    ) : (
                      <div className="flex bg-black/30 p-1 rounded-lg border border-white/5">
                        {DURATIONS.map(d => (
                          <button 
                            key={d} onClick={() => setDuration(d)}
                            className={cn("flex-1 py-1.5 rounded-md text-xs font-medium transition-all text-center", duration === d ? "bg-white/10 text-white shadow" : "text-gray-500 hover:text-gray-300")}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    {/* Real Person */}
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 font-semibold mb-2 block uppercase tracking-wider">Real Person</label>
                      <div className="flex bg-black/30 p-1 rounded-lg border border-white/5">
                        {['On', 'Off'].map(v => (
                          <button key={v} onClick={() => setRealPerson(v)} className={cn("flex-1 py-1 text-xs rounded-md transition-all", realPerson === v ? "bg-white/10 text-white" : "text-gray-500")}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Audio */}
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1 uppercase tracking-wider">
                        <Mic className="w-3.5 h-3.5" /> Generate Audio
                      </label>
                      <div className="flex bg-black/30 p-1 rounded-lg border border-white/5">
                        {['On', 'Off'].map(v => (
                          <button key={v} onClick={() => setAudio(v)} className={cn("flex-1 py-1 text-xs rounded-md transition-all", audio === v ? "bg-white/10 text-white" : "text-gray-500")}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Generate Button (Only active if prompt or file exists) */}
            <div className="ml-auto">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || (!prompt.trim() && uploadedFiles.length === 0)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Generate
              </button>
            </div>

          </div>

          {/* Recent Tasks Display */}
          {tasks.filter(t => t.appId === app.id).length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-emerald-400" /> Recent Generations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.filter(t => t.appId === app.id).slice(0, 4).map(task => {
                  const outputUrl = task.outputs?.[0]?.fileUrl;
                  const isSuccess = task.status === 'SUCCESS';
                  const isFailed = task.status === 'FAILED';
                  const isRunning = task.status === 'RUNNING' || task.status === 'QUEUED';
                  
                  return (
                    <div key={task.id} className="relative aspect-video rounded-xl bg-black border border-white/10 overflow-hidden flex items-center justify-center group">
                      {isSuccess && outputUrl ? (
                        <video src={outputUrl} controls className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-center p-4">
                          {isRunning && <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-2" />}
                          {isFailed && <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />}
                          <p className="text-xs text-gray-400 line-clamp-2">{task.appName}</p>
                          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{task.status}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
