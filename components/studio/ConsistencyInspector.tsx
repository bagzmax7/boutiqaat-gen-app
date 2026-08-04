'use client';

import { useState } from 'react';
import {
  Package, User, Shield, Layers, History,
  Plus, Check, Sliders, ChevronRight, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ConsistencyInspector() {
  const [activeTab, setActiveTab] = useState<'assets' | 'history'>('assets');
  const [productAsset, setProductAsset] = useState<string | null>(null);
  const [modelAsset, setModelAsset] = useState<string | null>(null);

  return (
    <aside className="w-80 h-full bg-bg-card/90 border-l border-border/80 flex flex-col flex-shrink-0 backdrop-blur-xl">
      {/* Tab Switcher */}
      <div className="flex items-center border-b border-border/60 p-2 gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('assets')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
            activeTab === 'assets'
              ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Brand Consistency</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
            activeTab === 'history'
              ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <History className="w-3.5 h-3.5" />
          <span>History Vault</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'assets' ? (
          <>
            {/* Product Asset Slot */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-purple-400" />
                  <span>Product Asset Lock</span>
                </span>
                <span className="text-[10px] text-text-muted">Bottle / Item</span>
              </div>
              <div className="h-28 rounded-2xl border-2 border-dashed border-border/80 hover:border-purple-500/60 bg-bg-primary/50 flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer">
                {productAsset ? (
                  <img src={productAsset} alt="Product" className="h-full object-contain" />
                ) : (
                  <>
                    <Plus className="w-6 h-6 text-purple-400 mb-1" />
                    <span className="text-xs font-semibold text-text-primary">Lock Product Image</span>
                    <span className="text-[10px] text-text-muted">Drag 3D bottle or PNG</span>
                  </>
                )}
              </div>
            </div>

            {/* Model / Talent Asset Slot */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-pink-400" />
                  <span>Influencer / Model Lock</span>
                </span>
                <span className="text-[10px] text-text-muted">Face Consistency</span>
              </div>
              <div className="h-28 rounded-2xl border-2 border-dashed border-border/80 hover:border-pink-500/60 bg-bg-primary/50 flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer">
                {modelAsset ? (
                  <img src={modelAsset} alt="Model" className="h-full object-cover rounded-xl" />
                ) : (
                  <>
                    <Plus className="w-6 h-6 text-pink-400 mb-1" />
                    <span className="text-xs font-semibold text-text-primary">Lock Talent Identity</span>
                    <span className="text-[10px] text-text-muted">Kling/Seedance Identity Lock</span>
                  </>
                )}
              </div>
            </div>

            {/* Brand Colors & Overlay */}
            <div className="p-3.5 rounded-2xl bg-bg-primary/60 border border-border/60 space-y-2">
              <div className="text-xs font-bold text-text-primary">Boutiqaat Brand Kit</div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#D4AF37] border border-white/20" title="Gold" />
                <div className="w-5 h-5 rounded-full bg-[#111116] border border-white/20" title="Obsidian" />
                <div className="w-5 h-5 rounded-full bg-[#E5D3B3] border border-white/20" title="Champagne" />
                <span className="text-[11px] text-text-muted ml-auto font-mono">BTQ Gold Theme</span>
              </div>
            </div>
          </>
        ) : (
          /* History Vault */
          <div className="space-y-3">
            <div className="text-xs font-bold text-text-primary">Recent Studio Runs</div>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="group flex items-center gap-3 p-2.5 rounded-xl bg-bg-primary/60 border border-border/60 hover:border-accent-gold/40 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-lg bg-bg-secondary overflow-hidden flex-shrink-0">
                    <img
                      src={`https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=200&q=80`}
                      alt="History"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-text-primary truncate">Perfume Shore Shot #{i}</div>
                    <div className="text-[10px] text-text-muted">Seedream 5.0 · 1:1</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
