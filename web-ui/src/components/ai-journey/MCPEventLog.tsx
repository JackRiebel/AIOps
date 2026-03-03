'use client';

import { memo, useMemo } from 'react';
import { ListFilter } from 'lucide-react';
import type { MCPHealthEvent } from '@/types/mcp-monitor';

// ============================================================================
// Types
// ============================================================================

export interface MCPEventLogProps {
  events: MCPHealthEvent[];
}

// ============================================================================
// Helpers
// ============================================================================

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function severityDot(severity: MCPHealthEvent['severity']): string {
  switch (severity) {
    case 'error':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    case 'info':
    default:
      return 'bg-blue-500';
  }
}

function eventTypeBadge(eventType: MCPHealthEvent['event_type']): { bg: string; text: string } {
  switch (eventType) {
    case 'connection':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-400',
      };
    case 'tool_change':
      return {
        bg: 'bg-blue-100 dark:bg-blue-500/10',
        text: 'text-blue-700 dark:text-blue-400',
      };
    case 'error':
      return {
        bg: 'bg-red-100 dark:bg-red-500/10',
        text: 'text-red-700 dark:text-red-400',
      };
    case 'discovery':
      return {
        bg: 'bg-purple-100 dark:bg-purple-500/10',
        text: 'text-purple-700 dark:text-purple-400',
      };
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-700/50',
        text: 'text-slate-600 dark:text-slate-400',
      };
  }
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, ' ');
}

// ============================================================================
// MCPEventLog Component
// ============================================================================

export const MCPEventLog = memo(({ events }: MCPEventLogProps) => {
  // Sort by timestamp descending, limit to 20
  const sortedEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  }, [events]);

  if (sortedEvents.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ListFilter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Event Log
          </h4>
        </div>
        <p className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">
          No events recorded
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center gap-2">
          <ListFilter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Event Log
          </h4>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200/60 dark:border-slate-700/40">
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Server
              </th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Event
              </th>
              <th className="px-4 py-2 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Message
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {sortedEvents.map((event) => {
              const badge = eventTypeBadge(event.event_type);

              return (
                <tr
                  key={event.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                    {timeAgo(event.timestamp)}
                  </td>
                  <td className="px-4 py-2 text-[10px] text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap truncate max-w-[120px]">
                    {event.server_name}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${badge.bg} ${badge.text}`}
                    >
                      {formatEventType(event.event_type)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${severityDot(event.severity)}`}
                      title={event.severity}
                    />
                  </td>
                  <td className="px-4 py-2 text-[10px] text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {event.message}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

MCPEventLog.displayName = 'MCPEventLog';

export default MCPEventLog;
