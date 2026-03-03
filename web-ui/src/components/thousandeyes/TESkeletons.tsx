'use client';

import { memo } from 'react';

// ============================================================================
// TableSkeleton
// ============================================================================

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton = memo(({ rows = 5, columns = 5 }: TableSkeletonProps) => (
  <div className="space-y-0">
    {/* Header row */}
    <div className="flex gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-700/50">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex-1">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${50 + Math.random() * 30}%` }} />
        </div>
      ))}
    </div>
    {/* Data rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="flex gap-4 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/30">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <div key={colIdx} className="flex-1">
            <div
              className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"
              style={{ width: `${40 + ((rowIdx + colIdx) % 4) * 15}%`, animationDelay: `${(rowIdx * columns + colIdx) * 75}ms` }}
            />
            {colIdx === 0 && (
              <div
                className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse mt-1.5"
                style={{ width: '40%', animationDelay: `${(rowIdx * columns + colIdx) * 75 + 50}ms` }}
              />
            )}
          </div>
        ))}
      </div>
    ))}
  </div>
));

TableSkeleton.displayName = 'TableSkeleton';

// ============================================================================
// StatsBarSkeleton
// ============================================================================

export const StatsBarSkeleton = memo(() => (
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4"
      >
        <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" style={{ animationDelay: `${i * 100}ms` }} />
        <div className="h-7 w-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
      </div>
    ))}
  </div>
));

StatsBarSkeleton.displayName = 'StatsBarSkeleton';
