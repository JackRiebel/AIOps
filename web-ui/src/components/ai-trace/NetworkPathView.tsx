'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { AITraceDetail, AITraceSpan, WaterfallBar, NetworkHop } from '@/types/ai-trace';
import type { TEPathHop, TEHttpTiming } from '@/types/journey-flow';
import { PLATFORM_COLORS } from '@/types/ai-trace';
import { Globe, Server, Clock, ChevronDown, ChevronRight, Wifi, AlertTriangle } from 'lucide-react';
import { HttpTimingBar } from './journey-nodes/HttpTimingBar';

// Zone classification
function classifyZone(hop: TEPathHop, index: number, total: number): string {
  if (index === 0) return 'source';
  if (index === total - 1) return 'destination';
  const net = (hop.network || '').toLowerCase();
  const rdns = (hop.rdns || '').toLowerCase();
  if (net.includes('aws') || net.includes('google') || net.includes('azure') || net.includes('cloudflare') || rdns.includes('cloud') || rdns.includes('cdn'))
    return 'cloud';
  if (net.includes('comcast') || net.includes('att') || net.includes('verizon') || net.includes('cogent') || net.includes('level3') || net.includes('telia') || net.includes('ntt'))
    return 'isp';
  if (index <= 2) return 'local';
  return 'isp';
}

