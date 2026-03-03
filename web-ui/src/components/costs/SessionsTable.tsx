'use client';

import { memo, Fragment, useState, useMemo, useCallback } from 'react';
import { History, Loader2, Lightbulb, ChevronRight, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, Clock, AlertCircle, Link2, ListTree } from 'lucide-react';
import AISessionSummaryCard from '@/components/AISessionSummaryCard';
import { TimelineModal } from '@/components/common/TimelineModal';
import { StatusBadge } from './StatusBadge';
import LinkIncidentModal from './LinkIncidentModal';
import type { AISessionData } from './types';
import type { TimelineEvent } from '@/types/agent-flow';

// ============================================================================
// Sort Configuration
// ============================================================================

type SortField = 'started_at' | 'duration' | 'cost' | 'roi' | 'time_saved' | 'queries';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// ============================================================================
// Types
// ============================================================================

export interface SessionsTableProps {
  sessions: AISessionData[];
  loading: boolean;
  selectedSessionId: number | null;
  filter: 'all' | 'completed' | 'active';
  onSelectSession: (session: AISessionData | null) => void;
  onFilterChange: (filter: 'all' | 'completed' | 'active') => void;
  onRefresh: () => void;
  onLinkIncident?: (sessionId: number, incidentId: number, resolved: boolean) => Promise<void>;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatCost(cost: number): string {
  // Use consistent formatting: 2 decimals for >= $1, otherwise show enough precision
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  } else if (cost >= 0.01) {
    return `$${cost.toFixed(2)}`;
  } else {
    // For very small costs, show 4 decimals
    return `$${cost.toFixed(4)}`;
  }
}

function formatROI(roi: number): string {
  // Cap display at 99999% for readability
  if (roi > 99999) {
    return '>99999%';
  }
  return `${Math.round(roi).toLocaleString()}%`;
}

