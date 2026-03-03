'use client';

import { useState, useMemo, memo, useCallback, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  AlertTriangle,
  Activity,
  Clock,
  Zap,
  Globe,
  Wifi,
  MapPin,
  Server,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Network,
  ChevronRight,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import type { TopologyNode, TopologyLink, PathHop } from '@/components/thousandeyes/types';
import { ZONE_CONFIG, classifyZone, getLinkHealth, extractAsNumber, latencyColor } from '@/components/thousandeyes/types';
import { PathDiagnosticHeader } from '@/components/thousandeyes/PathDiagnosticHeader';
import { NetworkPathFlow } from '@/components/thousandeyes/NetworkPathFlow';
import { LatencyWaterfallChart } from '@/components/thousandeyes/LatencyWaterfallChart';
import { AIEndpointSetup } from '@/components/thousandeyes/AIEndpointSetup';
import { NetworkImpactPanel } from './CostPathCorrelation';
import {
  useAIPathJourney,
  type PathAgentTrace,
} from './hooks/useAIPathJourney';
import { RecentAITraces } from './RecentAITraces';
import { AIQualitySection } from '@/components/ai-journey/AIQualitySection';
import type { TimeRange } from '@/types/visualization';

// ============================================================================
// AI Journey Sub-Views
// ============================================================================

type AIJourneySubView = 'network' | 'cost' | 'queries';

const AI_JOURNEY_TABS: { id: AIJourneySubView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'network', label: 'Network Health', icon: Activity },
  { id: 'cost', label: 'Cost & Impact', icon: DollarSign },
  { id: 'queries', label: 'Recent AI Queries', icon: Brain },
];

// ============================================================================
// Metric Card (provider-level summary)
// ============================================================================

function MetricCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <div className="flex-1 min-w-[130px] p-3 rounded-lg bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-slate-900 dark:text-white">{value}</span>
        {trend && (
          trend === 'up'
            ? <TrendingUp className="w-3 h-3 text-red-500" />
            : <TrendingDown className="w-3 h-3 text-emerald-500" />
        )}
      </div>
      {sub && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ============================================================================
// Stat Card (path summary)
// ============================================================================

function StatCard({ icon, label, value, sub, valueClass }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-700/30 p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{label}</div>
        <div className={`text-sm font-mono font-bold ${valueClass || 'text-slate-800 dark:text-slate-200'}`}>
          {value}
          {sub && <span className="text-[9px] text-slate-400 ml-1 font-normal">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Agent Trace Selector
// ============================================================================

const AgentTraceSelector = memo(({ traces, selectedIdx, onSelect }: {
  traces: PathAgentTrace[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) => {
  if (traces.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30">
      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agent Trace:</span>
      {traces.map((trace, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(idx)}
          className={`px-2 py-1 text-[10px] rounded-md transition-all ${
            idx === selectedIdx
              ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/30 border border-transparent'
          }`}
        >
          {trace.agentName} ({trace.hops.length} hops)
        </button>
      ))}
    </div>
  );
});
AgentTraceSelector.displayName = 'AgentTraceSelector';

// ============================================================================
// Hop Detail Table — expandable rows with enriched per-hop data
// ============================================================================

function HopExpandedDetail({ hop, index, totalHops, cumulativeLatency, prevLatency, maxLatency }: {
  hop: PathHop;
  index: number;
  totalHops: number;
  cumulativeLatency: number;
  prevLatency: number;
  maxLatency: number;
}) {
  const zone = classifyZone(hop, index, totalHops);
  const zoneCfg = ZONE_CONFIG[zone];
  const asn = extractAsNumber(hop.network);
  const deltaLatency = hop.latency - prevLatency;
  const networkName = hop.network ? hop.network.replace(/AS\s*\d+\s*/i, '').trim() : null;
  const latencyPct = maxLatency > 0 ? (hop.latency / maxLatency) * 100 : 0;
  const isBottleneck = hop.latency === maxLatency && maxLatency > 50;
  const health = hop.loss > 5 ? 'critical' : hop.loss > 1 ? 'warning' : hop.latency > 100 ? 'warning' : 'healthy';

  return (
    <div className="grid grid-cols-12 gap-3 py-3 px-2 text-[10px]">
      {/* Left: Identity & Network */}
      <div className="col-span-4 space-y-2">
        <div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Identity</div>
          <div className="space-y-0.5">
            {hop.hostname && hop.hostname !== hop.ipAddress && (
              <div className="font-mono text-slate-700 dark:text-slate-300">{hop.hostname}</div>
            )}
            <div className="font-mono text-slate-500 dark:text-slate-400">{hop.ipAddress}</div>
            {hop.prefix && <div className="font-mono text-slate-400 dark:text-slate-500">CIDR: {hop.prefix}</div>}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Network</div>
          <div className="space-y-0.5">
            {asn && <div className="text-cyan-600 dark:text-cyan-400 font-mono font-medium">AS{asn}</div>}
            {networkName && <div className="text-slate-600 dark:text-slate-300">{networkName}</div>}
            {!asn && !networkName && <div className="text-slate-400 italic">Unknown network</div>}
          </div>
        </div>
      </div>

      {/* Center: Latency Analysis */}
      <div className="col-span-4 space-y-2">
        <div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Latency Breakdown</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">This hop</span>
              <span className={`font-mono font-semibold ${hop.latency > 100 ? 'text-red-500' : hop.latency > 50 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>
                {hop.latency.toFixed(1)}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Delta from prev</span>
              <span className={`font-mono font-medium ${deltaLatency > 50 ? 'text-red-500' : deltaLatency > 20 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-400'}`}>
                {index > 0 ? `${deltaLatency >= 0 ? '+' : ''}${deltaLatency.toFixed(1)}ms` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Cumulative</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">{cumulativeLatency.toFixed(1)}ms</span>
            </div>
            {/* Latency bar */}
            <div className="mt-1">
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isBottleneck ? 'bg-red-500' : hop.latency > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.max(latencyPct, 2)}%` }}
                />
              </div>
              <div className="flex justify-between mt-0.5 text-[8px] text-slate-400">
                <span>0ms</span>
                <span>{maxLatency.toFixed(0)}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Health & Classification */}
      <div className="col-span-4 space-y-2">
        <div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Health & Classification</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${health === 'critical' ? 'bg-red-500 animate-pulse' : health === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className={`font-medium capitalize ${health === 'critical' ? 'text-red-600 dark:text-red-400' : health === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {health}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Zone</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: zoneCfg?.dotColorHex || '#94a3b8' }} />
                <span className={zoneCfg?.color || ''}>{zoneCfg?.label || zone}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Packet Loss</span>
              <span className={`font-mono font-medium ${hop.loss > 1 ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                {hop.loss > 0 ? `${hop.loss.toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Position</span>
              <span className="text-slate-600 dark:text-slate-400">Hop {index + 1} of {totalHops}</span>
            </div>
            {isBottleneck && (
              <div className="mt-1 px-2 py-1 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 text-[9px] font-medium">
                Bottleneck — highest latency on this path
              </div>
            )}
            {deltaLatency > 50 && !isBottleneck && (
              <div className="mt-1 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 text-[9px] font-medium">
                Large hop delta — +{deltaLatency.toFixed(0)}ms from previous
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const HopDetailTable = memo(({ hops }: { hops: PathHop[] }) => {
  const [expandedHop, setExpandedHop] = useState<number | null>(null);

  const maxLatency = useMemo(() => Math.max(...hops.map(h => h.latency), 0), [hops]);
  const cumulativeLatencies = useMemo(() => {
    let sum = 0;
    return hops.map(h => { sum += h.latency; return sum; });
  }, [hops]);

  return (
    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm z-10">
          <tr className="text-slate-400 text-left border-b border-slate-200 dark:border-slate-700">
            <th className="w-5 pb-2" />
            <th className="pr-2 pb-2 font-semibold">#</th>
            <th className="pr-2 pb-2 font-semibold">IP / Host</th>
            <th className="pr-2 pb-2 font-semibold">AS#</th>
            <th className="pr-2 pb-2 font-semibold">Network</th>
            <th className="pr-2 pb-2 font-semibold">Zone</th>
            <th className="pr-2 pb-2 text-right font-semibold">Latency</th>
            <th className="pr-2 pb-2 text-right font-semibold">Delta</th>
            <th className="pb-2 text-right font-semibold">Loss</th>
          </tr>
        </thead>
        <tbody>
          {hops.map((hop, i) => {
            const zone = classifyZone(hop, i, hops.length);
            const zoneCfg = ZONE_CONFIG[zone];
            const asn = extractAsNumber(hop.network);
            const latClass = hop.latency > 100 ? 'text-red-500' : hop.latency > 50 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-400';
            const isExpanded = expandedHop === i;
            const prevLatency = i > 0 ? hops[i - 1].latency : 0;
            const delta = hop.latency - prevLatency;
            const isBottleneck = hop.latency === maxLatency && maxLatency > 50;
            const latencyPct = maxLatency > 0 ? (hop.latency / maxLatency) * 100 : 0;

            return (
              <Fragment key={i}>
                <tr
                  onClick={() => setExpandedHop(isExpanded ? null : i)}
                  className={`border-t border-slate-100 dark:border-slate-700/50 cursor-pointer transition-colors ${
                    isExpanded
                      ? 'bg-cyan-50/60 dark:bg-cyan-950/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/20'
                  } ${isBottleneck ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}
                >
                  <td className="py-1.5 pl-1">
                    <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                  </td>
                  <td className="pr-2 py-1.5 text-slate-400 font-mono">{hop.hopNumber}</td>
                  <td className="pr-2 py-1.5">
                    <div className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[180px]" title={`${hop.hostname || ''} (${hop.ipAddress})`}>
                      {hop.hostname || hop.ipAddress}
                    </div>
                    {hop.hostname && hop.hostname !== hop.ipAddress && (
                      <div className="text-[9px] font-mono text-slate-400">{hop.ipAddress}</div>
                    )}
                  </td>
                  <td className="pr-2 py-1.5 text-cyan-600 dark:text-cyan-400 font-mono">{asn ? `AS${asn}` : '—'}</td>
                  <td className="pr-2 py-1.5 text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                    {hop.network ? hop.network.replace(/AS\s*\d+\s*/i, '').trim() || '—' : '—'}
                  </td>
                  <td className="pr-2 py-1.5">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: zoneCfg?.dotColorHex || '#94a3b8' }} />
                      <span className={zoneCfg?.color || ''}>{zoneCfg?.label || zone}</span>
                    </span>
                  </td>
                  <td className="pr-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Mini latency bar */}
                      <div className="w-12 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full rounded-full ${isBottleneck ? 'bg-red-500' : hop.latency > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.max(latencyPct, 3)}%` }}
                        />
                      </div>
                      <span className={`font-mono font-semibold ${latClass}`}>{hop.latency.toFixed(1)}ms</span>
                    </div>
                  </td>
                  <td className={`pr-2 py-1.5 text-right font-mono ${delta > 50 ? 'text-red-500 font-semibold' : delta > 20 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {i > 0 ? `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}` : '—'}
                  </td>
                  <td className={`py-1.5 text-right font-mono ${hop.loss > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                    {hop.loss > 0 ? `${hop.loss.toFixed(1)}%` : '—'}
                  </td>
                </tr>
                {/* Expanded detail row */}
                {isExpanded && (
                  <tr>
                    <td colSpan={9} className="border-t border-cyan-200/50 dark:border-cyan-800/30 bg-cyan-50/30 dark:bg-cyan-950/10">
                      <HopExpandedDetail
                        hop={hop}
                        index={i}
                        totalHops={hops.length}
                        cumulativeLatency={cumulativeLatencies[i]}
                        prevLatency={prevLatency}
                        maxLatency={maxLatency}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
HopDetailTable.displayName = 'HopDetailTable';

// ============================================================================
// Main View
// ============================================================================

export function AIPathJourneyView() {
  const journey = useAIPathJourney();
  const {
    providers, selectedProvider, setSelectedProvider,
    pathNodes, pathHops, agentTraces, selectedTraceIdx, selectTrace,
    metrics, costAnalysis, testResults, currentTestId,
    loading, error, refreshProviders,
    createTest, deleteTest,
    setupOpen, setSetupOpen,
  } = journey;

  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [subView, setSubView] = useState<AIJourneySubView>('network');
  const router = useRouter();

  // AI analysis — builds structured payload and navigates to chat with context card
  const analyzePath = useCallback(() => {
    if (pathHops.length === 0) return;

    const providerName = providers.find(p => p.provider === selectedProvider)?.display_name || selectedProvider || 'Unknown';

    // Build hop context data (cap at 15 for payload size)
    const hopsToShow = pathHops.slice(0, 15);
    const hopContexts = hopsToShow.map((h, i) => ({
      hopNumber: h.hopNumber,
      ip: h.ipAddress,
      hostname: h.hostname,
      latency: h.latency,
      loss: h.loss,
      zone: classifyZone(h, i, pathHops.length),
      network: h.network,
    }));

    // Bottleneck identification
    const bottleneckIdx = pathHops.reduce((maxIdx, h, i) => h.latency > pathHops[maxIdx].latency ? i : maxIdx, 0);
    const bottleneck = pathHops[bottleneckIdx];
    const bottleneckZone = classifyZone(bottleneck, bottleneckIdx, pathHops.length);

    // Build context for card display
    const pathData = {
      providerName,
      hopCount: pathHops.length,
      testId: currentTestId ?? undefined,
      hops: hopContexts,
      bottleneck: {
        hopNumber: bottleneck.hopNumber,
        hostname: bottleneck.hostname,
        ip: bottleneck.ipAddress,
        latency: bottleneck.latency,
        zone: bottleneckZone,
      },
      metrics: metrics ? {
        health: metrics.path_health,
        latency: metrics.path_latency_ms,
        loss: metrics.path_loss_pct,
        availability: metrics.availability_pct,
      } : undefined,
      costImpact: costAnalysis?.latency_cost_impact ? {
        excessLatency: costAnalysis.latency_cost_impact.excess_latency_ms,
        totalExcessWaitS: costAnalysis.latency_cost_impact.total_excess_wait_s,
      } : undefined,
    };

    // Build AI-facing message with full hop details
    const hopDetails = hopsToShow.map((_h, i) => {
      const ctx = hopContexts[i];
      const net = ctx.network ? `, network=${ctx.network}` : '';
      return `Hop ${ctx.hopNumber}: ${ctx.hostname || ctx.ip} (${ctx.latency.toFixed(0)}ms, ${ctx.loss.toFixed(1)}% loss, zone=${ctx.zone}${net})`;
    }).join('. ');
    const hopSuffix = pathHops.length > 15 ? ` (showing 15 of ${pathHops.length} hops)` : '';

    let metricsInfo = '';
    if (metrics) {
      const parts: string[] = [];
      if (metrics.path_health) parts.push(`health=${metrics.path_health}`);
      if (metrics.path_latency_ms != null) parts.push(`latency=${metrics.path_latency_ms.toFixed(0)}ms`);
      if (metrics.path_loss_pct != null) parts.push(`loss=${metrics.path_loss_pct.toFixed(1)}%`);
      if (metrics.availability_pct != null) parts.push(`availability=${metrics.availability_pct.toFixed(1)}%`);
      if (parts.length > 0) metricsInfo = ` Metrics: ${parts.join(', ')}.`;
    }

    let costInfo = '';
    if (costAnalysis?.latency_cost_impact) {
      const impact = costAnalysis.latency_cost_impact;
      const parts: string[] = [];
      if (impact.excess_latency_ms != null) parts.push(`excess_latency=${impact.excess_latency_ms.toFixed(0)}ms`);
      if (impact.total_excess_wait_s != null) parts.push(`total_excess_wait=${impact.total_excess_wait_s.toFixed(1)}s`);
      if (parts.length > 0) costInfo = ` Cost impact: ${parts.join(', ')}.`;
    }

    const aiMessage = `Analyze the ThousandEyes network path for provider "${providerName}" with ${pathHops.length} hops: ${hopDetails}${hopSuffix}. Bottleneck: Hop ${bottleneck.hopNumber} ${bottleneck.hostname || bottleneck.ipAddress} at ${bottleneck.latency.toFixed(0)}ms (zone=${bottleneckZone}).${metricsInfo}${costInfo} Identify the primary bottleneck, explain which zone is causing issues, and recommend specific optimizations. All path data is already provided inline — no need to fetch it again from ThousandEyes.`;

    // Encode payload with both message and context data
    const payload = {
      message: aiMessage,
      context: {
        type: 'path_analysis' as const,
        pathData,
      },
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));

    router.push(`/chat-v2?new_session=true&path_analysis=${encodeURIComponent(encoded)}`);
  }, [pathHops, providers, selectedProvider, metrics, costAnalysis, currentTestId, router]);

  // Convert path nodes to TopologyNode[] for waterfall chart and NetworkPathFlow
  const waterfallNodes: TopologyNode[] = useMemo(() =>
    pathNodes.map(n => ({
      id: n.id,
      label: n.data.hostname || n.data.ipAddress,
      ip: n.data.ipAddress,
      zone: n.data.zone as TopologyNode['zone'],
      latency: n.data.latency,
      loss: n.data.loss,
      network: n.data.network,
      hopNumber: n.data.hopNumber,
    })),
  [pathNodes]);

  // Derive TopologyLink[] from waterfallNodes for NetworkPathFlow
  const topologyLinks: TopologyLink[] = useMemo(() => {
    const links: TopologyLink[] = [];
    for (let i = 0; i < waterfallNodes.length - 1; i++) {
      links.push({
        from: waterfallNodes[i].id,
        to: waterfallNodes[i + 1].id,
        latency: waterfallNodes[i + 1].latency,
        loss: waterfallNodes[i + 1].loss,
        health: getLinkHealth(waterfallNodes[i + 1].latency, waterfallNodes[i + 1].loss),
      });
    }
    return links;
  }, [waterfallNodes]);

  // Compute path summary stats
  const pathStats = useMemo(() => {
    if (pathHops.length === 0) return null;
    const totalLatency = pathHops.reduce((s, h) => s + h.latency, 0);
    const maxLoss = Math.max(...pathHops.map(h => h.loss));
    const bottleneckHop = pathHops.reduce((max, h) => h.latency > max.latency ? h : max, pathHops[0]);
    const lossHops = pathHops.filter(h => h.loss > 0).length;
    return { totalLatency, maxLoss, bottleneckHop, lossHops, hopCount: pathHops.length };
  }, [pathHops]);

  // Latency trend data from test results
  const trendData = useMemo(() => {
    if (!Array.isArray(testResults) || testResults.length === 0) return [];
    return testResults.slice(-48).map((r: Record<string, unknown>) => ({
      time: typeof r.date === 'string' ? r.date.split('T')[1]?.slice(0, 5) || '' : '',
      latency: typeof r.avgLatency === 'number' ? r.avgLatency : 0,
      responseTime: typeof r.responseTime === 'number' ? r.responseTime : 0,
    }));
  }, [testResults]);

  // Compute baseline for anomaly detection
  const latencyBaseline = useMemo(() => {
    if (trendData.length < 5) return null;
    const latencies = trendData.map(d => d.latency).filter(l => l > 0);
    if (latencies.length === 0) return null;
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    return avg;
  }, [trendData]);

  const healthColor = metrics?.path_health === 'healthy' ? 'text-emerald-500'
    : metrics?.path_health === 'degraded' ? 'text-amber-500'
    : 'text-red-500';

  const healthBg = metrics?.path_health === 'healthy' ? 'bg-emerald-500'
    : metrics?.path_health === 'degraded' ? 'bg-amber-500'
    : 'bg-red-500';

  // ---- Empty state ----
  if (providers.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <AIEndpointSetup
          providers={providers}
          onSelect={setSelectedProvider}
          selectedProvider={selectedProvider}
          onCreate={createTest}
          onDelete={deleteTest}
          open={true}
          onOpenChange={setSetupOpen}
        />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Brain className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">AI Agent Path Intelligence</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-3">
            Visualize how AI traffic traverses your network — from agents to inference providers.
            Existing ThousandEyes tests targeting AI endpoints are auto-discovered, or create new ones above.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md">
            See hop-by-hop path analysis, latency waterfall, and the cost impact when network degradation
            forces rerouting or causes timeouts on AI inference calls.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider setup / selector bar */}
      <AIEndpointSetup
        providers={providers}
        onSelect={setSelectedProvider}
        selectedProvider={selectedProvider}
        onCreate={createTest}
        onDelete={deleteTest}
        open={setupOpen}
        onOpenChange={setSetupOpen}
      />

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          <span className="ml-2 text-sm text-slate-500">Loading path data...</span>
        </div>
      )}

      {/* Main content — only when provider selected */}
      {selectedProvider && !loading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedProvider}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${healthBg}`} />
                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
                  {providers.find(p => p.provider === selectedProvider)?.display_name || selectedProvider}
                </span>
                <span className={`text-[12px] font-medium ${healthColor}`}>
                  {metrics?.path_health || 'unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
                Auto-refresh 60s
                <button onClick={refreshProviders} className="p-1 hover:text-cyan-500 transition">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Sub-view navigation */}
            <div className="bg-slate-100 dark:bg-slate-800/40 rounded-lg p-1 inline-flex gap-1">
              {AI_JOURNEY_TABS.map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSubView(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      subView === tab.id
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* NETWORK HEALTH View                                */}
            {/* ═══════════════════════════════════════════════════ */}
            {subView === 'network' && (
              <div className="space-y-6">
                {/* Metric cards row */}
                {metrics && (
                  <div className="flex gap-3 flex-wrap">
                    <MetricCard
                      label="Path Latency"
                      value={`${metrics.path_latency_ms.toFixed(0)}ms`}
                      icon={Zap}
                      color="text-amber-500"
                      trend={metrics.path_latency_ms > 100 ? 'up' : null}
                    />
                    <MetricCard
                      label="Packet Loss"
                      value={`${metrics.path_loss_pct.toFixed(1)}%`}
                      icon={AlertTriangle}
                      color={metrics.path_loss_pct > 1 ? 'text-red-500' : 'text-emerald-500'}
                      trend={metrics.path_loss_pct > 1 ? 'up' : null}
                    />
                    <MetricCard
                      label="Response Time"
                      value={`${metrics.avg_response_time_ms.toFixed(0)}ms`}
                      icon={Activity}
                      color="text-blue-500"
                    />
                    <MetricCard
                      label="Availability"
                      value={`${metrics.availability_pct.toFixed(1)}%`}
                      icon={ShieldCheck}
                      color={metrics.availability_pct >= 99.5 ? 'text-emerald-500' : 'text-amber-500'}
                    />
                  </div>
                )}

                {/* Path Diagnostic Header */}
                {waterfallNodes.length > 0 && (
                  <PathDiagnosticHeader nodes={waterfallNodes} />
                )}

                {/* 2-column grid: left = path flow + hop table, right = waterfall + stats + agent selector */}
                {waterfallNodes.length > 0 && (
                  <div className="grid grid-cols-12 gap-4">
                    {/* Left column — 7/12 */}
                    <div className="col-span-12 lg:col-span-7 space-y-4">
                      {/* Network Path Flow (SVG) */}
                      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Image src="/te-logo.png" alt="ThousandEyes" width={18} height={18} />
                            <span className="text-[12px] font-semibold text-slate-900 dark:text-white">Network Path</span>
                            <span className="text-[10px] text-slate-400">{waterfallNodes.length} hops</span>
                          </div>
                          <div className="hidden sm:flex items-center gap-3">
                            {(['source', 'local', 'isp', 'cloud', 'destination'] as const).map(zone => {
                              const cfg = ZONE_CONFIG[zone];
                              return (
                                <div key={zone} className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dotColorHex }} />
                                  <span className="text-[9px] text-slate-500 dark:text-slate-400">{cfg.label}</span>
                                </div>
                              );
                            })}
                            <button
                              onClick={analyzePath}
                              disabled={pathHops.length === 0}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Analyze Path
                            </button>
                          </div>
                        </div>
                        <div className="p-3">
                          <NetworkPathFlow nodes={waterfallNodes} links={topologyLinks} />
                        </div>
                      </div>

                      {/* Hop Detail Table */}
                      {pathHops.length > 0 && (
                        <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
                          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                            <Server className="w-3.5 h-3.5 text-slate-400" />
                            Hop Detail
                          </h3>
                          <HopDetailTable hops={pathHops} />
                        </div>
                      )}
                    </div>

                    {/* Right column — 5/12 */}
                    <div className="col-span-12 lg:col-span-5 space-y-4">
                      {/* Latency Waterfall */}
                      {waterfallNodes.length > 1 && (
                        <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
                          <div className="px-4 py-2.5 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[12px] font-semibold text-slate-900 dark:text-white">Latency Waterfall</span>
                          </div>
                          <div className="p-3">
                            <LatencyWaterfallChart nodes={waterfallNodes} />
                          </div>
                        </div>
                      )}

                      {/* Summary Stat Cards */}
                      {pathStats && (
                        <div className="grid grid-cols-2 gap-3">
                          <StatCard
                            icon={<Activity className="w-4 h-4 text-cyan-500" />}
                            label="Total Hops"
                            value={`${pathStats.hopCount}`}
                          />
                          <StatCard
                            icon={<MapPin className="w-4 h-4 text-emerald-500" />}
                            label="Total Latency"
                            value={`${pathStats.totalLatency.toFixed(0)}ms`}
                            valueClass={latencyColor(pathStats.totalLatency)}
                          />
                          <StatCard
                            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                            label="Peak Hop Latency"
                            value={`${pathStats.bottleneckHop.latency.toFixed(0)}ms`}
                            sub={`Hop #${pathStats.bottleneckHop.hopNumber}`}
                            valueClass={latencyColor(pathStats.bottleneckHop.latency)}
                          />
                          <StatCard
                            icon={<Wifi className="w-4 h-4 text-red-500" />}
                            label="Max Loss"
                            value={pathStats.maxLoss > 0 ? `${pathStats.maxLoss.toFixed(1)}%` : '0%'}
                            sub={pathStats.lossHops > 0 ? `${pathStats.lossHops} hops affected` : undefined}
                            valueClass={pathStats.maxLoss > 1 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}
                          />
                        </div>
                      )}

                      {/* Agent Trace Selector */}
                      {agentTraces.length > 1 && (
                        <AgentTraceSelector traces={agentTraces} selectedIdx={selectedTraceIdx} onSelect={selectTrace} />
                      )}
                    </div>
                  </div>
                )}

                {/* Latency Trend — full width */}
                {trendData.length > 2 && (
                  <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <span className="text-[13px] font-semibold text-slate-900 dark:text-white">Latency Trend</span>
                      <span className="text-[11px] text-slate-400 ml-auto mr-2">Network latency + API response time</span>
                      <div className="flex gap-1">
                        {(['1h', '6h', '24h', '7d'] as TimeRange[]).map(tr => (
                          <button
                            key={tr}
                            onClick={() => setTimeRange(tr)}
                            className={`px-2 py-0.5 text-[10px] rounded transition ${
                              timeRange === tr
                                ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent'
                            }`}
                          >
                            {tr}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                          <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <Tooltip
                            contentStyle={{
                              background: 'rgba(15,23,42,0.9)',
                              border: '1px solid rgba(148,163,184,0.2)',
                              borderRadius: 8,
                              fontSize: 12,
                              color: '#e2e8f0',
                            }}
                          />
                          {/* Anomaly threshold line */}
                          {latencyBaseline && (
                            <ReferenceLine
                              y={latencyBaseline * 2}
                              stroke="#ef4444"
                              strokeDasharray="6 3"
                              strokeOpacity={0.5}
                              label={{ value: 'Anomaly', position: 'right', fontSize: 9, fill: '#ef4444' }}
                            />
                          )}
                          <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 2" strokeOpacity={0.3} />
                          <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.3} />
                          <Area
                            type="monotone"
                            dataKey="latency"
                            fill="#06b6d4"
                            fillOpacity={0.15}
                            stroke="#06b6d4"
                            strokeWidth={2}
                            name="Network Latency (ms)"
                          />
                          <Line
                            type="monotone"
                            dataKey="responseTime"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                            name="API Response (ms)"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* No path data fallback */}
                {pathNodes.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-slate-200/60 dark:border-slate-700/40">
                    <Globe className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Waiting for path data</h4>
                    <p className="text-[12px] text-slate-400 dark:text-slate-500 max-w-md">
                      New tests may take 5-10 minutes to produce results. Auto-discovered tests require an agent-to-server type for path visualization.
                    </p>
                  </div>
                )}

                {/* AI Response Quality (contextually belongs with network health) */}
                <AIQualitySection provider={selectedProvider} />
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* COST & IMPACT View                                 */}
            {/* ═══════════════════════════════════════════════════ */}
            {subView === 'cost' && (
              <div className="space-y-6">
                {costAnalysis && <NetworkImpactPanel data={costAnalysis} agentTraces={agentTraces} />}
                {!costAnalysis && metrics && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard
                        icon={<Zap className="w-4 h-4 text-amber-500" />}
                        label="Path Latency"
                        value={`${metrics.path_latency_ms.toFixed(0)}ms`}
                        valueClass={metrics.path_latency_ms > 100 ? 'text-red-500' : metrics.path_latency_ms > 50 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}
                      />
                      <StatCard
                        icon={<Activity className="w-4 h-4 text-blue-500" />}
                        label="Response Time"
                        value={`${metrics.avg_response_time_ms.toFixed(0)}ms`}
                      />
                      <StatCard
                        icon={<Wifi className="w-4 h-4 text-emerald-500" />}
                        label="Path Health"
                        value={metrics.path_health || 'unknown'}
                        valueClass={metrics.path_health === 'healthy' ? 'text-emerald-600 dark:text-emerald-400' : metrics.path_health === 'degraded' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
                      />
                      <StatCard
                        icon={<ShieldCheck className="w-4 h-4 text-cyan-500" />}
                        label="Availability"
                        value={`${metrics.availability_pct.toFixed(1)}%`}
                        valueClass={metrics.availability_pct >= 99.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                      Detailed per-query impact analysis appears after AI queries are logged.
                    </p>
                  </div>
                )}
                {!costAnalysis && !metrics && (
                  <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-slate-200/60 dark:border-slate-700/40">
                    <DollarSign className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">No cost data yet</h4>
                    <p className="text-[12px] text-slate-400 dark:text-slate-500 max-w-md">
                      Cost and impact analysis will appear once AI queries are processed and traced.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* RECENT AI QUERIES View                             */}
            {/* ═══════════════════════════════════════════════════ */}
            {subView === 'queries' && (
              <RecentAITraces provider={selectedProvider} />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* No provider selected fallback */}
      {!selectedProvider && providers.length > 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Brain className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Select a provider above to view its network journey</p>
        </div>
      )}

      {/* Recent AI Queries always visible when no provider selected (standalone data) */}
      {!selectedProvider && (
        <RecentAITraces provider={null} />
      )}
    </div>
  );
}
