'use client';

import { memo, useMemo } from 'react';
import { Zap, Clock, TrendingUp, Sparkles } from 'lucide-react';
import { HelpTooltip } from '@/components/common';
import type { Incident } from './index';

// ============================================================================
// Types
// ============================================================================

export interface AIImpactSummaryProps {
  incidents: Incident[];
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeSaved(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${seconds}s`;
}

// ============================================================================
// AIImpactSummary Component
// ============================================================================

export const AIImpactSummary = memo(({ incidents, className = '' }: AIImpactSummaryProps) => {
  const stats = useMemo(() => {
    const aiAssisted = incidents.filter(i => i.ai_assisted);
    const totalTimeSaved = aiAssisted.reduce((sum, i) => sum + (i.ai_time_saved_seconds || 0), 0);
    const avgTimeSaved = aiAssisted.length > 0 ? totalTimeSaved / aiAssisted.length : 0;
    const aiAssistedPct = incidents.length > 0 ? (aiAssisted.length / incidents.length) * 100 : 0;

    return {
      aiAssistedCount: aiAssisted.length,
      totalIncidents: incidents.length,
      totalTimeSaved,
      avgTimeSaved,
      aiAssistedPct,
    };
  }, [incidents]);

  // Don't show if no AI-assisted incidents
  if (stats.aiAssistedCount === 0) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-r from-purple-50 dark:from-purple-900/20 to-cyan-50 dark:to-cyan-900/20 rounded-xl border border-purple-200 dark:border-purple-500/30 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          AI Impact Summary
        </h3>
        <HelpTooltip content="Summary of how AI assistance has helped resolve incidents in this time period." />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* AI-Assisted Count */}
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
              AI-Assisted
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.aiAssistedCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              / {stats.totalIncidents}
            </span>
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
            {stats.aiAssistedPct.toFixed(0)}% of incidents
          </div>
        </div>

        {/* Total Time Saved */}
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
              Total Saved
            </span>
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatTimeSaved(stats.totalTimeSaved)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            cumulative time
          </div>
        </div>

        {/* Average Time Saved */}
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
              Avg Saved
            </span>
          </div>
          <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
            {formatTimeSaved(Math.round(stats.avgTimeSaved))}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            per incident
          </div>
        </div>

        {/* Estimated Value */}
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
              Est. Value
            </span>
            <HelpTooltip content="Estimated labor cost savings based on $75/hr engineer rate." />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            ${((stats.totalTimeSaved / 3600) * 75).toFixed(0)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            labor savings
          </div>
        </div>
      </div>
    </div>
  );
});

AIImpactSummary.displayName = 'AIImpactSummary';

export default AIImpactSummary;
