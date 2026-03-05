'use client';

import { memo, useState, useMemo, useCallback } from 'react';
import { Layers, Server, AlertTriangle, CheckCircle, XCircle, ExternalLink, Search, Wifi, Globe } from 'lucide-react';
import type { SplunkCorrelatedDevice, SplunkCrossPlatformInsight } from './types';
import { getSeverityConfig } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkCrossPlatformPanelProps {
  correlatedDevices: SplunkCorrelatedDevice[];
  crossPlatformInsights: SplunkCrossPlatformInsight[];
  merakiDevices: any[];
  catalystDevices: any[];
  loading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const platformBadgeConfig: Record<string, { bg: string; text: string; label: string }> = {
  meraki: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-400', label: 'Meraki' },
  catalyst: { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', label: 'Catalyst' },
  thousandeyes: { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400', label: 'ThousandEyes' },
  splunk: { bg: 'bg-orange-100 dark:bg-orange-500/15', text: 'text-orange-700 dark:text-orange-400', label: 'Splunk' },
};

const severityBorder: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-400',
  info: 'border-l-slate-400',
};

// ============================================================================
// Skeleton
// ============================================================================

const PanelSkeleton = memo(() => (
  <div className="space-y-4">
    {/* Health bar skeleton */}
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div>
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-1" />
            <div className="h-5 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
    {/* Card grid skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
          <div className="h-8 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
          <div className="flex gap-2">
            <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </div>
));
PanelSkeleton.displayName = 'PanelSkeleton';

// ============================================================================
// Sub-components
// ============================================================================

const PlatformHealthBadge = memo(({ label, count, color, iconColor }: { label: string; count: number; color: string; iconColor: string }) => (
  <div className="flex items-center gap-2.5">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
      <Server className={`w-4.5 h-4.5 ${iconColor}`} />
    </div>
    <div>
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{count}</p>
    </div>
  </div>
));
PlatformHealthBadge.displayName = 'PlatformHealthBadge';

const statusDotColor = (status: string | undefined): string => {
  if (!status) return 'bg-slate-400';
  const s = status.toLowerCase();
  if (s === 'online' || s === 'reachable' || s === 'active') return 'bg-emerald-500';
  if (s === 'alerting' || s === 'degraded') return 'bg-amber-500';
  return 'bg-red-500';
};

const statusLabel = (status: string | undefined): string => {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

const DeviceCard = memo(({ device }: { device: SplunkCorrelatedDevice }) => {
  const handleInvestigate = useCallback(() => {
    const message = `Investigate network device ${device.hostname || device.ip} across all platforms. IP: ${device.ip}, platforms: ${device.platforms.join(', ')}`;
    const payload = { message, context: { type: 'splunk_analysis' as const, data: { category: 'device-status' as const, title: `Device: ${device.hostname || device.ip}`, details: { 'IP': device.ip, 'Platforms': device.platforms.join(', ') } as Record<string, string | number | undefined>, message } } };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    window.location.href = `/chat-v2?new_session=true&splunk_analysis=${encodeURIComponent(encoded)}`;
  }, [device]);

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
            {device.hostname || device.ip}
          </h4>
          <p className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            {device.ip}
          </p>
        </div>
        {device.logCount != null && device.logCount > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-medium bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 rounded-full flex-shrink-0">
            {device.logCount} logs
          </span>
        )}
      </div>

      {/* Platform badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {device.platforms.map(p => {
          const cfg = platformBadgeConfig[p];
          return cfg ? (
            <span key={p} className={`px-2 py-0.5 text-[10px] font-bold rounded ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
          ) : null;
        })}
      </div>

      {/* Platform status details */}
      <div className="space-y-1.5 mb-3">
        {device.merakiDevice && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotColor(device.merakiDevice.status)}`} />
            <span className="text-green-600 dark:text-green-400 font-medium">Meraki:</span>
            <span className="text-slate-600 dark:text-slate-300 truncate">{device.merakiDevice.name}</span>
            <span className="text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">{statusLabel(device.merakiDevice.status)}</span>
          </div>
        )}
        {device.catalystDevice && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotColor(device.catalystDevice.reachabilityStatus)}`} />
            <span className="text-blue-600 dark:text-blue-400 font-medium">Catalyst:</span>
            <span className="text-slate-600 dark:text-slate-300 truncate">{device.catalystDevice.name}</span>
            <span className="text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">{statusLabel(device.catalystDevice.reachabilityStatus)}</span>
          </div>
        )}
        {device.teAgent && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-purple-500" />
            <span className="text-purple-600 dark:text-purple-400 font-medium">TE Agent:</span>
            <span className="text-slate-600 dark:text-slate-300 truncate">{device.teAgent.agentName}</span>
            <span className="text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0 capitalize">{device.teAgent.agentType}</span>
          </div>
        )}
      </div>

      {/* Last seen */}
      {device.lastSeen && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-3">
          Last seen: {new Date(device.lastSeen).toLocaleString()}
        </p>
      )}

      {/* Investigate button */}
      <button
        onClick={handleInvestigate}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/25 rounded-lg text-xs font-medium text-cyan-700 dark:text-cyan-400 transition"
      >
        <Search className="w-3 h-3" />
        Investigate
      </button>
    </div>
  );
});
DeviceCard.displayName = 'DeviceCard';

