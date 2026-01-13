'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, Circle, XCircle, AlertCircle, Check, MessageSquare } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ResolutionOutcome = 'resolved' | 'partial' | 'unhelpful' | 'incorrect';

export interface ChunkOutcome {
  chunkId: number;
  outcome: ResolutionOutcome;
}

export interface ResolutionOutcomeFeedbackProps {
  /** Query log ID to associate feedback with */
  queryLogId: number;
  /** Chunk IDs that were retrieved */
  chunkIds: number[];
  /** Callback when outcomes are submitted */
  onSubmit?: (outcomes: ChunkOutcome[], notes?: string) => void;
  /** Whether to show individual chunk selection or apply to all */
  perChunk?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// API Helper
// ============================================================================

async function submitOutcome(
  queryLogId: number,
  chunkOutcomes: Record<string, ResolutionOutcome>,
  notes?: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/knowledge/feedback/outcome', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        query_log_id: queryLogId,
        chunk_outcomes: chunkOutcomes,
        notes,
      }),
    });

    if (!response.ok) {
      console.error('Failed to submit outcome:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error submitting outcome:', error);
    return false;
  }
}

// ============================================================================
// Outcome Button Component
// ============================================================================

interface OutcomeButtonProps {
  outcome: ResolutionOutcome;
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  size: 'sm' | 'md';
}

