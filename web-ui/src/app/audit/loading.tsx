'use client';

export default function AuditLoading() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-56 mt-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="ml-auto h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Audit log table skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                {['Timestamp', 'User', 'Action', 'Resource', 'Status', 'IP Address'].map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {[...Array(10)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination skeleton */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
