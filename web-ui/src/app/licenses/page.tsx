'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { UnifiedLicensesResponse } from '@/types';

export default function LicensesPage() {
  const [licensesData, setLicensesData] = useState<UnifiedLicensesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  useEffect(() => {
    fetchLicenses();
  }, []);

  async function fetchLicenses() {
    try {
      setLoading(true);
      const data = await apiClient.getLicenses();
      setLicensesData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch licenses:', err);
      setError('Failed to load licenses data');
    } finally {
      setLoading(false);
    }
  }

  function getLicenseStateColor(state: string) {
    const s = state.toLowerCase();
    if (s === 'active' || s === 'unused') return 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400';
    if (s === 'expired' || s === 'invalidated') return 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400';
    if (s === 'recentlyqueued' || s === 'queued') return 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400';
    return 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400';
  }

  function formatDate(dateString?: string) {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  }

  function getDaysUntilExpiry(expirationDate?: string): number | null {
    if (!expirationDate) return null;
    try {
      const expDate = new Date(expirationDate);
      const now = new Date();
      return Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  }

  function isExpiringSoon(expirationDate?: string): boolean {
    const days = getDaysUntilExpiry(expirationDate);
    return days !== null && days <= 30 && days >= 0;
  }

  const expiringSoonCount = licensesData?.organizations.reduce((count, org) =>
    count + org.licenses.filter(lic => isExpiringSoon(lic.expiration_date)).length, 0
  ) || 0;

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">

      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Licenses</h1>
            <p className="text-sm text-slate-500 mt-0.5">License management across organizations</p>
          </div>
          <button
            onClick={fetchLicenses}
            disabled={loading}
            aria-label={loading ? 'Loading licenses' : 'Refresh license data'}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
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
              <p className="mt-3 text-slate-500 dark:text-slate-400 text-sm">Loading licenses...</p>
            </div>
          </div>
        ) : licensesData ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4" role="group" aria-label="License summary">
              <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" id="summary-total">Total Licenses</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white" aria-labelledby="summary-total">{licensesData.total_licenses}</p>
              </div>
              <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" id="summary-orgs">Organizations</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white" aria-labelledby="summary-orgs">{licensesData.total_organizations}</p>
              </div>
              <div className="bg-white dark:bg-slate-800/40 rounded-lg p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1" id="summary-expiring">Expiring Soon</p>
                <p className={`text-2xl font-bold ${expiringSoonCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`} aria-labelledby="summary-expiring">
                  {expiringSoonCount}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Within 30 days</p>
              </div>
            </div>

            {/* Organizations */}
            <section aria-labelledby="orgs-heading">
              <h2 id="orgs-heading" className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">By Organization</h2>
              <div className="space-y-3">
                {licensesData.organizations.map((org) => (
                  <div key={org.organization_id} className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 shadow-sm dark:shadow-none overflow-hidden">
                    <button
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500"
                      onClick={() => setExpandedOrg(expandedOrg === org.organization_id ? null : org.organization_id)}
                      aria-expanded={expandedOrg === org.organization_id}
                      aria-controls={`org-licenses-${org.organization_id}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{org.organization_name}</span>
                        <span className="text-xs text-slate-500">ID: {org.organization_id}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {org.error ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400">Error</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                            {org.licenses.length} licenses
                          </span>
                        )}
                        <svg className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${expandedOrg === org.organization_id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {expandedOrg === org.organization_id && (
                      <div id={`org-licenses-${org.organization_id}`} className="border-t border-slate-200 dark:border-slate-700/30">
                        {org.error ? (
                          <div className="p-4 text-sm text-red-600 dark:text-red-400" role="alert">{org.error}</div>
                        ) : org.licenses.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500 text-center" role="status">No licenses found</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full" aria-label={`Licenses for ${org.organization_name}`}>
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700/30 bg-slate-50 dark:bg-transparent">
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">State</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Claimed</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Expires</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Device</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-700/30">
                                {org.licenses.map((license, idx) => {
                                  const daysLeft = getDaysUntilExpiry(license.expiration_date);
                                  const expiring = isExpiringSoon(license.expiration_date);
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                      <td className="px-4 py-2 text-sm text-slate-900 dark:text-white">
                                        {license.license_type}
                                        {license.seat_count && <span className="text-xs text-slate-500 ml-1">({license.seat_count})</span>}
                                      </td>
                                      <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getLicenseStateColor(license.state)}`}>
                                          {license.state}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">{formatDate(license.claim_date)}</td>
                                      <td className="px-4 py-2 text-sm">
                                        <span className={expiring ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}>
                                          {formatDate(license.expiration_date)}
                                        </span>
                                        {daysLeft !== null && daysLeft >= 0 && (
                                          <span className="text-xs text-slate-500 block">
                                            {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-slate-500 font-mono text-xs">
                                        {license.device_serial || '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {licensesData.organizations.length === 0 && (
                  <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 shadow-sm dark:shadow-none p-8 text-center" role="status">
                    <p className="text-slate-600 dark:text-slate-400">No organizations configured</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/30 shadow-sm dark:shadow-none p-12 text-center" role="status">
            <p className="text-slate-600 dark:text-slate-400">No license data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
