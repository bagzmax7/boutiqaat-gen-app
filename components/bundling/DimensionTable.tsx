'use client';

/**
 * components/bundling/DimensionTable.tsx
 * Editable table showing LLM dimension analysis results.
 * Confidence badges (High=green, Medium=yellow, Low=red) with inline editing.
 */

import { useState } from 'react';
import { AlertTriangle, Edit3, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductAnalysis, getConfidenceColor, hasLowConfidence } from '@/lib/bundling';

interface Props {
  products: ProductAnalysis[];
  onChange: (products: ProductAnalysis[]) => void;
}

interface EditingCell {
  productId: string;
  field: 'height' | 'width' | 'depth';
}

export default function DimensionTable({ products, onChange }: Props) {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (productId: string, field: 'height' | 'width' | 'depth', current: number) => {
    setEditing({ productId, field });
    setEditValue(current.toString());
  };

  const commitEdit = () => {
    if (!editing) return;
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) {
      setEditing(null);
      return;
    }
    onChange(
      products.map((p) => {
        if (p.product_id !== editing.productId) return p;
        return {
          ...p,
          dimensions_cm: { ...p.dimensions_cm, [editing.field]: val },
          // If user edits a Low-confidence field, upgrade to Medium
          confidence: p.confidence === 'Low' ? 'Medium' : p.confidence,
        };
      })
    );
    setEditing(null);
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const lowConfidenceExists = hasLowConfidence(products);

  if (products.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Low confidence warning */}
      {lowConfidenceExists && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-accent-red/10 border border-accent-red/20 text-accent-red">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-medium leading-relaxed">
            Some products have <strong>Low</strong> confidence — please review and manually correct their dimensions.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_60px_60px_60px_80px] gap-0 bg-bg-secondary border-b border-border px-3 py-2">
          {['Product', 'H (cm)', 'W (cm)', 'D (cm)', 'Conf.'].map((h) => (
            <span key={h} className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {products.map((product, idx) => (
          <div
            key={product.product_id}
            className={cn(
              'grid grid-cols-[1fr_60px_60px_60px_80px] gap-0 px-3 py-3 items-center transition-colors',
              idx < products.length - 1 && 'border-b border-border',
              product.confidence === 'Low' && 'bg-accent-red/5'
            )}
          >
            {/* Product name + category */}
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-text-primary truncate">{product.product_name}</p>
              <p className="text-[10px] text-text-muted capitalize mt-0.5">{product.category}</p>
            </div>

            {/* Dimension cells */}
            {(['height', 'width', 'depth'] as const).map((dim) => {
              const isEditing = editing?.productId === product.product_id && editing.field === dim;
              const value = product.dimensions_cm[dim];

              return (
                <div key={dim} className="relative">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        autoFocus
                        className="w-12 text-xs text-text-primary bg-bg-card border border-accent-blue/50 rounded px-1 py-0.5 outline-none focus:border-accent-blue"
                        step="0.1"
                        min="0.1"
                      />
                      <button onClick={commitEdit} className="text-accent-green hover:opacity-80">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={cancelEdit} className="text-accent-red hover:opacity-80">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(product.product_id, dim, value)}
                      className="group flex items-center gap-1 text-xs text-text-primary hover:text-accent-gold transition-colors"
                    >
                      {value.toFixed(1)}
                      <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Confidence badge */}
            <div>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                  getConfidenceColor(product.confidence)
                )}
              >
                {product.confidence}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-text-muted">Click any dimension to edit. Changes will update the generated prompt.</p>
    </div>
  );
}
