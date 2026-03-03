'use client';

/**
 * DeviceStatusViz - Device Status Grid Visualization
 *
 * Features:
 * - Status summary badges
 * - Device grid with icons and status indicators
 * - Filterable by device type
 * - Interactive device cards
 */

import React, { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusSummary, type StatusLevel } from '../widgets/StatusIndicator';

// =============================================================================
// Types
// =============================================================================

export type DeviceType = 'switch' | 'ap' | 'router' | 'firewall' | 'camera' | 'sensor' | 'other';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  model?: string;
  status: StatusLevel;
  ip?: string;
  mac?: string;
}

export interface DeviceStatusData {
  devices?: Device[];
  summary?: Array<{
    status: StatusLevel;
    label: string;
    count: number;
    pulse?: boolean;
  }>;
  total?: number;
  filters?: string[];
}

export interface DeviceStatusVizProps {
  data: DeviceStatusData | Device[] | Record<string, unknown>;
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

const DEVICE_ICONS: Record<DeviceType, React.ReactElement> = {
  switch: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  ap: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  router: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  firewall: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  camera: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  sensor: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  other: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
};

// =============================================================================
// Component
// =============================================================================

export const DeviceStatusViz = memo(({ data }: DeviceStatusVizProps) => {
  const [filter, setFilter] = useState<string>('all');

  // Normalize data
  const normalizedData = useMemo((): DeviceStatusData => {
    if (Array.isArray(data)) {
      const devices = data as Device[];
      const online = devices.filter(d => d.status === 'healthy').length;
      const offline = devices.filter(d => d.status === 'offline' || d.status === 'critical').length;
      const alerting = devices.filter(d => d.status === 'warning').length;

      // Get unique device types for filters
      const types = [...new Set(devices.map(d => d.type))];

      return {
        devices,
        total: devices.length,
        filters: ['all', ...types],
        summary: [
          { status: 'healthy', label: 'Online', count: online },
          { status: 'critical', label: 'Offline', count: offline, pulse: offline > 0 },
          { status: 'warning', label: 'Alerting', count: alerting, pulse: alerting > 0 },
        ],
      };
    }

    return data as DeviceStatusData;
  }, [data]);

  const { devices, summary, filters, total } = normalizedData;

  // Filter devices
  const filteredDevices = useMemo(() => {
    if (!devices) return [];
    if (filter === 'all') return devices;
    return devices.filter(d => d.type === filter);
  }, [devices, filter]);

  return (
    <div className="flex flex-col h-full p-3 space-y-3">
      {/* Summary */}
      {summary && summary.length > 0 && (
        <StatusSummary summary={summary} size="sm" />
      )}

      {/* Filter Tabs */}
      {filters && filters.length > 1 && (
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700/50 pb-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Device Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filteredDevices.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            <AnimatePresence mode="popLayout">
              {filteredDevices.map((device, index) => (
                <motion.div
                  key={device.id || device.name || `device-${index}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex flex-col items-center p-2 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer transition-colors"
                  title={`${device.name}${device.ip ? `\nIP: ${device.ip}` : ''}${device.model ? `\nModel: ${device.model}` : ''}`}
                >
                  {/* Icon with status */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                      {DEVICE_ICONS[device.type] || DEVICE_ICONS.other}
                    </div>
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900"
                      style={{ backgroundColor: STATUS_COLORS[device.status] }}
                    />
                  </div>

                  {/* Name */}
                  <span className="mt-1.5 text-[10px] text-slate-600 dark:text-slate-400 text-center line-clamp-2 leading-tight">
                    {device.name}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-sm text-slate-500 dark:text-slate-400">
            No devices match the current filter
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700/50">
        Showing {filteredDevices.length} of {total || devices?.length || 0} devices
      </div>
    </div>
  );
});

DeviceStatusViz.displayName = 'DeviceStatusViz';

export default DeviceStatusViz;
