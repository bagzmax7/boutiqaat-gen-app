import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Flow, USE_RUNNINGHUB_API } from '../flow-sdk';
import { Product, Category, GeneratedResult } from './types';
import { CATEGORIES, DEFAULT_METRICS, INITIAL_PX_PER_CM, lookupLocalCatalog } from './constants';
import {
    SectionLabel,
    PillButton,
    FieldDropdown,
    DragNumberField,
    RangeSlider
} from './components/Primitives';
import { Canvas } from './components/Canvas';
import { ResultsGallery } from './components/ResultsGallery';

const LLM_OPTIONS = ['Gemini 3.5 Flash', 'Qwen 3.6 Plus', 'DeepSeek V4 Flash'];
const LLM_DISPLAY_TO_ID: Record<string, string> = {
    'Gemini 3.5 Flash': 'google/gemini-3.5-flash',
    'Qwen 3.6 Plus': 'qwen/qwen3.6-plus',
    'DeepSeek V4 Flash': 'deepseek/deepseek-v4-flash'
};
const LLM_ID_TO_DISPLAY: Record<string, string> = {
    'google/gemini-3.5-flash': 'Gemini 3.5 Flash',
    'qwen/qwen3.6-plus': 'Qwen 3.6 Plus',
    'deepseek/deepseek-v4-flash': 'DeepSeek V4 Flash'
};

