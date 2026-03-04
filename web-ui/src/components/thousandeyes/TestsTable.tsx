'use client';

import { memo, useState, useMemo, useCallback, Fragment } from 'react';
import { Activity, ChevronRight, Plus, Play, Search, Pencil, Trash2, Power, AlertTriangle, Camera, MoreHorizontal, X } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { TestPerformanceChart } from './TestPerformanceChart';
import { Pagination } from './Pagination';
import { isEnabled } from './types';
import type { Test, TestResult } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TestsTableProps {
  tests: Test[];
  testResults: Record<number, TestResult[]>;
  loadingResults: Record<number, boolean>;
  loading: boolean;
  selectedOrg: string;
  isConfigured: boolean;
  onCreateTest: () => void;
  onToggleResults: (testId: number, testType: string) => void;
  onAskAI: (context: string) => void;
  onRunInstantTest?: (testConfig: any) => Promise<any>;
  onEditTest?: (test: Test) => void;
  onDeleteTest?: (testId: number) => Promise<void>;
  onUpdateTest?: (testId: number, data: Record<string, any>) => Promise<void>;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ enabled }: { enabled: number | boolean }) {
  return isEnabled(enabled) ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Enabled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600/50">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Disabled
    </span>
  );
}

// ============================================================================
// Type Badge Component
// ============================================================================

const TYPE_COLORS: Record<string, string> = {
  'http-server': 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400',
  'agent-to-server': 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  'dns-server': 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  'dns-trace': 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  'page-load': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  'web-transactions': 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  'voice': 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400',
  'sip-server': 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-400',
  'ftp-server': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
};

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] || 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {type}
    </span>
  );
}

// ============================================================================
// Confirm Delete Dialog
// ============================================================================