const InsightRow = memo(({ insight }: { insight: SplunkCrossPlatformInsight }) => {
  const config = getSeverityConfig(insight.severity);
  const borderClass = severityBorder[insight.severity] || severityBorder.info;

  return (
    <div className={`rounded-lg border border-l-4 ${borderClass} border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/40 p-3`}>
      <div className="flex items-start gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${config.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-900 dark:text-white">{insight.title}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{insight.description}</p>
          <div className="flex items-center gap-1.5 mt-2">
            {insight.platforms.map(p => {
              const cfg = platformBadgeConfig[p];
              return cfg ? (
                <span key={p} className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
              ) : null;
            })}
            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${config.badge}`}>
              {insight.severity}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
InsightRow.displayName = 'InsightRow';

// ============================================================================
// Main Component
// ============================================================================

export const SplunkCrossPlatformPanel = memo(({
  correlatedDevices,
  crossPlatformInsights,
  merakiDevices,
  catalystDevices,
  loading,
}: SplunkCrossPlatformPanelProps) => {
  const [activeTab, setActiveTab] = useState<'devices' | 'insights'>('devices');

  const teAgentCount = useMemo(
    () => correlatedDevices.filter(d => d.teAgent).length,
    [correlatedDevices]
  );

  const noPlatforms = merakiDevices.length === 0 && catalystDevices.length === 0 && correlatedDevices.length === 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <PanelSkeleton />
      </div>
    );
  }

  if (noPlatforms) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">No Platforms Configured</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          Configure Cisco Meraki, Catalyst Center, or ThousandEyes in Settings to enable cross-platform correlation with Splunk data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Platform health summary bar */}
      <div className="flex flex-wrap items-center gap-6 p-4 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <PlatformHealthBadge
          label="Meraki"
          count={merakiDevices.length}
          color="bg-green-100 dark:bg-green-500/15"
          iconColor="text-green-600 dark:text-green-400"
        />
        <div className="w-px h-10 bg-slate-200 dark:bg-slate-700/50" />
        <PlatformHealthBadge
          label="Catalyst"
          count={catalystDevices.length}
          color="bg-blue-100 dark:bg-blue-500/15"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <div className="w-px h-10 bg-slate-200 dark:bg-slate-700/50" />
        <PlatformHealthBadge
          label="TE Agents"
          count={teAgentCount}
          color="bg-purple-100 dark:bg-purple-500/15"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
            {correlatedDevices.length} correlated
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700/50">
        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2 text-xs font-medium transition ${
            activeTab === 'devices'
              ? 'text-cyan-700 dark:text-cyan-400 border-b-2 border-cyan-500'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Correlated Devices ({correlatedDevices.length})
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={`px-4 py-2 text-xs font-medium transition ${
            activeTab === 'insights'
              ? 'text-cyan-700 dark:text-cyan-400 border-b-2 border-cyan-500'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Insights ({crossPlatformInsights.length})
        </button>
      </div>

      {/* Devices grid */}
      {activeTab === 'devices' && (
        correlatedDevices.length === 0 ? (
          <div className="text-center py-10">
            <Server className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No correlated devices</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Run a Splunk search to find device IPs that match your network platforms.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {correlatedDevices.map(device => (
              <DeviceCard key={device.ip} device={device} />
            ))}
          </div>
        )
      )}

      {/* Insights list */}
      {activeTab === 'insights' && (
        crossPlatformInsights.length === 0 ? (
          <div className="text-center py-10">
            <AlertTriangle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No cross-platform insights</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Insights are generated when Splunk data correlates with issues detected across platforms.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {crossPlatformInsights.map(insight => (
              <InsightRow key={insight.id} insight={insight} />
            ))}
          </div>
        )
      )}
    </div>
  );
});

SplunkCrossPlatformPanel.displayName = 'SplunkCrossPlatformPanel';
export default SplunkCrossPlatformPanel;
