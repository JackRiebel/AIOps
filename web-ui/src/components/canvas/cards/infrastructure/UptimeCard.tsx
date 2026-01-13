'use client';

import { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface DeviceUptime {
  serial: string;
  name: string;
  model?: string;
  status: 'online' | 'offline' | 'alerting' | 'dormant';
  uptime?: number;  // seconds
  lastReboot?: string;
  uptimePercentage?: number;  // 0-100 over last 30 days
}

interface UptimeCardData {
  devices?: DeviceUptime[];
  // Or network-level
  overallUptime?: number;  // percentage
  onlineCount?: number;
  offlineCount?: number;
  networkId?: string;
  organizationId?: string;
}

interface UptimeCardProps {
  data: UptimeCardData;
  config?: {
    showDevices?: boolean;
  };
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

function formatUptimeLong(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);

  return parts.join(', ') || '< 1 min';
}

/**
 * UptimeCard - Device uptime monitoring
 *
 * Shows:
 * - Overall uptime percentage
 * - Online/offline device count
 * - Individual device uptimes
 */
export const UptimeCard = memo(({ data, config }: UptimeCardProps) => {
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Return null if no data and demo mode is off
    if (!data && !demoMode) return null;

    // Generate mock data if no real data available and demo mode is enabled
    if ((!data || (!data.devices?.length && data.overallUptime === undefined)) && demoMode) {
      const now = new Date();
      const mockDevices: DeviceUptime[] = [
        { serial: 'Q2XX-1111-AAAA', name: 'core-switch-01', model: 'MS350-48', status: 'online', uptime: 45 * 86400 + 12 * 3600, uptimePercentage: 99.98, lastReboot: new Date(now.getTime() - 45 * 86400000).toISOString() },
        { serial: 'Q2XX-2222-BBBB', name: 'edge-fw-01', model: 'MX250', status: 'online', uptime: 30 * 86400 + 8 * 3600, uptimePercentage: 99.95, lastReboot: new Date(now.getTime() - 30 * 86400000).toISOString() },
        { serial: 'Q2XX-3333-CCCC', name: 'access-switch-fl2', model: 'MS120-24P', status: 'alerting', uptime: 15 * 86400 + 4 * 3600, uptimePercentage: 99.50, lastReboot: new Date(now.getTime() - 15 * 86400000).toISOString() },
        { serial: 'Q2XX-4444-DDDD', name: 'wap-lobby', model: 'MR46', status: 'online', uptime: 60 * 86400 + 20 * 3600, uptimePercentage: 99.99, lastReboot: new Date(now.getTime() - 60 * 86400000).toISOString() },
        { serial: 'Q2XX-5555-EEEE', name: 'edge-fw-02', model: 'MX84', status: 'online', uptime: 22 * 86400 + 6 * 3600, uptimePercentage: 99.85, lastReboot: new Date(now.getTime() - 22 * 86400000).toISOString() },
        { serial: 'Q2XX-6666-FFFF', name: 'wap-conf-rm', model: 'MR36', status: 'offline', uptime: 0, uptimePercentage: 98.20, lastReboot: new Date(now.getTime() - 2 * 3600000).toISOString() },
      ];

      const online = mockDevices.filter(d => d.status === 'online' || d.status === 'alerting');
      const avgUptime = mockDevices.reduce((a, b) => a + (b.uptimePercentage || 0), 0) / mockDevices.length;

      return {
        type: 'detailed' as const,
        devices: mockDevices,
        onlineCount: online.length,
        offlineCount: mockDevices.filter(d => d.status === 'offline').length,
        overallUptime: avgUptime,
        totalDevices: mockDevices.length,
      };
    }

    if (data.devices && data.devices.length > 0) {
      const online = data.devices.filter(d => d.status === 'online' || d.status === 'alerting');
      const offline = data.devices.filter(d => d.status === 'offline');

      // Calculate average uptime percentage
      const uptimePercentages = data.devices
        .filter(d => d.uptimePercentage !== undefined)
        .map(d => d.uptimePercentage!);

      const avgUptimePercent = uptimePercentages.length > 0
        ? uptimePercentages.reduce((a, b) => a + b, 0) / uptimePercentages.length
        : (online.length / data.devices.length) * 100;

      // Sort by current uptime (longest first)
      const sorted = [...data.devices].sort((a, b) =>
        (b.uptime ?? 0) - (a.uptime ?? 0)
      );

      return {
        type: 'detailed' as const,
        devices: sorted,
        onlineCount: online.length,
        offlineCount: offline.length,
        overallUptime: avgUptimePercent,
        totalDevices: data.devices.length,
      };
    }

    return {
      type: 'aggregate' as const,
      overallUptime: data.overallUptime ?? 0,
      onlineCount: data.onlineCount ?? 0,
      offlineCount: data.offlineCount ?? 0,
    };
  }, [data]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No uptime data
      </div>
    );
  }

  const uptimeColor =
    processedData.overallUptime >= 99.9 ? 'text-emerald-600 dark:text-emerald-400' :
    processedData.overallUptime >= 99 ? 'text-cyan-600 dark:text-cyan-400' :
    processedData.overallUptime >= 95 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Uptime Tracker
          </span>
          {processedData.type === 'detailed' && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {processedData.totalDevices} devices
            </span>
          )}
        </div>
      </div>

      {/* Overall uptime */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-slate-200 dark:border-slate-700 text-center">
        <div className={`text-4xl font-bold tabular-nums ${uptimeColor}`}>
          {processedData.overallUptime.toFixed(2)}%
        </div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase mt-1">
          Overall Uptime
        </div>

        {/* Online/Offline counts */}
        <div className="flex justify-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {processedData.onlineCount} online
            </span>
          </div>
          {processedData.offlineCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {processedData.offlineCount} offline
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Device list */}
      {processedData.type === 'detailed' && (
        <div className="flex-1 overflow-auto p-3">
          <div className="space-y-1.5">
            {processedData.devices.slice(0, 10).map((device, idx) => (
              <div
                key={device.serial || idx}
                className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
              >
                {/* Status */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  device.status === 'online' ? 'bg-emerald-500' :
                  device.status === 'alerting' ? 'bg-amber-500' :
                  device.status === 'offline' ? 'bg-red-500' : 'bg-slate-400'
                }`} />

                {/* Device name */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {device.name}
                  </div>
                </div>

                {/* Uptime */}
                <div className="flex-shrink-0 text-right">
                  {device.status === 'offline' ? (
                    <span className="text-xs text-red-500 font-medium">Offline</span>
                  ) : device.uptime !== undefined ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatUptime(device.uptime)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">--</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uptime bar visualization */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${processedData.overallUptime}%` }}
          />
          <div
            className="h-full bg-red-500"
            style={{ width: `${100 - processedData.overallUptime}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-slate-500 dark:text-slate-400">
          <span>0%</span>
          <span>30-day uptime</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
});

UptimeCard.displayName = 'UptimeCard';

export default UptimeCard;
