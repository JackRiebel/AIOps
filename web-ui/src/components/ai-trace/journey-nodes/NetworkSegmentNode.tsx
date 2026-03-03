'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import Image from 'next/image';
import { ChevronRight, ChevronDown, Globe, Shield, Server } from 'lucide-react';
import type { NetworkSegmentNodeData, TEPathHop } from '@/types/journey-flow';
import { useIsDark } from '@/hooks/useIsDark';
import { InlinePathPreview } from './InlinePathPreview';
import { classifyZone, extractAsNumber, ZONE_CONFIG, groupHopsByZone, findBottleneck } from '../pathUtils';

export const NetworkSegmentNode = memo(({ data }: NodeProps<Node<NetworkSegmentNodeData>>) => {
  const isDark = useIsDark();
  const teHops: TEPathHop[] = data.teEnrichment?.path_hops || data.hops.map((h) => ({
    ip: h.ip,
    prefix: h.prefix || '',
    delay: h.delay,
    loss: h.loss || 0,
    network: h.network || '',
    rdns: h.rdns || '',
  }));
  const hasTE = teHops.length > 0;
  const isExpanded = data.isExpanded;
  const hopCount = teHops.length;
  const [hoveredHop, setHoveredHop] = useState<number | null>(null);

  // Connection phases (used when no hops)
  const hasTiming = !!(data.tcpMs || data.tlsMs || data.ttfbMs);

  // Find bottleneck
  const bottleneck = findBottleneck(teHops);
  const { hasBottleneck, index: bottleneckIdx } = bottleneck;
  const hasLoss = teHops.some((h) => h.loss > 0);

  // Group hops into zone bands
  const zoneBands = groupHopsByZone(teHops);

  // SVG dimensions for expanded path
  const NODE_SPACING = 44;
  const NODE_R = 8;
  const SVG_PAD = 16;
  const svgWidth = (teHops.length - 1) * NODE_SPACING + NODE_R * 2 + SVG_PAD * 2;
  const svgHeight = 80;
  const cy = 32;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-transparent !border-0" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-transparent !border-0" />

      <div
        className={`rounded-xl border bg-white dark:bg-gray-800 cursor-pointer shadow-sm hover:shadow-md transition-all ${
          data.hasAnomaly
            ? 'border-red-400 dark:border-red-600'
            : 'border-slate-200/60 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600'
        } ${isExpanded ? (hopCount > 0 ? 'min-w-[420px]' : 'min-w-[320px]') : 'min-w-[160px]'}`}
        onClick={() => data.onToggle?.()}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
          )}
          {hasTE && <Image src="/te-logo.png" alt="TE" width={14} height={14} className="opacity-60" />}
          <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
            {hopCount > 0 ? `${hopCount} hops` : hasTiming ? 'Connection' : 'Network'}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {data.totalLatency > 0 ? `· ${data.totalLatency.toFixed(0)}ms` : ''}
          </span>
          {hasLoss && <span className="text-[10px] text-red-500 font-medium">loss</span>}
          {hasBottleneck && (
            <span className="relative flex h-2 w-2 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
          {/* Inline dot preview when collapsed */}
          {!isExpanded && hopCount > 0 && (
            <div className="ml-auto">
              <InlinePathPreview hops={teHops} width={60} />
            </div>
          )}
          {/* Timing pills when collapsed and no hops */}
          {!isExpanded && hopCount === 0 && hasTiming && (
            <div className="flex gap-1 ml-auto">
              {data.tcpMs != null && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                  TCP {data.tcpMs}ms
                </span>
              )}
              {data.tlsMs != null && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
                  TLS {data.tlsMs}ms
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expanded: Full SVG path visualization (when we have hops) */}
        {isExpanded && hopCount > 0 && (
          <div className="px-2.5 pb-2.5" onClick={(e) => e.stopPropagation()}>
            <svg width={svgWidth} height={svgHeight} className="block">
              {/* Zone background bands */}
              {zoneBands.map((band) => {
                const cfg = ZONE_CONFIG[band.zone] || ZONE_CONFIG.isp;
                const hex = cfg.dotColorHex;
                const x1 = SVG_PAD + band.startIdx * NODE_SPACING - NODE_R - 4;
                const x2 = SVG_PAD + band.endIdx * NODE_SPACING + NODE_R + 4;
                return (
                  <g key={`zone-${band.startIdx}`}>
                    <rect
                      x={x1} y={2} width={x2 - x1} height={svgHeight - 4}
                      rx={4} fill={hex} fillOpacity={isDark ? 0.12 : 0.06} stroke={hex} strokeOpacity={0.15} strokeWidth={0.5}
                    />
                    <text x={(x1 + x2) / 2} y={svgHeight - 6} textAnchor="middle" fontSize={7} fill={hex} opacity={0.7}>
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
                    strokeWidth={1.5}
                    strokeDasharray={loss > 5 ? '3,2' : undefined}
                    opacity={0.7}
                  />
                );
              })}

              {/* Hop nodes */}
              {teHops.map((hop, i) => {
                const zone = classifyZone(hop, i, teHops.length);
                const cfg = ZONE_CONFIG[zone] || ZONE_CONFIG.isp;
                const hex = cfg.dotColorHex;
                const cx = SVG_PAD + i * NODE_SPACING;
                const isBottleneckHop = hasBottleneck && i === bottleneckIdx;
                const isHovered = hoveredHop === i;
                const latColor = hop.delay > 100 ? '#ef4444' : hop.delay > 50 ? '#f59e0b' : '#10b981';

                return (
                  <g
                    key={`hop-${i}`}
                    onMouseEnter={() => setHoveredHop(i)}
                    onMouseLeave={() => setHoveredHop(null)}
                    className="cursor-default"
                  >
                    {/* Bottleneck pulsing ring */}
                    {isBottleneckHop && (
                      <circle cx={cx} cy={cy} r={NODE_R + 3} fill="none" stroke="#ef4444" strokeWidth={1}>
                        <animate attributeName="r" values={`${NODE_R + 2};${NODE_R + 5};${NODE_R + 2}`} dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Hop circle */}
                    <circle
                      cx={cx} cy={cy} r={isHovered ? NODE_R + 1 : NODE_R}
                      fill={hop.loss > 0 ? (isDark ? '#3c1414' : '#fef2f2') : (isDark ? '#1f2937' : '#fff')}
                      stroke={hex}
                      strokeWidth={isHovered ? 2 : 1.5}
                    />

                    {/* Hop number */}
                    <text x={cx} y={cy + 3} textAnchor="middle" fontSize={7} fontWeight={600} fill={hex}>
                      {i + 1}
                    </text>

                    {/* Latency label */}
                    <text x={cx} y={cy + NODE_R + 10} textAnchor="middle" fontSize={7} fill={latColor} fontFamily="monospace">
                      {hop.delay.toFixed(0)}ms
                    </text>

                    {/* Loss indicator */}
                    {hop.loss > 0 && (
                      <text x={cx} y={cy - NODE_R - 4} textAnchor="middle" fontSize={6} fill="#ef4444">
                        {hop.loss}%
                      </text>
                    )}

                    {/* Tooltip on hover */}
                    {isHovered && (
                      <foreignObject x={cx - 70} y={cy - 78} width={140} height={68}>
                        <div className="bg-gray-900 text-white text-[8px] rounded px-2 py-1.5 shadow-lg space-y-0.5 pointer-events-none">
                          <div className="font-mono truncate">{hop.rdns || hop.ip}</div>
                          {hop.rdns && <div className="text-gray-400 font-mono truncate">{hop.ip}</div>}
                          {extractAsNumber(hop.network) && (
                            <div className="text-cyan-300">{extractAsNumber(hop.network)} · {hop.network.replace(/AS\s*\d+\s*/i, '').trim()}</div>
                          )}
                          <div className="flex gap-2">
                            <span style={{ color: latColor }}>Latency: {hop.delay.toFixed(1)}ms</span>
                            {hop.loss > 0 && <span className="text-red-400">Loss: {hop.loss}%</span>}
                          </div>
                          <div style={{ color: hex }}>{cfg.label} zone</div>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Latency waterfall bar chart below SVG */}
            <div className="mt-2 flex items-end gap-px" style={{ height: 24 }}>
              {teHops.map((hop, i) => {
                const maxLat = Math.max(...teHops.map((h) => h.delay), 1);
                const barH = Math.max(2, (hop.delay / maxLat) * 24);
                const color = hop.delay > 100 ? '#ef4444' : hop.delay > 50 ? '#f59e0b' : '#10b981';
                return (
                  <div
                    key={i}
                    className="rounded-t"
                    style={{
                      width: `${100 / teHops.length}%`,
                      height: barH,
                      backgroundColor: color,
                      opacity: hoveredHop === i ? 1 : 0.7,
                    }}
                    title={`Hop ${i + 1}: ${hop.delay.toFixed(1)}ms`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Expanded: Connection phase visualization (when NO hops but have timing) */}
        {isExpanded && hopCount === 0 && hasTiming && (
          <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
            <ConnectionPhases
              tcpMs={data.tcpMs}
              tlsMs={data.tlsMs}
              ttfbMs={data.ttfbMs}
              serverIp={data.serverIp}
              tlsVersion={data.tlsVersion}
              httpVersion={data.httpVersion}
              destination={data.destination}
            />
          </div>
        )}
      </div>
    </div>
  );
});
NetworkSegmentNode.displayName = 'NetworkSegmentNode';

/** Visual connection phase path: Client → TCP → TLS → TTFB → Server */
function ConnectionPhases({ tcpMs, tlsMs, ttfbMs, serverIp, tlsVersion, httpVersion, destination }: {
  tcpMs?: number | null;
  tlsMs?: number | null;
  ttfbMs?: number | null;
  serverIp?: string | null;
  tlsVersion?: string | null;
  httpVersion?: string | null;
  destination?: string;
}) {
  const phases: { label: string; sublabel: string; ms: number; color: string; icon: typeof Globe }[] = [];
  if (tcpMs) phases.push({ label: 'TCP Handshake', sublabel: `${tcpMs}ms`, ms: tcpMs, color: '#f59e0b', icon: Globe });
  if (tlsMs) phases.push({ label: 'TLS Negotiation', sublabel: `${tlsMs}ms`, ms: tlsMs, color: '#8b5cf6', icon: Shield });
  if (ttfbMs) phases.push({ label: 'Server Wait', sublabel: `TTFB ${ttfbMs}ms`, ms: ttfbMs, color: '#3b82f6', icon: Server });

  const maxMs = Math.max(...phases.map(p => p.ms), 1);

  return (
    <div className="space-y-2">
      {/* Phase nodes */}
      <div className="flex items-center gap-0">
        {/* Client */}
        <div className="flex flex-col items-center min-w-[60px]">
          <div className="w-7 h-7 rounded-full bg-cyan-50 dark:bg-cyan-950/30 border-2 border-cyan-500 flex items-center justify-center">
            <Globe className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <span className="text-[9px] text-slate-500 mt-1">Client</span>
        </div>

        {phases.map((phase, i) => (
          <div key={i} className="flex items-center">
            {/* Arrow with latency */}
            <div className="flex flex-col items-center px-1">
              <span className="text-[9px] font-mono font-medium mb-0.5" style={{ color: phase.color }}>
                {phase.sublabel}
              </span>
              <div className="flex items-center">
                <div className="w-6 h-[2px]" style={{ backgroundColor: phase.color, opacity: 0.5 }} />
                <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[4px]" style={{ borderLeftColor: phase.color }} />
              </div>
            </div>
            {/* Phase node */}
            <div className="flex flex-col items-center min-w-[60px]">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{
                backgroundColor: phase.color + '15',
                border: `2px solid ${phase.color}`,
              }}>
                <phase.icon className="w-3.5 h-3.5" style={{ color: phase.color }} />
              </div>
              <span className="text-[9px] text-slate-500 mt-1 text-center">{phase.label}</span>
            </div>
          </div>
        ))}

        {/* Final arrow to server */}
        <div className="flex items-center px-1">
          <div className="w-6 h-[2px] bg-slate-300 dark:bg-slate-600" />
          <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[4px] border-l-slate-300 dark:border-l-slate-600" />
        </div>
        <div className="flex flex-col items-center min-w-[60px]">
          <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-500 flex items-center justify-center">
            <Server className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <span className="text-[9px] text-slate-500 mt-1 text-center truncate max-w-[80px]" title={serverIp || destination || ''}>
            {serverIp || destination || 'Server'}
          </span>
        </div>
      </div>

      {/* Timing bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
        {phases.map((phase, i) => (
          <div
            key={i}
            className="h-full"
            style={{
              width: `${Math.max((phase.ms / maxMs) * 100 / phases.length, 5)}%`,
              backgroundColor: phase.color,
              flexGrow: phase.ms / maxMs,
            }}
            title={`${phase.label}: ${phase.ms}ms`}
          />
        ))}
      </div>

      {/* Server details */}
      <div className="flex flex-wrap gap-1.5">
        {serverIp && (
          <span className="text-[9px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {serverIp}
          </span>
        )}
        {tlsVersion && (
          <span className="text-[9px] font-mono text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
            {tlsVersion}
          </span>
        )}
        {httpVersion && (
          <span className="text-[9px] font-mono text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded">
            {httpVersion}
          </span>
        )}
      </div>
    </div>
  );
}
