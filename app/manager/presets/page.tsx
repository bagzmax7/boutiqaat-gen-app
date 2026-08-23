'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import {
  Layers, Plus, Sparkles, Copy, Check, Trash2,
  RefreshCw, Bookmark, ArrowRight, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface BrandPreset {
  id: string;
  title: string;
  description?: string;
  category: string;
  prompt: string;
  model_used: string;
  created_at: string;
}

const DEFAULT_BRAND_PRESETS: BrandPreset[] = [
  {
    id: 'preset-1',
    title: 'Boutiqaat Luxury Perfume Glow',
    description: 'Golden hour dramatic lighting for high-end fragrances and cosmetics.',
    category: 'Luxury Beauty',
    prompt: 'Commercial product photography of a luxury perfume bottle on a sleek black marble podium, soft golden backlight, subtle warm mist, water droplets, 8k resolution, photorealistic, cinematic depth of field.',
    model_used: 'Nano Banana Pro',
    created_at: new Date().toISOString(),
  },
  {
    id: 'preset-2',
    title: 'Clean Minimalist E-Commerce Staging',
    description: 'Clean studio white background with soft diffused shadows for catalog items.',
    category: 'E-Commerce Catalog',
    prompt: 'Professional studio product shot on an off-white seamless backdrop, soft diffused daylight, elegant minimalist podium, ultra-sharp focus, commercial catalogue standard.',
    model_used: 'GPT-2.0 Image',
    created_at: new Date().toISOString(),
  },
  {
    id: 'preset-3',
    title: 'Summer Fashion Sunset Campaign',
    description: 'Warm natural sunlight aesthetics for seasonal apparel and skincare.',
    category: 'Fashion & Skincare',
    prompt: 'Editorial fashion campaign visual, golden sunset glow, organic palm leaf shadows, aesthetic warm Mediterranean tones, high-fashion magazine quality.',
    model_used: 'Seedance 2.0',
    created_at: new Date().toISOString(),
  },
];

export default function ManagerPresetsPage() {
  const router = useRouter();
  const [presets, setPresets] = useState<BrandPreset[]>(DEFAULT_BRAND_PRESETS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Luxury Beauty');
  const [newPrompt, setNewPrompt] = useState('');
  const [newModel, setNewModel] = useState('Nano Banana Pro');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleUseInStudio = (preset: BrandPreset) => {
    localStorage.setItem('bqa_selected_gallery_prompt', preset.prompt);
    localStorage.setItem('bqa_selected_gallery_model', preset.model_used);
    toast.success(`Preset "${preset.title}" loaded into Studio!`);
    router.push('/boutiqaat-flow');
  };

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newPrompt) {
      toast.error('Title and prompt are required');
      return;
    }

    const created: BrandPreset = {
      id: `custom-preset-${Date.now()}`,
      title: newTitle,
      description: newDesc,
      category: newCategory,
      prompt: newPrompt,
      model_used: newModel,
      created_at: new Date().toISOString(),
    };

    setPresets([created, ...presets]);
    toast.success('New company style preset created!');
    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewPrompt('');
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
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-green to-accent-green/40 flex items-center justify-center shadow-lg border border-accent-green/30">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-text-primary">Company Style Presets Library</h1>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green border border-accent-green/30 uppercase tracking-wider">
                      Brand Consistency
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Standardized prompt formulas and styles for seamless brand visual consistency
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 text-xs font-bold bg-accent-gold text-black hover:bg-accent-gold/90 px-4 py-2 rounded-xl transition-all shadow-md"
              >
                <Plus className="w-3.5 h-3.5" /> Create Brand Style Preset
              </button>
            </div>
          </div>

          <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className="glass-card rounded-2xl p-5 border border-border hover:border-accent-green/40 transition-all flex flex-col justify-between bg-bg-card group shadow-lg"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20 uppercase tracking-wider">
                        {preset.category}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">{preset.model_used}</span>
                    </div>

                    <h3 className="text-sm font-bold text-white mt-3 group-hover:text-accent-green transition-colors">
                      {preset.title}
                    </h3>
                    {preset.description && (
                      <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    )}

                    <div className="mt-4 bg-black/40 border border-white/5 p-3 rounded-xl">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-accent-gold block mb-1">
                        Locked Style Formula
                      </span>
                      <p className="text-[11px] font-mono text-white/80 leading-relaxed line-clamp-3">
                        {preset.prompt}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(preset.prompt);
                        setCopiedId(preset.id);
                        toast.success('Prompt copied!');
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="text-xs font-semibold text-text-muted hover:text-white flex items-center gap-1 transition-colors"
                    >
                      {copiedId === preset.id ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === preset.id ? 'Copied' : 'Copy'}
                    </button>

                    <button
                      onClick={() => handleUseInStudio(preset)}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-accent-gold/20 text-white hover:text-accent-gold border border-white/10 hover:border-accent-gold/30 flex items-center gap-1.5 transition-all"
                    >
                      <Sparkles className="w-3 h-3" /> Use in Studio <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Add Preset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-[#14161b] border border-border rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-accent-green" />
                <h3 className="text-sm font-bold text-white">Create Brand Style Preset</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-white text-xs">✕</button>
            </div>

            <form onSubmit={handleAddPreset} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Preset Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Winter Luxury Cosmetics"
                  className="w-full bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary input-gold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Category</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder="e.g. Skincare, Fragrances, Fashion"
                  className="w-full bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary input-gold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Brief description of aesthetics and lighting"
                  className="w-full bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary input-gold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-primary block mb-1">Master Style Prompt</label>
                <textarea
                  required
                  rows={4}
                  value={newPrompt}
                  onChange={e => setNewPrompt(e.target.value)}
                  placeholder="Commercial photography of {product}, studio lighting, 8k..."
                  className="w-full bg-bg-card border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary font-mono input-gold resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-border text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-accent-green text-black hover:bg-accent-green/90 transition-all shadow-md"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
