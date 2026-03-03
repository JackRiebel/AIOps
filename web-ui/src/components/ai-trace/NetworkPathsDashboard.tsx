'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Globe, Server, Clock, Wifi, AlertTriangle, Activity, Shield, ChevronRight } from 'lucide-react';
import type { AITraceDetail, AITraceSpan, WaterfallBar, NetworkHop } from '@/types/ai-trace';
import type { TEPathHop, TEHttpTiming, TEBGPRoute, TENetworkMetrics } from '@/types/journey-flow';
import { PLATFORM_COLORS } from '@/types/ai-trace';
import { NetworkPathFlow } from '@/components/thousandeyes/NetworkPathFlow';
import { LatencyWaterfallChart } from '@/components/thousandeyes/LatencyWaterfallChart';
import { hopsToTopology, classifyZone, extractAsNumber, extractAsOrg, ZONE_CONFIG, findBottleneck } from './pathUtils';
import { HttpTimingBar } from './journey-nodes/HttpTimingBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeHops(hops: NetworkHop[]): TEPathHop[] {
  return hops.map((h) => ({
    ip: h.ip,
    prefix: h.prefix || '',
    delay: h.delay,
    loss: h.loss || 0,
    network: h.network || '',
    rdns: h.rdns || '',
  }));
}

function findSpanTEEnrichment(trace: AITraceDetail, spanId: number): AITraceSpan['te_enrichment'] | null {
  function search(span: AITraceSpan): AITraceSpan['te_enrichment'] | null {
    if (span.id === spanId) return span.te_enrichment || null;
    for (const child of (span.children || [])) {
      const found = search(child);
      if (found) return found;
    }
    return null;
  }
  return search(trace.root_span);
}

interface PathData {
  bar: WaterfallBar;
  teHops: TEPathHop[];
  httpTiming: TEHttpTiming | null;
  networkMetrics: TENetworkMetrics | null;
  bgpRoutes: TEBGPRoute[];
  teEnrichment: AITraceSpan['te_enrichment'] | null;
  platformColor: string;
  label: string;
  isToolExec: boolean;
  platform: string | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NetworkPathsDashboardProps {
  trace: AITraceDetail;
  waterfall: WaterfallBar[];
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NetworkPathsDashboard({ trace, waterfall }: NetworkPathsDashboardProps) {
  const networkBars = waterfall.filter(
    (b) => (b.span_type === 'llm_call' || b.span_type === 'tool_execution') &&
      (b.server_ip || (b.network_path && b.network_path.length > 0) || b.network_timing)
  );

  // Build path data for each bar
  const paths: PathData[] = useMemo(() => {
    return networkBars.map((bar) => {
      const teEnrichment = trace ? findSpanTEEnrichment(trace, bar.span_id) : null;
      const teHops: TEPathHop[] = teEnrichment?.path_hops?.length
        ? teEnrichment.path_hops
        : bar.network_path?.length
          ? normalizeHops(bar.network_path)
          : [];

      const isToolExec = bar.span_type === 'tool_execution';
      const platform = bar.tool_platform || null;
      const platformColor = platform ? (PLATFORM_COLORS[platform.toLowerCase()] || '#64748b') : '#3b82f6';
      const label = isToolExec ? (bar.tool_name || 'Tool Call') : (bar.span_name || bar.model || 'LLM Call');

      return {
        bar,
        teHops,
        httpTiming: teEnrichment?.http_timing || null,
        networkMetrics: teEnrichment?.network_metrics || null,
        bgpRoutes: teEnrichment?.bgp_routes || [],
        teEnrichment,
        platformColor,
        label,
        isToolExec,
        platform,
      };
    });
  }, [networkBars, trace]);

  const [activeIdx, setActiveIdx] = useState(0);

  if (paths.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        <Globe className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No network path data captured yet.</p>
        <p className="text-xs mt-1">Network timing is captured on the next query.</p>
      </div>
    );
  }

  const active = paths[Math.min(activeIdx, paths.length - 1)];
  const { nodes, links } = hopsToTopology(active.teHops);
  const hasHops = active.teHops.length > 0;
  const bottleneck = findBottleneck(active.teHops);

  return (
    <div className="space-y-4">
      {/* Path Selector Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {paths.map((p, i) => (
          <button
            key={p.bar.span_id}
            onClick={() => setActiveIdx(i)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border whitespace-nowrap transition-all ${
              i === activeIdx
                ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.platformColor }} />
            {p.label}
            {p.platform && (
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: p.platformColor + '20', color: p.platformColor }}>
                {p.platform}
              </span>
            )}
            {p.teHops.length > 0 && (
              <span className="text-[9px] text-gray-400">{p.teHops.length} hops</span>
            )}
            <ChevronRight className="w-3 h-3 text-gray-300" />
          </button>
        ))}
      </div>

      {/* Large SVG Path Visualization */}
      {hasHops ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Image src="/te-logo.png" alt="TE" width={16} height={16} className="opacity-70" />
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
              Network Path · {active.teHops.length} hops
            </span>
            {bottleneck.hasBottleneck && (
              <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                <AlertTriangle className="w-3 h-3" />
                Bottleneck at hop {bottleneck.index + 1} ({bottleneck.delay.toFixed(0)}ms)
              </span>
            )}
            <span className="ml-auto text-[9px] text-gray-400 font-mono">
              {active.bar.server_ip || ''}{active.bar.server_port ? `:${active.bar.server_port}` : ''}
            </span>
          </div>
          <NetworkPathFlow nodes={nodes} links={links} />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <FallbackPath bar={active.bar} />
        </div>
      )}

      {/* Per-Hop Latency Chart (Recharts) */}
      {hasHops && nodes.length > 0 && (
        <LatencyWaterfallChart nodes={nodes} />
      )}

      {/* HTTP Timing + Network Metrics + BGP stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* HTTP Timing */}
        {active.httpTiming && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> HTTP Timing
            </h4>
            <HttpTimingBar timing={active.httpTiming} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <StatCard label="DNS" value={`${active.httpTiming.dnsTime.toFixed(0)}ms`} />
              <StatCard label="Connect" value={`${active.httpTiming.connectTime.toFixed(0)}ms`} />
              <StatCard label="TLS" value={`${active.httpTiming.sslTime.toFixed(0)}ms`} />
              <StatCard label="Wait (TTFB)" value={`${active.httpTiming.waitTime.toFixed(0)}ms`} />
              <StatCard label="Receive" value={`${active.httpTiming.receiveTime.toFixed(0)}ms`} />
              <StatCard label="Total" value={`${active.httpTiming.responseTime.toFixed(0)}ms`} highlight />
            </div>
          </div>
        )}

