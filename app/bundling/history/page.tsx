'use client';

/**
 * app/bundling/history/page.tsx
 * Grid view of all bundling sessions for the current user.
 */

import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import SessionCard from '@/components/bundling/SessionCard';
import { Package, PlusCircle, Search, Heart, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  session_name: string;
  created_at: string;
  product_images: string[];
  generated_image_url?: string;
  rating?: number;
  is_favorite?: boolean;
}

export default function BundlingHistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'rated'>('all');

  useEffect(() => {
    fetch('/api/bundling/sessions?limit=50')
      .then((r) => r.json())
      .then((d) => {
        if (d.sessions) setSessions(d.sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggleFavorite = async (id: string, value: boolean) => {
    await fetch(`/api/bundling/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: value }),
    });
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_favorite: value } : s))
    );
  };

  const filtered = sessions.filter((s) => {
    const matchSearch = !search || s.session_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'favorites' && s.is_favorite) ||
      (filter === 'rated' && s.rating != null);
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />

        {/* Header */}
        <div className="flex-shrink-0 border-b border-border px-6 py-4 bg-bg-secondary">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Package className="w-5 h-5 text-accent-gold" />
                Bundle History
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''} saved
              </p>
            </div>

            <Link
              href="/bundling"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-gold to-amber-500 text-white text-sm font-semibold hover:opacity-90 transition-all shadow-gold-sm"
            >
              <PlusCircle className="w-4 h-4" />
              New Bundle
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

            {/* Search + filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sessions..."
                  className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-gold/50 transition-colors"
                />
              </div>

              {(['all', 'favorites', 'rated'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize',
                    filter === f
                      ? 'border-accent-gold/40 bg-accent-gold/10 text-accent-gold'
                      : 'border-border text-text-secondary hover:border-border-light'
                  )}
                >
                  {f === 'favorites' && <Heart className="w-3 h-3" />}
                  {f}
                </button>
              ))}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 glass-card rounded-2xl border border-dashed border-border">
                <Package className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
                <p className="text-text-secondary font-semibold mb-1">
                  {sessions.length === 0 ? 'No bundles yet' : 'No matching sessions'}
                </p>
                <p className="text-text-muted text-sm mb-5">
                  {sessions.length === 0
                    ? 'Create your first product bundle to get started.'
                    : 'Try a different search or filter.'}
                </p>
                {sessions.length === 0 && (
                  <Link
                    href="/bundling"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-accent-gold to-amber-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-all shadow-gold-sm"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Create First Bundle
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filtered.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
