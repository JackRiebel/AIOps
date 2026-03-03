'use client';

import { memo, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import type { SplunkInsight, SeverityLevel } from './types';
import { SEVERITY_CONFIGS } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkSeverityChartProps {
  insights: SplunkInsight[];
  loading: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const SplunkSeverityChart = memo(({ insights, loading }: SplunkSeverityChartProps) => {
  const severity = useMemo(() => {
    const counts: Record<SeverityLevel, { count: number; events: number }> = {
      critical: { count: 0, events: 0 },
      high: { count: 0, events: 0 },
      medium: { count: 0, events: 0 },
      low: { count: 0, events: 0 },
      info: { count: 0, events: 0 },
    };

    for (const insight of insights) {
      const s = insight.severity as SeverityLevel;
      if (s in counts) {
        counts[s].count++;
        counts[s].events += insight.log_count || 0;
      }
    }

    const total = insights.length || 1;
    return (['critical', 'high', 'medium', 'low', 'info'] as SeverityLevel[]).map(level => ({
      level,
      ...counts[level],
      pct: Math.round((counts[level].count / total) * 100),
      config: SEVERITY_CONFIGS[level],
    }));
  }, [insights]);

  const totalEvents = severity.reduce((sum, s) => sum + s.events, 0);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="p-4 space-y-3">
          <div className="h-7 rounded-lg bg-slate-200 dark:bg-slate-700" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 rounded bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Severity Distribution</h3>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">{totalEvents.toLocaleString()} events</span>
      </div>

      <div className="p-4">
        {/* Stacked bar */}
        <div className="h-7 flex rounded-xl overflow-hidden mb-4 bg-slate-100 dark:bg-slate-700/30">
          {severity.filter(s => s.count > 0).map(s => (
            <div
              key={s.level}
              className={`${s.config.dot} transition-all duration-500 relative group`}
              style={{ width: `${Math.max(s.pct, 3)}%` }}
              title={`${s.level}: ${s.count} categories, ${s.events.toLocaleString()} events`}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] font-bold text-white drop-shadow-sm">{s.pct}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Severity rows */}
        <div className="space-y-2.5">
          {severity.map(s => (
            <div key={s.level} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-20 flex-shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full ${s.config.dot} ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-800 ${s.count > 0 ? 'ring-current opacity-100' : 'ring-transparent opacity-40'}`} style={{ color: s.count > 0 ? undefined : 'transparent' }} />
                <span className={`text-[11px] font-medium capitalize ${s.count > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>{s.level}</span>
              </div>
              <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.config.dot} transition-all duration-500`}
                  style={{ width: `${s.count > 0 ? Math.max(s.pct, 3) : 0}%` }}
                />
              </div>
              <div className="flex items-center gap-2 w-24 justify-end flex-shrink-0">
                <span className={`text-[11px] font-bold tabular-nums ${s.count > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>{s.count}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums w-14 text-right">{s.events.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

SplunkSeverityChart.displayName = 'SplunkSeverityChart';
export default SplunkSeverityChart;
