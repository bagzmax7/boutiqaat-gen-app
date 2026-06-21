import React from 'react';
import { GeneratedResult } from '../types';
import { SectionLabel } from './Primitives';

interface ResultsGalleryProps {
    title?: string;
    results: GeneratedResult[];
    onDownload: (res: GeneratedResult) => void;
    onPreview?: (res: GeneratedResult) => void;
}

export const ResultsGallery: React.FC<ResultsGalleryProps> = ({ 
    title = 'Recent Results', 
    results, 
    onDownload,
    onPreview 
}) => {
    if (results.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 items-start w-full mt-4">
            <SectionLabel>{title}</SectionLabel>
            <div className="grid grid-cols-2 gap-2 w-full">
                {results.map((res) => {
                    const imgSrc = res.imageUrl || `data:${res.mimeType};base64,${res.base64}`;
                    return (
                        <div key={res.id} className="group relative aspect-square bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                            <img
                                src={imgSrc}
                                className="w-full h-full object-cover"
                                alt={res.name || "Generated"}
                            />
                            {res.name && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 pt-4 text-[8px] text-white/80 font-medium truncate">
                                    {res.name}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                {onPreview && (
                                    <button
                                        onClick={() => onPreview(res)}
                                        className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform"
                                        title="Preview"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => onDownload(res)}
                                    className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform"
                                    title="Download"
                                >
                                    <span className="material-symbols-outlined text-[18px]">download</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};