'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import type { TEUsage } from './types';

// ============================================================================
// Types
// ============================================================================

export interface UsageCardProps {
  loading?: boolean;
}

// ============================================================================
// Usage Bar
// ============================================================================

function UsageBar({ label, used, total, unit }: {
  label: string;
  used: number;
  total?: number;
  unit?: string;
}) {
  const pct = total && total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = pct > 90 ? 'text-red-600 dark:text-red-400' : pct > 70 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className={`text-xs font-semibold ${textColor}`}>
          {used.toLocaleString()}{total ? ` / ${total.toLocaleString()}` : ''}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      {total && total > 0 ? (
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full" />
      )}
    </div>
  );
}

// ============================================================================
// Stat Card
// ============================================================================

function StatMini({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ============================================================================
// UsageCard Component
// ============================================================================

export const UsageCard = memo(({}: UsageCardProps) => {
  const [usage, setUsage] = useState<TEUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/thousandeyes/usage?organization=default', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // TE API may return usage in various formats
      const u: TEUsage = {
        cloudUnitsUsed: data.cloudUnitsUsed ?? data.usage?.cloudUnitsUsed ?? 0,
        cloudUnitsProjected: data.cloudUnitsProjected ?? data.usage?.cloudUnitsProjected ?? 0,
        enterpriseUnitsUsed: data.enterpriseUnitsUsed ?? data.usage?.enterpriseUnitsUsed ?? 0,
        enterpriseAgentUsed: data.enterpriseAgentUsed ?? data.usage?.enterpriseAgentsUsed ?? 0,
        endpointAgentsUsed: data.endpointAgentsUsed ?? data.usage?.endpointAgentsUsed ?? 0,
        quota: data.quota ?? data.usage?.quota ?? {},
      };
      setUsage(u);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  return (
    <DashboardCard title="Usage & Quotas" icon={<BarChart3 className="w-4 h-4" />} accent="green" compact>
      {loading && !usage && (
        <div className="py-6 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
      )}

      {error && !usage && (
        <div className="py-4 text-center">
          <p className="text-xs text-slate-500 mb-2">Unable to load usage data</p>
          <button onClick={fetchUsage} className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1 mx-auto">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {usage && (
        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatMini label="Cloud Units" value={usage.cloudUnitsUsed ?? 0} sub={usage.cloudUnitsProjected ? `${usage.cloudUnitsProjected.toLocaleString()} projected` : undefined} />
            <StatMini label="Enterprise Agents" value={usage.enterpriseAgentUsed ?? 0} sub={usage.quota?.enterpriseAgentsIncluded ? `of ${usage.quota.enterpriseAgentsIncluded}` : undefined} />
            <StatMini label="Endpoint Agents" value={usage.endpointAgentsUsed ?? 0} sub={usage.quota?.endpointAgentsIncluded ? `of ${usage.quota.endpointAgentsIncluded}` : undefined} />
          </div>

          {/* Usage Bars */}
          <div className="space-y-3">
            <UsageBar
              label="Cloud Units"
              used={usage.cloudUnitsUsed ?? 0}
              total={usage.quota?.cloudUnitsMonthly}
              unit="units"
            />
            {usage.quota?.enterpriseAgentsIncluded && (
              <UsageBar
                label="Enterprise Agents"
                used={usage.enterpriseAgentUsed ?? 0}
                total={usage.quota.enterpriseAgentsIncluded}
              />
            )}
            {usage.quota?.endpointAgentsIncluded && (
              <UsageBar
                label="Endpoint Agents"
                used={usage.endpointAgentsUsed ?? 0}
                total={usage.quota.endpointAgentsIncluded}
              />
            )}
          </div>

          {/* Refresh */}
          <button onClick={fetchUsage} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      )}
    </DashboardCard>
  );
});

UsageCard.displayName = 'UsageCard';

export default UsageCard;
