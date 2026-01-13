'use client';

export default function NetworkLoading() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Simulated navigation skeleton */}
      <div className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" />

      <div className="flex">
        {/* Simulated sidebar skeleton */}
        <div className="w-64 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-4 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 p-6">
          <div className="space-y-6">
            {/* Header skeleton */}
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            {/* Chat area skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-96">
              <div className="flex flex-col h-full justify-end space-y-4">
                <div className="h-12 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-12 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse self-end" />
                <div className="h-12 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>

            {/* Input skeleton */}
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
