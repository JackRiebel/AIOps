'use client';

import { memo, useMemo } from 'react';
import { Database, ChevronRight } from 'lucide-react';
import type { SplunkIndex } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkIndexOverviewProps {
  indexes: SplunkIndex[];
  loading: boolean;
  onNavigateToIndexes: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const SplunkIndexOverview = memo(({
  indexes,
  loading,
  onNavigateToIndexes,
}: SplunkIndexOverviewProps) => {
  const sortedIndexes = useMemo(() => {
    return [...indexes]
      .map(idx => ({
        ...idx,
        eventCount: typeof idx.totalEventCount === 'string'
          ? parseInt(idx.totalEventCount, 10) || 0
          : (idx.totalEventCount || 0),
      }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 8);
  }, [indexes]);

  const maxEvents = useMemo(() => {
    return sortedIndexes.reduce((max, idx) => Math.max(max, idx.eventCount), 1);
  }, [sortedIndexes]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 animate-pulse">
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-6 bg-slate-100 dark:bg-slate-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-green-500" />
          Top Indexes
        </h3>
        <button
          onClick={onNavigateToIndexes}
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-0.5"
        >
          View all
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Index list */}
      {sortedIndexes.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No indexes found</p>
      ) : (
        <div className="space-y-2">
          {sortedIndexes.map(idx => {
            const pct = maxEvents > 0 ? (idx.eventCount / maxEvents) * 100 : 0;
            return (
              <div key={idx.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[60%]">{idx.name}</span>
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    {idx.eventCount.toLocaleString()} events
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

SplunkIndexOverview.displayName = 'SplunkIndexOverview';
export default SplunkIndexOverview;
