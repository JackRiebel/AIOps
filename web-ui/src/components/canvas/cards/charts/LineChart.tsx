'use client';

import { memo, useMemo, useRef, useEffect, useState } from 'react';

interface DataPoint {
  timestamp: string | number | Date;
  value: number;
  label?: string;
}

interface LineChartProps {
  data: DataPoint[];
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  showArea?: boolean;
  showGrid?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showTooltip?: boolean;
  valueFormatter?: (value: number) => string;
  timeFormatter?: (timestamp: Date) => string;
  thresholds?: {
    warning?: { value: number; label?: string };
    critical?: { value: number; label?: string };
  };
  yMin?: number;
  yMax?: number;
  className?: string;
}

/**
 * LineChart - Time series line chart with optional thresholds
 *
 * Features:
 * - Pure SVG, no external dependencies
 * - Responsive width (fills container)
 * - Threshold lines with labels
 * - Hover tooltips
 * - Gradient fill
 */
export const LineChart = memo(({
  data,
  height = 150,
  strokeColor = 'rgb(6, 182, 212)', // cyan-500
  fillColor,
  showArea = true,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  showTooltip = true,
  valueFormatter = (v) => v.toFixed(1),
  timeFormatter = (t) => t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  thresholds,
  yMin,
  yMax,
  className = '',
}: LineChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [hoveredPoint, setHoveredPoint] = useState<{ point: DataPoint; x: number; y: number } | null>(null);

  // Responsive width
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    setWidth(containerRef.current.clientWidth);

    return () => observer.disconnect();
  }, []);

  const padding = { top: 20, right: 20, bottom: showXAxis ? 30 : 10, left: showYAxis ? 45 : 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { path, areaPath, points, minY, maxY, yTicks, xTicks } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', areaPath: '', points: [], minY: 0, maxY: 100, yTicks: [], xTicks: [] };
    }

    const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) {
      return { path: '', areaPath: '', points: [], minY: 0, maxY: 100, yTicks: [], xTicks: [] };
    }

    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);

    // Add padding to Y range
    const rangePadding = (dataMax - dataMin) * 0.1 || 10;
    const computedMin = yMin !== undefined ? yMin : Math.max(0, dataMin - rangePadding);
    const computedMax = yMax !== undefined ? yMax : dataMax + rangePadding;
    const range = computedMax - computedMin || 1;

    // Calculate time range
    const times = data.map(d => new Date(d.timestamp).getTime());
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeRange = maxTime - minTime || 1;

    // Calculate points
    const pts = data.map((d, i) => {
      const time = new Date(d.timestamp).getTime();
      return {
        x: padding.left + ((time - minTime) / timeRange) * chartWidth,
        y: padding.top + chartHeight - ((d.value - computedMin) / range) * chartHeight,
        data: d,
      };
    });

    // Generate SVG path
    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Generate area path
    const areaD = pts.length > 0
      ? `${pathD} L ${pts[pts.length - 1].x} ${padding.top + chartHeight} L ${pts[0].x} ${padding.top + chartHeight} Z`
      : '';

    // Generate Y ticks (5 ticks)
    const yTickCount = 5;
    const yTickStep = range / (yTickCount - 1);
    const yTickValues = Array.from({ length: yTickCount }, (_, i) => computedMin + i * yTickStep);

    // Generate X ticks (max 6 ticks)
    const xTickCount = Math.min(6, data.length);
    const xTickStep = Math.max(1, Math.floor(data.length / xTickCount));
    const xTickIndices = Array.from({ length: xTickCount }, (_, i) => Math.min(i * xTickStep, data.length - 1));

    return {
      path: pathD,
      areaPath: areaD,
      points: pts,
      minY: computedMin,
      maxY: computedMax,
      yTicks: yTickValues.map(v => ({
        value: v,
        y: padding.top + chartHeight - ((v - computedMin) / range) * chartHeight,
      })),
      xTicks: xTickIndices.map(i => ({
        time: new Date(data[i].timestamp),
        x: pts[i].x,
      })),
    };
  }, [data, chartWidth, chartHeight, yMin, yMax, padding.left, padding.top]);

  const gradientId = `linechart-gradient-${Math.random().toString(36).substr(2, 9)}`;

  // Calculate threshold line positions
  const thresholdLines = useMemo(() => {
    if (!thresholds || maxY === minY) return [];

    const lines: { y: number; color: string; label: string; value: number }[] = [];
    const range = maxY - minY;

    if (thresholds.warning) {
      const y = padding.top + chartHeight - ((thresholds.warning.value - minY) / range) * chartHeight;
      lines.push({
        y,
        color: 'rgb(245, 158, 11)',
        label: thresholds.warning.label || 'Warning',
        value: thresholds.warning.value,
      });
    }

    if (thresholds.critical) {
      const y = padding.top + chartHeight - ((thresholds.critical.value - minY) / range) * chartHeight;
      lines.push({
        y,
        color: 'rgb(239, 68, 68)',
        label: thresholds.critical.label || 'Critical',
        value: thresholds.critical.value,
      });
    }

    return lines;
  }, [thresholds, minY, maxY, chartHeight, padding.top]);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm ${className}`}>
        No data available
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {showGrid && (
          <g className="text-slate-200 dark:text-slate-700">
            {yTicks.map((tick, i) => (
              <line
                key={`grid-${i}`}
                x1={padding.left}
                x2={width - padding.right}
                y1={tick.y}
                y2={tick.y}
                stroke="currentColor"
                strokeDasharray="4,4"
                strokeOpacity={0.5}
              />
            ))}
          </g>
        )}

        {/* Threshold lines */}
        {thresholdLines.map((threshold, i) => (
          <g key={`threshold-${i}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={threshold.y}
              y2={threshold.y}
              stroke={threshold.color}
              strokeWidth={1.5}
              strokeDasharray="6,3"
              strokeOpacity={0.8}
            />
            <text
              x={width - padding.right - 4}
              y={threshold.y - 4}
              textAnchor="end"
              fill={threshold.color}
              fontSize={9}
              fontWeight={500}
            >
              {threshold.label}
            </text>
          </g>
        ))}

        {/* Area fill */}
        {showArea && areaPath && (
          <path
            d={areaPath}
            fill={fillColor || `url(#${gradientId})`}
          />
        )}

        {/* Line */}
        {path && (
          <path
            d={path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Y Axis */}
        {showYAxis && (
          <g className="text-slate-500 dark:text-slate-400">
            {yTicks.map((tick, i) => (
              <text
                key={`y-tick-${i}`}
                x={padding.left - 8}
                y={tick.y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="currentColor"
              >
                {valueFormatter(tick.value)}
              </text>
            ))}
          </g>
        )}

        {/* X Axis */}
        {showXAxis && (
          <g className="text-slate-500 dark:text-slate-400">
            {xTicks.map((tick, i) => (
              <text
                key={`x-tick-${i}`}
                x={tick.x}
                y={height - 8}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
              >
                {timeFormatter(tick.time)}
              </text>
            ))}
          </g>
        )}

        {/* Interactive points */}
        {showTooltip && points.map((p, i) => (
          <circle
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            r={8}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredPoint({ point: p.data, x: p.x, y: p.y })}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}

        {/* Hovered point indicator */}
        {hoveredPoint && (
          <circle
            cx={hoveredPoint.x}
            cy={hoveredPoint.y}
            r={4}
            fill={strokeColor}
            stroke="white"
            strokeWidth={2}
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && showTooltip && (
        <div
          className="absolute z-10 px-2 py-1 text-xs bg-slate-900 dark:bg-slate-700 text-white rounded shadow-lg pointer-events-none transform -translate-x-1/2"
          style={{
            left: hoveredPoint.x,
            top: hoveredPoint.y - 36,
          }}
        >
          <div className="font-semibold">{valueFormatter(hoveredPoint.point.value)}</div>
          <div className="text-slate-300 text-[10px]">
            {timeFormatter(new Date(hoveredPoint.point.timestamp))}
          </div>
        </div>
      )}
    </div>
  );
});

LineChart.displayName = 'LineChart';

export default LineChart;
