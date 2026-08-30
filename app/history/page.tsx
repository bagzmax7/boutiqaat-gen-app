'use client';

import { useEffect, useState, useMemo } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  History, Download, CheckCircle2, XCircle, Clock, Loader2,
  Search, Filter, Eye, X, Layers, Sparkles, Film, Image as ImageIcon,
  ExternalLink, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn, isVideoUrl } from '@/lib/utils';
import { TaskOutput } from '@/lib/types';

interface HistoryTask {
  id: string;
  runninghub_task_id: string;
  app_id?: string;
  app_name: string;
  status: string;
  outputs: TaskOutput[] | any[];
  api_key_type: string;
  created_at: string;
  error_message?: string;
  node_info_list?: any[];
  users?: { name: string; email: string };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    SUCCESS: { icon: <CheckCircle2 className="w-3 h-3" />, cls: 'text-accent-green bg-accent-green/10 border-accent-green/25' },
    FAILED: { icon: <XCircle className="w-3 h-3" />, cls: 'text-accent-red bg-accent-red/10 border-accent-red/25' },
    RUNNING: { icon: <Loader2 className="w-3 h-3 animate-spin" />, cls: 'text-accent-blue bg-accent-blue/10 border-accent-blue/25' },
    QUEUED: { icon: <Clock className="w-3 h-3" />, cls: 'text-accent-gold bg-accent-gold/10 border-accent-gold/25' },
    CANCELED: { icon: <XCircle className="w-3 h-3" />, cls: 'text-gray-400 bg-gray-400/10 border-gray-400/25' },
  };
  const config = map[status?.toUpperCase()] || map.QUEUED;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', config.cls)}>
      {config.icon} {status || 'QUEUED'}
    </span>
  );
}

function getOutputUrl(out: any): string | null {
  if (!out) return null;
  if (typeof out === 'string') return out;
  return out.fileUrl || out.url || null;
}

