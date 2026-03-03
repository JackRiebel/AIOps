'use client';

/**
 * ChangeComparisonViz
 *
 * Displays before/after performance comparison with revert capability.
 * Key visualization for network_change_comparison cards.
 *
 * Visual layout:
 * ┌─────────────────────────────────────────────────────────┐
 * │ Change: Band Selection (5GHz only → Dual band)         │
 * │ Applied: 5 minutes ago                                  │
 * ├─────────────────────────────────────────────────────────┤
 * │   BEFORE                    AFTER                       │
 * │ ┌─────────────────┐    ┌─────────────────┐             │
 * │ │ Latency: 45ms   │    │ Latency: 32ms ↓ │  ✓ -29%    │
 * │ │ Throughput: 85Mb│    │ Throughput: 92Mb│  ✓ +8%     │
 * │ │ Packet Loss: 2% │    │ Packet Loss: 1% │  ✓ -50%    │
 * │ └─────────────────┘    └─────────────────┘             │
 * ├─────────────────────────────────────────────────────────┤
 * │ Overall: ✓ Performance Improved                         │
 * │ [Keep Changes]                    [Revert to Previous] │
 * └─────────────────────────────────────────────────────────┘
 */

import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MetricDelta {
  metric_name: string;
  before_value: number | null;
  after_value: number | null;
  delta: number | null;
  delta_percent: number | null;
  improved: boolean;
}

interface ChangeData {
  id: string;
  change_type: string;
  setting_path: string;
  previous_value: unknown;
  new_value: unknown;
  description: string;
  applied_at: string;
  reverted_at: string | null;
  status: string;
}

interface Assessment {
  verdict: 'improved' | 'degraded' | 'neutral' | 'unknown';
  confidence: number;
  improved_count: number;
  degraded_count: number;
  unchanged_count: number;
  summary: string;
}

interface MetricsSnapshot {
  latency_ms?: number;
  packet_loss_percent?: number;
  jitter_ms?: number;
  throughput_mbps?: number;
  client_count?: number;
  channel_utilization?: number;
  connection_success_rate?: number;
  captured_at?: string;
}

interface ChangeComparisonData {
  change: ChangeData;
  metrics_before: MetricsSnapshot | null;
  metrics_after: MetricsSnapshot | null;
  deltas: MetricDelta[];
  assessment: Assessment;
  can_revert: boolean;
}

interface ChangeComparisonVizProps {
  data: Record<string, unknown>;
  onAction?: (action: string, payload?: unknown) => void;
}

const METRIC_LABELS: Record<string, string> = {
  latency_ms: 'Latency',
  packet_loss_percent: 'Packet Loss',
  jitter_ms: 'Jitter',
  throughput_mbps: 'Throughput',
  client_count: 'Clients',
  channel_utilization: 'Channel Util',
  connection_success_rate: 'Success Rate',
  signal_strength_dbm: 'Signal',
};

const METRIC_UNITS: Record<string, string> = {
  latency_ms: 'ms',
  packet_loss_percent: '%',
  jitter_ms: 'ms',
  throughput_mbps: 'Mbps',
  client_count: '',
  channel_utilization: '%',
  connection_success_rate: '%',
  signal_strength_dbm: 'dBm',
};

// Metrics where lower is better
const LOWER_IS_BETTER = new Set(['latency_ms', 'packet_loss_percent', 'jitter_ms', 'channel_utilization']);

