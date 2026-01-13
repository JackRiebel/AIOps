'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { AuditLog, AuditStats } from '@/types';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [filters, setFilters] = useState({
    organization_name: '',
    http_method: '',
    operation_id: '',
  });

  useEffect(() => {
    fetchAuditLogs();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { limit: 1000 };
      if (filters.organization_name) params.organization_name = filters.organization_name;
      if (filters.http_method) params.http_method = filters.http_method;
      if (filters.operation_id) params.operation_id = filters.operation_id;

      const data = await apiClient.getAuditLogs(params);
      setLogs(data);
      setError(null);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  async function fetchStats() {
    try {
      const data = await apiClient.getAuditStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  const handleFilterChange = useCallback(<K extends keyof typeof filters>(key: K, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ organization_name: '', http_method: '', operation_id: '' });
  }, []);

  const handleApplyFilters = useCallback(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
      POST: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20',
      PUT: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
      DELETE: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',
    };
    return colors[method.toUpperCase()] || 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/20';
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-slate-500';
    if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
    if (status >= 400 && status < 500) return 'text-amber-600 dark:text-amber-400';
    if (status >= 500) return 'text-red-600 dark:text-red-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  const indexOfLastLog = currentPage * itemsPerPage;
  const indexOfFirstLog = indexOfLastLog - itemsPerPage;
  const currentLogs = logs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(logs.length / itemsPerPage);

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">

      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h1>
            <p className="text-sm text-slate-500 mt-0.5">API operation history and compliance tracking</p>
          </div>
          <span className="text-xs text-slate-500">
            {logs.length.toLocaleString()} total entries
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="mb-4 px-4 py-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center gap-3">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Operations</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Successful</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.successful.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Failed</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0}%
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Filters</h2>
          <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 p-4 shadow-sm dark:shadow-none">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="audit-filter-org" className="block text-xs font-medium text-slate-500 mb-1.5">Organization</label>
                <input
                  id="audit-filter-org"
                  type="text"
                  value={filters.organization_name}
                  onChange={(e) => handleFilterChange('organization_name', e.target.value)}
                  placeholder="Filter by org..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label htmlFor="audit-filter-method" className="block text-xs font-medium text-slate-500 mb-1.5">HTTP Method</label>
                <select
                  id="audit-filter-method"
                  value={filters.http_method}
                  onChange={(e) => handleFilterChange('http_method', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                >
                  <option value="">All Methods</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div>
                <label htmlFor="audit-filter-operation" className="block text-xs font-medium text-slate-500 mb-1.5">Operation ID</label>
                <input
                  id="audit-filter-operation"
                  type="text"
                  value={filters.operation_id}
                  onChange={(e) => handleFilterChange('operation_id', e.target.value)}
                  placeholder="e.g. updateNetwork"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  Apply
                </button>
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Recent Activity</h2>
          <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 overflow-hidden shadow-sm dark:shadow-none">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent"></div>
                  <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">Loading logs...</p>
                </div>
              </div>
            ) : currentLogs.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-slate-600 dark:text-slate-400">No audit logs found</p>
                <p className="text-sm text-slate-500 mt-1">
                  {Object.values(filters).some(v => v) ? 'Try adjusting your filters' : 'Operations will appear here'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-transparent">
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Timestamp</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Method</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Path</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Organization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/30">
                      {currentLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${getMethodColor(log.http_method)}`}>
                              {log.http_method}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 font-mono max-w-md truncate" title={log.path || undefined}>
                            {log.path || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {log.response_status ? (
                              <span className={`text-sm font-medium ${getStatusColor(log.response_status)}`}>
                                {log.response_status}
                              </span>
                            ) : log.error_message ? (
                              <span className="text-sm text-red-600 dark:text-red-400">Error</span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {log.organization_name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/30 flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Showing {indexOfFirstLog + 1}–{Math.min(indexOfLastLog, logs.length)} of {logs.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        aria-label="Go to previous page"
                        className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-700 dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-500 px-2" aria-live="polite">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        aria-label="Go to next page"
                        className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-slate-700 dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
