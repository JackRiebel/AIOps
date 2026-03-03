'use client';

/**
 * BarChart Visualization
 *
 * Displays horizontal or vertical bar charts.
 * Used for top clients, applications, error counts.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface BarChartDataItem {
  label: string;
  value: number;
  secondary?: number; // For stacked/grouped bars
  color?: string;
  displayValue?: string; // Optional formatted display value (e.g., "1.5 GB")
}

interface BarChartProps {
  data: BarChartDataItem[] | Record<string, number>;
  orientation?: 'horizontal' | 'vertical';
  showValues?: boolean;
  showGrid?: boolean;
  maxBars?: number;
  valueField?: string;
  labelField?: string;
  colorScheme?: string[];
  unit?: string;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
];

export const BarChart = memo(({
  data,
  orientation = 'horizontal',
  showValues = true,
  showGrid = true,
  maxBars = 10,
  valueField = 'value',
  labelField = 'label',
  colorScheme = DEFAULT_COLORS,
  unit,
}: BarChartProps) => {
  // Normalize and sort data
  const bars = useMemo(() => {
    let items: BarChartDataItem[];

    if (Array.isArray(data)) {
      items = data.map((item, index) => {
        const itemObj = item as unknown as Record<string, unknown>;
        return {
          label: String(itemObj[labelField] ?? itemObj.label ?? `Item ${index + 1}`),
          value: Number(itemObj[valueField] ?? itemObj.value ?? 0),
          secondary: itemObj.secondary as number | undefined,
          color: (itemObj.color as string) ?? colorScheme[index % colorScheme.length],
          displayValue: (itemObj.displayValue ?? itemObj.usage) as string | undefined, // Support both fields
        };
      });
    } else {
      items = Object.entries(data).map(([label, value], index) => ({
        label,
        value,
        color: colorScheme[index % colorScheme.length],
      }));
    }

    // Sort by value descending and limit
    return items
      .sort((a, b) => b.value - a.value)
      .slice(0, maxBars);
  }, [data, maxBars, valueField, labelField, colorScheme]);

  const maxValue = useMemo(
    () => Math.max(...bars.map(b => b.value), 1),
    [bars]
  );

  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        No data available
      </div>
    );
  }

  if (orientation === 'vertical') {
    return (
      <VerticalBarChart
        bars={bars}
        maxValue={maxValue}
        showValues={showValues}
        showGrid={showGrid}
        unit={unit}
      />
    );
  }

  return (
    <HorizontalBarChart
      bars={bars}
      maxValue={maxValue}
      showValues={showValues}
      showGrid={showGrid}
      unit={unit}
    />
  );
});

BarChart.displayName = 'BarChart';

// =============================================================================
// Horizontal Bar Chart
// =============================================================================

interface InternalBarChartProps {
  bars: BarChartDataItem[];
  maxValue: number;
  showValues: boolean;
  showGrid: boolean;
  unit?: string;
}

const HorizontalBarChart = memo(({
  bars,
  maxValue,
  showValues,
  showGrid,
  unit,
}: InternalBarChartProps) => {
  return (
    <div className="h-full flex flex-col gap-2 py-2 px-1">
      {bars.map((bar, index) => {
        const percentage = (bar.value / maxValue) * 100;

        return (
          <div key={`${bar.label}-${index}`} className="flex items-center gap-2">
            {/* Label */}
            <div className="w-24 text-right text-sm text-slate-500 dark:text-slate-400 truncate shrink-0">
              {bar.label}
            </div>

            {/* Bar container */}
            <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800/50 rounded overflow-hidden relative">
              {/* Grid lines */}
              {showGrid && (
                <div className="absolute inset-0 flex">
                  {[25, 50, 75].map(pct => (
                    <div
                      key={pct}
                      className="absolute top-0 bottom-0 border-l border-slate-200 dark:border-slate-700/30"
                      style={{ left: `${pct}%` }}
                    />
                  ))}
                </div>
              )}

              {/* Bar */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' }}
                className="h-full rounded"
                style={{ backgroundColor: bar.color }}
              />
            </div>

            {/* Value */}
            {showValues && (
              <div className="w-16 text-right text-sm text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                {bar.displayValue ?? formatValue(bar.value, unit)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

HorizontalBarChart.displayName = 'HorizontalBarChart';

// =============================================================================
// Vertical Bar Chart
// =============================================================================

const VerticalBarChart = memo(({
  bars,
  maxValue,
  showValues,
  showGrid,
  unit,
}: InternalBarChartProps) => {
  return (
    <div className="h-full flex flex-col px-2 py-4">
      {/* Chart area */}
      <div className="flex-1 flex items-end gap-2 relative">
        {/* Grid lines */}
        {showGrid && (
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 25, 50, 75, 100].map(pct => (
              <div
                key={pct}
                className="w-full border-t border-slate-200 dark:border-slate-700/30"
              />
            ))}
          </div>
        )}

        {/* Bars */}
        {bars.map((bar, index) => {
          const percentage = (bar.value / maxValue) * 100;

          return (
            <div
              key={`${bar.label}-${index}`}
              className="flex-1 flex flex-col items-center gap-1"
            >
              {/* Value label */}
              {showValues && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                  className="text-xs text-slate-500 dark:text-slate-400 tabular-nums"
                >
                  {bar.displayValue ?? formatValue(bar.value, unit)}
                </motion.span>
              )}

              {/* Bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${percentage}%` }}
                transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' }}
                className="w-full rounded-t"
                style={{ backgroundColor: bar.color, minHeight: 4 }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-2 mt-2 border-t border-slate-200 dark:border-slate-700/50 pt-2">
        {bars.map((bar, index) => (
          <div
            key={`${bar.label}-${index}`}
            className="flex-1 text-center text-xs text-slate-500 truncate"
          >
            {bar.label}
          </div>
        ))}
      </div>
    </div>
  );
});

VerticalBarChart.displayName = 'VerticalBarChart';

// =============================================================================
// Helper Functions
// =============================================================================

function formatValue(value: number, unit?: string): string {
  let formatted: string;

  if (value >= 1_000_000_000) {
    formatted = (value / 1_000_000_000).toFixed(1) + 'G';
  } else if (value >= 1_000_000) {
    formatted = (value / 1_000_000).toFixed(1) + 'M';
  } else if (value >= 1_000) {
    formatted = (value / 1_000).toFixed(1) + 'K';
  } else {
    formatted = value.toFixed(0);
  }

  return unit ? `${formatted}${unit}` : formatted;
}
