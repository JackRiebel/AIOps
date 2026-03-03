'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { Network, Wifi, Server, ExternalLink } from 'lucide-react';
import type { SplunkCorrelatedDevice } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SplunkCorrelatedDevicesCardProps {
  devices: SplunkCorrelatedDevice[];
  loading: boolean;
  merakiDevices?: any[];
  catalystDevices?: any[];
}

// ============================================================================
// Helpers
// ============================================================================

function PlatformBadge({ platform }: { platform: string }) {
  const config: Record<string, { color: string; bg: string; border: string; label: string }> = {
    meraki: { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/20', border: 'border-emerald-200 dark:border-emerald-500/20', label: 'Meraki' },
    catalyst: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/20', border: 'border-blue-200 dark:border-blue-500/20', label: 'Catalyst' },
    thousandeyes: { color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-500/20', border: 'border-cyan-200 dark:border-cyan-500/20', label: 'TE' },
  };
  const c = config[platform] || { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-500/20', border: 'border-slate-200 dark:border-slate-600/50', label: platform };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${c.bg} ${c.color} ${c.border}`}>
      {c.label}
    </span>
  );
}

function statusDot(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'online' || s === 'reachable') return 'bg-emerald-500';
  if (s === 'alerting' || s === 'degraded') return 'bg-amber-500';
  if (s === 'offline' || s === 'unreachable') return 'bg-red-500';
  return 'bg-slate-400';
}

// ============================================================================
// Component
// ============================================================================

export const SplunkCorrelatedDevicesCard = memo(({
  devices, loading, merakiDevices = [], catalystDevices = [],
}: SplunkCorrelatedDevicesCardProps) => {
  const router = useRouter();

  const totalNetworkDevices = merakiDevices.length + catalystDevices.length;
  const onlineCount = merakiDevices.filter((d: any) => d.status === 'online').length +
    catalystDevices.filter((d: any) => (d.reachabilityStatus || '').toLowerCase() === 'reachable').length;

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-700/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Correlated Devices</h3>
          {devices.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 tabular-nums border border-cyan-200 dark:border-cyan-500/20">
              {devices.length}
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        {devices.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[280px] overflow-y-auto">
            {devices.slice(0, 15).map((dev, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 py-2.5 px-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group first:pt-0 last:pb-0"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 ${statusDot(dev.merakiDevice?.status || dev.catalystDevice?.reachabilityStatus || '')}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {dev.hostname || dev.ip}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {dev.platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                    {dev.logCount && (
                      <span className="text-[9px] text-slate-400 ml-1 tabular-nums">{dev.logCount} events</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/chat-v2?q=Investigate+device+${encodeURIComponent(dev.hostname || dev.ip)}+in+Splunk+logs`)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition"
                  title="Investigate"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : totalNetworkDevices > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-700/20 border border-slate-100 dark:border-slate-700/30 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Meraki</span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{merakiDevices.length}</span>
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-full">
                {merakiDevices.filter((d: any) => d.status === 'online').length} online
              </span>
            </div>
            {catalystDevices.length > 0 && (
              <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-700/20 border border-slate-100 dark:border-slate-700/30 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Catalyst</span>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{catalystDevices.length}</span>
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-full">
                  {catalystDevices.filter((d: any) => (d.reachabilityStatus || '').toLowerCase() === 'reachable').length} reachable
                </span>
              </div>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center pt-1">
              {onlineCount}/{totalNetworkDevices} devices online
            </p>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/30 flex items-center justify-center mx-auto mb-3">
              <Network className="w-6 h-6 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No devices found</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Connect Meraki or Catalyst to correlate</p>
          </div>
        )}
      </div>
    </div>
  );
});

SplunkCorrelatedDevicesCard.displayName = 'SplunkCorrelatedDevicesCard';
export default SplunkCorrelatedDevicesCard;
