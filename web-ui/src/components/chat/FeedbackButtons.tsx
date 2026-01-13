'use client';

import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, Check, MessageSquare } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface FeedbackButtonsProps {
  /** Session ID for recording feedback */
  sessionId: string;
  /** Message ID to associate feedback with */
  messageId?: string | number;
  /** Callback when feedback is submitted */
  onFeedback?: (feedback: 'helpful' | 'not_helpful', comment?: string) => void;
  /** Whether to show the comment input option */
  allowComment?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

export type FeedbackType = 'helpful' | 'not_helpful' | null;

// ============================================================================
// API Helper
// ============================================================================

async function submitFeedback(
  sessionId: string,
  feedback: 'helpful' | 'not_helpful',
  comment?: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/metrics/routing/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        session_id: sessionId,
        feedback,
        comment,
      }),
    });

    if (!response.ok) {
      console.error('Failed to submit feedback:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return false;
  }
}

// ============================================================================
// FeedbackButtons Component
// ============================================================================

export function FeedbackButtons({
  sessionId,
  messageId,
  onFeedback,
  allowComment = true,
  size = 'sm',
  className = '',
}: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<FeedbackType>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = useCallback(
    async (type: 'helpful' | 'not_helpful') => {
      if (submitted || isSubmitting) return;

      setIsSubmitting(true);

      // If not_helpful and comments allowed, show comment input first
      if (type === 'not_helpful' && allowComment && !showComment) {
        setShowComment(true);
        setIsSubmitting(false);
        return;
      }

      const success = await submitFeedback(sessionId, type, comment || undefined);

      if (success) {
        setSubmitted(type);
        onFeedback?.(type, comment || undefined);
      }

      setIsSubmitting(false);
      setShowComment(false);
    },
    [sessionId, submitted, isSubmitting, onFeedback, allowComment, showComment, comment]
  );

  const handleCommentSubmit = useCallback(async () => {
    await handleFeedback('not_helpful');
  }, [handleFeedback]);

  const handleSkipComment = useCallback(async () => {
    setComment('');
    setShowComment(false);

    setIsSubmitting(true);
    const success = await submitFeedback(sessionId, 'not_helpful');
    if (success) {
      setSubmitted('not_helpful');
      onFeedback?.('not_helpful');
    }
    setIsSubmitting(false);
  }, [sessionId, onFeedback]);

  // Size classes
  const sizeClasses = {
    sm: {
      button: 'p-1.5',
      icon: 'w-3.5 h-3.5',
      text: 'text-xs',
    },
    md: {
      button: 'p-2',
      icon: 'w-4 h-4',
      text: 'text-sm',
    },
  };

  const sizes = sizeClasses[size];

  // Already submitted - show confirmation
  if (submitted) {
    return (
      <div className={`flex items-center gap-1.5 ${sizes.text} text-slate-500 dark:text-slate-400 ${className}`}>
        <Check className={`${sizes.icon} text-green-500`} />
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  // Comment input mode
  if (showComment) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className={`${sizes.text} text-slate-600 dark:text-slate-300`}>
          What could be improved?
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: Tell us what went wrong..."
          className={`w-full px-3 py-2 ${sizes.text} rounded-lg border border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-800 text-slate-900 dark:text-white
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            resize-none`}
          rows={2}
          disabled={isSubmitting}
        />
        <div className="flex gap-2">
          <button
            onClick={handleCommentSubmit}
            disabled={isSubmitting}
            className={`px-3 py-1.5 ${sizes.text} rounded-lg bg-blue-600 text-white
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
          <button
            onClick={handleSkipComment}
            disabled={isSubmitting}
            className={`px-3 py-1.5 ${sizes.text} rounded-lg text-slate-600 dark:text-slate-300
              hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50
              transition-colors`}
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // Default button state
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className={`${sizes.text} text-slate-500 dark:text-slate-400 mr-1`}>
        Was this helpful?
      </span>

      <button
        onClick={() => handleFeedback('helpful')}
        disabled={isSubmitting}
        className={`${sizes.button} rounded-lg text-slate-500 dark:text-slate-400
          hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors`}
        title="Yes, this was helpful"
        aria-label="Mark as helpful"
      >
        <ThumbsUp className={sizes.icon} />
      </button>

      <button
        onClick={() => handleFeedback('not_helpful')}
        disabled={isSubmitting}
        className={`${sizes.button} rounded-lg text-slate-500 dark:text-slate-400
          hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors`}
        title="No, this wasn't helpful"
        aria-label="Mark as not helpful"
      >
        <ThumbsDown className={sizes.icon} />
      </button>
    </div>
  );
}

// ============================================================================
// Compact Inline Version
// ============================================================================

export interface InlineFeedbackProps {
  sessionId: string;
  onFeedback?: (feedback: 'helpful' | 'not_helpful') => void;
  className?: string;
}

/**
 * A minimal inline version of feedback buttons without labels.
 * Suitable for displaying at the end of messages.
 */
export function InlineFeedback({ sessionId, onFeedback, className = '' }: InlineFeedbackProps) {
  const [submitted, setSubmitted] = useState<FeedbackType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = useCallback(
    async (type: 'helpful' | 'not_helpful') => {
      if (submitted || isSubmitting) return;

      setIsSubmitting(true);
      const success = await submitFeedback(sessionId, type);

      if (success) {
        setSubmitted(type);
        onFeedback?.(type);
      }

      setIsSubmitting(false);
    },
    [sessionId, submitted, isSubmitting, onFeedback]
  );

  if (submitted) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-slate-400 ${className}`}>
        <Check className="w-3 h-3 text-green-500" />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${className}`}>
      <button
        onClick={() => handleFeedback('helpful')}
        disabled={isSubmitting}
        className="p-1 rounded text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20
          disabled:opacity-50 transition-colors"
        title="Helpful"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => handleFeedback('not_helpful')}
        disabled={isSubmitting}
        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
          disabled:opacity-50 transition-colors"
        title="Not helpful"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </span>
  );
}

export default FeedbackButtons;
