'use client';

import { memo, useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { AssertionResult } from '@/types/ai-quality';

// ============================================================================
// Types
// ============================================================================

export interface AssertionResultsPanelProps {
  history: { timestamp: string; pass_rate: number }[];
  assertions: AssertionResult[];
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_BADGE_COLORS: Record<string, string> = {
  status_code: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  response_contains: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  response_time_lt: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  json_path: 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20',
};

const DEFAULT_BADGE = 'bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/20';

// ============================================================================
// Component
// ============================================================================

export const AssertionResultsPanel = memo(({ history, assertions }: AssertionResultsPanelProps) => {
  const sparkData = useMemo(() => {
    return history.map((h) => ({
      t: h.timestamp,
      rate: h.pass_rate,
    }));
  }, [history]);

  const recentAssertions = useMemo(() => {
    return assertions.slice(0, 10);
  }, [assertions]);

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Assertion Results
        </h3>
        {assertions.length > 0 && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {assertions.filter((a) => a.passed).length}/{assertions.length} passed
          </span>
        )}
      </div>

      {/* Pass rate sparkline */}
      {sparkData.length > 1 && (
        <div className="mb-3">
          <div style={{ height: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '6px',
                    fontSize: '10px',
                  }}
                  labelStyle={{ color: '#94a3b8', fontSize: '9px' }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Pass Rate']}
                  labelFormatter={(label: string) => {
                    try {
                      return new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch {
                      return label;
                    }
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-0.5">
            Pass rate trend
          </p>
        </div>
      )}

      {/* Assertion rows */}
      {recentAssertions.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-[12px] text-slate-400 dark:text-slate-500">
          No assertion results
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
          {recentAssertions.map((a, idx) => {
            const badgeColor = TYPE_BADGE_COLORS[a.type] || DEFAULT_BADGE;
            return (
              <div
                key={idx}
                className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
              >
                {a.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-medium border rounded ${badgeColor}`}>
                      {a.type}
                    </span>
                    {a.description && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {a.description}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-slate-400 dark:text-slate-500">
                      expected: <span className="text-slate-600 dark:text-slate-300 font-mono">{a.expected}</span>
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span className="text-slate-400 dark:text-slate-500">
                      actual: <span className={`font-mono ${a.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{a.actual}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

AssertionResultsPanel.displayName = 'AssertionResultsPanel';
export default AssertionResultsPanel;
