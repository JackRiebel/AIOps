'use client';

import { memo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X, Zap } from 'lucide-react';
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
import type { TestResult, SelectedDataPoint } from './types';

// ============================================================================
// Types
// ============================================================================

// Recharts activeDot onClick receives (event, { payload }) but types are complex
// Using helper function to extract data point from the click event
const createDotClickHandler = (handler: (data: TestResult) => void) => (_: unknown, payload: { payload: TestResult }) => {
  handler(payload.payload);
};

export interface TestPerformanceChartProps {
  testId: number;
  testName: string;
  testType: string;
  results: TestResult[];
  loading: boolean;
  selectedOrg: string;
  onAskAI: (context: string) => void;
}

// ============================================================================
// Chart Colors
// ============================================================================

const chartColors = {
  responseTime: '#3b82f6', // blue
  latency: '#22c55e',      // green
  loss: '#ef4444',         // red
  jitter: '#f59e0b',       // amber
  throughput: '#8b5cf6',   // purple
};

// ============================================================================
// TestPerformanceChart Component
// ============================================================================

export const TestPerformanceChart = memo(({
  testId,
  testName,
  testType,
  results,
  loading,
  selectedOrg,
  onAskAI,
}: TestPerformanceChartProps) => {
  const router = useRouter();
  const [selectedDataPoint, setSelectedDataPoint] = useState<SelectedDataPoint | null>(null);
  const [aiQuery, setAiQuery] = useState('');

  const handleDataPointClick = (data: TestResult) => {
    setSelectedDataPoint({ testId, data });
  };

  const handleAskAI = useCallback(() => {
    if (!selectedDataPoint || !aiQuery.trim()) return;

    const dp = selectedDataPoint.data;

    // Build structured context for the card
    const contextData = {
      testName,
      testId,
      testType,
      organization: selectedOrg,
      timestamp: dp.timestamp,
      metrics: {
        responseTime: dp.responseTime,
        latency: dp.latency,
        loss: dp.loss,
        jitter: dp.jitter,
        availability: dp.availability,
        throughput: dp.throughput,
      },
      userQuestion: aiQuery,
    };

    // Build AI-facing message
    let aiMessage = `ThousandEyes test "${testName}" (${testType}, ID: ${testId}) data point at ${dp.timestamp}:\n`;
    if (dp.responseTime != null) aiMessage += `Response Time: ${dp.responseTime}ms. `;
    if (dp.latency != null) aiMessage += `Latency: ${dp.latency}ms. `;
    if (dp.loss != null) aiMessage += `Loss: ${dp.loss}%. `;
    if (dp.jitter != null) aiMessage += `Jitter: ${dp.jitter}ms. `;
    if (dp.availability != null) aiMessage += `Availability: ${dp.availability}%. `;
    if (dp.throughput != null) aiMessage += `Throughput: ${dp.throughput}. `;
    aiMessage += `\n\nUser question: ${aiQuery}\n\nAll test metrics are already provided inline — no need to fetch them again from ThousandEyes.`;

    const payload = {
      message: aiMessage,
      context: { type: 'test_data_point' as const, data: contextData },
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));

    setAiQuery('');
    setSelectedDataPoint(null);

    router.push(`/chat-v2?new_session=true&test_data_point=${encodeURIComponent(encoded)}`);
  }, [selectedDataPoint, aiQuery, testName, testId, testType, selectedOrg, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading test results...</p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No results available</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No test results for the last 12 hours</p>
      </div>
    );
  }

  const hasResponseTime = results[0]?.responseTime !== undefined;
  const hasLatency = results[0]?.latency !== undefined;
  const hasLoss = results[0]?.loss !== undefined;
  const hasJitter = results[0]?.jitter !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Test Performance (Last 12 Hours)</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">Click any point to ask AI about it</p>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={results}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis
              dataKey="timestamp"
              stroke="#94a3b8"
              style={{ fontSize: '10px' }}
              tick={{ fill: '#94a3b8' }}
            />
            <YAxis
              stroke="#94a3b8"
              style={{ fontSize: '10px' }}
              tick={{ fill: '#94a3b8' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {hasResponseTime && (
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke={chartColors.responseTime}
                name="Response Time (ms)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                  style: { cursor: 'pointer' },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick: createDotClickHandler(handleDataPointClick) as any,
                }}
              />
            )}
            {hasLatency && (
              <Line
                type="monotone"
                dataKey="latency"
                stroke={chartColors.latency}
                name="Latency (ms)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                  style: { cursor: 'pointer' },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick: createDotClickHandler(handleDataPointClick) as any,
                }}
              />
            )}
            {hasLoss && (
              <Line
                type="monotone"
                dataKey="loss"
                stroke={chartColors.loss}
                name="Packet Loss (%)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                  style: { cursor: 'pointer' },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick: createDotClickHandler(handleDataPointClick) as any,
                }}
              />
            )}
            {hasJitter && (
              <Line
                type="monotone"
                dataKey="jitter"
                stroke={chartColors.jitter}
                name="Jitter (ms)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 6,
                  style: { cursor: 'pointer' },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick: createDotClickHandler(handleDataPointClick) as any,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Selected Data Point Panel */}
      {selectedDataPoint && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-500/30">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h5 className="text-sm font-semibold text-purple-700 dark:text-purple-300">Selected Data Point</h5>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Time: {selectedDataPoint.data.timestamp}
              </p>
            </div>
            <button
              onClick={() => setSelectedDataPoint(null)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {selectedDataPoint.data.responseTime !== undefined && (
              <div className="bg-white/80 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Response</span>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {selectedDataPoint.data.responseTime}ms
                </p>
              </div>
            )}
            {selectedDataPoint.data.latency !== undefined && (
              <div className="bg-white/80 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Latency</span>
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {selectedDataPoint.data.latency}ms
                </p>
              </div>
            )}
            {selectedDataPoint.data.loss !== undefined && (
              <div className="bg-white/80 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Loss</span>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {selectedDataPoint.data.loss}%
                </p>
              </div>
            )}
            {selectedDataPoint.data.jitter !== undefined && (
              <div className="bg-white/80 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Jitter</span>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                  {selectedDataPoint.data.jitter}ms
                </p>
              </div>
            )}
          </div>

          {/* AI Query */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Ask AI about this data point
            </label>
            <textarea
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="E.g., Why is the latency so high at this time?"
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs resize-none"
            />
            <button
              onClick={handleAskAI}
              disabled={!aiQuery.trim()}
              className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs rounded-lg hover:from-purple-700 hover:to-blue-700 transition font-medium shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Ask AI
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

TestPerformanceChart.displayName = 'TestPerformanceChart';

export default TestPerformanceChart;
