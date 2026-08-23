'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LayersProject, CanvasLayerItem } from '@/lib/types';
import { 
  ZoomIn, 
  ZoomOut, 
  MousePointer, 
  Hand, 
  FolderDown, 
  Image as ImageIcon,
  Sparkles,
  Undo2,
  Redo2,
  FileArchive,
  ChevronLeft,
  Sliders,
  Sun,
  Moon,
  X,
  Layers,
  Move
} from 'lucide-react';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { generateMultiLayerPsdClient } from '@/lib/psd-helper';

interface LayersCanvasWorkspaceProps {
  project: LayersProject;
  onBackToHub: () => void;
  onSaveProject: (updatedProject: LayersProject) => void;
  onOpenReCreate: (layer: CanvasLayerItem) => void;
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string | null) => void;
  onUpdateLayer: (updatedLayer: CanvasLayerItem) => void;
}

type TransformHandleType = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot';

export const LayersCanvasWorkspace: React.FC<LayersCanvasWorkspaceProps> = ({
  project,
  onBackToHub,
  onSaveProject,
  onOpenReCreate,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
}) => {
  // Canvas Viewport State (Zoom & Pan)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<'select' | 'hand'>('select');

  // Canvas Theme: 'dark' (Default Obsidian) | 'light' (Clean Studio White)
  const [canvasTheme, setCanvasTheme] = useState<'dark' | 'light'>('dark');

  // Toggle for Floating "Transform & Style" Inspector Panel on Left Toolbar
  const [showInspector, setShowInspector] = useState(true);

  // Photoshop-Style Interactive Free Transform States
  const [transformHandle, setTransformHandle] = useState<TransformHandleType | null>(null);
  const [transformStart, setTransformStart] = useState<{
    mouseX: number;
    mouseY: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    aspectRatio: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  const layers = Array.isArray(project?.layers) ? project.layers : [];

  // Clipboard for copy & paste
  const [clipboardLayer, setClipboardLayer] = useState<CanvasLayerItem | null>(null);

  // Undo / Redo Stack
  const [history, setHistory] = useState<CanvasLayerItem[][]>([layers]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cWidth = project.canvas_width || 1200;
  const cHeight = project.canvas_height || 1200;

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  // Center Canvas on Initial Load
  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      const fitZoom = Math.min((clientWidth - 120) / cWidth, (clientHeight - 120) / cHeight, 1);
      setZoom(Math.max(0.2, fitZoom));
      setPan({
        x: (clientWidth - cWidth * fitZoom) / 2,
        y: (clientHeight - cHeight * fitZoom) / 2,
      });
    }
  }, [cWidth, cHeight]);

  // NATIVE NON-PASSIVE WHEEL LISTENER (PREVENTS BROWSER ZOOM COMPLETELY)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        // Figma-style Zoom centered at cursor
        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom(prevZoom => {
          const newZoom = Math.max(0.15, Math.min(4.0, prevZoom * zoomFactor));
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          setPan(prevPan => ({
            x: mouseX - (mouseX - prevPan.x) * (newZoom / prevZoom),
            y: mouseY - (mouseY - prevPan.y) * (newZoom / prevZoom),
          }));
          return newZoom;
        });
      } else {
        const dx = e.shiftKey ? -e.deltaY : -e.deltaX;
        const dy = e.shiftKey ? 0 : -e.deltaY;
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }
    };

    container.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onNativeWheel);
    };
  }, []);

  const pushHistory = useCallback((newLayers: CanvasLayerItem[]) => {
    setHistory(prev => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, newLayers];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      const prevLayers = history[newIdx];
      onSaveProject({ ...project, layers: prevLayers });
      toast.success('Undo', { id: 'undo', duration: 800 });
    }
  }, [history, historyIndex, project, onSaveProject]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      const nextLayers = history[newIdx];
      onSaveProject({ ...project, layers: nextLayers });
      toast.success('Redo', { id: 'redo', duration: 800 });
    }
  }, [history, historyIndex, project, onSaveProject]);

  // Keyboard Shortcuts (Figma / Photoshop standards)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space' && !e.repeat && activeTool !== 'hand') {
        setActiveTool('hand');
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedLayer) {
        setClipboardLayer(selectedLayer);
        toast.success(`Copied ${selectedLayer.name}`, { id: 'copied' });
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboardLayer) {
        e.preventDefault();
        const newLayer: CanvasLayerItem = {
          ...clipboardLayer,
          id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: `${clipboardLayer.name} (Copy)`,
          x: clipboardLayer.x + 24,
          y: clipboardLayer.y + 24,
          zIndex: layers.length,
          isBackground: false,
        };
        const updated = [...layers, newLayer];
        onSaveProject({ ...project, layers: updated });
        pushHistory(updated);
        onSelectLayer(newLayer.id);
        toast.success('Layer pasted');
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedLayer) {
        e.preventDefault();
        const newLayer: CanvasLayerItem = {
          ...selectedLayer,
          id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: `${selectedLayer.name} (Copy)`,
          x: selectedLayer.x + 20,
          y: selectedLayer.y + 20,
          zIndex: layers.length,
          isBackground: false,
        };
        const updated = [...layers, newLayer];
        onSaveProject({ ...project, layers: updated });
        pushHistory(updated);
        onSelectLayer(newLayer.id);
        toast.success('Layer duplicated');
      }

      if (selectedLayer && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

        const updated = layers.map(l => l.id === selectedLayer.id ? { ...l, x: l.x + dx, y: l.y + dy } : l);
        onSaveProject({ ...project, layers: updated });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && activeTool === 'hand') {
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedLayer, clipboardLayer, layers, project, activeTool, handleUndo, handleRedo, pushHistory, onSaveProject, onSelectLayer]);

  // Start Photoshop-Style Interactive Transform
  const handleStartTransform = (handle: TransformHandleType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedLayer || selectedLayer.locked || activeTool === 'hand') return;

    const lw = selectedLayer.width || cWidth;
    const lh = selectedLayer.height || cHeight;
    const lx = selectedLayer.x;
    const ly = selectedLayer.y;
    const rot = selectedLayer.rotation || 0;

    setTransformHandle(handle);
    setTransformStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      x: lx,
      y: ly,
      width: lw,
      height: lh,
      rotation: rot,
      aspectRatio: lw / (lh || 1),
      centerX: lx + lw / 2,
      centerY: ly + lh / 2,
    });
  };

  // Mouse Down for Pan or Direct Canvas Layer Click
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === 'hand' || e.button === 1) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // If clicking on canvas on select tool, check which layer was clicked
    if (containerRef.current && activeTool === 'select' && !transformHandle) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;

      // Check non-background layers from topmost z-index to lowest
      const sorted = [...layers]
        .filter(l => l.visible && !l.isBackground)
        .sort((a, b) => b.zIndex - a.zIndex);

      for (const l of sorted) {
        const lw = l.width || cWidth;
        const lh = l.height || cHeight;
        const lLeft = l.x;
        const lTop = l.y;
        const lRight = lLeft + lw;
        const lBottom = lTop + lh;

        if (mouseCanvasX >= lLeft && mouseCanvasX <= lRight && mouseCanvasY >= lTop && mouseCanvasY <= lBottom) {
          onSelectLayer(l.id);
          if (!l.locked) {
            handleStartTransform('move', e);
          }
          return;
        }
      }
    }
  };

  // Mouse Move: Apply Free Transform / Resize / Rotate / Pan
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
      return;
    }

    if (!transformHandle || !transformStart || !selectedLayer || selectedLayer.locked) {
      return;
    }

    const dx = (e.clientX - transformStart.mouseX) / zoom;
    const dy = (e.clientY - transformStart.mouseY) / zoom;
    const { x: origX, y: origY, width: origW, height: origH, aspectRatio, centerX, centerY, rotation: origRot } = transformStart;

    let newX = origX;
    let newY = origY;
    let newW = origW;
    let newH = origH;
    let newRot = origRot;

    // 1. Move Layer
    if (transformHandle === 'move') {
      newX = Math.round(origX + dx);
      newY = Math.round(origY + dy);
    }
    // 2. Rotate Layer
    else if (transformHandle === 'rot') {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const curMouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
        const curMouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;
        const angleRad = Math.atan2(curMouseCanvasY - centerY, curMouseCanvasX - centerX);
        let deg = Math.round((angleRad * 180) / Math.PI) + 90;
        if (e.shiftKey) {
          deg = Math.round(deg / 15) * 15; // 15-degree increments with Shift
        }
        newRot = deg;
      }
    }
    // 3. Corner & Edge Resize Handles (Photoshop Style)
    else {
      const isShift = e.shiftKey; // Hold shift for free stretch, default maintains aspect ratio

      switch (transformHandle) {
        case 'se': // Bottom-Right Handle
          newW = Math.max(20, origW + dx);
          newH = !isShift ? newW / aspectRatio : Math.max(20, origH + dy);
          break;

        case 'nw': // Top-Left Handle
          newW = Math.max(20, origW - dx);
          newH = !isShift ? newW / aspectRatio : Math.max(20, origH - dy);
          newX = origX + (origW - newW);
          newY = origY + (origH - newH);
          break;

        case 'ne': // Top-Right Handle
          newW = Math.max(20, origW + dx);
          newH = !isShift ? newW / aspectRatio : Math.max(20, origH - dy);
          newY = origY + (origH - newH);
          break;

        case 'sw': // Bottom-Left Handle
          newW = Math.max(20, origW - dx);
          newH = !isShift ? newW / aspectRatio : Math.max(20, origH + dy);
          newX = origX + (origW - newW);
          break;

        case 'e': // Right Middle Handle
          newW = Math.max(20, origW + dx);
          break;

        case 'w': // Left Middle Handle
          newW = Math.max(20, origW - dx);
          newX = origX + (origW - newW);
          break;

        case 's': // Bottom Middle Handle
          newH = Math.max(20, origH + dy);
          break;

        case 'n': // Top Middle Handle
          newH = Math.max(20, origH - dy);
          newY = origY + (origH - newH);
          break;
      }
    }

    const updated = layers.map(l => 
      l.id === selectedLayer.id ? { 
        ...l, 
        x: Math.round(newX), 
        y: Math.round(newY), 
        width: Math.round(newW), 
        height: Math.round(newH),
        rotation: newRot
      } : l
    );
    onSaveProject({ ...project, layers: updated });
  };

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);
    if (transformHandle) {
      setTransformHandle(null);
      setTransformStart(null);
      pushHistory(layers);
    }
  };

  // Export Native Photoshop PSD
  const handleExportPsd = async () => {
    try {
      toast.loading('Compiling multi-layer PSD file...', { id: 'psd' });
      const blob = await generateMultiLayerPsdClient(
        layers,
        cWidth,
        cHeight
      );
      saveAs(blob, `${project.name.toLowerCase().replace(/\s+/g, '_')}_layers.psd`);
      toast.success('Photoshop .PSD exported successfully!', { id: 'psd' });
    } catch (err: any) {
      console.error('[Export PSD error]', err);
      toast.error('Failed to export PSD', { id: 'psd' });
    }
  };

  // Export Layered ZIP
  const handleExportZip = async () => {
    try {
      toast.loading('Archiving transparent layer package...', { id: 'zip' });
      const zip = new JSZip();
      const folder = zip.folder('layers');

      for (let i = 0; i < layers.length; i++) {
        const l = layers[i];
        if (!l.currentUrl) continue;
        try {
          const res = await fetch(l.currentUrl);
          const blob = await res.blob();
          const ext = l.isBackground ? 'jpg' : 'png';
          folder?.file(`${i}_${l.name.toLowerCase().replace(/\s+/g, '_')}_v${l.version}.${ext}`, blob);
        } catch (e) {
          console.warn('Failed to fetch layer for zip:', l.name);
        }
      }

      zip.file('manifest.json', JSON.stringify(project, null, 2));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${project.name.toLowerCase().replace(/\s+/g, '_')}_layers.zip`);
      toast.success('Layered ZIP package downloaded!', { id: 'zip' });
    } catch (err: any) {
      toast.error('Failed to create ZIP package', { id: 'zip' });
    }
  };

  // Export Merged PNG
  const handleExportMergedPng = () => {
    try {
      const c = document.createElement('canvas');
      c.width = cWidth;
      c.height = cHeight;
      const ctx = c.getContext('2d');
      if (!ctx) return;

      const sorted = [...layers].filter(l => l.visible).sort((a, b) => a.zIndex - b.zIndex);
      let loaded = 0;

      sorted.forEach(l => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = l.currentUrl;
        img.onload = () => {
          ctx.save();
          ctx.globalAlpha = l.opacity ?? 1;
          const lw = l.width || cWidth;
          const lh = l.height || cHeight;

          // Apply rotation transform around center if rotated
          if (l.rotation) {
            ctx.translate(l.x + lw / 2, l.y + lh / 2);
            ctx.rotate((l.rotation * Math.PI) / 180);
            ctx.drawImage(img, -lw / 2, -lh / 2, lw, lh);
          } else {
            ctx.drawImage(img, l.x, l.y, lw, lh);
          }
          ctx.restore();

          loaded++;
          if (loaded === sorted.length) {
            c.toBlob(blob => {
              if (blob) {
                saveAs(blob, `${project.name.toLowerCase().replace(/\s+/g, '_')}_merged.png`);
                toast.success('Merged PNG exported!');
              }
            }, 'image/png');
          }
        };
      });
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const isLight = canvasTheme === 'light';

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] select-none">
      {/* Top Application Bar */}
      <header className="h-14 border-b border-zinc-800 bg-[#0d0e10] px-4 flex items-center justify-between z-20 flex-shrink-0">
        {/* Left: Project Info & Back to Hub */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHub}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold transition-all shadow-sm"
          >
            <ChevronLeft className="w-4 h-4 text-[#a3e635]" />
            Hub
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black text-white">{project.name}</h2>
              <span className="px-2 py-0.2 rounded-full bg-lime-500/20 text-[10px] text-[#a3e635] font-mono font-bold">
                v{project.revision_count}.0
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                [{cWidth} × {cHeight}px]
              </span>
            </div>
            <p className="text-[9px] text-[#a3e635] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635] inline-block animate-pulse" />
              Auto-saved to Cloud & Database
            </p>
          </div>
        </div>

        {/* Center: History & Zoom Viewport Controls */}
        <div className="flex items-center gap-1 bg-[#15171c] border border-zinc-800 rounded-xl p-1">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-px bg-zinc-800 mx-1" />
          <button
            onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
            title="Zoom Out (Ctrl+Scroll Down)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono font-bold text-[#a3e635] w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(3.5, prev + 0.1))}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
            title="Zoom In (Ctrl+Scroll Up)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Export Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMergedPng}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Merged PNG
          </button>

          <button
            onClick={handleExportZip}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition-colors"
          >
            <FileArchive className="w-3.5 h-3.5 text-[#a3e635]" />
            Layered ZIP
          </button>

          <button
            onClick={handleExportPsd}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#a3e635] hover:bg-[#bef264] text-[#0d0e10] text-xs font-black shadow-lg shadow-[#a3e635]/25 transition-all"
          >
            <FolderDown className="w-4 h-4" />
            Export Native PSD
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Floating Toolbar */}
        <div className="absolute left-4 top-4 z-20 flex flex-col gap-1.5 p-1.5 rounded-2xl bg-[#0d0e10]/95 border border-zinc-800/90 shadow-2xl backdrop-blur-md">
          {/* Select Tool */}
          <button
            onClick={() => setActiveTool('select')}
            className={`p-2.5 rounded-xl transition-all ${
              activeTool === 'select' ? 'bg-[#a3e635] text-[#0d0e10] font-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Select & Move Tool (V)"
          >
            <MousePointer className="w-4 h-4" />
          </button>

          {/* Hand Tool */}
          <button
            onClick={() => setActiveTool('hand')}
            className={`p-2.5 rounded-xl transition-all ${
              activeTool === 'hand' ? 'bg-[#a3e635] text-[#0d0e10] font-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Hand & Pan Tool (Spacebar + Drag)"
          >
            <Hand className="w-4 h-4" />
          </button>

          <div className="h-px w-full bg-zinc-800 my-0.5" />

          {/* Transform & Style Inspector Panel Toggle */}
          <button
            onClick={() => setShowInspector(prev => !prev)}
            className={`p-2.5 rounded-xl transition-all ${
              showInspector ? 'bg-zinc-800 text-[#a3e635] border border-[#a3e635]/40' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Toggle Transform & Style Inspector Panel"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Canvas Light/Dark Theme Switcher */}
          <button
            onClick={() => setCanvasTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            title={canvasTheme === 'dark' ? "Switch to Studio Light Canvas" : "Switch to Studio Dark Canvas"}
          >
            {canvasTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-[#a3e635]" />
            )}
          </button>

          {selectedLayer && (
            <>
              <div className="h-px w-full bg-zinc-800 my-0.5" />
              <button
                onClick={() => onOpenReCreate(selectedLayer)}
                className="p-2.5 rounded-xl bg-lime-500/20 text-[#a3e635] hover:bg-[#a3e635] hover:text-[#0d0e10] transition-all animate-pulse"
                title="Re-Create Layer with 2K AI"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* FLOATING TRANSFORM & STYLE INSPECTOR PANEL ON LEFT */}
        {showInspector && selectedLayer && (
          <div className="absolute left-20 top-4 z-20 w-64 bg-[#0d0e10]/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-4 space-y-3.5 animate-in fade-in slide-in-from-left-2 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#a3e635]" />
                <h4 className="text-xs font-black text-white">Transform & Style</h4>
              </div>
              <button
                onClick={() => setShowInspector(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-zinc-800"
                title="Hide Inspector"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[11px] font-bold text-zinc-300 truncate">
              {selectedLayer.name}
            </div>

            {/* Position & Size Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="px-2.5 py-1.5 rounded-xl bg-[#15171c] border border-zinc-800/90 text-zinc-300 flex justify-between items-center">
                <span className="text-zinc-500 font-sans font-bold text-[10px]">X</span>
                <span>{Math.round(selectedLayer.x)}px</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-[#15171c] border border-zinc-800/90 text-zinc-300 flex justify-between items-center">
                <span className="text-zinc-500 font-sans font-bold text-[10px]">Y</span>
                <span>{Math.round(selectedLayer.y)}px</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-[#15171c] border border-zinc-800/90 text-zinc-300 flex justify-between items-center">
                <span className="text-zinc-500 font-sans font-bold text-[10px]">W</span>
                <span>{Math.round(selectedLayer.width || 0)}px</span>
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-[#15171c] border border-zinc-800/90 text-zinc-300 flex justify-between items-center">
                <span className="text-zinc-500 font-sans font-bold text-[10px]">H</span>
                <span>{Math.round(selectedLayer.height || 0)}px</span>
              </div>
            </div>

            {/* Rotation Angle */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Rotation:</span>
              <span className="font-mono text-[#a3e635] font-bold">{Math.round(selectedLayer.rotation || 0)}°</span>
            </div>

            {/* Opacity Slider */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Opacity:</span>
                <span className="font-mono text-zinc-200 font-bold">{Math.round((selectedLayer.opacity ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedLayer.opacity ?? 1}
                onChange={(e) => onUpdateLayer({ ...selectedLayer, opacity: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#a3e635]"
              />
            </div>

            {/* Blend Mode Selector */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/80">
              <span className="text-[11px] text-zinc-400">Blend Mode:</span>
              <select
                value={selectedLayer.blendMode || 'normal'}
                onChange={(e) => onUpdateLayer({ ...selectedLayer, blendMode: e.target.value as any })}
                className="px-2.5 py-1 rounded-lg bg-[#15171c] border border-zinc-800 text-white text-xs outline-none focus:border-[#a3e635]"
              >
                <option value="normal">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
                <option value="soft-light">Soft Light</option>
              </select>
            </div>
          </div>
        )}

        {/* Viewport & Canvas Area */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`flex-1 h-full overflow-hidden relative cursor-${
            activeTool === 'hand' || isPanning 
              ? 'grab' 
              : transformHandle === 'rot' 
                ? 'crosshair' 
                : transformHandle === 'move'
                  ? 'move'
                  : 'default'
          } ${isLight ? 'bg-[#f1f5f9]' : 'bg-[#080808]'} transition-colors duration-200`}
          style={{
            backgroundImage: isLight
              ? 'radial-gradient(circle, rgba(0,0,0,0.14) 1px, transparent 1px)'
              : 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Transformed Canvas Container */}
          <div
            ref={canvasRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: `${cWidth}px`,
              height: `${cHeight}px`,
            }}
            className="absolute shadow-2xl transition-transform duration-75 select-none"
          >
            {/* Checkered Alpha Background Pattern */}
            <div 
              className={`absolute inset-0 rounded-lg overflow-hidden border ${
                isLight ? 'border-slate-300 shadow-2xl' : 'border-zinc-800'
              }`}
              style={{
                backgroundImage: isLight
                  ? 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)'
                  : 'linear-gradient(45deg, #121316 25%, transparent 25%), linear-gradient(-45deg, #121316 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #121316 75%), linear-gradient(-45deg, transparent 75%, #121316 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                backgroundColor: isLight ? '#ffffff' : '#0a0b0d',
              }}
            >
              {/* Layers Stack Rendering (Sorted by zIndex ascending) */}
              {[...layers]
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(layer => {
                  if (!layer.visible) return null;

                  const lw = layer.width || cWidth;
                  const lh = layer.height || cHeight;

                  return (
                    <div
                      key={layer.id}
                      style={{
                        position: 'absolute',
                        left: `${layer.x}px`,
                        top: `${layer.y}px`,
                        width: `${lw}px`,
                        height: `${lh}px`,
                        opacity: layer.opacity ?? 1,
                        mixBlendMode: layer.blendMode || 'normal',
                        zIndex: layer.zIndex,
                        transform: `rotate(${layer.rotation || 0}deg)`,
                        transformOrigin: 'center center',
                        pointerEvents: 'none',
                      }}
                    >
                      <img
                        src={layer.currentUrl}
                        alt={layer.name}
                        draggable={false}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </div>
                  );
                })}

              {/* PHOTOSHOP-STYLE FREE TRANSFORM GIZMO FOR SELECTED LAYER */}
              {selectedLayer && !selectedLayer.locked && (
                <div
                  onMouseDown={(e) => handleStartTransform('move', e)}
                  style={{
                    position: 'absolute',
                    left: `${selectedLayer.x}px`,
                    top: `${selectedLayer.y}px`,
                    width: `${selectedLayer.width || cWidth}px`,
                    height: `${selectedLayer.height || cHeight}px`,
                    transform: `rotate(${selectedLayer.rotation || 0}deg)`,
                    transformOrigin: 'center center',
                    zIndex: 9999,
                    pointerEvents: 'auto',
                  }}
                  className="ring-2 ring-[#a3e635] shadow-2xl cursor-move select-none animate-in fade-in duration-100"
                >
                  {/* Floating Action Chip on Top */}
                  <div 
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d0e10]/95 border border-[#a3e635]/60 shadow-xl backdrop-blur-md whitespace-nowrap pointer-events-auto"
                  >
                    <span className="text-[11px] font-black text-white">{selectedLayer.name}</span>
                    <span className="text-[9px] text-[#a3e635] font-mono">
                      {Math.round(selectedLayer.width || 0)}×{Math.round(selectedLayer.height || 0)}
                    </span>
                    <button
                      onClick={() => onOpenReCreate(selectedLayer)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#a3e635] hover:bg-[#bef264] text-[#0d0e10] text-[10px] font-black shadow-sm ml-1 transition-all"
                    >
                      <Sparkles className="w-3 h-3 text-[#0d0e10]" />
                      Re-Create
                    </button>
                  </div>

                  {/* Rotation Lollipop Handle Stem & Knob (Photoshop Style) */}
                  <div
                    onMouseDown={(e) => handleStartTransform('rot', e)}
                    className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-crosshair group/rot z-10"
                    title="Rotate Layer (Drag to rotate, Shift for 15° snap)"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-[#a3e635] border-2 border-[#0d0e10] shadow-md group-hover/rot:scale-125 transition-transform" />
                    <div className="w-0.5 h-4 bg-[#a3e635]" />
                  </div>

                  {/* 8-Point Interactive Corner & Edge Resize Handles */}
                  {/* Top-Left */}
                  <div
                    onMouseDown={(e) => handleStartTransform('nw', e)}
                    className="absolute -top-2 -left-2 w-3.5 h-3.5 rounded-sm bg-[#a3e635] border-2 border-[#0d0e10] shadow-sm cursor-nwse-resize hover:scale-125 transition-transform"
                    title="Resize Top-Left"
                  />
                  {/* Top-Center */}
                  <div
                    onMouseDown={(e) => handleStartTransform('n', e)}
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-sm bg-[#a3e635] border-2 border-[#0d0e10] shadow-sm cursor-ns-resize hover:scale-125 transition-transform"
                    title="Resize Top"
                  />
                  {/* Top-Right */}
                  <div
                    onMouseDown={(e) => handleStartTransform('ne', e)}
                    className="absolute -top-2 -right-2 w-3.5 h-3.5 rounded-sm bg-[#a3e635] border-2 border-[#0d0e10] shadow-sm cursor-nesw-resize hover:scale-125 transition-transform"
                    title="Resize Top-Right"
                  />
                  {/* Middle-Right */}
                  <div
                    onMouseDown={(e) => handleStartTransform('e', e)}
                    className="absolute top-1/2 -right-2 -translate-y-1/2 w-3.5 h-3.5 rounded-sm bg-[#a3e635] border-2 border-[#0d0e10] shadow-sm cursor-ew-resize hover:scale-125 transition-transform"
                    title="Resize Right"
                  />
                  {/* Bottom-Right */}
                  <div
                    onMouseDown={(e) => handleStartTransform('se', e)}
                    className="absolute -bottom-2 -right-2 w-3.5 h-3.5 rounded-sm bg-[#a3e635] border-2 border-[#0d0e10] shadow-sm cursor-nwse-resize hover:scale-125 transition-transform"
                    title="Resize Bottom-Right"
                  />
                  {/* Bottom-Center */}
                  <div
                    onMouseDown={(e) => handleStartTransform('s', e)}
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-sm bg-[#a3e635] border-2 border-[#0d0e10] shadow-sm cursor-ns-resize hover:scale-125 transition-transform"
                    title="Resize Bottom"
                  />
                  {/* Bottom-Left */}
                  <div
                    onMouseDown={(e) => handleStartTransform('sw', e)}
                    className="absolute -bottom-2 -left-2 w-3.5 h-3.5 rounded-sm bg-[#a3e635] border-2 border-[#0d0e10] shadow-sm cursor-nesw-resize hover:scale-125 transition-transform"
                    title="Resize Bottom-Left"
                  />
                  {/* Middle-Left */}
                  <div
                    onMouseDown={(e) => handleStartTransform('w', e)}
                    className="absolute top-1/2 -left-2 -translate-y-1/2 w-3.5 h-3.5 rounded-sm bg-[#a3e635] border-2 border-[#0d0e10] shadow-sm cursor-ew-resize hover:scale-125 transition-transform"
                    title="Resize Left"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
