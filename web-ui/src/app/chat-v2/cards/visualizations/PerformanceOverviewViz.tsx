'use client';

/**
 * PerformanceOverviewViz
 *
 * Displays network performance metrics in a compact gauge and stats format.
 * Used for the network_performance_overview card type.
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

interface GaugeData {
  label: string;
  value: number;
  max: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

interface PerformanceOverviewData {
  gauges: GaugeData[];
  stats?: {
    client_count?: number;
    throughput_mbps?: number;
    captured_at?: string;
  };
}

interface PerformanceOverviewVizProps {
  data: Record<string, unknown>;
  onAction?: (action: string, payload?: unknown) => void;
}

const STATUS_COLORS = {
  good: '#10b981',    // emerald-500
  warning: '#f59e0b', // amber-500
  critical: '#ef4444', // red-500
};

export const PerformanceOverviewViz = memo(({ data, onAction }: PerformanceOverviewVizProps) => {
  const { gauges, stats } = data as unknown as PerformanceOverviewData;

  // Calculate overall health score
  const healthScore = useMemo(() => {
    if (!gauges || gauges.length === 0) return null;
    const goodCount = gauges.filter(g => g.status === 'good').length;
    return Math.round((goodCount / gauges.length) * 100);
  }, [gauges]);

  if (!gauges || gauges.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
        No performance metrics available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-3 overflow-hidden">
      {/* Overall Health Badge */}
      {healthScore !== null && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-600 dark:text-slate-300">Overall Health</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              healthScore >= 75
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                : healthScore >= 50
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
            }`}
          >
            {healthScore}% Healthy
          </span>
        </div>
      )}

      {/* Gauges Grid */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {gauges.slice(0, 4).map((gauge, index) => (
          <MiniGauge key={index} gauge={gauge} delay={index * 0.1} />
        ))}
      </div>

      {/* Stats Footer */}
      {stats && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          {stats.client_count !== undefined && (
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {stats.client_count}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Clients</div>
            </div>
          )}
          {stats.throughput_mbps !== undefined && (
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {stats.throughput_mbps.toFixed(1)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Mbps</div>
            </div>
          )}
          {stats.captured_at && (
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {formatTimeAgo(stats.captured_at)}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PerformanceOverviewViz.displayName = 'PerformanceOverviewViz';

// =============================================================================
// Mini Gauge Component
// =============================================================================

interface MiniGaugeProps {
  gauge: GaugeData;
  delay?: number;
}

const MiniGauge = memo(({ gauge, delay = 0 }: MiniGaugeProps) => {
  const percentage = gauge.max === 0 ? 0 : Math.min(100, Math.max(0, (gauge.value / gauge.max) * 100));
  const color = STATUS_COLORS[gauge.status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="flex flex-col items-center justify-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
    >
      {/* Circular Progress */}
      <div className="relative w-14 h-14 mb-1">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          {/* Background circle */}
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-slate-200 dark:text-slate-700"
          />
          {/* Progress circle */}
          <motion.circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${percentage * 0.94} 100`}
            initial={{ strokeDasharray: '0 100' }}
            animate={{ strokeDasharray: `${percentage * 0.94} 100` }}
            transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
          />
        </svg>
        {/* Value in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
            {gauge.value.toFixed(gauge.value >= 10 ? 0 : 1)}
          </span>
        </div>
      </div>

      {/* Label and unit */}
      <div className="text-center">
        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
          {gauge.label}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500">{gauge.unit}</div>
      </div>

      {/* Status indicator */}
      <div
        className="w-1.5 h-1.5 rounded-full mt-1"
        style={{ backgroundColor: color }}
      />
    </motion.div>
  );
});

MiniGauge.displayName = 'MiniGauge';

// =============================================================================
// Helpers
// =============================================================================

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
