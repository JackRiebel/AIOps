'use client';

/**
 * SecurityEventsViz - Security Events Timeline Visualization
 *
 * Features:
 * - Event timeline with severity indicators
 * - Status summary
 * - Threat type distribution bar
 * - Filterable by severity/type
 */

import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusSummary, type StatusLevel } from '../widgets/StatusIndicator';
import { MetricGrid, type MetricTileProps } from '../widgets/MetricTile';
import { SegmentedProgress } from '../widgets/ProgressBar';

// =============================================================================
// Types
// =============================================================================

export interface SecurityEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  severity: StatusLevel;
  source?: string;
  type?: string;
}

export interface ThreatType {
  name: string;
  count: number;
  color: string;
}

export interface SecurityEventsData {
  events?: SecurityEvent[];
  summary?: Array<{
    status: StatusLevel;
    label: string;
    count: number;
    pulse?: boolean;
  }>;
  metrics?: Array<MetricTileProps>;
  threat_types?: ThreatType[];
  filters?: string[];
}

export interface SecurityEventsVizProps {
  data: SecurityEventsData | SecurityEvent[] | Record<string, unknown>;
  maxEvents?: number;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  offline: '#6b7280',
  unknown: '#94a3b8',
};

// =============================================================================
// Helper Functions
// =============================================================================

function formatEventTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}

// =============================================================================
// Component
// =============================================================================

export const SecurityEventsViz = memo(({ data, maxEvents = 8 }: SecurityEventsVizProps) => {
  const [filter, setFilter] = useState<string>('all');

  // Normalize data
  const normalizedData = useMemo((): SecurityEventsData => {
    if (Array.isArray(data)) {
      const events = data as SecurityEvent[];
      const critical = events.filter(e => e.severity === 'critical').length;
      const warning = events.filter(e => e.severity === 'warning').length;
      const healthy = events.filter(e => e.severity === 'healthy').length;

      return {
        events,
        summary: [
          { status: 'critical', label: 'Critical', count: critical, pulse: critical > 0 },
          { status: 'warning', label: 'Warning', count: warning, pulse: warning > 0 },
          { status: 'healthy', label: 'Info', count: healthy },
        ],
        filters: ['all', 'critical', 'warning', 'healthy'],
      };
    }

    return data as SecurityEventsData;
  }, [data]);

  const { events, summary, metrics, threat_types, filters } = normalizedData;

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const filtered = filter === 'all' ? events : events.filter(e => e.severity === filter || e.type === filter);
    return filtered.slice(0, maxEvents);
  }, [events, filter, maxEvents]);

  return (
    <div className="flex flex-col h-full p-3 space-y-3">
      {/* Summary */}
      {summary && summary.length > 0 && (
        <StatusSummary summary={summary} size="sm" />
      )}

      {/* Metrics */}
      {metrics && metrics.length > 0 && (
        <MetricGrid metrics={metrics} columns={2} size="sm" />
      )}

      {/* Threat Types Distribution */}
      {threat_types && threat_types.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
            Threat Types
          </div>
          <SegmentedProgress
            segments={threat_types.map(t => ({
              value: t.count,
              color: t.color,
              label: t.name,
            }))}
            size="sm"
          />
        </div>
      )}

      {/* Filter Tabs */}
      {filters && filters.length > 1 && (
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700/50 pb-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Event Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-slate-500 dark:text-slate-400">
            No security events match the current filter
          </div>
        ) : (
          <div className="relative pl-4">
            {/* Timeline line */}
            <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />

            <AnimatePresence mode="popLayout">
              {filteredEvents.map((event, index) => (
                <motion.div
                  key={event.id || `event-${index}`}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: index * 0.03 }}
                  className="relative mb-3 last:mb-0"
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-4 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900"
                    style={{ backgroundColor: STATUS_COLORS[event.severity] }}
                  />

                  {/* Event content */}
                  <div className="pl-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg p-2 -ml-2 transition-colors">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {event.title}
                    </div>
                    {event.description && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                        {event.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 dark:text-slate-500">
                      <span>{formatEventTime(event.timestamp)}</span>
                      {event.source && (
                        <>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                            {event.source}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      {events && events.length > maxEvents && (
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2 border-t border-slate-200 dark:border-slate-700/50">
          Showing {filteredEvents.length} of {events.length} events
        </div>
      )}
    </div>
  );
});

SecurityEventsViz.displayName = 'SecurityEventsViz';

export default SecurityEventsViz;
