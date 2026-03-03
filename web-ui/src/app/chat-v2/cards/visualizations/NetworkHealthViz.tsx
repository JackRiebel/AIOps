'use client';

/**
 * NetworkHealthViz - Enhanced Network Health Visualization
 *
 * Features:
 * - Central health gauge with overall score
 * - Category breakdown (wireless, switching, security, etc.)
 * - Key metrics with sparklines
 * - Status summary
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { HealthGauge, GaugeGrid } from '../widgets/HealthGauge';
import { MetricGrid, type MetricTileProps } from '../widgets/MetricTile';
import { StatusSummary, type StatusLevel } from '../widgets/StatusIndicator';

// =============================================================================
// Types
// =============================================================================

export interface NetworkHealthData {
  overall: {
    score: number;
    label: string;
    trend?: 'up' | 'down' | 'stable';
  };
  categories?: Array<{
    value: number;
    label: string;
    trend?: 'up' | 'down' | 'stable';
  }>;
  metrics?: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
    status?: StatusLevel;
    sparkline?: number[];
  }>;
  summary?: Array<{
    status: StatusLevel;
    label: string;
    count: number;
    pulse?: boolean;
  }>;
  message?: string;
}

export interface NetworkHealthVizProps {
  data: NetworkHealthData | Record<string, unknown>;
}

// =============================================================================
// Component
// =============================================================================

export const NetworkHealthViz = memo(({ data }: NetworkHealthVizProps) => {
  // Normalize data from various API formats
  const normalizedData = useMemo((): NetworkHealthData => {
    // If already in correct format
    if ('overall' in data && typeof (data as NetworkHealthData).overall === 'object') {
      return data as NetworkHealthData;
    }

    // Try to extract from common API response formats
    const raw = data as Record<string, unknown>;

    // Handle device status counts format
    if ('online' in raw && 'offline' in raw) {
      const online = Number(raw.online) || 0;
      const offline = Number(raw.offline) || 0;
      const alerting = Number(raw.alerting) || 0;
      const total = online + offline + alerting;
      const score = total > 0 ? Math.round((online / total) * 100) : 0;

      return {
        overall: {
          score,
          label: 'Network Health',
          trend: score >= 90 ? 'up' : score >= 70 ? 'stable' : 'down',
        },
        summary: [
          { status: 'healthy', label: 'Online', count: online },
          { status: 'critical', label: 'Offline', count: offline, pulse: offline > 0 },
          { status: 'warning', label: 'Alerting', count: alerting, pulse: alerting > 0 },
        ],
        metrics: [
          { label: 'Total Devices', value: total },
          { label: 'Availability', value: score, unit: '%', status: score >= 90 ? 'healthy' : score >= 70 ? 'warning' : 'critical' },
        ],
      };
    }

    // Handle health score format
    if ('health_score' in raw || 'healthScore' in raw || 'score' in raw) {
      const score = Number(raw.health_score ?? raw.healthScore ?? raw.score) || 0;
      return {
        overall: {
          score,
          label: String(raw.label || 'Health Score'),
        },
      };
    }

    // Fallback
    return {
      overall: { score: 0, label: 'Unknown' },
    };
  }, [data]);

  const { overall, categories, metrics, summary, message } = normalizedData;

  return (
    <div className="flex flex-col h-full p-3 space-y-4">
      {/* Status Summary */}
      {summary && summary.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="pb-3 border-b border-slate-200 dark:border-slate-700/50"
        >
          <StatusSummary summary={summary} size="sm" />
        </motion.div>
      )}

      {/* Main Gauge */}
      <div className="flex justify-center py-2">
        <HealthGauge
          value={overall.score}
          label={overall.label}
          trend={overall.trend}
          size="lg"
        />
      </div>

      {/* Message */}
      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-slate-600 dark:text-slate-400"
        >
          {message}
        </motion.p>
      )}

      {/* Category Gauges */}
      {categories && categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="pt-3 border-t border-slate-200 dark:border-slate-700/50"
        >
          <GaugeGrid
            gauges={categories}
            size="sm"
            columns={Math.min(4, categories.length)}
          />
        </motion.div>
      )}

      {/* Key Metrics */}
      {metrics && metrics.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="pt-3 border-t border-slate-200 dark:border-slate-700/50"
        >
          <MetricGrid
            metrics={metrics as MetricTileProps[]}
            columns={Math.min(3, metrics.length)}
            size="sm"
          />
        </motion.div>
      )}
    </div>
  );
});

NetworkHealthViz.displayName = 'NetworkHealthViz';

export default NetworkHealthViz;
