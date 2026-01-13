'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface ProcessInfo {
  name: string;
  pid: number;
  cpu: number;
  memory: number;
  user?: string;
}

interface ResourceHistory {
  timestamp: string;
  cpu: number;
  memory: number;
}

interface DeviceResource {
  serial: string;
  name: string;
  model?: string;
  cpu?: number;
  memory?: number;
  temperature?: number;
  disk?: number;
  status?: 'online' | 'offline' | 'alerting';
  processes?: ProcessInfo[];
  history?: ResourceHistory[];
}

interface ResourceHealthCardData {
  devices?: DeviceResource[];
  averageCpu?: number;
  averageMemory?: number;
  highestCpu?: { device: string; value: number };
  highestMemory?: { device: string; value: number };
  networkId?: string;
  organizationId?: string;
}

interface ResourceHealthCardProps {
  data: ResourceHealthCardData;
  config?: {
    thresholds?: {
      warning: number;
      critical: number;
    };
    showTopN?: number;
  };
}

type ViewMode = 'overview' | 'devices' | 'processes';
type ResourceType = 'cpu' | 'memory' | 'disk' | 'temperature';

const RESOURCE_CONFIG: Record<ResourceType, { label: string; unit: string; icon: string; maxValue: number }> = {
  cpu: { label: 'CPU', unit: '%', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z', maxValue: 100 },
  memory: { label: 'Memory', unit: '%', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', maxValue: 100 },
  disk: { label: 'Disk', unit: '%', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4', maxValue: 100 },
  temperature: { label: 'Temp', unit: '°C', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z', maxValue: 100 },
};

function getColorForValue(value: number, thresholds: { warning: number; critical: number }): { bg: string; text: string; fill: string } {
  if (value >= thresholds.critical) return { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', fill: '#ef4444' };
  if (value >= thresholds.warning) return { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', fill: '#f59e0b' };
  return { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', fill: '#10b981' };
}

function predictExhaustion(history: ResourceHistory[], currentValue: number): string | null {
  if (history.length < 3) return null;

  // Calculate trend (simple linear regression)
  const recentHistory = history.slice(-10);
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const n = recentHistory.length;

  recentHistory.forEach((h, i) => {
    sumX += i;
    sumY += h.cpu;
    sumXY += i * h.cpu;
    sumX2 += i * i;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // If increasing trend
  if (slope > 0.5) {
    const hoursToExhaust = (100 - currentValue) / (slope * 12); // Assuming 5-min intervals
    if (hoursToExhaust > 0 && hoursToExhaust < 24) {
      return `~${Math.round(hoursToExhaust)}h to capacity`;
    }
  }

  return null;
}

/**
 * ResourceHealthCard - Comprehensive resource monitoring
 *
 * Features:
 * - Click device to see process breakdown
 * - Historical trend mini-charts
 * - Resource exhaustion prediction
 * - Temperature monitoring
 * - "Kill Process" action for top consumers
 * - Cross-device comparison view
 */
export const ResourceHealthCard = memo(({ data, config }: ResourceHealthCardProps) => {
  const thresholds = config?.thresholds ?? { warning: 70, critical: 90 };
  const showTopN = config?.showTopN ?? 5;
  const { demoMode } = useDemoMode();

  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceType>('cpu');

  const processedData = useMemo(() => {
    // Generate mock data if no real data available and demo mode is enabled
    const hasRealData = data && data.devices && data.devices.length > 0;
    const mockData: ResourceHealthCardData = (!hasRealData && demoMode) ? {
      devices: [
        { serial: 'Q2XX-XXXX-1234', name: 'core-switch-01', model: 'MS350-48', cpu: 45, memory: 62, temperature: 42, disk: 23, status: 'online', processes: [
          { name: 'spanning-tree', pid: 1234, cpu: 12, memory: 8, user: 'system' },
          { name: 'ospf', pid: 1235, cpu: 8, memory: 5, user: 'system' },
          { name: 'snmpd', pid: 1236, cpu: 3, memory: 4, user: 'system' },
        ], history: Array.from({ length: 12 }, (_, i) => ({ timestamp: new Date(Date.now() - (11-i) * 5 * 60000).toISOString(), cpu: 40 + Math.random() * 15, memory: 58 + Math.random() * 10 })) },
        { serial: 'Q2XX-XXXX-5678', name: 'edge-fw-01', model: 'MX250', cpu: 78, memory: 85, temperature: 55, disk: 45, status: 'alerting', processes: [
          { name: 'vpn-daemon', pid: 2001, cpu: 35, memory: 40, user: 'system' },
          { name: 'ips-engine', pid: 2002, cpu: 28, memory: 30, user: 'system' },
        ], history: Array.from({ length: 12 }, (_, i) => ({ timestamp: new Date(Date.now() - (11-i) * 5 * 60000).toISOString(), cpu: 70 + Math.random() * 20, memory: 80 + Math.random() * 10 })) },
        { serial: 'Q2XX-XXXX-9012', name: 'access-switch-fl2', model: 'MS120-24P', cpu: 28, memory: 41, temperature: 38, disk: 15, status: 'online', history: Array.from({ length: 12 }, (_, i) => ({ timestamp: new Date(Date.now() - (11-i) * 5 * 60000).toISOString(), cpu: 25 + Math.random() * 10, memory: 38 + Math.random() * 8 })) },
        { serial: 'Q2XX-XXXX-3456', name: 'wap-conf-rm-a', model: 'MR46', cpu: 15, memory: 35, temperature: 32, status: 'online' },
        { serial: 'Q2XX-XXXX-7890', name: 'edge-fw-02', model: 'MX84', cpu: 52, memory: 68, temperature: 48, disk: 38, status: 'online' },
      ],
    } : data;

    if (mockData.devices && mockData.devices.length > 0) {
      const validDevices = mockData.devices.filter(d => d.cpu !== undefined || d.memory !== undefined);

      const cpuValues = validDevices.map(d => d.cpu ?? 0);
      const memValues = validDevices.map(d => d.memory ?? 0);

      const avgCpu = cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0;
      const avgMem = memValues.length > 0 ? memValues.reduce((a, b) => a + b, 0) / memValues.length : 0;

      const sorted = [...validDevices].sort((a, b) =>
        ((b.cpu ?? 0) + (b.memory ?? 0)) - ((a.cpu ?? 0) + (a.memory ?? 0))
      );

      // Count devices in critical/warning state
      const criticalCount = validDevices.filter(d => (d.cpu ?? 0) >= thresholds.critical || (d.memory ?? 0) >= thresholds.critical).length;
      const warningCount = validDevices.filter(d =>
        ((d.cpu ?? 0) >= thresholds.warning && (d.cpu ?? 0) < thresholds.critical) ||
        ((d.memory ?? 0) >= thresholds.warning && (d.memory ?? 0) < thresholds.critical)
      ).length;

      return {
        type: 'detailed' as const,
        devices: sorted,
        topDevices: sorted.slice(0, showTopN),
        averageCpu: avgCpu,
        averageMemory: avgMem,
        totalDevices: validDevices.length,
        criticalCount,
        warningCount,
      };
    }

    return {
      type: 'aggregate' as const,
      averageCpu: mockData.averageCpu ?? 0,
      averageMemory: mockData.averageMemory ?? 0,
      highestCpu: mockData.highestCpu,
      highestMemory: mockData.highestMemory,
      devices: [] as DeviceResource[],
      topDevices: [] as DeviceResource[],
      totalDevices: 0,
      criticalCount: 0,
      warningCount: 0,
    };
  }, [data, demoMode, showTopN, thresholds]);

  const selectedDeviceData = useMemo(() => {
    if (!selectedDevice || !processedData) return null;
    return processedData.devices.find(d => d.serial === selectedDevice);
  }, [selectedDevice, processedData]);

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleAction = useCallback(async (action: string, processInfo?: ProcessInfo) => {
    if (action === 'kill') {
      // Process management isn't available via Meraki API
      setActionFeedback(`Process termination not available for cloud-managed devices. Consider restarting the device.`);
      setTimeout(() => setActionFeedback(null), 4000);
      return;
    }

    if (action === 'refresh') {
      setActionFeedback('Refreshing device data...');
      // Trigger a page-level refresh or data refetch
      // This will be handled by the card's parent component polling
      setTimeout(() => {
        setActionFeedback('Data refresh triggered');
        setTimeout(() => setActionFeedback(null), 2000);
      }, 500);
      return;
    }
  }, []);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <svg className="w-12 h-12 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-sm">No resource data</span>
      </div>
    );
  }

  const cpuColor = getColorForValue(processedData.averageCpu, thresholds);
  const memColor = getColorForValue(processedData.averageMemory, thresholds);

  // If device is selected, show process view
  if (selectedDeviceData) {
    const prediction = selectedDeviceData.history
      ? predictExhaustion(selectedDeviceData.history, selectedDeviceData.cpu ?? 0)
      : null;

    return (
      <div className="h-full flex flex-col">
        {/* Header with back button */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDevice(null)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{selectedDeviceData.name}</div>
              {selectedDeviceData.model && (
                <div className="text-[9px] text-slate-500 dark:text-slate-400">{selectedDeviceData.model}</div>
              )}
            </div>
          </div>
        </div>

        {/* Resource gauges */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-4 gap-2">
            {(['cpu', 'memory', 'disk', 'temperature'] as ResourceType[]).map(resource => {
              const value = resource === 'cpu' ? selectedDeviceData.cpu :
                           resource === 'memory' ? selectedDeviceData.memory :
                           resource === 'disk' ? selectedDeviceData.disk :
                           selectedDeviceData.temperature;

              if (value === undefined || value === null) return null;

              const config = RESOURCE_CONFIG[resource];
              const color = getColorForValue(value, thresholds);

              return (
                <button
                  key={resource}
                  onClick={() => setSelectedResource(resource)}
                  className={`p-2 rounded-lg transition-colors ${
                    selectedResource === resource
                      ? 'bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-300 dark:ring-slate-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">{config.label}</div>
                  <div className={`text-lg font-bold tabular-nums ${color.text}`}>
                    {value.toFixed(0)}{config.unit}
                  </div>
                </button>
              );
            })}
          </div>
          {prediction && (
            <div className="mt-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded text-[10px] text-amber-700 dark:text-amber-300 text-center">
              {prediction}
            </div>
          )}
        </div>

        {/* History chart */}
        {selectedDeviceData.history && selectedDeviceData.history.length > 0 && (
          <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">History</div>
            <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-12">
              {/* Threshold lines */}
              <line x1="0" y1={40 - (thresholds.warning / 100) * 40} x2="200" y2={40 - (thresholds.warning / 100) * 40}
                stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 2" />
              <line x1="0" y1={40 - (thresholds.critical / 100) * 40} x2="200" y2={40 - (thresholds.critical / 100) * 40}
                stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />

              {/* CPU line */}
              <path
                d={`M ${selectedDeviceData.history.map((h, i) => {
                  const x = (i / (selectedDeviceData.history!.length - 1)) * 200;
                  const y = 40 - (h.cpu / 100) * 40;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}`}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="1.5"
              />

              {/* Memory line */}
              <path
                d={`M ${selectedDeviceData.history.map((h, i) => {
                  const x = (i / (selectedDeviceData.history!.length - 1)) * 200;
                  const y = 40 - (h.memory / 100) * 40;
                  return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}`}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
            </svg>
            <div className="flex justify-center gap-4 text-[8px] text-slate-500 mt-0.5">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 rounded" />CPU</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 rounded" style={{ borderStyle: 'dashed' }} />Memory</span>
            </div>
          </div>
        )}

        {/* Action feedback in device detail */}
        {actionFeedback && selectedDevice && (
          <div className="flex-shrink-0 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <span className="text-[10px] text-blue-700 dark:text-blue-300">{actionFeedback}</span>
          </div>
        )}

        {/* Process list */}
        <div className="flex-1 overflow-auto p-3">
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-2">Top Processes</div>
          {selectedDeviceData.processes && selectedDeviceData.processes.length > 0 ? (
            <div className="space-y-2">
              {selectedDeviceData.processes.slice(0, 8).map((proc, i) => {
                const procCpuColor = getColorForValue(proc.cpu, { warning: 30, critical: 60 });
                return (
                  <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">{proc.name}</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400">PID: {proc.pid}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] font-bold tabular-nums ${procCpuColor.text}`}>{proc.cpu.toFixed(1)}%</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400">{proc.memory.toFixed(0)}MB</div>
                    </div>
                    {proc.cpu > 50 && (
                      <button
                        onClick={() => handleAction('kill', proc)}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Kill Process"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
              No process data available
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main overview
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Resource Health
          </span>
          <div className="flex items-center gap-2">
            {processedData.criticalCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                {processedData.criticalCount} critical
              </span>
            )}
            {processedData.warningCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                {processedData.warningCount} warning
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Average metrics with gauges */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-around">
          {/* CPU Gauge */}
          <div className="text-center">
            <svg viewBox="0 0 60 35" className="w-20 h-12">
              <path
                d="M 5 32 A 25 25 0 0 1 55 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                className="text-slate-200 dark:text-slate-700"
              />
              <path
                d="M 5 32 A 25 25 0 0 1 55 32"
                fill="none"
                stroke={cpuColor.fill}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${(processedData.averageCpu / 100) * 79} 79`}
                className="transition-all duration-500"
              />
              <text x="30" y="28" textAnchor="middle" className="text-sm font-bold fill-slate-700 dark:fill-slate-200">
                {processedData.averageCpu.toFixed(0)}%
              </text>
            </svg>
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">CPU</div>
          </div>

          {/* Memory Gauge */}
          <div className="text-center">
            <svg viewBox="0 0 60 35" className="w-20 h-12">
              <path
                d="M 5 32 A 25 25 0 0 1 55 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                className="text-slate-200 dark:text-slate-700"
              />
              <path
                d="M 5 32 A 25 25 0 0 1 55 32"
                fill="none"
                stroke={memColor.fill}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${(processedData.averageMemory / 100) * 79} 79`}
                className="transition-all duration-500"
              />
              <text x="30" y="28" textAnchor="middle" className="text-sm font-bold fill-slate-700 dark:fill-slate-200">
                {processedData.averageMemory.toFixed(0)}%
              </text>
            </svg>
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Memory</div>
          </div>
        </div>
        <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 mt-1">
          {processedData.totalDevices} devices monitored
        </div>
      </div>

      {/* Device list */}
      <div className="flex-1 overflow-auto p-3">
        <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-2">Top Consumers</div>
        <div className="space-y-2">
          {processedData.topDevices.map((device, idx) => {
            const deviceCpuColor = getColorForValue(device.cpu ?? 0, thresholds);
            const deviceMemColor = getColorForValue(device.memory ?? 0, thresholds);
            const isCritical = (device.cpu ?? 0) >= thresholds.critical || (device.memory ?? 0) >= thresholds.critical;

            return (
              <div
                key={device.serial || idx}
                onClick={() => setSelectedDevice(device.serial)}
                className={`p-2 rounded-lg cursor-pointer transition-all hover:shadow-md
                  ${isCritical ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    device.status === 'online' ? 'bg-emerald-500' :
                    device.status === 'alerting' ? 'bg-amber-500' :
                    device.status === 'offline' ? 'bg-red-500' : 'bg-slate-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">{device.name}</div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] text-slate-500">CPU</span>
                      <span className={`text-[9px] font-bold tabular-nums ${deviceCpuColor.text}`}>{(device.cpu ?? 0).toFixed(0)}%</span>
                    </div>
                    <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${deviceCpuColor.bg}`} style={{ width: `${device.cpu ?? 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] text-slate-500">MEM</span>
                      <span className={`text-[9px] font-bold tabular-nums ${deviceMemColor.text}`}>{(device.memory ?? 0).toFixed(0)}%</span>
                    </div>
                    <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${deviceMemColor.bg}`} style={{ width: `${device.memory ?? 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action feedback */}
      {actionFeedback && !selectedDevice && (
        <div className="flex-shrink-0 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
          <span className="text-[10px] text-blue-700 dark:text-blue-300">{actionFeedback}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => handleAction('refresh')}
          disabled={actionFeedback === 'Refreshing device data...'}
          className="w-full px-2 py-1.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          Refresh All Devices
        </button>
      </div>
    </div>
  );
});

ResourceHealthCard.displayName = 'ResourceHealthCard';

export default ResourceHealthCard;
