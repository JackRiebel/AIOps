'use client';

import { memo, useState, useMemo, useCallback, Fragment } from 'react';
import { AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Pagination } from './Pagination';
import { isEnabled } from './types';
import type { Alert } from './types';

// ============================================================================
// Types
// ============================================================================

export interface AlertsTableProps {
  alerts: Alert[];
  loading: boolean;
}

type SeverityFilter = 'all' | 'CRITICAL' | 'MAJOR' | 'MINOR';

// ============================================================================
// Severity Badge Component
// ============================================================================

function SeverityBadge({ severity }: { severity: string }) {
  const severityConfig: Record<string, { bg: string; text: string; border: string; hasPulse?: boolean }> = {
    CRITICAL: {
      bg: 'bg-red-100 dark:bg-red-500/20',
      text: 'text-red-700 dark:text-red-400',
      border: 'border-red-200 dark:border-red-700/50',
      hasPulse: true,
    },
    MAJOR: {
      bg: 'bg-orange-100 dark:bg-orange-500/20',
      text: 'text-orange-700 dark:text-orange-400',
      border: 'border-orange-200 dark:border-orange-700/50',
    },
    MINOR: {
      bg: 'bg-amber-100 dark:bg-amber-500/20',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-700/50',
    },
    INFO: {
      bg: 'bg-blue-100 dark:bg-blue-500/20',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-700/50',
    },
  };

  const config = severityConfig[severity?.toUpperCase()] || {
    bg: 'bg-slate-100 dark:bg-slate-500/20',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-600/50',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
      {config.hasPulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}
      {severity || 'UNKNOWN'}
    </span>
  );
}

// ============================================================================
// Status Badge Component
// ============================================================================

function AlertStatusBadge({ active }: { active: number | boolean }) {
  return isEnabled(active) ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600/50">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Resolved
    </span>
  );
}

// ============================================================================
// Severity Distribution Bar
// ============================================================================

