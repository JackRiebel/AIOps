'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Clock, DollarSign, Zap } from 'lucide-react';
import { HelpTooltip } from '@/components/common';

// ============================================================================
// Types
// ============================================================================

interface ROIComparisonData {
  timeSavedMinutes: number;
  manualCostEstimate: number;
  aiCostTotal: number;
  roiPercentage: number;
  sessionsCount: number;
  avgSessionDuration: number;
}

interface ROIComparisonCardProps {
  data: ROIComparisonData;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatCost(cost: number): string {
  if (cost >= 1000) {
    return `$${(cost / 1000).toFixed(1)}K`;
  }
  // For small costs, show more precision
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

function getROIColor(roi: number): { text: string; bg: string } {
  if (roi >= 500) {
    return { text: 'text-emerald-500', bg: 'bg-emerald-500' };
  } else if (roi >= 200) {
    return { text: 'text-green-500', bg: 'bg-green-500' };
  } else if (roi >= 100) {
    return { text: 'text-yellow-500', bg: 'bg-yellow-500' };
  } else {
    return { text: 'text-red-500', bg: 'bg-red-500' };
  }
}

function formatROI(roi: number): string {
  // Cap display at 99999% for readability
  if (roi > 99999) {
    return '>99,999%';
  }
  return `${Math.round(roi).toLocaleString()}%`;
}

// ============================================================================
// Component
// ============================================================================

export function ROIComparisonCard({ data, className = '' }: ROIComparisonCardProps) {
  const roiColors = useMemo(() => getROIColor(data.roiPercentage), [data.roiPercentage]);

  const savingsPercentage = useMemo(() => {
    if (data.manualCostEstimate === 0) return 0;
    return ((data.manualCostEstimate - data.aiCostTotal) / data.manualCostEstimate) * 100;
  }, [data.manualCostEstimate, data.aiCostTotal]);

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-cyan-500 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-500/10">
            <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            ROI Comparison
          </h3>
        </div>
      </div>

      {/* Comparison Bars */}
      <div className="p-5 space-y-6">
        {/* Without AI vs With AI - Cost */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Cost Comparison
              <HelpTooltip content="Compares estimated manual labor costs (based on engineer time × hourly rate) vs actual AI API costs for the same tasks." />
            </span>
            <span className="text-xs font-medium text-emerald-500">
              {savingsPercentage.toFixed(0)}% savings
            </span>
          </div>

          <div className="space-y-2">
            {/* Without AI */}
            <div className="flex items-center gap-3">
              <span className="w-20 text-xs text-slate-600 dark:text-slate-400">Without AI</span>
              <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700/50 rounded overflow-hidden">
                <div
                  className="h-full bg-slate-400 dark:bg-slate-500 flex items-center justify-end px-2 transition-all duration-500"
                  style={{ width: '100%' }}
                >
                  <span className="text-xs font-medium text-white">
                    {formatCost(data.manualCostEstimate)}
                  </span>
                </div>
              </div>
            </div>

            {/* With AI */}
            <div className="flex items-center gap-3">
              <span className="w-20 text-xs text-slate-600 dark:text-slate-400">With AI</span>
              <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700/50 rounded overflow-hidden relative">
                {(() => {
                  const barWidth = data.manualCostEstimate > 0 ? Math.max(3, (data.aiCostTotal / data.manualCostEstimate) * 100) : 3;
                  const showLabelOutside = barWidth < 15; // Show label outside if bar is too small
                  return (
                    <>
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                      <span
                        className={`absolute top-1/2 -translate-y-1/2 text-xs font-medium ${
                          showLabelOutside
                            ? 'left-[calc(var(--bar-width)+4px)] text-slate-600 dark:text-slate-300'
                            : 'right-2 text-white'
                        }`}
                        style={{ '--bar-width': `${barWidth}%` } as React.CSSProperties}
                      >
                        {formatCost(data.aiCostTotal)}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 dark:border-slate-700/50" />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Time Saved */}
          <div className="flex items-start gap-3 border-l-2 border-l-emerald-500 pl-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/10">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatTime(data.timeSavedMinutes)}
              </div>
              <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                Time Saved
                <HelpTooltip content="Estimated time saved compared to manual resolution. Calculated based on AI analysis of what tasks were completed and industry benchmarks." />
              </span>
            </div>
          </div>

          {/* ROI */}
          <div className="flex items-start gap-3 border-l-2 border-l-cyan-500 pl-3">
            <div className={`p-2 rounded-lg ${roiColors.bg}/10`}>
              {data.roiPercentage >= 100 ? (
                <TrendingUp className={`w-4 h-4 ${roiColors.text}`} />
              ) : (
                <TrendingDown className={`w-4 h-4 ${roiColors.text}`} />
              )}
            </div>
            <div>
              <div className={`text-lg font-semibold ${roiColors.text}`}>
                {formatROI(data.roiPercentage)}
              </div>
              <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                ROI Achieved
                <HelpTooltip content="Return on Investment = (Manual Cost - AI Cost) / AI Cost × 100. Values above 100% mean AI assistance saves more than it costs." />
              </span>
            </div>
          </div>

          {/* Sessions */}
          <div className="flex items-start gap-3 border-l-2 border-l-blue-500 pl-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/10">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                {data.sessionsCount}
              </div>
              <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                Sessions
                <HelpTooltip content="Total number of AI-assisted sessions in this period. Each session represents a focused troubleshooting or analysis task." />
              </span>
            </div>
          </div>

          {/* Net Savings */}
          <div className="flex items-start gap-3 border-l-2 border-l-violet-500 pl-3">
            <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-500/10">
              <DollarSign className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-lg font-semibold text-emerald-500">
                {formatCost(data.manualCostEstimate - data.aiCostTotal)}
              </div>
              <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                Net Savings
                <HelpTooltip content="Estimated manual labor cost minus AI costs. Manual cost is calculated from time saved × average engineer hourly rate ($85/hr)." />
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ROIComparisonCard;
