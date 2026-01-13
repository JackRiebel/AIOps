'use client';

import React from 'react';

export type StatusLevel = 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';

export interface StatusIndicatorProps {
  status: StatusLevel;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  label?: string;
  count?: number;
  showLabel?: boolean;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', { dot: string; text: string }> = {
  sm: { dot: 'w-2 h-2', text: 'text-xs' },
  md: { dot: 'w-3 h-3', text: 'text-sm' },
  lg: { dot: 'w-4 h-4', text: 'text-base' },
};

export function StatusIndicator({
  status,
  size = 'md',
  pulse = false,
  label,
  count,
  showLabel = true,
}: StatusIndicatorProps) {
  const color = STATUS_COLORS[status];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className={`${sizeClass.dot} rounded-full`}
          style={{ backgroundColor: color }}
        />
        {pulse && (
          <div
            className={`absolute inset-0 ${sizeClass.dot} rounded-full animate-ping opacity-75`}
            style={{ backgroundColor: color }}
          />
        )}
      </div>
      {showLabel && (label || count !== undefined) && (
        <div className={`flex items-center gap-1 ${sizeClass.text}`}>
          {label && (
            <span className="text-gray-700 dark:text-gray-300">{label}</span>
          )}
          {count !== undefined && (
            <span className="font-medium text-gray-900 dark:text-white">
              {count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export interface StatusSummaryProps {
  summary: Array<{
    status: StatusLevel;
    label: string;
    count: number;
    pulse?: boolean;
  }>;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusSummary({ summary, size = 'md' }: StatusSummaryProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {summary.map((item, index) => (
        <StatusIndicator
          key={`${item.status}-${index}`}
          status={item.status}
          label={item.label}
          count={item.count}
          pulse={item.pulse}
          size={size}
        />
      ))}
    </div>
  );
}

export default StatusIndicator;