function SeverityDistributionBar({ alerts }: { alerts: Alert[] }) {
  const counts = useMemo(() => {
    const c = { CRITICAL: 0, MAJOR: 0, MINOR: 0, OTHER: 0 };
    alerts.forEach(a => {
      const s = a.severity?.toUpperCase();
      if (s === 'CRITICAL') c.CRITICAL++;
      else if (s === 'MAJOR') c.MAJOR++;
      else if (s === 'MINOR') c.MINOR++;
      else c.OTHER++;
    });
    return c;
  }, [alerts]);

  const total = alerts.length;
  if (total === 0) return null;

  const segments = [
    { key: 'CRITICAL', count: counts.CRITICAL, color: 'bg-red-500' },
    { key: 'MAJOR', count: counts.MAJOR, color: 'bg-orange-500' },
    { key: 'MINOR', count: counts.MINOR, color: 'bg-amber-400' },
    { key: 'OTHER', count: counts.OTHER, color: 'bg-slate-400' },
  ].filter(s => s.count > 0);

  return (
    <div className="mb-3">
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700/50">
        {segments.map(s => (
          <div
            key={s.key}
            className={`${s.color} transition-all duration-300`}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.key}: ${s.count}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        {segments.map(s => (
          <span key={s.key} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            {s.key} ({s.count})
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// AlertsTable Component
// ============================================================================

export const AlertsTable = memo(({
  alerts,
  loading,
}: AlertsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedAlertId, setExpandedAlertId] = useState<number | null>(null);
  const [alertDetail, setAlertDetail] = useState<Record<number, any>>({});
  const [loadingDetail, setLoadingDetail] = useState<Record<number, boolean>>({});
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  // Severity counts
  const severityCounts = useMemo(() => {
    const c = { CRITICAL: 0, MAJOR: 0, MINOR: 0 };
    alerts.forEach(a => {
      const s = a.severity?.toUpperCase();
      if (s === 'CRITICAL') c.CRITICAL++;
      else if (s === 'MAJOR') c.MAJOR++;
      else if (s === 'MINOR') c.MINOR++;
    });
    return c;
  }, [alerts]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (severityFilter === 'all') return alerts;
    return alerts.filter(a => a.severity?.toUpperCase() === severityFilter);
  }, [alerts, severityFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAlerts.length / pageSize);
  const paginatedAlerts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAlerts.slice(start, start + pageSize);
  }, [filteredAlerts, currentPage, pageSize]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setExpandedAlertId(null);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setExpandedAlertId(null);
  }, []);

  const handleFilterChange = useCallback((filter: SeverityFilter) => {
    setSeverityFilter(filter);
    setCurrentPage(1);
    setExpandedAlertId(null);
  }, []);

  const handleToggleAlert = useCallback(async (alertId: number) => {
    if (expandedAlertId === alertId) {
      setExpandedAlertId(null);
      return;
    }
    setExpandedAlertId(alertId);
    if (alertDetail[alertId]) return;
    try {
      setLoadingDetail(prev => ({ ...prev, [alertId]: true }));
      const response = await fetch(`/api/thousandeyes/alerts/${alertId}?organization=default`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAlertDetail(prev => ({ ...prev, [alertId]: data }));
      }
    } catch (err) {
      console.error('Failed to fetch alert detail:', err);
    } finally {
      setLoadingDetail(prev => ({ ...prev, [alertId]: false }));
    }
  }, [expandedAlertId, alertDetail]);

  // Active alerts count
  const activeCount = alerts.filter(a => isEnabled(a.active)).length;

  // Empty state
  if (alerts.length === 0 && !loading) {
    return (
      <DashboardCard title="Active Alerts" icon={<AlertTriangle className="w-4 h-4" />} accent="red" compact>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No active alerts</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All systems are operating normally</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      title="Active Alerts"
      icon={<AlertTriangle className="w-4 h-4" />}
      accent="red"
      compact
      badge={activeCount > 0 ? (
        <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-semibold rounded-full">
          {activeCount}
        </span>
      ) : undefined}
    >
      {/* Severity Distribution Bar */}
      <SeverityDistributionBar alerts={alerts} />

      {/* Summary + Severity Filter Tabs */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}{severityFilter !== 'all' ? ` (${severityFilter.toLowerCase()})` : ''} of {alerts.length} total
        </p>
        <div className="flex gap-1">
          {([
            { key: 'all' as SeverityFilter, label: `All (${alerts.length})` },
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

      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="w-10 px-4 py-2.5"></th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Test Name
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Severity
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Violations
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Started
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {paginatedAlerts.map((alert) => (
              <Fragment key={alert.alertId}>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleAlert(alert.alertId)} className="p-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition">
                      <ChevronRight className={`w-4 h-4 transition-transform ${expandedAlertId === alert.alertId ? 'rotate-90' : ''}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{alert.testName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                      {alert.ruleExpression}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {alert.violationCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {new Date(alert.dateStart).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <AlertStatusBadge active={alert.active} />
                  </td>
                </tr>

                {expandedAlertId === alert.alertId && (
                  <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                    <td colSpan={6} className="px-4 py-4">
                      {loadingDetail[alert.alertId] ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
                          <span className="ml-2 text-xs text-slate-500">Loading alert details...</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Alert ID</span>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{alert.alertId}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Violations</span>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{alert.violationCount}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Started</span>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{alert.dateStart ? new Date(alert.dateStart).toLocaleString() : 'N/A'}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Ended</span>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{alert.dateEnd ? new Date(alert.dateEnd).toLocaleString() : 'Ongoing'}</p>
                            </div>
                          </div>
                          <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Rule Expression</span>
                            <p className="text-sm font-mono text-slate-900 dark:text-white mt-1">{alert.ruleExpression}</p>
                          </div>
                          {Array.isArray(alertDetail[alert.alertId]?.agents) && alertDetail[alert.alertId].agents.length > 0 && (
                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Affected Agents</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {alertDetail[alert.alertId].agents.map((agent: any, i: number) => (
                                  <span key={agent.agentId || i} className="px-2.5 py-1 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-300">
                                    {agent.agentName || 'Unknown Agent'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={alerts.length}
        filteredItems={filteredAlerts.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </DashboardCard>
  );
});

AlertsTable.displayName = 'AlertsTable';

export default AlertsTable;
