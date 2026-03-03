'use client';

import { memo, useMemo, useState } from 'react';
import { GitBranch, ChevronDown, ChevronUp } from 'lucide-react';
import type { BGPResult } from './types';

export interface BGPUpdatesChartProps {
  bgpData: BGPResult[];
}

interface MonitorEntry {
  monitor: string;
  updates: number;
  prefixes: number;
  avgReachability: number;
  isActive: boolean;
}

export const BGPUpdatesChart = memo(({ bgpData }: BGPUpdatesChartProps) => {
  const [showAll, setShowAll] = useState(false);

  const monitors = useMemo(() => {
    if (bgpData.length === 0) return [];

    const map = new Map<string, { updates: number; reachability: number[]; prefixes: Set<string>; active: boolean }>();
    for (const result of bgpData) {
      const key = result.monitor || 'Unknown';
      const existing = map.get(key);
      if (existing) {
        existing.updates += result.updates;
        existing.reachability.push(result.reachability);
        existing.prefixes.add(result.prefix);
        if (result.isActive) existing.active = true;
      } else {
        map.set(key, {
          updates: result.updates,
          reachability: [result.reachability],
          prefixes: new Set([result.prefix]),
          active: result.isActive ?? true,
        });
      }
    }

    return Array.from(map.entries())
      .map(([monitor, data]): MonitorEntry => ({
        monitor,
        updates: data.updates,
        prefixes: data.prefixes.size,
        avgReachability: Math.round(data.reachability.reduce((a, b) => a + b, 0) / data.reachability.length),
        isActive: data.active,
      }))
      .sort((a, b) => b.updates - a.updates);
  }, [bgpData]);

  if (monitors.length === 0) {
    return (
      <div className="py-8 text-center">
        <GitBranch className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-500 dark:text-slate-400">No BGP path changes detected</p>
      </div>
    );
  }

  const maxUpdates = Math.max(...monitors.map(m => m.updates), 1);
  const totalUpdates = monitors.reduce((sum, m) => sum + m.updates, 0);
  const visible = showAll ? monitors : monitors.slice(0, 8);
  const hasMore = monitors.length > 8;

  function barColor(updates: number, reachability: number): string {
    if (reachability < 80) return 'from-red-500 to-red-400';
    if (updates > maxUpdates * 0.7) return 'from-amber-500 to-orange-400';
    if (updates > maxUpdates * 0.3) return 'from-blue-500 to-blue-400';
    return 'from-emerald-500 to-emerald-400';
  }

  function reachabilityColor(pct: number): string {
    if (pct >= 95) return 'text-emerald-500';
    if (pct >= 80) return 'text-amber-500';
    return 'text-red-500';
  }

  return (
    <div>
      {/* Summary strip */}
      <div className="flex items-center gap-4 mb-3 text-[10px] text-slate-500 dark:text-slate-400">
        <span>{monitors.length} monitors</span>
        <span>{totalUpdates.toLocaleString()} total path changes</span>
        <span>{bgpData.length} BGP entries</span>
      </div>

      {/* Horizontal bar rows */}
      <div className="space-y-1.5">
        {visible.map((entry) => {
          const pct = (entry.updates / maxUpdates) * 100;
          return (
            <div key={entry.monitor} className="group flex items-center gap-3">
              {/* Reachability dot */}
              <div className="flex items-center gap-1.5 flex-shrink-0 w-10">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  entry.avgReachability >= 95 ? 'bg-emerald-500' :
                  entry.avgReachability >= 80 ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className={`text-[10px] font-medium ${reachabilityColor(entry.avgReachability)}`}>
                  {entry.avgReachability}%
                </span>
              </div>

              {/* Monitor name */}
              <span className="text-[11px] text-slate-700 dark:text-slate-300 w-[180px] lg:w-[240px] truncate flex-shrink-0 font-medium" title={entry.monitor}>
                {entry.monitor}
              </span>

              {/* Bar */}
              <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700/40 rounded overflow-hidden">
                <div
                  className={`h-full rounded bg-gradient-to-r ${barColor(entry.updates, entry.avgReachability)} transition-all duration-500 flex items-center justify-end pr-1.5`}
                  style={{ width: `${Math.max(pct, 3)}%` }}
                >
                  {pct > 20 && (
                    <span className="text-[9px] font-bold text-white/90">{entry.updates}</span>
                  )}
                </div>
              </div>

              {/* Count + prefixes */}
              <div className="flex items-center gap-2 flex-shrink-0 w-20 justify-end">
                <span className="text-[11px] font-semibold text-slate-900 dark:text-white tabular-nums">
                  {entry.updates.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {entry.prefixes}p
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more/less */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 mt-2 mx-auto text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          {showAll ? (
            <>Show less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>Show all {monitors.length} monitors <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/30">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500" /> &ge;95% reachable
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <div className="w-2 h-2 rounded-full bg-amber-500" /> &ge;80% reachable
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <div className="w-2 h-2 rounded-full bg-red-500" /> &lt;80% reachable
        </div>
      </div>
    </div>
  );
});

BGPUpdatesChart.displayName = 'BGPUpdatesChart';
export default BGPUpdatesChart;
