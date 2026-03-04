'use client';

import { memo, useMemo } from 'react';
import { Clock, DollarSign, TrendingUp, Zap, BarChart3 } from 'lucide-react';
import { HelpTooltip } from '@/components/common';
import type { WorkflowStats } from './types';

export interface AIWorkflowROIProps {
  stats: WorkflowStats | null;
  className?: string;
}

function formatTimeSaved(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

function formatCost(cost: number): string {
  if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}K`;
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(4)}`;
}

export const AIWorkflowROI = memo(({ stats, className = '' }: AIWorkflowROIProps) => {
  const metrics = useMemo(() => {
    if (!stats) return null;
    const totalTimeSaved = stats.total_time_saved_seconds || 0;
    const aiCost = stats.total_ai_cost_usd || 0;
    const manualCost = stats.estimated_manual_cost_usd || ((totalTimeSaved / 3600) * 75);
    const netSavings = manualCost - aiCost;
    const roi = aiCost > 0 ? ((netSavings / aiCost) * 100) : 0;
    const avgTimeSaved = stats.avg_time_saved_per_execution || 0;
    const costPerExecution = stats.total_successes > 0 ? aiCost / stats.total_successes : 0;
    const savingsPerExecution = avgTimeSaved > 0 ? (avgTimeSaved / 3600) * 75 : 0;
    const executionsToPayback = savingsPerExecution > 0 && costPerExecution > 0
      ? Math.ceil(costPerExecution / (savingsPerExecution - costPerExecution))
      : 0;
    return { totalTimeSaved, aiCost, manualCost, netSavings, roi, avgTimeSaved, executionsToPayback, successCount: stats.total_successes };
  }, [stats]);

  if (!metrics || (metrics.successCount === 0 && metrics.aiCost === 0)) return null;

  const roiColor = metrics.roi >= 500 ? 'text-emerald-600 dark:text-emerald-400'
    : metrics.roi >= 200 ? 'text-green-600 dark:text-green-400'
    : metrics.roi >= 100 ? 'text-cyan-600 dark:text-cyan-400'
    : metrics.roi >= 0 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  const metricCards = [
    {
      icon: Clock,
      label: 'Time Saved',
      value: formatTimeSaved(metrics.totalTimeSaved),
      sub: 'total automated',
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      icon: Zap,
      label: 'AI Cost',
      value: formatCost(metrics.aiCost),
      sub: 'total spend',
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50 dark:bg-purple-500/10',
    },
    {
      icon: DollarSign,
      label: 'Manual Cost',
      value: formatCost(metrics.manualCost),
      sub: 'equivalent',
      iconColor: 'text-slate-400',
      iconBg: 'bg-slate-100 dark:bg-slate-700/50',
      strikethrough: true,
    },
    {
      icon: DollarSign,
      label: 'Net Savings',
      value: formatCost(metrics.netSavings),
      sub: 'labor saved',
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      icon: TrendingUp,
      label: 'ROI',
      value: `${metrics.roi >= 0 ? '+' : ''}${metrics.roi.toFixed(0)}%`,
      sub: `${metrics.successCount} executions`,
      iconColor: 'text-cyan-500',
      iconBg: 'bg-cyan-50 dark:bg-cyan-500/10',
      valueColor: roiColor,
    },
  ];

  return (
    <div className={`rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/40 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
          <BarChart3 className="w-3.5 h-3.5 text-white" />
        </div>
        <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">Automation ROI</h3>
        <HelpTooltip content="Return on investment for automated workflows. Compares AI costs vs estimated manual labor costs based on time saved." />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-slate-100 dark:bg-slate-700/30">
        {metricCards.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="bg-white dark:bg-slate-800/60 p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${m.iconBg}`}>
                  <Icon className={`w-3 h-3 ${m.iconColor}`} />
                </div>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {m.label}
                </span>
              </div>
              <div className={`text-lg font-bold ${m.valueColor || 'text-slate-900 dark:text-white'} ${m.strikethrough ? 'line-through decoration-2 text-slate-400 dark:text-slate-500' : ''}`}>
                {m.value}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{m.sub}</div>
            </div>
          );
        })}
      </div>

      {metrics.roi >= 100 && (
        <div className="px-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-500/5 border-t border-emerald-100 dark:border-emerald-500/10">
          <p className="text-[12px] text-emerald-700 dark:text-emerald-400">
            <span className="font-semibold">Automation is paying off:</span> Each execution saves ~{formatTimeSaved(Math.round(metrics.avgTimeSaved))} of manual work.
          </p>
        </div>
      )}
    </div>
  );
});

AIWorkflowROI.displayName = 'AIWorkflowROI';

export default AIWorkflowROI;
