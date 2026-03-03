'use client';

import { memo, useMemo, useState, useRef, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Globe,
  Clock,
  Zap,
  AlertTriangle,
  ChevronRight,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import type { MCPNetworkHealth as MCPNetworkHealthData } from '@/types/mcp-monitor';
import type { TopologyNode, TopologyLink, PathHop } from '@/components/thousandeyes/types';
import { classifyZone, getLinkHealth, extractAsNumber, ZONE_CONFIG, latencyColor } from '@/components/thousandeyes/types';
import { NetworkPathFlow } from '@/components/thousandeyes/NetworkPathFlow';
import { LatencyWaterfallChart } from '@/components/thousandeyes/LatencyWaterfallChart';
import { PathDiagnosticHeader } from '@/components/thousandeyes/PathDiagnosticHeader';

// ============================================================================
// Data Transformation — TE path-vis response → TopologyNode[] + TopologyLink[]
// ============================================================================

function parsePathVisualization(pathVis: unknown): { nodes: TopologyNode[]; links: TopologyLink[]; hops: PathHop[] } {
  const empty = { nodes: [], links: [], hops: [] };
  if (!pathVis || typeof pathVis !== 'object') return empty;

  const data = pathVis as Record<string, unknown>;
  let results: unknown[] = [];

  // Handle multiple TE response formats
  if (Array.isArray(data.results)) {
    results = data.results;
  } else if (data._embedded && typeof data._embedded === 'object') {
    const embedded = data._embedded as Record<string, unknown>;
    if (Array.isArray(embedded.results)) results = embedded.results;
  }

  if (results.length === 0) return empty;

  // Extract hops from the first result's pathTraces (v7) or routes (legacy)
  const firstResult = results[0] as Record<string, unknown>;
  let rawHops: unknown[] = [];

  const pathTraces = firstResult.pathTraces as unknown[];
  if (Array.isArray(pathTraces) && pathTraces.length > 0) {
    const firstTrace = pathTraces[0] as Record<string, unknown>;
    rawHops = (firstTrace.hops as unknown[]) || [];
  }

  // Fallback to routes format
  if (rawHops.length === 0) {
    const routes = firstResult.routes as unknown[];
    if (Array.isArray(routes)) {
      for (const route of routes) {
        const r = route as Record<string, unknown>;
        if (Array.isArray(r.hops) && r.hops.length > rawHops.length) {
          rawHops = r.hops as unknown[];
        }
      }
    }
  }

  if (rawHops.length === 0) return empty;

  // Normalize raw hops → PathHop[]
  const hops: PathHop[] = rawHops.map((h, idx) => {
    const hop = h as Record<string, unknown>;
    return {
      hopNumber: (hop.hop as number) || idx + 1,
      ipAddress: (hop.ipAddress as string) || (hop.ip as string) || 'N/A',
      hostname: (hop.rdns as string) || (hop.hostname as string) || (hop.prefix as string),
      latency: Number(hop.responseTime || hop.delay || hop.latency) || 0,
      loss: Number(hop.loss) || 0,
      prefix: hop.prefix as string | undefined,
      network: hop.network as string | undefined,
    };
  });

  // Build topology nodes
  const totalHops = hops.length;
  const nodes: TopologyNode[] = hops.map((hop, i) => ({
    id: `hop-${i}`,
    label: hop.hostname || hop.ipAddress,
    ip: hop.ipAddress,
    zone: classifyZone(hop, i, totalHops),
    latency: hop.latency,
    loss: hop.loss,
    network: hop.network,
    hopNumber: hop.hopNumber,
    prefix: hop.prefix,
    asNumber: extractAsNumber(hop.network),
  }));

  // Build topology links
  const links: TopologyLink[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    links.push({
      from: nodes[i].id,
      to: nodes[i + 1].id,
      latency: nodes[i + 1].latency,
      loss: nodes[i + 1].loss,
      health: getLinkHealth(nodes[i + 1].latency, nodes[i + 1].loss),
    });
  }

  return { nodes, links, hops };
}

// ============================================================================
// Metric Card
// ============================================================================

function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  unit?: string;
  status?: 'good' | 'warn' | 'bad';
}) {
  const statusColor = status === 'bad'
    ? 'text-red-500'
    : status === 'warn'
    ? 'text-amber-500'
    : 'text-emerald-500 dark:text-emerald-400';

  return (
    <div className="rounded-lg border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-bold ${statusColor}`}>{value}</span>
        {unit && <span className="text-[10px] text-slate-400 dark:text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

// ============================================================================
// Hop Expanded Detail — enriched per-hop breakdown (matches AI Journey)
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

// ============================================================================
// Hop Detail Table — expandable rows with enriched per-hop data
// ============================================================================

const HopDetailTable = memo(({ hops }: { hops: PathHop[] }) => {
  const [expandedHop, setExpandedHop] = useState<number | null>(null);

  const maxLatency = useMemo(() => Math.max(...hops.map(h => h.latency), 0), [hops]);
  const cumulativeLatencies = useMemo(() => {
    let sum = 0;
    return hops.map(h => { sum += h.latency; return sum; });
  }, [hops]);

  return (
    <div className="rounded-lg border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200/60 dark:border-slate-700/40 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Hop-by-Hop Path Analysis
        </h4>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{hops.length} hops</span>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm z-10">
            <tr className="text-slate-400 text-left border-b border-slate-200 dark:border-slate-700">
              <th className="w-5 pb-2 pl-2" />
              <th className="pr-2 pb-2 font-semibold">#</th>
              <th className="pr-2 pb-2 font-semibold">IP / Host</th>
              <th className="pr-2 pb-2 font-semibold">AS#</th>
              <th className="pr-2 pb-2 font-semibold">Network</th>
              <th className="pr-2 pb-2 font-semibold">Zone</th>
              <th className="pr-2 pb-2 text-right font-semibold">Latency</th>
              <th className="pr-2 pb-2 text-right font-semibold">Delta</th>
              <th className="pb-2 pr-2 text-right font-semibold">Loss</th>
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
                    <td className="py-1.5 pl-2">
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
                    <td className={`py-1.5 pr-2 text-right font-mono ${hop.loss > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
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
    </div>
  );
});
HopDetailTable.displayName = 'HopDetailTable';

// ============================================================================
// MCPNetworkHealth — Main Component
// ============================================================================

export interface MCPNetworkHealthProps {
  data: MCPNetworkHealthData | null;
  loading?: boolean;
  serverName?: string;
}

export const MCPNetworkHealth = memo(({ data, loading, serverName }: MCPNetworkHealthProps) => {
  // Keep a reference to the last valid data so background refreshes don't blank the card
  const lastDataRef = useRef<MCPNetworkHealthData | null>(null);
  if (data) {
    lastDataRef.current = data;
  }
  const displayData = data ?? lastDataRef.current;

  const router = useRouter();

  // Parse path visualization data into topology
  const { nodes, links, hops } = useMemo(
    () => (displayData?.path_visualization ? parsePathVisualization(displayData.path_visualization) : { nodes: [], links: [], hops: [] }),
    [displayData?.path_visualization],
  );

  // Analyze Path — builds structured payload and navigates to chat-v2
  const analyzePath = useCallback(() => {
    if (hops.length === 0) return;

    const providerName = serverName || 'MCP Server';
    const totalHops = hops.length;

    const hopContexts = hops.slice(0, 15).map((h, i) => ({
      hopNumber: h.hopNumber,
      ip: h.ipAddress,
      hostname: h.hostname,
      latency: h.latency,
      loss: h.loss,
      zone: classifyZone(h, i, totalHops),
      network: h.network,
    }));

    const bottleneckIdx = hops.reduce((maxIdx, h, i) => h.latency > hops[maxIdx].latency ? i : maxIdx, 0);
    const bottleneck = hops[bottleneckIdx];
    const bottleneckZone = classifyZone(bottleneck, bottleneckIdx, totalHops);

    const metrics = displayData?.metrics;

    const pathData = {
      providerName,
      hopCount: totalHops,
      testId: displayData?.network_test_id,
      hops: hopContexts,
      bottleneck: {
        hopNumber: bottleneck.hopNumber,
        hostname: bottleneck.hostname,
        ip: bottleneck.ipAddress,
        latency: bottleneck.latency,
        zone: bottleneckZone,
      },
      metrics: metrics ? {
        health: metrics.avg_latency_ms > 100 ? 'failing' : metrics.avg_latency_ms > 50 ? 'degraded' : 'healthy',
        latency: metrics.avg_latency_ms,
        loss: metrics.loss_pct,
      } : undefined,
    };

    const hopDetails = hopContexts.map(ctx => {
      const net = ctx.network ? `, network=${ctx.network}` : '';
      return `Hop ${ctx.hopNumber}: ${ctx.hostname || ctx.ip} (${ctx.latency.toFixed(0)}ms, ${ctx.loss.toFixed(1)}% loss, zone=${ctx.zone}${net})`;
    }).join('. ');

    let metricsInfo = '';
    if (metrics) {
      const parts: string[] = [];
      if (metrics.avg_latency_ms != null) parts.push(`latency=${metrics.avg_latency_ms.toFixed(0)}ms`);
      if (metrics.loss_pct != null) parts.push(`loss=${metrics.loss_pct.toFixed(1)}%`);
      if (metrics.response_time_ms != null) parts.push(`response_time=${metrics.response_time_ms.toFixed(0)}ms`);
      if (parts.length > 0) metricsInfo = ` Metrics: ${parts.join(', ')}.`;
    }

    const aiMessage = `Analyze the network path to MCP server "${providerName}" with ${totalHops} hops: ${hopDetails}. Bottleneck: Hop ${bottleneck.hopNumber} ${bottleneck.hostname || bottleneck.ipAddress} at ${bottleneck.latency.toFixed(0)}ms (zone=${bottleneckZone}).${metricsInfo} Identify the primary bottleneck, explain which zone is causing issues, and recommend specific optimizations. All path data is already provided inline — no need to fetch it again from ThousandEyes.`;

    const payload = {
      message: aiMessage,
      context: { type: 'path_analysis' as const, pathData },
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    router.push(`/chat-v2?new_session=true&path_analysis=${encodeURIComponent(encoded)}`);
  }, [hops, displayData?.metrics, displayData?.network_test_id, serverName, router]);

  // No TE tests state
  if (displayData && !displayData.has_te_tests) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-5">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <WifiOff className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
              No network path monitoring
            </p>
            <p className="text-[11px] mt-0.5">
              Path analysis and latency monitoring are available for servers with ThousandEyes endpoint tests configured.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state — show skeleton when loading and no data to display
  if ((loading && !displayData) || (!displayData && !lastDataRef.current)) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4 space-y-3">
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  const metrics = displayData?.metrics ?? null;

  // No data yet (tests created but no results)
  if (!metrics && nodes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-5">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Wifi className="w-5 h-5 flex-shrink-0 animate-pulse text-cyan-500" />
          <div>
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
              Waiting for first test results...
            </p>
            <p className="text-[11px] mt-0.5">
              ThousandEyes tests have been created. Network path data will appear after the first test round completes (2-5 minutes).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-200/60 dark:border-slate-700/40 flex items-center gap-2">
        <Globe className={`w-4 h-4 text-cyan-500 dark:text-cyan-400 ${loading ? 'animate-pulse' : ''}`} />
        <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Network Path Health
        </h3>
        <div className="ml-auto flex items-center gap-2">
          {loading && (
            <span className="text-[9px] text-slate-400 dark:text-slate-500">Refreshing...</span>
          )}
          <button
            onClick={analyzePath}
            disabled={hops.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analyze Path
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Metric Cards */}
        {metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <MetricCard
              icon={Clock}
              label="Latency"
              value={metrics.avg_latency_ms?.toFixed(1) ?? '—'}
              unit="ms"
              status={metrics.avg_latency_ms > 100 ? 'bad' : metrics.avg_latency_ms > 50 ? 'warn' : 'good'}
            />
            <MetricCard
              icon={AlertTriangle}
              label="Packet Loss"
              value={metrics.loss_pct?.toFixed(1) ?? '—'}
              unit="%"
              status={metrics.loss_pct > 5 ? 'bad' : metrics.loss_pct > 1 ? 'warn' : 'good'}
            />
            <MetricCard
              icon={Zap}
              label="Response Time"
              value={metrics.response_time_ms?.toFixed(0) ?? '—'}
              unit="ms"
              status={metrics.response_time_ms > 2000 ? 'bad' : metrics.response_time_ms > 500 ? 'warn' : 'good'}
            />
            <MetricCard
              icon={Activity}
              label="Hops"
              value={metrics.hop_count ?? (nodes.length || '—')}
              status="good"
            />
          </div>
        )}

        {/* Path Diagnostic Header */}
        {nodes.length > 0 && <PathDiagnosticHeader nodes={nodes} />}

        {/* Visualizations: Path Flow + Waterfall (stacked full-width for MCP panel) */}
        {nodes.length > 0 ? (
          <div className="space-y-3">
            <NetworkPathFlow nodes={nodes} links={links} />
            <LatencyWaterfallChart nodes={nodes} />
          </div>
        ) : metrics ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/30 p-4 flex items-center gap-3">
            <Wifi className="w-4 h-4 text-cyan-500 animate-pulse flex-shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                Path visualization collecting...
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Network metrics are available. Hop-by-hop path trace data will appear after the next test round (~2 min).
              </p>
            </div>
          </div>
        ) : null}

        {/* Hop Detail Table */}
        {hops.length > 0 && <HopDetailTable hops={hops} />}
      </div>
    </div>
  );
});

MCPNetworkHealth.displayName = 'MCPNetworkHealth';
export default MCPNetworkHealth;
