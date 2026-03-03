'use client';

import { memo } from 'react';
import { TrendingUp, Loader2, BarChart3 } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DailyCost } from './types';

// ============================================================================
// Types
// ============================================================================

export interface DailySpendChartProps {
  data: DailyCost[];
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Custom Tooltip Component
// ============================================================================

interface TooltipPayload {
  value: number;
  dataKey: string;
  payload: DailyCost;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0].value;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">
        ${value.toFixed(4)}
      </p>
    </div>
  );
}

// ============================================================================
// DailySpendChart Component
// ============================================================================

export const DailySpendChart = memo(({
  data,
  loading = false,
  className = '',
}: DailySpendChartProps) => {
  // Loading state
  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden ${className}`}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-500" />
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Daily Spend Trend</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading chart data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden ${className}`}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-500" />
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Daily Spend Trend</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 mb-3 bg-cyan-100 dark:bg-cyan-500/10 rounded-full flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No spend data</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cost data will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/30">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-500" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Daily Spend Trend</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="colorCostGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-slate-200 dark:stroke-slate-700"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                style={{ fontSize: '11px' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tickFormatter={(v) => `$${v.toFixed(2)}`}
                style={{ fontSize: '11px' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="cost_usd"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#colorCostGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

DailySpendChart.displayName = 'DailySpendChart';

export default DailySpendChart;
