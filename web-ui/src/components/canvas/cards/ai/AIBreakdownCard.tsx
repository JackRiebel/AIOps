'use client';

import { memo, useMemo } from 'react';
import { AIBreakdownData } from '@/types/session';
import PieChart from '../charts/PieChart';

interface AIBreakdownCardProps {
  data: AIBreakdownData;
}

const DEFAULT_COLORS = [
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#6b7280', // gray
];

/**
 * AIBreakdownCard - Display category breakdown with chart
 *
 * Features:
 * - Pie, donut, or bar chart visualization
 * - Custom colors per item
 * - Legend with values
 */
export const AIBreakdownCard = memo(({ data }: AIBreakdownCardProps) => {
  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No breakdown data
      </div>
    );
  }

  const { title, items, displayAs } = data;

  // Calculate total for bar display
  const total = useMemo(() => items.reduce((sum, item) => sum + item.value, 0), [items]);

  // Prepare data with colors
  const chartData = useMemo(() => {
    return items.map((item, index) => ({
      label: item.label,
      value: item.value,
      color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    }));
  }, [items]);

  // Bar chart display
  if (displayAs === 'bar') {
    return (
      <div className="h-full flex flex-col">
        {/* Title */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </span>
        </div>

        {/* Bars */}
        <div className="flex-1 p-3 space-y-2 overflow-auto">
          {chartData.map((item, index) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;

            return (
              <div key={index} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 truncate flex-1 mr-2">
                    {item.label}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {item.value.toLocaleString()} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400">Total</span>
            <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
              {total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Pie or donut chart
  return (
    <div className="h-full flex flex-col">
      {/* Title */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </span>
      </div>

      {/* Chart */}
      <div className="flex-1 flex items-center justify-center p-4">
        <PieChart
          data={chartData}
          size={100}
          donut={displayAs === 'donut'}
          donutWidth={20}
          showLegend={true}
          showPercentages={true}
          centerLabel={displayAs === 'donut' ? 'Total' : undefined}
          centerValue={displayAs === 'donut' ? total : undefined}
        />
      </div>
    </div>
  );
});

AIBreakdownCard.displayName = 'AIBreakdownCard';

export default AIBreakdownCard;
