'use client';

export default function CostsLoading() {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900">
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-3">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-24 h-9 rounded-lg bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
            <div className="w-28 h-9 rounded-lg bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
          </div>
        </div>

        {/* Nav tabs skeleton */}
        <div className="flex items-center gap-1">
          <div className="h-9 w-32 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
          <div className="h-9 w-24 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
          <div className="h-9 w-24 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
        </div>

        {/* Stats row skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-slate-200 dark:border-l-slate-700 p-3">
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
              <div className="h-6 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-1.5" />
              <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* AI Insights skeleton */}
        <div className="bg-cyan-50 dark:bg-cyan-900/10 rounded-xl border border-cyan-200 dark:border-cyan-500/20 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
              <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Chart + Summary row skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
            <div className="h-[240px] bg-slate-100 dark:bg-slate-700/30 rounded-lg animate-pulse" />
          </div>
          <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-3 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Model table skeleton */}
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/30">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                    <div className="h-3 w-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
