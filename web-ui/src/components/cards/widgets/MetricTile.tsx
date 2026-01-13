'use client';

import React from 'react';
import { StatusLevel } from './StatusIndicator';
import SparklineChart from './SparklineChart';

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
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

const SIZE_CONFIG = {
  sm: { value: 'text-xl', label: 'text-xs', sparkHeight: 24 },
  md: { value: 'text-2xl', label: 'text-sm', sparkHeight: 32 },
  lg: { value: 'text-3xl', label: 'text-base', sparkHeight: 40 },
};

function getTrendIcon(direction: 'up' | 'down' | 'stable'): string {
  switch (direction) {
    case 'up':
      return '\u2191';
    case 'down':
      return '\u2193';
    case 'stable':
      return '\u2194';
  }
}

function getTrendColor(direction: 'up' | 'down' | 'stable'): string {
  switch (direction) {
    case 'up':
      return '#00A86B';
    case 'down':
      return '#D0021B';
    case 'stable':
      return '#6E6E6E';
  }
}

export function MetricTile({
  label,
  value,
  unit,
  trend,
  status,
  sparkline,
  size = 'md',
}: MetricTileProps) {
  const config = SIZE_CONFIG[size];
  const valueColor = status ? STATUS_COLORS[status] : undefined;

  return (
    <div className="flex flex-col p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Label */}
      <span className={`${config.label} text-gray-500 dark:text-gray-400 mb-1`}>
        {label}
      </span>

      {/* Value row */}
      <div className="flex items-baseline gap-1">
        <span
          className={`${config.value} font-bold text-gray-900 dark:text-white`}
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {unit}
          </span>
        )}
        {trend && (
          <span
            className="flex items-center gap-0.5 text-sm ml-2"
            style={{ color: getTrendColor(trend.direction) }}
          >
            <span>{getTrendIcon(trend.direction)}</span>
            {trend.percent !== undefined && (
              <span>{trend.percent.toFixed(1)}%</span>
            )}
          </span>
        )}
      </div>

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-2">
          <SparklineChart
            data={sparkline}
            height={config.sparkHeight}
            color={valueColor || '#049FD9'}
          />
        </div>
      )}
    </div>
  );
}

export interface MetricGridProps {
  metrics: MetricTileProps[];
  columns?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function MetricGrid({ metrics, columns = 4, size = 'md' }: MetricGridProps) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {metrics.map((metric, index) => (
        <MetricTile key={`metric-${index}`} {...metric} size={size} />
      ))}
    </div>
  );
}

export default MetricTile;
