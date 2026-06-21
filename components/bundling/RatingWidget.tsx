'use client';

/**
 * components/bundling/RatingWidget.tsx
 * 5-star interactive rating + optional text feedback.
 */

import { useState } from 'react';
import { Star, Send, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  sessionId?: string;
  currentRating?: number;
  onRate: (rating: number, feedback: string) => Promise<void>;
}

export default function RatingWidget({ sessionId, currentRating, onRate }: Props) {
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(currentRating || 0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!sessionId) return null;

  const handleSubmit = async () => {
    if (selectedStar === 0) return;
    setSubmitting(true);
    try {
      await onRate(selectedStar, feedback);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-green/10 border border-accent-green/20 text-accent-green">
        <Check className="w-4 h-4 flex-shrink-0" />
        <p className="text-xs font-medium">Thanks for your feedback! 🙏</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 rounded-xl bg-bg-card border border-border">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Rate this bundle</p>

      {/* Stars */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setSelectedStar(star)}
            className="transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={cn(
                'w-6 h-6 transition-colors',
                star <= (hoveredStar || selectedStar)
                  ? 'fill-accent-gold text-accent-gold'
                  : 'text-text-muted'
              )}
            />
          </button>
        ))}
        {selectedStar > 0 && (
          <span className="text-xs text-text-muted self-center ml-1">
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][selectedStar]}
          </span>
        )}
      </div>

      {/* Feedback input */}
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Optional: what could be improved? (for model fine-tuning)"
        rows={2}
        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted resize-none outline-none focus:border-accent-blue/50 transition-colors"
      />

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={selectedStar === 0 || submitting}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
          selectedStar > 0
            ? 'bg-gradient-to-r from-accent-gold to-accent-gold-dark text-white hover:opacity-90 shadow-gold-sm'
            : 'bg-bg-secondary text-text-muted cursor-not-allowed'
        )}
      >
        {submitting ? (
          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <Send className="w-3.5 h-3.5" />
        )}
        Submit Rating
      </button>
    </div>
  );
}
