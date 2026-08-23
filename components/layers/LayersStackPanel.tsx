'use client';

import React, { useState } from 'react';
import { CanvasLayerItem } from '@/lib/types';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Sparkles, 
  Download, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Sliders,
  GripVertical,
  Copy
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LayersStackPanelProps {
  layers: CanvasLayerItem[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onUpdateLayer: (updatedLayer: CanvasLayerItem) => void;
  onReorderLayers: (newLayers: CanvasLayerItem[]) => void;
  onOpenReCreate: (layer: CanvasLayerItem) => void;
  onDeleteLayer: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
}

export const LayersStackPanel: React.FC<LayersStackPanelProps> = ({
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onReorderLayers,
  onOpenReCreate,
  onDeleteLayer,
  onDuplicateLayer,
}) => {
  // Safe layers array fallback
  const safeLayers = Array.isArray(layers) ? layers : [];
  // Sort descending by zIndex so topmost layer appears at the top of list
  const sortedLayers = [...safeLayers].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

  const selectedLayer = safeLayers.find(l => l.id === selectedLayerId);

  // Drag and Drop States for Photoshop-Style Reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleToggleVisibility = (layer: CanvasLayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateLayer({ ...layer, visible: !layer.visible });
  };

  const handleToggleLock = (layer: CanvasLayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateLayer({ ...layer, locked: !layer.locked });
  };

  const handleMoveZIndex = (layerId: string, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = sortedLayers.findIndex(l => l.id === layerId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sortedLayers.length) return;

    const newSorted = [...sortedLayers];
    const temp = newSorted[idx];
    newSorted[idx] = newSorted[targetIdx];
    newSorted[targetIdx] = temp;

    // Recalculate zIndex descending
    const updated = newSorted.map((l, index) => ({
      ...l,
      zIndex: newSorted.length - 1 - index,
    }));

    onReorderLayers(updated);
  };

  // Drag & Drop Handlers (Photoshop Style)
  const handleDragStart = (e: React.DragEvent, index: number, layer: CanvasLayerItem) => {
    if (layer.isBackground) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSorted = [...sortedLayers];
    const [movedItem] = newSorted.splice(draggedIndex, 1);
    newSorted.splice(targetIndex, 0, movedItem);

    // Recalculate zIndex descending
    const updated = newSorted.map((l, index) => ({
      ...l,
      zIndex: newSorted.length - 1 - index,
    }));

    onReorderLayers(updated);
    onSelectLayer(movedItem.id);
    setDraggedIndex(null);
    setDragOverIndex(null);
    toast.success(`Moved ${movedItem.name}`, { id: 'reorder', duration: 1200 });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDownloadSinglePng = (layer: CanvasLayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = layer.currentUrl;
    a.download = `${layer.name.toLowerCase().replace(/\s+/g, '_')}_v${layer.version}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${layer.name}`);
  };

  return (
    <aside className="w-80 bg-[#0d0e10] border-l border-zinc-800 flex flex-col h-full select-none">
      {/* Panel Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#a3e635]" />
          <h3 className="text-xs font-black text-white uppercase tracking-wider">Layers Matrix</h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300 font-mono">
          {layers.length} Layers
        </span>
      </div>

      {/* Layer List with Photoshop Drag-and-Drop */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedLayers.map((layer, index) => {
          const isSelected = layer.id === selectedLayerId;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index && draggedIndex !== index;

          return (
            <div
              key={layer.id}
              draggable={!layer.isBackground}
              onDragStart={(e) => handleDragStart(e, index, layer)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectLayer(layer.id)}
              className={`group relative rounded-xl border p-2.5 transition-all cursor-pointer ${
                isDragging ? 'opacity-40 scale-95 border-dashed border-[#a3e635]' : ''
              } ${
                isDragOver ? 'border-t-4 border-t-[#a3e635] bg-lime-500/10' : ''
              } ${
                isSelected
                  ? 'bg-lime-500/10 border-[#a3e635] shadow-md shadow-[#a3e635]/10'
                  : 'bg-[#15171c]/70 border-zinc-800/80 hover:border-zinc-700 hover:bg-[#15171c]'
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Drag Grip Handle */}
                {!layer.isBackground ? (
                  <div className="text-zinc-600 group-hover:text-zinc-400 cursor-grab active:cursor-grabbing p-0.5">
                    <GripVertical className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-4" />
                )}

                {/* Layer Thumbnail Preview */}
                <div className="relative w-11 h-11 rounded-lg bg-[#050505] border border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  <img
                    src={layer.currentUrl}
                    alt={layer.name}
                    className={`max-w-full max-h-full object-contain ${!layer.visible ? 'opacity-20' : ''}`}
                  />
                  {layer.isBackground && (
                    <span className="absolute bottom-0 inset-x-0 bg-zinc-800/90 text-[8px] text-center text-zinc-300 font-bold uppercase py-0.5">
                      Base
                    </span>
                  )}
                </div>

                {/* Layer Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-[#a3e635]' : 'text-zinc-200'}`}>
                      {layer.name}
                    </span>
                    <span className="text-[10px] text-[#a3e635] font-mono font-black">
                      v{layer.version}.0
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                      Z: {layer.zIndex}
                    </span>
                    <span className="text-[9px] text-zinc-400 truncate">
                      {Math.round(layer.width || 0)}×{Math.round(layer.height || 0)}
                    </span>
                  </div>
                </div>

                {/* Layer Quick Toggles */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleToggleVisibility(layer, e)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      layer.visible ? 'text-zinc-400 hover:text-white' : 'text-[#a3e635] bg-lime-500/10'
                    }`}
                    title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                  >
                    {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={(e) => handleToggleLock(layer, e)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      layer.locked ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-500 hover:text-white'
                    }`}
                    title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                  >
                    {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Action Toolbar on Selected */}
              {isSelected && (
                <div className="mt-2.5 pt-2 border-t border-lime-500/20 flex items-center justify-between animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => onOpenReCreate(layer)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#a3e635] hover:bg-[#bef264] text-[#0d0e10] text-[11px] font-black shadow-sm transition-all"
                  >
                    <Sparkles className="w-3 h-3 text-[#0d0e10]" />
                    Re-Create 2K
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDownloadSinglePng(layer, e)}
                      title="Download Layer PNG"
                      className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDuplicateLayer(layer.id)}
                      title="Duplicate Layer"
                      className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {!layer.isBackground && (
                      <button
                        onClick={() => onDeleteLayer(layer.id)}
                        title="Delete Layer"
                        className="p-1 rounded-md hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
