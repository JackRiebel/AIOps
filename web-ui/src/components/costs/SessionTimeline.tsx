'use client';

import { useMemo } from 'react';
import {
  Sparkles,
  Database,
  MousePointer,
  Navigation,
  Edit3,
  AlertCircle,
  Clock,
  Play,
  Square,
  FileText,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface TimelineEvent {
  id: number;
  timestamp: string;
  event_type: 'ai_query' | 'api_call' | 'navigation' | 'click' | 'edit' | 'error' | 'session_start' | 'session_end';
  action_type?: string;
  page_path?: string;
  cost_usd?: number;
  duration_ms?: number;
  time_saved_minutes?: number;
  event_data?: {
    query?: string;
    response_preview?: string;
    endpoint?: string;
    method?: string;
    status_code?: number;
    element?: string;
    error_message?: string;
    tokens?: {
      input: number;
      output: number;
    };
  };
}

interface SessionTimelineProps {
  sessionName: string;
  events: TimelineEvent[];
  totalCost: number;
  totalDuration: number;
  timeSaved?: number;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(timestamp: string, baseTime?: string): string {
  const date = new Date(timestamp);
  if (baseTime) {
    const base = new Date(baseTime);
    const diffMs = date.getTime() - base.getTime();
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function getEventIcon(type: TimelineEvent['event_type']) {
  switch (type) {
    case 'ai_query':
      return <Sparkles className="w-4 h-4" />;
    case 'api_call':
      return <Database className="w-4 h-4" />;
    case 'navigation':
      return <Navigation className="w-4 h-4" />;
    case 'click':
      return <MousePointer className="w-4 h-4" />;
    case 'edit':
      return <Edit3 className="w-4 h-4" />;
    case 'error':
      return <AlertCircle className="w-4 h-4" />;
    case 'session_start':
      return <Play className="w-4 h-4" />;
    case 'session_end':
      return <Square className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

function getEventColor(type: TimelineEvent['event_type']): { bg: string; text: string; line: string } {
  switch (type) {
    case 'ai_query':
      return { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400', line: 'bg-cyan-300 dark:bg-cyan-500/50' };
    case 'api_call':
      return { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', line: 'bg-blue-300 dark:bg-blue-500/50' };
    case 'navigation':
      return { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', line: 'bg-purple-300 dark:bg-purple-500/50' };
    case 'click':
      return { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', line: 'bg-slate-300 dark:bg-slate-500/50' };
    case 'edit':
      return { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', line: 'bg-amber-300 dark:bg-amber-500/50' };
    case 'error':
      return { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', line: 'bg-red-300 dark:bg-red-500/50' };
    case 'session_start':
      return { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', line: 'bg-emerald-300 dark:bg-emerald-500/50' };
    case 'session_end':
      return { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', line: 'bg-slate-300 dark:bg-slate-500/50' };
    default:
      return { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', line: 'bg-slate-300 dark:bg-slate-500/50' };
  }
}

function getEventLabel(event: TimelineEvent): string {
  switch (event.event_type) {
    case 'ai_query':
      return 'AI Query';
    case 'api_call':
      return `API: ${event.event_data?.method || 'GET'} ${event.event_data?.endpoint || ''}`.trim();
    case 'navigation':
      return `Navigated to ${event.page_path || 'page'}`;
    case 'click':
      return `Clicked ${event.event_data?.element || 'element'}`;
    case 'edit':
      return event.action_type || 'Edit action';
    case 'error':
      return 'Error';
    case 'session_start':
      return 'Session started';
    case 'session_end':
      return 'Session ended';
    default:
      return event.action_type || 'Event';
  }
}

// ============================================================================
// Component
// ============================================================================

export function SessionTimeline({
  sessionName,
  events,
  totalCost,
  totalDuration,
  timeSaved,
  className = '',
}: SessionTimelineProps) {
  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [events]);

  const baseTime = sortedEvents[0]?.timestamp;

  const runningCosts = useMemo(() => {
    return sortedEvents.reduce<number[]>((acc, event) => {
      const prevTotal = acc.length > 0 ? acc[acc.length - 1] : 0;
      acc.push(prevTotal + (event.cost_usd || 0));
      return acc;
    }, []);
  }, [sortedEvents]);

  if (events.length === 0) {
    return (
      <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6 ${className}`}>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          No timeline events available
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Session Timeline
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {sessionName}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-5 max-h-96 overflow-y-auto">
        <div className="relative">
          {sortedEvents.map((event, index) => {
            const colors = getEventColor(event.event_type);
            const isLast = index === sortedEvents.length - 1;

            return (
              <div key={event.id || index} className="relative flex gap-4 pb-4">
                {/* Timeline line */}
                {!isLast && (
                  <div
                    className={`absolute left-[15px] top-8 w-0.5 h-[calc(100%-16px)] ${colors.line}`}
                  />
                )}

                {/* Icon */}
                <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center`}>
                  <span className={colors.text}>{getEventIcon(event.event_type)}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {getEventLabel(event)}
                      </p>

                      {/* Query preview for AI queries */}
                      {event.event_type === 'ai_query' && event.event_data?.query && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-md" title={event.event_data.query}>
                          &quot;{event.event_data.query}&quot;
                        </p>
                      )}

                      {/* Error message */}
                      {event.event_type === 'error' && event.event_data?.error_message && (
                        <p className="text-xs text-red-500 mt-0.5 truncate max-w-md">
                          {event.event_data.error_message}
                        </p>
                      )}

                      {/* Metadata row */}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatTimestamp(event.timestamp, baseTime)}
                        </span>

                        {event.duration_ms != null && event.duration_ms > 0 && (
                          <span className="text-[10px] text-slate-400">
                            {formatDuration(event.duration_ms)}
                          </span>
                        )}

                        {event.event_data?.tokens && (
                          <span className="text-[10px] text-slate-400">
                            {((event.event_data.tokens.input + event.event_data.tokens.output) / 1000).toFixed(1)}K tokens
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cost */}
                    {event.cost_usd != null && event.cost_usd > 0 && (
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                          {formatCost(event.cost_usd)}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          Total: {formatCost(runningCosts[index])}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {events.length} events
          </span>
          <div className="flex items-center gap-4">
            <span className="text-slate-600 dark:text-slate-300">
              Duration: <span className="font-mono">{Math.round(totalDuration / 60000)}m</span>
            </span>
            <span className="text-cyan-600 dark:text-cyan-400 font-medium">
              Cost: {formatCost(totalCost)}
            </span>
            {timeSaved != null && timeSaved > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400">
                Saved: {Math.round(timeSaved)}m
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SessionTimeline;
