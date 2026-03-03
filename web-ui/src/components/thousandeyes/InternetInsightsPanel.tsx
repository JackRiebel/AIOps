'use client';

import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { Globe, Loader2, AlertCircle, WifiOff } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { InternetInsightsOutage } from './types';

export interface InternetInsightsPanelProps {
  onAskAI?: (context: string) => void;
}

type OutageFilter = 'all' | 'application' | 'network';
type TimeWindow = '1h' | '6h' | '24h' | '7d';

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return 'N/A';
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getProviderInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getProviderColor(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500',
    'bg-teal-500', 'bg-cyan-500',
  ];
  return colors[hash % colors.length];
}

function severityDot(outage: InternetInsightsOutage): string {
  if (!outage.endDate) return 'bg-red-500'; // Active
  return 'bg-amber-500'; // Resolved
}

export const InternetInsightsPanel = memo(({ onAskAI }: InternetInsightsPanelProps) => {
  const [outages, setOutages] = useState<InternetInsightsOutage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OutageFilter>('all');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const parseOutages = useCallback((data: any): InternetInsightsOutage[] => {
    const raw = data?._embedded?.outages || data?.outages || [];
    return raw.map((o: any) => ({
      id: o.id || o.outageId || String(Math.random()),
      type: (o.type || o.outageType || 'network').toLowerCase().includes('app') ? 'application' as const : 'network' as const,
      providerName: o.providerName || o.provider?.providerName || o.provider || o.server || 'Unknown',
      asNumber: o.asNumber || o.provider?.asNumber,
      startDate: o.startDate || o.startedDate || '',
      endDate: o.endDate || o.endedDate,
      affectedTests: Number(o.affectedTests ?? o.affectedTestsCount ?? o.affectedInterfaces ?? 0),
      affectedInterfaces: o.affectedInterfaces ? Number(o.affectedInterfaces) : undefined,
      severity: o.severity,
    }));
  }, []);

  const fetchOutages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try Internet Insights endpoint first
      let response = await fetch(
        `/api/thousandeyes/internet-insights/outages?organization=default&window=${timeWindow}`,
        { credentials: 'include' }
      );

      let data: any = null;
      if (response.ok) {
        data = await response.json();
        const parsed = parseOutages(data);
        if (parsed.length > 0) {
          setOutages(parsed);
          return;
        }
      }

      // Fallback: use the standard outages endpoint
      response = await fetch(
        `/api/thousandeyes/outages?organization=default&window=${timeWindow}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        data = await response.json();
        const parsed = parseOutages(data);
        setOutages(parsed);
        return;
      }

      // Both endpoints failed
      if (response.status === 403 || response.status === 404) {
        setOutages([]);
        setError('Internet Insights is not available for this account.');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch Internet Insights outages:', err);
      setError('Failed to load Internet Insights data');
      setOutages([]);
    } finally {
      setLoading(false);
    }
  }, [timeWindow, parseOutages]);

  useEffect(() => {
    fetchOutages();
  }, [fetchOutages]);

  const filteredOutages = useMemo(() => {
    if (filter === 'all') return outages;
    return outages.filter(o => o.type === filter);
  }, [outages, filter]);

  const totalPages = Math.ceil(filteredOutages.length / pageSize);
  const paginatedOutages = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOutages.slice(start, start + pageSize);
  }, [filteredOutages, page]);

  // Summary stats
  const stats = useMemo(() => {
    const active = outages.filter(o => !o.endDate);
    return {
      total: outages.length,
      affectedTests: new Set(outages.flatMap(o => Array(o.affectedTests).fill(0).map((_, i) => `${o.id}-${i}`))).size > 0
        ? outages.reduce((s, o) => s + o.affectedTests, 0) : 0,
      activeAlerts: active.length,
    };
  }, [outages]);

  const filterBtnClass = (f: OutageFilter) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
      filter === f
        ? 'bg-cyan-600 text-white'
        : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700/50'
    }`;

  return (
    <DashboardCard title="Internet Insights" icon={<Globe className="w-4 h-4" />} accent="purple" compact>
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50 text-center">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Outages</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50 text-center">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Affected Tests</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.affectedTests}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50 text-center">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active</span>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.activeAlerts}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setFilter('all'); setPage(1); }} className={filterBtnClass('all')}>All</button>
          <button onClick={() => { setFilter('application'); setPage(1); }} className={filterBtnClass('application')}>Application</button>
          <button onClick={() => { setFilter('network'); setPage(1); }} className={filterBtnClass('network')}>Network</button>
        </div>
        <select
          value={timeWindow}
          onChange={(e) => { setTimeWindow(e.target.value as TimeWindow); setPage(1); }}
          className="px-2 py-1.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <option value="1h">Last 1h</option>
          <option value="6h">Last 6h</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          <span className="ml-2 text-sm text-slate-500">Loading Internet Insights...</span>
        </div>
      ) : error && outages.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center">
            <WifiOff className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{error}</p>
        </div>
      ) : filteredOutages.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
            <Globe className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-green-700 dark:text-green-400">No outages detected</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All clear in the selected time window</p>
        </div>
      ) : (
        <>
          {/* Outage Event Feed */}
          <div className="space-y-2">
            {paginatedOutages.map((outage) => (
              <div
                key={outage.id}
                className="flex items-center gap-3 px-3 py-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg hover:border-purple-300 dark:hover:border-purple-700/50 transition-colors"
              >
                {/* Status dot + Provider avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`w-9 h-9 rounded-full ${getProviderColor(outage.providerName)} flex items-center justify-center`}>
                    <span className="text-white text-sm font-bold">{getProviderInitial(outage.providerName)}</span>
                  </div>
                  <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${severityDot(outage)}`} />
                </div>

                {/* Provider + Type */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {outage.providerName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      outage.type === 'application'
                        ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
                        : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                    }`}>
                      {outage.type === 'network' && outage.asNumber
                        ? `NETWORK AS${outage.asNumber}`
                        : outage.type.toUpperCase()
                      }
                    </span>
                  </div>
                </div>

                {/* Time ago */}
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {getRelativeTime(outage.startDate)}
                </span>

                {/* Affected count pill */}
                <div className="flex-shrink-0 bg-slate-100 dark:bg-slate-700/50 rounded-full px-2.5 py-1 min-w-[32px] text-center">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{outage.affectedTests}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredOutages.length)} of {filteredOutages.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardCard>
  );
});

InternetInsightsPanel.displayName = 'InternetInsightsPanel';

export default InternetInsightsPanel;
