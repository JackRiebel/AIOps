'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { SystemHealth } from '@/types';

interface PostgresStatus {
  embedded: boolean;
  status: string;
  data_dir?: string | null;
  data_size_mb?: number | null;
  connection_string?: string | null;
  initialized?: boolean;
  error?: string | null;
  message?: string;
}

export default function HealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pgStatus, setPgStatus] = useState<PostgresStatus | null>(null);
  const [pgLoading, setPgLoading] = useState(false);
  const [pgActionLoading, setPgActionLoading] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await apiClient.getHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch health:', err);
      setError('Failed to load system health');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPgStatus = useCallback(async () => {
    try {
      setPgLoading(true);
      const response = await fetch('/api/health/postgres/status', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPgStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch PostgreSQL status:', err);
    } finally {
      setPgLoading(false);
    }
  }, []);

  const handlePgAction = async (action: 'start' | 'stop' | 'restart' | 'initialize') => {
    try {
      setPgActionLoading(action);
      const response = await fetch(`/api/health/postgres/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        await fetchPgStatus();
        await fetchHealth();
      } else {
        const data = await response.json();
        setError(data.detail || `Failed to ${action} PostgreSQL`);
      }
    } catch (err) {
      console.error(`Failed to ${action} PostgreSQL:`, err);
      setError(`Failed to ${action} PostgreSQL`);
    } finally {
      setPgActionLoading(null);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchPgStatus();
    const interval = setInterval(() => {
      fetchHealth();
      fetchPgStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchPgStatus]);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">

      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">System Health</h1>
            <p className="text-sm text-slate-500 mt-0.5">Service status and availability monitoring</p>
          </div>
          {health && (
            <span className="text-xs text-slate-500">
              Updated {new Date(health.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center gap-3" role="alert">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-32" role="status" aria-live="polite">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-500 border-r-transparent" aria-hidden="true"></div>
              <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">Loading health data...</p>
            </div>
          </div>
        ) : health ? (
          <div className="space-y-6">
            {/* Overall Status Banner */}
            <div
              role="status"
              aria-label={`System status: ${health.status}. ${health.status === 'healthy' ? 'All systems operational' : health.status === 'degraded' ? 'Some services degraded' : 'System issues detected'}. Uptime: ${formatUptime(health.uptime_seconds)}`}
              className={`rounded-xl border p-6 shadow-sm dark:shadow-none ${
              health.status === 'healthy'
                ? 'bg-green-50 dark:bg-green-500/5 border-green-200 dark:border-green-500/20'
                : health.status === 'degraded'
                ? 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
                : 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    health.status === 'healthy' ? 'bg-green-500 animate-pulse' :
                    health.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                  }`} aria-hidden="true" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white capitalize">{health.status}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {health.status === 'healthy' ? 'All systems operational' :
                       health.status === 'degraded' ? 'Some services degraded' : 'System issues detected'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Uptime</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatUptime(health.uptime_seconds)}</p>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="group" aria-label="System metrics">
              <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" id="metric-database">Database</p>
                <div className="flex items-center gap-2" aria-labelledby="metric-database">
                  <div className={`w-2 h-2 rounded-full ${health.database ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden="true" />
                  <span className="text-lg font-semibold text-slate-900 dark:text-white">{health.database ? 'Connected' : 'Offline'}</span>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" id="metric-services">Services</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white" aria-labelledby="metric-services">{health.services.length} active</p>
              </div>
              <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" id="metric-healthy">Healthy</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400" aria-labelledby="metric-healthy">
                  {health.services.filter(s => s.status === 'healthy').length}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" id="metric-issues">Issues</p>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400" aria-labelledby="metric-issues">
                  {health.services.filter(s => s.status !== 'healthy').length}
                </p>
              </div>
            </div>

            {/* PostgreSQL Server Status */}
            {pgStatus && (
              <section aria-labelledby="postgres-heading" className="mt-6">
                <h2 id="postgres-heading" className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">PostgreSQL Database</h2>
                <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 p-6 shadow-sm dark:shadow-none">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        pgStatus.status === 'running' ? 'bg-green-100 dark:bg-green-500/10' :
                        pgStatus.status === 'stopped' ? 'bg-slate-100 dark:bg-slate-500/10' :
                        pgStatus.status === 'external' ? 'bg-blue-100 dark:bg-blue-500/10' :
                        'bg-red-100 dark:bg-red-500/10'
                      }`}>
                        <svg className={`w-6 h-6 ${
                          pgStatus.status === 'running' ? 'text-green-600 dark:text-green-400' :
                          pgStatus.status === 'stopped' ? 'text-slate-600 dark:text-slate-400' :
                          pgStatus.status === 'external' ? 'text-blue-600 dark:text-blue-400' :
                          'text-red-600 dark:text-red-400'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {pgStatus.embedded ? 'Embedded PostgreSQL' : 'External PostgreSQL'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                            pgStatus.status === 'running' ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' :
                            pgStatus.status === 'stopped' ? 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400' :
                            pgStatus.status === 'external' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                            'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              pgStatus.status === 'running' ? 'bg-green-500 animate-pulse' :
                              pgStatus.status === 'stopped' ? 'bg-slate-500' :
                              pgStatus.status === 'external' ? 'bg-blue-500' :
                              'bg-red-500'
                            }`} />
                            {pgStatus.status}
                          </span>
                          {pgStatus.data_size_mb != null && (
                            <span className="text-xs text-slate-500">{pgStatus.data_size_mb} MB</span>
                          )}
                        </div>
                        {pgStatus.error && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{pgStatus.error}</p>
                        )}
                        {pgStatus.message && (
                          <p className="text-xs text-slate-500 mt-1">{pgStatus.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Controls - only show for embedded PostgreSQL */}
                    {pgStatus.embedded && (
                      <div className="flex flex-wrap gap-2">
                        {pgStatus.status === 'not_initialized' && (
                          <button
                            onClick={() => handlePgAction('initialize')}
                            disabled={pgActionLoading !== null}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {pgActionLoading === 'initialize' ? (
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            )}
                            Initialize
                          </button>
                        )}
                        {pgStatus.status !== 'not_initialized' && (
                          <>
                            <button
                              onClick={() => handlePgAction('start')}
                              disabled={pgActionLoading !== null || pgStatus.status === 'running'}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {pgActionLoading === 'start' ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                              )}
                              Start
                            </button>
                            <button
                              onClick={() => handlePgAction('stop')}
                              disabled={pgActionLoading !== null || pgStatus.status !== 'running'}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {pgActionLoading === 'stop' ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                </svg>
                              )}
                              Stop
                            </button>
                            <button
                              onClick={() => handlePgAction('restart')}
                              disabled={pgActionLoading !== null || pgStatus.status !== 'running'}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {pgActionLoading === 'restart' ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              )}
                              Restart
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Services List */}
            <section aria-labelledby="services-heading">
              <h2 id="services-heading" className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Service Status</h2>
              <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 overflow-hidden shadow-sm dark:shadow-none">
                <table className="w-full" aria-describedby="services-heading">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-transparent">
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Service</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Response Time</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/30">
                    {health.services.map((service) => (
                      <tr key={service.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{service.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                            service.status === 'healthy'
                              ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                              : service.status === 'degraded'
                              ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                              : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              service.status === 'healthy' ? 'bg-green-500' :
                              service.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                            }`} aria-hidden="true" />
                            {service.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {service.response_time_ms != null ? (
                            <span className="text-sm text-slate-600 dark:text-slate-400 font-mono">{service.response_time_ms}ms</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-500">{service.message || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <div className="text-center py-20" role="status">
            <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 p-12 max-w-md mx-auto shadow-sm dark:shadow-none">
              <svg className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-slate-600 dark:text-slate-400">No health data available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
