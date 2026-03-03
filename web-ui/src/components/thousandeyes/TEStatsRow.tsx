'use client';

import { memo, useMemo } from 'react';
import { Wifi, Clock, AlertTriangle, Server, Heart, FlaskConical } from 'lucide-react';
import type { HealthMetric } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEStatsRowProps {
  metrics: HealthMetric[];
  loading: boolean;
}

// ============================================================================
// Icon mapping
// ============================================================================

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  availability: Wifi,
  latency: Clock,
  loss: AlertTriangle,
  alerts: AlertTriangle,
  agents: Server,
  tests: FlaskConical,
  health: Heart,
};

const METRIC_COLORS: Record<string, string> = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
};

// ============================================================================
// Mini Sparkline
// ============================================================================

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 18;
  const w = 50;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[18px] mt-1">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} opacity="0.5" />
    </svg>
  );
}

// ============================================================================
// Trend Indicator
// ============================================================================

function TrendIndicator({ trend, trendPercent, metricId }: { trend: string; trendPercent: number; metricId: string }) {
  // For some metrics, "up" is bad (latency, loss, alerts)
  const badWhenUp = ['latency', 'loss', 'alerts'].includes(metricId);
  const isUp = trend === 'up';
  const isBad = badWhenUp ? isUp : !isUp && trend !== 'stable';

  const color = trend === 'stable' ? 'text-slate-400' : isBad ? 'text-red-500' : 'text-emerald-500';
  const arrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';

  return (
    <span className={`text-[10px] font-medium ${color}`}>
      {arrow} {trendPercent > 0 ? `${trendPercent.toFixed(1)}%` : ''}
    </span>
  );
}

// ============================================================================
// Component
// ============================================================================

export const TEStatsRow = memo(({ metrics, loading }: TEStatsRowProps) => {
  if (loading || metrics.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 animate-pulse">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <div className="w-12 h-5 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="w-16 h-3 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.slice(0, 6).map((metric) => {
        const Icon = METRIC_ICONS[metric.id] || Heart;
        const color = METRIC_COLORS[metric.status] || '#06b6d4';
        const bgColor = metric.status === 'healthy'
          ? 'bg-emerald-100 dark:bg-emerald-500/20'
          : metric.status === 'warning'
            ? 'bg-amber-100 dark:bg-amber-500/20'
            : 'bg-red-100 dark:bg-red-500/20';

        return (
          <div
            key={metric.id}
            className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2.5 mb-1">
              <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0`} style={{ color }}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {typeof metric.value === 'number'
                    ? metric.unit === '%'
                      ? `${metric.value.toFixed(1)}%`
                      : metric.unit === 'ms'
                        ? `${metric.value.toFixed(0)}ms`
                        : metric.value.toLocaleString()
                    : metric.value}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">{metric.label}</p>
              <TrendIndicator trend={metric.trend} trendPercent={metric.trendPercent} metricId={metric.id} />
            </div>
            <MiniSparkline data={metric.sparklineData} color={color} />
          </div>
        );
      })}
    </div>
  );
});

TEStatsRow.displayName = 'TEStatsRow';
export default TEStatsRow;
