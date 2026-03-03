'use client';

import { memo, useMemo, useState } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import {
  Wifi, Zap, Activity, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Repeat, Clock, Users, Target,
} from 'lucide-react';
import type { CostAnalysis } from './hooks/useAIPathJourney';
import type { PathAgentTrace } from './hooks/useAIPathJourney';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NetworkImpactPanelProps {
  data: CostAnalysis;
  agentTraces?: PathAgentTrace[];
}

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, badge, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  badge?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-200/50 dark:border-slate-700/30">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-2.5 flex items-center gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{title}</span>
        {badge && (
          <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="px-5 pb-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Impact Card
// ---------------------------------------------------------------------------

function UserImpactCard({ label, value, progress, color, tooltip }: {
  label: string;
  value: string;
  progress?: number;
  color?: string;
  tooltip?: string;
}) {
  const barColor = color || 'bg-cyan-500';
  return (
    <div className="flex-1 min-w-[120px] p-2.5 rounded-lg bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30" title={tooltip}>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">{value}</div>
      {progress != null && (
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card (existing)
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex-1 min-w-[140px] p-3 rounded-lg bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip for Degradation Timeline
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const healthColor = d.health === 'failing' ? '#ef4444' : d.health === 'degraded' ? '#f59e0b' : '#06b6d4';
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/95 px-3 py-2 text-[11px] text-slate-200 shadow-lg">
      <div className="font-semibold mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: healthColor }} />
        <span className="capitalize">{d.health || 'healthy'}</span>
      </div>
      <div className="mt-1 space-y-0.5 text-slate-400">
        <div>Latency: <span className="text-white font-mono">{d.latency?.toFixed(0)}ms</span></div>
        <div>Cost: <span className="text-white font-mono">${d.cost?.toFixed(4) || '0'}</span></div>
        <div>Queries: <span className="text-white font-mono">{d.queries}</span></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const NetworkImpactPanel = memo(function NetworkImpactPanel({ data, agentTraces }: NetworkImpactPanelProps) {
  const { latency_cost_impact: impact, hourly_breakdown: breakdown } = data;

  // Derive chart data with cost
  const chartData = useMemo(() =>
    breakdown.map(b => ({
      hour: b.hour.split('T')[1]?.replace(':00', 'h') || b.hour,
      latency: b.avg_api_latency_ms,
      cost: b.cost_usd,
      queries: b.queries,
      health: b.path_health,
    })),
  [breakdown]);

  // Health-based bar colors
  const barColors = useMemo(() =>
    chartData.map(d =>
      d.health === 'failing' ? '#ef4444' : d.health === 'degraded' ? '#f59e0b' : '#06b6d4'
    ),
  [chartData]);

  // Find degraded/failing periods for reference areas
  const degradedRanges = useMemo(() => {
    const ranges: { start: string; end: string; severity: 'degraded' | 'failing' }[] = [];
    let current: { start: string; end: string; severity: 'degraded' | 'failing' } | null = null;
    for (const point of chartData) {
      const isBad = point.health === 'degraded' || point.health === 'failing';
      if (isBad) {
        const severity = point.health === 'failing' ? 'failing' : 'degraded';
        if (!current) current = { start: point.hour, end: point.hour, severity };
        else {
          current.end = point.hour;
          if (severity === 'failing') current.severity = 'failing';
        }
      } else if (current) {
        ranges.push(current);
        current = null;
      }
    }
    if (current) ranges.push(current);
    return ranges;
  }, [chartData]);

  const degradedCount = chartData.filter(d => d.health === 'degraded' || d.health === 'failing').length;
  const hasDegraded = degradedCount > 0;

  // Build insight text
  const insight = useMemo(() => {
    if (!impact || impact.excess_latency_ms <= 5) return null;
    const parts: string[] = [];
    if (impact.excess_latency_ms > 0) {
      parts.push(
        `Average latency is ${impact.actual_avg_latency_ms.toFixed(0)}ms vs ${impact.baseline_latency_ms.toFixed(0)}ms best-case (+${impact.excess_latency_ms.toFixed(0)}ms above baseline)`
      );
    }
    if (impact.suspected_slow_queries > 0) {
      parts.push(`${impact.suspected_slow_queries} unusually slow queries detected (>p95 latency)`);
    }
    return parts.join('. ') + '.';
  }, [impact]);

  // Per-location path breakdown
  const locationBreakdown = useMemo(() => {
    if (!agentTraces || agentTraces.length === 0) return null;
    return agentTraces.map(trace => {
      const totalLatency = trace.hops.reduce((s, h) => s + h.latency, 0);
      const maxLoss = Math.max(...trace.hops.map(h => h.loss), 0);
      const health = maxLoss > 5 ? 'Degraded' : totalLatency > 100 ? 'Elevated' : 'Healthy';
      return {
        location: trace.agentName,
        latency: totalLatency,
        hops: trace.hops.length,
        health,
      };
    });
  }, [agentTraces]);

  // Bottleneck analysis from first agent trace
  const bottleneckData = useMemo(() => {
    if (!agentTraces || agentTraces.length === 0) return null;
    const hops = agentTraces[0].hops;
    if (hops.length === 0) return null;
    const totalLatency = hops.reduce((s, h) => s + h.latency, 0);
    if (totalLatency <= 0) return null;
    const maxLatency = Math.max(...hops.map(h => h.latency));
    return hops.map((h, i) => ({
      hopNumber: h.hopNumber || i + 1,
      ip: h.ipAddress,
      network: h.network || '',
      latency: h.latency,
      pct: (h.latency / totalLatency) * 100,
      isBottleneck: h.latency === maxLatency && maxLatency > 10,
    }));
  }, [agentTraces]);

  if (data.total_queries === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/60 dark:bg-slate-800/40 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        No AI queries in the selected period. Network impact analysis requires recent AI usage data.
      </div>
    );
  }

  const tw = data.token_waste;
  const ui = data.user_impact;

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-blue-500" />
          <span className="text-[13px] font-semibold text-slate-900 dark:text-white">Network Impact on AI</span>
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">Last {data.period_hours}h</span>
      </div>

      {/* Stat row */}
      <div className="px-5 py-3 flex gap-3 flex-wrap">
        <StatCard
          label="Avg Network Latency"
          value={`${(data.avg_network_latency_ms ?? data.avg_api_latency_ms).toFixed(0)}ms`}
          sub={`${data.total_queries} queries`}
          icon={Wifi}
          color="text-blue-500"
        />
        <StatCard
          label="Baseline vs Actual"
          value={`${data.avg_api_latency_ms.toFixed(0)}ms`}
          sub={impact ? `baseline ${impact.baseline_latency_ms.toFixed(0)}ms` : undefined}
          icon={Zap}
          color="text-amber-500"
        />
        <StatCard
          label="Path Stability"
          value={data.network_latency_pct != null ? `${data.network_latency_pct}%` : 'N/A'}
          sub="of round-trip is network"
          icon={Activity}
          color="text-purple-500"
        />
        <StatCard
          label="Queries Affected"
          value={`${data.total_queries}`}
          sub={hasDegraded ? `${degradedCount} degraded periods` : 'all periods healthy'}
          icon={hasDegraded ? AlertTriangle : CheckCircle2}
          color={hasDegraded ? 'text-red-500' : 'text-emerald-500'}
        />
      </div>

      {/* ---- Section 3: User Impact ---- */}
      {ui && (
        <CollapsibleSection title="User Impact" icon={Users} defaultOpen>
          <div className="flex gap-2.5 flex-wrap">
            <UserImpactCard
              label="Wait Time (p50)"
              value={`${ui.p50_wait_time_ms.toFixed(0)}ms`}
              tooltip="Median user wait time per query"
            />
            <UserImpactCard
              label="Wait Time (p95)"
              value={`${ui.p95_wait_time_ms.toFixed(0)}ms`}
              color={ui.p95_wait_time_ms > 10000 ? 'bg-red-500' : ui.p95_wait_time_ms > 5000 ? 'bg-amber-500' : 'bg-cyan-500'}
              tooltip="95th percentile user wait time"
            />
            <UserImpactCard
              label="Timeout Risk"
              value={`${ui.timeout_probability_pct.toFixed(1)}%`}
              progress={ui.timeout_probability_pct}
              color={ui.timeout_probability_pct > 5 ? 'bg-red-500' : ui.timeout_probability_pct > 1 ? 'bg-amber-500' : 'bg-emerald-500'}
              tooltip={`${ui.timeout_count} of ${ui.total_queries} queries exceeded timeout threshold`}
            />
            <UserImpactCard
              label="Degraded Queries"
              value={`${ui.degraded_query_pct.toFixed(1)}%`}
              progress={ui.degraded_query_pct}
              color={ui.degraded_query_pct > 20 ? 'bg-red-500' : ui.degraded_query_pct > 5 ? 'bg-amber-500' : 'bg-emerald-500'}
              tooltip="Percentage of queries during degraded network periods"
            />
            <UserImpactCard
              label="Total Excess Wait"
              value={ui.total_excess_wait_s >= 60 ? `${(ui.total_excess_wait_s / 60).toFixed(1)}m` : `${ui.total_excess_wait_s.toFixed(1)}s`}
              color={ui.total_excess_wait_s > 120 ? 'bg-red-500' : ui.total_excess_wait_s > 30 ? 'bg-amber-500' : 'bg-cyan-500'}
              tooltip="Total cumulative time users waited above the best-case baseline"
            />
          </div>
        </CollapsibleSection>
      )}

      {/* ---- Section 4: Degradation Timeline ---- */}
      {chartData.length > 1 && (
        <CollapsibleSection title="Degradation Timeline" icon={Activity} defaultOpen>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
              {degradedRanges.map((r, i) => (
                <ReferenceArea
                  key={i}
                  x1={r.start}
                  x2={r.end}
                  fill={r.severity === 'failing' ? '#ef4444' : '#f59e0b'}
                  fillOpacity={r.severity === 'failing' ? 0.1 : 0.08}
                  stroke={r.severity === 'failing' ? '#ef4444' : '#f59e0b'}
                  strokeOpacity={0.2}
                />
              ))}
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis yAxisId="latency" tick={{ fontSize: 11 }} stroke="#94a3b8" unit="ms" />
              <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 10 }} stroke="#94a3b8" unit="$" />
              <RechartsTooltip content={<TimelineTooltip />} />
              <Bar yAxisId="cost" dataKey="cost" barSize={14} radius={[2, 2, 0, 0]} opacity={0.6} name="Cost ($)">
                {chartData.map((_, i) => (
                  <Cell key={i} fill={barColors[i]} />
                ))}
              </Bar>
              <Area
                yAxisId="latency"
                type="monotone"
                dataKey="latency"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="#06b6d4"
                fillOpacity={0.1}
                name="Latency (ms)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CollapsibleSection>
      )}

      {/* ---- Section 5: Estimated Token Waste ---- */}
      {tw && tw.estimated_retry_tokens > 0 && (
        <CollapsibleSection
          title="Est. Token Waste"
          icon={Repeat}
          defaultOpen={false}
          badge={`~${tw.waste_pct}%`}
        >
          <div className="mb-2 text-[10px] text-slate-400 dark:text-slate-500 italic">
            Based on queries exceeding p95 latency. Actual retries may differ.
          </div>
          {/* Productive vs estimated waste bar */}
          <div className="mb-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full bg-cyan-500"
                style={{ width: `${Math.max(100 - tw.waste_pct, 1)}%` }}
                title={`Productive: ${tw.total_productive_tokens.toLocaleString()} tokens`}
              />
              <div
                className="h-full bg-red-500"
                style={{ width: `${Math.max(tw.waste_pct, 1)}%` }}
                title={`Est. wasted: ~${tw.estimated_retry_tokens.toLocaleString()} tokens`}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" />Productive</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Est. waste (~{tw.waste_pct}%)</span>
            </div>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <UserImpactCard
              label="Slow Queries"
              value={`${tw.suspected_slow_queries}`}
              tooltip="Queries exceeding p95 latency — may indicate retries, throttling, or transient issues"
            />
            <UserImpactCard
              label="Est. Tokens Re-sent"
              value={`~${tw.estimated_retry_tokens.toLocaleString()}`}
              tooltip="Upper-bound estimate of tokens re-sent if all slow queries were retries"
            />
            <UserImpactCard
              label="Est. Retry Cost"
              value={`~$${tw.estimated_retry_cost_usd.toFixed(4)}`}
              tooltip="Upper-bound cost estimate if all slow queries were retries (actual may be lower)"
            />
          </div>
        </CollapsibleSection>
      )}

      {/* ---- Section 6: Bottleneck Analysis ---- */}
      {bottleneckData && bottleneckData.length > 0 && (
        <CollapsibleSection title="Bottleneck Analysis" icon={Target} defaultOpen>
          <div className="space-y-1.5">
            {bottleneckData.map((hop, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-[11px] ${hop.isBottleneck ? 'bg-red-50/60 dark:bg-red-950/20 rounded-md px-1.5 py-1' : ''}`}
                title={`${hop.ip}${hop.network ? ` · ${hop.network}` : ''} — ${hop.latency.toFixed(1)}ms`}
              >
                <span className="w-5 text-right text-slate-400 font-mono text-[10px] shrink-0">{hop.hopNumber}</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${hop.isBottleneck ? 'bg-red-500' : 'bg-cyan-500'}`}
                    style={{ width: `${Math.max(hop.pct, 2)}%` }}
                  />
                </div>
                <span className={`w-10 text-right font-mono font-medium ${hop.isBottleneck ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                  {hop.pct.toFixed(0)}%
                </span>
                <span className="w-14 text-right font-mono text-slate-500 text-[10px]">{hop.latency.toFixed(1)}ms</span>
              </div>
            ))}
          </div>
          {bottleneckData.some(h => h.isBottleneck) && (
            <div className="mt-2 text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              Hop {bottleneckData.find(h => h.isBottleneck)?.hopNumber} ({bottleneckData.find(h => h.isBottleneck)?.ip}) is the primary bottleneck at {bottleneckData.find(h => h.isBottleneck)?.pct.toFixed(0)}% of path latency
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Insight */}
      {insight && (
        <div className="px-5 py-3 border-t border-slate-200/50 dark:border-slate-700/30">
          <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed">
            <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />
            {insight}
          </p>
        </div>
      )}

      {/* Per-Location Path Breakdown */}
      {locationBreakdown && locationBreakdown.length > 0 && (
        <CollapsibleSection title="Path by Location" icon={Clock} defaultOpen>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-200 dark:border-slate-700">
                  <th className="pr-3 pb-1.5 font-semibold">Location</th>
                  <th className="pr-3 pb-1.5 font-semibold text-right">Path Latency</th>
                  <th className="pr-3 pb-1.5 font-semibold text-right">Hops</th>
                  <th className="pb-1.5 font-semibold text-right">Path Health</th>
                </tr>
              </thead>
              <tbody>
                {locationBreakdown.map((row, i) => {
                  const healthColor = row.health === 'Degraded' ? 'text-red-500' : row.health === 'Elevated' ? 'text-amber-500' : 'text-emerald-500';
                  const rowBg = row.health === 'Degraded' ? 'bg-red-50/50 dark:bg-red-950/10' : row.health === 'Elevated' ? 'bg-amber-50/50 dark:bg-amber-950/10' : '';
                  return (
                    <tr key={i} className={`border-t border-slate-100 dark:border-slate-700/50 ${rowBg}`}>
                      <td className="pr-3 py-1.5 text-slate-700 dark:text-slate-300 font-medium">{row.location}</td>
                      <td className={`pr-3 py-1.5 text-right font-mono font-semibold ${row.latency > 100 ? 'text-red-500' : row.latency > 50 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-400'}`}>
                        {row.latency.toFixed(0)}ms
                      </td>
                      <td className="pr-3 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400">{row.hops}</td>
                      <td className={`py-1.5 text-right font-medium ${healthColor}`}>{row.health}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
});

// Keep backward-compatible export name
export const CostPathCorrelation = NetworkImpactPanel;
