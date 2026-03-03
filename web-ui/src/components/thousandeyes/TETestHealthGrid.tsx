'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import { Activity, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { TestHealthCell } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TETestHealthGridProps {
  tests: TestHealthCell[];
  loading: boolean;
  onTestClick: (testId: number) => void;
  selectedTestId: number | null;
}

type SortField = 'name' | 'type' | 'health' | 'latency' | 'loss' | 'availability';
type SortDir = 'asc' | 'desc';

// ============================================================================
// Constants
// ============================================================================

const healthOrder: Record<TestHealthCell['health'], number> = {
  failing: 0,
  degraded: 1,
  healthy: 2,
  disabled: 3,
};

const healthConfig: Record<TestHealthCell['health'], { label: string; dot: string; bg: string; text: string }> = {
  failing: {
    label: 'Failing',
    dot: 'bg-red-500',
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
  },
  healthy: {
    label: 'Healthy',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  disabled: {
    label: 'Disabled',
    dot: 'bg-slate-400 dark:bg-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-500/10',
    text: 'text-slate-500 dark:text-slate-400',
  },
};

const typeBadgeColors: Record<string, string> = {
  'agent-to-server': 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
  'http-server': 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20',
  'page-load': 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20',
  'dns-server': 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20',
  'network': 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
};

const defaultBadge = 'bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/20';

// ============================================================================
// Component
// ============================================================================

export const TETestHealthGrid = memo(({ tests, loading, onTestClick, selectedTestId }: TETestHealthGridProps) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('health');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  // Filter + sort
  const sorted = useMemo(() => {
    let filtered = tests;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = tests.filter(t =>
        t.testName.toLowerCase().includes(q) || t.type.toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.testName.localeCompare(b.testName); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'health': cmp = healthOrder[a.health] - healthOrder[b.health]; break;
        case 'latency': cmp = (a.latestMetrics?.latency ?? 999) - (b.latestMetrics?.latency ?? 999); break;
        case 'loss': cmp = (a.latestMetrics?.loss ?? 999) - (b.latestMetrics?.loss ?? 999); break;
        case 'availability': cmp = (b.latestMetrics?.availability ?? 0) - (a.latestMetrics?.availability ?? 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [tests, search, sortField, sortDir]);

  // Summary counts
  const counts = useMemo(() => {
    const c = { healthy: 0, degraded: 0, failing: 0, disabled: 0 };
    tests.forEach(t => c[t.health]++);
    return c;
  }, [tests]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 text-slate-300 dark:text-slate-600" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-cyan-500" />
      : <ChevronDown className="w-3 h-3 text-cyan-500" />;
  };

  const statusSummary = (
    <div className="flex items-center gap-3 text-[11px]">
      {counts.failing > 0 && (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{counts.failing} failing
        </span>
      )}
      {counts.degraded > 0 && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{counts.degraded} degraded
        </span>
      )}
      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{counts.healthy} healthy
      </span>
      {counts.disabled > 0 && (
        <span className="text-slate-400 dark:text-slate-500">{counts.disabled} disabled</span>
      )}
    </div>
  );

  return (
    <DashboardCard
      title="Test Health"
      icon={<Activity className="w-4 h-4" />}
      accent="cyan"
      loading={loading}
      badge={statusSummary}
      compact
    >
      {tests.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-500 dark:text-slate-400">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No tests configured</p>
          <p className="text-xs mt-1">Create a test to start monitoring</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Search */}
          {tests.length > 5 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter tests..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
                  <th className="px-3 py-2">
                    <button onClick={() => handleSort('health')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                      Status <SortIcon field="health" />
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                      Test Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-3 py-2 hidden sm:table-cell">
                    <button onClick={() => handleSort('type')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                      Type <SortIcon field="type" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right hidden md:table-cell">
                    <button onClick={() => handleSort('latency')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition ml-auto">
                      Latency <SortIcon field="latency" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right hidden md:table-cell">
                    <button onClick={() => handleSort('loss')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition ml-auto">
                      Loss <SortIcon field="loss" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right hidden lg:table-cell">
                    <button onClick={() => handleSort('availability')} className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition ml-auto">
                      Avail. <SortIcon field="availability" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {sorted.map(test => {
                  const cfg = healthConfig[test.health];
                  const isSelected = selectedTestId === test.testId;
                  const badgeColor = typeBadgeColors[test.type] || defaultBadge;

                  return (
                    <tr
                      key={test.testId}
                      onClick={() => onTestClick(test.testId)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? 'bg-cyan-50/70 dark:bg-cyan-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${test.health === 'failing' ? 'animate-pulse' : ''}`} />
                          <span className={`text-[11px] font-medium ${cfg.text}`}>{cfg.label}</span>
                        </div>
                      </td>

                      {/* Test Name */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-medium truncate max-w-[200px] ${
                            isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-900 dark:text-white'
                          }`}>
                            {test.testName}
                          </span>
                          {isSelected && (
                            <span className="flex-shrink-0 w-1 h-1 rounded-full bg-cyan-500" />
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium border rounded-md ${badgeColor}`}>
                          {test.type}
                        </span>
                      </td>

                      {/* Latency */}
                      <td className="px-3 py-2.5 text-right hidden md:table-cell">
                        {test.latestMetrics?.latency != null ? (
                          <span className="text-xs tabular-nums text-slate-700 dark:text-slate-300 font-medium">
                            {test.latestMetrics.latency}<span className="text-slate-400 dark:text-slate-500 ml-0.5">ms</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Loss */}
                      <td className="px-3 py-2.5 text-right hidden md:table-cell">
                        {test.latestMetrics?.loss != null ? (
                          <span className={`text-xs tabular-nums font-medium ${
                            test.latestMetrics.loss > 1 ? 'text-red-600 dark:text-red-400' :
                            test.latestMetrics.loss > 0 ? 'text-amber-600 dark:text-amber-400' :
                            'text-slate-700 dark:text-slate-300'
                          }`}>
                            {test.latestMetrics.loss.toFixed(1)}<span className="text-slate-400 dark:text-slate-500 ml-0.5">%</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Availability */}
                      <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                        {test.latestMetrics?.availability != null ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  test.latestMetrics.availability >= 99 ? 'bg-emerald-500' :
                                  test.latestMetrics.availability >= 95 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${test.latestMetrics.availability}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-slate-700 dark:text-slate-300 font-medium min-w-[36px] text-right">
                              {test.latestMetrics.availability}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {search && sorted.length === 0 && (
            <div className="text-center py-4 text-xs text-slate-400">
              No tests match &quot;{search}&quot;
            </div>
          )}
          {sorted.length > 0 && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
              {sorted.length} of {tests.length} test{tests.length !== 1 ? 's' : ''} shown — click a row to view details
            </div>
          )}
        </div>
      )}
    </DashboardCard>
  );
});

TETestHealthGrid.displayName = 'TETestHealthGrid';
export default TETestHealthGrid;
