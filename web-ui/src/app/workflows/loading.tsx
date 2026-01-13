/**
 * Loading skeleton for the Workflows page
 */

export default function WorkflowsLoading() {
  return (
    <div className="h-full flex flex-col animate-pulse">
      {/* Stats Bar Skeleton */}
      <div className="h-16 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 px-6 flex items-center gap-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div>
              <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
              <div className="w-12 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Header Skeleton */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <div className="w-48 h-7 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
          <div className="w-72 h-4 bg-slate-100 dark:bg-slate-700/50 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700" />
          <div className="w-24 h-10 rounded-lg bg-slate-100 dark:bg-slate-700" />
          <div className="w-32 h-10 rounded-lg bg-cyan-200 dark:bg-cyan-900/30" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex items-center gap-1 px-6 pt-4 border-b border-slate-200 dark:border-slate-700">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-28 h-9 rounded-t-lg bg-slate-100 dark:bg-slate-700/50" />
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="flex-1 flex overflow-hidden">
        {/* List Panel */}
        <div className="w-1/3 min-w-[320px] max-w-[480px] border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <div className="w-40 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-16 h-5 bg-slate-100 dark:bg-slate-700/50 rounded-full" />
              </div>
              <div className="w-full h-4 bg-slate-100 dark:bg-slate-700/50 rounded mb-2" />
              <div className="w-3/4 h-4 bg-slate-100 dark:bg-slate-700/50 rounded" />
              <div className="flex items-center gap-2 mt-3">
                <div className="w-20 h-3 bg-slate-100 dark:bg-slate-700/50 rounded" />
                <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <div className="w-24 h-3 bg-slate-100 dark:bg-slate-700/50 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-6">
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 mb-4" />
            <div className="w-40 h-5 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="w-56 h-4 bg-slate-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
