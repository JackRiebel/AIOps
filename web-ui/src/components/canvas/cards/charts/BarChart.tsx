'use client';

import { memo, useMemo, useRef, useEffect, useState } from 'react';

interface BarDataItem {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;  // For grouped bars
}

interface BarChartProps {
  data: BarDataItem[];
  orientation?: 'horizontal' | 'vertical';
  showValues?: boolean;
  showLabels?: boolean;
  valueFormatter?: (value: number) => string;
  maxBars?: number;
  barHeight?: number;
  barSpacing?: number;
  colors?: string[];
  thresholds?: {
    warning?: number;
    critical?: number;
  };
  grouped?: boolean;  // For grouped bar chart
  groupLabels?: [string, string];
  className?: string;
}

const DEFAULT_COLORS = [
  'rgb(6, 182, 212)',   // cyan
  'rgb(59, 130, 246)',  // blue
  'rgb(168, 85, 247)',  // purple
  'rgb(236, 72, 153)',  // pink
  'rgb(34, 197, 94)',   // green
  'rgb(245, 158, 11)',  // amber
  'rgb(239, 68, 68)',   // red
  'rgb(107, 114, 128)', // gray
];

/**
 * BarChart - Horizontal or vertical bar chart
 *
 * Features:
 * - Horizontal or vertical orientation
 * - Color-coded by value or custom colors
 * - Threshold-based coloring
 * - Grouped bars for comparison
 */
export const BarChart = memo(({
  data,
  orientation = 'horizontal',
  showValues = true,
  showLabels = true,
  valueFormatter = (v) => v.toLocaleString(),
  maxBars = 10,
  barHeight = 24,
  barSpacing = 8,
  colors = DEFAULT_COLORS,
  thresholds,
  grouped = false,
  groupLabels,
  className = '',
}: BarChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(300);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);
    return () => observer.disconnect();
  }, []);

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Sort by value descending and limit
    const sorted = [...data]
      .sort((a, b) => b.value - a.value)
      .slice(0, maxBars);

    const maxValue = Math.max(...sorted.map(d => Math.max(d.value, d.secondaryValue ?? 0)));

    return sorted.map((item, index) => {
      // Determine color based on thresholds or custom
      let barColor = item.color || colors[index % colors.length];
      if (thresholds && !item.color) {
        const pct = (item.value / maxValue) * 100;
        if (thresholds.critical !== undefined && pct >= thresholds.critical) {
          barColor = 'rgb(239, 68, 68)';
        } else if (thresholds.warning !== undefined && pct >= thresholds.warning) {
          barColor = 'rgb(245, 158, 11)';
        }
      }

      return {
        ...item,
        percentage: maxValue > 0 ? (item.value / maxValue) * 100 : 0,
        secondaryPercentage: item.secondaryValue && maxValue > 0
          ? (item.secondaryValue / maxValue) * 100
          : undefined,
        color: barColor,
      };
    });
  }, [data, maxBars, colors, thresholds]);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm ${className}`}>
        No data available
      </div>
    );
  }

  if (orientation === 'horizontal') {
    const labelWidth = 100;
    const valueWidth = 60;
    const barWidth = containerWidth - labelWidth - valueWidth - 16;

    return (
      <div ref={containerRef} className={`w-full ${className}`}>
        {/* Legend for grouped */}
        {grouped && groupLabels && (
          <div className="flex items-center gap-4 mb-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: colors[0] }}></span>
              {groupLabels[0]}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: colors[1] }}></span>
              {groupLabels[1]}
            </span>
          </div>
        )}

        <div className="space-y-1">
          {processedData.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2"
              style={{ height: grouped ? barHeight * 2 + 4 : barHeight }}
            >
              {/* Label */}
              {showLabels && (
                <div
                  className="flex-shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400 truncate"
                  style={{ width: labelWidth }}
                  title={item.label}
                >
                  {item.label}
                </div>
              )}

              {/* Bar container */}
              <div className="flex-1 flex flex-col justify-center gap-0.5">
                {/* Primary bar */}
                <div
                  className="relative h-full bg-slate-100 dark:bg-slate-700 rounded overflow-hidden"
                  style={{ height: grouped ? barHeight - 2 : barHeight - 4 }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded transition-all duration-300"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>

                {/* Secondary bar (grouped) */}
                {grouped && item.secondaryPercentage !== undefined && (
                  <div
                    className="relative h-full bg-slate-100 dark:bg-slate-700 rounded overflow-hidden"
                    style={{ height: barHeight - 2 }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded transition-all duration-300"
                      style={{
                        width: `${item.secondaryPercentage}%`,
                        backgroundColor: colors[1],
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Value */}
              {showValues && (
                <div
                  className="flex-shrink-0 text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums text-right"
                  style={{ width: valueWidth }}
                >
                  {valueFormatter(item.value)}
                  {grouped && item.secondaryValue !== undefined && (
                    <div className="text-slate-500 dark:text-slate-400">
                      {valueFormatter(item.secondaryValue)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Vertical orientation
  const barCount = processedData.length;
  const barWidth = Math.max(20, (containerWidth - (barCount - 1) * barSpacing - 40) / barCount);

  return (
    <div ref={containerRef} className={`w-full h-full flex flex-col ${className}`}>
      {/* Chart area */}
      <div className="flex-1 flex items-end justify-center gap-1 px-2 pb-2">
        {processedData.map((item, index) => (
          <div
            key={index}
            className="flex flex-col items-center"
            style={{ width: barWidth }}
          >
            {/* Value on top */}
            {showValues && (
              <span className="text-[9px] font-semibold text-slate-600 dark:text-slate-400 mb-1 tabular-nums">
                {valueFormatter(item.value)}
              </span>
            )}

            {/* Bar */}
            <div
              className="w-full bg-slate-100 dark:bg-slate-700 rounded-t overflow-hidden"
              style={{ height: '100%', maxHeight: 150 }}
            >
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{
                  height: `${item.percentage}%`,
                  backgroundColor: item.color,
                  marginTop: `${100 - item.percentage}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex justify-center gap-1 px-2 pt-1 border-t border-slate-200 dark:border-slate-700">
          {processedData.map((item, index) => (
            <div
              key={index}
              className="text-[9px] text-slate-500 dark:text-slate-400 truncate text-center"
              style={{ width: barWidth }}
              title={item.label}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

BarChart.displayName = 'BarChart';

export default BarChart;
