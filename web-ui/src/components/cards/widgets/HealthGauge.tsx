'use client';

import React from 'react';

export interface HealthGaugeProps {
  value: number; // 0-100
  label: string;
  size?: 'sm' | 'md' | 'lg';
  thresholds?: {
    warning: number;
    critical: number;
  };
  trend?: 'up' | 'down' | 'stable';
  showValue?: boolean;
}

const SIZE_CONFIG = {
  sm: { width: 80, height: 80, strokeWidth: 6, fontSize: 16, labelSize: 10 },
  md: { width: 120, height: 120, strokeWidth: 8, fontSize: 24, labelSize: 12 },
  lg: { width: 160, height: 160, strokeWidth: 10, fontSize: 32, labelSize: 14 },
};

function getColor(value: number, thresholds: { warning: number; critical: number }): string {
  if (value >= thresholds.warning) return '#00A86B'; // Healthy
  if (value >= thresholds.critical) return '#F5A623'; // Warning
  return '#D0021B'; // Critical
}

function getTrendIcon(trend?: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return '\u2191'; // Up arrow
    case 'down':
      return '\u2193'; // Down arrow
    case 'stable':
      return '\u2194'; // Horizontal arrow
    default:
      return '';
  }
}

function getTrendColor(trend?: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return '#00A86B';
    case 'down':
      return '#D0021B';
    default:
      return '#6E6E6E';
  }
}

export function HealthGauge({
  value,
  label,
  size = 'md',
  thresholds = { warning: 80, critical: 50 },
  trend,
  showValue = true,
}: HealthGaugeProps) {
  const config = SIZE_CONFIG[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, value)) / 100;
  const strokeDashoffset = circumference * (1 - progress);
  const color = getColor(value, thresholds);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: config.width, height: config.height }}>
        {/* Background circle */}
        <svg
          width={config.width}
          height={config.height}
          className="transform -rotate-90"
        >
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            fill="none"
            stroke="#E0E0E0"
            strokeWidth={config.strokeWidth}
            className="dark:stroke-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Center content */}
        {showValue && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <div className="flex items-center gap-1">
              <span
                className="font-bold"
                style={{ fontSize: config.fontSize, color }}
              >
                {Math.round(value)}
              </span>
              {trend && (
                <span
                  style={{ fontSize: config.fontSize * 0.6, color: getTrendColor(trend) }}
                >
                  {getTrendIcon(trend)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Label */}
      <span
        className="mt-2 text-gray-600 dark:text-gray-400 text-center"
        style={{ fontSize: config.labelSize }}
      >
        {label}
      </span>
    </div>
  );
}

export interface GaugeGridProps {
  gauges: Array<{
    value: number;
    label: string;
    trend?: 'up' | 'down' | 'stable';
  }>;
  size?: 'sm' | 'md' | 'lg';
  columns?: number;
}

export function GaugeGrid({ gauges, size = 'sm', columns = 4 }: GaugeGridProps) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {gauges.map((gauge, index) => (
        <HealthGauge
          key={`gauge-${index}`}
          value={gauge.value}
          label={gauge.label}
          trend={gauge.trend}
          size={size}
        />
      ))}
    </div>
  );
}

export default HealthGauge;
