'use client';

/**
 * Timeline Visualization
 *
 * Displays events in a chronological timeline.
 * Used for security events, BGP changes, incidents.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { STATUS_COLORS } from '../types';

interface TimelineEvent {
  id?: string;
  timestamp: string | Date;
  title: string;
  description?: string;
  type?: string;
  severity?: string;
  icon?: React.ReactNode;
  [key: string]: unknown;
}

interface TimelineProps {
  data: TimelineEvent[];
  compact?: boolean;
  maxItems?: number;
  showTime?: boolean;
  typeField?: string;
  severityField?: string;
  severityColors?: Record<string, string>;
  onEventClick?: (event: TimelineEvent) => void;
}

export const Timeline = memo(({
  data,
  compact = false,
  maxItems = 10,
  showTime = true,
  typeField = 'type',
  severityField = 'severity',
  severityColors = STATUS_COLORS,
  onEventClick,
}: TimelineProps) => {
  // Sort by timestamp descending and limit - filter out invalid timestamps
  const events = useMemo(() => {
    return [...data]
      .filter((event) => {
        // Filter out events without valid timestamps
        if (!event.timestamp) return false;
        const time = new Date(event.timestamp).getTime();
        return !isNaN(time);
      })
      .sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, maxItems);
  }, [data, maxItems]);

  if (events.length === 0) {
    // Check if we had data but no valid timestamps
    const hadData = data.length > 0;
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        {hadData ? 'No events with valid timestamps' : 'No events'}
      </div>
    );
  }

  return (
    <div className={`h-full overflow-auto ${compact ? 'py-1' : 'py-3'} px-2`}>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-2 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700/50" />

        {/* Events */}
        {events.map((event, index) => {
          const eventType = String(event[typeField] ?? event.type ?? 'info').toLowerCase();
          const severity = String(event[severityField] ?? event.severity ?? '').toLowerCase();
          const color = severityColors[severity] ?? severityColors[eventType] ?? '#6b7280';

          return (
            <motion.div
              key={event.id ?? index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onEventClick?.(event)}
              className={`
                relative pl-6 mb-3 last:mb-0
                ${onEventClick ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/30 rounded-lg p-1 -ml-1' : ''}
              `}
            >
              {/* Timeline dot */}
              <div
                className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 bg-white dark:bg-slate-900"
                style={{ borderColor: color }}
              >
                <div
                  className="absolute inset-1 rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>

              {/* Content */}
              <div className={compact ? '' : 'pb-1'}>
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className={`font-medium text-slate-900 dark:text-white ${compact ? 'text-xs' : 'text-sm'}`}>
                    {event.title}
                  </span>
                  {event.type && !compact && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium capitalize"
                      style={{
                        backgroundColor: `${color}20`,
                        color,
                      }}
                    >
                      {eventType}
                    </span>
                  )}
                </div>

                {/* Description */}
                {event.description && !compact && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {event.description}
                  </p>
                )}

                {/* Timestamp */}
                {showTime && (
                  <span className={`text-slate-500 ${compact ? 'text-xs' : 'text-xs mt-1 block'}`}>
                    {formatTimestamp(event.timestamp)}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* More indicator */}
      {data.length > maxItems && (
        <div className="text-center text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/50">
          +{data.length - maxItems} more events
        </div>
      )}
    </div>
  );
});

Timeline.displayName = 'Timeline';

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimestamp(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