function ConfirmDeleteDialog({ testName, onConfirm, onCancel, deleting }: {
  testName: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Test</h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
          Are you sure you want to delete this test?
        </p>
        <p className="text-sm font-medium text-slate-900 dark:text-white mb-4">
          &ldquo;{testName}&rdquo;
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          This action cannot be undone. All test results and history will be lost.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-medium text-sm disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Test'}
          </button>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600/50 transition font-medium text-sm disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Metric Indicator
// ============================================================================

function MetricIndicator({ label, value, unit, status }: {
  label: string;
  value?: number;
  unit: string;
  status: 'good' | 'warn' | 'bad' | 'none';
}) {
  if (value === undefined || value === null) return null;
  const colors = {
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    bad: 'text-red-600 dark:text-red-400',
    none: 'text-slate-500 dark:text-slate-400',
  };
  return (
    <span className={`text-xs ${colors[status]}`} title={label}>
      {typeof value === 'number' ? value.toFixed(1) : value}{unit}
    </span>
  );
}

// ============================================================================
// TestsTable Component
// ============================================================================

export const TestsTable = memo(({
  tests,
  testResults,
  loadingResults,
  loading,
  selectedOrg,
  isConfigured,
  onCreateTest,
  onToggleResults,
  onAskAI,
  onRunInstantTest,
  onEditTest,
  onDeleteTest,
  onUpdateTest,
}: TestsTableProps) => {
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);
  const [runningInstantTest, setRunningInstantTest] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<Test | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionsOpenId, setActionsOpenId] = useState<number | null>(null);

  // Get unique test types for filter
  const testTypes = useMemo(() => {
    const types = new Set(tests.map(t => t.type));
    return Array.from(types).sort();
  }, [tests]);

  // Filter tests
  const filteredTests = useMemo(() => {
    let result = tests;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.testName.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        String(t.testId).includes(q) ||
        (t.url && t.url.toLowerCase().includes(q)) ||
        (t.server && t.server.toLowerCase().includes(q))
      );
    }
    if (typeFilter !== 'all') {
      result = result.filter(t => t.type === typeFilter);
    }
    if (statusFilter === 'enabled') {
      result = result.filter(t => isEnabled(t.enabled));
    } else if (statusFilter === 'disabled') {
      result = result.filter(t => !isEnabled(t.enabled));
    }
    return result;
  }, [tests, searchQuery, typeFilter, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredTests.length / pageSize);
  const paginatedTests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTests.slice(start, start + pageSize);
  }, [filteredTests, currentPage, pageSize]);

  const handleToggleResults = useCallback((testId: number, testType: string) => {
    if (expandedTestId === testId) {
      setExpandedTestId(null);
    } else {
      setExpandedTestId(testId);
      onToggleResults(testId, testType);
    }
  }, [expandedTestId, onToggleResults]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    setExpandedTestId(null);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    setExpandedTestId(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || !onDeleteTest) return;
    setDeleting(true);
    try {
      await onDeleteTest(deleteTarget.testId);
      setDeleteTarget(null);
    } catch {
      // Error shown via global error state
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, onDeleteTest]);

  const handleToggleEnabled = useCallback(async (test: Test) => {
    if (!onUpdateTest) return;
    const newEnabled = isEnabled(test.enabled) ? 0 : 1;
    try {
      await onUpdateTest(test.testId, { enabled: newEnabled });
    } catch {
      // Error shown via global error state
    }
  }, [onUpdateTest]);

  const handleCreateSnapshot = useCallback(async (testId: number) => {
    try {
      await fetch(`/api/thousandeyes/tests/${testId}/snapshot?organization=default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
    } catch {
      // Silent fail for snapshot
    }
  }, []);

  // Reset page when filters change
  useMemo(() => { setCurrentPage(1); }, [searchQuery, typeFilter, statusFilter]);

  // Counts
  const enabledCount = tests.filter(t => isEnabled(t.enabled)).length;
  const disabledCount = tests.length - enabledCount;

  // Empty state
  if (tests.length === 0 && !loading) {
    return (
      <DashboardCard title="Tests" icon={<Activity className="w-4 h-4" />} accent="cyan" compact>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-cyan-100 dark:bg-cyan-500/10 rounded-full flex items-center justify-center">
            <Activity className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No tests found</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Get started by creating a test</p>
          {isConfigured && (
            <button
              onClick={onCreateTest}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm rounded-lg hover:from-cyan-700 hover:to-blue-700 transition font-medium shadow-lg hover:shadow-cyan-500/30"
            >
              Create Test
            </button>
          )}
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Tests" icon={<Activity className="w-4 h-4" />} accent="cyan" compact>
      {/* Header with stats, search, and actions */}
      <div className="space-y-3 pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        {/* Top row: stats + create button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tests.length} test{tests.length !== 1 ? 's' : ''}
            </p>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{enabledCount} enabled</span>
            {disabledCount > 0 && (
              <span className="text-xs text-slate-400">{disabledCount} disabled</span>
            )}
          </div>
          <button
            onClick={onCreateTest}
            disabled={!selectedOrg || !isConfigured}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs rounded-lg hover:from-cyan-700 hover:to-blue-700 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Test
          </button>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests by name, type, URL..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">All Types</option>
            {testTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
            <span className="text-xs text-slate-500">
              {filteredTests.length} of {tests.length}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="w-10 px-4 py-2.5"></th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Test Name
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Metrics
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Interval
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {paginatedTests.map((test) => {
              const metrics = test._latestMetrics;
              const latencyStatus = metrics?.latency !== undefined
                ? (metrics.latency > 200 ? 'bad' : metrics.latency > 100 ? 'warn' : 'good')
                : 'none';
              const lossStatus = metrics?.loss !== undefined
                ? (metrics.loss > 5 ? 'bad' : metrics.loss > 1 ? 'warn' : 'good')
                : 'none';

              return (
                <Fragment key={test.testId}>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleResults(test.testId, test.type)}
                        className="p-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition"
                      >
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${
                            expandedTestId === test.testId ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{test.testName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        ID: {test.testId}
                        {test.url && <span className="ml-2 text-slate-400">{test.url.length > 40 ? test.url.slice(0, 40) + '…' : test.url}</span>}
                        {test.server && <span className="ml-2 text-slate-400">{test.server}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={test.type} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MetricIndicator label="Latency" value={metrics?.latency} unit="ms" status={latencyStatus as any} />
                        <MetricIndicator label="Loss" value={metrics?.loss} unit="%" status={lossStatus as any} />
                        {metrics?.availability !== undefined && (
                          <span className={`text-xs ${metrics.availability >= 99 ? 'text-emerald-600 dark:text-emerald-400' : metrics.availability >= 95 ? 'text-amber-600' : 'text-red-600'}`}>
                            {metrics.availability.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {test.interval}s
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge enabled={test.enabled} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick toggle */}
                        {onUpdateTest && (
                          <button
                            onClick={() => handleToggleEnabled(test)}
                            title={isEnabled(test.enabled) ? 'Disable test' : 'Enable test'}
                            className={`p-1.5 rounded-md transition opacity-0 group-hover:opacity-100 ${
                              isEnabled(test.enabled)
                                ? 'text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* Edit button */}
                        {onEditTest && (
                          <button
                            onClick={() => { onEditTest(test); setActionsOpenId(null); }}
                            title="Edit test"
                            className="p-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-md transition opacity-0 group-hover:opacity-100"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* More actions menu */}
                        <div className="relative">
                          <button
                            onClick={() => setActionsOpenId(actionsOpenId === test.testId ? null : test.testId)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-md transition opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                          {actionsOpenId === test.testId && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActionsOpenId(null)} />
                              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]">
                                {onRunInstantTest && (
                                  <button
                                    onClick={async () => {
                                      setActionsOpenId(null);
                                      setRunningInstantTest(test.testId);
                                      try {
                                        await onRunInstantTest({ testId: test.testId, type: test.type });
                                      } finally { setRunningInstantTest(null); }
                                    }}
                                    disabled={runningInstantTest === test.testId}
                                    className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                                  >
                                    <Play className="w-3.5 h-3.5 text-green-500" />
                                    {runningInstantTest === test.testId ? 'Running...' : 'Run Instant Test'}
                                  </button>
                                )}
                                <button
                                  onClick={() => { setActionsOpenId(null); handleCreateSnapshot(test.testId); }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                                >
                                  <Camera className="w-3.5 h-3.5 text-blue-500" />
                                  Create Snapshot
                                </button>
                                <button
                                  onClick={() => {
                                    setActionsOpenId(null);
                                    onAskAI(`Analyze the test "${test.testName}" (ID: ${test.testId}, type: ${test.type}). What is this test monitoring and what insights can you provide?`);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2"
                                >
                                  <Activity className="w-3.5 h-3.5 text-purple-500" />
                                  Ask AI About Test
                                </button>
                                {onDeleteTest && (
                                  <>
                                    <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                                    <button
                                      onClick={() => { setActionsOpenId(null); setDeleteTarget(test); }}
                                      className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Delete Test
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row with Chart */}
                  {expandedTestId === test.testId && (
                    <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                      <td colSpan={7} className="px-4 py-4">
                        <TestPerformanceChart
                          testId={test.testId}
                          testName={test.testName}
                          testType={test.type}
                          results={testResults[test.testId] || []}
                          loading={loadingResults[test.testId] || false}
                          selectedOrg={selectedOrg}
                          onAskAI={onAskAI}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={tests.length}
        filteredItems={filteredTests.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDeleteDialog
          testName={deleteTarget.testName}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </DashboardCard>
  );
});

TestsTable.displayName = 'TestsTable';

export default TestsTable;
