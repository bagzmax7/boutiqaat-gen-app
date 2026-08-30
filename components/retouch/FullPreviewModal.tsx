'use client';

import React, { useState } from 'react';
import { X, Download, Sparkles, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import BeforeAfterSlider from './BeforeAfterSlider';

interface FullPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  originalUrl: string;
  outputUrl: string | null;
  versionNumber: number;
  modelName: string;
}

export default function FullPreviewModal({
  isOpen,
  onClose,
  itemName,
  originalUrl,
  outputUrl,
  versionNumber,
  modelName,
}: FullPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0d0e12] border border-[#262a3b] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#262a3b] bg-[#14161f]">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#a3e635]" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {itemName}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#a3e635] text-[#0d0e12] font-black">
                  v{versionNumber}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 font-mono">{modelName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {outputUrl && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(outputUrl);
                    const blob = await res.blob();
                    const objUrl = URL.createObjectURL(blob);
                    const base = itemName.replace(/\.[^/.]+$/, '');
                    const cleanBase = base.replace(/-Retouched(-v\d+)?$/i, '').replace(/_Retouched(_v\d+)?$/i, '');
                    const a = document.createElement('a');
                    a.href = objUrl;
                    a.download = `${cleanBase}-Retouched-v${versionNumber}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(objUrl);
                  } catch {
                    window.open(outputUrl, '_blank');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#a3e635] hover:text-black text-white text-xs font-bold transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Download Output
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Full Interactive Slider */}
        <div className="p-6 flex-1 flex items-center justify-center bg-[#07080a] overflow-hidden">
          <div className="w-full max-w-2xl max-h-[70vh] flex items-center justify-center">
            <BeforeAfterSlider
              beforeUrl={originalUrl}
              afterUrl={outputUrl}
              versionLabel={`v${versionNumber}`}
              aspectRatio="1/1"
              className="max-h-[68vh] shadow-2xl rounded-2xl"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-[#262a3b] bg-[#14161f] flex items-center justify-between text-xs text-gray-400">
          <span>Drag the center line left/right to compare Before vs After</span>
          <span className="text-[11px] text-[#a3e635] font-mono">Boutiqaat Studio Retouch</span>
        </div>
      </div>
    </div>
  );
}
