'use client';

import { memo, useState, useMemo, useCallback, Fragment } from 'react';
import {
  AlertTriangle, ChevronRight, ChevronDown, Loader2, Clock,
  Activity, Users, Shield, ExternalLink, Bell, BellOff,
} from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Pagination } from './Pagination';
import type { Alert } from './types';

// ============================================================================
// Types
// ============================================================================

export interface AlertsTableProps {
  alerts: Alert[];
  loading: boolean;
}

type SeverityFilter = 'all' | 'CRITICAL' | 'MAJOR' | 'MINOR';
type StatusFilter = 'all' | 'active' | 'resolved';

// ============================================================================
// Helpers
// ============================================================================

/** Check if an alert is active — handles all TE v6/v7 formats */
function isAlertActive(alert: Alert): boolean {
  // v7: state field
  if (alert.state) return alert.state.toLowerCase() === 'active';
  // v6: active field (int or bool)
  if (alert.active === 1 || alert.active === true) return true;
  // If no dateEnd, treat as active
  if (alert.active === undefined && !alert.dateEnd) return true;
  return false;
}

/** Format a duration between two dates as a human-readable string */
function formatDuration(start: string, end?: string): string {
  try {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const ms = endDate.getTime() - startDate.getTime();
    if (ms < 0) return '—';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return '<1m';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  } catch {
    return '—';
  }
}

/** Format date relative to now */
function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const ms = now.getTime() - date.getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Severity Badge
// ============================================================================

const SEVERITY_CONFIG: Record<string, {
  bg: string; text: string; border: string; dot: string; barColor: string; hasPulse?: boolean;
}> = {
  CRITICAL: {
    bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-700/50', dot: 'bg-red-500', barColor: 'bg-red-500', hasPulse: true,
  },
  MAJOR: {
    bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-700/50', dot: 'bg-orange-500', barColor: 'bg-orange-500',
  },
  MINOR: {
    bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-700/50', dot: 'bg-amber-500', barColor: 'bg-amber-400',
  },
  INFO: {
    bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-700/50', dot: 'bg-blue-500', barColor: 'bg-blue-400',
  },
};

const DEFAULT_SEVERITY_CONFIG = {
  bg: 'bg-slate-100 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400',
  border: 'border-slate-200 dark:border-slate-600/50', dot: 'bg-slate-400', barColor: 'bg-slate-400',
};

function SeverityBadge({ severity }: { severity: string }) {
  const config = SEVERITY_CONFIG[severity?.toUpperCase()] || DEFAULT_SEVERITY_CONFIG;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
      {config.hasPulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      )}
      {severity || 'UNKNOWN'}
    </span>
  );
}

// ============================================================================
// Row-level severity left border color
// ============================================================================

function severityBorderClass(severity: string): string {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 'border-l-4 border-l-red-500';
    case 'MAJOR': return 'border-l-4 border-l-orange-500';
    case 'MINOR': return 'border-l-4 border-l-amber-400';
    default: return 'border-l-4 border-l-slate-300 dark:border-l-slate-600';
  }
}

// ============================================================================
// Status Badge
// ============================================================================

function AlertStatusBadge({ alert }: { alert: Alert }) {
  const active = isAlertActive(alert);
  return active ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Cleared
    </span>
  );
}

// ============================================================================
// Duration Badge
// ============================================================================

