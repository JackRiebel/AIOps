'use client';

import { memo } from 'react';

// Skeleton pulse animation class
const pulse = 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded';

interface SkeletonProps {
  className?: string;
}

// Base skeleton block
function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`${pulse} ${className}`} />;
}

// Stats bar skeleton
export const StatsBarSkeleton = memo(() => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-8 w-16" />
      </div>
    ))}
  </div>
));
StatsBarSkeleton.displayName = 'StatsBarSkeleton';

// Widget card skeleton
export const WidgetSkeleton = memo(({ rows = 3 }: { rows?: number }) => (
  <div className="bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-4 rounded-full" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-3 w-3/4 mb-1.5" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  </div>
));
WidgetSkeleton.displayName = 'WidgetSkeleton';

// Chart skeleton
export const ChartSkeleton = memo(() => (
  <div className="bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-4 w-16" />
    </div>
    <Skeleton className="h-6 w-20 mb-2" />
    <Skeleton className="h-16 w-full rounded-lg" />
  </div>
));
ChartSkeleton.displayName = 'ChartSkeleton';

// Full dashboard skeleton
export const DashboardSkeleton = memo(() => (
  <div className="px-6 py-8 max-w-[1400px] mx-auto">
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <div>
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-4 w-24" />
    </div>

    {/* Stats Bar */}
    <StatsBarSkeleton />

    {/* Widget Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <WidgetSkeleton rows={4} />
      <WidgetSkeleton rows={3} />
      <WidgetSkeleton rows={4} />
      <ChartSkeleton />
      <WidgetSkeleton rows={4} />
      <WidgetSkeleton rows={3} />
    </div>
  </div>
));
DashboardSkeleton.displayName = 'DashboardSkeleton';

export default DashboardSkeleton;
