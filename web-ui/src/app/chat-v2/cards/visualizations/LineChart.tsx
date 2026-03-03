'use client';

/**
 * LineChart / AreaChart Visualization
 *
 * Displays time series data as line or area chart.
 * Uses SVG for lightweight rendering without external dependencies.
 */

import { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

interface DataPoint {
  timestamp: string | number | Date;
  value: number;
  [key: string]: unknown;
}

interface Series {
  key: string;
  data: DataPoint[];
  color: string;
  label?: string;
}

interface LineChartProps {
  data: DataPoint[] | Series[];
  type?: 'line' | 'area';
  xField?: string;
  yField?: string;
  seriesField?: string;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  height?: number;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export const LineChart = memo(({
  data,
  type = 'line',
  xField = 'timestamp',
  yField = 'value',
  seriesField,
  colors = DEFAULT_COLORS,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  animate = true,
  height = 200,
}: LineChartProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    value: number;
    label: string;
    color: string;
  } | null>(null);

  // Normalize data into series format
  const series = useMemo((): Series[] => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    // Check if data is already in series format
    if ('key' in data[0] && 'data' in data[0]) {
      return (data as Series[]).map((s, i) => ({
        ...s,
        color: s.color ?? colors[i % colors.length],
      }));
    }

    const points = data as DataPoint[];

    // Check if we need to split by series field
    if (seriesField && points[0][seriesField]) {
      const groups = new Map<string, DataPoint[]>();

      for (const point of points) {
        const key = String(point[seriesField]);
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(point);
      }

      return Array.from(groups.entries()).map(([key, groupData], i) => ({
        key,
        label: key,
        data: groupData,
        color: colors[i % colors.length],
      }));
    }

    // Single series
    return [{
      key: 'default',
      data: points,
      color: colors[0],
    }];
  }, [data, seriesField, colors]);

  // Calculate bounds - validate timestamps first
  const bounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let validPointCount = 0;

    for (const s of series) {
      for (const point of s.data) {
        const rawX = point[xField];
        const x = new Date(rawX as string).getTime();
        const y = Number(point[yField]) || 0;

        // Skip invalid dates
        if (isNaN(x)) continue;
        validPointCount++;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    // If no valid points, return invalid bounds (will show empty state)
    if (validPointCount === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, isInvalid: true };
    }

    // Add padding to Y axis
    const yPadding = (maxY - minY) * 0.1 || 1;
    minY = Math.max(0, minY - yPadding);
    maxY = maxY + yPadding;

    return { minX, maxX, minY, maxY, isInvalid: false };
  }, [series, xField, yField]);

  // SVG dimensions
  const padding = { top: 10, right: 10, bottom: 30, left: 50 };
  const width = 400; // Will be scaled to fit container
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scale functions
  const scaleX = (value: number) =>
    padding.left + ((value - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * chartWidth;

  const scaleY = (value: number) =>
    padding.top + chartHeight - ((value - bounds.minY) / (bounds.maxY - bounds.minY || 1)) * chartHeight;

  // Generate path data
  const paths = useMemo(() => {
    return series.map(s => {
      const sortedData = [...s.data].sort((a, b) =>
        new Date(a[xField] as string).getTime() - new Date(b[xField] as string).getTime()
      );

      const points = sortedData.map(point => ({
        x: scaleX(new Date(point[xField] as string).getTime()),
        y: scaleY(Number(point[yField]) || 0),
        value: Number(point[yField]) || 0,
        timestamp: point[xField] as string,
      }));

      const linePath = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');

      const areaPath = type === 'area' && points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${scaleY(bounds.minY)} L ${points[0].x} ${scaleY(bounds.minY)} Z`
        : null;

      return {
        ...s,
        points,
        linePath,
        areaPath,
      };
    });
  }, [series, bounds, type, xField, yField]);

  // Grid lines
  const yGridLines = useMemo(() => {
    const lines: { y: number; label: string }[] = [];
    const step = (bounds.maxY - bounds.minY) / 4;

    for (let i = 0; i <= 4; i++) {
      const value = bounds.minY + step * i;
      lines.push({
        y: scaleY(value),
        label: formatValue(value),
      });
    }

    return lines;
  }, [bounds]);

  // Show empty state if no series, no data, or no valid timestamps
  if (series.length === 0 || series[0].data.length === 0 || bounds.isInvalid) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        {bounds.isInvalid ? 'No time series data available' : 'No data available'}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full flex-1"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        {/* Grid */}
        {showGrid && (
          <g className="text-slate-700/30">
            {yGridLines.map((line, i) => (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={line.y}
                  x2={width - padding.right}
                  y2={line.y}
                  stroke="currentColor"
                  strokeDasharray="4,4"
                />
                <text
                  x={padding.left - 8}
                  y={line.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-xs fill-slate-500"
                >
                  {line.label}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Series */}
        {paths.map((s, seriesIndex) => (
          <g key={s.key}>
            {/* Area fill */}
            {s.areaPath && (
              <motion.path
                d={s.areaPath}
                fill={s.color}
                fillOpacity={0.15}
                initial={animate ? { opacity: 0 } : undefined}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: seriesIndex * 0.1 }}
              />
            )}

            {/* Line */}
            <motion.path
              d={s.linePath}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={animate ? { pathLength: 0 } : undefined}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: seriesIndex * 0.1, ease: 'easeOut' }}
            />

            {/* Points (for tooltip) */}
            {showTooltip && s.points.map((point, i) => (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r={8}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint({
                  x: point.x,
                  y: point.y,
                  value: point.value,
                  label: s.label ?? s.key,
                  color: s.color,
                })}
              />
            ))}
          </g>
        ))}

        {/* Tooltip */}
        {hoveredPoint && (
          <g>
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r={4}
              fill="white"
              stroke={hoveredPoint.color}
              strokeWidth={2}
            />
            <rect
              x={hoveredPoint.x + 10}
              y={hoveredPoint.y - 15}
              width={70}
              height={24}
              rx={4}
              fill="rgba(15, 23, 42, 0.9)"
            />
            <text
              x={hoveredPoint.x + 45}
              y={hoveredPoint.y}
              textAnchor="middle"
              className="text-xs fill-white font-medium"
            >
              {formatValue(hoveredPoint.value)}
            </text>
          </g>
        )}

        {/* X-axis labels */}
        <g className="text-xs fill-slate-500">
          <text
            x={padding.left}
            y={height - 8}
            textAnchor="start"
          >
            {formatTime(bounds.minX)}
          </text>
          <text
            x={width - padding.right}
            y={height - 8}
            textAnchor="end"
          >
            {formatTime(bounds.maxX)}
          </text>
        </g>
      </svg>

      {/* Legend */}
      {showLegend && series.length > 1 && (
        <div className="flex items-center justify-center gap-4 py-2 border-t border-slate-200 dark:border-slate-800/50">
          {series.map(s => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: s.color }}
              />
              {s.label ?? s.key}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

LineChart.displayName = 'LineChart';

// =============================================================================
// Area Chart (wrapper)
// =============================================================================

export const AreaChart = memo((props: Omit<LineChartProps, 'type'>) => (
  <LineChart {...props} type="area" />
));

AreaChart.displayName = 'AreaChart';

// =============================================================================
// Helper Functions
// =============================================================================

function formatValue(value: number): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(1) + 'K';
  }
  if (value < 1 && value > 0) {
    return value.toFixed(2);
  }
  return value.toFixed(0);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
