'use client';

/**
 * StatCard component for displaying metrics and statistics.
 *
 * Used in dashboards to show key performance indicators,
 * counts, and other numerical data with optional trends.
 */

import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { getStatusIcon, getStatusColor } from '@/lib/status-helpers';
import { cn } from '@/lib/utils';

interface TrendData {
  /** Percentage change */
  value: number;
  /** Direction of the trend */
  direction: 'up' | 'down' | 'neutral';
  /** Optional label for the trend period */
  label?: string;
}

export interface StatCardProps {
  /** Title/label for the statistic */
  title: string;
  /** Primary value to display */
  value: string | number;
  /** Optional subtitle or additional context */
  subtitle?: string;
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Optional status to determine icon color */
  status?: string;
  /** Optional trend data */
  trend?: TrendData;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Loading state */
  loading?: boolean;
}

/**
 * StatCard displays a single statistic with optional icon and trend.
 *
 * @example
 * <StatCard
 *   title="Active Devices"
 *   value={156}
 *   status="healthy"
 *   trend={{ value: 12, direction: 'up' }}
 * />
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  status,
  trend,
  onClick,
  className,
  loading = false,
}: StatCardProps) {
  const StatusIcon = status ? getStatusIcon(status) : null;

  if (loading) {
    return (
      <Card
        className={cn('animate-pulse', className)}
        padding="md"
      >
        <CardContent className="flex items-center justify-between">
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        onClick && 'cursor-pointer hover:shadow-lg transition-shadow',
        className
      )}
      onClick={onClick}
      interactive={!!onClick}
    >
      <CardContent className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div
              className={cn(
                'flex items-center text-xs mt-1',
                trend.direction === 'up' && 'text-green-600',
                trend.direction === 'down' && 'text-red-600',
                trend.direction === 'neutral' && 'text-gray-500'
              )}
            >
              <span className="mr-1">
                {trend.direction === 'up' && '\u2191'}
                {trend.direction === 'down' && '\u2193'}
                {trend.direction === 'neutral' && '\u2192'}
              </span>
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && (
                <span className="ml-1 text-gray-400">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        {(icon || StatusIcon) && (
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-full',
              status ? getStatusColor(status) : 'bg-blue-100 text-blue-600'
            )}
          >
            {icon || (StatusIcon && <StatusIcon className="w-6 h-6" />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StatCard;
