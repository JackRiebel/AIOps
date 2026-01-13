'use client';

import { memo, useMemo } from 'react';
import { ProgressBar } from '@/components/common/ProgressBar';
import { formatMetricValue, computeArrayMetrics } from './utils';

/**
 * Get icon SVG based on metric key name
 */
function getMetricIcon(key: string): React.ReactNode {
  const k = key.toLowerCase();

  if (k.includes('health') || k.includes('score')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    );
  }
  if (k.includes('device') || k.includes('count')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    );
  }
  if (k.includes('network')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    );
  }
  if (k.includes('uptime') || k.includes('time')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (k.includes('client') || k.includes('user')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    );
  }
  if (k.includes('bandwidth') || k.includes('traffic') || k.includes('usage')) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    );
  }

  // Default icon
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

/**
 * Get color class for metric value based on type and value
 */
function getMetricColor(key: string, value: number): string {
  const k = key.toLowerCase();

  // For health/score/percent metrics, use threshold coloring
  if (k.includes('health') || k.includes('score') || k.includes('percent') || k.includes('uptime')) {
    if (value >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (value >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  }

  // Default color
  return 'text-slate-800 dark:text-slate-200';
}

interface MetricsCardProps {
  data: Record<string, unknown> | unknown[];
}

/**
 * MetricsCard - Displays key metrics in a grid layout
 * Auto-computes metrics from arrays, shows progress bars for health scores
 */
export const MetricsCard = memo(({ data }: MetricsCardProps) => {
  const metrics = useMemo(() => {
    if (Array.isArray(data)) {
      return {
        count: data.length,
        ...computeArrayMetrics(data),
      };
    }
    return data as Record<string, unknown>;
  }, [data]);

  const entries = Object.entries(metrics).filter(([, v]) =>
    typeof v === 'number' || typeof v === 'string'
  ).slice(0, 6);

  const isHealthScore = (key: string) =>
    key.toLowerCase().includes('score') ||
    key.toLowerCase().includes('health') ||
    key.toLowerCase().includes('percent') ||
    key.toLowerCase().includes('uptime');

  return (
    <div className="h-full p-3">
      <div className="grid grid-cols-2 gap-3">
        {entries.map(([key, value]) => {
          const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
          const isHealth = isHealthScore(key);

          return (
            <div
              key={key}
              className="group p-3 bg-gradient-to-br from-white to-slate-50 dark:from-slate-700/60 dark:to-slate-800/40
                         rounded-xl border border-slate-200/80 dark:border-slate-600/40
                         hover:shadow-lg hover:border-cyan-300/50 dark:hover:border-cyan-500/30
                         transition-all duration-200"
            >
              {/* Header with icon */}
              <div className="flex items-center gap-2 mb-2">
                <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-600/50 text-slate-500 dark:text-slate-400
                                 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/30
                                 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {getMetricIcon(key)}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium truncate">
                  {key.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Value */}
              {isHealth && typeof value === 'number' ? (
                <div>
                  <div className={`text-2xl font-bold mb-2 ${getMetricColor(key, value)}`}>
                    {value}%
                  </div>
                  <ProgressBar value={value} max={100} showValue={false} size="sm" />
                </div>
              ) : (
                <div className={`text-xl font-bold ${typeof value === 'number' ? getMetricColor(key, numValue) : 'text-slate-800 dark:text-slate-200'}`}>
                  {formatMetricValue(value)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;