        {/* Network Metrics */}
        {active.networkMetrics && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Network Metrics
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Latency" value={`${active.networkMetrics.latency.toFixed(0)}ms`} />
              <StatCard label="Loss" value={`${active.networkMetrics.loss.toFixed(1)}%`} warn={active.networkMetrics.loss > 1} />
              <StatCard label="Jitter" value={`${active.networkMetrics.jitter.toFixed(0)}ms`} />
              {active.networkMetrics.bandwidth != null && (
                <StatCard label="Bandwidth" value={`${active.networkMetrics.bandwidth.toFixed(0)} Mbps`} />
              )}
            </div>
          </div>
        )}

        {/* BGP Routes */}
        {active.bgpRoutes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> BGP Routes
            </h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <StatCard label="Prefixes" value={`${active.bgpRoutes.length}`} />
              <StatCard
                label="Reachability"
                value={`${(active.bgpRoutes.reduce((s, r) => s + r.reachability, 0) / active.bgpRoutes.length).toFixed(0)}%`}
                warn={active.bgpRoutes.some(r => r.reachability < 100)}
              />
            </div>
            <div className="space-y-1 max-h-[120px] overflow-y-auto">
              {active.bgpRoutes.map((route, i) => (
                <div key={i} className="flex items-center justify-between text-[9px] text-gray-500 font-mono py-0.5">
                  <span className="text-gray-700 dark:text-gray-300">{route.prefix}</span>
                  <span className={route.reachability < 100 ? 'text-amber-500' : 'text-emerald-500'}>{route.reachability}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fallback TCP/TLS timing when no HTTP timing from TE */}
      {!active.httpTiming && active.bar.network_timing && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Connection Timing</h4>
          <TimingBar timing={active.bar.network_timing} totalMs={active.bar.duration_ms} />
        </div>
      )}

      {/* Hop Detail Table */}
      {hasHops && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Hop Details</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-100 dark:border-gray-700">
                  <th className="pr-3 pb-2 font-medium w-8">#</th>
                  <th className="pr-3 pb-2 font-medium">IP / Hostname</th>
                  <th className="pr-3 pb-2 font-medium">AS#</th>
                  <th className="pr-3 pb-2 font-medium">Network</th>
                  <th className="pr-3 pb-2 font-medium">Zone</th>
                  <th className="pr-3 pb-2 font-medium text-right">Latency</th>
                  <th className="pb-2 font-medium text-right">Loss</th>
                </tr>
              </thead>
              <tbody>
                {active.teHops.map((hop, i) => {
                  const zone = classifyZone(hop, i, active.teHops.length);
                  const zoneCfg = ZONE_CONFIG[zone] || ZONE_CONFIG.isp;
                  const asn = extractAsNumber(hop.network);
                  const latColor = hop.delay > 100 ? 'text-red-500' : hop.delay > 50 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400';
                  const isBottleneckHop = bottleneck.hasBottleneck && i === bottleneck.index;

                  return (
                    <tr key={i} className={`border-t border-gray-50 dark:border-gray-800 ${isBottleneckHop ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                      <td className="pr-3 py-2 text-gray-400 tabular-nums font-mono">{i + 1}</td>
                      <td className="pr-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                        <div className="truncate max-w-[220px]" title={`${hop.rdns || ''} (${hop.ip})`}>
                          {hop.rdns || hop.ip}
                        </div>
                        {hop.rdns && <div className="text-[9px] text-gray-400 font-mono">{hop.ip}</div>}
                      </td>
                      <td className="pr-3 py-2 text-cyan-600 dark:text-cyan-400 font-mono">{asn || '—'}</td>
                      <td className="pr-3 py-2 text-gray-500 truncate max-w-[140px]" title={hop.network}>
                        {extractAsOrg(hop.network) || '—'}
                      </td>
                      <td className="pr-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: zoneCfg.dotColorHex }} />
                          <span className={zoneCfg.color}>{zoneCfg.label}</span>
                        </span>
                      </td>
                      <td className={`pr-3 py-2 text-right font-mono font-medium tabular-nums ${latColor}`}>
                        {hop.delay.toFixed(1)}ms
                        {isBottleneckHop && <span className="ml-1 text-red-500">●</span>}
                      </td>
                      <td className={`py-2 text-right font-mono tabular-nums ${hop.loss > 0 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {hop.loss > 0 ? `${hop.loss}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Server info footer */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 font-mono border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
            {active.bar.server_ip && <span>IP: {active.bar.server_ip}</span>}
            {active.bar.server_port && <span>Port: {active.bar.server_port}</span>}
            {active.bar.tls_version && <span>{active.bar.tls_version}</span>}
            {active.bar.http_version && <span>{active.bar.http_version}</span>}
            {active.teEnrichment?.test_id && <span>TE Test #{active.teEnrichment.test_id}</span>}
            {active.teEnrichment?.agent_name && <span>Agent: {active.teEnrichment.agent_name}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, warn, highlight }: { label: string; value: string; warn?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${
      warn ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50' :
      highlight ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50' :
      'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'
    }`}>
      <div className="text-[8px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-xs font-mono font-semibold mt-0.5 ${
        warn ? 'text-red-600 dark:text-red-400' :
        highlight ? 'text-blue-600 dark:text-blue-400' :
        'text-gray-800 dark:text-gray-200'
      }`}>{value}</div>
    </div>
  );
}

function FallbackPath({ bar }: { bar: WaterfallBar }) {
  const hops = bar.network_path || [];

  // If we have actual hop data, render all hops
  if (hops.length > 0) {
    return (
      <div className="overflow-x-auto py-2">
        <div className="flex items-center gap-0 min-w-min">
          <FallbackNode label="Client" sublabel="Your Infrastructure" icon="client" />
          {hops.map((hop, i) => (
            <div key={i} className="flex items-center">
              <FallbackArrow latencyDelta={i > 0 ? Math.abs(hop.delay - hops[i - 1].delay) : hop.delay} />
              <FallbackHopNode hop={hop} index={i} />
            </div>
          ))}
          <FallbackArrow />
          <FallbackNode
            label={bar.server_ip || bar.model || 'API'}
            sublabel={[bar.tls_version, bar.http_version, bar.server_port ? `:${bar.server_port}` : null].filter(Boolean).join(' · ') || 'Endpoint'}
            icon="server"
            delay={bar.network_timing?.ttfb_ms || null}
          />
        </div>
      </div>
    );
  }

  // No hop data: render each timing phase as a separate node
  const timing = bar.network_timing;
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2">
      <FallbackNode label="Client" sublabel="Your Infrastructure" icon="client" />
      {timing?.tcp_ms ? (
        <>
          <FallbackArrow />
          <FallbackNode
            label="TCP Handshake"
            sublabel={`${timing.tcp_ms}ms`}
            icon="hop"
            delay={timing.tcp_ms}
          />
        </>
      ) : null}
      {timing?.tls_ms ? (
        <>
          <FallbackArrow />
          <FallbackNode
            label="TLS Negotiation"
            sublabel={`${timing.tls_ms}ms`}
            icon="hop"
            delay={timing.tls_ms}
          />
        </>
      ) : null}
      {timing?.ttfb_ms ? (
        <>
          <FallbackArrow />
          <FallbackNode
            label="Server Wait"
            sublabel={`TTFB ${timing.ttfb_ms}ms`}
            icon="hop"
            delay={timing.ttfb_ms}
          />
        </>
      ) : null}
      <FallbackArrow />
      <FallbackNode
        label={bar.server_ip || bar.model || 'API'}
        sublabel={[bar.tls_version, bar.http_version, bar.server_port ? `:${bar.server_port}` : null].filter(Boolean).join(' · ') || 'Endpoint'}
        icon="server"
      />
    </div>
  );
}

function FallbackHopNode({ hop, index }: { hop: NetworkHop; index: number }) {
  const latColor = hop.delay > 100 ? 'text-red-500' : hop.delay > 50 ? 'text-amber-500' : 'text-emerald-500';
  return (
    <div className="flex flex-col items-center min-w-[90px] max-w-[130px] px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-[8px] font-bold text-gray-600 dark:text-gray-300 flex items-center justify-center">
          {index + 1}
        </span>
        <span className={`text-[10px] font-mono tabular-nums font-medium ${latColor}`}>
          {hop.delay.toFixed(0)}ms
        </span>
      </div>
      <span className="text-[10px] text-gray-700 dark:text-gray-300 text-center truncate w-full font-mono">
        {hop.rdns || hop.ip}
      </span>
      {hop.loss != null && hop.loss > 0 && (
        <span className="text-[8px] text-red-500 font-medium">{hop.loss}% loss</span>
      )}
      {hop.network && (
        <span className="text-[8px] text-gray-400 text-center truncate w-full">{hop.network}</span>
      )}
    </div>
  );
}

function FallbackNode({ label, sublabel, icon, delay }: { label: string; sublabel: string; icon: string; delay?: number | null }) {
  const iconEl = icon === 'client' ? (
    <Globe className="w-4 h-4 text-blue-400" />
  ) : icon === 'server' ? (
    <Server className="w-4 h-4 text-emerald-400" />
  ) : (
    <Wifi className="w-4 h-4 text-gray-400" />
  );

  return (
    <div className="flex flex-col items-center min-w-[100px] max-w-[140px] px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-1.5 mb-1">
        {iconEl}
        {delay != null && (
          <span className={`text-[10px] font-mono tabular-nums font-medium ${
            delay > 100 ? 'text-red-500' : delay > 50 ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {delay.toFixed(1)}ms
          </span>
        )}
      </div>
      <span className="text-[11px] text-gray-700 dark:text-gray-300 text-center truncate w-full font-medium">{label}</span>
      <span className="text-[9px] text-gray-400 text-center truncate w-full">{sublabel}</span>
    </div>
  );
}

function FallbackArrow({ latencyDelta }: { latencyDelta?: number | null } = {}) {
  return (
    <div className="flex flex-col items-center px-1">
      {latencyDelta != null && latencyDelta > 0 && (
        <span className={`text-[8px] font-mono mb-0.5 ${
          latencyDelta > 50 ? 'text-red-400' : latencyDelta > 20 ? 'text-amber-400' : 'text-gray-400'
        }`}>
          +{latencyDelta.toFixed(0)}ms
        </span>
      )}
      <div className="flex items-center">
        <div className="w-6 h-px bg-gray-300 dark:bg-gray-600" />
        <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-gray-300 dark:border-l-gray-600" />
      </div>
    </div>
  );
}

function TimingBar({ timing, totalMs }: { timing: NonNullable<WaterfallBar['network_timing']>; totalMs: number }) {
  const phases = [
    { key: 'tcp', label: 'TCP', ms: timing.tcp_ms, color: '#f59e0b' },
    { key: 'tls', label: 'TLS', ms: timing.tls_ms, color: '#8b5cf6' },
    { key: 'ttfb', label: 'TTFB', ms: timing.ttfb_ms, color: '#3b82f6' },
  ].filter((p) => p.ms != null && p.ms > 0);

  const measuredTotal = phases.reduce((sum, p) => sum + (p.ms || 0), 0);
  if (measuredTotal === 0) return null;

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        {phases.map((phase) => (
          <div
            key={phase.key}
            className="h-full"
            style={{
              width: `${Math.max((phase.ms! / Math.max(totalMs, measuredTotal)) * 100, 3)}%`,
              backgroundColor: phase.color,
            }}
            title={`${phase.label}: ${phase.ms}ms`}
          />
        ))}
      </div>
      <div className="flex gap-4 mt-2">
        {phases.map((phase) => (
          <span key={phase.key} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: phase.color }} />
            {phase.label} {phase.ms}ms
          </span>
        ))}
      </div>
    </div>
  );
}
