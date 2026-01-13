'use client';

export default function SplunkLoading() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-72 mt-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Log insights list skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-3 w-1/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
