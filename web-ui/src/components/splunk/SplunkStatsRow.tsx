'use client';

import { memo, useMemo } from 'react';
import { Database, Activity, FileText, Server, AlertTriangle, Heart } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface SplunkStatsRowProps {
  indexCount: number;
  totalEventCount: number;
  sourceCount: number;
  hostCount: number;
  activeAlerts: number;
  healthScore: number;
  loading: boolean;
}

interface MetricCard {
  id: string;
  label: string;
  value: string;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
  borderColor: string;
  status: 'healthy' | 'warning' | 'critical' | 'neutral';
}

// ============================================================================
// Status colors matching TE pattern
// ============================================================================

const statusBorders: Record<string, string> = {
  healthy: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  critical: 'border-l-red-500',
  neutral: 'border-l-slate-300 dark:border-l-slate-600',
};

const statusBg: Record<string, string> = {
  healthy: '',
  warning: '',
  critical: 'bg-red-50/50 dark:bg-red-500/5',
  neutral: '',
};

// ============================================================================
// Component
// ============================================================================

export const SplunkStatsRow = memo(({
  indexCount,
  totalEventCount,
  sourceCount,
  hostCount,
  activeAlerts,
  healthScore,
  loading,
}: SplunkStatsRowProps) => {
  const formatCount = (n: number) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const metrics: MetricCard[] = useMemo(() => [
    {
      id: 'indexes',
      label: 'Indexes',
      value: formatCount(indexCount),
      icon: Database,
      borderColor: 'border-l-purple-500',
      status: indexCount > 0 ? 'healthy' as const : 'neutral' as const,
    },
    {
      id: 'events',
      label: 'Total Events',
      value: formatCount(totalEventCount),
      icon: Activity,
      borderColor: 'border-l-violet-500',
      status: 'healthy' as const,
    },
    {
      id: 'sources',
      label: 'Sources',
      value: formatCount(sourceCount),
      icon: FileText,
      borderColor: 'border-l-indigo-500',
      status: 'healthy' as const,
    },
    {
      id: 'hosts',
      label: 'Hosts',
      value: formatCount(hostCount),
      icon: Server,
      borderColor: 'border-l-cyan-500',
      status: 'healthy' as const,
    },
    {
      id: 'alerts',
      label: 'Active Alerts',
      value: formatCount(activeAlerts),
      icon: AlertTriangle,
      borderColor: activeAlerts > 0 ? 'border-l-red-500' : 'border-l-emerald-500',
      status: activeAlerts > 5 ? 'critical' as const : activeAlerts > 0 ? 'warning' as const : 'healthy' as const,
    },
    {
      id: 'health',
      label: 'Health Score',
      value: `${healthScore}`,
      unit: '%',
      icon: Heart,
      borderColor: healthScore >= 80 ? 'border-l-emerald-500' : healthScore >= 50 ? 'border-l-amber-500' : 'border-l-red-500',
      status: healthScore >= 80 ? 'healthy' as const : healthScore >= 50 ? 'warning' as const : 'critical' as const,
    },
  ], [indexCount, totalEventCount, sourceCount, hostCount, activeAlerts, healthScore]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-slate-200 dark:border-l-slate-700 p-3">
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
            <div className="h-6 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-1.5" />
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.id}
            className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 ${metric.borderColor} ${statusBg[metric.status]} p-3 transition-colors`}
          >
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {metric.label}
            </p>
            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums leading-none">
                {metric.value}
              </span>
              {metric.unit && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{metric.unit}</span>
              )}
              <Icon className={`w-3.5 h-3.5 ml-auto ${
                metric.status === 'critical' ? 'text-red-500' :
                metric.status === 'warning' ? 'text-amber-500' :
                'text-slate-400 dark:text-slate-500'
              }`} />
            </div>
            {/* Mini progress bar */}
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700/40 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  metric.status === 'critical' ? 'bg-red-500' :
                  metric.status === 'warning' ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: metric.id === 'health' ? `${healthScore}%` : '100%' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

SplunkStatsRow.displayName = 'SplunkStatsRow';
export default SplunkStatsRow;
