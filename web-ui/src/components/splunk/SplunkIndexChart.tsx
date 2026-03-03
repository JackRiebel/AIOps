'use client';

import { memo, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import type { SplunkIndex } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkIndexChartProps {
  indexes: SplunkIndex[];
  loading: boolean;
  onIndexClick: (indexName: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const SplunkIndexChart = memo(({ indexes, loading, onIndexClick }: SplunkIndexChartProps) => {
  const topIndexes = useMemo(() => {
    return [...indexes]
      .map(idx => ({
        name: idx.name,
        count: typeof idx.totalEventCount === 'string'
          ? parseInt(idx.totalEventCount, 10) || 0
          : (idx.totalEventCount || 0),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [indexes]);

  const maxCount = useMemo(() => Math.max(...topIndexes.map(i => i.count), 1), [topIndexes]);

  const formatCount = (n: number) => {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Top Indexes</span>
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 rounded-lg bg-slate-100 dark:bg-slate-700/50 animate-pulse" style={{ width: `${100 - i * 15}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (topIndexes.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-purple-500" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Top Indexes by Event Count</span>
      </div>

      <div className="space-y-2">
        {topIndexes.map((idx, i) => {
          const pct = (idx.count / maxCount) * 100;
          return (
            <button
              key={idx.name}
              onClick={() => onIndexClick(idx.name)}
              className="w-full flex items-center gap-3 group hover:bg-slate-50 dark:hover:bg-slate-700/20 rounded-lg px-2 py-1.5 transition-colors text-left border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50"
            >
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 w-28 truncate flex-shrink-0 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                {idx.name}
              </span>
              <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700/40 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md bg-gradient-to-r from-cyan-500/80 to-purple-500/80 transition-all duration-500"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 w-14 text-right flex-shrink-0 tabular-nums">
                {formatCount(idx.count)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

SplunkIndexChart.displayName = 'SplunkIndexChart';
export default SplunkIndexChart;
