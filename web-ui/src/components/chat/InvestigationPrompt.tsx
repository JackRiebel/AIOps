'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, Activity, Lightbulb, ChevronRight } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface Suggestion {
  type: 'incident' | 'health_check' | 'custom';
  label: string;
  prompt: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  incidentId?: number;
  description?: string;
}

export interface InvestigationPromptProps {
  /** Callback when user selects a suggestion */
  onSelectSuggestion: (prompt: string) => void;
  /** Callback when user dismisses the prompt */
  onDismiss?: () => void;
  /** Whether to auto-fetch suggestions on mount */
  autoFetch?: boolean;
  /** Custom CSS classes */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverityStyles(severity?: string) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-50 dark:bg-red-500/10',
        border: 'border-red-200 dark:border-red-500/30',
        icon: 'text-red-500',
        text: 'text-red-700 dark:text-red-400',
        badge: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
      };
    case 'high':
      return {
        bg: 'bg-orange-50 dark:bg-orange-500/10',
        border: 'border-orange-200 dark:border-orange-500/30',
        icon: 'text-orange-500',
        text: 'text-orange-700 dark:text-orange-400',
        badge: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
      };
    case 'medium':
      return {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200 dark:border-amber-500/30',
        icon: 'text-amber-500',
        text: 'text-amber-700 dark:text-amber-400',
        badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
      };
    default:
      return {
        bg: 'bg-cyan-50 dark:bg-cyan-500/10',
        border: 'border-cyan-200 dark:border-cyan-500/30',
        icon: 'text-cyan-500',
        text: 'text-cyan-700 dark:text-cyan-400',
        badge: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
      };
  }
}

function getIcon(type: Suggestion['type'], severity?: string) {
  if (type === 'incident') {
    return <AlertTriangle className={`w-5 h-5 ${getSeverityStyles(severity).icon}`} />;
  } else if (type === 'health_check') {
    return <Activity className="w-5 h-5 text-cyan-500" />;
  }
  return <Lightbulb className="w-5 h-5 text-amber-500" />;
}

// ============================================================================
// Main Component
// ============================================================================

export function InvestigationPrompt({
  onSelectSuggestion,
  onDismiss,
  autoFetch = true,
  className = '',
}: InvestigationPromptProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch suggestions from API
  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/suggestions', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
      // Provide a fallback suggestion
      setSuggestions([{
        type: 'health_check',
        label: 'Daily Health Check',
        prompt: 'Perform a comprehensive health check of my network infrastructure. Check device status, recent alerts, and any performance issues.',
        description: 'Review overall network health and recent events',
      }]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchSuggestions();
    }
  }, [autoFetch, fetchSuggestions]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  // Handle suggestion selection
  const handleSelect = useCallback((suggestion: Suggestion) => {
    onSelectSuggestion(suggestion.prompt);
    setDismissed(true);
  }, [onSelectSuggestion]);

  // Don't render if dismissed or no suggestions
  if (dismissed || (suggestions.length === 0 && !loading)) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className={`rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Suggested Actions
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label="Dismiss suggestions"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Suggestions */}
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => {
          const styles = getSeverityStyles(suggestion.severity);

          return (
            <button
              key={index}
              onClick={() => handleSelect(suggestion)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:shadow-md group ${styles.bg} ${styles.border}`}
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {getIcon(suggestion.type, suggestion.severity)}
              </div>

              {/* Content */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${styles.text}`}>
                    {suggestion.label}
                  </span>
                  {suggestion.severity && suggestion.type === 'incident' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${styles.badge}`}>
                      {suggestion.severity}
                    </span>
                  )}
                </div>
                {suggestion.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {suggestion.description}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
          Using default suggestions
        </p>
      )}
    </div>
  );
}

export default InvestigationPrompt;
