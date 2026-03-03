'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { Network, ExternalLink, ArrowRight } from 'lucide-react';
import type { CorrelatedDevice, PlatformHealthSummary } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TECorrelatedInfraCardProps {
  devices: CorrelatedDevice[];
  loading: boolean;
  platformHealth?: PlatformHealthSummary[];
  onNavigateToCrossPlatform?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function PlatformBadge({ platform }: { platform: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    thousandeyes: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-400', label: 'TE' },
    meraki: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', label: 'Meraki' },
    catalyst: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: 'Catalyst' },
  };
  const c = config[platform] || { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', label: platform };
  return <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${c.bg} ${c.text}`}>{c.label}</span>;
}

const healthDot: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  critical: 'bg-red-500',
  offline: 'bg-slate-400',
};

const platformDotColor: Record<string, { configured: string; unconfigured: string; label: string }> = {
  thousandeyes: { configured: 'bg-cyan-500', unconfigured: 'bg-slate-300 dark:bg-slate-600', label: 'TE' },
  meraki: { configured: 'bg-emerald-500', unconfigured: 'bg-slate-300 dark:bg-slate-600', label: 'MK' },
  catalyst: { configured: 'bg-blue-500', unconfigured: 'bg-slate-300 dark:bg-slate-600', label: 'CC' },
};

// ============================================================================
// Component
// ============================================================================

export const TECorrelatedInfraCard = memo(({ devices, loading, platformHealth, onNavigateToCrossPlatform }: TECorrelatedInfraCardProps) => {
  const router = useRouter();

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Correlated Infrastructure</h3>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-700/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Correlated Infrastructure</h3>
          {devices.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400">
              {devices.length}
            </span>
          )}
        </div>
      </div>

      {/* Platform Health Dots Strip */}
      {platformHealth && platformHealth.length > 0 && (
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-700/30">
          {(['thousandeyes', 'meraki', 'catalyst'] as const).map(platform => {
            const ph = platformHealth.find(p => p.platform === platform);
            const cfg = platformDotColor[platform];
            const isConfigured = ph?.configured ?? false;
            return (
              <div key={platform} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isConfigured ? cfg.configured : cfg.unconfigured}`} />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{cfg.label}</span>
                {isConfigured && ph && (
                  <span className="text-[10px] text-slate-400">{ph.onlineCount}/{ph.deviceCount}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Device List (summary — max 5) */}
      {devices.length === 0 ? (
        <div className="py-4 text-center">
          <Network className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">No cross-platform device matches found</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {devices.slice(0, 5).map((dev) => (
            <div
              key={dev.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${healthDot[dev.healthStatus] || 'bg-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{dev.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {dev.platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                  <span className="text-[10px] text-slate-400 ml-1">{dev.matchedIp}</span>
                </div>
              </div>
              <button
                onClick={() => router.push(`/chat-v2?q=Investigate+device+${encodeURIComponent(dev.name)}+at+${dev.matchedIp}`)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-cyan-500 transition"
                title="Investigate in Chat"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          ))}
          {devices.length > 5 && (
            <p className="text-[10px] text-slate-400 text-center pt-1">+{devices.length - 5} more</p>
          )}
        </div>
      )}

      {/* Navigation Link */}
      {onNavigateToCrossPlatform && (
        <button
          onClick={onNavigateToCrossPlatform}
          className="w-full mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/30 flex items-center justify-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
        >
          View Cross-Platform Details
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
});

TECorrelatedInfraCard.displayName = 'TECorrelatedInfraCard';
export default TECorrelatedInfraCard;
