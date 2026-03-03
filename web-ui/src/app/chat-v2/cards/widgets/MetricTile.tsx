'use client';

/**
 * MetricTile Widget - Compact metric display with trend and sparkline
 *
 * Features:
 * - Large numeric value with optional unit
 * - Trend indicator with percentage
 * - Optional sparkline chart
 * - Status coloring
 * - Multiple sizes
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { StatusLevel } from './StatusIndicator';

// =============================================================================
// Types
// =============================================================================

export interface MetricTileProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percent?: number;
  };
  status?: StatusLevel;
  sparkline?: number[];
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  offline: '#6b7280',
  unknown: '#94a3b8',
};

const TREND_COLORS = {
  up: '#10b981',
  down: '#ef4444',
  stable: '#6b7280',
};

const TREND_ICONS = {
  up: '↑',
  down: '↓',
  stable: '→',
};

const SIZE_CONFIG = {
  sm: { value: 'text-lg', label: 'text-[10px]', sparkHeight: 20 },
  md: { value: 'text-xl', label: 'text-xs', sparkHeight: 24 },
  lg: { value: 'text-2xl', label: 'text-sm', sparkHeight: 32 },
};

// =============================================================================
// Sparkline Component
// =============================================================================

interface SparklineProps {
  data: number[];
  height: number;
  color: string;
}

const Sparkline = memo(({ data, height, color }: SparklineProps) => {
  const { path, areaPath } = useMemo(() => {
    if (!data || data.length < 2) return { path: '', areaPath: '' };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const width = 100;
    const padding = 2;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * innerWidth;
      const y = padding + innerHeight - ((value - min) / range) * innerHeight;
      return { x, y };
    });

    const pathCommands = points.map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    );

    const areaCommands = [
      ...pathCommands,
      `L ${points[points.length - 1].x.toFixed(1)} ${height - padding}`,
      `L ${padding} ${height - padding}`,
      'Z',
    ];

    return {
      path: pathCommands.join(' '),
      areaPath: areaCommands.join(' '),
    };
  }, [data, height]);

  if (!data || data.length < 2) return null;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-grad-${color.replace('#', '')})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});

Sparkline.displayName = 'Sparkline';

// =============================================================================
// Component
// =============================================================================

export const MetricTile = memo(({
  label,
  value,
  unit,
  trend,
  status,
  sparkline,
  size = 'md',
  compact = false,
}: MetricTileProps) => {
  const config = SIZE_CONFIG[size];
  const valueColor = status ? STATUS_COLORS[status] : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 ${
        compact ? 'p-2' : 'p-3'
      }`}
    >
      {/* Label */}
      <span className={`${config.label} text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1`}>
        {label}
      </span>

      {/* Value row */}
      <div className="flex items-baseline gap-1">
        <span
          className={`${config.value} font-bold tabular-nums ${
            valueColor ? '' : 'text-slate-900 dark:text-white'
          }`}
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span>
        )}
        {trend && (
          <span
            className="flex items-center gap-0.5 text-xs ml-1.5 font-medium"
            style={{ color: TREND_COLORS[trend.direction] }}
          >
            <span>{TREND_ICONS[trend.direction]}</span>
            {trend.percent !== undefined && (
              <span className="tabular-nums">{trend.percent.toFixed(1)}%</span>
            )}
          </span>
        )}
      </div>

      {/* Sparkline */}
      {sparkline && sparkline.length > 1 && (
        <div className="mt-2">
          <Sparkline
            data={sparkline}
            height={config.sparkHeight}
            color={valueColor || '#06b6d4'}
          />
        </div>
      )}
    </motion.div>
  );
});

MetricTile.displayName = 'MetricTile';

// =============================================================================
// Grid Layout
// =============================================================================

export interface MetricGridProps {
  metrics: MetricTileProps[];
  columns?: number;
  size?: 'sm' | 'md' | 'lg';
}

export const MetricGrid = memo(({ metrics, columns = 2, size = 'md' }: MetricGridProps) => {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {metrics.map((metric, index) => (
        <MetricTile key={`metric-${index}-${metric.label}`} {...metric} size={size} />
      ))}
    </div>
  );
});

MetricGrid.displayName = 'MetricGrid';

export default MetricTile;
