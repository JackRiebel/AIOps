'use client';

import { memo, useMemo } from 'react';
import { Server } from 'lucide-react';
import { HealthGauge } from '@/app/chat-v2/cards/widgets/HealthGauge';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { AgentGroupSummary, PlatformHealthSummary } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEAgentStatusGridProps {
  agentsByRegion: Record<string, AgentGroupSummary>;
  platformHealth?: PlatformHealthSummary[];
  loading: boolean;
  onAgentGroupClick?: (region: string) => void;
}

// ============================================================================
// Component
// ============================================================================

const platformColors: Record<string, { bg: string; text: string; label: string }> = {
  meraki: { bg: 'bg-green-100 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-400', label: 'Meraki' },
  catalyst: { bg: 'bg-indigo-100 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-400', label: 'Catalyst' },
};

export const TEAgentStatusGrid = memo(({ agentsByRegion, platformHealth, loading, onAgentGroupClick }: TEAgentStatusGridProps) => {
  const regions = useMemo(
    () => Object.values(agentsByRegion).sort((a, b) => b.total - a.total),
    [agentsByRegion],
  );

  return (
    <DashboardCard
      title="Agent Status"
      icon={<Server className="w-4 h-4" />}
      accent="green"
      loading={loading}
      compact
    >
      {regions.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          No agents configured
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto">
          {regions.map(region => {
            const healthPct = region.total > 0 ? Math.round((region.online / region.total) * 100) : 0;
            return (
              <button
                key={region.region}
                onClick={() => onAgentGroupClick?.(region.region)}
                className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-700/30 hover:border-green-300 dark:hover:border-green-500/30 transition text-left"
              >
                <HealthGauge value={healthPct} label="" size="sm" showValue={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {region.region}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {region.online}/{region.total} online
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(region.types).map(([type, count]) => (
                      <span
                        key={type}
                        className="px-1.5 py-0.5 text-[9px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
                      >
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Platform Health Section */}
      {platformHealth && platformHealth.filter(p => p.platform !== 'thousandeyes').length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/40">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Platform Health
          </p>
          <div className="space-y-1.5">
            {platformHealth.filter(p => p.platform !== 'thousandeyes').map(p => {
              const pc = platformColors[p.platform];
              if (!pc) return null;
              const isHealthy = p.healthPercent >= 90;
              const isDegraded = p.healthPercent >= 50;
              return (
                <div key={p.platform} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${pc.bg} ${pc.text} min-w-[52px] text-center`}>
                    {pc.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${p.healthPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-300 min-w-[32px] text-right">
                        {p.healthPercent}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="font-medium">{p.onlineCount}</span>
                      <span className="text-slate-400 dark:text-slate-500">/{p.deviceCount}</span>
                    </div>
                    {p.alertCount > 0 && (
                      <span className="text-[10px] text-red-500">{p.alertCount} alert{p.alertCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardCard>
  );
});

TEAgentStatusGrid.displayName = 'TEAgentStatusGrid';
export default TEAgentStatusGrid;
