'use client';

import React from 'react';
import { StatusLevel } from './StatusIndicator';

export interface ProgressBarProps {
  label: string;
  value: number; // 0-100
  maxValue?: number;
  unit?: string;
  status?: StatusLevel;
  showValue?: boolean;
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
  sm: { height: 'h-1.5', text: 'text-xs', gap: 'gap-1' },
  md: { height: 'h-2', text: 'text-sm', gap: 'gap-2' },
  lg: { height: 'h-3', text: 'text-base', gap: 'gap-2' },
};

function getAutoStatus(value: number): StatusLevel {
  if (value >= 90) return 'critical';
  if (value >= 70) return 'warning';
  return 'healthy';
}

export function ProgressBar({
  label,
  value,
  maxValue = 100,
  unit = '%',
  status,
  showValue = true,
  size = 'md',
}: ProgressBarProps) {
  const config = SIZE_CONFIG[size];
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
  const actualStatus = status || getAutoStatus(percentage);
  const color = STATUS_COLORS[actualStatus];

  return (
    <div className={`flex flex-col ${config.gap}`}>
      {/* Label and value row */}
      <div className="flex justify-between items-center">
        <span className={`${config.text} text-gray-600 dark:text-gray-400`}>
          {label}
        </span>
        {showValue && (
          <span className={`${config.text} font-medium text-gray-900 dark:text-white`}>
            {value.toFixed(1)}{unit}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        className={`w-full ${config.height} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}
      >
        <div
          className={`${config.height} rounded-full transition-all duration-300 ease-out`}
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export interface ProgressBarListProps {
  items: ProgressBarProps[];
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBarList({ items, size = 'md' }: ProgressBarListProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <ProgressBar key={`progress-${index}`} {...item} size={size} />
      ))}
    </div>
  );
}

export default ProgressBar;
