'use client';

import { memo, useState, useMemo, useCallback, Fragment } from 'react';
import { Zap, ChevronRight, MapPin, Target } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Pagination } from './Pagination';
import type { TEEvent } from './types';

// ============================================================================
// Types
// ============================================================================

export interface EventsPanelProps {
  events: TEEvent[];
  loading: boolean;
  onAskAI?: (context: string) => void;
}

type SeverityFilter = 'all' | 'CRITICAL' | 'MAJOR' | 'MINOR';

// ============================================================================
// Severity Badge Component
// ============================================================================

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; border: string }> = {
    CRITICAL: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-700/50' },
    MAJOR: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-700/50' },
    MINOR: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-700/50' },
    INFO: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-700/50' },
  };
  const c = config[severity?.toUpperCase()] || { bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-600/50' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      {severity || 'UNKNOWN'}
    </span>
  );
}

// ============================================================================
// EventsPanel Component
// ============================================================================

export const EventsPanel = memo(({ events, loading, onAskAI }: EventsPanelProps) => {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  // Severity counts
  const severityCounts = useMemo(() => {
    const c = { CRITICAL: 0, MAJOR: 0, MINOR: 0 };
    events.forEach(e => {
      const s = e.severity?.toUpperCase();
      if (s === 'CRITICAL') c.CRITICAL++;
      else if (s === 'MAJOR') c.MAJOR++;
      else if (s === 'MINOR') c.MINOR++;
    });
    return c;
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (severityFilter === 'all') return events;
    return events.filter(e => e.severity?.toUpperCase() === severityFilter);
  }, [events, severityFilter]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const handleToggle = useCallback((eventId: string) => {
    setExpandedEventId(prev => prev === eventId ? null : eventId);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setExpandedEventId(null);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setExpandedEventId(null);
  }, []);

  const handleFilterChange = useCallback((filter: SeverityFilter) => {
    setSeverityFilter(filter);
    setCurrentPage(1);
    setExpandedEventId(null);
  }, []);

  if (events.length === 0 && !loading) {
    return (
      <DashboardCard title="Events" icon={<Zap className="w-4 h-4" />} accent="amber" compact>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No events detected</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All systems are operating normally</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Events" icon={<Zap className="w-4 h-4" />} accent="amber" compact>
      {/* Summary + Severity Filter Tabs */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}{severityFilter !== 'all' ? ` (${severityFilter.toLowerCase()})` : ''} of {events.length} total
        </p>
        <div className="flex gap-1">
          {([
            { key: 'all' as SeverityFilter, label: `All (${events.length})` },
            { key: 'CRITICAL' as SeverityFilter, label: `Critical (${severityCounts.CRITICAL})` },
            { key: 'MAJOR' as SeverityFilter, label: `Major (${severityCounts.MAJOR})` },
            { key: 'MINOR' as SeverityFilter, label: `Minor (${severityCounts.MINOR})` },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                severityFilter === f.key
                  ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="w-10 px-4 py-2.5"></th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Summary</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Severity</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Started</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Ended</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {paginatedEvents.map((event) => (
              <Fragment key={event.eventId}>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(event.eventId)} className="p-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition">
                      <ChevronRight className={`w-4 h-4 transition-transform ${expandedEventId === event.eventId ? 'rotate-90' : ''}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{event.summary}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">ID: {event.eventId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded text-xs font-medium">
                      {event.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={event.severity} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {new Date(event.startDate).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {event.endDate ? new Date(event.endDate).toLocaleString() : 'Ongoing'}
                  </td>
                </tr>

                {expandedEventId === event.eventId && (
                  <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="space-y-3">
                        {Array.isArray(event.agents) && event.agents.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5" /> Affected Agents ({event.agents.length})
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {event.agents.map((agent, i) => (
                                <span key={agent.agentId || i} className="px-2.5 py-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-300">
                                  {agent.agentName || 'Unknown Agent'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {event.affectedTargets !== undefined && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <Target className="w-3.5 h-3.5" />
                            <span>{event.affectedTargets} affected target{event.affectedTargets !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {onAskAI && (
                          <button
                            onClick={() => onAskAI(`Analyze this ThousandEyes event:\n- Summary: ${event.summary}\n- Type: ${event.type}\n- Severity: ${event.severity}\n- Start: ${event.startDate}\n- Agents affected: ${event.agents?.length || 0}`)}
                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded-lg hover:from-purple-700 hover:to-blue-700 transition font-medium"
                          >
                            Ask AI About This Event
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={events.length}
        filteredItems={filteredEvents.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </DashboardCard>
  );
});

EventsPanel.displayName = 'EventsPanel';

export default EventsPanel;
