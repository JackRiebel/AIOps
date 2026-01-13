'use client';

import { memo, useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  showArea?: boolean;
  showDots?: boolean;
  showLastValue?: boolean;
  valueFormatter?: (value: number) => string;
  thresholds?: {
    warning?: number;
    critical?: number;
  };
  className?: string;
}

/**
 * Sparkline - Minimal inline chart for trends
 *
 * Features:
 * - Pure SVG, no external dependencies
 * - Optional gradient fill
 * - Threshold-based coloring
 * - Responsive sizing
 */
export const Sparkline = memo(({
  data,
  width = 120,
  height = 32,
  strokeColor,
  fillColor,
  showArea = true,
  showDots = false,
  showLastValue = false,
  valueFormatter = (v) => v.toFixed(1),
  thresholds,
  className = '',
}: SparklineProps) => {
  const { path, areaPath, points, min, max, lastValue, color } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', areaPath: '', points: [], min: 0, max: 0, lastValue: 0, color: 'var(--color-cyan-500)' };
    }

    const values = data.filter(v => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) {
      return { path: '', areaPath: '', points: [], min: 0, max: 0, lastValue: 0, color: 'var(--color-cyan-500)' };
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    const lastVal = values[values.length - 1];

    // Determine color based on thresholds
    let lineColor = strokeColor || 'rgb(6, 182, 212)'; // cyan-500
    if (thresholds) {
      if (thresholds.critical !== undefined && lastVal >= thresholds.critical) {
        lineColor = 'rgb(239, 68, 68)'; // red-500
      } else if (thresholds.warning !== undefined && lastVal >= thresholds.warning) {
        lineColor = 'rgb(245, 158, 11)'; // amber-500
      }
    }

    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Calculate points
    const pts = values.map((value, index) => ({
      x: padding + (index / Math.max(values.length - 1, 1)) * chartWidth,
      y: padding + chartHeight - ((value - minVal) / range) * chartHeight,
    }));

    // Generate SVG path
    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Generate area path (closed polygon)
    const areaD = pts.length > 0
      ? `${pathD} L ${pts[pts.length - 1].x} ${height - padding} L ${pts[0].x} ${height - padding} Z`
      : '';

    return {
      path: pathD,
      areaPath: areaD,
      points: pts,
      min: minVal,
      max: maxVal,
      lastValue: lastVal,
      color: lineColor,
    };
  }, [data, width, height, strokeColor, thresholds]);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs ${className}`}>
        No data
      </div>
    );
  }

  const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

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
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Dots */}
        {showDots && points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2}
            fill={color}
          />
        ))}

        {/* Last point indicator */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={3}
            fill={color}
            stroke="white"
            strokeWidth={1.5}
          />
        )}
      </svg>

      {/* Current value display */}
      {showLastValue && (
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color }}
        >
          {valueFormatter(lastValue)}
        </span>
      )}
    </div>
  );
});

Sparkline.displayName = 'Sparkline';

export default Sparkline;
