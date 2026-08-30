'use client';

import React, { useState } from 'react';
import { X, RefreshCw, Sparkles, Zap, Layers, CheckCircle2 } from 'lucide-react';
import { RetouchItem, RetouchModelId, RETOUCH_MODELS } from '@/lib/retouch/types';
import { cn } from '@/lib/utils';

interface RegenerateModalProps {
  item: RetouchItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (itemId: string, selectedModel: RetouchModelId) => Promise<void>;
}

export default function RegenerateModal({
  item,
  isOpen,
  onClose,
  onRegenerate,
}: RegenerateModalProps) {
  const [selectedModel, setSelectedModel] = useState<RetouchModelId>('flux-2-edit');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !item) return null;

  const nextVersionNum = item.versions.length + 1;

  const handleStart = async () => {
    setLoading(true);
    try {
      await onRegenerate(item.id, selectedModel);
      onClose();
    } catch {
      // Handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#0d0e12] border border-[#262a3b] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262a3b] bg-[#14161f]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#a3e635]/10 border border-[#a3e635]/25 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-[#a3e635]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Regenerate Retouch
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#a3e635] text-[#0d0e12] font-black">
                  v{nextVersionNum}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 truncate max-w-xs">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Source Image Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#14161f] border border-[#262a3b]">
            <img
              src={item.originalUrl}
              alt={item.name}
              className="w-12 h-12 rounded-lg object-cover border border-white/10"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-wider text-[#a3e635] font-bold block">
                Original Product Asset
              </span>
              <p className="text-xs text-gray-300 font-medium truncate">
                {item.originalWidth && item.originalHeight
                  ? `${item.originalWidth} × ${item.originalHeight} px`
                  : 'Source Image'}
              </p>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-300">
              Select Retouch Engine
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              {RETOUCH_MODELS.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <button
                    type="button"
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5",
                      isSelected
                        ? "bg-[#a3e635]/10 border-[#a3e635] shadow-[0_0_15px_rgba(163,230,53,0.15)]"
                        : "bg-[#14161f] border-[#262a3b] hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        {model.id === 'flux-2-edit' ? (
                          <Layers className="w-3.5 h-3.5 text-[#a3e635]" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-yellow-400" />
                        )}
                        {model.name}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#a3e635]" />
                      )}
                    </div>
                    <span className="text-[9px] text-gray-400 font-medium">
                      {model.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#262a3b] bg-[#14161f]">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#a3e635] text-[#0d0e12] hover:bg-[#b8f547] transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Starting v{nextVersionNum}...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" /> Generate v{nextVersionNum}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
