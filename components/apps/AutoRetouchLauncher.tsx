'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Sparkles, Download, RefreshCw, Trash2, CheckCircle2,
  Loader2, Layers, Zap, FolderPlus, Folder, ChevronDown, Check,
  Archive, Edit2, Maximize2, Clock, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useTasks } from '@/hooks/useTasks';
import {
  RetouchProject, RetouchItem, RetouchModelId, RETOUCH_MODELS, RetouchVersion
} from '@/lib/retouch/types';
import BeforeAfterSlider from '@/components/retouch/BeforeAfterSlider';
import RegenerateModal from '@/components/retouch/RegenerateModal';
import ProjectCreateModal from '@/components/retouch/ProjectCreateModal';
import FullPreviewModal from '@/components/retouch/FullPreviewModal';

interface AutoRetouchLauncherProps {
  app?: any;
  onTaskStarted?: (taskId: string, appName: string, nodeInfoList: any[], apiKeyType?: 'enterprise' | 'consumer') => void;
}

interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
  width?: number;
  height?: number;
  status: 'idle' | 'uploading' | 'ready';
  originalUploadedUrl?: string;
  error?: string;
}

function formatProjectDate(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatRetouchedFileName(originalName: string, versionNumber: number): string {
  if (!originalName) return `Image-Retouched-v${versionNumber}.png`;
  // Strip extension
  const base = originalName.replace(/\.[^/.]+$/, '');
  // Strip any old trailing tags if present
  const cleanBase = base.replace(/-Retouched(-v\d+)?$/i, '').replace(/_Retouched(_v\d+)?$/i, '');
  return `${cleanBase}-Retouched-v${versionNumber}.png`;
}

export default function AutoRetouchLauncher({ app, onTaskStarted }: AutoRetouchLauncherProps = {}) {
  const { tasks, addTask } = useTasks();

  // Projects State
  const [projects, setProjects] = useState<RetouchProject[]>([]);
  const [activeProject, setActiveProject] = useState<RetouchProject | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  // Rename Project State
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Staged Files for Upload
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Model selection
  const [selectedModel, setSelectedModel] = useState<RetouchModelId>('flux-2-edit');

  // Regenerate Modal State
  const [regeneratingItem, setRegeneratingItem] = useState<RetouchItem | null>(null);

  // Fullscreen Preview Modal State
  const [fullPreviewItem, setFullPreviewItem] = useState<{
    item: RetouchItem;
    activeVersion: RetouchVersion;
  } | null>(null);

  // ZIP Download State
  const [isZipping, setIsZipping] = useState(false);

  // 1. Fetch User Projects & Sync running tasks
  const loadProjects = useCallback(async (selectProjectId?: string) => {
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/retouch/projects');
      if (res.ok) {
        const data = await res.json();
        const list: RetouchProject[] = data.projects || [];
        setProjects(list);

        if (list.length > 0) {
          const target = selectProjectId
            ? list.find(p => p.id === selectProjectId)
            : list[0];
          const selected = target || list[0];
          setActiveProject(selected);
          if (selected?.defaultModel) setSelectedModel(selected.defaultModel);
        } else {
          // Auto-create default first project if none exists
          const createRes = await fetch('/api/retouch/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Catalog Photoshoot',
              description: 'Default studio retouch workspace',
              defaultModel: 'flux-2-edit',
            }),
          });
          if (createRes.ok) {
            const createdData = await createRes.json();
            setProjects([createdData.project]);
            setActiveProject(createdData.project);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load retouch projects:', err);
      toast.error('Failed to load retouch projects');
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 2. Active Polling & Syncing for Running Retouch Tasks
  useEffect(() => {
    if (!activeProject || activeProject.items.length === 0) return;

    // Check if any version is currently RUNNING
    const runningVersions: { itemId: string; version: RetouchVersion }[] = [];
    activeProject.items.forEach(it => {
      it.versions.forEach(v => {
        if (v.status === 'RUNNING' && v.taskId) {
          runningVersions.push({ itemId: it.id, version: v });
        }
      });
    });

    if (runningVersions.length === 0) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      let hasChange = false;
      const currentItems = [...activeProject.items];

      for (const { itemId, version } of runningVersions) {
        try {
          const qRes = await fetch('/api/runninghub/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: version.taskId, apiKeyType: 'enterprise' }),
          });

          if (!qRes.ok) continue;
          const qData = await qRes.json();

          if (qData.status === 'SUCCESS' && qData.results && qData.results.length > 0) {
            const outputUrl = qData.results[0].url || qData.results[0].fileUrl;
            if (outputUrl) {
              const itemIdx = currentItems.findIndex(i => i.id === itemId);
              if (itemIdx !== -1) {
                const verIdx = currentItems[itemIdx].versions.findIndex(v => v.taskId === version.taskId);
                if (verIdx !== -1) {
                  currentItems[itemIdx].versions[verIdx].outputUrl = outputUrl;
                  currentItems[itemIdx].versions[verIdx].status = 'SUCCESS';
                  currentItems[itemIdx].status = 'success';
                  hasChange = true;
                }
              }
            }
          } else if (qData.status === 'FAILED') {
            const itemIdx = currentItems.findIndex(i => i.id === itemId);
            if (itemIdx !== -1) {
              const verIdx = currentItems[itemIdx].versions.findIndex(v => v.taskId === version.taskId);
              if (verIdx !== -1) {
                currentItems[itemIdx].versions[verIdx].status = 'FAILED';
                currentItems[itemIdx].versions[verIdx].error = qData.errorMessage || 'Retouching failed';
                currentItems[itemIdx].status = 'failed';
                hasChange = true;
              }
            }
          }
        } catch (err) {
          console.warn('[AutoRetouch query polling error]', err);
        }
      }

      if (hasChange && isMounted) {
        const updatedProj = { ...activeProject, items: currentItems };
        setActiveProject(updatedProj);
        // Persist to backend database
        fetch(`/api/retouch/projects/${activeProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: currentItems }),
        }).catch(() => {});
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeProject]);

  // 3. File Selection & Image Dimension Reading
  const handleFilesAdded = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      toast.error('Please select valid image files (PNG, JPG, WEBP)');
      return;
    }

    if (stagedFiles.length + validFiles.length > 10) {
      toast.error('Maximum 10 images can be staged at a time');
      return;
    }

    validFiles.forEach(file => {
      const previewUrl = URL.createObjectURL(file);
      const stagedId = `staged_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const img = new Image();
      img.onload = () => {
        setStagedFiles(prev => [
          ...prev,
          {
            id: stagedId,
            file,
            previewUrl,
            width: img.naturalWidth || 1024,
            height: img.naturalHeight || 1024,
            status: 'idle',
          },
        ]);
      };
      img.onerror = () => {
        setStagedFiles(prev => [
          ...prev,
          {
            id: stagedId,
            file,
            previewUrl,
            width: 1024,
            height: 1024,
            status: 'idle',
          },
        ]);
      };
      img.src = previewUrl;
    });
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAllStaged = () => {
    stagedFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setStagedFiles([]);
  };

  // 4. Batch Upload and Trigger Generation
  const handleRunBatch = async () => {
    if (!activeProject) {
      toast.error('Please select or create a project first');
      return;
    }

    const idleFiles = stagedFiles.filter(f => f.status === 'idle');
    if (idleFiles.length === 0) {
      toast.error('No new images to retouch');
      return;
    }

    setIsBatchRunning(true);
    const toastId = toast.loading(`Starting retouching (${idleFiles.length} images)...`);

    try {
      for (const staged of idleFiles) {
        // Step A: Upload image to storage
        setStagedFiles(prev =>
          prev.map(f => f.id === staged.id ? { ...f, status: 'uploading' } : f)
        );

        const formData = new FormData();
        formData.append('file', staged.file);

        const uploadRes = await fetch('/api/runninghub/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) throw new Error('Image upload failed');
        const uploadData = await uploadRes.json();
        const uploadedUrl = uploadData.fileUrl || uploadData.url || uploadData.downloadUrl;

        if (!uploadedUrl) throw new Error('No uploaded file URL returned');

        // Step B: Trigger Retouch Generate endpoint
        const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const cleanItemName = staged.file.name.replace(/\.[^/.]+$/, "");
        const genRes = await fetch('/api/retouch/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: activeProject.id,
            itemId,
            itemName: cleanItemName,
            originalUrl: uploadedUrl,
            width: staged.width,
            height: staged.height,
            model: selectedModel,
          }),
        });

        if (!genRes.ok) {
          const genErr = await genRes.json();
          throw new Error(genErr.error || 'Retouch task generation failed');
        }

        const genData = await genRes.json();

        // Register in global useTasks so background polling tracks it anywhere in the app
        if (genData.taskId) {
          addTask(
            genData.taskId,
            'auto-retouch',
            `Auto Retouch: ${staged.file.name}`,
            [
              { nodeId: 'INPUT', fieldName: 'image', fieldValue: uploadedUrl },
              { nodeId: 'CONFIG', fieldName: 'model', fieldValue: selectedModel },
              { nodeId: 'CONFIG', fieldName: 'project_id', fieldValue: activeProject.id },
              { nodeId: 'CONFIG', fieldName: 'item_id', fieldValue: itemId },
            ],
            'enterprise'
          );

          if (onTaskStarted) {
            onTaskStarted(
              genData.taskId,
              `Auto Retouch (${selectedModel === 'flux-2-edit' ? 'Boutiqaat Klein' : 'Boutiqaat Pro'})`,
              [{ nodeId: 'image', fieldName: 'image', fieldValue: uploadedUrl }],
              'enterprise'
            );
          }
        }

        if (genData.project) {
          setActiveProject(genData.project);
        }
      }

      toast.success('Retouch batch submitted!', { id: toastId });
      clearAllStaged();
    } catch (err: any) {
      console.error('[Run Batch Error]:', err);
      toast.error(`Batch failed: ${err.message}`, { id: toastId });
    } finally {
      setIsBatchRunning(false);
    }
  };

  // 5. Handle Regeneration
  const handleRegenerate = async (itemId: string, model: RetouchModelId) => {
    if (!activeProject) return;
    const item = activeProject.items.find(it => it.id === itemId);
    if (!item) return;

    const toastId = toast.loading(`Starting regeneration with ${model === 'flux-2-edit' ? 'Boutiqaat Klein' : 'Boutiqaat Pro'}...`);

    try {
      const res = await fetch('/api/retouch/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          itemId,
          originalUrl: item.originalUrl, // Reusing existing original image URL (Zero storage bloat)
          width: item.originalWidth,
          height: item.originalHeight,
          model,
          isRegeneration: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to trigger regeneration');
      }

      const data = await res.json();

      if (data.taskId) {
        addTask(
          data.taskId,
          'auto-retouch',
          `Auto Retouch: ${item.name} (v${item.versions.length + 1})`,
          [
            { nodeId: 'INPUT', fieldName: 'image', fieldValue: item.originalUrl },
            { nodeId: 'CONFIG', fieldName: 'model', fieldValue: model },
            { nodeId: 'CONFIG', fieldName: 'project_id', fieldValue: activeProject.id },
            { nodeId: 'CONFIG', fieldName: 'item_id', fieldValue: itemId },
          ],
          'enterprise'
        );
      }

      if (data.project) {
        setActiveProject(data.project);
      }
      toast.success('Regeneration task running!', { id: toastId });
    } catch (err: any) {
      toast.error(`Regeneration failed: ${err.message}`, { id: toastId });
      throw err;
    }
  };

  // 6. Version Switching per Item
  const handleSelectVersion = (itemId: string, versionIndex: number) => {
    if (!activeProject) return;
    const updatedItems = activeProject.items.map(it => {
      if (it.id === itemId) {
        return { ...it, activeVersionIndex: versionIndex };
      }
      return it;
    });
    setActiveProject({ ...activeProject, items: updatedItems });
  };

  // 7. Delete Item from Project
  const handleDeleteItem = async (itemId: string) => {
    if (!activeProject) return;
    const updatedItems = activeProject.items.filter(it => it.id !== itemId);
    const updatedProj = { ...activeProject, items: updatedItems };
    setActiveProject(updatedProj);

    await fetch(`/api/retouch/projects/${activeProject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updatedItems }),
    }).catch(() => {});

    toast.success('Item deleted');
  };

  // 8. Rename Project
  const handleRenameProject = async () => {
    if (!activeProject || !renameValue.trim()) return;
    const newName = renameValue.trim();

    try {
      const res = await fetch(`/api/retouch/projects/${activeProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        const updated = { ...activeProject, name: newName };
        setActiveProject(updated);
        setProjects(prev => prev.map(p => p.id === activeProject.id ? updated : p));
        setIsRenaming(false);
        toast.success('Project renamed');
      } else {
        toast.error('Failed to rename project');
      }
    } catch {
      toast.error('Rename error');
    }
  };

  // 9. Delete Project (Safely removes project folder while preserving tasks in DB)
  const handleDeleteProject = async (projectIdToDelete: string) => {
    if (!confirm('Are you sure you want to remove this project folder? All generated task history will remain archived for admin logs.')) {
      return;
    }

    try {
      const res = await fetch(`/api/retouch/projects/${projectIdToDelete}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const remaining = projects.filter(p => p.id !== projectIdToDelete);
        setProjects(remaining);
        if (activeProject?.id === projectIdToDelete) {
          if (remaining.length > 0) {
            setActiveProject(remaining[0]);
          } else {
            // Re-create default
            loadProjects();
          }
        }
        toast.success('Project deleted');
      } else {
        toast.error('Failed to delete project');
      }
    } catch {
      toast.error('Delete error');
    }
  };

  // 10. Single Download
  const downloadImage = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
      toast.success('Downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Download failed');
    }
  };

  // 11. Batch ZIP Download
  const downloadAllAsZip = async () => {
    if (!activeProject || activeProject.items.length === 0) return;
    const successfulItems = activeProject.items.filter(it => {
      const activeVer = it.versions[it.activeVersionIndex] || it.versions[it.versions.length - 1];
      return activeVer && activeVer.status === 'SUCCESS' && activeVer.outputUrl;
    });

    if (successfulItems.length === 0) {
      toast.error('No completed retouched images to download');
      return;
    }

    setIsZipping(true);
    const toastId = toast.loading(`Packing ${successfulItems.length} images into ZIP...`);

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let i = 0; i < successfulItems.length; i++) {
        const it = successfulItems[i];
        const activeVer = it.versions[it.activeVersionIndex] || it.versions[it.versions.length - 1];
        if (!activeVer.outputUrl) continue;

        try {
          const imgRes = await fetch(activeVer.outputUrl);
          const blob = await imgRes.blob();
          const safeName = formatRetouchedFileName(it.name, activeVer.versionNumber);
          zip.file(safeName, blob);
        } catch {}
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const objUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = objUrl;
      const cleanProjName = activeProject.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, '_');
      a.download = `${cleanProjName}-Retouched-Batch.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);

      toast.success('ZIP package downloaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(`Failed to create ZIP: ${err.message}`, { id: toastId });
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-sans text-gray-200">
      {/* ── 1. HEADER & PROJECT SELECTOR (Boutiqaat Flow Page Style) ── */}
      <div className="bg-[#0d0e12] border border-[#262a3b] rounded-2xl p-6 shadow-xl space-y-4">
        {/* Top Row: Title & Badges on Left, Project Controls on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#a3e635] text-[#0d0e12] flex items-center justify-center font-black shadow-[0_0_20px_rgba(163,230,53,0.35)] shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#a3e635] font-mono">
                  Boutiqaat Creative AI Studio
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] text-gray-300 font-mono">
                  Your Friendly AI Tools
                </span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
                Boutiqaat AI Retouch
              </h1>
            </div>
          </div>

          {/* Project Selector & Creation Actions (Pinned to Right) */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
            {/* Project Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="flex items-center gap-2.5 bg-[#14161f] hover:bg-[#1b1e2b] border border-[#262a3b] px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-sm"
              >
                <Folder className="w-4 h-4 text-[#a3e635]" />
                <div className="text-left max-w-[180px] truncate">
                  <span className="truncate block font-bold">{activeProject?.name || 'Select Project'}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
              </button>

            {isProjectDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-[#14161f] border border-[#262a3b] rounded-2xl shadow-2xl overflow-hidden z-40 animate-fade-in">
                <div className="p-3 border-b border-[#262a3b] flex items-center justify-between text-[10px] text-gray-400 uppercase font-mono px-4">
                  <span>Projects ({projects.length})</span>
                </div>
                <div className="max-h-72 overflow-y-auto p-1.5 divide-y divide-[#262a3b]/50">
                  {projects.map(p => (
                    <div
                      key={p.id}
                      className={cn(
                        "w-full px-3.5 py-2.5 text-xs rounded-xl transition-colors flex items-center justify-between group",
                        activeProject?.id === p.id
                          ? "bg-[#a3e635]/10 text-[#a3e635] font-bold"
                          : "text-gray-300 hover:bg-white/5"
                      )}
                    >
                      <button
                        onClick={() => {
                          setActiveProject(p);
                          if (p.defaultModel) setSelectedModel(p.defaultModel);
                          setIsProjectDropdownOpen(false);
                        }}
                        className="truncate text-left flex-1 pr-2"
                      >
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="text-[10px] text-gray-500 font-normal flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatProjectDate(p.createdAt)} • {p.items?.length || 0} items
                        </p>
                      </button>

                      {/* Dropdown Project Action Buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveProject(p);
                            setRenameValue(p.name);
                            setIsRenaming(true);
                            setIsProjectDropdownOpen(false);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                          title="Rename Project"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {projects.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(p.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                            title="Delete Project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {activeProject?.id === p.id && <Check className="w-4 h-4 flex-shrink-0 ml-2" />}
                    </div>
                  ))}
                </div>
                <div className="p-2.5 border-t border-[#262a3b] bg-[#0d0e12]">
                  <button
                    onClick={() => {
                      setIsProjectDropdownOpen(false);
                      setIsCreateProjectOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#a3e635] text-[#0d0e12] text-xs font-bold hover:bg-[#b8f547] transition-colors shadow-sm"
                  >
                    <FolderPlus className="w-4 h-4" /> New Project
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCreateProjectOpen(true)}
            className="flex items-center gap-1.5 bg-[#a3e635] text-[#0d0e12] hover:bg-[#b8f547] px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shrink-0"
          >
            <FolderPlus className="w-4 h-4" /> Create Project
          </button>
        </div>
      </div>

        {/* Bottom Row: Subtitle Description */}
        <div className="pt-3 border-t border-[#262a3b]/60">
          <p className="text-xs text-gray-400 leading-relaxed max-w-4xl">
            The internal Auto Retouch tool to polish fabrics, standardize studio backdrops, and preserve model fidelity at scale, saving production hours without compromising Boutiqaat visual standards.
          </p>
        </div>
      </div>

      {/* ── 2. FULL-WIDTH DRAG & DROP UPLOAD ZONE & CONTROLS TOOLBAR ── */}
      <div className="bg-[#0d0e12] border border-[#262a3b] rounded-2xl p-6 shadow-xl space-y-5">
        {/* Drag & Drop Upload Zone (Full Width, Spacious) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-2 font-mono">
              <Upload className="w-3.5 h-3.5 text-[#a3e635]" /> Batch Upload (Max 10 Images)
            </span>
            {stagedFiles.length > 0 && (
              <button
                onClick={clearAllStaged}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear All ({stagedFiles.length})
              </button>
            )}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full border-2 border-dashed rounded-2xl p-10 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[170px]",
              isDragging
                ? "border-[#a3e635] bg-[#a3e635]/10 scale-[1.005]"
                : "border-[#262a3b] hover:border-[#a3e635]/70 bg-[#14161f] hover:bg-[#161822]"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesAdded(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 shadow-inner">
              <Upload className="w-7 h-7 text-[#a3e635]" />
            </div>
            <p className="text-sm font-bold text-white tracking-wide">
              Drag and drop raw product images here
            </p>
            <p className="text-xs text-gray-400 mt-1">
              or click to browse files from your computer (PNG, JPG, WEBP)
            </p>
          </div>

          {/* Staged Thumbnails Preview Grid */}
          {stagedFiles.length > 0 && (
            <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5">
              {stagedFiles.map((staged) => (
                <div
                  key={staged.id}
                  className="relative aspect-square rounded-xl overflow-hidden border border-[#262a3b] group bg-black/40 shadow-sm"
                >
                  <img
                    src={staged.previewUrl}
                    alt={staged.file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStagedFile(staged.id);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 bg-black/75 p-0.5 text-[8px] text-gray-300 truncate font-mono text-center">
                    {staged.width}×{staged.height}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Horizontal Controls Bar (Engine Selector on Left + Run CTA on Right) */}
        <div className="pt-4 border-t border-[#262a3b] flex flex-wrap items-center justify-between gap-4">
          {/* Left Side: Model Selector Segmented Controls */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase font-bold tracking-wider text-gray-400 font-mono">
              AI ENGINE:
            </span>

            <div className="inline-flex items-center p-1 bg-[#14161f] border border-[#262a3b] rounded-xl gap-1">
              {RETOUCH_MODELS.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <button
                    type="button"
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={cn(
                      "px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                      isSelected
                        ? "bg-[#0d0e12] text-white border border-[#a3e635]/60 shadow-[0_0_15px_rgba(163,230,53,0.15)]"
                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {model.id === 'flux-2-edit' ? (
                      <Layers className={cn("w-3.5 h-3.5", isSelected ? "text-[#a3e635]" : "text-gray-400")} />
                    ) : (
                      <Zap className={cn("w-3.5 h-3.5", isSelected ? "text-yellow-400" : "text-gray-400")} />
                    )}
                    <span>{model.name}</span>
                    <span className="bg-[#a3e635] text-[#0d0e12] font-black italic px-1.5 py-0.5 rounded text-[8px] tracking-wider uppercase">
                      {model.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Side: Batch Status & Action CTA */}
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-400">
              {stagedFiles.length > 0 ? (
                <span>Ready to process <strong className="text-[#a3e635] font-mono">{stagedFiles.length} images</strong></span>
              ) : (
                <span>No images staged</span>
              )}
            </div>

            <button
              onClick={handleRunBatch}
              disabled={stagedFiles.length === 0 || isBatchRunning}
              className="px-6 py-2.5 rounded-xl bg-[#a3e635] text-[#0d0e12] font-bold text-xs hover:bg-[#b8f547] transition-all shadow-[0_0_20px_rgba(163,230,53,0.25)] flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isBatchRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Retouching Batch...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Run Retouching ({stagedFiles.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. RESULTS GALLERY & INSPECTION ── */}
      {activeProject && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262a3b] pb-3">
            <div className="flex items-center gap-3">
              {isRenaming ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="bg-[#14161f] border border-[#a3e635] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleRenameProject}
                    className="px-2.5 py-1 rounded-lg bg-[#a3e635] text-[#0d0e12] text-xs font-bold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsRenaming(false)}
                    className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">
                    {activeProject.name}
                  </h2>
                  <button
                    onClick={() => {
                      setRenameValue(activeProject.name);
                      setIsRenaming(true);
                    }}
                    className="p-1 rounded text-gray-400 hover:text-white"
                    title="Rename Project"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#a3e635]/10 text-[#a3e635] border border-[#a3e635]/25 font-bold">
                {activeProject.items.length} Assets
              </span>

              {activeProject.createdAt && (
                <span className="text-[11px] text-gray-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatProjectDate(activeProject.createdAt)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {projects.length > 1 && (
                <button
                  onClick={() => handleDeleteProject(activeProject.id)}
                  className="flex items-center gap-1.5 bg-[#14161f] hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-[#262a3b] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  title="Delete Project Folder"
                >
                  <Trash2 className="w-3 h-3" /> Delete Project
                </button>
              )}

              {activeProject.items.length > 0 && (
                <button
                  onClick={downloadAllAsZip}
                  disabled={isZipping || !activeProject.items.some(it => it.versions.some(v => v.status === 'SUCCESS'))}
                  className="flex items-center gap-1.5 bg-[#14161f] hover:bg-[#1b1e2b] text-white border border-[#262a3b] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                >
                  {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5 text-[#a3e635]" />}
                  Download All as ZIP
                </button>
              )}
            </div>
          </div>

          {/* Empty State */}
          {activeProject.items.length === 0 ? (
            <div className="text-center py-16 bg-[#0d0e12] rounded-2xl border border-dashed border-[#262a3b]">
              <Sparkles className="w-9 h-9 text-[#a3e635]/40 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white mb-1">No items retouched yet in this project</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Stage your product photos in the batch upload area above and click Run Retouching.
              </p>
            </div>
          ) : (
            /* Items Responsive Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {activeProject.items.map((item) => {
                const activeVersion = item.versions[item.activeVersionIndex] || item.versions[item.versions.length - 1];
                const isProcessing = item.status === 'processing' || activeVersion?.status === 'RUNNING';
                const isSuccess = activeVersion?.status === 'SUCCESS' && Boolean(activeVersion.outputUrl);

                // Clean model display name
                const displayModelName = activeVersion?.modelId === 'nano-banana-2'
                  ? 'Boutiqaat Pro'
                  : 'Boutiqaat Klein';

                return (
                  <div
                    key={item.id}
                    className="bg-[#0d0e12] rounded-2xl border border-[#262a3b] overflow-hidden hover:border-[#a3e635]/50 transition-all flex flex-col justify-between shadow-lg group"
                  >
                    {/* Visual Card (Before/After Slider with Fullscreen trigger) */}
                    <div className="p-3 bg-[#14161f] border-b border-[#262a3b]">
                      <BeforeAfterSlider
                        beforeUrl={item.originalUrl}
                        afterUrl={activeVersion?.outputUrl || null}
                        versionLabel={`v${activeVersion?.versionNumber || 1}`}
                        aspectRatio="1/1"
                        isProcessing={isProcessing}
                        onOpenFullView={isSuccess && activeVersion?.outputUrl ? () => {
                          setFullPreviewItem({ item, activeVersion });
                        } : undefined}
                      />
                    </div>

                    {/* Card Body & Version Switcher */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-white truncate" title={item.name}>
                          {item.name}
                        </h4>

                        {/* Status Badge */}
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider border",
                            isSuccess
                              ? "bg-[#a3e635]/10 text-[#a3e635] border-[#a3e635]/25"
                              : isProcessing
                              ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/25 animate-pulse"
                              : "bg-red-500/10 text-red-400 border-red-500/25"
                          )}
                        >
                          {isSuccess ? 'Completed' : isProcessing ? 'Processing' : 'Failed'}
                        </span>
                      </div>

                      {/* Version Switcher Tabs */}
                      {item.versions.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[10px] text-gray-400">
                            <span>Versi Retouch ({item.versions.length})</span>
                            <span className="font-mono text-[#a3e635] font-bold">
                              {displayModelName}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.versions.map((ver, idx) => {
                              const isActive = idx === item.activeVersionIndex;
                              return (
                                <button
                                  key={ver.versionNumber}
                                  onClick={() => handleSelectVersion(item.id, idx)}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center gap-1",
                                    isActive
                                      ? "bg-[#a3e635] text-[#0d0e12] shadow-sm"
                                      : "bg-[#14161f] text-gray-300 hover:bg-white/10 hover:text-white border border-[#262a3b]"
                                  )}
                                >
                                  v{ver.versionNumber}
                                  {ver.status === 'RUNNING' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-[#262a3b] flex items-center justify-between gap-2">
                        {/* Regenerate Button */}
                        <button
                          onClick={() => setRegeneratingItem(item)}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#14161f] hover:bg-[#a3e635] hover:text-[#0d0e12] text-white text-xs font-bold border border-[#262a3b] transition-all disabled:opacity-40"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Regenerate (v{item.versions.length + 1})
                        </button>

                        {/* Full View Button */}
                        {isSuccess && activeVersion?.outputUrl && (
                          <button
                            onClick={() => setFullPreviewItem({ item, activeVersion })}
                            className="p-2 rounded-xl bg-[#14161f] hover:bg-white/10 text-white border border-[#262a3b] transition-colors"
                            title="Full View / Zoom"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Download Single Button */}
                        {isSuccess && activeVersion?.outputUrl && (
                          <button
                            onClick={() => {
                              const safeName = formatRetouchedFileName(item.name, activeVersion.versionNumber);
                              downloadImage(activeVersion.outputUrl, safeName);
                            }}
                            className="p-2 rounded-xl bg-[#14161f] hover:bg-white/10 text-white border border-[#262a3b] transition-colors"
                            title="Download Retouched Image"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Item */}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 rounded-xl bg-[#14161f] hover:bg-red-500/20 text-gray-500 hover:text-red-400 border border-[#262a3b] transition-colors"
                          title="Delete from project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 4. MODALS ── */}
      <ProjectCreateModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreate={async (name, description, defaultModel) => {
          const res = await fetch('/api/retouch/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, defaultModel }),
          });
          if (res.ok) {
            const data = await res.json();
            setProjects(prev => [data.project, ...prev]);
            setActiveProject(data.project);
            if (data.project.defaultModel) setSelectedModel(data.project.defaultModel);
            toast.success(`Project "${name}" created!`);
          } else {
            toast.error('Failed to create project');
          }
        }}
      />

      <RegenerateModal
        item={regeneratingItem}
        isOpen={Boolean(regeneratingItem)}
        onClose={() => setRegeneratingItem(null)}
        onRegenerate={handleRegenerate}
      />

      {/* Fullscreen Preview Modal */}
      {fullPreviewItem && (
        <FullPreviewModal
          isOpen={Boolean(fullPreviewItem)}
          onClose={() => setFullPreviewItem(null)}
          itemName={fullPreviewItem.item.name}
          originalUrl={fullPreviewItem.item.originalUrl}
          outputUrl={fullPreviewItem.activeVersion.outputUrl}
          versionNumber={fullPreviewItem.activeVersion.versionNumber}
          modelName={
            fullPreviewItem.activeVersion.modelId === 'nano-banana-2'
              ? 'Boutiqaat Pro'
              : 'Boutiqaat Klein'
          }
        />
      )}
    </div>
  );
}
