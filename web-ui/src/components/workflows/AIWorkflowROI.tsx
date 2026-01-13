'use client';

import { memo, useMemo } from 'react';
import { Clock, DollarSign, TrendingUp, Zap, BarChart3 } from 'lucide-react';
import { HelpTooltip } from '@/components/common';
import type { WorkflowStats } from './types';

// ============================================================================
// Types
// ============================================================================

export interface AIWorkflowROIProps {
  stats: WorkflowStats | null;
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

function formatCost(cost: number): string {
  if (cost >= 1000) {
    return `$${(cost / 1000).toFixed(1)}K`;
  }
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  }
  return `$${cost.toFixed(4)}`;
}

// ============================================================================
// AIWorkflowROI Component
// ============================================================================

export const AIWorkflowROI = memo(({ stats, className = '' }: AIWorkflowROIProps) => {
  // Calculate derived metrics
  const metrics = useMemo(() => {
    if (!stats) return null;

    const totalTimeSaved = stats.total_time_saved_seconds || 0;
    const aiCost = stats.total_ai_cost_usd || 0;
    // Estimate manual cost at $75/hr
    const manualCost = stats.estimated_manual_cost_usd || ((totalTimeSaved / 3600) * 75);
    const netSavings = manualCost - aiCost;
    const roi = aiCost > 0 ? ((netSavings / aiCost) * 100) : 0;
    // Payback period in executions (how many executions until AI pays for itself)
    const avgTimeSaved = stats.avg_time_saved_per_execution || 0;
    const costPerExecution = stats.total_successes > 0 ? aiCost / stats.total_successes : 0;
    const savingsPerExecution = avgTimeSaved > 0 ? (avgTimeSaved / 3600) * 75 : 0;
    const executionsToPayback = savingsPerExecution > 0 && costPerExecution > 0
      ? Math.ceil(costPerExecution / (savingsPerExecution - costPerExecution))
      : 0;

    return {
      totalTimeSaved,
      aiCost,
      manualCost,
      netSavings,
      roi,
      avgTimeSaved,
      executionsToPayback,
      successCount: stats.total_successes,
    };
  }, [stats]);

  // Don't show if no stats or no automated executions
  if (!metrics || (metrics.successCount === 0 && metrics.aiCost === 0)) {
    return null;
  }

  // Determine ROI color
  const roiColor = metrics.roi >= 500
    ? 'text-emerald-600 dark:text-emerald-400'
    : metrics.roi >= 200
    ? 'text-green-600 dark:text-green-400'
    : metrics.roi >= 100
    ? 'text-cyan-600 dark:text-cyan-400'
    : metrics.roi >= 0
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className={`bg-gradient-to-r from-cyan-50 dark:from-cyan-900/20 to-purple-50 dark:to-purple-900/20 rounded-xl border border-cyan-200 dark:border-cyan-500/30 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-cyan-100 dark:bg-cyan-500/20 rounded-lg">
          <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Automation ROI
        </h3>
        <HelpTooltip content="Return on investment for automated workflows. Compares AI costs vs estimated manual labor costs based on time saved." />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Time Automated */}
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
              Time Saved
            </span>
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatTimeSaved(metrics.totalTimeSaved)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            total automated
          </div>
        </div>

        {/* AI Cost */}
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
              AI Cost
            </span>
          </div>
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {formatCost(metrics.aiCost)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            total spend
          </div>
        </div>

        {/* Manual Cost Equivalent */}
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
              Manual Cost
            </span>
            <HelpTooltip content="Estimated cost if these tasks were done manually, based on $75/hr engineer rate." />
          </div>
          <div className="text-lg font-bold text-slate-600 dark:text-slate-300 line-through decoration-2">
            {formatCost(metrics.manualCost)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            equivalent
          </div>
        </div>

        {/* Net Savings */}
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
              Net Savings
            </span>
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {formatCost(metrics.netSavings)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            labor saved
          </div>
        </div>

        {/* ROI */}
        <div className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
              ROI
            </span>
            <HelpTooltip content="Return on Investment = (Net Savings / AI Cost) × 100. Values above 100% mean automation saves more than it costs." />
          </div>
          <div className={`text-lg font-bold ${roiColor}`}>
            {metrics.roi >= 0 ? '+' : ''}{metrics.roi.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            {metrics.successCount} executions
          </div>
        </div>
      </div>

      {/* Payback indicator */}
      {metrics.roi >= 100 && (
        <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            <span className="font-medium">Automation is paying off:</span> Each automated execution saves ~{formatTimeSaved(Math.round(metrics.avgTimeSaved))} of manual work.
          </p>
        </div>
      )}
    </div>
  );
});

AIWorkflowROI.displayName = 'AIWorkflowROI';

export default AIWorkflowROI;
