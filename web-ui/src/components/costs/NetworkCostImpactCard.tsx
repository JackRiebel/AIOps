'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Activity,
  Zap,
  AlertTriangle,
  Clock,
  DollarSign,
  RefreshCw,
  Shield,
  Loader2,
  Info,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { HelpTooltip } from '@/components/common';

// ============================================================================
// Types — matching the real backend response from
// GET /api/ai-sessions/cost-network-analysis
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

interface HourlyBreakdown {
  hour: string;
  queries: number;
  cost_usd: number;
  avg_api_latency_ms: number;
  path_health: 'healthy' | 'degraded';
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
  hourly_breakdown: HourlyBreakdown[];
  path_summary: { test_id: number; data: Record<string, unknown> } | null;
  token_waste: TokenWaste | null;
  user_impact: UserImpact | null;
}

type TimePeriod = '1' | '24' | '168';

interface NetworkCostImpactCardProps {
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  if (usd > 0) return `$${usd.toFixed(4)}`;
  return '$0.00';
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function getLatencyStatus(ms: number): 'healthy' | 'warning' | 'critical' {
  if (ms < 500) return 'healthy';
  if (ms < 2000) return 'warning';
  return 'critical';
}

function getLatencyColor(ms: number): string {
  const status = getLatencyStatus(ms);
  if (status === 'healthy') return 'text-emerald-600 dark:text-emerald-400';
  if (status === 'warning') return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getLatencyBorder(ms: number): string {
  const status = getLatencyStatus(ms);
  if (status === 'healthy') return 'border-l-emerald-500';
  if (status === 'warning') return 'border-l-amber-500';
  return 'border-l-red-500';
}

// ============================================================================
// Skeleton Loader
// ============================================================================

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div>
            <div className="h-5 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3.5 w-48 bg-slate-200 dark:bg-slate-700 rounded mt-1.5" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-slate-200 dark:border-l-slate-700 p-3">
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-6 w-14 bg-slate-200 dark:bg-slate-700 rounded mb-1.5" />
            <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
      <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl" />
    </div>
  );
}

// ============================================================================
// Latency Sparkline for hourly breakdown
// ============================================================================

