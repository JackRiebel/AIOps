'use client';

export default function SplunkLoading() {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900">
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-3">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-52 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
            <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700/50 rounded animate-pulse" />
          </div>
          <div className="flex-1 max-w-lg mx-4">
            <div className="h-9 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
            <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700/50 animate-pulse" />
          </div>
        </div>

        {/* Nav tabs skeleton */}
        <div className="flex items-center gap-1">
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
        </div>

        {/* Stats row skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-slate-200 dark:border-l-slate-700 p-3">
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
              <div className="h-6 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-1.5" />
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
            </div>
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-3 w-4/6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-3">
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
              <div className="space-y-2">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