function DurationBadge({ alert }: { alert: Alert }) {
  const active = isAlertActive(alert);
  const dur = formatDuration(alert.dateStart, active ? undefined : alert.dateEnd);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
      active ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
    }`}>
      <Clock className="w-3 h-3" />
      {dur}
    </span>
  );
}

// ============================================================================
// Severity Distribution Bar
// ============================================================================

function SeverityDistributionBar({ alerts, activeCount }: { alerts: Alert[]; activeCount: number }) {
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
    <div className="mb-4">
      {/* Summary stats row */}
      <div className="flex items-center gap-4 mb-2.5">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-red-500" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">{activeCount}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BellOff className="w-3.5 h-3.5 text-green-500" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">{total - activeCount}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">cleared</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400">{total} total</span>
        </div>
      </div>
      {/* Bar */}
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
// Expanded Alert Detail Panel
// ============================================================================

function AlertDetailPanel({
  alert,
  detail,
  loading,
}: {
  alert: Alert;
  detail: any;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
        <span className="ml-2 text-xs text-slate-500">Loading alert details...</span>
      </div>
    );
  }

  const active = isAlertActive(alert);
  const agents = detail?.agents || alert.agents || [];
  const ruleExpr = alert.ruleExpression || detail?.ruleExpression || '';
  const ruleName = alert.ruleName || detail?.ruleName || '';
  const alertType = alert.alertType || detail?.type?.name || detail?.alertType || alert.type || '';

  return (
    <div className="space-y-3 py-1">
      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Alert ID</span>
          <p className="text-xs font-mono font-medium text-slate-900 dark:text-white mt-0.5 truncate" title={String(alert.alertId)}>
            {String(alert.alertId).slice(0, 12)}...
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Violations</span>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{alert.violationCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Started</span>
          <p className="text-xs font-medium text-slate-900 dark:text-white mt-0.5">
            {alert.dateStart ? new Date(alert.dateStart).toLocaleString() : 'N/A'}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ended</span>
          <p className={`text-xs font-medium mt-0.5 ${active ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
            {active ? 'Ongoing' : alert.dateEnd ? new Date(alert.dateEnd).toLocaleString() : 'N/A'}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Duration</span>
          <p className={`text-xs font-bold mt-0.5 ${active ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
            {formatDuration(alert.dateStart, active ? undefined : alert.dateEnd)}
          </p>
        </div>
      </div>

      {/* Alert type + rule */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {alertType && (
          <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Alert Type</span>
            <p className="text-sm text-slate-900 dark:text-white mt-0.5">{alertType}</p>
          </div>
        )}
        {ruleName && (
          <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700/50">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Rule Name</span>
            <p className="text-sm text-slate-900 dark:text-white mt-0.5">{ruleName}</p>
          </div>
        )}
      </div>

      {/* Rule expression */}
      {ruleExpr && (
        <div className="bg-slate-900 dark:bg-slate-950 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50">
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Rule Expression</span>
          <p className="text-sm font-mono text-emerald-400 mt-1">{ruleExpr}</p>
        </div>
      )}

      {/* Affected agents */}
      {agents.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Affected Agents ({agents.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {agents.map((agent: any, i: number) => (
              <span
                key={agent.agentId || i}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                {agent.agentName || `Agent ${agent.agentId}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* View in ThousandEyes link */}
      {alert.testId && (
        <div className="pt-1">
          <a
            href={`https://app.thousandeyes.com/alerts/list?testId=${alert.testId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View in ThousandEyes
          </a>
        </div>
      )}
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
  const [expandedAlertId, setExpandedAlertId] = useState<string | number | null>(null);
  const [alertDetail, setAlertDetail] = useState<Record<string, any>>({});
  const [loadingDetail, setLoadingDetail] = useState<Record<string, boolean>>({});
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Counts
  const { severityCounts, activeCount } = useMemo(() => {
    const c = { CRITICAL: 0, MAJOR: 0, MINOR: 0 };
    let act = 0;
    alerts.forEach(a => {
      const s = a.severity?.toUpperCase();
      if (s === 'CRITICAL') c.CRITICAL++;
      else if (s === 'MAJOR') c.MAJOR++;
      else if (s === 'MINOR') c.MINOR++;
      if (isAlertActive(a)) act++;
    });
    return { severityCounts: c, activeCount: act };
  }, [alerts]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    let filtered = alerts;
    if (severityFilter !== 'all') {
      filtered = filtered.filter(a => a.severity?.toUpperCase() === severityFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a =>
        statusFilter === 'active' ? isAlertActive(a) : !isAlertActive(a)
      );
    }
    return filtered;
  }, [alerts, severityFilter, statusFilter]);

  // Pagination
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

  const handleStatusFilter = useCallback((filter: StatusFilter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
    setExpandedAlertId(null);
  }, []);

  const handleToggleAlert = useCallback(async (alertId: string | number) => {
    if (expandedAlertId === alertId) {
      setExpandedAlertId(null);
      return;
    }
    setExpandedAlertId(alertId);
    const key = String(alertId);
    if (alertDetail[key]) return;
    try {
      setLoadingDetail(prev => ({ ...prev, [key]: true }));
      const response = await fetch(`/api/thousandeyes/alerts/${alertId}?organization=default`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAlertDetail(prev => ({ ...prev, [key]: data }));
      }
    } catch (err) {
      console.error('Failed to fetch alert detail:', err);
    } finally {
      setLoadingDetail(prev => ({ ...prev, [key]: false }));
    }
  }, [expandedAlertId, alertDetail]);

  // Loading state
  if (loading && alerts.length === 0) {
    return (
      <DashboardCard title="Active Alerts" icon={<AlertTriangle className="w-4 h-4" />} accent="red" compact>
        <div className="py-10 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading alerts...</p>
        </div>
      </DashboardCard>
    );
  }

  // Empty state
  if (alerts.length === 0 && !loading) {
    return (
      <DashboardCard title="Active Alerts" icon={<AlertTriangle className="w-4 h-4" />} accent="red" compact>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
            <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
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
        <span className="relative inline-flex">
          <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
            {activeCount}
          </span>
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
          )}
        </span>
      ) : undefined}
    >
      {/* Severity Distribution + Stats */}
      <SeverityDistributionBar alerts={alerts} activeCount={activeCount} />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        {/* Status filter */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5">
          {([
            { key: 'all' as StatusFilter, label: 'All' },
            { key: 'active' as StatusFilter, label: `Active (${activeCount})` },
            { key: 'resolved' as StatusFilter, label: `Cleared (${alerts.length - activeCount})` },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => handleStatusFilter(f.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                statusFilter === f.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* Severity filter */}
        <div className="flex gap-1">
          {([
            { key: 'all' as SeverityFilter, label: 'All', count: alerts.length },
            { key: 'CRITICAL' as SeverityFilter, label: 'Critical', count: severityCounts.CRITICAL, dot: 'bg-red-500' },
            { key: 'MAJOR' as SeverityFilter, label: 'Major', count: severityCounts.MAJOR, dot: 'bg-orange-500' },
            { key: 'MINOR' as SeverityFilter, label: 'Minor', count: severityCounts.MINOR, dot: 'bg-amber-400' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                severityFilter === f.key
                  ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              {'dot' in f && f.dot && <span className={`w-2 h-2 rounded-full ${f.dot}`} />}
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Showing count */}
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">
        Showing {filteredAlerts.length} of {alerts.length} alerts
      </p>

      {/* Alert rows — card style instead of table for better mobile + visual weight */}
      <div className="space-y-2 -mx-1">
        {paginatedAlerts.map((alert) => {
          const isExpanded = expandedAlertId === alert.alertId;
          const active = isAlertActive(alert);
          const agentCount = alert.agents?.length || 0;
          const key = String(alert.alertId);

          return (
            <Fragment key={alert.alertId}>
              <button
                onClick={() => handleToggleAlert(alert.alertId)}
                className={`w-full text-left rounded-lg transition-all ${severityBorderClass(alert.severity)} ${
                  isExpanded
                    ? 'bg-slate-50 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700'
                    : 'bg-white dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40'
                } ${active ? '' : 'opacity-75'}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Expand icon */}
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-cyan-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {alert.testName || alert.ruleName || `Alert ${String(alert.alertId).slice(0, 8)}`}
                      </span>
                      {alert.testId && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          #{alert.testId}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {alert.ruleExpression && (
                        <span className="truncate max-w-[300px] font-mono text-[11px]">
                          {alert.ruleExpression}
                        </span>
                      )}
                      {!alert.ruleExpression && alert.alertType && (
                        <span className="truncate">{alert.alertType}</span>
                      )}
                    </div>
                  </div>

                  {/* Right side badges */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Agent count */}
                    {agentCount > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400" title={`${agentCount} affected agent${agentCount !== 1 ? 's' : ''}`}>
                        <Users className="w-3 h-3" />
                        {agentCount}
                      </span>
                    )}
                    {/* Violations */}
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400" title="Violations">
                      <Activity className="w-3 h-3" />
                      {alert.violationCount}
                    </span>
                    {/* Duration */}
                    <DurationBadge alert={alert} />
                    {/* Severity */}
                    <SeverityBadge severity={alert.severity} />
                    {/* Status */}
                    <AlertStatusBadge alert={alert} />
                  </div>
                </div>

                {/* Time + relative date */}
                <div className="flex items-center gap-4 px-4 pb-2 pl-11 text-[10px] text-slate-400 dark:text-slate-500">
                  <span>Started {formatRelativeDate(alert.dateStart)}</span>
                  {alert.dateEnd && !active && (
                    <span>Cleared {formatRelativeDate(alert.dateEnd)}</span>
                  )}
                </div>
              </button>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className="ml-4 pl-4 border-l-2 border-cyan-500/30">
                  <AlertDetailPanel
                    alert={alert}
                    detail={alertDetail[key]}
                    loading={!!loadingDetail[key]}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Pagination */}
      {filteredAlerts.length > pageSize && (
        <div className="mt-3">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={alerts.length}
            filteredItems={filteredAlerts.length}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </DashboardCard>
  );
});

AlertsTable.displayName = 'AlertsTable';

export default AlertsTable;
