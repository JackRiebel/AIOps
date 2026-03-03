'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { WifiOff, Globe, Server } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { Pagination } from './Pagination';
import type { Outage } from './types';

// ============================================================================
// Types
// ============================================================================

export interface OutagesPanelProps {
  outages: Outage[];
  loading: boolean;
  onAskAI?: (context: string) => void;
}

// ============================================================================
// Type Badge Component
// ============================================================================

function OutageTypeBadge({ type }: { type: string }) {
  const isNetwork = type === 'network';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
      isNetwork
        ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700/50'
        : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700/50'
    }`}>
      {isNetwork ? <Globe className="w-3 h-3" /> : <Server className="w-3 h-3" />}
      {type === 'network' ? 'Network' : 'Application'}
    </span>
  );
}

// ============================================================================
// OutagesPanel Component
// ============================================================================

export const OutagesPanel = memo(({ outages, loading, onAskAI }: OutagesPanelProps) => {
  const [filter, setFilter] = useState<'all' | 'network' | 'application'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredOutages = useMemo(() => {
    if (filter === 'all') return outages;
    return outages.filter(o => o.type === filter);
  }, [outages, filter]);

  const totalPages = Math.ceil(filteredOutages.length / pageSize);
  const paginatedOutages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOutages.slice(start, start + pageSize);
  }, [filteredOutages, currentPage, pageSize]);

  const networkCount = useMemo(() => outages.filter(o => o.type === 'network').length, [outages]);
  const appCount = useMemo(() => outages.filter(o => o.type === 'application').length, [outages]);

  const handlePageChange = useCallback((page: number) => setCurrentPage(page), []);
  const handlePageSizeChange = useCallback((size: number) => { setPageSize(size); setCurrentPage(1); }, []);

  const getDuration = (start: string, end?: string) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const mins = Math.round((e - s) / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (hours < 24) return `${hours}h ${remainMins}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const getDurationColor = (start: string, end?: string) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const hours = (e - s) / 3600000;
    if (hours < 1) return 'text-green-600 dark:text-green-400';
    if (hours < 4) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400 font-semibold';
  };

  if (outages.length === 0 && !loading) {
    return (
      <DashboardCard title="Outages" icon={<WifiOff className="w-4 h-4" />} accent="red" compact>
        <div className="py-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No outages detected</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All networks and applications are healthy</p>
        </div>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Outages" icon={<WifiOff className="w-4 h-4" />} accent="red" compact>
      {/* Filters */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-700/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {filteredOutages.length} outage{filteredOutages.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-1">
          {(['all', 'network', 'application'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                filter === f
                  ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              {f === 'all' ? `All (${outages.length})` : f === 'network' ? `Network (${networkCount})` : `App (${appCount})`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto -mx-4">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Provider</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Duration</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Affected Tests</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Started</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {paginatedOutages.map((outage) => (
              <tr key={outage.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">{outage.provider || outage.server || 'Unknown'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">ID: {outage.id}</div>
                </td>
                <td className="px-4 py-3"><OutageTypeBadge type={outage.type} /></td>
                <td className={`px-4 py-3 text-sm ${getDurationColor(outage.startDate, outage.endDate)}`}>{getDuration(outage.startDate, outage.endDate)}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{outage.affectedTests}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{new Date(outage.startDate).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {outage.endDate ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Resolved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Active
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={outages.length}
        filteredItems={filteredOutages.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </DashboardCard>
  );
});

OutagesPanel.displayName = 'OutagesPanel';

export default OutagesPanel;
