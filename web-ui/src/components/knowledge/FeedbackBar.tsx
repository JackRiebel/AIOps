'use client';

import React, { useState, useCallback } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  Flag,
  Star,
  CheckCircle,
  X,
  MessageSquare,
} from 'lucide-react';

interface FeedbackBarProps {
  query: string;
  chunkIds: number[];
  responseText?: string;
  queryLogId?: number;
  onFeedbackSubmit?: (feedback: FeedbackData) => void;
  variant?: 'compact' | 'full';
  className?: string;
}

interface FeedbackData {
  query: string;
  feedback_type: string;
  chunk_ids: number[];
  response_text?: string;
  rating?: number;
  comment?: string;
  issues?: string[];
  query_log_id?: number;
}

const ISSUE_OPTIONS = [
  { value: 'inaccurate', label: 'Information is inaccurate' },
  { value: 'incomplete', label: 'Answer is incomplete' },
  { value: 'outdated', label: 'Information is outdated' },
  { value: 'irrelevant', label: 'Results not relevant' },
  { value: 'confusing', label: 'Response is confusing' },
];

export default function FeedbackBar({
  query,
  chunkIds,
  responseText,
  queryLogId,
  onFeedbackSubmit,
  variant = 'compact',
  className = '',
}: FeedbackBarProps) {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'positive' | 'negative' | 'rating' | 'report' | 'submitted'>('idle');
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedback = useCallback(async (type: string, additionalData?: Partial<FeedbackData>) => {
    setIsSubmitting(true);

    const feedbackData: FeedbackData = {
      query,
      feedback_type: type,
      chunk_ids: chunkIds,
      response_text: responseText,
      query_log_id: queryLogId,
      ...additionalData,
    };

    try {
      const response = await fetch('/api/knowledge/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(feedbackData),
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      setFeedbackState('submitted');
      onFeedbackSubmit?.(feedbackData);

      // Reset after 3 seconds
      setTimeout(() => {
        setFeedbackState('idle');
        setRating(0);
        setComment('');
        setSelectedIssues([]);
      }, 3000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setFeedbackState('idle');
    } finally {
      setIsSubmitting(false);
    }
  }, [query, chunkIds, responseText, queryLogId, onFeedbackSubmit]);

  const handleThumbsUp = () => {
    if (feedbackState === 'submitted') return;
    submitFeedback('positive');
    setFeedbackState('positive');
  };

  const handleThumbsDown = () => {
    if (feedbackState === 'submitted') return;
    if (variant === 'full') {
      setFeedbackState('report');
    } else {
      submitFeedback('negative');
      setFeedbackState('negative');
    }
  };

  const handleRatingClick = (value: number) => {
    setRating(value);
    submitFeedback('rating', { rating: value });
  };

  const handleReportSubmit = () => {
    submitFeedback('report', {
      comment,
      issues: selectedIssues,
    });
  };

  const toggleIssue = (issue: string) => {
    setSelectedIssues(prev =>
      prev.includes(issue)
        ? prev.filter(i => i !== issue)
        : [...prev, issue]
    );
  };

  // Submitted state
  if (feedbackState === 'submitted') {
    return (
      <div className={`flex items-center gap-2 text-green-600 dark:text-green-400 ${className}`}>
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm">Thanks for your feedback!</span>
      </div>
    );
  }

  // Report form (full variant)
  if (feedbackState === 'report' && variant === 'full') {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Report an issue</h4>
          <button
            onClick={() => setFeedbackState('idle')}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Issue checkboxes */}
        <div className="space-y-2 mb-4">
          {ISSUE_OPTIONS.map(issue => (
            <label
              key={issue.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIssues.includes(issue.value)}
                onChange={() => toggleIssue(issue.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{issue.label}</span>
            </label>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Additional details (optional)"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {/* Submit */}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => setFeedbackState('idle')}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleReportSubmit}
            disabled={isSubmitting || selectedIssues.length === 0}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    );
  }

  // Compact variant (default)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Was this helpful?</span>
        <button
          onClick={handleThumbsUp}
          disabled={isSubmitting || feedbackState === 'positive'}
          className={`p-1.5 rounded-md transition-colors ${
            feedbackState === 'positive'
              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
          }`}
          title="Helpful"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          onClick={handleThumbsDown}
          disabled={isSubmitting || feedbackState === 'negative'}
          className={`p-1.5 rounded-md transition-colors ${
            feedbackState === 'negative'
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
          }`}
          title="Not helpful"
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      {/* Left side: Thumbs */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-400">Was this helpful?</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleThumbsUp}
            disabled={isSubmitting}
            className={`p-2 rounded-md transition-colors ${
              feedbackState === 'positive'
                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
            }`}
            title="Helpful"
          >
            <ThumbsUp className="w-5 h-5" />
          </button>
          <button
            onClick={handleThumbsDown}
            disabled={isSubmitting}
            className={`p-2 rounded-md transition-colors ${
              feedbackState === 'negative' || feedbackState === 'report'
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
            title="Not helpful"
          >
            <ThumbsDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Right side: Star rating */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">Rate:</span>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => handleRatingClick(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              disabled={isSubmitting}
              className="p-0.5 transition-colors"
              title={`Rate ${value} star${value > 1 ? 's' : ''}`}
            >
              <Star
                className={`w-5 h-5 transition-colors ${
                  (hoverRating || rating) >= value
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Report button */}
        <button
          onClick={() => setFeedbackState('report')}
          disabled={isSubmitting}
          className="ml-2 p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md transition-colors"
          title="Report an issue"
        >
          <Flag className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Separate component for inline feedback in chat
export function InlineFeedback({
  messageId,
  onFeedback,
}: {
  messageId: string;
  onFeedback?: (type: 'positive' | 'negative') => void;
}) {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    onFeedback?.(type);
  };

  if (feedback) {
    return (
      <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" /> Feedback received
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => handleFeedback('positive')}
        className="p-1 text-gray-400 hover:text-green-500 transition-colors"
        title="Good response"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleFeedback('negative')}
        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
        title="Could be better"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
