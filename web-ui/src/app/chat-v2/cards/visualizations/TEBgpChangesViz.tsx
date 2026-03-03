'use client';

/**
 * TEBgpChangesViz
 *
 * Displays BGP route changes data for inline chat card display.
 * Shows a compact summary with horizontal bars for update counts per monitor.
 */

import { memo, useMemo } from 'react';
import { BGPResult } from '@/components/thousandeyes/types';

interface TEBgpChangesVizProps {
  data: Record<string, unknown>;
}

export const TEBgpChangesViz = memo(({ data }: TEBgpChangesVizProps) => {
  const { bgpResults, summary, monitorUpdates } = useMemo(() => {
    const results: BGPResult[] = Array.isArray(data.bgpData)
      ? (data.bgpData as BGPResult[])
      : [];

    const prefixes = new Set(results.map(r => r.prefix));
    const totalUpdates = results.reduce((sum, r) => sum + (r.updates ?? 0), 0);

    // Aggregate updates per monitor
    const monitorMap = new Map<string, number>();
    for (const r of results) {
      monitorMap.set(r.monitor, (monitorMap.get(r.monitor) ?? 0) + (r.updates ?? 0));
    }
    const monitors = Array.from(monitorMap.entries())
      .map(([name, updates]) => ({ name, updates }))
      .sort((a, b) => b.updates - a.updates)
      .slice(0, 5);

    return {
      bgpResults: results,
      summary: { prefixCount: prefixes.size, totalUpdates },
      monitorUpdates: monitors,
    };
  }, [data]);

  if (bgpResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <svg className="w-8 h-8 mb-2 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-slate-500 dark:text-slate-400">No BGP changes detected</span>
      </div>
    );
  }

  const maxUpdates = monitorUpdates.length > 0 ? (monitorUpdates[0].updates || 1) : 1;

  return (
    <div className="h-full flex flex-col gap-2 p-3">
      <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span>Prefixes: <strong className="text-slate-800 dark:text-slate-200">{summary.prefixCount}</strong></span>
        <span>Updates: <strong className="text-slate-800 dark:text-slate-200">{summary.totalUpdates.toLocaleString()}</strong></span>
      </div>
      <div className="flex-1 overflow-auto space-y-2">
        {monitorUpdates.map((m) => (
          <div key={m.name}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-slate-700 dark:text-slate-300 truncate max-w-[70%]">{m.name}</span>
              <span className="text-slate-500 tabular-nums">{m.updates.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(4, (m.updates / maxUpdates) * 100)}%`,
                  backgroundColor: m.updates > maxUpdates * 0.7 ? '#f59e0b' : '#3b82f6',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

TEBgpChangesViz.displayName = 'TEBgpChangesViz';
