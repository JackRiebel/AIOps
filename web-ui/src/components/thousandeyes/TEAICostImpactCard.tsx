'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  Activity,
  Zap,
  AlertTriangle,
  ArrowRight,
  Repeat,
  Clock,
  TrendingUp,
  Loader2,
  Info,
} from 'lucide-react';

// ============================================================================
// Types — matching GET /api/ai-sessions/cost-network-analysis response
// ============================================================================

interface LatencyCostImpact {
  baseline_latency_ms: number;
  actual_avg_latency_ms: number;
  excess_latency_ms: number;
  total_excess_wait_s: number;
  suspected_slow_queries: number;
  estimated_retry_cost_usd: number;
}

interface TokenWaste {
  suspected_slow_queries: number;
  estimated_retry_tokens: number;
  total_productive_tokens: number;
  waste_pct: number;
  estimated_retry_cost_usd: number;
}

interface UserImpact {
  avg_wait_time_ms: number;
  p50_wait_time_ms: number;
  p95_wait_time_ms: number;
  timeout_probability_pct: number;
  degraded_query_pct: number;
  total_excess_wait_s: number;
  timeout_count: number;
  total_queries: number;
}

interface CostNetworkAnalysis {
  provider: string | null;
  period_hours: number;
  total_ai_cost_usd: number;
  total_queries: number;
  avg_api_latency_ms: number;
  avg_network_latency_ms: number | null;
  network_latency_pct: number | null;
  latency_cost_impact: LatencyCostImpact | null;
  hourly_breakdown: { hour: string; queries: number; cost_usd: number; avg_api_latency_ms: number; path_health: string }[];
  path_summary: { test_id: number; data: Record<string, unknown> } | null;
  token_waste: TokenWaste | null;
  user_impact: UserImpact | null;
}

// ============================================================================
// Component
// ============================================================================

export interface TEAICostImpactCardProps {
  loading: boolean;
}

