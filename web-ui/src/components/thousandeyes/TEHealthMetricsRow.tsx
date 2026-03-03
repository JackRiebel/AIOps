'use client';

import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SparklineChart } from '@/components/cards/widgets/SparklineChart';
import type { HealthMetric } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEHealthMetricsRowProps {
  metrics: HealthMetric[];
  loading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const statusColors = {
  healthy: { border: 'border-l-emerald-500', sparkline: '#10b981', bg: '' },
  warning: { border: 'border-l-amber-500', sparkline: '#f59e0b', bg: '' },
  critical: { border: 'border-l-red-500', sparkline: '#ef4444', bg: 'bg-red-50/50 dark:bg-red-500/5' },
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

// ============================================================================
// Component
// ============================================================================

export const TEHealthMetricsRow = memo(({ metrics, loading }: TEHealthMetricsRowProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-slate-200 dark:border-l-slate-700 p-3">
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
            <div className="h-6 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
            <div className="h-7 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map(metric => {
        const colors = statusColors[metric.status];
        const TrendIcon = trendIcons[metric.trend];
        const trendColor = metric.trend === 'up'
          ? (metric.id === 'alerts' || metric.id === 'loss' || metric.id === 'latency' ? 'text-red-500' : 'text-emerald-500')
          : metric.trend === 'down'
            ? (metric.id === 'agentHealth' || metric.id === 'availability' ? 'text-red-500' : 'text-emerald-500')
            : 'text-slate-400 dark:text-slate-500';

        return (
          <div
            key={metric.id}
            className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 ${colors.border} ${colors.bg} p-3 transition-colors`}
          >
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {metric.label}
            </p>
            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums leading-none">
                {typeof metric.value === 'number' && metric.value % 1 !== 0
                  ? metric.value.toFixed(1)
                  : metric.value}
              </span>
              {metric.unit && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{metric.unit}</span>
              )}
              {metric.trendPercent > 0 && (
                <span className={`flex items-center gap-0.5 text-[10px] font-medium ${trendColor} ml-auto`}>
                  <TrendIcon className="w-3 h-3" />
                  {metric.trendPercent < 10 ? metric.trendPercent.toFixed(1) : Math.round(metric.trendPercent)}
                </span>
              )}
            </div>
            <SparklineChart
              data={metric.sparklineData}
              height={24}
              color={colors.sparkline}
              showEndpoint
              showArea
            />
          </div>
        );
      })}
    </div>
  );
});

TEHealthMetricsRow.displayName = 'TEHealthMetricsRow';
export default TEHealthMetricsRow;
