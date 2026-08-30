'use client';

import React, { useState } from 'react';
import { X, FolderPlus, Sparkles, Layers, Zap } from 'lucide-react';
import { RetouchModelId, RETOUCH_MODELS } from '@/lib/retouch/types';
import { cn } from '@/lib/utils';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string, defaultModel?: RetouchModelId) => Promise<void>;
}

export default function ProjectCreateModal({
  isOpen,
  onClose,
  onCreate,
}: ProjectCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultModel, setDefaultModel] = useState<RetouchModelId>('flux-2-edit');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onCreate(name.trim(), description.trim() || undefined, defaultModel);
      setName('');
      setDescription('');
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
              <FolderPlus className="w-4 h-4 text-[#a3e635]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create Retouch Project</h3>
              <p className="text-[11px] text-gray-400">Organize batch photoshoot assets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Project Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Abaya Shoot 2026"
              className="w-full bg-[#14161f] border border-[#262a3b] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-[#a3e635] focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Batch details, photoshoot notes..."
              className="w-full bg-[#14161f] border border-[#262a3b] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-[#a3e635] focus:outline-none transition-all resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-300">Default Model</label>
            <div className="grid grid-cols-2 gap-2.5">
              {RETOUCH_MODELS.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setDefaultModel(m.id)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all flex flex-col gap-1",
                    defaultModel === m.id
                      ? "bg-[#a3e635]/10 border-[#a3e635]"
                      : "bg-[#14161f] border-[#262a3b] hover:border-white/20"
                  )}
                >
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {m.id === 'flux-2-edit' ? (
                      <Layers className="w-3 h-3 text-[#a3e635]" />
                    ) : (
                      <Zap className="w-3 h-3 text-yellow-400" />
                    )}
                    {m.name}
                  </span>
                  <span className="text-[9.5px] text-gray-400">{m.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#262a3b]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#a3e635] text-[#0d0e12] hover:bg-[#b8f547] transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span>Creating...</span>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
