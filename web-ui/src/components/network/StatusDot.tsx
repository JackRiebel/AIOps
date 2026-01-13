'use client';

import type { StatusType } from './types';

interface StatusDotProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, string> = {
  online: 'bg-green-500',
  healthy: 'bg-green-500',
  offline: 'bg-slate-400',
  alerting: 'bg-amber-500',
  degraded: 'bg-amber-500',
};

export function StatusDot({ status, className = '' }: StatusDotProps) {
  return (
    <div
      className={`w-2 h-2 rounded-full ${statusConfig[status] || 'bg-slate-400'} ${className}`}
      aria-label={`Status: ${status}`}
    />
  );
}
