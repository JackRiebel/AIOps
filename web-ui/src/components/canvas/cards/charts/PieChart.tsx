'use client';

import { memo, useMemo, useState } from 'react';

interface PieDataItem {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieDataItem[];
  size?: number;
  donut?: boolean;
  donutWidth?: number;
  showLegend?: boolean;
  showLabels?: boolean;
  showPercentages?: boolean;
  valueFormatter?: (value: number) => string;
  colors?: string[];
  centerLabel?: string;
  centerValue?: string | number;
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
  'rgb(20, 184, 166)',  // teal
  'rgb(251, 146, 60)',  // orange
];

/**
 * PieChart - Pie or donut chart with legend
 *
 * Features:
 * - Pie or donut style
 * - Interactive hover states
 * - Legend with values
 * - Center label for donut
 */
export const PieChart = memo(({
  data,
  size = 120,
  donut = true,
  donutWidth = 24,
  showLegend = true,
  showLabels = false,
  showPercentages = true,
  valueFormatter = (v) => v.toLocaleString(),
  colors = DEFAULT_COLORS,
  centerLabel,
  centerValue,
  className = '',
}: PieChartProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return { slices: [], total: 0 };

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return { slices: [], total: 0 };

    let currentAngle = -90; // Start from top
    const slices = data.map((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (item.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      return {
        ...item,
        percentage,
        startAngle,
        endAngle,
        color: item.color || colors[index % colors.length],
      };
    });

    return { slices, total };
  }, [data, colors]);

  if (!data || data.length === 0 || processedData.total === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm ${className}`}>
        No data available
      </div>
    );
  }

  const radius = size / 2;
  const innerRadius = donut ? radius - donutWidth : 0;

  // Generate SVG arc path
  const getArcPath = (startAngle: number, endAngle: number, r: number, ir: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = radius + r * Math.cos(startRad);
    const y1 = radius + r * Math.sin(startRad);
    const x2 = radius + r * Math.cos(endRad);
    const y2 = radius + r * Math.sin(endRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    if (ir === 0) {
      // Pie slice
      return `M ${radius} ${radius} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }

    // Donut slice
    const ix1 = radius + ir * Math.cos(startRad);
    const iy1 = radius + ir * Math.sin(startRad);
    const ix2 = radius + ir * Math.cos(endRad);
    const iy2 = radius + ir * Math.sin(endRad);

    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Pie/Donut SVG */}
      <div className="relative flex-shrink-0">
        <svg width={size} height={size} className="transform -rotate-0">
          {processedData.slices.map((slice, index) => {
            const isHovered = hoveredIndex === index;
            const scale = isHovered ? 1.05 : 1;

            return (
              <path
                key={index}
                d={getArcPath(slice.startAngle, slice.endAngle, radius - 2, innerRadius)}
                fill={slice.color}
                className="transition-all duration-200 cursor-pointer"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'center',
                  opacity: hoveredIndex !== null && !isHovered ? 0.5 : 1,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center content for donut */}
        {donut && (centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerValue !== undefined && (
              <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {typeof centerValue === 'number' ? valueFormatter(centerValue) : centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {centerLabel}
              </span>
            )}
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredIndex !== null && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
            <div className="bg-slate-900 dark:bg-slate-700 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
              <div className="font-semibold">{processedData.slices[hoveredIndex].label}</div>
              <div className="flex items-center gap-2">
                <span>{valueFormatter(processedData.slices[hoveredIndex].value)}</span>
                {showPercentages && (
                  <span className="text-slate-300">
                    ({processedData.slices[hoveredIndex].percentage.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex-1 min-w-0 space-y-1">
          {processedData.slices.map((slice, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 cursor-pointer transition-opacity ${
                hoveredIndex !== null && hoveredIndex !== index ? 'opacity-50' : ''
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400 truncate flex-1">
                {slice.label}
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                {showPercentages
                  ? `${slice.percentage.toFixed(1)}%`
                  : valueFormatter(slice.value)
                }
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

PieChart.displayName = 'PieChart';

export default PieChart;
