'use client';

import { memo, useMemo } from 'react';
import {
  Network,
  Server,
  Wifi,
  Shield,
  Camera,
  MonitorSmartphone,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { DashboardCard } from './DashboardCard';

// ============================================================================
// Types
// ============================================================================

export interface DeviceSummary {
  type: 'mx' | 'ms' | 'mr' | 'mv' | 'mt' | 'z' | 'mg' | 'cw' | 'other';
  total: number;
  online: number;
  alerting: number;
  offline: number;
}

export interface NetworkSummary {
  id: string;
  name: string;
  deviceCount: number;
  healthScore: number;
  status: 'healthy' | 'degraded' | 'offline';
}

export interface MiniTopologyWidgetProps {
  devices: DeviceSummary[];
  networks?: NetworkSummary[];
  totalDevices: number;
  onlineDevices: number;
  alertingDevices: number;
  networkCount?: number;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// Device Icon Map
// ============================================================================

const deviceIcons: Record<DeviceSummary['type'], React.ElementType> = {
  mx: Shield,
  ms: Server,
  mr: Wifi,
  mv: Camera,
  mt: MonitorSmartphone,
  z: Shield,
  mg: Shield,
  cw: Wifi,
  other: Server,
};

const deviceLabels: Record<DeviceSummary['type'], string> = {
  mx: 'Security Appliances',
  ms: 'Switches',
  mr: 'Access Points',
  mv: 'Cameras',
  mt: 'Sensors',
  z: 'Teleworker',
  mg: 'Cellular Gateways',
  cw: 'Catalyst Wireless',
  other: 'Other Devices',
};

// ============================================================================
// DeviceTypeRow Component
// ============================================================================

function DeviceTypeRow({ device }: { device: DeviceSummary }) {
  const Icon = deviceIcons[device.type] || deviceIcons.other;
  const label = deviceLabels[device.type] || 'Other Devices';
  const healthPercent = device.total > 0 ? Math.round((device.online / device.total) * 100) : 0;

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
          <Icon className="w-3 h-3 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-900 dark:text-white">{label}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {device.online}/{device.total} online
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Status indicators */}
        <div className="flex items-center gap-0.5">
          {device.online > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-2.5 h-2.5" />
              {device.online}
            </span>
          )}
          {device.alerting > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-2.5 h-2.5" />
              {device.alerting}
            </span>
          )}
          {device.offline > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 dark:text-red-400">
              <XCircle className="w-2.5 h-2.5" />
              {device.offline}
            </span>
          )}
        </div>

        {/* Health bar */}
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              healthPercent >= 90
                ? 'bg-green-500'
                : healthPercent >= 70
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// OverallHealthRing Component
// ============================================================================

function OverallHealthRing({
  total,
  online,
  alerting,
}: {
  total: number;
  online: number;
  alerting: number;
}) {
  // online and alerting are separate counts, offline is the remainder
  const offline = Math.max(0, total - online - alerting);
  const workingDevices = online + alerting;
  const healthPercent = total > 0 ? Math.round((workingDevices / total) * 100) : 0;

  // SVG ring parameters - more compact
  const size = 64;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Only include segments with values > 0
  const segments = [
    { value: online, color: '#22c55e' }, // Green for online (healthy)
    { value: alerting, color: '#f59e0b' }, // Amber for alerting
    { value: offline, color: '#ef4444' }, // Red for offline
  ].filter(s => s.value > 0);

  let offset = 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-slate-200 dark:text-slate-700"
        />

        {/* Segments - only render if total > 0 to avoid NaN */}
        {total > 0 && segments.map((segment, i) => {
          const segmentLength = (segment.value / total) * circumference;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              fill="none"
              className="transition-all duration-500"
            />
          );
          offset += segmentLength;
          return el;
        })}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-slate-900 dark:text-white">{healthPercent}%</span>
        <span className="text-[9px] text-slate-500 dark:text-slate-400">Health</span>
      </div>
    </div>
  );
}

// ============================================================================
// MiniTopologyWidget Component
// ============================================================================

export const MiniTopologyWidget = memo(({
  devices,
  networks,
  totalDevices,
  onlineDevices,
  alertingDevices,
  networkCount = 0,
  loading,
  className = '',
}: MiniTopologyWidgetProps) => {
  // Filter out device types with 0 total
  const activeDevices = useMemo(
    () => devices.filter((d) => d.total > 0),
    [devices]
  );

  return (
    <DashboardCard
      title="Network Overview"
      icon={<Network className="w-4 h-4" />}
      href="/networks"
      linkText="Full View →"
      accent="blue"
      loading={loading}
      className={className}
    >
      <div className="h-full flex flex-col">
        {/* Overall Health Ring */}
        <div className="flex items-center justify-center mb-3">
          <OverallHealthRing
            total={totalDevices}
            online={onlineDevices}
            alerting={alertingDevices}
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-1 mb-3 p-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg">
          <div className="text-center">
            <p className="text-base font-bold text-cyan-600 dark:text-cyan-400">{networkCount}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Networks</p>
          </div>
          <div className="text-center border-l border-slate-200 dark:border-slate-700">
            <p className="text-base font-bold text-slate-900 dark:text-white">{totalDevices}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Devices</p>
          </div>
          <div className="text-center border-l border-slate-200 dark:border-slate-700">
            <p className="text-base font-bold text-green-600 dark:text-green-400">{onlineDevices}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Online</p>
          </div>
          <div className="text-center border-l border-slate-200 dark:border-slate-700">
            <p className="text-base font-bold text-amber-600 dark:text-amber-400">{alertingDevices}</p>
            <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Alerting</p>
          </div>
        </div>

        {/* Device Type Breakdown */}
        {activeDevices.length > 0 && (
          <div className="flex-1 space-y-0.5 border-t border-slate-200 dark:border-slate-700 pt-3 overflow-auto">
            <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              By Device Type
            </p>
            {activeDevices.slice(0, 4).map((device) => (
              <DeviceTypeRow key={device.type} device={device} />
            ))}
          </div>
        )}
      </div>
    </DashboardCard>
  );
});

MiniTopologyWidget.displayName = 'MiniTopologyWidget';

export default MiniTopologyWidget;
