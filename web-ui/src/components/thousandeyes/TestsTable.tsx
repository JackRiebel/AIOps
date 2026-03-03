'use client';

import { memo, useState, useMemo, useCallback, Fragment } from 'react';
import { Activity, ChevronRight, Plus, Play } from 'lucide-react';
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
}: TestsTableProps) => {
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);
  const [runningInstantTest, setRunningInstantTest] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Pagination logic
  const totalPages = Math.ceil(tests.length / pageSize);
  const paginatedTests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tests.slice(start, start + pageSize);
  }, [tests, currentPage, pageSize]);

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

  // Empty state
  if (tests.length === 0 && !loading) {
    return (
      <DashboardCard title="Tests" icon={<Activity className="w-4 h-4" />} accent="cyan" compact>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-cyan-100 dark:bg-cyan-500/10 rounded-full flex items-center justify-center">
            <Activity className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No tests found</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Get started by creating a test in ThousandEyes</p>
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
      {/* Header with Create Button */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {tests.length} test{tests.length !== 1 ? 's' : ''} configured
        </p>
        <button
          onClick={onCreateTest}
          disabled={!selectedOrg || !isConfigured}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs rounded-lg hover:from-cyan-700 hover:to-blue-700 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Test
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[700px]">
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
                Interval
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {paginatedTests.map((test) => (
              <Fragment key={test.testId}>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
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
                    <div className="text-xs text-slate-500 dark:text-slate-400">ID: {test.testId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 rounded text-xs font-medium">
                      {test.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {test.interval}s
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge enabled={test.enabled} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {new Date(test.createdDate).toLocaleDateString()}
                  </td>
                </tr>

                {/* Expanded Row with Chart */}
                {expandedTestId === test.testId && (
                  <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                    <td colSpan={6} className="px-4 py-4">
                      <TestPerformanceChart
                        testId={test.testId}
                        testName={test.testName}
                        testType={test.type}
                        results={testResults[test.testId] || []}
                        loading={loadingResults[test.testId] || false}
                        selectedOrg={selectedOrg}
                        onAskAI={onAskAI}
                      />
                      {onRunInstantTest && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                          <button
                            onClick={async () => {
                              setRunningInstantTest(test.testId);
                              try {
                                await onRunInstantTest({ testId: test.testId, type: test.type });
                              } finally {
                                setRunningInstantTest(null);
                              }
                            }}
                            disabled={runningInstantTest === test.testId}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs rounded-lg hover:from-green-700 hover:to-emerald-700 transition font-medium shadow-sm disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5" />
                            {runningInstantTest === test.testId ? 'Running...' : 'Run Instant Test'}
                          </button>
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
        totalItems={tests.length}
        filteredItems={tests.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </DashboardCard>
  );
});

TestsTable.displayName = 'TestsTable';

export default TestsTable;