const ZONE_CONFIG: Record<string, { label: string; color: string; bg: string; borderColor: string }> = {
  source: { label: 'Source', color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', borderColor: 'rgba(6,182,212,0.25)' },
  local: { label: 'Local Network', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.25)' },
  isp: { label: 'ISP / Transit', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.25)' },
  cloud: { label: 'Cloud / CDN', color: '#10b981', bg: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' },
  destination: { label: 'Destination', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' },
};

function extractAsNumber(network: string): string | null {
  const match = network.match(/AS\s*(\d+)/i);
  return match ? `AS${match[1]}` : null;
}

function extractAsOrg(network: string): string {
  return network.replace(/AS\s*\d+\s*/i, '').trim();
}

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

// Find te_enrichment for a span from the trace tree
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

interface NetworkPathViewProps {
  bars: WaterfallBar[];
  trace?: AITraceDetail;
}

export function NetworkPathView({ bars, trace }: NetworkPathViewProps) {
  const networkBars = bars.filter(
    (b) => b.server_ip || (b.network_path && b.network_path.length > 0)
  );

  if (networkBars.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        <Globe className="w-6 h-6 mx-auto mb-2 opacity-50" />
        <p>No network path data captured yet.</p>
        <p className="text-xs mt-1">Network timing is captured on the next query.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {networkBars.map((bar) => (
        <NetworkPathCard key={bar.span_id} bar={bar} trace={trace} />
      ))}
    </div>
  );
}

function NetworkPathCard({ bar, trace }: { bar: WaterfallBar; trace?: AITraceDetail }) {
  const [expanded, setExpanded] = useState(true);
  const [hoveredHop, setHoveredHop] = useState<number | null>(null);

  // Get TE enrichment from trace tree if available
  const teEnrichment = trace ? findSpanTEEnrichment(trace, bar.span_id) : null;
  const teHops: TEPathHop[] = teEnrichment?.path_hops?.length
    ? teEnrichment.path_hops
    : bar.network_path?.length
      ? normalizeHops(bar.network_path)
      : [];
  const httpTiming: TEHttpTiming | null = teEnrichment?.http_timing || null;
  const networkMetrics = teEnrichment?.network_metrics || null;
  const bgpRoutes = teEnrichment?.bgp_routes || [];

  const hasHops = teHops.length > 0;
  const isToolExec = bar.span_type === 'tool_execution';
  const platform = bar.tool_platform || null;
  const platformColor = platform ? (PLATFORM_COLORS[platform.toLowerCase()] || '#64748b') : '#3b82f6';

  // Find bottleneck
  let maxDelay = 0;
  let bottleneckIdx = -1;
  for (let i = 1; i < teHops.length - 1; i++) {
    if (teHops[i].delay > maxDelay) {
      maxDelay = teHops[i].delay;
      bottleneckIdx = i;
    }
  }
  const hasBottleneck = maxDelay > 50;

  // Group hops by zone
  const zoneBands: { zone: string; startIdx: number; endIdx: number }[] = [];
  if (teHops.length > 0) {
    let currentZone = classifyZone(teHops[0], 0, teHops.length);
    let bandStart = 0;
    for (let i = 1; i < teHops.length; i++) {
      const zone = classifyZone(teHops[i], i, teHops.length);
      if (zone !== currentZone) {
        zoneBands.push({ zone: currentZone, startIdx: bandStart, endIdx: i - 1 });
        currentZone = zone;
        bandStart = i;
      }
    }
    zoneBands.push({ zone: currentZone, startIdx: bandStart, endIdx: teHops.length - 1 });
  }

  // SVG layout
  const NODE_SPACING = 56;
  const NODE_R = 10;
  const SVG_PAD = 24;
  const svgWidth = hasHops
    ? Math.max((teHops.length - 1) * NODE_SPACING + NODE_R * 2 + SVG_PAD * 2, 400)
    : 400;
  const svgHeight = 100;
  const cy = 40;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors text-left"
      >
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: platformColor }} />
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {isToolExec ? (bar.tool_name || 'Tool Call') : (bar.span_name || bar.model || 'LLM Call')}
        </span>
        {isToolExec && platform && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: platformColor + '20', color: platformColor }}>
            {platform}
          </span>
        )}
        <span className="text-xs text-gray-400 ml-auto flex items-center gap-1.5">
          {hasHops && (
            <span className="flex items-center gap-1">
              <Image src="/te-logo.png" alt="TE" width={12} height={12} className="opacity-70" />
              <span>{teHops.length} hops</span>
            </span>
          )}
          {bar.network_timing && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimingBreakdown(bar.network_timing)}
            </span>
          )}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* HTTP Timing Waterfall (5-phase from TE) */}
          {httpTiming && (
            <div>
              <div className="text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">HTTP Timing</div>
              <HttpTimingBar timing={httpTiming} />
            </div>
          )}

          {/* Fallback timing bar (TCP/TLS/TTFB) */}
          {!httpTiming && bar.network_timing && (
            <TimingBar timing={bar.network_timing} totalMs={bar.duration_ms} />
          )}

          {/* Network metrics from TE */}
          {networkMetrics && (
            <div className="flex gap-4 text-xs">
              <MetricPill label="Latency" value={`${networkMetrics.latency.toFixed(0)}ms`} />
              <MetricPill label="Loss" value={`${networkMetrics.loss.toFixed(1)}%`} warn={networkMetrics.loss > 1} />
              <MetricPill label="Jitter" value={`${networkMetrics.jitter.toFixed(0)}ms`} />
              {networkMetrics.bandwidth && <MetricPill label="BW" value={`${networkMetrics.bandwidth.toFixed(0)} Mbps`} />}
            </div>
          )}

          {/* Full SVG Path Visualization */}
          {hasHops ? (
            <div>
              <div className="text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                Network Path · {teHops.length} hops
                {hasBottleneck && (
                  <span className="text-red-500 ml-2 normal-case">
                    Bottleneck at hop {bottleneckIdx + 1} ({maxDelay.toFixed(0)}ms)
                  </span>
                )}
              </div>
              <div className="overflow-x-auto pb-2">
                <svg width={svgWidth} height={svgHeight} className="block">
                  {/* Zone background bands */}
                  {zoneBands.map((band) => {
                    const cfg = ZONE_CONFIG[band.zone] || ZONE_CONFIG.isp;
                    const x1 = SVG_PAD + band.startIdx * NODE_SPACING - NODE_R - 6;
                    const x2 = SVG_PAD + band.endIdx * NODE_SPACING + NODE_R + 6;
                    return (
                      <g key={`zone-${band.startIdx}`}>
                        <rect
                          x={x1} y={2} width={x2 - x1} height={svgHeight - 4}
                          rx={6} fill={cfg.bg} stroke={cfg.borderColor} strokeWidth={0.5}
                        />
                        <text x={(x1 + x2) / 2} y={svgHeight - 6} textAnchor="middle" fontSize={8} fill={cfg.color} opacity={0.8}>
                          {cfg.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Connection lines */}
                  {teHops.slice(0, -1).map((_, i) => {
                    const loss = Math.max(teHops[i].loss, teHops[i + 1].loss);
                    const lat = teHops[i + 1].delay;
                    const color = loss > 5 ? '#ef4444' : lat > 100 ? '#ef4444' : lat > 50 ? '#f59e0b' : '#10b981';
                    return (
                      <line
                        key={`link-${i}`}
                        x1={SVG_PAD + i * NODE_SPACING + NODE_R}
                        y1={cy}
                        x2={SVG_PAD + (i + 1) * NODE_SPACING - NODE_R}
                        y2={cy}
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray={loss > 5 ? '4,3' : undefined}
                        opacity={0.7}
                      />
                    );
                  })}

                  {/* Hop nodes */}
                  {teHops.map((hop, i) => {
                    const zone = classifyZone(hop, i, teHops.length);
                    const cfg = ZONE_CONFIG[zone] || ZONE_CONFIG.isp;
                    const cx = SVG_PAD + i * NODE_SPACING;
                    const isBottleneckHop = hasBottleneck && i === bottleneckIdx;
                    const isHovered = hoveredHop === i;
                    const latColor = hop.delay > 100 ? '#ef4444' : hop.delay > 50 ? '#f59e0b' : '#10b981';
                    const asn = extractAsNumber(hop.network);

                    return (
                      <g
                        key={`hop-${i}`}
                        onMouseEnter={() => setHoveredHop(i)}
                        onMouseLeave={() => setHoveredHop(null)}
                        className="cursor-default"
                      >
                        {/* Bottleneck pulsing ring */}
                        {isBottleneckHop && (
                          <circle cx={cx} cy={cy} fill="none" stroke="#ef4444" strokeWidth={1.5}>
                            <animate attributeName="r" values={`${NODE_R + 3};${NODE_R + 7};${NODE_R + 3}`} dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.7;0.15;0.7" dur="1.5s" repeatCount="indefinite" />
                          </circle>
                        )}

                        {/* Hop circle */}
                        <circle
                          cx={cx} cy={cy} r={isHovered ? NODE_R + 2 : NODE_R}
                          fill={hop.loss > 0 ? '#fef2f2' : '#ffffff'}
                          stroke={cfg.color}
                          strokeWidth={isHovered ? 2.5 : 2}
                          className="transition-all duration-150"
                        />

                        {/* Hop number */}
                        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={cfg.color}>
                          {i + 1}
                        </text>

                        {/* Latency label */}
                        <text x={cx} y={cy + NODE_R + 13} textAnchor="middle" fontSize={8} fill={latColor} fontFamily="monospace" fontWeight={600}>
                          {hop.delay.toFixed(0)}ms
                        </text>

                        {/* AS number label */}
                        {asn && (
                          <text x={cx} y={cy - NODE_R - 6} textAnchor="middle" fontSize={7} fill={cfg.color} opacity={0.8}>
                            {asn}
                          </text>
                        )}

                        {/* Loss indicator */}
                        {hop.loss > 0 && (
                          <text x={cx} y={cy + NODE_R + 22} textAnchor="middle" fontSize={7} fill="#ef4444" fontWeight={600}>
                            {hop.loss}% loss
                          </text>
                        )}

                        {/* Tooltip on hover */}
                        {isHovered && (
                          <foreignObject x={cx - 85} y={cy - 100} width={170} height={86}>
                            <div className="bg-gray-900 text-white text-[9px] rounded-md px-2.5 py-2 shadow-xl space-y-0.5 pointer-events-none border border-gray-700">
                              <div className="font-mono truncate font-medium">{hop.rdns || hop.ip}</div>
                              {hop.rdns && <div className="text-gray-400 font-mono truncate">{hop.ip}</div>}
                              {hop.prefix && <div className="text-gray-400">Prefix: {hop.prefix}</div>}
                              {asn && (
                                <div className="text-cyan-300">{asn} · {extractAsOrg(hop.network)}</div>
                              )}
                              {!asn && hop.network && (
                                <div className="text-gray-400">{hop.network}</div>
                              )}
                              <div className="flex gap-3 pt-0.5">
                                <span style={{ color: latColor }}>Latency: {hop.delay.toFixed(1)}ms</span>
                                {hop.loss > 0 && <span className="text-red-400">Loss: {hop.loss}%</span>}
                              </div>
                              <div style={{ color: cfg.color }}>{cfg.label} zone</div>
                            </div>
                          </foreignObject>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          ) : (
            /* Fallback: simple Client → Server path when no hops */
            <div className="flex items-center gap-0 overflow-x-auto pb-1">
              <SimplePathNode label="Client" sublabel="Your Infrastructure" icon="client" />
              {bar.network_timing?.tcp_ms ? (
                <>
                  <Arrow />
                  <SimplePathNode
                    label="TCP Handshake"
                    sublabel={`${bar.network_timing.tcp_ms}ms`}
                    icon="hop"
                    delay={bar.network_timing.tcp_ms}
                  />
                </>
              ) : null}
              {bar.network_timing?.tls_ms ? (
                <>
                  <Arrow />
                  <SimplePathNode
                    label="TLS Negotiation"
                    sublabel={`${bar.network_timing.tls_ms}ms`}
                    icon="hop"
                    delay={bar.network_timing.tls_ms}
                  />
                </>
              ) : null}
              {bar.network_timing?.ttfb_ms ? (
                <>
                  <Arrow />
                  <SimplePathNode
                    label="Server Wait"
                    sublabel={`TTFB ${bar.network_timing.ttfb_ms}ms`}
                    icon="hop"
                    delay={bar.network_timing.ttfb_ms}
                  />
                </>
              ) : null}
              <Arrow />
              <SimplePathNode
                label={bar.server_ip || bar.model || 'API'}
                sublabel={[bar.tls_version, bar.http_version, bar.server_port ? `:${bar.server_port}` : null].filter(Boolean).join(' · ') || 'Endpoint'}
                icon="server"
              />
            </div>
          )}

          {/* Hop detail table */}
          {hasHops && (
            <div>
              <div className="text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Hop Details</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-gray-400 text-left border-b border-gray-100 dark:border-gray-700">
                      <th className="pr-3 pb-1.5 font-medium">#</th>
                      <th className="pr-3 pb-1.5 font-medium">IP / Hostname</th>
                      <th className="pr-3 pb-1.5 font-medium">AS#</th>
                      <th className="pr-3 pb-1.5 font-medium">Network</th>
                      <th className="pr-3 pb-1.5 font-medium">Zone</th>
                      <th className="pr-3 pb-1.5 font-medium text-right">Latency</th>
                      <th className="pb-1.5 font-medium text-right">Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teHops.map((hop, i) => {
                      const zone = classifyZone(hop, i, teHops.length);
                      const cfg = ZONE_CONFIG[zone] || ZONE_CONFIG.isp;
                      const asn = extractAsNumber(hop.network);
                      const latColor = hop.delay > 100 ? 'text-red-500' : hop.delay > 50 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400';
                      const isBottleneckHop = hasBottleneck && i === bottleneckIdx;

                      return (
                        <tr
                          key={i}
                          className={`border-t border-gray-50 dark:border-gray-800 ${isBottleneckHop ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
                          onMouseEnter={() => setHoveredHop(i)}
                          onMouseLeave={() => setHoveredHop(null)}
                        >
                          <td className="pr-3 py-1.5 text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="pr-3 py-1.5 font-mono text-gray-700 dark:text-gray-300">
                            <div className="truncate max-w-[180px]" title={`${hop.rdns || ''} (${hop.ip})`}>
                              {hop.rdns || hop.ip}
                            </div>
                            {hop.rdns && <div className="text-[9px] text-gray-400 font-mono">{hop.ip}</div>}
                          </td>
                          <td className="pr-3 py-1.5 text-cyan-600 dark:text-cyan-400 font-mono">{asn || '—'}</td>
                          <td className="pr-3 py-1.5 text-gray-500 truncate max-w-[120px]" title={hop.network}>
                            {extractAsOrg(hop.network) || '—'}
                          </td>
                          <td className="pr-3 py-1.5">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                              <span style={{ color: cfg.color }}>{cfg.label}</span>
                            </span>
                          </td>
                          <td className={`pr-3 py-1.5 text-right font-mono font-medium tabular-nums ${latColor}`}>
                            {hop.delay.toFixed(1)}ms
                            {isBottleneckHop && <span className="text-red-500 ml-1">⬤</span>}
                          </td>
                          <td className={`py-1.5 text-right font-mono tabular-nums ${hop.loss > 0 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                            {hop.loss > 0 ? `${hop.loss}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BGP summary */}
          {bgpRoutes.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">BGP Routes</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-gray-400 text-left border-b border-gray-100 dark:border-gray-700">
                      <th className="pr-3 pb-1.5 font-medium">Prefix</th>
                      <th className="pr-3 pb-1.5 font-medium">AS Path</th>
                      <th className="pr-3 pb-1.5 font-medium">Monitor</th>
                      <th className="pr-3 pb-1.5 font-medium text-right">Reachability</th>
                      <th className="pb-1.5 font-medium text-right">Updates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bgpRoutes.map((route, i) => (
                      <tr key={i} className="border-t border-gray-50 dark:border-gray-800">
                        <td className="pr-3 py-1.5 font-mono text-gray-700 dark:text-gray-300">{route.prefix}</td>
                        <td className="pr-3 py-1.5 text-gray-500 font-mono truncate max-w-[150px]" title={route.asPath.join(' → ')}>
                          {route.asPath.map((as, j) => (
                            <span key={j}>
                              {j > 0 && <span className="text-gray-300 mx-0.5">→</span>}
                              <span className="text-cyan-600 dark:text-cyan-400">AS{as}</span>
                            </span>
                          ))}
                        </td>
                        <td className="pr-3 py-1.5 text-gray-500">{route.monitor}</td>
                        <td className={`pr-3 py-1.5 text-right font-mono ${route.reachability < 100 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {route.reachability}%
                        </td>
                        <td className={`py-1.5 text-right font-mono ${route.updates > 10 ? 'text-amber-500' : 'text-gray-500'}`}>
                          {route.updates}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Server info footer */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 font-mono border-t border-gray-100 dark:border-gray-700 pt-2">
            {bar.server_ip && <span>IP: {bar.server_ip}</span>}
            {bar.server_port && <span>Port: {bar.server_port}</span>}
            {bar.tls_version && <span>{bar.tls_version}</span>}
            {bar.http_version && <span>{bar.http_version}</span>}
            {teEnrichment?.test_id && <span>TE Test #{teEnrichment.test_id}</span>}
            {teEnrichment?.agent_name && <span>Agent: {teEnrichment.agent_name}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// Simple path node (fallback when no TE hops)
function SimplePathNode({ label, sublabel, icon, delay }: { label: string; sublabel: string; icon: string; delay?: number | null }) {
  const iconEl = icon === 'client' ? (
    <Globe className="w-4 h-4 text-blue-400" />
  ) : icon === 'server' ? (
    <Server className="w-4 h-4 text-emerald-400" />
  ) : (
    <Wifi className="w-4 h-4 text-gray-400" />
  );

  return (
    <div className="flex flex-col items-center min-w-[100px] max-w-[140px] px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-1.5 mb-0.5">
        {iconEl}
        {delay != null && (
          <span className={`text-[10px] font-mono tabular-nums font-medium ${
            delay > 100 ? 'text-red-500' : delay > 50 ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {delay.toFixed(1)}ms
          </span>
        )}
      </div>
      <span className="text-[11px] text-gray-700 dark:text-gray-300 text-center truncate w-full font-medium" title={label}>
        {label}
      </span>
      <span className="text-[9px] text-gray-400 text-center truncate w-full" title={sublabel}>
        {sublabel}
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center px-1">
      <div className="w-6 h-px bg-gray-300 dark:bg-gray-600" />
      <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[4px] border-l-gray-300 dark:border-l-gray-600" />
    </div>
  );
}

function MetricPill({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${warn ? 'bg-red-50 dark:bg-red-950/30' : 'bg-gray-50 dark:bg-gray-750'}`}>
      {warn && <AlertTriangle className="w-3 h-3 text-red-500" />}
      <span className="text-gray-500">{label}:</span>
      <span className={`font-mono font-medium ${warn ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{value}</span>
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
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        {phases.map((phase) => (
          <div
            key={phase.key}
            className="h-full"
            style={{
              width: `${Math.max((phase.ms! / Math.max(totalMs, measuredTotal)) * 100, 2)}%`,
              backgroundColor: phase.color,
            }}
            title={`${phase.label}: ${phase.ms}ms`}
          />
        ))}
      </div>
      <div className="flex gap-3 mt-1">
        {phases.map((phase) => (
          <span key={phase.key} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: phase.color }} />
            {phase.label} {phase.ms}ms
          </span>
        ))}
      </div>
    </div>
  );
}

function formatTimingBreakdown(timing: NonNullable<WaterfallBar['network_timing']>): string {
  const parts: string[] = [];
  if (timing.tcp_ms) parts.push(`TCP ${timing.tcp_ms}ms`);
  if (timing.tls_ms) parts.push(`TLS ${timing.tls_ms}ms`);
  if (timing.ttfb_ms) parts.push(`TTFB ${timing.ttfb_ms}ms`);
  return parts.join(' + ') || 'timing captured';
}
