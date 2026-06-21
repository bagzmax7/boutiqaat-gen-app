'use client';

/**
 * components/bundling/SessionCard.tsx
 * History card showing a bundling session with thumbnail, name, date, and rating.
 */

import Link from 'next/link';
import { Star, Heart, Package, Clock, ExternalLink } from 'lucide-react';
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

interface Props {
  session: Session;
  onToggleFavorite?: (id: string, value: boolean) => void;
}

export default function SessionCard({ session, onToggleFavorite }: Props) {
  const thumbnail = session.generated_image_url || session.product_images?.[0];
  const productCount = session.product_images?.length || 0;
  const dateStr = new Date(session.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = new Date(session.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="group relative glass-card rounded-2xl border border-border hover:border-accent-gold/30 transition-all hover:-translate-y-0.5 hover:shadow-card overflow-hidden">
      {/* Thumbnail */}
      <div className="relative aspect-square bg-bg-secondary overflow-hidden">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={session.session_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-8 h-8 text-text-muted/30" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <Link
            href={`/bundling/session/${session.id}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-white/95 text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Load Session
          </Link>
        </div>

        {/* Favorite button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite(session.id, !session.is_favorite);
            }}
            className={cn(
              'absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all',
              'opacity-0 group-hover:opacity-100',
              session.is_favorite
                ? 'bg-accent-red/90 text-white opacity-100'
                : 'bg-bg-card/90 text-text-muted hover:text-accent-red'
            )}
          >
            <Heart className={cn('w-3.5 h-3.5', session.is_favorite && 'fill-current')} />
          </button>
        )}

        {/* Product count badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
          <Package className="w-3 h-3" />
          {productCount} product{productCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-semibold text-text-primary truncate leading-tight">
          {session.session_name}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <Clock className="w-3 h-3" />
            {dateStr} · {timeStr}
          </div>

          {/* Star rating */}
          {session.rating ? (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    'w-3 h-3',
                    s <= (session.rating || 0)
                      ? 'fill-accent-gold text-accent-gold'
                      : 'text-text-muted'
                  )}
                />
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-text-muted">Not rated</span>
          )}
        </div>
      </div>
    </div>
  );
}
