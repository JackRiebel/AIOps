'use client';

import { memo, useMemo } from 'react';
import type { AIQualityResult } from '@/types/ai-quality';

// ============================================================================
// Types
// ============================================================================

export interface PromptTestHistoryProps {
  results: AIQualityResult[];
}

// ============================================================================
// Constants
// ============================================================================

type HealthLevel = 'healthy' | 'degraded' | 'failing';

const healthConfig: Record<HealthLevel, { label: string; dot: string; bg: string; text: string }> = {
  healthy: {
    label: 'Healthy',
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  degraded: {
    label: 'Degraded',
    dot: 'bg-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
  },
  failing: {
    label: 'Failing',
    dot: 'bg-red-500',
    bg: 'bg-red-50 dark:bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
  },
};

// ============================================================================
// Helpers
// ============================================================================

function deriveHealth(result: AIQualityResult): HealthLevel {
  const total = result.assertions_passed + result.assertions_failed;
  if (total === 0) return 'healthy';
  const rate = result.assertions_passed / total;
  if (result.status_code >= 500 || rate < 0.5) return 'failing';
  if (result.status_code >= 400 || rate < 0.8 || result.response_time_ms > 2000) return 'degraded';
  return 'healthy';
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function statusCodeColor(code: number): string {
  if (code >= 200 && code < 300) return 'text-emerald-600 dark:text-emerald-400';
  if (code >= 300 && code < 400) return 'text-blue-600 dark:text-blue-400';
  if (code >= 400 && code < 500) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// ============================================================================
// Component
// ============================================================================

export const PromptTestHistory = memo(({ results }: PromptTestHistoryProps) => {
  const rows = useMemo(() => {
    return [...results]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  }, [results]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Recent Test Executions
        </h3>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          Last {rows.length} runs
        </span>
      </div>

      <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Time
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Agent Location
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                Response Time
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                Status
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                Assertions
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Health
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {rows.map((r, idx) => {
              const health = deriveHealth(r);
              const cfg = healthConfig[health];
              const total = r.assertions_passed + r.assertions_failed;

              return (
                <tr
                  key={`${r.timestamp}-${idx}`}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Time */}
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatTimestamp(r.timestamp)}
                    </span>
                  </td>

                  {/* Agent Location */}
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      {r.agent_location}
                    </span>
                  </td>

                  {/* Response Time */}
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-[11px] tabular-nums font-medium ${
                      r.response_time_ms > 2000 ? 'text-red-600 dark:text-red-400' :
                      r.response_time_ms > 500 ? 'text-amber-600 dark:text-amber-400' :
                      'text-slate-700 dark:text-slate-300'
                    }`}>
                      {r.response_time_ms.toFixed(0)}
                      <span className="text-slate-400 dark:text-slate-500 ml-0.5">ms</span>
                    </span>
                  </td>

                  {/* Status Code */}
                  <td className="px-3 py-2.5 text-right">
                    <span className={`text-[11px] tabular-nums font-medium ${statusCodeColor(r.status_code)}`}>
                      {r.status_code}
                    </span>
                  </td>

                  {/* Assertions */}
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-[11px] tabular-nums">
                      <span className={total > 0 && r.assertions_failed > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                        {r.assertions_passed}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">/{total}</span>
                    </span>
                  </td>

                  {/* Health */}
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${health === 'failing' ? 'animate-pulse' : ''}`} />
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {results.length > 20 && (
        <div className="text-[11px] text-slate-400 dark:text-slate-500 px-1 mt-2">
          Showing 20 of {results.length} executions
        </div>
      )}
    </div>
  );
});

PromptTestHistory.displayName = 'PromptTestHistory';
export default PromptTestHistory;
