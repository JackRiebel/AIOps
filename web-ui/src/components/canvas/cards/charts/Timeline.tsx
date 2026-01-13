'use client';

import { memo, useMemo } from 'react';

interface TimelineEvent {
  id: string;
  timestamp: string | Date;
  label: string;
  description?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
  duration?: number;  // For events with duration (in minutes)
  icon?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  orientation?: 'vertical' | 'horizontal';
  showTime?: boolean;
  showDuration?: boolean;
  timeFormatter?: (date: Date) => string;
  maxEvents?: number;
  compact?: boolean;
  className?: string;
}

const TYPE_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  info: {
    dot: 'bg-cyan-500',
    bg: 'bg-cyan-50 dark:bg-cyan-900/20',
    text: 'text-cyan-700 dark:text-cyan-400',
  },
  success: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  warning: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
  },
  error: {
    dot: 'bg-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
  },
  neutral: {
    dot: 'bg-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
  },
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Timeline - Event timeline visualization
 *
 * Features:
 * - Vertical or horizontal layout
 * - Color-coded event types
 * - Duration indicators
 * - Compact mode
 */
export const Timeline = memo(({
  events,
  orientation = 'vertical',
  showTime = true,
  showDuration = true,
  timeFormatter = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  maxEvents = 20,
  compact = false,
  className = '',
}: TimelineProps) => {
  const sortedEvents = useMemo(() => {
    if (!events || events.length === 0) return [];

    return [...events]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxEvents);
  }, [events, maxEvents]);

  if (!events || events.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm ${className}`}>
        No events
      </div>
    );
  }

  if (orientation === 'horizontal') {
    return (
      <div className={`flex items-start overflow-x-auto pb-2 ${className}`}>
        {sortedEvents.map((event, index) => {
          const colors = TYPE_COLORS[event.type || 'neutral'];
          const date = new Date(event.timestamp);

          return (
            <div key={event.id || index} className="flex flex-col items-center flex-shrink-0 min-w-[80px]">
              {/* Time */}
              {showTime && (
                <span className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">
                  {timeFormatter(date)}
                </span>
              )}

              {/* Dot and line */}
              <div className="flex items-center">
                {index > 0 && (
                  <div className="w-8 h-0.5 bg-slate-200 dark:bg-slate-700" />
                )}
                <div className={`w-3 h-3 rounded-full ${colors.dot} ring-2 ring-white dark:ring-slate-900`} />
                {index < sortedEvents.length - 1 && (
                  <div className="w-8 h-0.5 bg-slate-200 dark:bg-slate-700" />
                )}
              </div>

              {/* Label */}
              <div className={`mt-1 px-2 py-1 rounded text-[10px] text-center ${colors.bg} ${colors.text}`}>
                {event.label}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical orientation
  return (
    <div className={`relative ${className}`}>
      {/* Timeline line */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

      <div className={`space-y-${compact ? '2' : '4'}`}>
        {sortedEvents.map((event, index) => {
          const colors = TYPE_COLORS[event.type || 'neutral'];
          const date = new Date(event.timestamp);

          return (
            <div key={event.id || index} className="relative flex items-start gap-3 pl-1">
              {/* Dot */}
              <div className={`relative z-10 w-5 h-5 rounded-full ${colors.dot} ring-2 ring-white dark:ring-slate-900 flex items-center justify-center flex-shrink-0`}>
                {event.icon && (
                  <span className="text-white text-[10px]">{event.icon}</span>
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 ${compact ? '' : 'pb-2'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium ${colors.text}`}>
                    {event.label}
                  </span>
                  {showTime && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {timeFormatter(date)}
                    </span>
                  )}
                  {showDuration && event.duration && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                      {formatDuration(event.duration)}
                    </span>
                  )}
                </div>

                {!compact && event.description && (
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

Timeline.displayName = 'Timeline';

export default Timeline;
