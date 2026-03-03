'use client';

/**
 * WirelessOverviewViz - Wireless Network Overview Visualization
 *
 * Features:
 * - Access point list with status and utilization bars
 * - Channel utilization view
 * - SSID client breakdown
 * - Status summary
 */

import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusSummary, type StatusLevel, StatusBadge } from '../widgets/StatusIndicator';
import { MetricGrid, type MetricTileProps } from '../widgets/MetricTile';
import { UtilizationBar } from '../widgets/ProgressBar';

// =============================================================================
// Types
// =============================================================================

export interface AccessPoint {
  id: string;
  name: string;
  model?: string;
  status: StatusLevel;
  clients: number;
  utilization_2g?: number;
  utilization_5g?: number;
  channel_2g?: number;
  channel_5g?: number;
}

export interface SSID {
  name: string;
  clients: number;
  enabled: boolean;
}

export interface WirelessOverviewData {
  access_points?: AccessPoint[];
  ssids?: SSID[];
  summary?: Array<{
    status: StatusLevel;
    label: string;
    count: number;
    pulse?: boolean;
  }>;
  metrics?: Array<MetricTileProps>;
  channel_data?: {
    '2.4GHz'?: Array<{ channel: number; utilization: number }>;
    '5GHz'?: Array<{ channel: number; utilization: number }>;
  };
}

export interface WirelessOverviewVizProps {
  data: WirelessOverviewData | Record<string, unknown>;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  offline: '#6b7280',
  unknown: '#94a3b8',
};

// =============================================================================
// Component
// =============================================================================

export const WirelessOverviewViz = memo(({ data }: WirelessOverviewVizProps) => {
  const [viewMode, setViewMode] = useState<'aps' | 'channels'>('aps');
  const [selectedBand, setSelectedBand] = useState<'2.4GHz' | '5GHz'>('5GHz');

  // Normalize data
  const normalizedData = useMemo((): WirelessOverviewData => {
    if (Array.isArray(data)) {
      // Array of APs
      return {
        access_points: data as AccessPoint[],
        summary: [
          { status: 'healthy', label: 'Online', count: data.filter((ap: AccessPoint) => ap.status === 'healthy').length },
          { status: 'critical', label: 'Offline', count: data.filter((ap: AccessPoint) => ap.status === 'offline' || ap.status === 'critical').length },
        ],
      };
    }
    return data as WirelessOverviewData;
  }, [data]);

  const { access_points, ssids, summary, metrics, channel_data } = normalizedData;

  return (
    <div className="flex flex-col h-full p-3 space-y-3">
      {/* Summary + Metrics combined */}
      <div className="flex items-center justify-between">
        {summary && summary.length > 0 && (
          <StatusSummary summary={summary} size="sm" />
        )}
        {metrics && metrics.length > 0 && (
          <div className="flex items-center gap-3">
            {metrics.map((m, i) => (
              <div key={i} className="text-center">
                <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{typeof m.value === 'number' ? m.value : m.value}</div>
                <div className="text-[10px] text-slate-400">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700/50 pb-2">
        {(['aps', 'channels'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === mode
                ? 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {mode === 'aps' ? 'Access Points' : 'Channels'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          {viewMode === 'aps' && (
            <motion.div
              key="aps"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-2"
            >
              {!access_points || access_points.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-sm text-slate-500 dark:text-slate-400">
                  No access point data available
                </div>
              ) : access_points.map((ap, index) => (
                <motion.div
                  key={ap.id || ap.name || `ap-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                >
                  {/* Icon with status */}
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      </svg>
                    </div>
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900"
                      style={{ backgroundColor: STATUS_COLORS[ap.status] }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{ap.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {ap.model && `${ap.model} • `}{ap.clients} clients
                    </div>
                  </div>

                  {/* Radio bands / channels */}
                  <div className="flex-shrink-0 flex flex-col gap-0.5 items-end">
                    {ap.channel_2g != null && ap.channel_2g > 0 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 tabular-nums">
                        2.4G ch{ap.channel_2g}
                      </span>
                    )}
                    {ap.channel_5g != null && ap.channel_5g > 0 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 tabular-nums">
                        5G ch{ap.channel_5g}
                      </span>
                    )}
                    {ap.utilization_2g != null && ap.utilization_2g > 0 && !ap.channel_2g && (
                      <UtilizationBar label="2.4G" value={ap.utilization_2g} size="sm" />
                    )}
                    {ap.utilization_5g != null && ap.utilization_5g > 0 && !ap.channel_5g && (
                      <UtilizationBar label="5G" value={ap.utilization_5g} size="sm" />
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {viewMode === 'channels' && (
            <motion.div
              key="channels"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-3"
            >
              {channel_data ? (
                <>
                  {/* Band Toggle */}
                  <div className="flex gap-2">
                    {(['2.4GHz', '5GHz'] as const).map((band) => (
                      <button
                        key={band}
                        onClick={() => setSelectedBand(band)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          selectedBand === band
                            ? 'bg-slate-200 dark:bg-slate-700 font-medium'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {band}
                      </button>
                    ))}
                  </div>

                  {/* Channel Bars */}
                  <div className="space-y-2">
                    {(channel_data[selectedBand]?.length ?? 0) > 0 ? (
                      channel_data[selectedBand]!.map((ch) => (
                        <UtilizationBar
                          key={`ch-${ch.channel}`}
                          label={`Ch${ch.channel}`}
                          value={ch.utilization}
                          size="sm"
                        />
                      ))
                    ) : (
                      <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                        No channel utilization data available for {selectedBand}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
                  <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                  Channel utilization data not available
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SSIDs */}
      {ssids && ssids.length > 0 && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
            Active SSIDs
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ssids.filter(s => s.enabled).map((ssid, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs flex items-center gap-1"
              >
                <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0" />
                </svg>
                <span className="text-slate-700 dark:text-slate-300">{ssid.name}</span>
                <span className="text-slate-500">({ssid.clients})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

WirelessOverviewViz.displayName = 'WirelessOverviewViz';

export default WirelessOverviewViz;
