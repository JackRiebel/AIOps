'use client';

import { memo } from 'react';

// ============================================================================
// Skeleton Item Component
// ============================================================================

function SkeletonItem() {
  return (
    <div className="bg-white dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/30 animate-pulse">
      {/* Severity stripe placeholder */}
      <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-slate-200 dark:bg-slate-700" />

      <div className="pl-3">
        {/* Badges row */}
        <div className="flex items-center gap-2 mb-2">
          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
          <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Title */}
        <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-3" />

        {/* Meta info */}
        <div className="flex items-center gap-3">
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>

        {/* AI Hypothesis placeholder */}
        <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="h-3 w-3 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-4/5 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// IncidentListSkeleton Component
// ============================================================================

export interface IncidentListSkeletonProps {
  count?: number;
  className?: string;
}

export const IncidentListSkeleton = memo(({
  count = 5,
  className = ''
}: IncidentListSkeletonProps) => {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading incidents">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonItem key={index} />
      ))}
      <span className="sr-only">Loading incidents...</span>
    </div>
  );
});

IncidentListSkeleton.displayName = 'IncidentListSkeleton';

export default IncidentListSkeleton;
