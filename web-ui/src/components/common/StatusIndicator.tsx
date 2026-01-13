'use client';

import { memo } from 'react';

export type StatusType = 'online' | 'offline' | 'alerting' | 'dormant' | 'unknown';

interface StatusIndicatorProps {
  status: StatusType | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  pulse?: boolean;
  className?: string;
}

const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  online: { color: 'bg-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Online' },
  active: { color: 'bg-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Active' },
  healthy: { color: 'bg-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Healthy' },
  up: { color: 'bg-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Up' },
  connected: { color: 'bg-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Connected' },
  offline: { color: 'bg-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Offline' },
  down: { color: 'bg-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Down' },
  error: { color: 'bg-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Error' },
  disconnected: { color: 'bg-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Disconnected' },
  alerting: { color: 'bg-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-900/30', label: 'Alerting' },
  warning: { color: 'bg-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-900/30', label: 'Warning' },
  degraded: { color: 'bg-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-900/30', label: 'Degraded' },
  dormant: { color: 'bg-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-700/30', label: 'Dormant' },
  unknown: { color: 'bg-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-700/30', label: 'Unknown' },
  pending: { color: 'bg-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Pending' },
};

const sizeClasses = {
  sm: { dot: 'w-2 h-2', text: 'text-[10px]', gap: 'gap-1', padding: 'px-1.5 py-0.5' },
  md: { dot: 'w-2.5 h-2.5', text: 'text-xs', gap: 'gap-1.5', padding: 'px-2 py-1' },
  lg: { dot: 'w-3 h-3', text: 'text-sm', gap: 'gap-2', padding: 'px-2.5 py-1.5' },
};

export const StatusIndicator = memo(({
  status,
  size = 'md',
  showLabel = true,
  pulse = false,
  className = '',
}: StatusIndicatorProps) => {
  const normalizedStatus = status?.toLowerCase() || 'unknown';
  const config = statusConfig[normalizedStatus] || statusConfig.unknown;
  const sizes = sizeClasses[size];

  return (
    <span
      className={`
        inline-flex items-center ${sizes.gap} ${sizes.padding} rounded-full
        ${config.bgColor} ${className}
      `}
    >
      <span
        className={`
          ${sizes.dot} rounded-full ${config.color}
          ${pulse ? 'animate-pulse' : ''}
        `}
      />
      {showLabel && (
        <span className={`${sizes.text} font-medium text-current`}>
          {config.label}
        </span>
      )}
    </span>
  );
});

StatusIndicator.displayName = 'StatusIndicator';

export default StatusIndicator;
