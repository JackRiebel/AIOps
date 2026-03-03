'use client';

/**
 * TrafficAnalyticsViz - Traffic/Bandwidth Analytics Visualization
 *
 * Features:
 * - Top talkers list with usage bars
 * - Application usage breakdown
 * - Traffic metrics
 * - Interactive sorting
 */

import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MetricGrid, type MetricTileProps } from '../widgets/MetricTile';
import { ProgressBar, SegmentedProgress } from '../widgets/ProgressBar';

// =============================================================================
// Types
// =============================================================================

export interface TopClient {
  id: string;
  name: string;
  ip?: string;
  mac?: string;
  usage: {
    sent: number;
    received: number;
    total: number;
  };
  manufacturer?: string;
}

export interface ApplicationUsage {
  name: string;
  bytes: number;
  percentage: number;
  color: string;
}

export interface TrafficAnalyticsData {
  top_clients?: TopClient[];
  applications?: ApplicationUsage[];
  metrics?: Array<MetricTileProps>;
  total_bandwidth?: {
    sent: number;
    received: number;
    total: number;
  };
}

export interface TrafficAnalyticsVizProps {
  data: TrafficAnalyticsData | TopClient[] | Record<string, unknown>;
  maxItems?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// =============================================================================
// Component
// =============================================================================

export const TrafficAnalyticsViz = memo(({ data, maxItems = 8 }: TrafficAnalyticsVizProps) => {
  const [sortBy, setSortBy] = useState<'total' | 'sent' | 'received'>('total');
  const [viewMode, setViewMode] = useState<'clients' | 'apps'>('clients');

  // Normalize data
  const normalizedData = useMemo((): TrafficAnalyticsData => {
    if (Array.isArray(data)) {
      const clients = data as TopClient[];
      const totalBytes = clients.reduce((sum, c) => sum + (c.usage?.total || 0), 0);

      return {
        top_clients: clients,
        total_bandwidth: {
          sent: clients.reduce((sum, c) => sum + (c.usage?.sent || 0), 0),
          received: clients.reduce((sum, c) => sum + (c.usage?.received || 0), 0),
          total: totalBytes,
        },
        metrics: [
          { label: 'Total Traffic', value: formatBytes(totalBytes) },
          { label: 'Active Clients', value: clients.length },
        ],
      };
    }

    return data as TrafficAnalyticsData;
  }, [data]);

  const { top_clients, applications, metrics, total_bandwidth } = normalizedData;

  // Sort clients
  const sortedClients = useMemo(() => {
    if (!top_clients) return [];
    return [...top_clients]
      .sort((a, b) => (b.usage?.[sortBy] || 0) - (a.usage?.[sortBy] || 0))
      .slice(0, maxItems);
  }, [top_clients, sortBy, maxItems]);

  // Get max usage for percentage calculation
  const maxUsage = useMemo(() => {
    return sortedClients.reduce((max, c) => Math.max(max, c.usage?.total || 0), 0);
  }, [sortedClients]);

  const hasApps = applications && applications.length > 0;
  const hasClients = top_clients && top_clients.length > 0;

  return (
    <div className="flex flex-col h-full p-3 space-y-3">
      {/* Metrics */}
      {metrics && metrics.length > 0 && (
        <MetricGrid metrics={metrics} columns={2} size="sm" />
      )}

      {/* Total Bandwidth Breakdown */}
      {total_bandwidth && (
        <SegmentedProgress
          segments={[
            { value: total_bandwidth.sent, color: '#06b6d4', label: `Sent: ${formatBytes(total_bandwidth.sent)}` },
            { value: total_bandwidth.received, color: '#8b5cf6', label: `Recv: ${formatBytes(total_bandwidth.received)}` },
          ]}
          size="md"
        />
      )}

      {/* View Toggle (only if both views available) */}
      {hasApps && hasClients && (
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700/50 pb-2">
          {(['clients', 'apps'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {mode === 'clients' ? 'Top Clients' : 'Applications'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* Top Clients View */}
          {viewMode === 'clients' && hasClients && (
            <motion.div
              key="clients"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-2"
            >
              {/* Sort options */}
              <div className="flex gap-1 mb-2">
                {(['total', 'sent', 'received'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                      sortBy === opt
                        ? 'bg-slate-200 dark:bg-slate-700 font-medium'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>

              {/* Client list */}
              {sortedClients.map((client, index) => (
                <motion.div
                  key={client.id || client.mac || client.name || `client-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                >
                  {/* Rank */}
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400">
                    {index + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {client.name || client.mac || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {client.ip && `${client.ip} • `}{client.manufacturer || 'Unknown vendor'}
                    </div>
                  </div>

                  {/* Usage bar and value */}
                  <div className="w-28 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-cyan-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${maxUsage > 0 ? ((client.usage?.total || 0) / maxUsage) * 100 : 0}%` }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                        {formatBytes(client.usage?.total || 0)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Applications View */}
          {viewMode === 'apps' && hasApps && (
            <motion.div
              key="apps"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-2"
            >
              {applications.slice(0, maxItems).map((app, index) => (
                <motion.div
                  key={app.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <ProgressBar
                    value={app.percentage}
                    label={app.name}
                    showValue
                    unit="%"
                    color={app.color}
                    size="sm"
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Empty state */}
          {!hasClients && !hasApps && (
            <div className="flex items-center justify-center h-32 text-sm text-slate-500 dark:text-slate-400">
              No traffic data available
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {top_clients && top_clients.length > maxItems && viewMode === 'clients' && (
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2 border-t border-slate-200 dark:border-slate-700/50">
          Showing top {maxItems} of {top_clients.length} clients
        </div>
      )}
    </div>
  );
});

TrafficAnalyticsViz.displayName = 'TrafficAnalyticsViz';

export default TrafficAnalyticsViz;
