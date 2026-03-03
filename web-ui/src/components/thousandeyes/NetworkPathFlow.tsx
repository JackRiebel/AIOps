'use client';

import { memo, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { TopologyNode, TopologyLink } from './types';
import { ZONE_CONFIG } from './types';

// ============================================================================
// NetworkPathFlow — SVG horizontal path flow visualization
// Shows hops as circles grouped by zone with colored background bands,
// connection lines colored by health, animated data flow dots,
// bottleneck pulsing ring, click-to-expand popover, zone summary latency
// ============================================================================

export interface NetworkPathFlowProps {
  nodes: TopologyNode[];
  links: TopologyLink[];
  onNodeClick?: (nodeId: string) => void;
}

const HEALTH_COLORS = {
  healthy: '#10b981',
  degraded: '#f59e0b',
  failing: '#ef4444',
};

const NODE_RADIUS = 10;
const VIEWBOX_WIDTH = 500;
const H_PADDING = 40;
const ROW_HEIGHT = 48;
const TOP_PADDING = 18;
const BOTTOM_PADDING = 8;
const MAX_NODE_SPACING = 120;

export const NetworkPathFlow = memo(({ nodes, links, onNodeClick }: NetworkPathFlowProps) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute positions and zone groups
  const layout = useMemo(() => {
    const height = TOP_PADDING + ROW_HEIGHT + BOTTOM_PADDING;
    if (nodes.length === 0) return { width: VIEWBOX_WIDTH, height, positions: new Map<string, { x: number; y: number }>(), zoneGroups: [] as { zone: string; startX: number; endX: number; startIdx: number; endIdx: number; totalLatency: number; nodeCount: number }[] };

    const positions = new Map<string, { x: number; y: number }>();
    const centerY = TOP_PADDING + ROW_HEIGHT / 2;

    // Distribute nodes proportionally across the viewBox
    const availableWidth = VIEWBOX_WIDTH - 2 * H_PADDING;
    const rawSpacing = nodes.length > 1 ? availableWidth / (nodes.length - 1) : 0;
    const nodeSpacing = Math.min(rawSpacing, MAX_NODE_SPACING);
    const groupWidth = nodes.length > 1 ? (nodes.length - 1) * nodeSpacing : 0;
    const startX = (VIEWBOX_WIDTH - groupWidth) / 2;

    nodes.forEach((node, idx) => {
      positions.set(node.id, { x: startX + idx * nodeSpacing, y: centerY });
    });

    // Group consecutive nodes by zone for background bands
    const halfGap = nodeSpacing / 2 || 30;
    const zoneGroups: { zone: string; startX: number; endX: number; startIdx: number; endIdx: number; totalLatency: number; nodeCount: number }[] = [];
    let currentZone = nodes[0]?.zone;
    let zoneStart = 0;

    for (let i = 1; i <= nodes.length; i++) {
      if (i === nodes.length || nodes[i].zone !== currentZone) {
        const firstPos = positions.get(nodes[zoneStart].id)!;
        const lastPos = positions.get(nodes[i - 1].id)!;
        const zoneNodes = nodes.slice(zoneStart, i);
        const totalLatency = zoneNodes.reduce((sum, n) => sum + n.latency, 0);
        zoneGroups.push({
          zone: currentZone,
          startX: firstPos.x - halfGap + 3,
          endX: lastPos.x + halfGap - 3,
          startIdx: zoneStart,
          endIdx: i - 1,
          totalLatency,
          nodeCount: zoneNodes.length,
        });
        if (i < nodes.length) {
          currentZone = nodes[i].zone;
          zoneStart = i;
        }
      }
    }

    return { width: VIEWBOX_WIDTH, height, positions, zoneGroups };
  }, [nodes]);

  // Find bottleneck node
  const bottleneckId = useMemo(() => {
    if (nodes.length === 0) return null;
    const maxNode = nodes.reduce((max, n) => n.latency > max.latency ? n : max, nodes[0]);
    return maxNode.latency > 50 ? maxNode.id : null;
  }, [nodes]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setExpandedNode(prev => prev === nodeId ? null : nodeId);
    onNodeClick?.(nodeId);
  }, [onNodeClick]);

  // Close popover when clicking outside
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't close if clicking inside the popover
    if (target.closest('[data-node-popover]')) return;
    // Close if clicking on the SVG background (not a node)
    if ((target as unknown as SVGElement).tagName === 'svg') {
      setExpandedNode(null);
    }
  }, []);

  // Get the expanded/hovered node data for the HTML overlay
  const activeNode = expandedNode ? nodes.find(n => n.id === expandedNode) : null;
  const activePos = activeNode ? layout.positions.get(activeNode.id) : null;

  if (nodes.length === 0) return null;

  return (
    <div ref={containerRef} className="relative" onClick={handleContainerClick}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Animated flow dot gradient */}
          <radialGradient id="flowDotGrad">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Zone background bands */}
        {layout.zoneGroups.map((group) => {
          const config = ZONE_CONFIG[group.zone];
          const hex = config?.dotColorHex || '#94a3b8';
          return (
            <g key={`zone-${group.zone}-${group.startIdx}`}>
              <rect
                x={group.startX}
                y={TOP_PADDING - 4}
                width={group.endX - group.startX}
                height={ROW_HEIGHT + 8}
                rx={8}
                fill={hex}
                fillOpacity={0.06}
                stroke={hex}
                strokeOpacity={0.15}
                strokeWidth={1}
              />
              <text
                x={(group.startX + group.endX) / 2}
                y={TOP_PADDING - 8}
                textAnchor="middle"
                fontSize={8}
                fontWeight={600}
                fill={hex}
                opacity={0.9}
              >
                {config?.label || group.zone}
              </text>
            </g>
          );
        })}

        {/* Connection lines + animated flow dots */}
        {links.map((link, idx) => {
          const fromPos = layout.positions.get(link.from);
          const toPos = layout.positions.get(link.to);
          if (!fromPos || !toPos) return null;
          const color = HEALTH_COLORS[link.health];
          const isDashed = link.health === 'failing';
          const x1 = fromPos.x + NODE_RADIUS + 2;
          const x2 = toPos.x - NODE_RADIUS - 2;
          return (
            <g key={`link-${idx}`}>
              <line
                x1={x1}
                y1={fromPos.y}
                x2={x2}
                y2={toPos.y}
                stroke={color}
                strokeWidth={link.health === 'failing' ? 2.5 : 2}
                strokeDasharray={isDashed ? '6,3' : undefined}
                strokeLinecap="round"
                opacity={0.7}
              />
              {/* Animated data flow dot */}
              {link.health !== 'failing' && (
                <circle r={3} fill={color} opacity={0.8}>
                  <animateMotion
                    dur={`${1.5 + idx * 0.1}s`}
                    repeatCount="indefinite"
                    path={`M${x1},${fromPos.y} L${x2},${toPos.y}`}
                  />
                  <animate attributeName="opacity" values="0;0.8;0.8;0" dur={`${1.5 + idx * 0.1}s`} repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = layout.positions.get(node.id);
          if (!pos) return null;
          const config = ZONE_CONFIG[node.zone];
          const hex = config?.dotColorHex || '#94a3b8';
          const isBottleneck = node.id === bottleneckId;
          const isHovered = hoveredNode === node.id;
          const isExpanded = expandedNode === node.id;
          const hasIssue = node.loss > 1 || node.latency > 100;

          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => handleNodeClick(node.id)}
            >
              {/* Bottleneck pulsing ring */}
              {isBottleneck && (
                <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS + 6} fill="none" stroke="#ef4444" strokeWidth={1.5} opacity={0.4}>
                  <animate attributeName="r" values={`${NODE_RADIUS + 4};${NODE_RADIUS + 12};${NODE_RADIUS + 4}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Node outer glow — always rendered, opacity transitions on hover */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={NODE_RADIUS + 4}
                fill="none"
                stroke={hex}
                strokeWidth={1}
                opacity={isHovered || isExpanded ? 0.3 : 0}
                style={{ transition: 'opacity 150ms ease' }}
              />

              {/* Node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={NODE_RADIUS}
                fill={hasIssue ? (node.loss > 5 ? '#fecaca' : '#fef3c7') : `${hex}20`}
                stroke={hasIssue ? (node.loss > 5 ? '#ef4444' : '#f59e0b') : hex}
                strokeWidth={isHovered || isExpanded ? 2.5 : 1.5}
                style={{ transition: 'stroke-width 150ms ease' }}
              />

              {/* Hop number inside */}
              <text
                x={pos.x}
                y={pos.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                fontWeight={700}
                fill={hasIssue ? '#1e293b' : hex}
              >
                {node.hopNumber}
              </text>

              {/* Latency label below */}
              <text
                x={pos.x}
                y={pos.y + NODE_RADIUS + 11}
                textAnchor="middle"
                fontSize={7}
                fontWeight={600}
                fill={node.latency > 100 ? '#ef4444' : node.latency > 50 ? '#f59e0b' : '#64748b'}
              >
                {node.latency.toFixed(0)}ms
              </text>

              {/* Loss indicator */}
              {node.loss > 0 && (
                <text
                  x={pos.x}
                  y={pos.y + NODE_RADIUS + 19}
                  textAnchor="middle"
                  fontSize={6}
                  fontWeight={600}
                  fill="#ef4444"
                >
                  {node.loss.toFixed(1)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* HTML Popover — portaled to body so parent overflow can't clip it */}
      {activeNode && activePos && (
        <NodePopover
          node={activeNode}
          svgX={activePos.x}
          svgY={activePos.y}
          svgRef={svgRef}
          onClose={() => setExpandedNode(null)}
        />
      )}

      {/* Zone latency summary — rendered as HTML for consistent sizing */}
      <div className="flex items-center justify-center gap-3 px-2 py-1">
        {layout.zoneGroups.map((group) => {
          const config = ZONE_CONFIG[group.zone];
          const hex = config?.dotColorHex || '#94a3b8';
          return (
            <div key={`zone-sum-${group.zone}-${group.startIdx}`} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: hex }} />
              <span className="text-[10px] font-semibold" style={{ color: hex }}>
                {config?.label || group.zone}
              </span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                {group.totalLatency.toFixed(0)}ms
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

NetworkPathFlow.displayName = 'NetworkPathFlow';

// ============================================================================
// NodePopover — portaled to body with fixed positioning so it's never clipped
// ============================================================================

function NodePopover({
  node,
  svgX,
  svgY,
  svgRef,
  onClose,
}: {
  node: TopologyNode;
  svgX: number;
  svgY: number;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; arrowLeft: number } | null>(null);

  const config = ZONE_CONFIG[node.zone];
  const popoverWidth = 260;

  // Compute fixed position from SVG viewport coordinates
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const compute = () => {
      const rect = svg.getBoundingClientRect();
      const scale = rect.width / VIEWBOX_WIDTH;
      const centerX = rect.left + svgX * scale;
      const nodeBottom = rect.top + (svgY + NODE_RADIUS + 4) * scale;

      // Clamp horizontally to viewport
      let left = centerX - popoverWidth / 2;
      if (left < 8) left = 8;
      if (left + popoverWidth > window.innerWidth - 8) left = window.innerWidth - popoverWidth - 8;

      const arrowLeft = Math.min(Math.max(centerX - left, 12), popoverWidth - 12);
      setPos({ left, top: nodeBottom, arrowLeft });
    };

    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [svgRef, svgX, svgY]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the click that opened the popover
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  if (!pos) return null;

  const latencyColor = node.latency > 100 ? 'text-red-500' : node.latency > 50 ? 'text-amber-500' : 'text-emerald-500';
  const lossColor = node.loss > 1 ? 'text-red-500' : 'text-emerald-500';
  const health = node.loss > 5 ? 'Critical' : node.loss > 1 ? 'Warning' : node.latency > 100 ? 'Warning' : 'Healthy';
  const healthColor = health === 'Critical' ? 'bg-red-500' : health === 'Warning' ? 'bg-amber-500' : 'bg-emerald-500';

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999]"
      style={{ left: `${pos.left}px`, top: `${pos.top}px`, width: `${popoverWidth}px` }}
    >
      {/* Arrow */}
      <div
        className="absolute -top-1.5 w-3 h-3 rotate-45 bg-slate-900 dark:bg-slate-800 border-l border-t border-slate-700/80 dark:border-slate-600"
        style={{ left: `${pos.arrowLeft - 6}px` }}
      />

      {/* Card */}
      <div className="relative mt-1 rounded-lg bg-slate-900 dark:bg-slate-800 border border-slate-700/80 dark:border-slate-600 shadow-2xl shadow-black/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: config?.dotColorHex || '#94a3b8' }}
            />
            <span className="text-[12px] font-bold text-white truncate">
              Hop {node.hopNumber}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${config?.dotColorHex || '#94a3b8'}20`, color: config?.dotColorHex || '#94a3b8' }}>
              {config?.label || node.zone}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-slate-500 hover:text-slate-300 transition p-0.5 -mr-1"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-2.5">
          {/* Identity */}
          <div>
            <div className="text-[11px] font-mono text-slate-200 leading-tight">
              {node.ip}
            </div>
            {node.label && node.label !== node.ip && (
              <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                {node.label}
              </div>
            )}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-slate-800/80 dark:bg-slate-700/40 px-2 py-1.5">
              <div className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold">Latency</div>
              <div className={`text-[13px] font-bold tabular-nums ${latencyColor}`}>
                {node.latency.toFixed(1)}<span className="text-[9px] font-normal ml-0.5">ms</span>
              </div>
            </div>
            <div className="rounded-md bg-slate-800/80 dark:bg-slate-700/40 px-2 py-1.5">
              <div className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold">Loss</div>
              <div className={`text-[13px] font-bold tabular-nums ${lossColor}`}>
                {node.loss.toFixed(1)}<span className="text-[9px] font-normal ml-0.5">%</span>
              </div>
            </div>
            <div className="rounded-md bg-slate-800/80 dark:bg-slate-700/40 px-2 py-1.5">
              <div className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold">Health</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${healthColor}`} />
                <span className="text-[10px] text-slate-300 font-medium">{health}</span>
              </div>
            </div>
          </div>

          {/* Network info */}
          {node.network && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-slate-500 font-medium">Network</span>
              <span className="text-cyan-400 font-mono">{node.asNumber ? `AS${node.asNumber}` : ''}</span>
              <span className="text-slate-400 truncate">{node.network.replace(/AS\s*\d+\s*/i, '').trim()}</span>
            </div>
          )}

          {/* Prefix */}
          {node.prefix && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-slate-500 font-medium">Prefix</span>
              <span className="text-slate-300 font-mono">{node.prefix}</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