function exportHistoryCSV(items: { date: string; app: string; status: string; type: string; url: string }[]) {
  const header = 'Date,Feature / App,Status,Key Type,Output URL\n';
  const rows = items.map(t => [
    new Date(t.date).toLocaleString(),
    t.app,
    t.status,
    t.type,
    t.url,
  ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('History exported successfully!');
}

export default function HistoryPage() {
  const [tasks, setTasks] = useState<HistoryTask[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [convertingPsdIds, setConvertingPsdIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  
  // Tab switcher: 'all' | 'layers' | 'bundling' | 'social-resize' | 'flow' | 'console'
  const [activeTab, setActiveTab] = useState<'all' | 'layers' | 'bundling' | 'social-resize' | 'flow' | 'console'>('all');
  const [layerProjects, setLayerProjects] = useState<any[]>([]);
  const [previewMedia, setPreviewMedia] = useState<{
    name: string;
    url: string;
    prompt?: string;
    products?: string[];
    details?: Record<string, any>;
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, sessionsRes, layersRes] = await Promise.all([
        fetch('/api/tasks?limit=150'),
        fetch('/api/bundling/sessions?limit=100'),
        fetch('/api/layers/projects')
      ]);
      
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        const raw = tasksData.tasks || [];
        
        // Deduplicate tasks by runninghub_task_id / id
        const map = new Map<string, HistoryTask>();
        for (const t of raw) {
          const key = (t.runninghub_task_id && String(t.runninghub_task_id).trim()) || t.id;
          if (!key) continue;
          const existing = map.get(key);
          if (!existing) {
            map.set(key, t);
          } else {
            const shouldReplace = 
              (!existing.outputs?.length && t.outputs?.length) ||
              (t.status === 'SUCCESS' && existing.status !== 'SUCCESS') ||
              (new Date(t.created_at).getTime() > new Date(existing.created_at).getTime());
            if (shouldReplace) map.set(key, t);
          }
        }

        // Deduplicate tasks sharing identical output media URLs
        const urlMap = new Map<string, HistoryTask>();
        const deduped: HistoryTask[] = [];
        for (const t of Array.from(map.values())) {
          const firstOut = t.outputs && t.outputs.length > 0 ? getOutputUrl(t.outputs[0]) : null;
          if (firstOut && t.status === 'SUCCESS') {
            if (!urlMap.has(firstOut)) {
              urlMap.set(firstOut, t);
              deduped.push(t);
            }
          } else {
            deduped.push(t);
          }
        }

        setTasks(deduped);
      }
      
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);
      }

      if (layersRes.ok) {
        const layersData = await layersRes.json();
        setLayerProjects(layersData.projects || []);
      }
    } catch (err) {
      console.error('Failed to load history data:', err);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const downloadMedia = async (url: string, filename: string) => {
    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error('Download failed');
      const blob = await imgRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success('Downloaded successfully!');
    } catch (err) {
      console.error('Failed to download media:', err);
      toast.error('Failed to download media');
    }
  };

  // Groupings
  const bundlingSessions = sessions;
  const socialResizeTasks = tasks.filter(t => t.app_id === 'social-resize' || t.app_name === 'Social Resize');
  const flowTasks = tasks.filter(t => (t.app_id || '').includes('quick-create') || (t.app_id || '').includes('boutiqaat-flow') || t.app_name === 'Boutiqaat Flow');
  const consoleTasks = tasks.filter(t => {
    const isBundling = t.app_id === 'bundling' || (t.app_name || '').toLowerCase().includes('bundling');
    const isSocialResize = t.app_id === 'social-resize' || t.app_name === 'Social Resize';
    const isFlow = (t.app_id || '').includes('quick-create') || (t.app_id || '').includes('boutiqaat-flow') || t.app_name === 'Boutiqaat Flow';
    const isLayers = t.app_id === 'layers' || (t.app_name || '').toLowerCase().includes('layer');
    return !isBundling && !isSocialResize && !isFlow && !isLayers;
  });

  // Filtered lists
  const filteredSessions = bundlingSessions.filter(s => {
    if (!search) return true;
    const kw = search.toLowerCase();
    return (s.session_name || '').toLowerCase().includes(kw) || 
           (s.product_names || []).some((name: string) => name.toLowerCase().includes(kw)) ||
           (s.final_prompt || '').toLowerCase().includes(kw);
  });

  const getFilteredTasksFor = (taskList: HistoryTask[]) => {
    return taskList.filter(t => {
      const matchSearch = !search || 
        (t.app_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.node_info_list || []).some((n: any) => String(n.fieldValue || '').toLowerCase().includes(search.toLowerCase()));
      const matchStatus = filter === 'ALL' || (t.status || '').toUpperCase() === filter;
      return matchSearch && matchStatus;
    });
  };

  const filteredSocialResize = getFilteredTasksFor(socialResizeTasks);
  const filteredFlow = getFilteredTasksFor(flowTasks);
  const filteredConsole = getFilteredTasksFor(consoleTasks);
  const filteredAllTasks = getFilteredTasksFor(tasks);
  // Studio & Flow tasks combined for "all" tab view without bundling duplicates
  const studioAndFlowTasks = [...filteredConsole, ...filteredSocialResize, ...filteredFlow];

  const totalCount = bundlingSessions.length + tasks.length;

  const currentTabCount = useMemo(() => {
    switch (activeTab) {
      case 'all': return studioAndFlowTasks.length + filteredSessions.length + layerProjects.length;
      case 'layers': return layerProjects.length;
      case 'bundling': return filteredSessions.length;
      case 'social-resize': return filteredSocialResize.length;
      case 'flow': return filteredFlow.length;
      case 'console': return filteredConsole.length;
    }
  }, [activeTab, studioAndFlowTasks, filteredSessions, layerProjects, filteredSocialResize, filteredFlow, filteredConsole]);

  const handleExport = () => {
    const exportList: { date: string; app: string; status: string; type: string; url: string }[] = [];

    if (activeTab === 'bundling' || activeTab === 'all') {
      filteredSessions.forEach(s => {
        exportList.push({
          date: s.created_at,
          app: `Bundling Studio - ${s.session_name}`,
          status: s.generated_image_url ? 'SUCCESS' : 'FAILED',
          type: 'Consumer',
          url: s.generated_image_url || '—',
        });
      });
    }

    const tasksToExport = activeTab === 'all' ? filteredAllTasks :
                          activeTab === 'social-resize' ? filteredSocialResize :
                          activeTab === 'flow' ? filteredFlow :
                          activeTab === 'console' ? filteredConsole : [];

    tasksToExport.forEach(t => {
      const firstOut = t.outputs && t.outputs.length > 0 ? getOutputUrl(t.outputs[0]) : '';
      exportList.push({
        date: t.created_at,
        app: t.app_name,
        status: t.status,
        type: t.api_key_type || 'consumer',
        url: firstOut || '—',
      });
    });

    exportHistoryCSV(exportList);
  };

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-6 border-b border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-gold to-accent-gold/50 flex items-center justify-center shadow-md">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-text-primary">My Generation History</h1>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Showing <strong className="text-accent-gold">{currentTabCount}</strong> items for your account
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-white border border-border hover:bg-bg-hover px-3.5 py-2 rounded-xl transition-all"
                  title="Refresh history"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                  Refresh
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 text-xs font-semibold text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/10 px-4 py-2 rounded-xl transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
            {/* Category Tabs */}
            <div className="flex border-b border-border/50 gap-2 sm:gap-6 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'All Items', count: totalCount + layerProjects.length },
                { id: 'layers', label: 'Boutiqaat Layers', count: layerProjects.length },
                { id: 'bundling', label: 'Bundling Studio', count: bundlingSessions.length },
                { id: 'flow', label: 'Boutiqaat Flow', count: flowTasks.length },
                { id: 'social-resize', label: 'Social Resize', count: socialResizeTasks.length },
                { id: 'console', label: 'Image & Video Studio', count: consoleTasks.length },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setSearch(''); }}
                  className={cn(
                    'pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all outline-none whitespace-nowrap flex items-center gap-2',
                    activeTab === tab.id
                      ? 'border-accent-gold text-accent-gold font-bold' 
                      : 'border-transparent text-text-muted hover:text-text-primary'
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border',
                    activeTab === tab.id ? 'bg-accent-gold/15 border-accent-gold/30 text-accent-gold' : 'bg-white/5 border-white/10 text-text-muted'
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Filters Bar */}
            <div className="flex gap-3 flex-wrap items-center justify-between">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, prompt, or parameters..."
                  className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-text-primary placeholder-text-muted input-gold transition-all"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-bg-card border border-border p-1 rounded-xl">
                {['ALL', 'SUCCESS', 'FAILED', 'RUNNING', 'QUEUED'].map(s => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      filter === s ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/30' : 'text-text-muted hover:text-text-primary'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Display */}
            {loading ? (
              <div className="text-center py-20 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-accent-gold/50" />
                Loading your generation records...
              </div>
            ) : (
              <div className="space-y-8">
                {/* Boutiqaat Layers Projects Section */}
                {(activeTab === 'all' || activeTab === 'layers') && layerProjects.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#a3e635]" /> Boutiqaat Layers Projects ({layerProjects.length})
                      </h3>
                      <a href="/layers" className="text-xs text-[#a3e635] hover:underline font-bold">
                        Open Layers Studio →
                      </a>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {layerProjects.map((proj) => (
                        <div key={proj.id} className="glass-card rounded-2xl border border-border hover:border-lime-500/40 transition-all overflow-hidden flex flex-col group relative bg-bg-card">
                          <div className="relative aspect-square bg-[#0e0e0e] overflow-hidden border-b border-border">
                            {proj.thumbnail_url ? (
                              <img
                                src={proj.thumbnail_url}
                                className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-300"
                                alt={proj.name}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                                No Thumbnail
                              </div>
                            )}
                            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/80 border border-border text-[9px] font-mono text-[#a3e635] font-black">
                              v{proj.revision_count || 1}.0
                            </div>
                            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/80 border border-border text-[9px] font-mono text-white flex items-center gap-1">
                              <Layers className="w-3 h-3 text-[#a3e635]" />
                              {proj.layers?.length || 0} Layers
                            </div>
                          </div>

                          <div className="p-4 flex flex-col flex-1 min-w-0 bg-white/2">
                            <h4 className="text-sm font-bold text-text-primary truncate" title={proj.name}>
                              {proj.name}
                            </h4>
                            <p className="text-[10px] text-text-muted mt-0.5">
                              {new Date(proj.updated_at || proj.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div className="mt-3.5 border-t border-white/5 pt-2.5 flex items-center justify-between">
                              <span className="text-[10px] text-text-muted uppercase font-mono">
                                {proj.canvas_width || 1200} × {proj.canvas_height || 1200}px
                              </span>
                              <a
                                href="/layers"
                                className="text-xs font-bold text-[#a3e635] hover:text-[#bef264] flex items-center gap-1"
                              >
                                Edit Canvas →
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1. Bundling Studio Sessions Section */}
                {(activeTab === 'all' || activeTab === 'bundling') && filteredSessions.length > 0 && (
                  <div>
                    {activeTab === 'all' && (
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Layers className="w-4 h-4 text-accent-gold" /> Bundling Studio ({filteredSessions.length})
                        </h3>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {filteredSessions.map((session) => (
                        <div key={session.id} className="glass-card rounded-2xl border border-border hover:border-accent-gold/30 transition-all overflow-hidden flex flex-col group relative bg-bg-card">
                          <div className="relative aspect-square bg-[#0e0e0e] overflow-hidden border-b border-border">
                            {session.generated_image_url ? (
                              <img
                                src={session.generated_image_url}
                                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                                alt={session.session_name}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                                No Image Generated
                              </div>
                            )}
                            
                            {session.generated_image_url && (
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <button
                                  onClick={() => setPreviewMedia({
                                    name: session.session_name,
                                    url: session.generated_image_url,
                                    prompt: session.final_prompt,
                                    products: session.product_names || [],
                                  })}
                                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                  title="Preview 2K compositing details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => downloadMedia(session.generated_image_url, `Generated_Bundle_${session.id}.png`)}
                                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                  title="Download Image"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="p-4 flex flex-col flex-1 min-w-0 bg-white/2">
                            <h4 className="text-sm font-bold text-text-primary truncate" title={session.session_name}>
                              {session.session_name}
                            </h4>
                            <p className="text-[10px] text-text-muted mt-0.5">
                              {new Date(session.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            
                            {session.product_names && session.product_names.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-3">
                                {session.product_names.map((name: string, i: number) => (
                                  <span key={i} className="text-[8.5px] font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/70 truncate max-w-28">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="mt-3.5 border-t border-white/5 pt-2.5">
                              <p className="text-[9px] text-accent-gold/80 uppercase tracking-widest font-semibold">Gemini Prompt</p>
                              <p className="text-[9.5px] text-text-muted mt-1 leading-relaxed line-clamp-2 hover:line-clamp-none transition-all cursor-pointer bg-white/3 p-2 rounded border border-white/5" title="Click to view prompt details">
                                {session.final_prompt}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Tasks Grid Section */}
                {(() => {
                  const tasksToDisplay = activeTab === 'all' ? studioAndFlowTasks :
                                         activeTab === 'social-resize' ? filteredSocialResize :
                                         activeTab === 'flow' ? filteredFlow :
                                         activeTab === 'console' ? filteredConsole : [];

                  if (activeTab !== 'bundling' && tasksToDisplay.length === 0 && (activeTab !== 'all' || filteredSessions.length === 0)) {
                    return (
                      <div className="text-center py-20 glass-card rounded-2xl border border-dashed border-border">
                        <History className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
                        <p className="text-text-muted text-sm">No tasks found matching your filters</p>
                      </div>
                    );
                  }

                  if (tasksToDisplay.length === 0) return null;

                  return (
                    <div>
                      {activeTab === 'all' && (
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-accent-blue" /> AI Studio & Flow Tasks ({tasksToDisplay.length})
                          </h3>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {tasksToDisplay.map((task) => {
                          const firstOutUrl = task.outputs && task.outputs.length > 0 ? getOutputUrl(task.outputs[0]) : null;
                          const isVideo = firstOutUrl ? isVideoUrl(firstOutUrl) : false;
                          const promptVal = task.node_info_list?.find((n: any) => n.fieldName && n.fieldName.toLowerCase().includes('prompt'))?.fieldValue || '';

                          return (
                            <div key={task.id} className="glass-card rounded-2xl border border-border hover:border-accent-gold/30 transition-all overflow-hidden flex flex-col group relative bg-bg-card">
                              <div className="relative aspect-square bg-[#0e0e0e] overflow-hidden border-b border-border">
                                {firstOutUrl ? (
                                  <>
                                    {isVideo ? (
                                      <video
                                        src={firstOutUrl}
                                        className={cn(
                                          "w-full h-full object-cover group-hover:scale-102 transition-transform duration-300", 
                                          task.status !== 'SUCCESS' ? 'opacity-50 grayscale' : '',
                                          convertingPsdIds.has(task.id) ? 'blur-sm scale-105' : ''
                                        )}
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                      />
                                    ) : (
                                      <img
                                        src={firstOutUrl}
                                        className={cn(
                                          "w-full h-full object-cover group-hover:scale-102 transition-transform duration-300", 
                                          task.status !== 'SUCCESS' ? 'opacity-50 grayscale' : '',
                                          convertingPsdIds.has(task.id) ? 'blur-sm scale-105' : ''
                                        )}
                                        alt={task.app_name}
                                      />
                                    )}
                                    {convertingPsdIds.has(task.id) && (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20">
                                        <Loader2 className="w-8 h-8 animate-spin text-accent-blue mb-2" />
                                        <span className="text-xs font-bold text-white tracking-widest uppercase">Creating PSD...</span>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-text-muted text-xs">
                                    {task.status === 'RUNNING' || task.status === 'QUEUED' ? (
                                      <>
                                        <Loader2 className="w-6 h-6 animate-spin mb-2 text-accent-gold" />
                                        Processing...
                                      </>
                                    ) : task.status === 'FAILED' ? (
                                      <>
                                        <XCircle className="w-6 h-6 mb-2 text-accent-red" />
                                        Failed
                                      </>
                                    ) : (
                                      'No Media'
                                    )}
                                  </div>
                                )}
                                
                                {task.status === 'SUCCESS' && firstOutUrl && (
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap gap-3 items-center justify-center p-4 z-10">
                                    <button
                                      onClick={() => setPreviewMedia({
                                        name: task.app_name,
                                        url: firstOutUrl,
                                        prompt: promptVal,
                                      })}
                                      className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                      title="Preview Full Media"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => downloadMedia(firstOutUrl, `${task.app_name.replace(/\s+/g, '_')}_${task.id}.${isVideo ? 'mp4' : 'png'}`)}
                                      className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                      title="Download File"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>

                                    {/* Convert to PSD Button if input image is available */}
                                    {(() => {
                                      const originalUrl = task.node_info_list?.find((n: any) => n.fieldName === 'image')?.fieldValue;
                                      if (originalUrl && !isVideo && !convertingPsdIds.has(task.id)) {
                                        return (
                                          <button
                                            onClick={async () => {
                                              const toastId = toast.loading("Converting to PSD...");
                                              try {
                                                setConvertingPsdIds(prev => new Set(prev).add(task.id));
                                                const { generatePsdClient } = await import('@/lib/psd-helper');
                                                const blob = await generatePsdClient(originalUrl, firstOutUrl);
                                                const a = document.createElement('a');
                                                a.href = URL.createObjectURL(blob);
                                                a.download = `masked-output-${task.id}.psd`;
                                                a.click();
                                                URL.revokeObjectURL(a.href);
                                                toast.success("PSD downloaded successfully!", { id: toastId });
                                              } catch (err: any) {
                                                toast.error("Failed to generate PSD: " + err.message, { id: toastId });
                                              } finally {
                                                setConvertingPsdIds(prev => {
                                                  const next = new Set(prev);
                                                  next.delete(task.id);
                                                  return next;
                                                });
                                              }
                                            }}
                                            className="px-4 py-2 mt-2 w-full rounded-lg bg-accent-blue/90 hover:bg-accent-blue text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
                                          >
                                            <Layers className="w-3.5 h-3.5" /> Convert to PSD
                                          </button>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </div>

                              {/* Info Panel */}
                              <div className="p-4 flex flex-col flex-1 min-w-0 bg-white/2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-bold text-text-primary truncate" title={task.app_name}>
                                      {task.app_name}
                                    </h4>
                                    <p className="text-[10px] text-text-muted mt-0.5">
                                      {new Date(task.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                  <StatusBadge status={task.status} />
                                </div>

                                {/* Dynamic Parameter Tags */}
                                <div className="flex flex-wrap gap-1 mt-2.5">
                                  {(() => {
                                    const ratio = task.node_info_list?.find((n: any) => n.fieldName === 'aspectRatio' || n.fieldName === 'ratio')?.fieldValue;
                                    const modelName = task.node_info_list?.find((n: any) => n.fieldName === 'model')?.fieldValue;
                                    const resVal = task.node_info_list?.find((n: any) => n.fieldName === 'resolution' || n.fieldName === 'quality')?.fieldValue;
                                    return (
                                      <>
                                        {ratio && (
                                          <span className="text-[9px] font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/70">
                                            Ratio: {ratio}
                                          </span>
                                        )}
                                        {modelName && (
                                          <span className="text-[9px] font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/70">
                                            {modelName}
                                          </span>
                                        )}
                                        {resVal && (
                                          <span className="text-[9px] font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/70">
                                            {String(resVal).toUpperCase()}
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>

                                {promptVal && (
                                  <div className="mt-3 border-t border-white/5 pt-2">
                                    <p className="text-[9px] text-accent-gold/80 uppercase tracking-widest font-semibold">Prompt</p>
                                    <p className="text-[9.5px] text-text-muted mt-0.5 line-clamp-2 hover:line-clamp-none transition-all cursor-pointer" title={promptVal}>
                                      {promptVal}
                                    </p>
                                  </div>
                                )}
                                
                                {task.status === 'FAILED' && task.error_message && (
                                  <div className="mt-3 bg-accent-red/10 border border-accent-red/20 p-2 rounded">
                                    <p className="text-[10px] text-accent-red line-clamp-2" title={task.error_message}>
                                      Error: {task.error_message}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Flagship Media Preview Modal */}
      {previewMedia && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-all duration-300"
          onClick={() => setPreviewMedia(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {previewMedia.name}
                </h3>
                <p className="text-[10px] text-white/40 mt-0.5">
                  High-Resolution AI Output Media
                </p>
              </div>
              <button 
                onClick={() => setPreviewMedia(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/80" />
              </button>
            </div>

            {/* Viewer */}
            <div className="relative aspect-square bg-[#0e0e0e] flex items-center justify-center overflow-hidden p-6">
              {isVideoUrl(previewMedia.url) ? (
                <video 
                  src={previewMedia.url}
                  controls
                  autoPlay
                  loop
                  className="max-w-full max-h-full object-contain rounded-lg border border-white/5 shadow-lg select-none"
                />
              ) : (
                <img 
                  src={previewMedia.url}
                  className="max-w-full max-h-full object-contain rounded-lg border border-white/5 shadow-lg select-none"
                  alt="Full Preview"
                />
              )}
            </div>

            {/* Prompt details if present */}
            {previewMedia.prompt && (
              <div className="px-6 py-3 bg-white/3 border-t border-white/5 text-xs text-[#a0a5b5] max-h-24 overflow-y-auto">
                <span className="text-[9px] uppercase tracking-widest text-accent-gold font-bold block mb-1">Prompt</span>
                <p className="text-[11px] leading-relaxed text-white/80 font-mono">{previewMedia.prompt}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-white/10 bg-white/5 gap-2">
              <button
                onClick={() => setPreviewMedia(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-white/80 hover:bg-white/5 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => downloadMedia(previewMedia.url, `${previewMedia.name.replace(/\s+/g, '_')}_download.${isVideoUrl(previewMedia.url) ? 'mp4' : 'png'}`)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 flex items-center gap-1.5 transition-all shadow-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Download Media
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
