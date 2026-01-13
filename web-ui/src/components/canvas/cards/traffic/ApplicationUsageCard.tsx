'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { blockApplication, type ActionState, createActionStateManager } from '@/services/cardActions';

interface ApplicationUsage {
  application: string;
  category?: string;
  bytes: number;
  bytesPerSec?: number;
  sessions?: number;
  clients?: number;
  blocked?: boolean;
  policyStatus?: 'allowed' | 'blocked' | 'limited';
}

interface ApplicationUsageCardData {
  applications?: ApplicationUsage[];
  items?: ApplicationUsage[];
  totalBytes?: number;
  networkId?: string;
  timeRange?: string;
}

interface ApplicationUsageCardProps {
  data: ApplicationUsageCardData;
  config?: {
    maxApps?: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatBitRate(bytesPerSec: number): string {
  const bitsPerSec = bytesPerSec * 8;
  if (bitsPerSec === 0) return '0 bps';
  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const i = Math.min(Math.floor(Math.log(bitsPerSec) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bitsPerSec / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Category colors - consistent with app theme
const CATEGORY_COLORS: Record<string, string> = {
  'Productivity': '#22c55e',  // Green
  'Video': '#ef4444',         // Red
  'Streaming': '#f97316',     // Orange
  'Communication': '#06b6d4', // Cyan
  'Cloud': '#3b82f6',         // Blue
  'Social': '#ec4899',        // Pink
  'Gaming': '#8b5cf6',        // Violet
  'Web': '#f59e0b',           // Amber
  'Security': '#10b981',      // Emerald
  'Other': '#64748b',         // Slate
};

const POLICY_CONFIG = {
  allowed: { label: 'Allowed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  blocked: { label: 'Blocked', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
  limited: { label: 'Limited', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40' },
};

export const ApplicationUsageCard = memo(({ data, config }: ApplicationUsageCardProps) => {
  const maxApps = config?.maxApps ?? 12;
  const [selectedApp, setSelectedApp] = useState<ApplicationUsage | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });
  const stateManager = useMemo(() => createActionStateManager(setActionState), []);
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    let apps = data?.applications || data?.items || [];
    let total = data?.totalBytes;

    // Generate mock data if no real data available and demo mode is enabled
    if (demoMode && (!data || apps.length === 0)) {
      apps = [
        { application: 'Microsoft 365', category: 'Productivity', bytes: 2500000000, bytesPerSec: 850000, sessions: 1250, clients: 180, policyStatus: 'allowed' as const },
        { application: 'YouTube', category: 'Video', bytes: 1800000000, bytesPerSec: 620000, sessions: 890, clients: 145, policyStatus: 'limited' as const },
        { application: 'Zoom', category: 'Communication', bytes: 1200000000, bytesPerSec: 450000, sessions: 560, clients: 120, policyStatus: 'allowed' as const },
        { application: 'Slack', category: 'Communication', bytes: 850000000, bytesPerSec: 280000, sessions: 2100, clients: 165, policyStatus: 'allowed' as const },
        { application: 'AWS Console', category: 'Cloud', bytes: 750000000, bytesPerSec: 320000, sessions: 450, clients: 45, policyStatus: 'allowed' as const },
        { application: 'Netflix', category: 'Streaming', bytes: 650000000, bytesPerSec: 180000, sessions: 120, clients: 35, policyStatus: 'blocked' as const },
        { application: 'Salesforce', category: 'Productivity', bytes: 420000000, bytesPerSec: 95000, sessions: 780, clients: 85, policyStatus: 'allowed' as const },
        { application: 'Google Drive', category: 'Cloud', bytes: 380000000, bytesPerSec: 125000, sessions: 920, clients: 155, policyStatus: 'allowed' as const },
        { application: 'Teams', category: 'Communication', bytes: 320000000, bytesPerSec: 110000, sessions: 450, clients: 95, policyStatus: 'allowed' as const },
        { application: 'Dropbox', category: 'Cloud', bytes: 180000000, bytesPerSec: 65000, sessions: 230, clients: 45, policyStatus: 'allowed' as const },
        { application: 'GitHub', category: 'Productivity', bytes: 150000000, bytesPerSec: 42000, sessions: 340, clients: 28, policyStatus: 'allowed' as const },
        { application: 'Twitch', category: 'Streaming', bytes: 280000000, bytesPerSec: 95000, sessions: 85, clients: 18, policyStatus: 'limited' as const },
        { application: 'Discord', category: 'Gaming', bytes: 120000000, bytesPerSec: 35000, sessions: 210, clients: 32, policyStatus: 'allowed' as const },
        { application: 'Spotify', category: 'Streaming', bytes: 95000000, bytesPerSec: 28000, sessions: 180, clients: 42, policyStatus: 'allowed' as const },
      ];
      total = apps.reduce((sum, a) => sum + a.bytes, 0);
    }

    if (apps.length === 0) return null;

    total = total ?? apps.reduce((sum, a) => sum + a.bytes, 0);

    // Get unique categories
    const categories = [...new Set(apps.map(a => a.category || 'Other'))].map(cat => {
      const catApps = apps.filter(a => (a.category || 'Other') === cat);
      const catBytes = catApps.reduce((sum, a) => sum + a.bytes, 0);
      return {
        name: cat,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other'],
        count: catApps.length,
        bytes: catBytes,
        percentage: total > 0 ? (catBytes / total) * 100 : 0,
      };
    }).sort((a, b) => b.bytes - a.bytes);

    // Filter by category
    let filteredApps = filterCategory
      ? apps.filter(a => (a.category || 'Other') === filterCategory)
      : apps;

    // Sort and limit
    const sorted = [...filteredApps]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, maxApps)
      .map(app => ({
        ...app,
        percentage: total > 0 ? (app.bytes / total) * 100 : 0,
        color: CATEGORY_COLORS[app.category || 'Other'] || CATEGORY_COLORS['Other'],
      }));

    return {
      apps: sorted,
      total,
      appCount: apps.length,
      categories,
    };
  }, [data, maxApps, filterCategory, demoMode]);

  const handleBlockApp = useCallback(async () => {
    if (!selectedApp?.application) return;

    stateManager.setLoading();

    const result = await blockApplication({
      applicationId: selectedApp.application.toLowerCase().replace(/\s+/g, '-'),
      applicationName: selectedApp.application,
      networkId: data?.networkId,
    });

    if (result.success) {
      stateManager.setSuccess(`${selectedApp.application} blocked`);
      setSelectedApp(null);
    } else {
      stateManager.setError(result.message);
    }
  }, [selectedApp, data?.networkId, stateManager]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No application data
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {selectedApp ? (
        /* Detail View */
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          <button
            onClick={() => setSelectedApp(null)}
            className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline mb-3"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to list
          </button>

          {/* App Header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: CATEGORY_COLORS[selectedApp.category || 'Other'] || CATEGORY_COLORS['Other'] }}
            >
              {selectedApp.application.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                {selectedApp.application}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedApp.category || 'Other'}
                </span>
                {selectedApp.policyStatus && (
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${POLICY_CONFIG[selectedApp.policyStatus].bg} ${POLICY_CONFIG[selectedApp.policyStatus].color}`}>
                    {POLICY_CONFIG[selectedApp.policyStatus].label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Total Traffic</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {formatBytes(selectedApp.bytes)}
              </div>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Live Rate</div>
              <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                {selectedApp.bytesPerSec ? formatBitRate(selectedApp.bytesPerSec) : '—'}
              </div>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Sessions</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {(selectedApp.sessions || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Clients</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {(selectedApp.clients || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Actions */}
          {selectedApp.policyStatus !== 'blocked' && (
            <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleBlockApp}
                disabled={actionState.status === 'loading'}
                className="w-full py-2 text-xs font-medium rounded bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Block Application
              </button>
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Applications
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1 rounded ${viewMode === 'list' ? 'bg-slate-200 dark:bg-slate-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 rounded ${viewMode === 'grid' ? 'bg-slate-200 dark:bg-slate-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Category filter chips */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              <button
                onClick={() => setFilterCategory(null)}
                className={`px-2 py-0.5 text-[9px] font-medium rounded whitespace-nowrap transition-colors ${
                  !filterCategory
                    ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                All ({processedData.appCount})
              </button>
              {processedData.categories.slice(0, 5).map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)}
                  className={`px-2 py-0.5 text-[9px] font-medium rounded whitespace-nowrap transition-colors flex items-center gap-1 ${
                    filterCategory === cat.name
                      ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>
          </div>

          {/* Category distribution bar */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <div className="h-2 flex rounded overflow-hidden">
              {processedData.categories.map((cat, idx) => (
                <div
                  key={idx}
                  className="transition-all cursor-pointer hover:opacity-80"
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: cat.color,
                    opacity: filterCategory && filterCategory !== cat.name ? 0.3 : 1,
                  }}
                  title={`${cat.name}: ${cat.percentage.toFixed(1)}%`}
                  onClick={() => setFilterCategory(filterCategory === cat.name ? null : cat.name)}
                />
              ))}
            </div>
          </div>

          {/* Application list/grid */}
          <div className="flex-1 overflow-auto">
            {viewMode === 'list' ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {processedData.apps.map((app, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedApp(app)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Color indicator */}
                      <div
                        className="w-1 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: app.color }}
                      />

                      {/* App info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                            {app.application}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 tabular-nums flex-shrink-0">
                            {formatBytes(app.bytes)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${app.percentage}%`, backgroundColor: app.color }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500 tabular-nums w-7 text-right">
                            {app.percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[9px] text-slate-500 dark:text-slate-400">
                            {app.category || 'Other'}
                          </span>
                          <div className="flex items-center gap-2">
                            {app.bytesPerSec && (
                              <span className="text-[9px] text-cyan-600 dark:text-cyan-400 flex items-center gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-cyan-500" />
                                {formatBitRate(app.bytesPerSec)}
                              </span>
                            )}
                            {app.policyStatus && app.policyStatus !== 'allowed' && (
                              <span className={`text-[8px] font-medium px-1 rounded ${POLICY_CONFIG[app.policyStatus].bg} ${POLICY_CONFIG[app.policyStatus].color}`}>
                                {POLICY_CONFIG[app.policyStatus].label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Chevron */}
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Grid View */
              <div className="p-2 grid grid-cols-3 gap-1.5">
                {processedData.apps.map((app, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    onClick={() => setSelectedApp(app)}
                  >
                    <div
                      className="w-full h-1 rounded-full mb-1.5"
                      style={{ backgroundColor: app.color }}
                    />
                    <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                      {app.application}
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">
                      {formatBytes(app.bytes)}
                    </div>
                    {app.policyStatus && app.policyStatus !== 'allowed' && (
                      <div className={`text-[7px] font-medium mt-1 ${POLICY_CONFIG[app.policyStatus].color}`}>
                        {POLICY_CONFIG[app.policyStatus].label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Action Feedback */}
      {actionState.status !== 'idle' && (
        <div className={`flex-shrink-0 px-3 py-2 border-t text-xs flex items-center gap-2 ${
          actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' :
          actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' :
          'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {actionState.status === 'loading' && (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <span>{actionState.message}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400">
          <span>
            {filterCategory ? `${processedData.apps.length} ${filterCategory} apps` : `${processedData.appCount} apps`} • {formatBytes(processedData.total)}
          </span>
          <span>{data?.timeRange || 'Last 2 hours'}</span>
        </div>
      </div>
    </div>
  );
});

ApplicationUsageCard.displayName = 'ApplicationUsageCard';

export default ApplicationUsageCard;
