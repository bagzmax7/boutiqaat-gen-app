'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  Award, Star, Eye, Download, Copy, Check, Sparkles,
  Film, Image as ImageIcon, Search, Filter, Trash2,
  ExternalLink, Layers, RefreshCw, X, Play, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn, isVideoUrl } from '@/lib/utils';
import { CreativeGalleryItem } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function ManagerGalleryPage() {
  const router = useRouter();
  const [items, setItems] = useState<CreativeGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'image' | 'video' | 'presets'>('all');
  const [search, setSearch] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Inspector Lightbox Modal
  const [inspectItem, setInspectItem] = useState<CreativeGalleryItem | null>(null);

  const fetchGallery = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/manager/gallery', window.location.origin);
      if (activeTab !== 'all') url.searchParams.set('type', activeTab);
      if (search) url.searchParams.set('search', search);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to load gallery');
      const data = await res.json();
      setItems(data.items || []);
    } catch (err: any) {
      toast.error(err.message || 'Error loading gallery');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, [activeTab]);

  const handleUnstar = async (item: CreativeGalleryItem) => {
    if (!confirm('Remove this curated masterpiece from Team Gallery?')) return;
    try {
      const res = await fetch(`/api/manager/gallery?id=${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unstar item');
      toast.success('Removed from gallery');
      if (inspectItem?.id === item.id) setInspectItem(null);
      fetchGallery();
    } catch (err: any) {
      toast.error(err.message || 'Error unstarring item');
    }
  };

  const handleDownload = async (url: string, filename: string) => {
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
      toast.success('Media downloaded successfully!');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleUseInStudio = (item: CreativeGalleryItem) => {
    // Store prompt in session/localStorage to load into Flow / Studio
    localStorage.setItem('bqa_selected_gallery_prompt', item.prompt);
    localStorage.setItem('bqa_selected_gallery_model', item.model_used);
    toast.success('Loaded preset into Studio!');
    router.push('/boutiqaat-flow');
  };

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-6 border-b border-border/50 bg-gradient-to-r from-bg-secondary/60 via-transparent to-transparent">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-gold/40 flex items-center justify-center shadow-lg border border-accent-gold/30">
                  <Star className="w-5 h-5 text-white fill-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-text-primary">Team Creative Gallery</h1>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold border border-accent-gold/30 uppercase tracking-wider">
                      Curated Explore
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Curated masterpieces, company style presets, and high-performing prompts
                  </p>
                </div>
              </div>

              <button
                onClick={fetchGallery}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-white border border-border hover:bg-bg-hover px-3.5 py-2 rounded-xl transition-all"
                title="Refresh gallery"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>

          <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex border-b border-border/50 gap-2 sm:gap-6 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'All Curated Assets', icon: Sparkles },
                  { id: 'image', label: 'Commercial Images', icon: ImageIcon },
                  { id: 'video', label: 'Cinematic Videos', icon: Film },
                  { id: 'presets', label: 'Brand Style Presets', icon: Layers },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        'pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-all outline-none whitespace-nowrap flex items-center gap-1.5',
                        activeTab === tab.id
                          ? 'border-accent-gold text-accent-gold font-bold'
                          : 'border-transparent text-text-muted hover:text-text-primary'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchGallery()}
                  placeholder="Search prompt, model, or creator..."
                  className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-text-primary placeholder-text-muted input-gold transition-all"
                />
              </div>
            </div>

            {/* Gallery Grid */}
            {loading ? (
              <div className="text-center py-20 text-text-muted">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-accent-gold/50" />
                Loading curated collection...
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20 glass-card rounded-2xl border border-dashed border-border">
                <Star className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
                <p className="text-text-muted text-sm font-medium">No curated assets in this view yet</p>
                <p className="text-text-muted/60 text-xs mt-1">
                  Managers can star ⭐ completed creations from history or studio to feature them here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {items.map(item => {
                  const isVideo = item.media_type === 'video' || isVideoUrl(item.media_url);

                  return (
                    <div
                      key={item.id}
                      className="glass-card rounded-2xl border border-border hover:border-accent-gold/40 transition-all overflow-hidden flex flex-col group relative bg-bg-card shadow-lg hover:shadow-2xl"
                    >
                      {/* Media Card Preview */}
                      <div className="relative aspect-square bg-[#0e0e0e] overflow-hidden border-b border-border">
                        {isVideo ? (
                          <video
                            src={item.media_url}
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                            autoPlay
                            muted
                            loop
                            playsInline
                          />
                        ) : (
                          <img
                            src={item.media_url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                          />
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-accent-gold flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-accent-gold text-accent-gold" /> Curated
                          </span>

                          {item.is_company_preset && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-accent-blue/80 backdrop-blur-md text-black">
                              Preset
                            </span>
                          )}
                        </div>

                        {/* Hover Overlay Actions */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 z-20">
                          <button
                            onClick={() => setInspectItem(item)}
                            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                            title="Inspect Full Specs & Prompt"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(item.media_url, `${item.title.replace(/\s+/g, '_')}.${isVideo ? 'mp4' : 'png'}`)}
                            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                            title="Download Asset"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUseInStudio(item)}
                            className="w-10 h-10 rounded-full bg-accent-gold text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                            title="Use in Studio"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Info Panel */}
                      <div className="p-4 flex flex-col flex-1 min-w-0 bg-white/2">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-bold text-text-primary truncate" title={item.title}>
                            {item.title}
                          </h4>
                          <button
                            onClick={() => handleUnstar(item)}
                            className="text-text-muted hover:text-accent-red transition-colors p-1"
                            title="Remove from Gallery"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-[10px] text-text-muted mt-0.5 block truncate">
                          By {item.creator_name || 'Designer'} • {item.model_used}
                        </span>

                        <div className="mt-3 border-t border-white/5 pt-2">
                          <p
                            className="text-[9.5px] text-text-secondary line-clamp-2 cursor-pointer hover:text-white transition-colors bg-white/3 p-1.5 rounded border border-white/5 font-mono"
                            onClick={() => setInspectItem(item)}
                            title="Click to inspect prompt"
                          >
                            {item.prompt}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Lightbox Spec Inspector Modal */}
      {inspectItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 transition-all duration-300"
          onClick={() => setInspectItem(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#121418] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-wide">{inspectItem.title}</h3>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-accent-gold/15 text-accent-gold border border-accent-gold/30 uppercase">
                    ⭐ Curated Spec
                  </span>
                </div>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Created by {inspectItem.creator_name} ({inspectItem.creator_email})
                </p>
              </div>
              <button
                onClick={() => setInspectItem(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="overflow-y-auto p-6 space-y-5">
              {/* Media Preview Box */}
              <div className="relative aspect-video sm:aspect-[16/10] bg-[#0a0a0c] rounded-xl overflow-hidden flex items-center justify-center border border-white/10">
                {inspectItem.media_type === 'video' || isVideoUrl(inspectItem.media_url) ? (
                  <video
                    src={inspectItem.media_url}
                    controls
                    autoPlay
                    loop
                    className="max-w-full max-h-full object-contain select-none"
                  />
                ) : (
                  <img
                    src={inspectItem.media_url}
                    alt={inspectItem.title}
                    className="max-w-full max-h-full object-contain select-none"
                  />
                )}
              </div>

              {/* Master Prompt Section */}
              <div className="bg-white/3 border border-white/5 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent-gold">
                    Master Commercial Prompt
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inspectItem.prompt);
                      setCopiedPrompt(true);
                      toast.success('Prompt copied to clipboard!');
                      setTimeout(() => setCopiedPrompt(false), 2000);
                    }}
                    className="text-xs font-semibold text-white/80 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {copiedPrompt ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedPrompt ? 'Copied' : 'Copy Prompt'}
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-white/90 font-mono bg-black/40 p-3 rounded-lg border border-white/5 select-text">
                  {inspectItem.prompt}
                </p>
              </div>

              {/* Parameters Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/3 border border-white/5 p-3 rounded-xl">
                  <span className="text-[9px] text-text-muted uppercase font-semibold">AI Model</span>
                  <p className="text-xs font-bold text-white mt-0.5 truncate">{inspectItem.model_used}</p>
                </div>
                <div className="bg-white/3 border border-white/5 p-3 rounded-xl">
                  <span className="text-[9px] text-text-muted uppercase font-semibold">Media Type</span>
                  <p className="text-xs font-bold text-accent-blue mt-0.5 uppercase">{inspectItem.media_type}</p>
                </div>
                <div className="bg-white/3 border border-white/5 p-3 rounded-xl">
                  <span className="text-[9px] text-text-muted uppercase font-semibold">Resolution / Aspect</span>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {inspectItem.settings_snapshot?.aspectRatio || inspectItem.settings_snapshot?.ratio || '16:9 / 2K'}
                  </p>
                </div>
                <div className="bg-white/3 border border-white/5 p-3 rounded-xl">
                  <span className="text-[9px] text-text-muted uppercase font-semibold">Curated Date</span>
                  <p className="text-xs font-bold text-text-secondary mt-0.5">
                    {new Date(inspectItem.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
              <button
                onClick={() => handleUnstar(inspectItem)}
                className="text-xs font-semibold text-accent-red hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove from Gallery
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownload(inspectItem.media_url, `${inspectItem.title.replace(/\s+/g, '_')}.${inspectItem.media_type === 'video' ? 'mp4' : 'png'}`)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-white hover:bg-white/5 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download Media
                </button>
                <button
                  onClick={() => handleUseInStudio(inspectItem)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-accent-gold text-black hover:bg-accent-gold/90 flex items-center gap-1.5 transition-all shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Use in Studio
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
