'use client';

import { memo } from 'react';
import { ChevronDown, Lightbulb, Paintbrush } from 'lucide-react';
import type { Event } from './index';

// ============================================================================
// Types
// ============================================================================

export type TimelineEvent = Event;

export interface EventTimelineItemProps {
  event: TimelineEvent;
  isExpanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  formatTimestamp: (timestamp: string) => string;
}

// ============================================================================
// SourceBadge Component
// ============================================================================

function SourceBadge({ source }: { source: string }) {
  const sourceConfig: Record<string, { label: string; color: string }> = {
    meraki: {
      label: 'Meraki',
      color: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/40',
    },
    thousandeyes: {
      label: 'ThousandEyes',
      color: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/40',
    },
    splunk: {
      label: 'Splunk',
      color: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/40',
    },
  };

  const config = sourceConfig[source.toLowerCase()] || {
    label: source,
    color: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-500/40',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
}

// ============================================================================
// SeverityBadge Component
// ============================================================================

function SeverityBadge({ severity }: { severity: string }) {
  const severityConfig: Record<string, string> = {
    critical: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/50',
    high: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/50',
    medium: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/50',
    info: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/50',
    low: 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/50',
  };

  const color = severityConfig[severity.toLowerCase()] || severityConfig.info;

  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${color}`}>
      {severity}
    </span>
  );
}

// ============================================================================
// EventTimelineItem Component
// ============================================================================

export const EventTimelineItem = memo(({
  event,
  isExpanded,
  isLast,
  onToggle,
  formatTimestamp,
}: EventTimelineItemProps) => {
  // Strip HTML tags from description
  const cleanDescription = event.description?.replace(/<[^>]*>/g, '') || '';

  return (
    <div className="relative">
      {/* Connector line between cards */}
      {!isLast && (
        <div className="absolute left-6 top-full h-3 w-0.5 bg-gradient-to-b from-cyan-500/40 to-cyan-500/10 z-0" />
      )}

      {/* Event Card */}
      <div
        onClick={onToggle}
        className={`
          relative bg-white dark:bg-slate-800/40 rounded-lg p-3.5 border
          transition-all cursor-pointer mb-3 z-10 shadow-sm dark:shadow-none
          ${
            isExpanded
              ? 'border-cyan-500/50 bg-cyan-50/50 dark:bg-slate-800/60 shadow-md shadow-cyan-500/10'
              : 'border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600/50'
          }
        `}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <SourceBadge source={event.source} />
            <span className={`text-[10px] transition ${isExpanded ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {formatTimestamp(event.timestamp)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={event.severity} />
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* Title */}
        <h4
          className={`font-medium text-sm mb-1.5 transition ${
            isExpanded ? 'text-cyan-600 dark:text-cyan-300' : 'text-slate-900 dark:text-white'
          }`}
        >
          {event.title}
        </h4>

        {/* Description */}
        {cleanDescription && (
          <p className={`text-xs text-slate-600 dark:text-slate-400 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
            {cleanDescription}
          </p>
        )}

        {/* AI Cost & Token Info */}
        {event.ai_cost && event.ai_cost > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-600/50 flex items-center gap-4 text-[10px]">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="text-purple-600 dark:text-purple-300 font-medium">
                AI Cost: ${event.ai_cost.toFixed(4)}
              </span>
            </div>
            {event.token_count && event.token_count > 0 && (
              <div className="flex items-center gap-1.5">
                <Paintbrush className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="text-cyan-600 dark:text-cyan-300 font-medium">
                  {event.token_count.toLocaleString()} tokens
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

EventTimelineItem.displayName = 'EventTimelineItem';

export default EventTimelineItem;
