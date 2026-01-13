'use client';

export default function ThousandEyesLoading() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-64 mt-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>

      {/* Status cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div>
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tests table skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Test Name', 'Type', 'Status', 'Last Run', 'Actions'].map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
