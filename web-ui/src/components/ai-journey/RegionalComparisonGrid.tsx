'use client';

import { memo, useMemo } from 'react';
import type { RegionalMetric } from '@/types/ai-quality';

// ============================================================================
// Types
// ============================================================================

export interface RegionalComparisonGridProps {
  regional: RegionalMetric[];
}

// ============================================================================
// Constants
// ============================================================================

const healthConfig: Record<RegionalMetric['health'], { label: string; dot: string; text: string }> = {
  healthy: {
    label: 'Healthy',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  failing: {
    label: 'Failing',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
  },
};

// ============================================================================
// Component
// ============================================================================

export const RegionalComparisonGrid = memo(({ regional }: RegionalComparisonGridProps) => {
  const sorted = useMemo(() => {
    const healthOrder: Record<string, number> = { failing: 0, degraded: 1, healthy: 2 };
    return [...regional].sort((a, b) => (healthOrder[a.health] ?? 2) - (healthOrder[b.health] ?? 2));
  }, [regional]);

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
        <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Regional Comparison
        </h3>
        <div className="flex items-center justify-center py-6 text-[12px] text-slate-400 dark:text-slate-500">
          No regional data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
      <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Regional Comparison
      </h3>
      <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <tr className="text-slate-400 text-left border-b border-slate-200 dark:border-slate-700">
              <th className="pr-2 pb-2 font-semibold">Location</th>
              <th className="pr-2 pb-2 font-semibold text-right">Resp. Time</th>
              <th className="pr-2 pb-2 font-semibold text-right">Latency</th>
              <th className="pr-2 pb-2 font-semibold text-right">Pass Rate</th>
              <th className="pr-2 pb-2 font-semibold text-right">Samples</th>
              <th className="pr-2 pb-2 font-semibold">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {sorted.map((r) => {
              const cfg = healthConfig[r.health];
              return (
                <tr
                  key={r.agent_location}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
                >
                  <td className="py-2 pr-2">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {r.agent_location}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    <span className={`font-medium ${
                      r.avg_response_time_ms > 2000 ? 'text-red-600 dark:text-red-400' :
                      r.avg_response_time_ms > 500 ? 'text-amber-600 dark:text-amber-400' :
                      'text-slate-700 dark:text-slate-300'
                    }`}>
                      {r.avg_response_time_ms.toFixed(0)}
                      <span className="text-slate-400 dark:text-slate-500 ml-0.5">ms</span>
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    <span className="text-slate-700 dark:text-slate-300">
                      {r.avg_latency_ms.toFixed(0)}
                      <span className="text-slate-400 dark:text-slate-500 ml-0.5">ms</span>
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    <span className={`font-medium ${
                      r.assertion_pass_rate >= 95 ? 'text-emerald-600 dark:text-emerald-400' :
                      r.assertion_pass_rate >= 80 ? 'text-amber-600 dark:text-amber-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {r.assertion_pass_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {r.sample_count}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${
                        r.health === 'failing' ? 'animate-pulse' : ''
                      }`} />
                      <span className={`text-[10px] font-medium ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

RegionalComparisonGrid.displayName = 'RegionalComparisonGrid';
export default RegionalComparisonGrid;
