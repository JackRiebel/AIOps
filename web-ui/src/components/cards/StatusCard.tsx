'use client';

/**
 * StatusCard component for displaying health and status information.
 *
 * Used in health dashboards and Canvas artifact renderers to show
 * system/service status with optional details and actions.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { getStatusColor, getStatusIcon, getStatusLabel } from '@/lib/status-helpers';
import { cn } from '@/lib/utils';

interface StatusDetail {
  /** Label for the detail */
  label: string;
  /** Value to display */
  value: string | number;
}

export interface StatusCardProps {
  /** Title for the status card */
  title: string;
  /** Current status */
  status: string;
  /** Optional message/description */
  message?: string;
  /** Optional detail rows */
  details?: StatusDetail[];
  /** Optional action buttons */
  actions?: React.ReactNode;
  /** Optional timestamp */
  timestamp?: string;
  /** Additional CSS classes */
  className?: string;
  /** Loading state */
  loading?: boolean;
}

/**
 * StatusCard displays status information with a colored header.
 *
 * @example
 * <StatusCard
 *   title="API Gateway"
 *   status="healthy"
 *   message="All endpoints responding normally"
 *   details={[
 *     { label: 'Uptime', value: '99.9%' },
 *     { label: 'Response Time', value: '45ms' }
 *   ]}
 * />
 */
export function StatusCard({
  title,
  status,
  message,
  details,
  actions,
  timestamp,
  className,
  loading = false,
}: StatusCardProps) {
  const StatusIcon = getStatusIcon(status);
  const colorClasses = getStatusColor(status);
  const statusLabel = getStatusLabel(status);

  if (loading) {
    return (
      <Card className={cn('overflow-hidden animate-pulse', className)} padding="none">
        <div className="px-6 py-4 bg-slate-200 dark:bg-slate-700">
          <div className="h-5 w-24 bg-slate-300 dark:bg-slate-600 rounded" />
        </div>
        <div className="p-6 space-y-3">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)} padding="none">
      {/* Status header with colored background */}
      <div className={cn('px-6 py-4', colorClasses)}>
        <div className="flex items-center gap-2">
          <StatusIcon className="w-5 h-5" />
          <span className="font-semibold">{statusLabel}</span>
          {timestamp && (
            <span className="ml-auto text-xs opacity-75">{timestamp}</span>
          )}
        </div>
      </div>

      {/* Card content */}
      <CardHeader className="px-6 pt-6 pb-0">
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {message && (
          <p className="text-slate-600 dark:text-slate-400 mb-4">{message}</p>
        )}

        {details && details.length > 0 && (
          <dl className="space-y-2">
            {details.map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {actions && (
          <div className="mt-4 flex gap-2">{actions}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default StatusCard;
