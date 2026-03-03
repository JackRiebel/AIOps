'use client';

import { memo } from 'react';
import { Shield, ArrowRight } from 'lucide-react';
import type { SplunkInsight } from './types';
import { SEVERITY_CONFIGS, type SeverityLevel } from './types';

export interface SplunkSecuritySummaryCardProps {
  insights: SplunkInsight[];
  loading: boolean;
  onViewDetails: () => void;
}

const BADGE_LEVELS: { key: SeverityLevel; label: string }[] = [
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];

export const SplunkSecuritySummaryCard = memo(({
  insights,
  loading,
  onViewDetails,
}: SplunkSecuritySummaryCardProps) => {
  const counts: Record<SeverityLevel, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  insights.forEach(i => {
    if (i.severity in counts) counts[i.severity as SeverityLevel]++;
  });

  const topInsights = insights
    .filter(i => i.severity === 'critical' || i.severity === 'high' || i.severity === 'medium')
    .slice(0, 4);

  if (loading) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-2 min-h-[24px]">
          <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Security Summary</h3>
        </div>
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 animate-pulse">
          <div className="flex gap-2 mb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 w-20 rounded-lg bg-slate-100 dark:bg-slate-700" />
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded" />
            <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-2 min-h-[24px]">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Security Summary
          </h3>
          {insights.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {insights.length} findings
            </span>
          )}
        </div>
        <button
          onClick={onViewDetails}
          className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium transition"
        >
          Details
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Card Body */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 transition-colors hover:border-red-300 dark:hover:border-red-500/30">
        {/* Severity badges */}
        <div className="flex items-center gap-2 mb-4">
          {BADGE_LEVELS.map(({ key, label }) => {
            const config = SEVERITY_CONFIGS[key];
            const count = counts[key];
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${config.badge} ${count > 0 ? '' : 'opacity-40'}`}
              >
                <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                <span className="tabular-nums">{count}</span>
                <span className="hidden sm:inline">{label}</span>
              </span>
            );
          })}
        </div>

        {/* Top insights */}
        {topInsights.length > 0 ? (
          <div className="space-y-2">
            {topInsights.map(insight => {
              const config = SEVERITY_CONFIGS[insight.severity as SeverityLevel] || SEVERITY_CONFIGS.info;
              return (
                <div
                  key={insight.id}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/20 border border-slate-100 dark:border-slate-700/30"
                >
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
                  <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-2">{insight.title}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 py-4 justify-center text-center">
            <Shield className="w-5 h-5 text-emerald-300 dark:text-emerald-600" />
            <p className="text-xs text-slate-500 dark:text-slate-400">No security findings detected</p>
          </div>
        )}
      </div>
    </div>
  );
});

SplunkSecuritySummaryCard.displayName = 'SplunkSecuritySummaryCard';
export default SplunkSecuritySummaryCard;
