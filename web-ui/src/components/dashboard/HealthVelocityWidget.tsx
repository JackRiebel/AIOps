'use client';

import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { DashboardCard } from './DashboardCard';

// ============================================================================
// Types
// ============================================================================

export interface VelocityDataPoint {
  hour: number;
  count: number;
  label: string;
}

export interface HealthVelocityWidgetProps {
  /** Hourly incident counts for the last 24 hours */
  hourlyData: VelocityDataPoint[];
  /** Current hour incident count */
  currentHourCount: number;
  /** 24-hour average */
  averageCount: number;
  /** Loading state */
  loading?: boolean;
}

// ============================================================================
// Tooltip Component
// ============================================================================

interface VelocityTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload?: VelocityDataPoint;
  }>;
}

function VelocityTooltip({ active, payload }: VelocityTooltipProps) {
  if (active && payload?.length) {
    const data = payload[0].payload;
    const value = payload[0].value;
    return (
      <div className="bg-slate-900 rounded-lg px-3 py-2 shadow-xl border border-slate-700 backdrop-blur-sm">
        <p className="text-slate-400 text-[10px] uppercase tracking-wide mb-0.5">
          {data?.label || 'Unknown'}
        </p>
        <p className="font-bold text-white text-lg leading-tight">
          {value} incident{value !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
}

// ============================================================================
// Main Component
// ============================================================================

export function HealthVelocityWidget({
  hourlyData,
  currentHourCount,
  averageCount,
  loading = false,
}: HealthVelocityWidgetProps) {
  // Calculate velocity trend
  const velocityTrend = useMemo(() => {
    if (averageCount === 0) {
      return { direction: 'stable' as const, percentage: 0 };
    }

    const diff = currentHourCount - averageCount;
    const percentage = Math.round((diff / averageCount) * 100);

    if (percentage > 20) {
      return { direction: 'up' as const, percentage };
    } else if (percentage < -20) {
      return { direction: 'down' as const, percentage: Math.abs(percentage) };
    }
    return { direction: 'stable' as const, percentage: Math.abs(percentage) };
  }, [currentHourCount, averageCount]);

  // Determine status color based on trend
  const statusColor = useMemo(() => {
    if (velocityTrend.direction === 'up') {
      return 'amber'; // More incidents = warning
    } else if (velocityTrend.direction === 'down') {
      return 'emerald'; // Fewer incidents = good
    }
    return 'slate';
  }, [velocityTrend.direction]);

  // Get gradient colors based on status
  const gradientId = 'velocityGradient';
  const strokeColor = statusColor === 'amber' ? '#f59e0b' : statusColor === 'emerald' ? '#10b981' : '#64748b';
  const fillOpacity = statusColor === 'amber' ? 0.3 : 0.2;

  return (
    <DashboardCard
      title="Incident Velocity"
      icon={<Activity className="w-4 h-4" />}
      href="/incidents"
      linkText="View Incidents →"
      accent={statusColor === 'amber' ? 'amber' : statusColor === 'emerald' ? 'green' : 'slate'}
      loading={loading}
    >
      {/* Velocity Stats */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {currentHourCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              this hour
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            vs {averageCount.toFixed(1)} avg/hour
          </div>
        </div>

        {/* Trend Indicator */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
          velocityTrend.direction === 'up'
            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
            : velocityTrend.direction === 'down'
            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
        }`}>
          {velocityTrend.direction === 'up' ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : velocityTrend.direction === 'down' ? (
            <TrendingDown className="w-3.5 h-3.5" />
          ) : (
            <Minus className="w-3.5 h-3.5" />
          )}
          <span className="text-xs font-semibold">
            {velocityTrend.percentage}%
          </span>
        </div>
      </div>

      {/* Sparkline Chart */}
      <div className="h-16" role="img" aria-label="Incident velocity sparkline over last 24 hours">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={hourlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={fillOpacity} />
                <stop offset="50%" stopColor={strokeColor} stopOpacity={fillOpacity * 0.5} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Tooltip
              content={<VelocityTooltip />}
              cursor={{ stroke: strokeColor, strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: strokeColor, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Time Labels */}
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
        <span>24h ago</span>
        <span>12h ago</span>
        <span>Now</span>
      </div>
    </DashboardCard>
  );
}

export default HealthVelocityWidget;
