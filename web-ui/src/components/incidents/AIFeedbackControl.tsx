'use client';

import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, X, CheckCircle, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface AIFeedbackControlProps {
  /** Incident ID */
  incidentId: number;
  /** Current rating (1-5, or null if not rated) */
  currentRating?: number | null;
  /** Current feedback text */
  currentFeedback?: string | null;
  /** Callback when feedback is submitted */
  onFeedbackSubmitted?: (rating: number, feedback?: string) => void;
  /** Whether to show compact mode */
  compact?: boolean;
  /** Custom CSS classes */
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function AIFeedbackControl({
  incidentId,
  currentRating,
  currentFeedback,
  onFeedbackSubmitted,
  compact = false,
  className = '',
}: AIFeedbackControlProps) {
  const [rating, setRating] = useState<number | null>(currentRating ?? null);
  const [feedback, setFeedback] = useState(currentFeedback || '');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = useCallback(async (newRating: number, feedbackText?: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/incidents/${incidentId}/feedback`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: newRating,
          feedback: feedbackText || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to submit feedback');
      }

      setRating(newRating);
      setSubmitted(true);
      onFeedbackSubmitted?.(newRating, feedbackText);

      // Reset submitted state after a delay
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  }, [incidentId, onFeedbackSubmitted]);

  const handleThumbsUp = useCallback(() => {
    submitFeedback(5); // 5 = positive
  }, [submitFeedback]);

  const handleThumbsDown = useCallback(() => {
    setShowFeedbackInput(true);
    setRating(1); // 1 = negative, but wait for feedback
  }, []);

  const handleSubmitWithFeedback = useCallback(() => {
    submitFeedback(rating || 1, feedback);
    setShowFeedbackInput(false);
  }, [submitFeedback, rating, feedback]);

  const handleCancelFeedback = useCallback(() => {
    setShowFeedbackInput(false);
    setRating(currentRating ?? null);
    setFeedback(currentFeedback || '');
  }, [currentRating, currentFeedback]);

  // Compact mode - just thumbs buttons
  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        ) : submitted ? (
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        ) : (
          <>
            <button
              onClick={handleThumbsUp}
              disabled={isSubmitting}
              className={`p-1.5 rounded transition-colors ${
                rating === 5
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
              }`}
              title="AI analysis was helpful"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={handleThumbsDown}
              disabled={isSubmitting}
              className={`p-1.5 rounded transition-colors ${
                rating === 1
                  ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                  : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
              }`}
              title="AI analysis needs improvement"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    );
  }

  // Full mode with feedback input
  return (
    <div className={`${className}`}>
      {/* Rating Buttons */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Was this analysis accurate?
        </span>
        <div className="flex items-center gap-1">
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          ) : submitted ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Thanks!</span>
            </div>
          ) : (
            <>
              <button
                onClick={handleThumbsUp}
                disabled={isSubmitting}
                className={`p-2 rounded-lg transition-colors ${
                  rating === 5
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                }`}
                title="Accurate"
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button
                onClick={handleThumbsDown}
                disabled={isSubmitting}
                className={`p-2 rounded-lg transition-colors ${
                  rating === 1
                    ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                }`}
                title="Needs improvement"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback Input (shown when thumbs down) */}
      {showFeedbackInput && (
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5" />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Help us improve - what was incorrect?
            </span>
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g., Root cause was wrong, missing context..."
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            rows={2}
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              onClick={handleCancelFeedback}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitWithFeedback}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                'Submit Feedback'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <X className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}

export default AIFeedbackControl;