export default function App() {
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [pxPerCm, setPxPerCm] = useState(INITIAL_PX_PER_CM);
    const [loading, setLoading] = useState(false);
    const [downloadState, setDownloadState] = useState<'idle' | 'preparing' | 'done'>('idle');
    const [background, setBackground] = useState<{ base64: string; mimeType: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [genMode, setGenMode] = useState<'Aesthetic' | 'Studio' | 'Creative'>('Studio');
    const [batchCount, setBatchCount] = useState<number>(1);
    const [results, setResults] = useState<GeneratedResult[]>([]);
    const [previewImage, setPreviewImage] = useState<GeneratedResult | null>(null);
    const [historyResults, setHistoryResults] = useState<GeneratedResult[]>([]);

    // Prompt Caching States
    const [cachedPrompt, setCachedPrompt] = useState<string | null>(null);
    const [cachedAnalyses, setCachedAnalyses] = useState<any[]>([]);
    const [cachedProductUrls, setCachedProductUrls] = useState<string[]>([]);
    const [cacheKey, setCacheKey] = useState<string | null>(null);

    // LLM Selection States
    const [selectedLlm, setSelectedLlm] = useState<string>('google/gemini-3.5-flash');

    const canvasRef = useRef<HTMLDivElement>(null);

    const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }, []);

    const autoAnalyzeProducts = async (newProds: Product[]) => {
        for (const prod of newProds) {
            // Step 1: Immediate instant local heuristic preview (instant size response!)
            const resolved = lookupLocalCatalog(prod.name);
            updateProduct(prod.id, {
                name: resolved.name,
                category: resolved.category,
                heightCm: resolved.metrics.heightCm,
                widthCm: resolved.metrics.widthCm,
                lengthCm: resolved.metrics.lengthCm,
                weightG: resolved.metrics.weightG,
                volumeMl: resolved.metrics.volumeMl,
                isAnalyzing: true // processing in background
            });

            // Step 2: Extract SKU pattern (e.g. SC-00010338, TW-00003053, etc.)
            const skuMatch = prod.name.match(/([A-Z0-9]{2,4}-\d+)/i);
            const sku = skuMatch ? skuMatch[1].toUpperCase() : null;

            // Run upload and database lookup concurrently
            const promises: [Promise<any>, Promise<any>] = [
                Flow.upload({ base64: prod.base64, mimeType: prod.mimeType }),
                sku ? fetch(`/api/bundling/catalog?sku=${sku}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null)
            ];

            try {
                const [uploadRes, catalogRes] = await Promise.all(promises);

                const updates: Partial<Product> = {
                    uploadedUrl: uploadRes.mediaId,
                    isAnalyzing: false
                };

                // If found in product team's catalog, override with exact measurements
                if (catalogRes && catalogRes.success && catalogRes.item) {
                    const item = catalogRes.item;
                    console.log(`[autoAnalyze] Found SKU ${sku} in database catalog:`, item);
                    updates.name = item.sku;
                    updates.category = item.category;
                    updates.heightCm = item.heightCm || resolved.metrics.heightCm;
                    updates.widthCm = item.widthCm || resolved.metrics.widthCm;
                    updates.lengthCm = item.lengthCm || resolved.metrics.lengthCm;
                    updates.weightG = item.weightG || resolved.metrics.weightG;
                    updates.volumeMl = item.volumeMl || resolved.metrics.volumeMl;
                } else if (sku) {
                    console.log(`[autoAnalyze] SKU ${sku} not found in database. Sticking to local heuristic.`);
                }

                updateProduct(prod.id, updates);
            } catch (err) {
                console.error(`[autoAnalyze] Background processes failed for ${prod.name}:`, err);
                updateProduct(prod.id, { isAnalyzing: false });
            }
        }
    };

    // Keep Flow SDK updated with current product selection
    useEffect(() => {
        Flow.setProducts(products);
    }, [products]);

    // Keyboard delete listener for selected product
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
                const activeEl = document.activeElement as HTMLElement | null;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
                    return;
                }
                setProducts(prev => prev.filter(p => p.id !== selectedId));
                setSelectedId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedId]);

    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
      input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; cursor: pointer; padding: 8px 0; }
      input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 3px; background: #595959; border-radius: 9999px; }
      input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: white; box-shadow: 0px 1px 3px rgba(0,0,0,0.5); margin-top: -5.5px; cursor: grab; }
      input[type=range]::-webkit-slider-thumb:active { cursor: grabbing; }
      .dark-scrollbar::-webkit-scrollbar { width: 4px; }
      .dark-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      @keyframes dropdown-enter { from { opacity: 0; transform: scale(0.95) translateY(-5px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .animate-dropdown { animation: dropdown-enter 0.15s ease-out forwards; }
    `;
        document.head.appendChild(style);
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setError(null);
        const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
        if (files.length === 0) return;
        await processFiles(files);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length === 0) return;
        await processFiles(files);
    };

    const trimImage = async (base64: string, mimeType: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = `data:${mimeType};base64,${base64}`;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(base64);
                    return;
                }
                ctx.drawImage(img, 0, 0);

                const imgData = ctx.getImageData(0, 0, img.width, img.height);
                const data = imgData.data;

                let minX = img.width;
                let minY = img.height;
                let maxX = 0;
                let maxY = 0;
                let found = false;

                for (let y = 0; y < img.height; y++) {
                    for (let x = 0; x < img.width; x++) {
                        const alpha = data[(y * img.width + x) * 4 + 3];
                        if (alpha > 0) {
                            if (x < minX) minX = x;
                            if (y < minY) minY = y;
                            if (x > maxX) maxX = x;
                            if (y > maxY) maxY = y;
                            found = true;
                        }
                    }
                }

                if (!found) {
                    resolve(base64);
                    return;
                }

                // Small 2px padding buffer to avoid clipping edges
                minX = Math.max(0, minX - 2);
                minY = Math.max(0, minY - 2);
                maxX = Math.min(img.width - 1, maxX + 2);
                maxY = Math.min(img.height - 1, maxY + 2);

                const cropW = maxX - minX + 1;
                const cropH = maxY - minY + 1;

                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropW;
                cropCanvas.height = cropH;
                const cropCtx = cropCanvas.getContext('2d');
                if (!cropCtx) {
                    resolve(base64);
                    return;
                }

                cropCtx.drawImage(
                    img,
                    minX, minY, cropW, cropH,
                    0, 0, cropW, cropH
                );

                const trimmed = cropCanvas.toDataURL(mimeType).split(',')[1];
                resolve(trimmed);
            };
            img.onerror = () => {
                resolve(base64);
            };
        });
    };

    const processFiles = async (files: File[]) => {
        const newProducts: Product[] = [];
        const rect = canvasRef.current?.getBoundingClientRect();
        const defaultMetrics = DEFAULT_METRICS['Other'];

        setLoading(true);
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            // Limit to max 10 images overall
            if (products.length + newProducts.length >= 10) {
                setError('Maximum 10 product images are allowed.');
                break;
            }

            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const res = reader.result as string;
                        const commaIndex = res.indexOf(',');
                        resolve(commaIndex !== -1 ? res.substring(commaIndex + 1) : res);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                const trimmedBase64 = await trimImage(base64, file.type);

                const newProduct: Product = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: file.name.split('.')[0] || 'Product',
                    category: 'Other',
                    base64: trimmedBase64,
                    mimeType: file.type,
                    ...defaultMetrics,
                    x: rect ? rect.width / 2 + (newProducts.length * 15) : 200,
                    y: rect ? rect.height / 2 + (newProducts.length * 15) : 200,
                    rotation: 0,
                    scale: 1,
                    zIndex: products.length + newProducts.length + 1
                };
                newProducts.push(newProduct);
            } catch (err) {
                console.error('Failed to parse file:', file.name, err);
            }
        }
        setLoading(false);
        if (newProducts.length > 0) {
            setProducts(prev => [...prev, ...newProducts]);
            setSelectedId(newProducts[newProducts.length - 1].id);
            autoAnalyzeProducts(newProducts);
        }
    };

    const moveProduct = (index: number, direction: 'up' | 'down') => {
        const newProducts = [...products];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newProducts.length) return;

        // Swap products in array
        const temp = newProducts[index];
        newProducts[index] = newProducts[targetIndex];
        newProducts[targetIndex] = temp;

        // Adjust zIndex to match the layout order
        newProducts.forEach((p, idx) => {
            p.zIndex = idx + 1;
        });

        setProducts(newProducts);
    };



    const handleDownload2K = async () => {
        if (products.length === 0) return;
        setDownloadState('preparing');
        try {
            const exportCanvas = document.createElement('canvas');
            const targetWidth = 2048;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) throw new Error('Canvas not found');

            const aspectRatio = rect.height / rect.width;
            exportCanvas.width = targetWidth;
            exportCanvas.height = targetWidth * aspectRatio;

            const ctx = exportCanvas.getContext('2d');
            if (!ctx) throw new Error('Context failed');

            const scaleFactor = targetWidth / rect.width;

            if (background) {
                const bgImg = new Image();
                bgImg.src = `data:${background.mimeType};base64,${background.base64}`;
                await new Promise(r => bgImg.onload = r);
                ctx.drawImage(bgImg, 0, 0, exportCanvas.width, exportCanvas.height);
            } else {
                ctx.fillStyle = genMode === 'Studio' ? '#ffffff' : '#0e0e0e';
                ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            }

            for (const p of [...products].sort((a, b) => a.zIndex - b.zIndex)) {
                const img = new Image();
                img.src = `data:${p.mimeType};base64,${p.base64}`;
                await new Promise(r => img.onload = r);

                const h = p.heightCm * pxPerCm * p.scale * scaleFactor;
                const w = h * (img.width / img.height);

                ctx.save();
                ctx.translate(p.x * scaleFactor, p.y * scaleFactor);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.drawImage(img, -w / 2, -h / 2, w, h);
                ctx.restore();
            }

            const base64 = exportCanvas.toDataURL('image/png').split(',')[1];
            await Flow.download({
                base64,
                mimeType: 'image/png',
                filename: `Beauty_Bundle_2K_${Date.now()}.png`
            });
            setDownloadState('done');
            setTimeout(() => setDownloadState('idle'), 2000);
        } catch (err) {
            setError('Download failed');
            setDownloadState('idle');
        }
    };

    const generateImages = async () => {
        setLoading(true);
        setError(null);
        try {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const exportCanvas = document.createElement('canvas');
            const size = 1024;
            exportCanvas.width = size;
            exportCanvas.height = size;
            const ctx = exportCanvas.getContext('2d')!;

            ctx.fillStyle = genMode === 'Studio' ? '#ffffff' : '#000000';
            ctx.fillRect(0, 0, size, size);

            const scale = size / Math.max(rect.width, rect.height);
            const ox = (size - rect.width * scale) / 2;
            const oy = (size - rect.height * scale) / 2;

            // Sort products left-to-right based on their canvas X coordinate.
            const sortedProds = [...products].sort((a, b) => a.x - b.x);

            // Load all product images and calculate coordinates at canvas scale (1024px canvas)
            const prodsWithSizes = await Promise.all(sortedProds.map(async (p) => {
                const img = new Image();
                img.src = `data:${p.mimeType};base64,${p.base64}`;
                await new Promise(r => img.onload = r);

                const h = p.heightCm * pxPerCm * p.scale * scale;
                const w = h * (img.width / img.height);
                return { p, img, w, h };
            }));

            // Align Y to the average bottom baseline to keep it aligned with floor reflections
            const bottoms = prodsWithSizes.map(item => (oy + item.p.y * scale) + item.h / 2);
            const commonBaseline = bottoms.length > 0
                ? bottoms.reduce((sum, b) => sum + b, 0) / bottoms.length
                : size * 0.8; // Fallback to 80% height

            // Calculate uniform spacing (30px gap) to prevent overlapping and center them horizontally
            const gap = 30;
            const totalProductsWidth = prodsWithSizes.reduce((sum, item) => sum + item.w, 0);
            const totalGapsWidth = (prodsWithSizes.length - 1) * gap;
            const totalWidth = totalProductsWidth + totalGapsWidth;

            let currentXStart = (size - totalWidth) / 2;

            for (const item of prodsWithSizes) {
                const drawX = currentXStart + item.w / 2;
                const drawY = commonBaseline - item.h / 2;

                currentXStart += item.w + gap;

                ctx.save();
                ctx.translate(drawX, drawY);
                ctx.rotate((item.p.rotation * Math.PI) / 180);
                ctx.drawImage(item.img, -item.w / 2, -item.h / 2, item.w, item.h);
                ctx.restore();
            }

            const refBase64 = exportCanvas.toDataURL('image/png').split(',')[1];
            const uploaded = await Flow.upload({ base64: refBase64, mimeType: 'image/png' });

            // Calculate current Cache Key (excludes positions/coordinates)
            const currentCacheKey = JSON.stringify({
                genMode,
                selectedLlm,
                products: products.map(p => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    heightCm: p.heightCm,
                    widthCm: p.widthCm,
                    lengthCm: p.lengthCm,
                    volumeMl: p.volumeMl,
                    scale: p.scale
                }))
            });

            let finalPrompt = cachedPrompt;
            let productUrls = cachedProductUrls;
            let analyses = cachedAnalyses;

            // If prompt is missing or cache key has changed, call Creative Director Vision LLM
            if (!finalPrompt || cacheKey !== currentCacheKey) {
                console.log('[App] Cache miss or invalid. Fetching optimized prompt from Creative Director...');
                const optimizedData = await Flow.creativeDirector.optimizePrompt({
                    products,
                    genMode,
                    canvasUrl: uploaded.mediaId,
                    selectedLlm
                });
                finalPrompt = optimizedData.prompt;
                productUrls = optimizedData.productUrls;
                analyses = optimizedData.analyses;

                // Save to state cache
                setCachedPrompt(finalPrompt);
                setCachedProductUrls(productUrls);
                setCachedAnalyses(analyses);
                setCacheKey(currentCacheKey);
            } else {
                console.log('[App] Cache hit! Reusing pre-generated prompt.');
            }

            const newResults: GeneratedResult[] = [];

            // Run batch image generation parallelly to minimize wait time
            const batchPromises = Array.from({ length: batchCount }).map(async () => {
                const result = await Flow.generate.image({
                    prompt: finalPrompt!,
                    referenceImageMediaIds: [uploaded.mediaId],
                    modelDisplayName: '🍌 Nano Banana Pro',
                    aspectRatio: '1:1',
                    isPreOptimized: true,
                    productUrls,
                    analyses
                });
                return {
                    id: result.mediaId,
                    base64: result.base64,
                    mimeType: result.mimeType,
                    timestamp: Date.now()
                };
            });

            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(r => newResults.unshift(r));
            setResults(prev => [...newResults, ...prev].slice(0, 8));
            if (newResults.length > 0) {
                setPreviewImage(newResults[0]);
            }
        } catch (err) {
            setError('Generation failed');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = useCallback(async () => {
        try {
            const res = await fetch('/api/bundling/sessions?limit=6');
            if (res.ok) {
                const data = await res.json() as { sessions: any[] };
                if (data.sessions) {
                    const formatted: GeneratedResult[] = data.sessions.map((s: any) => ({
                        id: s.id,
                        imageUrl: s.generated_image_url,
                        timestamp: new Date(s.created_at).getTime(),
                        name: s.session_name,
                    }));
                    setHistoryResults(formatted);
                }
            }
        } catch (err) {
            console.error('Failed to fetch session history:', err);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    useEffect(() => {
        if (results.length > 0) {
            fetchHistory();
        }
    }, [results, fetchHistory]);

    const downloadResult = async (res: GeneratedResult) => {
        setError(null);
        try {
            let base64 = res.base64;
            let mimeType = res.mimeType || 'image/png';

            if (!base64 && res.imageUrl) {
                const imgRes = await fetch(res.imageUrl);
                if (!imgRes.ok) throw new Error('Failed to fetch image for download');
                const blob = await imgRes.blob();
                mimeType = blob.type || 'image/png';

                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onloadend = () => {
                        const result = reader.result as string;
                        const commaIndex = result.indexOf(',');
                        resolve(commaIndex !== -1 ? result.substring(commaIndex + 1) : result);
                    };
                    reader.onerror = reject;
                });
                reader.readAsDataURL(blob);
                base64 = await base64Promise;
            }

            if (!base64) {
                throw new Error('Image data not found');
            }

            await Flow.download({
                base64,
                mimeType,
                filename: `Generated_Image_${res.id}.png`
            });
        } catch (err: any) {
            setError(err?.message || 'Download failed');
        }
    };

    const selectedProduct = products.find(p => p.id === selectedId);

    return (
        <div className="flex h-full w-full bg-[#0e0e0e] text-white overflow-hidden font-sans">
            <div className="w-[300px] border-r border-[rgba(218,220,224,0.15)] flex flex-col px-[10px] py-[12px] h-full min-h-0 bg-[#0e0e0e] z-10">
                <div className="flex flex-col gap-[20px] overflow-y-auto pr-1 dark-scrollbar flex-1 pb-4">

                    <div className="flex flex-col gap-2 items-start w-full">
                        <SectionLabel>Inventory ({products.length}/10)</SectionLabel>

                        {/* Drag and Drop Zone */}
                        <div
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className="w-full border border-dashed border-white/20 hover:border-accent-gold/40 rounded-xl p-3 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-all cursor-pointer relative"
                        >
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleFileChange}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <span className="material-symbols-outlined text-[20px] text-white/60 mb-0.5">cloud_upload</span>
                            <span className="text-[9px] font-semibold text-white/80">Drag & Drop or Click</span>
                            <span className="text-[7px] text-white/40 mt-0.5">Supports multiple images</span>
                        </div>

                        {/* Ordered Products List with Reordering Controls */}
                        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto w-full dark-scrollbar mt-1">
                            {products.map((p, idx) => (
                                <div key={p.id} className="flex items-center gap-1.5 w-full bg-white/5 p-1 rounded-lg border border-white/5 hover:border-white/10 transition-all">
                                    <button
                                        onClick={() => setSelectedId(p.id)}
                                        className={`flex flex-1 items-center gap-2 p-1 text-left min-w-0 ${selectedId === p.id ? 'text-accent-gold' : 'text-white'}`}
                                    >
                                        <div className="relative shrink-0 w-8 h-8 bg-white/10 rounded overflow-hidden flex items-center justify-center">
                                            <img src={`data:${p.mimeType};base64,${p.base64}`} className="w-full h-full object-contain" />
                                            <span className="absolute top-0 left-0 bg-black/80 px-1 py-0.2 text-[6px] text-white/80 rounded-br font-bold">
                                                Img {idx + 1}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-medium truncate opacity-90">{p.name}</p>
                                            {p.isAnalyzing ? (
                                                <p className="text-[8px] text-accent-gold/90 truncate animate-pulse flex items-center gap-1">
                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-gold animate-ping"></span>
                                                    Auto-resizing...
                                                </p>
                                            ) : (
                                                <p className="text-[8px] opacity-40 truncate">{p.category} • {p.heightCm}cm</p>
                                            )}
                                        </div>
                                    </button>
                                    {/* Control buttons (Up/Down & Delete) */}
                                    <div className="flex items-center gap-1 shrink-0 pr-1">
                                        <div className="flex flex-col gap-0.5">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); moveProduct(idx, 'up'); }}
                                                disabled={idx === 0}
                                                className="w-4 h-4 rounded hover:bg-white/10 flex items-center justify-center disabled:opacity-10 transition-colors"
                                                title="Move Up"
                                            >
                                                <span className="material-symbols-outlined text-[12px] font-bold">keyboard_arrow_up</span>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); moveProduct(idx, 'down'); }}
                                                disabled={idx === products.length - 1}
                                                className="w-4 h-4 rounded hover:bg-white/10 flex items-center justify-center disabled:opacity-10 transition-colors"
                                                title="Move Down"
                                            >
                                                <span className="material-symbols-outlined text-[12px] font-bold">keyboard_arrow_down</span>
                                            </button>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setProducts(prev => prev.filter(pItem => pItem.id !== p.id));
                                                if (selectedId === p.id) {
                                                    setSelectedId(null);
                                                }
                                            }}
                                            className="w-6 h-6 rounded hover:bg-red-500/10 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
                                            title="Delete product"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {selectedProduct && (
                        <div className="flex flex-col gap-2 items-start w-full animate-dropdown">
                            <SectionLabel>Product Detail</SectionLabel>
                            <div className="flex flex-col gap-1.5 w-full">
                                <FieldDropdown
                                    label="Category"
                                    value={selectedProduct.category}
                                    options={CATEGORIES}
                                    onChange={(v) => {
                                        const metrics = DEFAULT_METRICS[v as Category];
                                        updateProduct(selectedProduct.id, { category: v as Category, ...metrics });
                                    }}
                                />

                                <div className="grid grid-cols-2 gap-1">
                                    <DragNumberField label="Length (cm)" value={selectedProduct.lengthCm} min={0.1} max={100} step={0.1} suffix="" onChange={v => updateProduct(selectedId!, { lengthCm: v, scale: 1 })} />
                                    <DragNumberField label="Width (cm)" value={selectedProduct.widthCm} min={0.1} max={100} step={0.1} suffix="" onChange={v => updateProduct(selectedId!, { widthCm: v, scale: 1 })} />
                                    <DragNumberField label="Height (cm)" value={selectedProduct.heightCm} min={0.1} max={100} step={0.1} suffix="" onChange={v => updateProduct(selectedId!, { heightCm: v, scale: 1 })} />
                                    <DragNumberField label="Weight (g)" value={selectedProduct.weightG} min={1} max={5000} step={1} suffix="" onChange={v => updateProduct(selectedId!, { weightG: v })} />
                                    <DragNumberField label="Volume (ml)" value={selectedProduct.volumeMl} min={0} max={2000} step={1} suffix="" onChange={v => updateProduct(selectedId!, { volumeMl: v })} className="col-span-2" />
                                </div>

                                <div className="flex gap-1 w-full mt-1">
                                    <DragNumberField label="Layer" value={selectedProduct.zIndex} min={1} max={100} step={1} suffix="" onChange={v => updateProduct(selectedId!, { zIndex: v })} className="flex-1" />
                                    <PillButton onClick={() => setSelectedId(null)} variant="outline" className="flex-1 text-[10px]">Deselect</PillButton>
                                </div>

                                <RangeSlider label="Scale" value={selectedProduct.scale} min={0.1} max={3} step={0.1} formatValue={v => `${v}x`} onChange={v => updateProduct(selectedId!, { scale: v })} />
                                <RangeSlider label="Rotation" value={selectedProduct.rotation} min={-180} max={180} step={1} formatValue={v => `${v}°`} onChange={v => updateProduct(selectedId!, { rotation: v })} />

                                <PillButton onClick={() => setProducts(p => p.filter(i => i.id !== selectedId))} variant="outline" className="text-red-400 border-red-500/20 hover:bg-red-500/10">Delete</PillButton>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 items-start w-full">
                        <SectionLabel>Scene Settings</SectionLabel>
                        <div className="flex flex-col gap-1.5 w-full">
                            <div className="flex border border-[#595959] rounded-xl overflow-hidden">
                                {(['Studio', 'Aesthetic', 'Creative'] as const).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setGenMode(mode)}
                                        className={`flex-1 h-[32px] text-[10px] font-medium transition-all ${genMode === mode ? 'bg-[#969696] text-black' : 'text-white/60 hover:bg-white/5'}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>

                            <FieldDropdown
                                label="LLM Vision Model"
                                value={LLM_ID_TO_DISPLAY[selectedLlm] || 'Gemini 3.5 Flash'}
                                options={LLM_OPTIONS}
                                onChange={(name) => setSelectedLlm(LLM_DISPLAY_TO_ID[name])}
                            />

                            <RangeSlider label="Calibration" value={pxPerCm} min={10} max={60} formatValue={v => `${v} px/cm`} onChange={setPxPerCm} />
                        </div>
                    </div>

                    <ResultsGallery
                        title="Recent Outputs"
                        results={results}
                        onDownload={downloadResult}
                        onPreview={setPreviewImage}
                    />

                    <ResultsGallery
                        title="History Gallery"
                        results={historyResults}
                        onDownload={downloadResult}
                        onPreview={setPreviewImage}
                    />

                    {error && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] text-center">{error}</div>}
                </div>

                <div className="flex flex-col gap-[8px] pt-4 mt-auto border-t border-white/10">
                    <div className="flex flex-col gap-2">
                        <SectionLabel>Batch Count</SectionLabel>
                        <div className="flex border border-[#595959] rounded-xl overflow-hidden">
                            {[1, 2, 3, 4].map(n => (
                                <button
                                    key={n}
                                    onClick={() => setBatchCount(n)}
                                    className={`flex-1 h-[30px] text-[10px] font-medium transition-all ${batchCount === n ? 'bg-white text-black' : 'text-white/40 hover:bg-white/5'}`}
                                >
                                    {n}x
                                </button>
                            ))}
                        </div>
                    </div>

                    <PillButton
                        variant="outline"
                        onClick={generateImages}
                        disabled={loading || products.length === 0}
                        icon={<span className="material-symbols-outlined text-[18px]">auto_awesome</span>}
                        className="border-white/20 hover:bg-white/5"
                    >
                        {loading ? 'Generating...' : 'Generated Image'}
                    </PillButton>

                    <PillButton
                        variant="solid"
                        onClick={handleDownload2K}
                        disabled={products.length === 0 || downloadState === 'preparing'}
                        icon={<span className="material-symbols-outlined text-[18px] opacity-80">download</span>}
                    >
                        {downloadState === 'preparing' ? 'Upscaling 2K...' : downloadState === 'done' ? 'Downloaded ✓' : 'Download Image'}
                    </PillButton>
                </div>
            </div>

            <Canvas
                products={products}
                pxPerCm={pxPerCm}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdateProduct={updateProduct}
                backgroundBase64={background?.base64}
                canvasRef={canvasRef}
                isLoading={loading}
            />

            {/* Premium 2K Preview Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-all duration-300"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative max-w-2xl w-full bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all transform duration-300 scale-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                            <div>
                                <h3 className="text-sm font-bold text-white tracking-wide">
                                    {previewImage.name || 'Generated Bundle Preview'}
                                </h3>
                                <p className="text-[10px] text-white/40 mt-0.5">
                                    Verify composition, typography, and reflections
                                </p>
                            </div>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px] text-white/80">close</span>
                            </button>
                        </div>

                        {/* Image Viewer */}
                        <div className="relative aspect-square bg-[#0e0e0e] flex items-center justify-center overflow-hidden p-6">
                            <img
                                src={previewImage.imageUrl || `data:${previewImage.mimeType};base64,${previewImage.base64}`}
                                className="max-w-full max-h-full object-contain rounded-lg border border-white/5 shadow-lg select-none"
                                alt="High Resolution Preview"
                            />
                        </div>

                        {/* Actions Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Resolution</span>
                                <span className="text-xs font-medium text-accent-gold mt-0.5">2K Ultra-HD (2048 × 2048)</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-white/80 hover:bg-white/5 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => downloadResult(previewImage)}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 flex items-center gap-1.5 transition-colors shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                >
                                    <span className="material-symbols-outlined text-[16px] font-bold">download</span>
                                    Download Image
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}