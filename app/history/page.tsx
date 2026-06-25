'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import Image from 'next/image';
import { History, Download, CheckCircle2, XCircle, Clock, Loader2, Search, Filter, Eye, X, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { TaskOutput } from '@/lib/types';

interface HistoryTask {
  id: string;
  runninghub_task_id: string;
  app_name: string;
  status: string;
  outputs: TaskOutput[];
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
  };
  const config = map[status] || map.QUEUED;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', config.cls)}>
      {config.icon} {status}
    </span>
  );
}

function exportCSV(tasks: HistoryTask[]) {
  const header = 'Date,App,Status,API Key Type,Outputs\n';
  const rows = tasks.map(t => [
    new Date(t.created_at).toLocaleString(),
    t.app_name,
    t.status,
    t.api_key_type,
    (t.outputs || []).map(o => o.fileUrl).join(' | '),
  ].map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'task-history.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const [tasks, setTasks] = useState<HistoryTask[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [convertingPsdIds, setConvertingPsdIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  
  // High-fidelity tab switcher
  const [activeTab, setActiveTab] = useState<'bundling' | 'console'>('bundling');
  const [previewImage, setPreviewImage] = useState<any | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [tasksRes, sessionsRes] = await Promise.all([
          fetch('/api/tasks?limit=100'),
          fetch('/api/bundling/sessions?limit=100')
        ]);
        
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTasks(tasksData.tasks || []);
        }
        
        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          setSessions(sessionsData.sessions || []);
        }
      } catch (err) {
        console.error('Failed to load history data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const downloadImage = async (url: string, filename: string) => {
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
    } catch (err) {
      console.error('Failed to download image:', err);
    }
  };

  const filteredTasks = tasks.filter(t => {
    // Exclude Bundling Studio tasks from Console Tasks tab
    if (t.app_name === 'Bundling Studio' || t.app_name === 'bundling') return false;
    
    const matchSearch = t.app_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filter === 'ALL' || t.status === filter;
    return matchSearch && matchStatus;
  });

  const filteredSessions = sessions.filter(s => {
    const matchSearch = s.session_name.toLowerCase().includes(search.toLowerCase()) || 
                        (s.product_names || []).some((name: string) => name.toLowerCase().includes(search.toLowerCase())) ||
                        s.final_prompt.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-6 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-gold to-accent-gold/50 flex items-center justify-center">
                  <History className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-text-primary">My History</h1>
                  <p className="text-sm text-text-secondary">
                    {activeTab === 'bundling' 
                      ? `${sessions.length} bundling studio sessions` 
                      : `${tasks.length} console tasks`
                    }
                  </p>
                </div>
              </div>
              {activeTab === 'console' && (
                <button
                  onClick={() => exportCSV(filteredTasks)}
                  className="flex items-center gap-2 text-xs font-semibold text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/10 px-4 py-2 rounded-xl transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
            </div>
          </div>

          <div className="px-6 py-6 max-w-5xl mx-auto">
            {/* High-Fidelity Tabs Swapper */}
            <div className="flex border-b border-border/50 mb-6 gap-6">
              <button
                onClick={() => { setActiveTab('bundling'); setSearch(''); }}
                className={cn(
                  'pb-3 text-sm font-semibold border-b-2 transition-all outline-none',
                  activeTab === 'bundling' 
                    ? 'border-accent-gold text-accent-gold font-bold' 
                    : 'border-transparent text-text-muted hover:text-text-primary'
                )}
              >
                Bundling Studio ({sessions.length})
              </button>
              <button
                onClick={() => { setActiveTab('console'); setSearch(''); }}
                className={cn(
                  'pb-3 text-sm font-semibold border-b-2 transition-all outline-none',
                  activeTab === 'console' 
                    ? 'border-accent-gold text-accent-gold font-bold' 
                    : 'border-transparent text-text-muted hover:text-text-primary'
                )}
              >
                Console Tasks ({tasks.length})
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-5 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={activeTab === 'bundling' ? "Search sessions, products, or prompts..." : "Search tasks..."}
                  className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted input-gold transition-all"
                />
              </div>
              {activeTab === 'console' && ['ALL', 'SUCCESS', 'FAILED', 'QUEUED', 'RUNNING'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                    filter === s ? 'bg-accent-gold/10 text-accent-gold border-accent-gold/30' : 'text-text-muted border-border hover:border-border-light hover:text-text-primary'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Loading / Content Render block */}
            {loading ? (
              <div className="text-center py-16 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-accent-gold/50" />
                Loading history...
              </div>
            ) : activeTab === 'bundling' ? (
              /* Upgraded Bundling Studio Grid */
              filteredSessions.length === 0 ? (
                <div className="text-center py-16 glass-card rounded-2xl border border-dashed border-border">
                  <History className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
                  <p className="text-text-muted text-sm">No bundling sessions found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {filteredSessions.map((session) => (
                    <div key={session.id} className="glass-card rounded-2xl border border-border hover:border-accent-gold/30 transition-all overflow-hidden flex flex-col group relative bg-bg-card">
                      {/* Image Thumbnail with actions */}
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
                              onClick={() => setPreviewImage({
                                name: session.session_name,
                                imageUrl: session.generated_image_url,
                                prompt: session.final_prompt,
                                products: session.product_names || [],
                              })}
                              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                              title="Preview 2K compositing details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => downloadImage(session.generated_image_url, `Generated_Bundle_${session.id}.png`)}
                              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                              title="Download Image"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Info Panel */}
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
                              <span key={i} className="text-[8.5px] font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/70 truncate max-w-24">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3.5 border-t border-white/5 pt-2.5">
                          <p className="text-[9px] text-accent-gold/80 uppercase tracking-widest font-semibold">Gemini Prompt</p>
                          <p className="text-[9.5px] text-text-muted mt-1 leading-relaxed line-clamp-3 hover:line-clamp-none transition-all cursor-pointer bg-white/3 p-2 rounded border border-white/5" title="Hover/Click to expand prompt details">
                            {session.final_prompt}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* Upgraded Console Tasks Grid */
              filteredTasks.length === 0 ? (
                <div className="text-center py-16 glass-card rounded-2xl border border-dashed border-border">
                  <History className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
                  <p className="text-text-muted text-sm">No console tasks found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="glass-card rounded-2xl border border-border hover:border-accent-gold/30 transition-all overflow-hidden flex flex-col group relative bg-bg-card">
                      {/* Image Thumbnail with actions */}
                      <div className="relative aspect-square bg-[#0e0e0e] overflow-hidden border-b border-border">
                        {task.outputs && task.outputs.length > 0 && task.outputs[0].fileUrl ? (
                          <>
                            <img
                              src={task.outputs[0].fileUrl}
                              className={cn(
                                "w-full h-full object-cover group-hover:scale-102 transition-transform duration-300", 
                                task.status !== 'SUCCESS' ? 'opacity-50 grayscale' : '',
                                convertingPsdIds.has(task.id) ? 'blur-sm scale-105' : ''
                              )}
                              alt={task.app_name}
                            />
                            {/* Loading overlay for PSD conversion */}
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
                              'No Image'
                            )}
                          </div>
                        )}
                        
                        {task.status === 'SUCCESS' && task.outputs && task.outputs.length > 0 && task.outputs[0].fileUrl && (
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap gap-3 items-center justify-center p-4 z-10">
                            <button
                              onClick={() => setPreviewImage({
                                name: task.app_name,
                                imageUrl: task.outputs[0].fileUrl,
                                prompt: task.node_info_list?.find((n: any) => n.fieldName.toLowerCase().includes('prompt'))?.fieldValue || '',
                                products: [],
                              })}
                              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                              title="Preview Full Image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => downloadImage(task.outputs[0].fileUrl, `${task.app_name.replace(/\s+/g, '_')}_${task.id}.png`)}
                              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                              title="Download PNG"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {/* Convert to PSD Button - only if we have originalUrl in node_info_list */}
                            {(() => {
                              const originalUrl = task.node_info_list?.find((n: any) => n.fieldName === 'image')?.fieldValue;
                              if (originalUrl && !convertingPsdIds.has(task.id)) {
                                return (
                                  <button
                                    onClick={async () => {
                                      const toastId = toast.loading("Converting to PSD...");
                                      try {
                                        setConvertingPsdIds(prev => new Set(prev).add(task.id));
                                        
                                        const { generatePsdClient } = await import('@/lib/psd-helper');
                                        const blob = await generatePsdClient(originalUrl, task.outputs[0].fileUrl);
                                        
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

                        {task.api_key_type && (
                          <div className="mt-3">
                            <span className={cn(
                              'text-[9px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider',
                              task.api_key_type === 'consumer'
                                ? 'text-accent-green bg-accent-green/8 border-accent-green/20'
                                : 'text-accent-blue bg-accent-blue/8 border-accent-blue/20'
                            )}>
                              {task.api_key_type === 'consumer' ? 'RH Coins' : 'Enterprise'}
                            </span>
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
                  ))}
                </div>
              )
            )}
          </div>
        </main>
      </div>

      {/* Flagship 2K Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-all duration-300"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {previewImage.name}
                </h3>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Visual composition, shadows, and reflection details
                </p>
              </div>
              <button 
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/80" />
              </button>
            </div>

            {/* Viewer */}
            <div className="relative aspect-square bg-[#0e0e0e] flex items-center justify-center overflow-hidden p-6">
              <img 
                src={previewImage.imageUrl}
                className="max-w-full max-h-full object-contain rounded-lg border border-white/5 shadow-lg select-none"
                alt="High Resolution 2K Preview"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
              <div className="flex flex-col">
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Resolution</span>
                <span className="text-xs font-medium text-accent-gold mt-0.5">2K Ultra-HD (2048 × 2048)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewImage(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-white/80 hover:bg-white/5 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => downloadImage(previewImage.imageUrl, `Bundle_2K_Download.png`)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 flex items-center gap-1.5 transition-all shadow-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
