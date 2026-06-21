'use client';

/**
 * components/bundling/ProductUploadZone.tsx
 * Drag-and-drop upload area for 2–5 product images.
 * Supports HTML5 reordering, name input per product, delete.
 */

import { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, GripVertical, Upload, ImagePlus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BundlingProduct } from '@/lib/bundling';

interface Props {
  products: BundlingProduct[];
  onChange: (products: BundlingProduct[]) => void;
  disabled?: boolean;
}

export default function ProductUploadZone({ products, onChange, disabled }: Props) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragSrcIndex = useRef<number | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remaining = 5 - products.length;
      const toAdd = acceptedFiles.slice(0, remaining);
      const newProducts: BundlingProduct[] = toAdd.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      }));
      onChange([...products, ...newProducts]);
    },
    [products, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxFiles: 5 - products.length,
    disabled: disabled || products.length >= 5,
    maxSize: 10 * 1024 * 1024,
  });

  const handleDelete = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (p?.previewUrl && p.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(p.previewUrl);
    }
    onChange(products.filter((x) => x.id !== id));
  };

  const handleNameChange = (id: string, name: string) => {
    onChange(products.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  // HTML5 DnD reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragSrcIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const srcIdx = dragSrcIndex.current;
    if (srcIdx === null || srcIdx === targetIndex) {
      setDragOverIndex(null);
      return;
    }
    const reordered = [...products];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(targetIndex, 0, moved);
    onChange(reordered);
    dragSrcIndex.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragSrcIndex.current = null;
    setDragOverIndex(null);
  };

  const canAddMore = products.length < 5 && !disabled;

  return (
    <div className="space-y-3">
      {/* Validation hint */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {products.length === 0
            ? 'Upload 2–5 product images'
            : `${products.length}/5 products`}
        </span>
        {products.length >= 2 && (
          <span className="text-xs text-accent-green font-medium">✓ Ready to analyze</span>
        )}
        {products.length === 1 && (
          <span className="text-xs text-accent-gold font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Need at least 2
          </span>
        )}
      </div>

      {/* Drop zone (only show if < 5 products) */}
      {canAddMore && (
        <div
          {...getRootProps()}
          className={cn(
            'relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-accent-blue bg-accent-blue/10 scale-[0.99]'
              : 'border-border hover:border-accent-gold/50 hover:bg-accent-gold/5',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                isDragActive ? 'bg-accent-blue/20' : 'bg-bg-secondary'
              )}
            >
              {isDragActive ? (
                <ImagePlus className="w-6 h-6 text-accent-blue" />
              ) : (
                <Upload className="w-6 h-6 text-text-muted" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                {isDragActive ? 'Drop images here' : 'Drag & drop images'}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                or <span className="text-accent-gold">browse</span> · JPG, PNG · max 10MB each
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail grid */}
      {products.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
            Products — drag to reorder (left → right)
          </p>
          <div className="space-y-2">
            {products.map((product, index) => (
              <div
                key={product.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'group flex items-center gap-3 p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing',
                  dragOverIndex === index
                    ? 'border-accent-gold/60 bg-accent-gold/10 scale-[1.02]'
                    : 'border-border bg-bg-card hover:border-border-light'
                )}
              >
                {/* Drag handle */}
                <GripVertical className="w-4 h-4 text-text-muted flex-shrink-0 opacity-50 group-hover:opacity-100" />

                {/* Index badge */}
                <span className="w-5 h-5 rounded-md bg-accent-gold/20 text-accent-gold text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>

                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-bg-secondary flex-shrink-0 border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.previewUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Name input */}
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => handleNameChange(product.id, e.target.value)}
                  placeholder={`Product ${index + 1} name`}
                  disabled={disabled}
                  className="flex-1 min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-muted border-none outline-none focus:ring-0"
                />

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(product.id)}
                  disabled={disabled}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-accent-red/10 hover:text-accent-red transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