export const TEAICostImpactCard = memo(({ loading: parentLoading }: TEAICostImpactCardProps) => {
  const router = useRouter();
  const [data, setData] = useState<CostNetworkAnalysis | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/ai-sessions/cost-network-analysis?hours=24', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch AI cost-network analysis:', err);
      setError('Unable to load AI cost data');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isLoading = parentLoading || fetching;

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-2 min-h-[24px]">
          <DollarSign className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">AI Cost Impact</h3>
        </div>
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 animate-pulse">
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-lg" />
            ))}
          </div>
          <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-2 min-h-[24px]">
          <DollarSign className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">AI Cost Impact</h3>
        </div>
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.total_queries === 0) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-2 min-h-[24px]">
          <DollarSign className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">AI Cost Impact</h3>
        </div>
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
          <div className="flex items-center gap-2.5 py-3 justify-center text-center">
            <Info className="w-4 h-4 text-slate-400" />
            <p className="text-xs text-slate-500 dark:text-slate-400">No AI queries in the last 24 hours. Cost impact analysis requires AI usage data.</p>
          </div>
        </div>
      </div>
    );
  }

  const impact = data.latency_cost_impact;
  const tw = data.token_waste;
  const ui = data.user_impact;

  // Calculate overall estimated cost impact
  const estimatedRetryCost = impact?.estimated_retry_cost_usd ?? 0;
  const hasSlowQueries = (impact?.suspected_slow_queries ?? 0) > 0;
  const hasTokenWaste = tw && tw.estimated_retry_tokens > 0;
  const hasExcess = impact && impact.excess_latency_ms > 10;
  const issueCount = (hasSlowQueries ? 1 : 0) + (hasTokenWaste ? 1 : 0) + (hasExcess ? 1 : 0);

  // Determine severity
  const severity: 'healthy' | 'warning' | 'critical' =
    estimatedRetryCost > 1 || (impact?.suspected_slow_queries ?? 0) > 5 ? 'critical' :
    estimatedRetryCost > 0.1 || hasSlowQueries || (impact?.excess_latency_ms ?? 0) > 100 ? 'warning' :
    'healthy';

  const severityColors = {
    healthy: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    critical: 'border-l-red-500',
  };

  const severityBg = {
    healthy: '',
    warning: 'bg-amber-50/30 dark:bg-amber-900/5',
    critical: 'bg-red-50/30 dark:bg-red-900/5',
  };

  return (
    <div className="flex flex-col">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-2 min-h-[24px]">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            AI Cost Impact
          </h3>
          {issueCount > 0 && (
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
              severity === 'critical'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            }`}>
              {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
            </span>
          )}
          {fetching && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
        </div>
        <button
          onClick={() => router.push('/costs?tab=network')}
          className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium transition"
        >
          Full Report
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Card Body */}
      <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 ${severityColors[severity]} ${severityBg[severity]} transition-colors hover:border-cyan-300 dark:hover:border-cyan-500/30`}>
        {/* Key metrics grid */}
        <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-700/30 rounded-t-xl overflow-hidden">
          {/* Total AI Cost */}
          <div className="bg-white dark:bg-slate-800/60 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3 h-3 text-cyan-500" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">AI Cost (24h)</span>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              ${data.total_ai_cost_usd.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">{data.total_queries} queries</span>
          </div>

          {/* Avg Latency */}
          <div className="bg-white dark:bg-slate-800/60 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Avg Latency</span>
            </div>
            <span className={`text-sm font-bold tabular-nums ${
              data.avg_api_latency_ms > 2000 ? 'text-red-600 dark:text-red-400' :
              data.avg_api_latency_ms > 500 ? 'text-amber-600 dark:text-amber-400' :
              'text-slate-900 dark:text-white'
            }`}>
              {data.avg_api_latency_ms >= 1000 ? `${(data.avg_api_latency_ms / 1000).toFixed(1)}s` : `${Math.round(data.avg_api_latency_ms)}ms`}
            </span>
            {impact && (
              <span className="text-[10px] text-slate-400 ml-1">
                baseline {Math.round(impact.baseline_latency_ms)}ms
              </span>
            )}
          </div>

          {/* Est. Retry Cost */}
          <div className="bg-white dark:bg-slate-800/60 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Est. Retry Cost</span>
            </div>
            <span className={`text-sm font-bold tabular-nums ${
              estimatedRetryCost > 1 ? 'text-red-600 dark:text-red-400' :
              estimatedRetryCost > 0.01 ? 'text-amber-600 dark:text-amber-400' :
              'text-emerald-600 dark:text-emerald-400'
            }`}>
              {estimatedRetryCost > 0 ? `~$${estimatedRetryCost.toFixed(estimatedRetryCost >= 1 ? 2 : 4)}` : '$0.00'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">upper bound</span>
          </div>

          {/* Slow Queries */}
          <div className="bg-white dark:bg-slate-800/60 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Repeat className="w-3 h-3 text-red-500" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Slow Queries</span>
            </div>
            <span className={`text-sm font-bold tabular-nums ${
              (impact?.suspected_slow_queries ?? 0) > 5 ? 'text-red-600 dark:text-red-400' :
              (impact?.suspected_slow_queries ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' :
              'text-emerald-600 dark:text-emerald-400'
            }`}>
              {impact?.suspected_slow_queries ?? 0}
            </span>
            {tw && tw.estimated_retry_tokens > 0 && (
              <span className="text-[10px] text-slate-400 ml-1">
                ~{tw.estimated_retry_tokens.toLocaleString()} est. tokens
              </span>
            )}
          </div>
        </div>

        {/* Impact findings */}
        <div className="p-3 space-y-1.5">
          {severity === 'healthy' && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Network conditions are healthy — minimal impact on AI costs
            </div>
          )}

          {hasSlowQueries && impact && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                <strong>{impact.suspected_slow_queries}</strong> unusually slow queries ({'>'}p95 latency) — may indicate retries, throttling, or transient issues
              </span>
            </div>
          )}

          {hasExcess && impact && (
            <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
              <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                Latency is <strong>+{Math.round(impact.excess_latency_ms)}ms</strong> above baseline — {impact.total_excess_wait_s >= 60 ? `${(impact.total_excess_wait_s / 60).toFixed(1)}m` : `${impact.total_excess_wait_s.toFixed(1)}s`} total excess wait time
              </span>
            </div>
          )}

          {ui && ui.timeout_probability_pct > 1 && (
            <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                <strong>{ui.timeout_probability_pct.toFixed(1)}%</strong> of queries risk timeout — p95 wait time is{' '}
                {ui.p95_wait_time_ms >= 1000
                  ? `${(ui.p95_wait_time_ms / 1000).toFixed(1)}s`
                  : `${Math.round(ui.p95_wait_time_ms)}ms`}
              </span>
            </div>
          )}
        </div>

        {/* Hourly sparkline */}
        {data.hourly_breakdown.length > 2 && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">24h Latency</span>
            </div>
            <div className="flex items-end gap-px h-8">
              {data.hourly_breakdown.map((b, i) => {
                const maxLat = Math.max(...data.hourly_breakdown.map(h => h.avg_api_latency_ms), 1);
                const pct = (b.avg_api_latency_ms / maxLat) * 100;
                const color = b.path_health === 'degraded'
                  ? 'bg-amber-500'
                  : b.avg_api_latency_ms > maxLat * 0.8
                  ? 'bg-amber-400'
                  : 'bg-cyan-500';
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${color} transition-all`}
                    style={{ height: `${Math.max(pct, 4)}%` }}
                    title={`${b.hour.split('T')[1]?.replace(':00', 'h') || b.hour}: ${Math.round(b.avg_api_latency_ms)}ms, ${b.queries} queries, $${b.cost_usd.toFixed(4)}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

TEAICostImpactCard.displayName = 'TEAICostImpactCard';
export default TEAICostImpactCard;
