'use client';

import { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface HealthCategory {
  label: string;
  value: number;
  trend?: 'up' | 'down' | 'stable';
}

interface HealthMetric {
  label: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
}

interface NetworkHealthCardData {
  networkName?: string;
  healthScore?: number;
  status?: string;
  overall?: {
    value: number;
    label: string;
    trend?: string;
  };
  categories?: HealthCategory[];
  metrics?: HealthMetric[];
  devices?: {
    total: number;
    online: number;
    alerting: number;
    offline: number;
  };
  clients?: {
    total: number;
  };
  health?: {
    score: number;
    category: string;
  };
}

interface NetworkHealthCardProps {
  data: NetworkHealthCardData;
  config?: {
    compact?: boolean;
  };
}

function getScoreColor(score: number): { text: string; bg: string; fill: string } {
  if (score >= 80) return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', fill: '#10b981' };
  if (score >= 60) return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', fill: '#f59e0b' };
  return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', fill: '#ef4444' };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy': return 'text-emerald-600 dark:text-emerald-400';
    case 'warning': return 'text-amber-600 dark:text-amber-400';
    case 'critical': return 'text-red-600 dark:text-red-400';
    default: return 'text-slate-600 dark:text-slate-400';
  }
}

function getTrendIcon(trend?: string) {
  if (trend === 'up') return <span className="text-emerald-500">↑</span>;
  if (trend === 'down') return <span className="text-red-500">↓</span>;
  return <span className="text-slate-400">→</span>;
}

export const NetworkHealthCard = memo(({ data, config }: NetworkHealthCardProps) => {
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Use structured data if available, otherwise fall back to flat fields
    const score = data?.overall?.value ?? data?.healthScore ?? (demoMode ? 92 : 0);
    const networkName = data?.networkName ?? 'Network';
    const status = data?.status ?? (score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : 'critical');

    const categories = data?.categories ?? (demoMode ? [
      { label: 'Connectivity', value: 95, trend: 'stable' as const },
      { label: 'Performance', value: 88, trend: 'up' as const },
      { label: 'Security', value: 92, trend: 'stable' as const },
    ] : []);

    const devices = data?.devices ?? (demoMode ? {
      total: 12,
      online: 11,
      alerting: 1,
      offline: 0,
    } : { total: 0, online: 0, alerting: 0, offline: 0 });

    const clients = data?.clients?.total ?? (demoMode ? 47 : 0);

    return { score, networkName, status, categories, devices, clients };
  }, [data, demoMode]);

  if (!processedData.score && !demoMode) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No health data available
      </div>
    );
  }

  const scoreColor = getScoreColor(processedData.score);

  return (
    <div className="h-full flex flex-col">
      {/* Main Health Score */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          {/* Circular Score Gauge */}
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              {/* Background circle */}
              <circle
                cx="18" cy="18" r="15.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-slate-200 dark:text-slate-700"
              />
              {/* Progress circle */}
              <circle
                cx="18" cy="18" r="15.5"
                fill="none"
                stroke={scoreColor.fill}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${processedData.score * 0.97} 100`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${scoreColor.text}`}>
                {processedData.score}
              </span>
            </div>
          </div>

          {/* Status Info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
              {processedData.networkName}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                processedData.status === 'healthy' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                processedData.status === 'degraded' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
              }`}>
                {processedData.status === 'healthy' ? '● Healthy' :
                 processedData.status === 'degraded' ? '● Degraded' : '● Critical'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Scores */}
      {processedData.categories.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-3 gap-2">
            {processedData.categories.map((cat, idx) => {
              const catColor = getScoreColor(cat.value);
              return (
                <div key={idx} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className={`text-sm font-bold tabular-nums ${catColor.text}`}>
                      {cat.value}%
                    </span>
                    {getTrendIcon(cat.trend)}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {cat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Device & Client Stats */}
      <div className="flex-1 px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Devices */}
          <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Devices
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-800 dark:text-slate-200">
                {processedData.devices.online}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                / {processedData.devices.total}
              </span>
            </div>
            <div className="flex gap-2 mt-1 text-[10px]">
              {processedData.devices.alerting > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {processedData.devices.alerting} alerting
                </span>
              )}
              {processedData.devices.offline > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {processedData.devices.offline} offline
                </span>
              )}
              {processedData.devices.alerting === 0 && processedData.devices.offline === 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  All online
                </span>
              )}
            </div>
          </div>

          {/* Clients */}
          <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Clients
            </div>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
              {processedData.clients}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Connected
            </div>
          </div>
        </div>

        {/* Device Status Bar */}
        {processedData.devices.total > 0 && (
          <div className="mt-3">
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
              {processedData.devices.online > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(processedData.devices.online / processedData.devices.total) * 100}%` }}
                />
              )}
              {processedData.devices.alerting > 0 && (
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${(processedData.devices.alerting / processedData.devices.total) * 100}%` }}
                />
              )}
              {processedData.devices.offline > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(processedData.devices.offline / processedData.devices.total) * 100}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-1 text-[8px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Alerting
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Offline
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

NetworkHealthCard.displayName = 'NetworkHealthCard';

export default NetworkHealthCard;