function HourlySparkline({ breakdown }: { breakdown: HourlyBreakdown[] }) {
  if (breakdown.length === 0) return null;
  const maxLatency = Math.max(...breakdown.map(b => b.avg_api_latency_ms), 1);

  return (
    <div className="flex items-end gap-px h-10 w-full">
      {breakdown.slice(-24).map((b, i) => {
        const height = Math.max(4, (b.avg_api_latency_ms / maxLatency) * 100);
        const color = b.path_health === 'degraded'
          ? 'bg-amber-400 dark:bg-amber-500'
          : 'bg-emerald-400 dark:bg-emerald-500';
        return (
          <div
            key={i}
            className={`${color} rounded-sm flex-1 min-w-[3px] transition-all`}
            style={{ height: `${height}%` }}
            title={`${b.hour}: ${Math.round(b.avg_api_latency_ms)}ms avg, ${b.queries} queries, ${formatCost(b.cost_usd)}`}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export const NetworkCostImpactCard = memo(function NetworkCostImpactCard({
  className = '',
}: NetworkCostImpactCardProps) {
  const [hours, setHours] = useState<TimePeriod>('24');
  const [data, setData] = useState<CostNetworkAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(
        `/api/ai-sessions/cost-network-analysis?hours=${hours}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError('Authentication required');
        } else {
          setError(`Failed to load (${res.status})`);
        }
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch cost-network analysis:', err);
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Loading state
  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <SkeletonLoader />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Header hours={hours} onHoursChange={setHours} onRefresh={handleRefresh} refreshing={false} />
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">{error}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Network cost analysis data is unavailable</p>
        </div>
      </div>
    );
  }

  // Empty state — no AI queries in the period
  if (!data || data.total_queries === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Header hours={hours} onHoursChange={setHours} onRefresh={handleRefresh} refreshing={false} />
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
            <Globe className="w-7 h-7 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">No AI queries in this period</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Network cost impact data appears when AI queries are processed.
            Try expanding the time range.
          </p>
        </div>
      </div>
    );
  }

  const impact = data.latency_cost_impact;
  const waste = data.token_waste;
  const userImpact = data.user_impact;
  const estimatedRetryCost = impact?.estimated_retry_cost_usd ?? 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ================================================================ */}
      {/* Header                                                           */}
      {/* ================================================================ */}
      <Header hours={hours} onHoursChange={setHours} onRefresh={handleRefresh} refreshing={loading} />

      {/* ================================================================ */}
      {/* Key Metrics Row                                                  */}
      {/* ================================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total AI Cost */}
        <div className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-cyan-500 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Total AI Cost
            </span>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {formatCost(data.total_ai_cost_usd)}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {data.total_queries.toLocaleString()} queries in {data.period_hours}h
          </p>
        </div>

        {/* Avg API Latency */}
        <div className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 ${getLatencyBorder(data.avg_api_latency_ms)} p-3`}>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Avg API Latency
            </span>
          </div>
          <p className={`text-lg font-bold tabular-nums ${getLatencyColor(data.avg_api_latency_ms)}`}>
            {formatLatency(data.avg_api_latency_ms)}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {impact ? `Baseline: ${formatLatency(impact.baseline_latency_ms)}` : 'End-to-end round trip'}
          </p>
        </div>

        {/* Network Share */}
        <div className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 ${data.network_latency_pct && data.network_latency_pct > 30 ? 'border-l-amber-500' : 'border-l-violet-500'} p-3`}>
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Network Share
            </span>
            <HelpTooltip content="Percentage of total API latency attributable to network transit (TCP connect + TLS handshake). Measured from real AI query traces or ThousandEyes path data." size="xs" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {data.network_latency_pct != null ? `${data.network_latency_pct}%` : '—'}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {data.avg_network_latency_ms != null
              ? `${formatLatency(data.avg_network_latency_ms)} of ${formatLatency(data.avg_api_latency_ms)}`
              : 'No network trace data yet'}
          </p>
        </div>

        {/* Slow Queries */}
        <div className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 ${(impact?.suspected_slow_queries ?? 0) > 0 ? 'border-l-amber-500' : 'border-l-emerald-500'} p-3`}>
          <div className="flex items-center gap-1.5 mb-1">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Slow Queries
            </span>
            <HelpTooltip content="AI queries exceeding p95 latency. These may indicate retries, API throttling, or transient network issues. This is a heuristic — actual retry count may differ." size="xs" />
          </div>
          <p className={`text-lg font-bold tabular-nums ${(impact?.suspected_slow_queries ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
            {impact?.suspected_slow_queries ?? 0}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            of {data.total_queries.toLocaleString()} total queries
          </p>
        </div>

        {/* Est. Retry Cost */}
        <div className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 ${estimatedRetryCost > 0 ? 'border-l-red-500' : 'border-l-emerald-500'} p-3`}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Est. Retry Cost
            </span>
            <HelpTooltip content="Upper-bound estimate of extra cost if all slow queries (>p95) were retries that re-sent full input tokens. Actual cost impact may be lower. Note: on pay-per-token APIs, latency alone does not increase cost — only retries that re-send tokens do." size="xs" />
          </div>
          <p className={`text-lg font-bold tabular-nums ${estimatedRetryCost > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {estimatedRetryCost > 0 ? `~${formatCost(estimatedRetryCost)}` : '$0.00'}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {estimatedRetryCost > 0 && data.total_ai_cost_usd > 0
              ? `up to ${((estimatedRetryCost / data.total_ai_cost_usd) * 100).toFixed(1)}% of total spend`
              : 'No estimated cost impact'}
          </p>
        </div>
      </div>

      {/* ================================================================ */}
      {/* How Network Affects AI Cost — Factual Explanation                 */}
      {/* ================================================================ */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/30">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-500" />
            <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              How Network Conditions Increase AI Costs
            </h3>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mechanism 1: Timeouts cause retries */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-red-500">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Timeout Retries</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              When network latency exceeds the provider timeout ({'>'}30s default), the request fails and the
              retry logic resends the <strong>entire prompt</strong>. Each retry consumes the full input tokens
              again at full cost. We detected{' '}
              <strong>{impact?.suspected_slow_queries ?? 0} unusually slow queries</strong> (exceeding p95 latency)
              which may indicate retries — estimated upper-bound cost:{' '}
              <strong>~{formatCost(waste?.estimated_retry_cost_usd ?? 0)}</strong>.
            </p>
          </div>

          {/* Mechanism 2: Tool/MCP call failures */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-amber-500">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Tool & MCP Call Failures</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              When the AI calls a tool (Meraki API, Splunk query, etc.) and the network drops the connection,
              the tool returns an error. The AI then generates <strong>additional reasoning tokens</strong>{' '}
              to diagnose the failure and retry with a new tool call — each iteration consuming more
              input and output tokens. A single failed tool call can trigger 2-3 extra LLM iterations.
            </p>
          </div>

          {/* Mechanism 3: Excess latency = user time impact */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-violet-500">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">Excess Latency (User Time)</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              On pay-per-token APIs, excess latency does <strong>not</strong> directly increase token cost —
              a slow query costs the same as a fast one. However, it impacts user productivity.
              Your average latency is{' '}
              <strong>{formatLatency(data.avg_api_latency_ms)}</strong> vs a baseline of{' '}
              <strong>{formatLatency(impact?.baseline_latency_ms ?? 0)}</strong>.
              The extra <strong>{formatLatency(impact?.excess_latency_ms ?? 0)}</strong>{' '}
              per query adds up to{' '}
              <strong>{(impact?.total_excess_wait_s ?? 0) >= 60 ? `${((impact?.total_excess_wait_s ?? 0) / 60).toFixed(1)}m` : `${(impact?.total_excess_wait_s ?? 0).toFixed(1)}s`}</strong>{' '}
              of cumulative user wait time across all queries.
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Latency vs Cost — Real Comparison                                */}
      {/* ================================================================ */}
      {impact && (
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/30">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-500" />
              <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Baseline vs Actual Latency
              </h3>
              <HelpTooltip content="Baseline is the p10 latency (best 10% of queries) — representing optimal network conditions. The difference shows the cost impact of suboptimal conditions." size="xs" />
            </div>
          </div>
          <div className="p-5">
            <div className="space-y-4 mb-5">
              {/* Baseline bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Baseline (p10 — best conditions)
                  </span>
                  <span className="text-sm font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatLatency(impact.baseline_latency_ms)}
                  </span>
                </div>
                <div className="h-7 bg-slate-100 dark:bg-slate-700/50 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-lg flex items-center justify-end px-3 transition-all duration-700"
                    style={{ width: `${Math.min(100, (impact.baseline_latency_ms / impact.actual_avg_latency_ms) * 100)}%` }}
                  >
                    <span className="text-[10px] font-medium text-white">optimal</span>
                  </div>
                </div>
              </div>

              {/* Actual avg bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Actual average (all queries)
                  </span>
                  <span className={`text-sm font-mono font-semibold ${getLatencyColor(impact.actual_avg_latency_ms)}`}>
                    {formatLatency(impact.actual_avg_latency_ms)}
                    {impact.excess_latency_ms > 0 && (
                      <span className="text-xs text-slate-400 ml-1.5">
                        (+{formatLatency(impact.excess_latency_ms)})
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-7 bg-slate-100 dark:bg-slate-700/50 rounded-lg overflow-hidden">
                  <div
                    className={`h-full rounded-lg flex items-center justify-end px-3 transition-all duration-700 ${
                      impact.excess_latency_ms > impact.baseline_latency_ms
                        ? 'bg-gradient-to-r from-amber-500 to-red-500'
                        : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                    }`}
                    style={{ width: '100%' }}
                  >
                    <span className="text-[10px] font-medium text-white">
                      avg
                    </span>
                  </div>
                </div>
              </div>

              {/* p95 bar */}
              {userImpact && userImpact.p95_wait_time_ms > impact.actual_avg_latency_ms && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      p95 (worst 5% of queries)
                    </span>
                    <span className={`text-sm font-mono font-semibold ${getLatencyColor(userImpact.p95_wait_time_ms)}`}>
                      {formatLatency(userImpact.p95_wait_time_ms)}
                    </span>
                  </div>
                  <div className="h-7 bg-slate-100 dark:bg-slate-700/50 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-red-500/80 rounded-lg flex items-center justify-end px-3 transition-all duration-700"
                      style={{ width: '100%' }}
                    >
                      <span className="text-[10px] font-medium text-white">tail latency</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Impact summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-700/30">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-cyan-500">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Excess Wait Time</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {impact.total_excess_wait_s >= 60 ? `${(impact.total_excess_wait_s / 60).toFixed(1)}m` : `${impact.total_excess_wait_s.toFixed(1)}s`}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-red-500">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Est. Retry Cost</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">~{formatCost(impact.estimated_retry_cost_usd)}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-amber-500">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Est. Wasted Tokens</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">~{(waste?.estimated_retry_tokens ?? 0).toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border-l-2 border-l-violet-500">
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Est. Token Waste</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">~{waste?.waste_pct ?? 0}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* Hourly Latency & Cost Breakdown                                  */}
      {/* ================================================================ */}
      {data.hourly_breakdown.length > 0 && (
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-500" />
                <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Hourly API Latency
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-emerald-400" /> Healthy
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-amber-400" /> Degraded ({'>'}p75)
                </span>
              </div>
            </div>
          </div>
          <div className="p-5">
            <HourlySparkline breakdown={data.hourly_breakdown} />

            {/* Degraded hours summary */}
            {userImpact && userImpact.degraded_query_pct > 0 && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/15">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <strong>{userImpact.degraded_query_pct.toFixed(1)}%</strong> of queries ran during degraded
                  periods (latency exceeding p75 threshold).{' '}
                  {userImpact.timeout_count > 0 && (
                    <>
                      <strong>{userImpact.timeout_count}</strong> queries likely timed out
                      ({userImpact.timeout_probability_pct.toFixed(1)}% timeout probability).
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* User Experience Impact                                           */}
      {/* ================================================================ */}
      {userImpact && (
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-500" />
              <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                User Wait Time Impact
              </h3>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 text-center">
                <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatLatency(userImpact.p50_wait_time_ms)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Median Wait (p50)</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 text-center">
                <p className={`text-lg font-bold tabular-nums ${getLatencyColor(userImpact.p95_wait_time_ms)}`}>
                  {formatLatency(userImpact.p95_wait_time_ms)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Tail Wait (p95)</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 text-center">
                <p className={`text-lg font-bold tabular-nums ${userImpact.total_excess_wait_s > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                  {userImpact.total_excess_wait_s >= 60 ? `${(userImpact.total_excess_wait_s / 60).toFixed(1)}m` : `${userImpact.total_excess_wait_s.toFixed(1)}s`}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Total Excess Wait</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 text-center">
                <p className={`text-lg font-bold tabular-nums ${userImpact.timeout_probability_pct > 1 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                  {userImpact.timeout_probability_pct}%
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Timeout Probability</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 text-center">
                <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {userImpact.total_queries.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Total Queries</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ThousandEyes Path Data                                           */}
      {/* ================================================================ */}
      <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 ${data.path_summary ? 'border-l-emerald-500' : 'border-l-slate-300 dark:border-l-slate-600'} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700/30">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-500" />
            <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ThousandEyes Network Path Monitoring
            </h3>
          </div>
        </div>
        <div className="p-5">
          {data.path_summary ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Active — monitoring AI provider network paths
                </p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                ThousandEyes is actively monitoring network paths to your AI provider endpoints.
                Path visualization data is being correlated with AI query latency to identify
                when network conditions contribute to increased costs.
              </p>
              {data.avg_network_latency_ms != null && (
                <div className="flex items-center gap-4 mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Network Latency</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{formatLatency(data.avg_network_latency_ms)}</p>
                  </div>
                  <div className="h-8 border-r border-slate-200 dark:border-slate-700" />
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">% of API Latency</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{data.network_latency_pct ?? 0}%</p>
                  </div>
                  <div className="h-8 border-r border-slate-200 dark:border-slate-700" />
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Server Processing</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatLatency(data.avg_api_latency_ms - (data.avg_network_latency_ms ?? 0))}
                    </p>
                  </div>
                </div>
              )}
              <a
                href="/thousandeyes"
                className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium transition mt-1"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                View full ThousandEyes dashboard
              </a>
            </div>
          ) : (
            <div className="text-center py-4">
              <Globe className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                No ThousandEyes path data available
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Set up AI Assurance tests in ThousandEyes to monitor network paths to your AI provider
                endpoints. This enables precise network vs server latency attribution.
              </p>
              <a
                href="/thousandeyes"
                className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium transition mt-3"
              >
                Configure in ThousandEyes
                <TrendingUp className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* Why This Matters — Key Insight                                    */}
      {/* ================================================================ */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-500/5 dark:to-teal-500/5 border border-cyan-200 dark:border-cyan-500/20">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-500/10 flex-shrink-0">
            <Shield className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-cyan-900 dark:text-cyan-100 mb-1">
              Why Network Monitoring Matters for AI Costs
            </h4>
            <p className="text-[11px] text-cyan-800 dark:text-cyan-300 leading-relaxed">
              AI providers use exponential backoff retry logic (up to 3 retries with 2^n second delays).
              Each retry resends the <strong>entire prompt</strong> — consuming full input tokens again.
              A single timed-out query can cost <strong>3-4x the normal price</strong>.
              When a tool or MCP server call fails due to network issues, the AI generates additional
              reasoning tokens to diagnose and retry, adding <strong>2-3 extra LLM iterations</strong> per failure.
              ThousandEyes network path monitoring identifies degraded routes <strong>before</strong>{' '}
              they cause timeouts, enabling proactive routing changes that prevent wasted tokens and cost overruns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Header Sub-Component
// ============================================================================

function Header({
  hours,
  onHoursChange,
  onRefresh,
  refreshing,
}: {
  hours: TimePeriod;
  onHoursChange: (h: TimePeriod) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-cyan-500/20">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            AI Network Cost Analysis
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real cost impact of network conditions on AI queries
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={hours}
          onChange={(e) => onHoursChange(e.target.value as TimePeriod)}
          className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300"
        >
          <option value="1">Last hour</option>
          <option value="24">Last 24 hours</option>
          <option value="168">Last 7 days</option>
        </select>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          title="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}

NetworkCostImpactCard.displayName = 'NetworkCostImpactCard';

export default NetworkCostImpactCard;
