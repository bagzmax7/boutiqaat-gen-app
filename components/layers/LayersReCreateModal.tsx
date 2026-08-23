'use client';

import React, { useState } from 'react';
import { CanvasLayerItem } from '@/lib/types';
import { 
  Sparkles, 
  Wand2, 
  UploadCloud, 
  Layers, 
  Check, 
  Sliders, 
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LayersReCreateModalProps {
  layer: CanvasLayerItem | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (updatedLayer: CanvasLayerItem) => void;
}

const INTENT_PRESETS = [
  {
    id: 'material',
    label: 'Change Material / Finish',
    icon: '✨',
    placeholder: 'e.g. Frosted emerald green glass with 24k gold leaf trim, soft matte finish',
    template: 'Frosted emerald green crystal glass with 24k gold leaf trim, commercial studio lighting',
  },
  {
    id: 'replace-product',
    label: 'Replace Product (Image Upload)',
    icon: '🔄',
    placeholder: 'e.g. Replace shoe with uploaded reference product, match exact angle and ground shadow',
    template: 'Replace the subject with the reference product from the uploaded image, strictly matching camera angle and contact shadows',
  },
  {
    id: 'lighting',
    label: 'Studio Lighting & Glow',
    icon: '💡',
    placeholder: 'e.g. Dramatic rim lighting with warm golden hour back-reflection',
    template: 'Luxury commercial studio lighting with delicate rim lights and crisp reflections',
  },
  {
    id: 'props',
    label: 'Add Luxury Props & Nature',
    icon: '🌿',
    placeholder: 'e.g. Floating organic flower petals and delicate water splash droplets',
    template: 'Floating organic jasmine petals and clean crystal water droplets around the base',
  },
  {
    id: 'label',
    label: 'Packaging & Label Swap',
    icon: '🏷️',
    placeholder: 'e.g. Change bottle label text to "Boutiqaat Royal Oud" in embossed gold typography',
    template: 'Embossed metallic gold label with elegant calligraphy typography',
  },
];

export const LayersReCreateModal: React.FC<LayersReCreateModalProps> = ({
  layer,
  projectId,
  isOpen,
  onClose,
  onApply,
}) => {
  if (!isOpen || !layer) return null;

  const [model, setModel] = useState<'nano-banana-2' | 'flux-pro' | 'gpt-2'>('nano-banana-2');
  const [selectedIntent, setSelectedIntent] = useState('material');
  const [prompt, setPrompt] = useState(INTENT_PRESETS[0].template);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<CanvasLayerItem | null>(null);

  const handleIntentSelect = (intentId: string) => {
    setSelectedIntent(intentId);
    const preset = INTENT_PRESETS.find(p => p.id === intentId);
    if (preset) {
      setPrompt(preset.template);
    }
  };

  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceFile(file);
      setReferencePreview(URL.createObjectURL(file));
    }
  };

  const handleEnhancePrompt = () => {
    if (!prompt) return;
    setPrompt(prev => `${prev.trim()}, 8k ultra-high definition, luxury commercial advertising studio quality, perfectly balanced key lights and soft contact shadows, photorealistic master finish`);
    toast.success('Prompt enhanced with studio directives!');
  };

  const handleExecuteReCreate = async () => {
    if (!prompt.trim()) {
      toast.error('Please provide an instruction prompt');
      return;
    }

    try {
      setIsGenerating(true);
      let refUrl: string | null = null;

      // If reference file provided, upload it first
      if (selectedIntent === 'replace-product' && referenceFile) {
        const formData = new FormData();
        formData.append('file', referenceFile);
        const upRes = await fetch('/api/runninghub/upload', {
          method: 'POST',
          body: formData,
        });
        if (upRes.ok) {
          const upData = await upRes.json();
          refUrl = upData.fileUrl;
        }
      }

      // Call Re-Create API with 2K hardcoded lock
      const res = await fetch('/api/layers/recreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layer,
          model,
          prompt,
          intentCategory: selectedIntent,
          referenceImageUrl: refUrl,
          projectId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Re-Create generation failed');
      }

      const data = await res.json();
      setGeneratedResult(data.updatedLayer);
      toast.success('2K Layer Re-Created successfully!');
    } catch (err: any) {
      console.error('[Re-Create error]', err);
      toast.error(err.message || 'Failed to re-create layer');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyToCanvas = () => {
    if (generatedResult) {
      onApply(generatedResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0d0e10] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-800 bg-[#0d0e10] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/20 text-[#a3e635] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Re-Create Layer</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-lime-500/20 border border-lime-500/30 text-[10px] text-[#a3e635] font-mono font-bold">
                  2K Ultra-HD Locked
                </span>
              </div>
              <p className="text-xs text-zinc-400">Target Layer: <span className="text-white font-medium">{layer.name}</span> (v{layer.version}.0)</p>
            </div>
          </div>
          {!isGenerating && (
            <button onClick={onClose} className="text-zinc-400 hover:text-white p-2 text-sm rounded-lg hover:bg-zinc-800">
              ✕
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 1. Model Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Select AI Vision Engine</span>
              <span className="text-[11px] text-[#a3e635] font-mono">Output: 2048 × 2048 (2K Native)</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'nano-banana-2', name: 'Nano Banana 2', badge: 'Recommended', desc: 'Lighting & Reference Lock' },
                { id: 'flux-pro', name: 'Flux Pro', badge: 'Photoreal', desc: 'Ultra-Fine Texture Detail' },
                { id: 'gpt-2', name: 'GPT-2.0 Image', badge: 'Precise', desc: 'Complex Prompt Logic' },
              ].map(m => (
                <div
                  key={m.id}
                  onClick={() => setModel(m.id as any)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    model === m.id
                      ? 'bg-lime-500/10 border-[#a3e635] shadow-md shadow-[#a3e635]/10'
                      : 'bg-[#050505] border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">{m.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-lime-500/20 text-[#a3e635] font-bold">{m.badge}</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Intent Preset Chips */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">Commercial Re-Create Intent</label>
            <div className="flex flex-wrap gap-2">
              {INTENT_PRESETS.map(intent => (
                <button
                  type="button"
                  key={intent.id}
                  onClick={() => handleIntentSelect(intent.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                    selectedIntent === intent.id
                      ? 'bg-[#a3e635] text-[#0d0e10] border-[#a3e635] shadow-sm'
                      : 'bg-[#050505] border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>{intent.icon}</span>
                  <span>{intent.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Reference Image Upload (When intent is replace-product) */}
          {selectedIntent === 'replace-product' && (
            <div className="p-4 rounded-2xl bg-lime-950/20 border border-lime-500/30 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-lime-200">Upload Reference Replacement Product</span>
                <span className="text-[10px] text-[#a3e635]">Preserves original angle & shadow</span>
              </div>
              <div className="relative border border-dashed border-lime-500/40 rounded-xl p-4 text-center bg-[#050505]">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleRefFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {referencePreview ? (
                  <div className="flex items-center justify-center gap-4">
                    <img src={referencePreview} alt="Ref" className="h-20 object-contain rounded-lg border border-lime-500/40" />
                    <div className="text-left">
                      <span className="text-xs text-white font-bold block">{referenceFile?.name}</span>
                      <span className="text-[10px] text-[#a3e635]">Click to choose another reference image</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <UploadCloud className="w-6 h-6 text-[#a3e635]" />
                    <span className="text-xs text-zinc-300">Click or drag product reference photo from your folder</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Prompt Input & Master Formula */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">Instruction Prompt (2K Vision Directives)</label>
              <button
                type="button"
                onClick={handleEnhancePrompt}
                className="inline-flex items-center gap-1 text-[11px] text-[#a3e635] hover:text-[#bef264] font-bold transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Magic Enhance
              </button>
            </div>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the material, color, or modification required..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-zinc-800 focus:border-[#a3e635] text-white text-xs outline-none transition-colors"
            />
          </div>

          {/* 5. Before vs After Comparison (If generated) */}
          {generatedResult && (
            <div className="p-4 rounded-2xl bg-[#050505] border border-lime-500/40 space-y-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[#a3e635]" />
                2K Output Ready — Comparison Preview
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-center">
                  <span className="text-[10px] text-zinc-400 uppercase font-mono">Original (v{layer.version})</span>
                  <div className="aspect-square rounded-xl bg-[#0d0e10] border border-zinc-800 overflow-hidden flex items-center justify-center">
                    <img src={layer.currentUrl} alt="Before" className="max-h-full max-w-full object-contain" />
                  </div>
                </div>
                <div className="space-y-1 text-center">
                  <span className="text-[10px] text-[#a3e635] uppercase font-mono font-black">Re-Created 2K (v{generatedResult.version})</span>
                  <div className="aspect-square rounded-xl bg-lime-950/20 border border-lime-500/60 overflow-hidden flex items-center justify-center">
                    <img src={generatedResult.currentUrl} alt="After" className="max-h-full max-w-full object-contain" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-6 border-t border-zinc-800 bg-[#0d0e10] flex items-center justify-between">
          <button
            type="button"
            disabled={isGenerating}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleExecuteReCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#a3e635] hover:bg-[#bef264] text-[#0d0e10] text-xs font-black shadow-lg shadow-[#a3e635]/30 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Rendering 2K...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#0d0e10]" />
                  {generatedResult ? 'Re-Generate' : 'Generate 2K Re-Create'}
                </>
              )}
            </button>

            {generatedResult && (
              <button
                type="button"
                onClick={handleApplyToCanvas}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#a3e635] hover:bg-[#bef264] text-[#0d0e10] text-xs font-black shadow-lg shadow-[#a3e635]/30 transition-all"
              >
                <Check className="w-4 h-4" />
                Apply to Canvas Layer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
