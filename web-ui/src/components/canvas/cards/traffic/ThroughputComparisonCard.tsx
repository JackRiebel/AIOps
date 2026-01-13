'use client';

import { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { BarChart } from '../charts/BarChart';

interface DeviceThroughput {
  name: string;
  serial?: string;
  model?: string;
  sent: number;      // bytes
  recv: number;      // bytes
  total?: number;
}

interface ThroughputComparisonCardData {
  devices?: DeviceThroughput[];
  items?: DeviceThroughput[];
  networkId?: string;
  timeRange?: string;
}

interface ThroughputComparisonCardProps {
  data: ThroughputComparisonCardData;
  config?: {
    maxDevices?: number;
    showBreakdown?: boolean;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatBitRate(bytes: number, timeSeconds: number = 1): string {
  const bitsPerSec = (bytes * 8) / timeSeconds;
  if (bitsPerSec === 0) return '0 bps';
  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const i = Math.floor(Math.log(bitsPerSec) / Math.log(k));
  return `${parseFloat((bitsPerSec / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * ThroughputComparisonCard - Compare throughput across devices
 *
 * Shows:
 * - Grouped bar chart comparing devices
 * - Send/Receive breakdown
 * - Ranking by total throughput
 */
export const ThroughputComparisonCard = memo(({ data, config }: ThroughputComparisonCardProps) => {
  const maxDevices = config?.maxDevices ?? 8;
  const showBreakdown = config?.showBreakdown ?? true;
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    let devices = data?.devices || data?.items || [];

    // Generate mock data if no real data available and demo mode is enabled
    if (demoMode && (!data || devices.length === 0)) {
      devices = [
        { name: 'Core-Switch-01', serial: 'Q2XX-CORE-001', model: 'MS425-32', sent: 85000000000, recv: 72000000000 },
        { name: 'Distribution-SW-02', serial: 'Q2XX-DIST-002', model: 'MS350-48', sent: 45000000000, recv: 52000000000 },
        { name: 'Access-Switch-FL1', serial: 'Q2XX-ACC-001', model: 'MS120-24P', sent: 28000000000, recv: 31000000000 },
        { name: 'Edge-Firewall-01', serial: 'Q2XX-MX-001', model: 'MX250', sent: 65000000000, recv: 58000000000 },
        { name: 'Wireless-AP-Lobby', serial: 'Q2XX-MR-001', model: 'MR46', sent: 12000000000, recv: 18000000000 },
        { name: 'Access-Switch-FL2', serial: 'Q2XX-ACC-002', model: 'MS120-48', sent: 22000000000, recv: 25000000000 },
      ];
    }

    // Return null if still no devices
    if (devices.length === 0) return null;

    // Calculate totals and sort
    const withTotals = devices.map(d => ({
      ...d,
      total: d.total ?? (d.sent + d.recv),
    }));

    const sorted = [...withTotals]
      .sort((a, b) => b.total - a.total)
      .slice(0, maxDevices);

    // Calculate stats
    const totalSent = sorted.reduce((sum, d) => sum + d.sent, 0);
    const totalRecv = sorted.reduce((sum, d) => sum + d.recv, 0);
    const totalBytes = sorted.reduce((sum, d) => sum + d.total, 0);

    // Prepare chart data
    const chartData = sorted.map(d => ({
      label: d.name,
      value: d.total,
      secondaryValue: showBreakdown ? d.recv : undefined,
    }));

    return {
      devices: sorted,
      chartData,
      totalSent,
      totalRecv,
      totalBytes,
      deviceCount: devices.length,
    };
  }, [data, maxDevices, showBreakdown, demoMode]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No throughput data
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Throughput Comparison
          </span>
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
            {processedData.deviceCount} devices
          </span>
        </div>
      </div>

      {/* Stats summary */}
      <div className="flex-shrink-0 px-3 py-2 grid grid-cols-3 gap-2 border-b border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">
            {formatBytes(processedData.totalBytes)}
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Total</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatBytes(processedData.totalSent)}
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Sent</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
            {formatBytes(processedData.totalRecv)}
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Received</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex-1 overflow-auto p-3">
        {showBreakdown ? (
          // Detailed view with bars
          <div className="space-y-3">
            {processedData.devices.map((device, idx) => {
              const maxVal = processedData.devices[0]?.total || 1;
              const sentPct = (device.sent / maxVal) * 100;
              const recvPct = (device.recv / maxVal) * 100;

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                      {device.name}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                      {formatBytes(device.total)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {/* Sent bar */}
                    <div
                      className="h-2 bg-emerald-500 rounded-l"
                      style={{ width: `${sentPct}%` }}
                      title={`Sent: ${formatBytes(device.sent)}`}
                    />
                    {/* Recv bar */}
                    <div
                      className="h-2 bg-blue-500 rounded-r"
                      style={{ width: `${recvPct}%` }}
                      title={`Received: ${formatBytes(device.recv)}`}
                    />
                  </div>
                  <div className="flex gap-4 text-[9px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-emerald-500"></span>
                      {formatBytes(device.sent)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm bg-blue-500"></span>
                      {formatBytes(device.recv)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Simple bar chart
          <BarChart
            data={processedData.chartData}
            orientation="horizontal"
            showValues={true}
            valueFormatter={formatBytes}
            maxBars={maxDevices}
            barHeight={28}
          />
        )}
      </div>

      {/* Legend */}
      {showBreakdown && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-center gap-4 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm bg-emerald-500"></span>
              Sent
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 rounded-sm bg-blue-500"></span>
              Received
            </span>
          </div>
        </div>
      )}

      {/* Time range */}
      {data.timeRange && !showBreakdown && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
            {data.timeRange}
          </div>
        </div>
      )}
    </div>
  );
});

ThroughputComparisonCard.displayName = 'ThroughputComparisonCard';

export default ThroughputComparisonCard;
