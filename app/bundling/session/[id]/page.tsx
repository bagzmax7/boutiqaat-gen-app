'use client';

/**
 * app/bundling/session/[id]/page.tsx
 * Load a specific past bundling session into the workspace.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import DimensionTable from '@/components/bundling/DimensionTable';
import PromptEditor from '@/components/bundling/PromptEditor';
import GenerationCanvas from '@/components/bundling/GenerationCanvas';
import RatingWidget from '@/components/bundling/RatingWidget';
import { ProductAnalysis, BundlingPromptOptions } from '@/lib/bundling';
import {
  Package, ArrowLeft, Sparkles, RefreshCw, Star, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface SessionData {
  id: string;
  session_name: string;
  created_at: string;
  product_images: string[];
  product_names: string[];
  dimensions_analysis: { products: ProductAnalysis[] };
  final_prompt: string;
  generated_image_url?: string;
  rating?: number;
  rating_feedback?: string;
  is_favorite?: boolean;
}

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [analysisResults, setAnalysisResults] = useState<ProductAnalysis[]>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/bundling/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.session) {
          const s: SessionData = d.session;
          setSession(s);
          setPrompt(s.final_prompt);
          setAnalysisResults(s.dimensions_analysis?.products || []);
          setGeneratedImageUrl(s.generated_image_url || null);
        }
      })
      .catch(() => toast.error('Failed to load session'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleRegenPrompt = async (options: BundlingPromptOptions) => {
    if (!session) return;
    const productsForPrompt = analysisResults.map((a, i) => ({
      name: session.product_names?.[i] || a.product_name,
      analysis: a,
      imageIndex: i,
    }));
    const res = await fetch('/api/bundling/generate-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: productsForPrompt, options }),
    });
    if (res.ok) {
      const { prompt: p } = await res.json();
      setPrompt(p);
      toast.success('Prompt regenerated');
    }
  };

  const handleRegenerate = async (options: BundlingPromptOptions = {}) => {
    if (!session || !prompt) return;
    setGenerating(true);
    setGenerationError(null);
    const toastId = toast.loading('Regenerating bundle...');

    try {
      let finalPrompt = prompt;
      if (Object.keys(options).length > 0) {
        await handleRegenPrompt(options);
      }

      const res = await fetch('/api/bundling/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, image_urls: session.product_images }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const { imageUrl } = await res.json();
      setGeneratedImageUrl(imageUrl);

      // Update session in DB
      await fetch(`/api/bundling/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generated_image_url: imageUrl }),
      });

      toast.success('Bundle regenerated!', { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Regeneration failed';
      setGenerationError(msg);
      toast.error(msg, { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImageUrl) return;
    const res = await fetch(generatedImageUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boutiqaat-bundle-${sessionId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRate = async (rating: number, feedback: string) => {
    const res = await fetch(`/api/bundling/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, rating_feedback: feedback }),
    });
    if (!res.ok) throw new Error('Failed to save rating');
    setSession((s) => s ? { ...s, rating } : s);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-bg-primary overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen bg-bg-primary overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Package className="w-10 h-10 text-text-muted/30" />
            <p className="text-text-secondary font-semibold">Session not found</p>
            <Link href="/bundling/history" className="text-accent-gold text-sm hover:underline">
              ← Back to history
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />

        {/* Header */}
        <div className="flex-shrink-0 border-b border-border px-6 py-4 bg-bg-secondary">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <Link
              href="/bundling/history"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-text-primary truncate flex items-center gap-2">
                <Package className="w-4 h-4 text-accent-gold flex-shrink-0" />
                {session.session_name}
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                {new Date(session.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {session.rating && (
                  <span className="ml-2 inline-flex items-center gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star
                        key={s}
                        className={cn('w-3 h-3', s <= (session.rating || 0) ? 'fill-accent-gold text-accent-gold' : 'text-text-muted')}
                      />
                    ))}
                  </span>
                )}
              </p>
            </div>

            <button
              onClick={() => handleRegenerate()}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-gold to-amber-500 text-white hover:opacity-90 transition-all shadow-gold-sm"
            >
              <RefreshCw className={cn('w-4 h-4', generating && 'animate-spin')} />
              Regenerate
            </button>
          </div>
        </div>

        {/* Product images strip */}
        <div className="flex-shrink-0 border-b border-border px-6 py-3 bg-bg-card">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-xs text-text-muted uppercase font-semibold tracking-wider">Products:</span>
            <div className="flex gap-2">
              {session.product_images.map((url, i) => (
                <div key={i} className="relative w-10 h-10 rounded-lg overflow-hidden border border-border flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={session.product_names?.[i] || `Product ${i+1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center font-bold leading-3 pb-0.5">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3-column layout */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left: Dimensions */}
          <div className="w-72 xl:w-80 flex-shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest">Dimensions</h2>
            <DimensionTable
              products={analysisResults}
              onChange={setAnalysisResults}
            />
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6">
            <GenerationCanvas
              imageUrls={generatedImageUrl ? [generatedImageUrl] : []}
              loading={generating}
              onRegenerate={handleRegenerate}
              onDownload={handleDownload}
              error={generationError}
            />
          </div>

          {/* Right: Prompt + Rating */}
          <div className="w-72 xl:w-80 flex-shrink-0 border-l border-border overflow-y-auto p-4 space-y-5">
            <div>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Prompt</h2>
              <PromptEditor
                prompt={prompt}
                onChange={setPrompt}
                onRegenerate={handleRegenPrompt}
                loading={generating}
              />
            </div>

            <button
              onClick={() => handleRegenerate()}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-accent-gold to-amber-500 text-white hover:opacity-90 transition-all shadow-gold-sm"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'Generating...' : 'Regenerate Bundle'}
            </button>

            <RatingWidget
              sessionId={sessionId}
              currentRating={session.rating}
              onRate={handleRate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
