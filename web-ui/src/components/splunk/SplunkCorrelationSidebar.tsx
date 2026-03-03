'use client';

import { memo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Server, Wifi, Activity, Globe } from 'lucide-react';
import type { SplunkCorrelatedDevice } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkCorrelationSidebarProps {
  correlatedDevices: SplunkCorrelatedDevice[];
  loading: boolean;
  onDeviceClick?: (device: SplunkCorrelatedDevice) => void;
}

// ============================================================================
// Platform Helpers
// ============================================================================

const PlatformIcon = memo(({ platform }: { platform: string }) => {
  switch (platform) {
    case 'meraki':
      return (
        <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2.5" fill="currentColor" />
        </svg>
      );
    case 'catalyst':
      return (
        <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <line x1="8" y1="5" x2="8" y2="11" stroke="currentColor" strokeWidth="1.5" />
          <line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'thousandeyes':
      return (
        <svg className="w-3.5 h-3.5 text-purple-500" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1" />
          <circle cx="8" cy="8" r="1" fill="currentColor" />
        </svg>
      );
    default:
      return <Globe className="w-3.5 h-3.5 text-slate-400" />;
  }
});
PlatformIcon.displayName = 'PlatformIcon';

const statusDotColor = (status: string | undefined): string => {
  if (!status) return 'bg-slate-400';
  const s = status.toLowerCase();
  if (s === 'online' || s === 'reachable' || s === 'active') return 'bg-emerald-500';
  if (s === 'alerting' || s === 'degraded') return 'bg-amber-500';
  return 'bg-red-500';
};

// ============================================================================
// Skeleton
// ============================================================================

const SidebarSkeleton = memo(() => (
  <div className="space-y-3 p-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="space-y-2">
        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
      </div>
    ))}
  </div>
));
SidebarSkeleton.displayName = 'SidebarSkeleton';

// ============================================================================
// Device Row
// ============================================================================

const DeviceRow = memo(({ device, onClick }: { device: SplunkCorrelatedDevice; onClick?: () => void }) => {
  const displayName = device.hostname || device.ip;
  const primaryStatus = device.merakiDevice?.status || device.catalystDevice?.reachabilityStatus;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2.5 rounded-lg bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor(primaryStatus)}`} />
        <span className="text-xs font-medium text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
          {displayName}
        </span>
      </div>

      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400 font-mono">
          {device.ip}
        </span>
        {device.logCount != null && device.logCount > 0 && (
          <span className="text-[9px] text-slate-400 dark:text-slate-500 ml-auto">
            {device.logCount} logs
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {device.merakiDevice && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400">
            <PlatformIcon platform="meraki" />
            Meraki
          </span>
        )}
        {device.catalystDevice && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
            <PlatformIcon platform="catalyst" />
            Catalyst
          </span>
        )}
        {device.teAgent && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400">
            <PlatformIcon platform="thousandeyes" />
            TE Agent
          </span>
        )}
      </div>
    </button>
  );
});
DeviceRow.displayName = 'DeviceRow';

// ============================================================================
// Main Component
// ============================================================================

export const SplunkCorrelationSidebar = memo(({
  correlatedDevices,
  loading,
  onDeviceClick,
}: SplunkCorrelationSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = useCallback(() => setCollapsed(c => !c), []);

  const merakiDevices = correlatedDevices.filter(d => d.merakiDevice);
  const catalystDevices = correlatedDevices.filter(d => d.catalystDevice);
  const teDevices = correlatedDevices.filter(d => d.teAgent);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center w-10 bg-white dark:bg-slate-800/60 border-l border-slate-200 dark:border-slate-700/50 py-3">
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
          title="Expand correlation sidebar"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>
        {correlatedDevices.length > 0 && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-500/15 flex items-center justify-center">
              <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400">{correlatedDevices.length}</span>
            </div>
            <Activity className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 bg-white dark:bg-slate-800/60 border-l border-slate-200 dark:border-slate-700/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-500" />
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Cross-Platform Matches</h3>
        </div>
        <button
          onClick={toggleCollapsed}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
          title="Collapse sidebar"
        >
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700/30">
        {merakiDevices.length > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400">
            {merakiDevices.length} Meraki
          </span>
        )}
        {catalystDevices.length > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
            {catalystDevices.length} Catalyst
          </span>
        )}
        {teDevices.length > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400">
            {teDevices.length} TE
          </span>
        )}
        {correlatedDevices.length === 0 && !loading && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">No platforms matched</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <SidebarSkeleton />
        ) : correlatedDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <Server className="w-5 h-5 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No matches found</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              Device IPs from Splunk logs did not match any Meraki, Catalyst, or TE devices.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {correlatedDevices.map((device) => (
              <DeviceRow
                key={device.ip}
                device={device}
                onClick={onDeviceClick ? () => onDeviceClick(device) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

SplunkCorrelationSidebar.displayName = 'SplunkCorrelationSidebar';
export default SplunkCorrelationSidebar;
