'use client';

import { memo, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { TestResult, Test } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEPerformanceTrendsProps {
  testResults: Record<number, TestResult[]>;
  tests: Test[];
  loading: boolean;
  selectedTestId: number | null;
}

// ============================================================================
// Chart colors
// ============================================================================

const chartColors = {
  latency: '#22c55e',
  loss: '#ef4444',
  jitter: '#f59e0b',
  responseTime: '#3b82f6',
};

// Colors for per-test lines when showing all tests
const testLineColors = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

// ============================================================================
// Component
// ============================================================================

export const TEPerformanceTrends = memo(({ testResults, tests, loading, selectedTestId }: TEPerformanceTrendsProps) => {
  // Single selected test: show its latency/loss/jitter series
  const singleTestData = useMemo(() => {
    if (!selectedTestId || !testResults[selectedTestId]) return null;
    return testResults[selectedTestId];
  }, [testResults, selectedTestId]);

  // Multi-test view: build per-test latency comparison (when no test is selected)
  const multiTestData = useMemo(() => {
    if (selectedTestId) return null;

    // Get all tests that have results loaded
    const loadedTests = Object.entries(testResults)
      .filter(([, results]) => results.length > 0 && results.some(r => r.latency != null))
      .map(([id, results]) => ({
        testId: Number(id),
        testName: tests.find(t => t.testId === Number(id))?.testName || `Test ${id}`,
        results,
      }));

    if (loadedTests.length === 0) return null;

    // Build unified time-series with per-test latency columns
    const maxLen = Math.max(...loadedTests.map(t => t.results.length));
    const rows: Record<string, any>[] = [];

    for (let i = 0; i < maxLen; i++) {
      const row: Record<string, any> = { timestamp: '' };
      loadedTests.forEach(t => {
        const r = t.results[Math.min(i, t.results.length - 1)];
        if (r) {
          if (!row.timestamp) row.timestamp = r.timestamp;
          if (r.latency != null) row[t.testName] = r.latency;
        }
      });
      rows.push(row);
    }

    return { rows, testNames: loadedTests.map(t => t.testName) };
  }, [testResults, tests, selectedTestId]);

  const selectedTestName = selectedTestId
    ? tests.find(t => t.testId === selectedTestId)?.testName
    : null;

  const subtitle = selectedTestName
    ? `Showing: ${selectedTestName}`
    : multiTestData
    ? `Latency comparison — ${multiTestData.testNames.length} tests`
    : null;

  const hasData = singleTestData ? singleTestData.length > 0 : multiTestData != null;
  const hasLatency = singleTestData ? singleTestData.some(d => d.latency != null) : false;
  const hasLoss = singleTestData ? singleTestData.some(d => d.loss != null) : false;
  const hasJitter = singleTestData ? singleTestData.some(d => d.jitter != null) : false;
  const hasResponseTime = singleTestData ? singleTestData.some(d => d.responseTime != null) : false;

  return (
    <DashboardCard
      title="Performance Trends"
      icon={<TrendingUp className="w-4 h-4" />}
      accent="blue"
      loading={loading}
      compact
    >
      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-10 text-sm text-slate-500 dark:text-slate-400">
          <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
          <p>No performance data loaded</p>
          <p className="text-xs mt-1">Click a test in the health grid to load results</p>
        </div>
      ) : singleTestData ? (
        /* Single test selected — show latency/loss/jitter/response */
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{subtitle}</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={singleTestData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="timestamp" stroke="#94a3b8" style={{ fontSize: '10px' }} tick={{ fill: '#94a3b8' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} tick={{ fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {hasLatency && <Line type="monotone" dataKey="latency" stroke={chartColors.latency} name="Latency (ms)" strokeWidth={2} dot={false} />}
              {hasLoss && <Line type="monotone" dataKey="loss" stroke={chartColors.loss} name="Loss (%)" strokeWidth={2} dot={false} />}
              {hasJitter && <Line type="monotone" dataKey="jitter" stroke={chartColors.jitter} name="Jitter (ms)" strokeWidth={2} dot={false} />}
              {hasResponseTime && <Line type="monotone" dataKey="responseTime" stroke={chartColors.responseTime} name="Response (ms)" strokeWidth={2} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : multiTestData ? (
        /* No test selected — show per-test latency comparison */
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{subtitle}</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={multiTestData.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="timestamp" stroke="#94a3b8" style={{ fontSize: '10px' }} tick={{ fill: '#94a3b8' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '10px' }} tick={{ fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {multiTestData.testNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={testLineColors[i % testLineColors.length]}
                  name={name}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </DashboardCard>
  );
});

TEPerformanceTrends.displayName = 'TEPerformanceTrends';
export default TEPerformanceTrends;