function getROIBadgeColor(roi: number | undefined): { bg: string; text: string } {
  if (roi === undefined || roi === null) return { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-500' };
  if (roi >= 500) return { bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' };
  if (roi >= 200) return { bg: 'bg-green-100 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400' };
  if (roi >= 100) return { bg: 'bg-yellow-100 dark:bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400' };
  return { bg: 'bg-red-100 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' };
}

function getSessionDuration(session: AISessionData): number {
  if (session.total_duration_ms) {
    return session.total_duration_ms / 60000;
  }
  if (session.ai_summary?.metrics?.duration_minutes) {
    return session.ai_summary.metrics.duration_minutes;
  }
  if (session.ended_at) {
    const start = new Date(session.started_at).getTime();
    const end = new Date(session.ended_at).getTime();
    return (end - start) / 60000;
  }
  return 0;
}

// ============================================================================
// SessionIcon Component
// ============================================================================

function SessionIcon({ status }: { status: 'active' | 'completed' }) {
  if (status === 'active') {
    return (
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100 dark:bg-amber-500/10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-cyan-100 dark:bg-cyan-500/10">
      <svg
        className="w-4 h-4 text-cyan-600 dark:text-cyan-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function TableHeader({
  filter,
  loading,
  onFilterChange,
  onRefresh,
}: {
  filter: 'all' | 'completed' | 'active';
  loading: boolean;
  onFilterChange: (filter: 'all' | 'completed' | 'active') => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Session History
        </h3>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="session-filter" className="sr-only">
          Filter sessions by status
        </label>
        <select
          id="session-filter"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as 'all' | 'completed' | 'active')}
          aria-label="Filter sessions by status"
          className="px-2 py-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        >
          <option value="all">All</option>
          <option value="completed">Completed</option>
          <option value="active">Active</option>
        </select>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          title="Refresh"
          aria-label="Refresh session list"
        >
          <RefreshCw
            className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SortableHeader Component
// ============================================================================

function SortableHeader({
  label,
  field,
  sortConfig,
  onSort,
  align = 'left',
}: {
  label: string;
  field: SortField;
  sortConfig: SortConfig;
  onSort: (field: SortField) => void;
  align?: 'left' | 'right';
}) {
  const isActive = sortConfig.field === field;
  const Icon = isActive
    ? (sortConfig.direction === 'asc' ? ArrowUp : ArrowDown)
    : ArrowUpDown;

  return (
    <th
      className={`px-4 py-2.5 text-${align} text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors select-none`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <Icon className={`w-3 h-3 ${isActive ? 'text-cyan-500' : 'text-slate-400'}`} />
      </div>
    </th>
  );
}

// ============================================================================
// SessionsTable Component
// ============================================================================

export const SessionsTable = memo(({
  sessions,
  loading,
  selectedSessionId,
  filter,
  onSelectSession,
  onFilterChange,
  onRefresh,
  onLinkIncident,
  className = '',
}: SessionsTableProps) => {
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'started_at',
    direction: 'desc',
  });

  // Link incident modal state
  const [linkingSession, setLinkingSession] = useState<AISessionData | null>(null);

  // Timeline modal state
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineSessionName, setTimelineSessionName] = useState<string>('');

  // Handle sort
  const handleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Fetch and display timeline for a session
  const handleViewTimeline = useCallback(async (session: AISessionData) => {
    setTimelineLoading(true);
    setTimelineSessionName(session.name || 'AI Session');
    setShowTimeline(true);

    try {
      const response = await fetch(`/api/ai-sessions/${session.id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch session details');
      }

      const data = await response.json();
      const events = data.events || [];

      // Transform session events into TimelineEvent format
      const timeline: TimelineEvent[] = events.map((event: {
        id: number;
        event_type: string;
        timestamp: string;
        event_data?: Record<string, unknown>;
        input_tokens?: number;
        output_tokens?: number;
        model?: string;
        api_endpoint?: string;
        api_method?: string;
        api_status?: number;
        api_duration_ms?: number;
        page_path?: string;
        element_id?: string;
        element_type?: string;
        duration_ms?: number;
        action_type?: string;
        cost_usd?: number;
      }) => {
        // Determine event title based on type
        let title = event.event_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        let description = '';
        let toolName: string | undefined;

        // Customize based on event type
        switch (event.event_type) {
          case 'ai_query':
            title = 'AI Query';
            description = event.model ? `Model: ${event.model}` : '';
            if (event.input_tokens || event.output_tokens) {
              description += ` | Tokens: ${event.input_tokens || 0} in / ${event.output_tokens || 0} out`;
            }
            break;
          case 'api_call':
            title = 'API Call';
            toolName = event.api_endpoint || undefined;
            description = `${event.api_method || 'GET'} ${event.api_endpoint || ''}`;
            if (event.api_status) {
              description += ` → ${event.api_status}`;
            }
            break;
          case 'navigation':
            title = 'Page Navigation';
            description = event.page_path || '';
            break;
          case 'click':
            title = 'User Click';
            description = event.element_type ? `${event.element_type}${event.element_id ? ` #${event.element_id}` : ''}` : '';
            break;
          case 'edit':
            title = 'Edit Action';
            description = event.action_type || '';
            break;
          case 'error':
            title = 'Error';
            description = (event.event_data as { message?: string })?.message || 'An error occurred';
            break;
          default:
            description = event.action_type || '';
        }

        return {
          id: `event-${event.id}`,
          timestamp: new Date(event.timestamp),
          type: event.event_type === 'ai_query' ? 'tool_use_complete'
              : event.event_type === 'api_call' ? 'tool_use_complete'
              : event.event_type === 'error' ? 'error'
              : 'agent_activity_complete',
          title,
          description,
          toolName,
          duration: event.duration_ms || event.api_duration_ms,
          status: event.event_type === 'error' ? 'error' as const
                : event.api_status && event.api_status >= 400 ? 'error' as const
                : 'success' as const,
          details: {
            ...event.event_data,
            input_tokens: event.input_tokens,
            output_tokens: event.output_tokens,
            model: event.model,
            cost_usd: event.cost_usd,
            api_endpoint: event.api_endpoint,
            api_method: event.api_method,
            api_status: event.api_status,
          },
        };
      });

      setTimelineEvents(timeline);
    } catch (err) {
      console.error('Failed to fetch session timeline:', err);
      setTimelineEvents([]);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  // Sorted sessions
  const sortedSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortConfig.field) {
        case 'started_at':
          aVal = new Date(a.started_at).getTime();
          bVal = new Date(b.started_at).getTime();
          break;
        case 'duration':
          aVal = getSessionDuration(a);
          bVal = getSessionDuration(b);
          break;
        case 'cost':
          aVal = a.total_cost_usd || 0;
          bVal = b.total_cost_usd || 0;
          break;
        case 'roi':
          aVal = a.roi_percentage ?? -Infinity;
          bVal = b.roi_percentage ?? -Infinity;
          break;
        case 'time_saved':
          aVal = a.time_saved_minutes ?? 0;
          bVal = b.time_saved_minutes ?? 0;
          break;
        case 'queries':
          aVal = a.ai_query_count || 0;
          bVal = b.ai_query_count || 0;
          break;
        default:
          return 0;
      }

      if (sortConfig.direction === 'asc') {
        return aVal - bVal;
      }
      return bVal - aVal;
    });

    return sorted;
  }, [sessions, sortConfig]);

  // Loading state (initial)
  if (loading && sessions.length === 0) {
    return (
      <div className={className}>
        <TableHeader filter={filter} loading={loading} onFilterChange={onFilterChange} onRefresh={onRefresh} />
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading sessions...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (sessions.length === 0) {
    return (
      <div className={className}>
        <TableHeader filter={filter} loading={loading} onFilterChange={onFilterChange} onRefresh={onRefresh} />
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 mb-3 bg-cyan-100 dark:bg-cyan-500/10 rounded-full flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No AI sessions yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Start an AI session from the top bar to track your work
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <TableHeader filter={filter} loading={loading} onFilterChange={onFilterChange} onRefresh={onRefresh} />
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-colors overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 z-10">
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider w-8" />
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Session
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <SortableHeader label="Started" field="started_at" sortConfig={sortConfig} onSort={handleSort} />
              <SortableHeader label="Duration" field="duration" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableHeader label="Queries" field="queries" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableHeader label="Cost" field="cost" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableHeader label="Time Saved" field="time_saved" sortConfig={sortConfig} onSort={handleSort} align="right" />
              <SortableHeader label="ROI" field="roi" sortConfig={sortConfig} onSort={handleSort} align="right" />
              {onLinkIncident && (
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider w-20">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {sortedSessions.map((session) => {
              const duration = getSessionDuration(session);
              const roiColors = getROIBadgeColor(session.roi_percentage);

              return (
                <Fragment key={session.id}>
                  <tr
                    onClick={() =>
                      onSelectSession(
                        selectedSessionId === session.id ? null : session
                      )
                    }
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${
                      selectedSessionId === session.id
                        ? 'bg-cyan-50/50 dark:bg-cyan-900/10'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <ChevronRight
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          selectedSessionId === session.id ? 'rotate-90' : ''
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <SessionIcon status={session.status as 'active' | 'completed'} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {session.name || 'Untitled Session'}
                            </p>
                            {session.session_type && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400">
                                {session.session_type}
                              </span>
                            )}
                            {session.incident_id && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <AlertCircle className="w-2.5 h-2.5" />
                                Incident
                              </span>
                            )}
                          </div>
                          {session.ai_summary?.outcome && (
                            <p
                              className="text-xs text-slate-500 truncate max-w-xs"
                              title={session.ai_summary.outcome}
                            >
                              {session.ai_summary.outcome}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status as 'active' | 'completed'} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono">
                      {new Date(session.started_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-700 dark:text-slate-300 font-mono">
                      {duration > 0 ? formatDuration(duration) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-700 dark:text-slate-300 font-medium">
                      {session.ai_query_count}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-600 dark:text-cyan-400">
                      {formatCost(session.total_cost_usd)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {session.time_saved_minutes != null ? (
                        <span className="flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400">
                          <Clock className="w-3 h-3" />
                          {formatDuration(session.time_saved_minutes)}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.roi_percentage != null ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roiColors.bg} ${roiColors.text}`}>
                          <TrendingUp className="w-3 h-3" />
                          {formatROI(session.roi_percentage)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    {onLinkIncident && (
                      <td className="px-4 py-3 text-center">
                        {session.incident_id ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            Linked
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLinkingSession(session);
                            }}
                            className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/10 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                            title="Link to Incident"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* Expanded Detail Row */}
                  {selectedSessionId === session.id && (
                    <tr>
                      <td colSpan={onLinkIncident ? 10 : 9} className="px-0 py-0">
                        <div className="border-t border-b border-cyan-200/50 dark:border-cyan-500/10 bg-cyan-50/30 dark:bg-cyan-900/5">
                          <div className="p-4">
                            <AISessionSummaryCard session={session} embedded />
                            {/* View Timeline Button */}
                            {session.total_events > 0 && (
                              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50 flex justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewTimeline(session);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-cyan-50 dark:bg-cyan-900/30 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400 rounded-lg transition-colors font-medium text-sm"
                                >
                                  <ListTree className="w-4 h-4" />
                                  View Session Timeline ({session.total_events} events)
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/30 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Showing {sortedSessions.length} session{sortedSessions.length !== 1 ? 's' : ''}
            {sortConfig.field !== 'started_at' && (
              <span className="ml-2 text-xs text-cyan-500">
                sorted by {sortConfig.field.replace('_', ' ')}
              </span>
            )}
          </span>
          <span className="text-xs text-slate-400">Click headers to sort, rows to expand</span>
        </div>
      </div>

      {/* Link Incident Modal */}
      {onLinkIncident && linkingSession && (
        <LinkIncidentModal
          isOpen={!!linkingSession}
          sessionId={linkingSession.id}
          sessionName={linkingSession.name || 'Untitled Session'}
          onClose={() => setLinkingSession(null)}
          onLink={async (sessionId, incidentId, resolved) => {
            await onLinkIncident(sessionId, incidentId, resolved);
            setLinkingSession(null);
          }}
        />
      )}

      {/* Timeline Modal */}
      {showTimeline && (
        <TimelineModal
          timeline={timelineEvents}
          onClose={() => {
            setShowTimeline(false);
            setTimelineEvents([]);
          }}
          title={`Session Timeline: ${timelineSessionName}`}
          loading={timelineLoading}
        />
      )}
    </div>
  );
});

SessionsTable.displayName = 'SessionsTable';

export default SessionsTable;
