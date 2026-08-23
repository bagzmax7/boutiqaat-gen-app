'use client';

import React, { useState } from 'react';
import { LayersProject } from '@/lib/types';
import { 
  FolderPlus, 
  Layers, 
  Sparkles, 
  Clock, 
  Trash2, 
  Copy, 
  ArrowRight, 
  Sliders, 
  UploadCloud, 
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Zap,
  AlertTriangle,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LayersProjectHubProps {
  projects: LayersProject[];
  loading: boolean;
  onOpenProject: (project: LayersProject) => void;
  onRefreshProjects: () => void;
}

export const LayersProjectHub: React.FC<LayersProjectHubProps> = ({
  projects,
  loading,
  onOpenProject,
  onRefreshProjects,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Form State
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState<'banner-ads' | 'product-photo' | 'catalog' | 'social-media' | 'general'>('product-photo');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 1200, height: 1200 });

  // Boutiqaat Pro Layers Decomposition Parameters
  const [resolution, setResolution] = useState<'auto' | '1k' | '1.5k' | '2k'>('auto');
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [prompt, setPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filter State
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 30 * 1024 * 1024) {
        toast.error('File exceeds 30MB limit');
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      const img = new window.Image();
      img.onload = () => {
        const w = img.naturalWidth || 1200;
        const h = img.naturalHeight || 1200;
        setImageDimensions({ width: w, height: h });
      };
      img.src = url;

      if (!projectName) {
        setProjectName(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  const [modalError, setModalError] = useState<string | null>(null);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please upload an image to decompose');
      return;
    }

    try {
      setModalError(null);
      setIsSubmitting(true);
      setUploadProgress('Uploading master commercial photo (Lossless)...');

      // 1. Upload file binary
      const formData = new FormData();
      formData.append('file', selectedFile);

      const upRes = await fetch('/api/runninghub/upload', {
        method: 'POST',
        body: formData,
      });

      if (!upRes.ok) {
        const upErr = await upRes.json().catch(() => ({}));
        throw new Error(upErr.error || 'Failed to upload photo');
      }

      const upData = await upRes.json();
      const imageUrl = upData.fileUrl;

      setUploadProgress('Analyzing depth, segmenting elements & inpainting background with Boutiqaat Layers Pro Engine...');

      // 2. Call Decomposition API
      const decompRes = await fetch('/api/layers/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: prompt.trim() || null,
          resolution,
          outputFormat,
          canvas_width: imageDimensions.width,
          canvas_height: imageDimensions.height,
        }),
      });

      const decompData = await decompRes.json();

      if (!decompRes.ok || !decompData.success) {
        throw new Error(decompData.error || 'Decomposition failed or rejected by security audit');
      }

      const layers = decompData.layers || [];
      const canvasWidth = decompData.canvas_width || imageDimensions.width || 1200;
      const canvasHeight = decompData.canvas_height || imageDimensions.height || 1200;

      setUploadProgress('Calibrating studio canvas & saving project...');

      // 3. Save Project
      const projRes = await fetch('/api/layers/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          project: {
            name: projectName || 'Untitled Project',
            category,
            thumbnail_url: layers[0]?.currentUrl || imageUrl,
            canvas_width: canvasWidth,
            canvas_height: canvasHeight,
            layers,
          },
        }),
      });

      if (!projRes.ok) throw new Error('Failed to create project record');
      const projData = await projRes.json();

      toast.success('Project created and decomposed successfully!');
      setShowCreateModal(false);
      onRefreshProjects();
      onOpenProject(projData.project);
    } catch (err: any) {
      console.error('[Create Project Error]', err);
      const errMsg = err.message || 'Decomposition failed';
      setModalError(errMsg);
      toast.error(errMsg, { duration: 7000 });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const res = await fetch('/api/layers/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', projectId }),
      });
      if (res.ok) {
        toast.success('Project deleted');
        onRefreshProjects();
      }
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const handleDuplicateProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/layers/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', projectId }),
      });
      if (res.ok) {
        toast.success('New revision created');
        onRefreshProjects();
      }
    } catch {
      toast.error('Failed to duplicate project');
    }
  };

  const validProjects = (projects || []).filter(p => p && p.id && p.name && Array.isArray(p.layers) && p.layers.length > 0);

  const filteredProjects = validProjects.filter(p => {
    const matchesCat = filterCategory === 'all' || (p.category || 'general') === filterCategory;
    const matchesSearch = !searchQuery || (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Hero Header matching Boutiqaat Flow Studio typography & neon lime glow */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-500/10 border border-lime-500/20 text-[#a3e635] text-xs font-semibold tracking-wider">
          <Zap className="w-3.5 h-3.5 fill-[#a3e635]" />
          BOUTIQAAT PRO LAYERS ENGINE
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#a3e635] tracking-tight drop-shadow-[0_0_25px_rgba(163,230,53,0.35)]">
          Boutiqaat Layers Studio
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
          Transform flat commercial photographs into editable, multi-layer canvases. Reposition products, re-create elements with 2K AI, swap backgrounds, and export native Photoshop .PSD files.
        </p>
      </div>

      {/* Action Bar & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0d0e10] border border-zinc-800/90 shadow-xl">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {[
            { id: 'all', label: 'All Projects' },
            { id: 'product-photo', label: 'Product Photos' },
            { id: 'banner-ads', label: 'Banner Ads' },
            { id: 'catalog', label: 'Catalog' },
            { id: 'social-media', label: 'Social 9:16' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filterCategory === cat.id
                  ? 'bg-[#a3e635] text-[#0d0e10] shadow-md shadow-[#a3e635]/20'
                  : 'bg-[#15171c] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 rounded-xl bg-[#15171c] border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:border-[#a3e635] outline-none w-full sm:w-60"
          />
          <button
            onClick={onRefreshProjects}
            className="p-2.5 rounded-xl bg-[#15171c] border border-zinc-800 text-zinc-400 hover:text-[#a3e635] hover:bg-zinc-800 transition-colors"
            title="Refresh Projects"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#a3e635] hover:bg-[#bef264] text-[#0d0e10] font-black text-xs shadow-lg shadow-[#a3e635]/25 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4" />
            Create New Project
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {loading && projects.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-64 rounded-3xl bg-[#0d0e10] border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => onOpenProject(project)}
              className="group relative rounded-3xl bg-[#0d0e10] border border-zinc-800/80 hover:border-[#a3e635]/60 hover:bg-[#121316] transition-all duration-300 hover:shadow-2xl hover:shadow-[#a3e635]/10 cursor-pointer overflow-hidden flex flex-col"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full bg-[#050505] overflow-hidden border-b border-zinc-800">
                {project.thumbnail_url ? (
                  <img
                    src={project.thumbnail_url}
                    alt={project.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <ImageIcon className="w-12 h-12 stroke-[1.5]" />
                  </div>
                )}

                {/* Revision Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#050505]/90 backdrop-blur-md border border-zinc-800 text-[10px] font-mono text-[#a3e635] font-black">
                  v{project.revision_count}.0
                </div>

                {/* Layer Count */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#050505]/90 backdrop-blur-md border border-zinc-800 text-[10px] font-mono text-zinc-300 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-[#a3e635]" />
                  {project.layers?.length || 0} Layers
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-white group-hover:text-[#a3e635] transition-colors truncate">
                      {project.name}
                    </h3>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 font-semibold capitalize whitespace-nowrap">
                      {(project.category || 'general').replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {(() => {
                      const d = project.updated_at || project.created_at;
                      const t = d ? new Date(d).getTime() : NaN;
                      return !isNaN(t)
                        ? new Date(d).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Just now';
                    })()}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#a3e635] group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    Open Studio <ArrowRight className="w-3.5 h-3.5" />
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleDuplicateProject(project.id, e)}
                      title="Create New Revision (Fork)"
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      title="Delete Project"
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 rounded-3xl bg-[#0d0e10]/60 border border-dashed border-zinc-800 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-lime-500/10 border border-lime-500/20 text-[#a3e635] flex items-center justify-center mx-auto">
            <Layers className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No Layer Projects Yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Create your first project to decompose a commercial photo into isolated transparent layers.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#a3e635] hover:bg-[#bef264] text-[#0d0e10] font-black text-xs shadow-lg shadow-[#a3e635]/30 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Start New Project
          </button>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-[#0d0e10] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-800 bg-[#0d0e10] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/20 text-[#a3e635] flex items-center justify-center">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Create Layer Project</h3>
                  <p className="text-xs text-zinc-400">Decompose single commercial image into multi-layer studio canvas</p>
                </div>
              </div>
              {!isSubmitting && (
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateProject} className="p-6 space-y-6 overflow-y-auto flex-1 relative">
              {/* Prominent Error Notice Banner */}
              {modalError && (
                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/50 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Decomposition Failed / Security Notice</span>
                  </div>
                  <p className="text-xs text-red-200/90 leading-relaxed font-sans font-medium">
                    {modalError}
                  </p>
                  <p className="text-[10px] text-zinc-400 pt-1 border-t border-red-500/20">
                    💡 Tip: If this is caused by copyright restrictions or content security, please try uploading a different commercial product photograph or adjust segmentation prompts.
                  </p>
                </div>
              )}

              {/* Image Upload Dropzone */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">
                  Upload Commercial Photo (Up to 30MB)
                </label>
                <div className="relative border-2 border-dashed border-zinc-700 hover:border-[#a3e635]/60 rounded-2xl p-6 text-center bg-[#050505] transition-colors cursor-pointer group">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isSubmitting}
                  />

                  {previewUrl ? (
                    <div className="flex items-center gap-4 w-full p-2.5 bg-[#0a0b0d] rounded-xl border border-zinc-800/80 overflow-hidden text-left">
                      <div className="w-28 h-20 shrink-0 bg-[#050505] rounded-lg border border-zinc-800 flex items-center justify-center p-1 overflow-hidden shadow-inner">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-w-full max-h-full object-contain rounded"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="text-xs text-white font-bold block truncate" title={selectedFile?.name}>
                          {selectedFile?.name}
                        </span>
                        <span className="text-[11px] text-zinc-400 block font-mono">
                          Dimensions: {imageDimensions.width} × {imageDimensions.height} px
                        </span>
                        <span className="text-[10px] text-[#a3e635] font-semibold block hover:underline">
                          Click or drag new photo to change
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-lime-500/10 border border-lime-500/20 text-[#a3e635] flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">Click or drag & drop commercial photo here</p>
                        <p className="text-[11px] text-zinc-400">Supports PNG, JPG, WebP</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Project Meta Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Project Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Oud Luxury Bottle Campaign"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-zinc-800 focus:border-[#a3e635] text-white text-xs outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-zinc-800 focus:border-[#a3e635] text-white text-xs outline-none transition-colors"
                  >
                    <option value="product-photo">Product Photography</option>
                    <option value="banner-ads">E-Commerce Banner Ads</option>
                    <option value="catalog">Catalog Showcase</option>
                    <option value="social-media">Social Media 9:16</option>
                    <option value="general">General Creative</option>
                  </select>
                </div>
              </div>

              {/* Decomposition Parameter Selector Accordion */}
              <div className="rounded-2xl bg-[#050505] border border-zinc-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full p-4 flex items-center justify-between text-xs font-bold text-zinc-300 hover:bg-[#121316] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#a3e635]" />
                    Layer Engine Parameters (Custom Resolution & Format)
                  </span>
                  <span className="text-[11px] text-[#a3e635] font-normal">
                    {showAdvanced ? 'Hide Options ▲' : 'Configure Options ▼'}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="p-4 pt-0 space-y-4 border-t border-zinc-800/80 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      {/* Resolution Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-400">Decomposition Resolution</label>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl bg-[#0d0e10] border border-zinc-800 text-white text-xs outline-none focus:border-[#a3e635]"
                        >
                          <option value="auto">Auto (Match original image quality)</option>
                          <option value="1k">1K (1024px Fast)</option>
                          <option value="1.5k">1.5K (1536px Balanced)</option>
                          <option value="2k">2K (2048px Ultra-HD)</option>
                        </select>
                      </div>

                      {/* Output Format Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-400">Layer Output Format</label>
                        <select
                          value={outputFormat}
                          onChange={(e) => setOutputFormat(e.target.value as any)}
                          className="w-full px-3 py-2 rounded-xl bg-[#0d0e10] border border-zinc-800 text-white text-xs outline-none focus:border-[#a3e635]"
                        >
                          <option value="jpeg">JPEG (Base Background) + PNG Layers</option>
                          <option value="png">Pure Lossless PNG for all layers</option>
                        </select>
                      </div>
                    </div>

                    {/* Optional Segmentation Guidance Prompt */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-400">
                        Element Segmentation Prompt (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. perfume bottle, floating rose petals, typography logo, background pedestal"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#0d0e10] border border-zinc-800 text-white text-xs outline-none focus:border-[#a3e635]"
                      />
                      <p className="text-[10px] text-zinc-500">Leave blank for automatic smart element detection.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#a3e635] hover:bg-[#bef264] text-[#0d0e10] text-xs font-black shadow-lg shadow-[#a3e635]/30 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-[#0d0e10]" />
                  Decompose & Open Studio
                </button>
              </div>
            </form>

            {/* FROSTED GLASS BLUR RENDERING OVERLAY (DURING SUBMISSION) */}
            {isSubmitting && (
              <div className="absolute inset-0 z-50 bg-[#050505]/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in duration-300">
                {/* Glowing Neural Ring Spinner */}
                <div className="relative flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-4 border-zinc-800 border-t-[#a3e635] animate-spin" />
                  <div className="absolute w-12 h-12 rounded-2xl bg-[#a3e635]/15 border border-[#a3e635]/30 text-[#a3e635] flex items-center justify-center animate-pulse">
                    <Layers className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-2 max-w-md">
                  <h4 className="text-lg font-black text-white tracking-tight">
                    Decomposing Image into Multi-Layer Canvas...
                  </h4>
                  <p className="text-xs text-lime-400 font-medium font-mono animate-pulse">
                    {uploadProgress || 'Extracting transparent element segments & inpainting background...'}
                  </p>
                </div>

                {/* Warning & Estimated Time Card in English */}
                <div className="w-full max-w-md p-4 rounded-2xl bg-[#0d0e10] border border-zinc-800 shadow-2xl space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#a3e635] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#a3e635] animate-spin" />
                      Estimated Time: ~1.5 Minutes
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500/10 text-[#a3e635] font-mono font-bold">
                      Boutiqaat Layers Pro
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                    Neural element separation, alpha channel rendering, and clean background reconstruction are currently executing. Please do not close or refresh this page.
                  </p>

                  {/* Progress Line */}
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden mt-3">
                    <div className="h-full bg-gradient-to-r from-lime-500 via-[#a3e635] to-emerald-400 rounded-full animate-pulse w-4/5" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
