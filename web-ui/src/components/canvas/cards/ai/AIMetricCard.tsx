'use client';

import { memo } from 'react';
import { AIMetricData } from '@/types/session';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AIMetricCardProps {
  data: AIMetricData;
}

/**
 * AIMetricCard - Display a single key metric prominently
 *
 * Features:
 * - Large centered value with unit
 * - Optional trend indicator (up/down/stable)
 * - Status-based color coding
 * - Context label
 */
export const AIMetricCard = memo(({ data }: AIMetricCardProps) => {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No metric data
      </div>
    );
  }

  const { label, value, unit, trend, context, status } = data;

  // Status colors
  const statusColors = {
    good: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
    },
    critical: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-800',
    },
    neutral: {
      bg: 'bg-slate-50 dark:bg-slate-800/50',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
    },
  };

  const colors = statusColors[status || 'neutral'];

  // Trend icon
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up'
    ? 'text-emerald-500'
    : trend === 'down'
    ? 'text-red-500'
    : 'text-slate-400';

  // Format value
  const displayValue = typeof value === 'number'
    ? (value % 1 === 0 ? value.toString() : value.toFixed(1))
    : value;

  return (
    <div className={`h-full flex flex-col ${colors.bg} rounded-lg border ${colors.border}`}>
      {/* Label */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
          {label}
        </div>
      </div>

      {/* Main value */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="flex items-baseline gap-1">
          <span className={`text-5xl font-bold tabular-nums ${colors.text}`}>
            {displayValue}
          </span>
          {unit && (
            <span className={`text-2xl font-semibold ${colors.text} opacity-70`}>
              {unit}
            </span>
          )}
          {trend && (
            <TrendIcon className={`w-6 h-6 ml-2 ${trendColor}`} />
          )}
        </div>
      </div>

      {/* Context */}
      {context && (
        <div className="flex-shrink-0 px-4 pb-4 pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {context}
          </div>
        </div>
      )}
    </div>
  );
});

AIMetricCard.displayName = 'AIMetricCard';

export default AIMetricCard;
