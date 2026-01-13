'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
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

function AlertStatusBadge({ active }: { active: number }) {
  return active === 1 ? (
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
// AlertsTable Component
// ============================================================================

export const AlertsTable = memo(({
  alerts,
  loading,
}: AlertsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Pagination logic
  const totalPages = Math.ceil(alerts.length / pageSize);
  const paginatedAlerts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return alerts.slice(start, start + pageSize);
  }, [alerts, currentPage, pageSize]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Active alerts count
  const activeCount = alerts.filter(a => a.active === 1).length;

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
      {/* Summary */}
      <div className="pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {activeCount} active alert{activeCount !== 1 ? 's' : ''} of {alerts.length} total
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
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
              <tr key={alert.alertId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={alerts.length}
        filteredItems={alerts.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </DashboardCard>
  );
});

AlertsTable.displayName = 'AlertsTable';

export default AlertsTable;
