'use client';

export function TEDashboardSkeleton() {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-56 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-40 mt-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            <div className="h-10 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
              <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
              <div className="h-8 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left column */}
          <div className="lg:col-span-3 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
                <div className="h-48 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
                <div className="h-40 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TEDashboardSkeleton;
