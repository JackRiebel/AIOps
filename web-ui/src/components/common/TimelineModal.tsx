'use client';

import { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TimelineEvent } from '@/types/agent-flow';

// Platform colors matching the agent flow
const PLATFORM_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  meraki: { bg: 'bg-teal-500', border: 'border-teal-400', icon: 'bg-teal-100 dark:bg-teal-900/50' },
  splunk: { bg: 'bg-orange-500', border: 'border-orange-400', icon: 'bg-orange-100 dark:bg-orange-900/50' },
  thousandeyes: { bg: 'bg-purple-500', border: 'border-purple-400', icon: 'bg-purple-100 dark:bg-purple-900/50' },
  catalyst: { bg: 'bg-blue-500', border: 'border-blue-400', icon: 'bg-blue-100 dark:bg-blue-900/50' },
  dnac: { bg: 'bg-indigo-500', border: 'border-indigo-400', icon: 'bg-indigo-100 dark:bg-indigo-900/50' },
  webex: { bg: 'bg-cyan-500', border: 'border-cyan-400', icon: 'bg-cyan-100 dark:bg-cyan-900/50' },
};

// Event type colors
const EVENT_COLORS: Record<string, { bg: string; border: string; iconBg: string; text: string }> = {
  query_start: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    iconBg: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400'
  },
  thinking: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-800',
    iconBg: 'bg-indigo-500',
    text: 'text-indigo-600 dark:text-indigo-400'
  },
  query_complete: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    iconBg: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400'
  },
  tool_start: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    iconBg: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400'
  },
  tool_complete: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    iconBg: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400'
  },
  agent_start: {
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800',
    iconBg: 'bg-violet-500',
    text: 'text-violet-600 dark:text-violet-400'
  },
  agent_complete: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    iconBg: 'bg-purple-500',
    text: 'text-purple-600 dark:text-purple-400'
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    iconBg: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400'
  },
};

// Get platform from tool name
const getPlatformFromTool = (toolName?: string): string | null => {
  if (!toolName) return null;
  const lower = toolName.toLowerCase();
  if (lower.includes('meraki')) return 'meraki';
  if (lower.includes('splunk')) return 'splunk';
  if (lower.includes('thousandeyes') || lower.includes('te_')) return 'thousandeyes';
  if (lower.includes('catalyst')) return 'catalyst';
  if (lower.includes('dnac')) return 'dnac';
  if (lower.includes('webex')) return 'webex';
  return null;
};

// Get colors based on event type and tool
const getEventColors = (event: TimelineEvent) => {
  // Check if it's a tool event with a known platform
  if (event.toolName) {
    const platform = getPlatformFromTool(event.toolName);
    if (platform && PLATFORM_COLORS[platform]) {
      const pColors = PLATFORM_COLORS[platform];
      return {
        bg: event.status === 'error'
          ? 'bg-red-50 dark:bg-red-900/20'
          : `${pColors.icon}`,
        border: event.status === 'error'
          ? 'border-red-300 dark:border-red-700'
          : pColors.border,
        iconBg: event.status === 'error' ? 'bg-red-500' : pColors.bg,
        text: event.status === 'error' ? 'text-red-600' : '',
      };
    }
  }

  // Fall back to event type colors
  const typeColors = EVENT_COLORS[event.type];
  if (typeColors) {
    if (event.status === 'error') {
      return EVENT_COLORS.error;
    }
    return typeColors;
  }

  // Default
  return {
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    border: 'border-slate-200 dark:border-slate-700',
    iconBg: 'bg-slate-500',
    text: 'text-slate-600 dark:text-slate-400',
  };
};

// Icon based on event type
const EventIcon = ({ type, toolName }: { type: string; toolName?: string }) => {
  // Platform-specific icons for tools
  if (toolName) {
    const platform = getPlatformFromTool(toolName);
    if (platform === 'meraki') {
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      );
    }
    if (platform === 'splunk') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    }
    if (platform === 'thousandeyes') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    }
  }

  // Event type icons
  switch (type) {
    case 'query_start':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'thinking':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'query_complete':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'tool_start':
    case 'tool_complete':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'agent_start':
    case 'agent_complete':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
};

export interface TimelineModalProps {
  timeline: TimelineEvent[];
  onClose: () => void;
  title?: string;
  subtitle?: string;
  loading?: boolean;
}

export const TimelineModal = memo(({
  timeline,
  onClose,
  title = 'Event Timeline',
  subtitle,
  loading = false,
}: TimelineModalProps) => {
  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Calculate total duration
  const totalDuration = timeline.length > 1
    ? new Date(timeline[timeline.length - 1].timestamp).getTime() - new Date(timeline[0].timestamp).getTime()
    : 0;

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {subtitle || `${timeline.length} events`}
                {totalDuration > 0 && ` • Total: ${formatDuration(totalDuration)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <svg className="w-12 h-12 mb-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p>Loading timeline events...</p>
            </div>
          ) : timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No events recorded</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-200 via-slate-200 to-emerald-200 dark:from-blue-800 dark:via-slate-700 dark:to-emerald-800" />

              {/* Events */}
              <div className="space-y-3">
                {timeline.map((event, index) => {
                  const colors = getEventColors(event);
                  const isFirst = index === 0;
                  const isLast = index === timeline.length - 1;

                  return (
                    <div key={event.id} className="relative flex gap-4 group">
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center ${colors.iconBg} text-white shrink-0 shadow-md transition-transform group-hover:scale-110`}>
                        <EventIcon type={event.type} toolName={event.toolName} />
                      </div>

                      {/* Event card */}
                      <div className={`flex-1 p-4 rounded-xl border-2 ${colors.bg} ${colors.border} shadow-sm transition-shadow hover:shadow-md`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Title row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {event.title}
                              </span>
                              {event.duration && (
                                <span className="text-xs px-2 py-0.5 bg-white/80 dark:bg-slate-700/80 rounded-full text-slate-600 dark:text-slate-300 font-mono shadow-sm">
                                  {formatDuration(event.duration)}
                                </span>
                              )}
                              {event.status === 'error' && (
                                <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600 dark:text-red-400 font-medium">
                                  Error
                                </span>
                              )}
                              {event.status === 'success' && isLast && (
                                <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-full text-emerald-600 dark:text-emerald-400 font-medium">
                                  Complete
                                </span>
                              )}
                            </div>

                            {/* Description */}
                            {event.description && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                {event.description}
                              </p>
                            )}

                            {/* Details */}
                            {event.details && Object.keys(event.details).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {Object.entries(event.details).map(([key, value]) => (
                                  value !== undefined && value !== null && (
                                    <span
                                      key={key}
                                      className="text-xs px-2 py-1 bg-white/60 dark:bg-slate-800/60 rounded text-slate-500 dark:text-slate-400"
                                    >
                                      <span className="font-medium">{key}:</span>{' '}
                                      {Array.isArray(value) ? value.length : String(value)}
                                    </span>
                                  )
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Timestamp */}
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap">
                            {formatTime(new Date(event.timestamp))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-500"></span>
              <span>Meraki</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-orange-500"></span>
              <span>Splunk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-500"></span>
              <span>ThousandEyes</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg transition-colors font-medium text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document root level
  if (typeof window === 'undefined') return null;

  return createPortal(modalContent, document.body);
});

TimelineModal.displayName = 'TimelineModal';

export default TimelineModal;