export const ChangeComparisonViz = memo(({ data, onAction }: ChangeComparisonVizProps) => {
  const [isReverting, setIsReverting] = useState(false);
  const comparisonData = data as unknown as ChangeComparisonData;

  const { change, metrics_before, metrics_after, deltas, assessment, can_revert } = comparisonData;

  const handleRevert = useCallback(async () => {
    if (!can_revert || isReverting) return;

    setIsReverting(true);
    try {
      onAction?.('revert_change', { changeId: change.id });
    } finally {
      setIsReverting(false);
    }
  }, [can_revert, change?.id, isReverting, onAction]);

  const handleKeep = useCallback(() => {
    onAction?.('keep_change', { changeId: change.id });
  }, [change?.id, onAction]);

  if (!change) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
        No change data available
      </div>
    );
  }

  const isReverted = change.status === 'reverted';
  const waitingForMetrics = !metrics_after && !isReverted;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Change Header */}
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {change.description || formatSettingPath(change.setting_path)}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatChangeType(change.change_type)}</span>
              <span>-</span>
              <span>{formatTimeAgo(change.applied_at)}</span>
            </div>
          </div>
          <StatusBadge status={change.status} />
        </div>

        {/* Value change summary */}
        <div className="mt-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Changed from </span>
          <span className="font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-1 rounded">
            {formatValue(change.previous_value)}
          </span>
          <span className="text-slate-500 dark:text-slate-400"> to </span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1 rounded">
            {formatValue(change.new_value)}
          </span>
        </div>
      </div>

      {/* Metrics Comparison */}
      <div className="flex-1 overflow-auto px-3 py-2">
        {waitingForMetrics ? (
          <WaitingForMetrics />
        ) : deltas && deltas.length > 0 ? (
          <div className="space-y-2">
            {deltas.map((delta, index) => (
              <MetricRow key={delta.metric_name} delta={delta} index={index} />
            ))}
          </div>
        ) : (
          <NoMetricsAvailable before={metrics_before} after={metrics_after} />
        )}
      </div>

      {/* Assessment and Actions */}
      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {/* Assessment Summary */}
        {assessment && !waitingForMetrics && (
          <AssessmentBanner assessment={assessment} />
        )}

        {/* Action Buttons */}
        {can_revert && !isReverted && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleKeep}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Keep Changes
            </button>
            <button
              onClick={handleRevert}
              disabled={isReverting}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              {isReverting ? (
                <>
                  <LoadingSpinner size="sm" />
                  Reverting...
                </>
              ) : (
                <>
                  <RevertIcon />
                  Revert Change
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

ChangeComparisonViz.displayName = 'ChangeComparisonViz';

// =============================================================================
// Sub-components
// =============================================================================

const StatusBadge = memo(({ status }: { status: string }) => {
  const config = {
    applied: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400', label: 'Active' },
    reverted: { color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400', label: 'Reverted' },
    failed: { color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', label: 'Failed' },
    pending_metrics: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', label: 'Pending' },
  }[status] ?? { color: 'bg-slate-100 text-slate-600', label: status };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

const MetricRow = memo(({ delta, index }: { delta: MetricDelta; index: number }) => {
  const label = METRIC_LABELS[delta.metric_name] ?? delta.metric_name;
  const unit = METRIC_UNITS[delta.metric_name] ?? '';
  const lowerIsBetter = LOWER_IS_BETTER.has(delta.metric_name);

  // Calculate visual improvement (considering lower-is-better metrics)
  const isImproved = delta.improved;
  const deltaValue = delta.delta ?? 0;
  const deltaPercent = delta.delta_percent ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
    >
      {/* Metric Label */}
      <div className="w-24 text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
        {label}
      </div>

      {/* Before Value */}
      <div className="w-16 text-right">
        <span className="text-sm font-mono text-slate-600 dark:text-slate-400">
          {formatMetricValue(delta.before_value, unit)}
        </span>
      </div>

      {/* Arrow */}
      <div className="w-6 flex justify-center">
        <ArrowIcon direction={deltaValue === 0 ? 'same' : deltaValue > 0 ? 'up' : 'down'} improved={isImproved} />
      </div>

      {/* After Value */}
      <div className="w-16 text-right">
        <span className={`text-sm font-mono font-medium ${
          isImproved ? 'text-emerald-600 dark:text-emerald-400' : !isImproved && Math.abs(deltaPercent) > 5 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
        }`}>
          {formatMetricValue(delta.after_value, unit)}
        </span>
      </div>

      {/* Delta Badge */}
      <div className="flex-1 flex justify-end">
        <DeltaBadge delta={deltaPercent} improved={isImproved} />
      </div>
    </motion.div>
  );
});

MetricRow.displayName = 'MetricRow';

const DeltaBadge = memo(({ delta, improved }: { delta: number; improved: boolean }) => {
  if (Math.abs(delta) < 1) {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500">
        unchanged
      </span>
    );
  }

  const prefix = delta > 0 ? '+' : '';

  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
      improved
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
    }`}>
      {improved && <CheckIcon />}
      {prefix}{delta.toFixed(0)}%
    </span>
  );
});

DeltaBadge.displayName = 'DeltaBadge';

const AssessmentBanner = memo(({ assessment }: { assessment: Assessment }) => {
  const config = {
    improved: {
      bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
      text: 'text-emerald-700 dark:text-emerald-400',
      icon: <CheckCircleIcon className="text-emerald-500" />,
    },
    degraded: {
      bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
      text: 'text-red-700 dark:text-red-400',
      icon: <WarningIcon className="text-red-500" />,
    },
    neutral: {
      bg: 'bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30',
      text: 'text-slate-600 dark:text-slate-400',
      icon: <NeutralIcon className="text-slate-400" />,
    },
    unknown: {
      bg: 'bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30',
      text: 'text-slate-600 dark:text-slate-400',
      icon: <QuestionIcon className="text-slate-400" />,
    },
  }[assessment.verdict];

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${config.bg}`}>
      {config.icon}
      <span className={`text-xs font-medium ${config.text}`}>
        {assessment.summary}
      </span>
    </div>
  );
});

AssessmentBanner.displayName = 'AssessmentBanner';

const WaitingForMetrics = memo(() => (
  <div className="flex flex-col items-center justify-center h-full py-6">
    <LoadingSpinner size="lg" />
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
      Waiting for post-change metrics...
    </p>
    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
      Metrics will refresh automatically in 2-5 minutes
    </p>
  </div>
));

WaitingForMetrics.displayName = 'WaitingForMetrics';

const NoMetricsAvailable = memo(({ before, after }: { before: unknown; after: unknown }) => (
  <div className="flex flex-col items-center justify-center h-full py-6 text-center">
    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
      <ChartIcon className="w-6 h-6 text-slate-400" />
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {!before && !after
        ? 'No metrics captured for this change'
        : !after
        ? 'Waiting for after-change metrics'
        : 'Unable to calculate metric comparison'
      }
    </p>
  </div>
));

NoMetricsAvailable.displayName = 'NoMetricsAvailable';

// =============================================================================
// Icons
// =============================================================================

const ArrowIcon = ({ direction, improved }: { direction: 'up' | 'down' | 'same'; improved: boolean }) => {
  if (direction === 'same') {
    return <span className="text-slate-400">—</span>;
  }

  const color = improved ? 'text-emerald-500' : 'text-red-500';

  return (
    <svg className={`w-4 h-4 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
};

const CheckIcon = () => (
  <svg className="w-3 h-3 inline-block mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const WarningIcon = ({ className }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const NeutralIcon = ({ className }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
  </svg>
);

const QuestionIcon = ({ className }: { className?: string }) => (
  <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RevertIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const ChartIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
);

const LoadingSpinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClass = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  }[size];

  return (
    <div className={`${sizeClass} border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin`} />
  );
};

// =============================================================================
// Helpers
// =============================================================================

function formatSettingPath(path: string): string {
  // Convert "ssids.0.bandSelection" to "SSID Band Selection"
  const parts = path.split('.');
  const lastPart = parts[parts.length - 1];
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatChangeType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 30);
  return String(value).slice(0, 30);
}

function formatMetricValue(value: number | null, unit: string): string {
  if (value === null) return '—';
  return `${value.toFixed(value >= 10 ? 0 : 1)}${unit}`;
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