function OutcomeButton({ outcome, label, icon, selected, onClick, disabled, size }: OutcomeButtonProps) {
  const colors: Record<ResolutionOutcome, { base: string; selected: string; hover: string }> = {
    resolved: {
      base: 'text-slate-500 dark:text-slate-400',
      selected: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700',
      hover: 'hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20',
    },
    partial: {
      base: 'text-slate-500 dark:text-slate-400',
      selected: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700',
      hover: 'hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
    },
    unhelpful: {
      base: 'text-slate-500 dark:text-slate-400',
      selected: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600',
      hover: 'hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
    },
    incorrect: {
      base: 'text-slate-500 dark:text-slate-400',
      selected: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700',
      hover: 'hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
    },
  };

  const sizeClasses = {
    sm: {
      button: 'px-2 py-1 text-xs',
      icon: 'w-3.5 h-3.5',
    },
    md: {
      button: 'px-3 py-1.5 text-sm',
      icon: 'w-4 h-4',
    },
  };

  const color = colors[outcome];
  const sizes = sizeClasses[size];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 rounded-lg border transition-colors
        ${sizes.button}
        ${selected
          ? color.selected
          : `${color.base} border-slate-200 dark:border-slate-700 ${color.hover}`
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      title={label}
    >
      <span className={sizes.icon}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ResolutionOutcomeFeedback({
  queryLogId,
  chunkIds,
  onSubmit,
  perChunk = false,
  size = 'sm',
  className = '',
}: ResolutionOutcomeFeedbackProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<ResolutionOutcome | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const outcomes: { value: ResolutionOutcome; label: string; icon: React.ReactNode }[] = [
    { value: 'resolved', label: 'Resolved', icon: <CheckCircle2 /> },
    { value: 'partial', label: 'Partial', icon: <Circle /> },
    { value: 'unhelpful', label: 'Not helpful', icon: <XCircle /> },
    { value: 'incorrect', label: 'Incorrect', icon: <AlertCircle /> },
  ];

  const handleOutcomeClick = useCallback((outcome: ResolutionOutcome) => {
    if (selectedOutcome === outcome) {
      setSelectedOutcome(null);
    } else {
      setSelectedOutcome(outcome);
    }
  }, [selectedOutcome]);

  const handleSubmit = useCallback(async () => {
    if (!selectedOutcome || isSubmitting) return;

    setIsSubmitting(true);

    // Apply selected outcome to all chunks
    const chunkOutcomes: Record<string, ResolutionOutcome> = {};
    chunkIds.forEach(id => {
      chunkOutcomes[String(id)] = selectedOutcome;
    });

    const success = await submitOutcome(queryLogId, chunkOutcomes, notes || undefined);

    if (success) {
      setSubmitted(true);
      onSubmit?.(
        chunkIds.map(id => ({ chunkId: id, outcome: selectedOutcome })),
        notes || undefined
      );
    }

    setIsSubmitting(false);
  }, [selectedOutcome, isSubmitting, queryLogId, chunkIds, notes, onSubmit]);

  const sizeClasses = {
    sm: { text: 'text-xs' },
    md: { text: 'text-sm' },
  };

  const sizes = sizeClasses[size];

  // Already submitted
  if (submitted) {
    return (
      <div className={`flex items-center gap-1.5 ${sizes.text} text-slate-500 dark:text-slate-400 ${className}`}>
        <Check className="w-4 h-4 text-green-500" />
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className={`${sizes.text} text-slate-600 dark:text-slate-300`}>
        Did this help resolve your issue?
      </div>

      <div className="flex flex-wrap gap-2">
        {outcomes.map(({ value, label, icon }) => (
          <OutcomeButton
            key={value}
            outcome={value}
            label={label}
            icon={icon}
            selected={selectedOutcome === value}
            onClick={() => handleOutcomeClick(value)}
            disabled={isSubmitting}
            size={size}
          />
        ))}
      </div>

      {selectedOutcome && (
        <div className="flex flex-col gap-2 mt-1">
          {!showNotes ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`px-3 py-1.5 ${sizes.text} rounded-lg bg-blue-600 text-white
                  hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
              <button
                onClick={() => setShowNotes(true)}
                disabled={isSubmitting}
                className={`flex items-center gap-1 px-2 py-1.5 ${sizes.text} rounded-lg
                  text-slate-500 dark:text-slate-400
                  hover:bg-slate-100 dark:hover:bg-slate-700
                  transition-colors`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Add note
              </button>
            </div>
          ) : (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What worked or what could be improved?"
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
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`px-3 py-1.5 ${sizes.text} rounded-lg bg-blue-600 text-white
                    hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  onClick={() => setShowNotes(false)}
                  disabled={isSubmitting}
                  className={`px-3 py-1.5 ${sizes.text} rounded-lg text-slate-600 dark:text-slate-300
                    hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50
                    transition-colors`}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Inline Version
// ============================================================================

export interface InlineResolutionFeedbackProps {
  queryLogId: number;
  chunkIds: number[];
  onSubmit?: (outcome: ResolutionOutcome) => void;
  className?: string;
}

/**
 * A compact inline version for displaying at the end of search results.
 */
export function InlineResolutionFeedback({
  queryLogId,
  chunkIds,
  onSubmit,
  className = '',
}: InlineResolutionFeedbackProps) {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuickFeedback = useCallback(async (outcome: ResolutionOutcome) => {
    if (submitted || isSubmitting) return;

    setIsSubmitting(true);

    const chunkOutcomes: Record<string, ResolutionOutcome> = {};
    chunkIds.forEach(id => {
      chunkOutcomes[String(id)] = outcome;
    });

    const success = await submitOutcome(queryLogId, chunkOutcomes);

    if (success) {
      setSubmitted(true);
      onSubmit?.(outcome);
    }

    setIsSubmitting(false);
  }, [submitted, isSubmitting, queryLogId, chunkIds, onSubmit]);

  if (submitted) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-slate-400 ${className}`}>
        <Check className="w-3 h-3 text-green-500" />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="text-xs text-slate-400 mr-1">Resolved?</span>
      <button
        onClick={() => handleQuickFeedback('resolved')}
        disabled={isSubmitting}
        className="p-1 rounded text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20
          disabled:opacity-50 transition-colors"
        title="Yes, resolved"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleQuickFeedback('partial')}
        disabled={isSubmitting}
        className="p-1 rounded text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20
          disabled:opacity-50 transition-colors"
        title="Partially helpful"
      >
        <Circle className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleQuickFeedback('unhelpful')}
        disabled={isSubmitting}
        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700
          disabled:opacity-50 transition-colors"
        title="Not helpful"
      >
        <XCircle className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

export default ResolutionOutcomeFeedback;
