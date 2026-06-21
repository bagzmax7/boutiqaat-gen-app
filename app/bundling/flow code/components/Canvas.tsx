import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Product } from '../types';

interface CanvasProps {
    products: Product[];
    pxPerCm: number;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onUpdateProduct: (id: string, updates: Partial<Product>) => void;
    backgroundBase64?: string;
    canvasRef: React.RefObject<HTMLDivElement>;
    isLoading?: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({
    products,
    pxPerCm,
    selectedId,
    onSelect,
    onUpdateProduct,
    backgroundBase64,
    canvasRef,
    isLoading
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1.0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const startPanRef = useRef({ x: 0, y: 0 });
    const dragRectRef = useRef<DOMRect | null>(null);

    // Zoom on wheel (Ctrl + Wheel)
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const zoomFactor = 0.05;
                setZoom(prev => {
                    const newZoom = e.deltaY < 0 ? prev + zoomFactor : prev - zoomFactor;
                    return parseFloat(Math.max(0.25, Math.min(4, newZoom)).toFixed(2));
                });
            }
        };
        const canvasEl = canvasRef.current;
        if (canvasEl) {
            canvasEl.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (canvasEl) {
                canvasEl.removeEventListener('wheel', handleWheel);
            }
        };
    }, [canvasRef]);

    const handleBgPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).id === 'grid-overlay') {
            setIsPanning(true);
            startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
    };

    const handleBgPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isPanning) {
            setPan({
                x: e.clientX - startPanRef.current.x,
                y: e.clientY - startPanRef.current.y
            });
        }
    };

    const handleBgPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isPanning) {
            setIsPanning(false);
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
    };

    const handleCornerResize = (e: React.PointerEvent<HTMLDivElement>, p: Product, corner: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        // Calculate product center in screen coordinates once at gesture start to avoid layout thrashing
        const screenCenterX = rect.left + p.x * zoom;
        const screenCenterY = rect.top + p.y * zoom;
        
        const initialDist = Math.sqrt((e.clientX - screenCenterX) ** 2 + (e.clientY - screenCenterY) ** 2);
        const initialScale = p.scale;
        
        const handlePointerMove = (moveEvent: PointerEvent) => {
            const currentDist = Math.sqrt((moveEvent.clientX - screenCenterX) ** 2 + (moveEvent.clientY - screenCenterY) ** 2);
            const newScale = initialScale * (currentDist / (initialDist || 1));
            onUpdateProduct(p.id, { scale: parseFloat(Math.max(0.1, Math.min(4, newScale)).toFixed(2)) });
        };
        
        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
        
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    const handleRotateStart = (e: React.PointerEvent<HTMLDivElement>, p: Product) => {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        // Calculate product center in screen coordinates once at gesture start to avoid layout thrashing
        const screenCenterX = rect.left + p.x * zoom;
        const screenCenterY = rect.top + p.y * zoom;
        
        const initialAngleRad = Math.atan2(e.clientY - screenCenterY, e.clientX - screenCenterX);
        const initialAngleDeg = (initialAngleRad * 180) / Math.PI;
        const initialRotation = p.rotation;
        
        const handlePointerMove = (moveEvent: PointerEvent) => {
            const currentAngleRad = Math.atan2(moveEvent.clientY - screenCenterY, moveEvent.clientX - screenCenterX);
            const currentAngleDeg = (currentAngleRad * 180) / Math.PI;
            
            let newRotation = initialRotation + (currentAngleDeg - initialAngleDeg);
            newRotation = ((newRotation + 180) % 360) - 180;
            if (newRotation < -180) newRotation += 360;
            
            onUpdateProduct(p.id, { rotation: Math.round(newRotation) });
        };
        
        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
        
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    const cursorClass = isPanning ? 'cursor-grabbing' : 'cursor-crosshair';

    return (
        <div
            ref={canvasRef}
            onPointerDown={handleBgPointerDown}
            onPointerMove={handleBgPointerMove}
            onPointerUp={handleBgPointerUp}
            className={`relative flex-1 h-full bg-[#111] overflow-hidden flex items-center justify-center group ${cursorClass}`}
            onClick={() => onSelect(null)}
        >
            {/* Zoom Controls Overlay */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/60 border border-white/10 backdrop-blur-md rounded-xl p-1.5 shadow-2xl">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setZoom(prev => Math.max(0.25, parseFloat((prev - 0.25).toFixed(2))));
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white/80 active:scale-95"
                    title="Zoom Out"
                >
                    <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setZoom(1.0);
                        setPan({ x: 0, y: 0 });
                    }}
                    className="px-2 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-[10px] font-bold text-white/85"
                    title="Reset Zoom & Pan"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setZoom(prev => Math.min(4.0, parseFloat((prev + 0.25).toFixed(2))));
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors text-white/80 active:scale-95"
                    title="Zoom In"
                >
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
            </div>

            {/* Loading Blur Overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-30 flex items-center justify-center transition-all duration-300 animate-fade-in">
                    <div className="flex flex-col items-center gap-4 text-center p-6">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent-gold animate-spin" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <h3 className="text-sm font-bold text-white tracking-wide">Generating AI Studio Scene</h3>
                            <p className="text-[10px] text-white/40 max-w-[220px]">Aligning proportions, lighting, and reflections per studio guidelines...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Zoomable & Pannable Workspace Container */}
            <div 
                ref={containerRef}
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden'
                }}
                className="transition-transform duration-75 ease-out"
            >
                {/* Background Layer */}
                {backgroundBase64 && (
                    <img
                        src={backgroundBase64}
                        className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none"
                        alt="Background"
                    />
                )}

                {/* Grid Overlay */}
                <div id="grid-overlay" className="absolute inset-0 pointer-events-none opacity-5"
                    style={{
                        backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
                        backgroundSize: `${pxPerCm}px ${pxPerCm}px`
                    }}
                />

                {/* Product Layers */}
                {products.map((p) => {
                    const displayHeight = p.heightCm * pxPerCm * p.scale;

                    return (
                        <motion.div
                            key={p.id}
                            drag
                            dragMomentum={false}
                            onDragStart={() => {
                                onSelect(p.id);
                                dragRectRef.current = containerRef.current?.getBoundingClientRect() || null;
                            }}
                            onDrag={(e, info) => {
                                const rect = dragRectRef.current;
                                if (rect) {
                                    onUpdateProduct(p.id, {
                                        x: (info.point.x - rect.left) / zoom,
                                        y: (info.point.y - rect.top) / zoom
                                    });
                                }
                            }}
                            style={{
                                position: 'absolute',
                                left: p.x,
                                top: p.y,
                                rotate: p.rotation,
                                zIndex: p.zIndex,
                                height: displayHeight,
                                x: '-50%',
                                y: '-50%'
                            }}
                            className={`cursor-grab active:cursor-grabbing flex items-center justify-center ${
                                selectedId === p.id ? 'outline outline-[1.5px] outline-accent-gold rounded-sm' : ''
                            }`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(p.id);
                            }}
                        >
                            <img
                                src={`data:${p.mimeType};base64,${p.base64}`}
                                alt={p.name}
                                className="h-full w-auto object-contain pointer-events-none select-none"
                                draggable={false}
                            />

                            {/* Selection Handles Overlay */}
                            {selectedId === p.id && (
                                <>
                                    {/* Rotation Stem & Handle */}
                                    <div 
                                        className="absolute w-[1px] bg-accent-gold pointer-events-none"
                                        style={{
                                            top: 0,
                                            left: '50%',
                                            height: '20px',
                                            transform: 'translate(-50%, -100%)'
                                        }}
                                    />
                                    <div 
                                        onPointerDown={(e) => handleRotateStart(e, p)}
                                        className="absolute w-4 h-4 bg-accent-gold border-2 border-white rounded-full cursor-alias flex items-center justify-center shadow-lg hover:scale-115 active:scale-95 transition-transform"
                                        style={{
                                            top: '-20px',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            zIndex: 10
                                        }}
                                        title="Rotate Product"
                                    >
                                        <span className="material-symbols-outlined text-[10px] text-black font-extrabold select-none pointer-events-none">sync</span>
                                    </div>

                                    {/* Corner Resize Handles */}
                                    {/* Top Left */}
                                    <div 
                                        onPointerDown={(e) => handleCornerResize(e, p, 'tl')}
                                        className="absolute w-2.5 h-2.5 bg-white border border-accent-gold rounded-full cursor-nwse-resize shadow-md hover:scale-120 active:scale-90 transition-transform"
                                        style={{
                                            top: 0,
                                            left: 0,
                                            transform: 'translate(-50%, -50%)',
                                            zIndex: 10
                                        }}
                                    />
                                    {/* Top Right */}
                                    <div 
                                        onPointerDown={(e) => handleCornerResize(e, p, 'tr')}
                                        className="absolute w-2.5 h-2.5 bg-white border border-accent-gold rounded-full cursor-nesw-resize shadow-md hover:scale-120 active:scale-90 transition-transform"
                                        style={{
                                            top: 0,
                                            right: 0,
                                            transform: 'translate(50%, -50%)',
                                            zIndex: 10
                                        }}
                                    />
                                    {/* Bottom Left */}
                                    <div 
                                        onPointerDown={(e) => handleCornerResize(e, p, 'bl')}
                                        className="absolute w-2.5 h-2.5 bg-white border border-accent-gold rounded-full cursor-nesw-resize shadow-md hover:scale-120 active:scale-90 transition-transform"
                                        style={{
                                            bottom: 0,
                                            left: 0,
                                            transform: 'translate(-50%, 50%)',
                                            zIndex: 10
                                        }}
                                    />
                                    {/* Bottom Right */}
                                    <div 
                                        onPointerDown={(e) => handleCornerResize(e, p, 'br')}
                                        className="absolute w-2.5 h-2.5 bg-white border border-accent-gold rounded-full cursor-nwse-resize shadow-md hover:scale-120 active:scale-90 transition-transform"
                                        style={{
                                            bottom: 0,
                                            right: 0,
                                            transform: 'translate(50%, 50%)',
                                            zIndex: 10
                                        }}
                                    />
                                </>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-[10px] text-white/40 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                Arrangement Mode • Drag background to Pan • Use scroll wheel with Ctrl to Zoom
            </div>
        </div>
    );
};