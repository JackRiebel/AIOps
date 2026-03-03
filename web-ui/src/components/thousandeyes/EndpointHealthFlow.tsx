'use client';

import { memo, useState, useId } from 'react';
import type { HealthSegment } from './types';

// ============================================================================
// EndpointHealthFlow — Animated endpoint health path visualization
// Clickable nodes with hover tooltip cards and curated AI context
// ============================================================================

export interface EndpointHealthFlowProps {
  segments: HealthSegment[];
  gatewayIP?: string;
  agentName?: string;
  agentPlatform?: string;
  agentIP?: string;
  metrics?: {
    connectionLatency?: number;
    connectionLoss?: number;
    gatewayLatency?: number;
    gatewayLoss?: number;
    internetLatency?: number;
    internetLoss?: number;
    appLatency?: number;
    appLoss?: number;
  };
  onSegmentClick?: (segmentId: string, context: string) => void;
}

interface FlowNodeDef {
  id: string;
  label: string;
  sublabel?: string;
  status: HealthSegment['status'];
}

const STATUS_COLORS: Record<string, { fill: string; stroke: string; text: string; glow: string }> = {
  healthy: { fill: '#dcfce7', stroke: '#22c55e', text: '#15803d', glow: '#22c55e' },
  warning: { fill: '#fef3c7', stroke: '#f59e0b', text: '#b45309', glow: '#f59e0b' },
  critical: { fill: '#fee2e2', stroke: '#ef4444', text: '#b91c1c', glow: '#ef4444' },
  unknown: { fill: '#f1f5f9', stroke: '#94a3b8', text: '#475569', glow: '#94a3b8' },
};

const STATUS_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  unknown: 'Unknown',
};

function getSegmentStatus(segments: HealthSegment[], label: string): HealthSegment['status'] {
  const seg = segments.find(s => s.label === label);
  return seg?.status || 'unknown';
}

function getOverallStatus(segments: HealthSegment[]): HealthSegment['status'] {
  if (segments.length === 0) return 'unknown';
  if (segments.some(s => s.status === 'critical')) return 'critical';
  if (segments.some(s => s.status === 'warning')) return 'warning';
  if (segments.every(s => s.status === 'healthy')) return 'healthy';
  return 'unknown';
}

function getNodeMetricLines(node: FlowNodeDef, props: EndpointHealthFlowProps): string[] {
  const { metrics } = props;
  const lines: string[] = [];
  if (node.id === 'agent') {
    if (props.agentPlatform) lines.push(props.agentPlatform);
    if (props.agentIP) lines.push(`IP: ${props.agentIP}`);
  } else if (node.id === 'connection') {
    if (metrics?.connectionLatency != null) lines.push(`Latency: ${metrics.connectionLatency.toFixed(0)}ms`);
    if (metrics?.connectionLoss != null && metrics.connectionLoss > 0) lines.push(`Loss: ${metrics.connectionLoss.toFixed(1)}%`);
    if (lines.length === 0) lines.push('No metrics yet');
  } else if (node.id === 'gateway') {
    if (props.gatewayIP) lines.push(`IP: ${props.gatewayIP}`);
    if (metrics?.gatewayLatency != null) lines.push(`Latency: ${metrics.gatewayLatency.toFixed(0)}ms`);
    if (metrics?.gatewayLoss != null && metrics.gatewayLoss > 0) lines.push(`Loss: ${metrics.gatewayLoss.toFixed(1)}%`);
  } else if (node.id === 'internet') {
    if (metrics?.internetLatency != null) lines.push(`Latency: ${metrics.internetLatency.toFixed(0)}ms`);
    if (metrics?.internetLoss != null && metrics.internetLoss > 0) lines.push(`Loss: ${metrics.internetLoss.toFixed(1)}%`);
    if (lines.length === 0) lines.push('No metrics yet');
  } else if (node.id === 'apps') {
    if (metrics?.appLatency != null) lines.push(`Latency: ${metrics.appLatency.toFixed(0)}ms`);
    if (metrics?.appLoss != null && metrics.appLoss > 0) lines.push(`Loss: ${metrics.appLoss.toFixed(1)}%`);
    if (lines.length === 0) lines.push('No metrics yet');
  }
  return lines;
}

function buildSegmentContext(node: FlowNodeDef, props: EndpointHealthFlowProps): string {
  const { agentName, agentPlatform, agentIP, metrics } = props;
  const parts: string[] = [];
  parts.push(`Analyze the "${node.label}" segment for endpoint agent "${agentName || 'Unknown'}".`);
  parts.push(`Status: ${node.status}.`);

  if (node.id === 'connection') {
    if (metrics?.connectionLatency != null) parts.push(`Latency: ${metrics.connectionLatency.toFixed(0)}ms.`);
    if (metrics?.connectionLoss != null) parts.push(`Loss: ${metrics.connectionLoss.toFixed(1)}%.`);
  } else if (node.id === 'gateway') {
    if (metrics?.gatewayLatency != null) parts.push(`Latency: ${metrics.gatewayLatency.toFixed(0)}ms.`);
    if (metrics?.gatewayLoss != null) parts.push(`Loss: ${metrics.gatewayLoss.toFixed(1)}%.`);
    if (props.gatewayIP) parts.push(`Gateway IP: ${props.gatewayIP}.`);
  } else if (node.id === 'internet') {
    if (metrics?.internetLatency != null) parts.push(`Latency: ${metrics.internetLatency.toFixed(0)}ms.`);
    if (metrics?.internetLoss != null) parts.push(`Loss: ${metrics.internetLoss.toFixed(1)}%.`);
  } else if (node.id === 'apps') {
    if (metrics?.appLatency != null) parts.push(`Latency: ${metrics.appLatency.toFixed(0)}ms.`);
    if (metrics?.appLoss != null) parts.push(`Loss: ${metrics.appLoss.toFixed(1)}%.`);
  }

  if (agentPlatform) parts.push(`Agent platform: ${agentPlatform}.`);
  if (agentIP) parts.push(`Agent IP: ${agentIP}.`);
  parts.push('What could cause this and how can it be fixed?');
  return parts.join(' ');
}

// ============================================================================
// Tooltip card rendered above hovered node
// ============================================================================

function TooltipCard({
  node,
  x,
  y,
  nodeWidth: nw,
  metricLines,
  isInteractive,
  filterId,
}: {
  node: FlowNodeDef;
  x: number;
  y: number;
  nodeWidth: number;
  metricLines: string[];
  isInteractive: boolean;
  filterId: string;
}) {
  const colors = STATUS_COLORS[node.status];
  const cardW = 200;
  const px = 16;
  const headerH = 34;
  const lineH = 20;
  const metricsBlockH = Math.max(metricLines.length * lineH, lineH);
  const aiBlockH = isInteractive ? 32 : 0;
  const gap = 10;
  const cardH = headerH + gap + metricsBlockH + (isInteractive ? gap : 0) + aiBlockH + 14;
  const cardX = x + nw / 2 - cardW / 2;
  const cardY = y - cardH - 16;
  const arrowY = cardY + cardH;
  const arrowCX = x + nw / 2;

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Drop shadow */}
      <filter id={`${filterId}-shadow`} x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.12" />
      </filter>

      <g filter={`url(#${filterId}-shadow)`}>
        {/* Card body — rounded white */}
        <rect
          x={cardX}
          y={cardY}
          width={cardW}
          height={cardH}
          rx={12}
          fill="white"
          stroke="#e2e8f0"
          strokeWidth={1}
        />

        {/* Colored header band */}
        <clipPath id={`${filterId}-clip`}>
          <rect x={cardX} y={cardY} width={cardW} height={headerH} rx={12} />
          <rect x={cardX} y={cardY + 6} width={cardW} height={headerH - 6} />
        </clipPath>
        <rect
          x={cardX}
          y={cardY}
          width={cardW}
          height={headerH}
          clipPath={`url(#${filterId}-clip)`}
          fill={colors.fill}
        />
        {/* Header bottom border */}
        <line
          x1={cardX}
          y1={cardY + headerH}
          x2={cardX + cardW}
          y2={cardY + headerH}
          stroke={colors.stroke}
          strokeOpacity={0.25}
          strokeWidth={1}
        />

        {/* Header content: dot + label + status badge */}
        <circle cx={cardX + px + 1} cy={cardY + headerH / 2} r={5} fill={colors.stroke} />
        <text
          x={cardX + px + 14}
          y={cardY + headerH / 2 + 1}
          dominantBaseline="central"
          fontSize={13}
          fontWeight={700}
          fill={colors.text}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {node.label}
        </text>
        {/* Status pill */}
        <rect
          x={cardX + cardW - px - 58}
          y={cardY + headerH / 2 - 10}
          width={58}
          height={20}
          rx={10}
          fill={colors.stroke}
          opacity={0.15}
        />
        <text
          x={cardX + cardW - px - 29}
          y={cardY + headerH / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fontWeight={600}
          fill={colors.text}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {STATUS_LABELS[node.status] || node.status}
        </text>

        {/* Metric lines */}
        {metricLines.map((line, i) => (
          <g key={i}>
            <text
              x={cardX + px}
              y={cardY + headerH + gap + 14 + i * lineH}
              fontSize={11}
              fill="#334155"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {line}
            </text>
          </g>
        ))}

        {/* AI action bar */}
        {isInteractive && (
          <g>
            <rect
              x={cardX + 10}
              y={cardY + cardH - aiBlockH - 8}
              width={cardW - 20}
              height={aiBlockH - 4}
              rx={8}
              fill="#ecfeff"
              stroke="#a5f3fc"
              strokeWidth={1}
            />
            {/* Sparkle icon (simplified star) */}
            <g transform={`translate(${cardX + 24}, ${cardY + cardH - aiBlockH + 6})`}>
              <path
                d="M4 0l1.2 2.8L8 4l-2.8 1.2L4 8l-1.2-2.8L0 4l2.8-1.2z"
                fill="#0891b2"
                transform="scale(0.9)"
              />
            </g>
            <text
              x={cardX + cardW / 2 + 4}
              y={cardY + cardH - aiBlockH + 12}
              textAnchor="middle"
              fontSize={10.5}
              fontWeight={600}
              fill="#0e7490"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Click to analyze with AI
            </text>
          </g>
        )}

        {/* Arrow pointer */}
        <polygon
          points={`${arrowCX - 8},${arrowY} ${arrowCX + 8},${arrowY} ${arrowCX},${arrowY + 10}`}
          fill="white"
          stroke="#e2e8f0"
          strokeWidth={1}
          strokeLinejoin="round"
        />
        {/* Cover line where arrow meets card */}
        <line
          x1={arrowCX - 9}
          y1={arrowY}
          x2={arrowCX + 9}
          y2={arrowY}
          stroke="white"
          strokeWidth={2.5}
        />
      </g>
    </g>
  );
}

// ============================================================================
// Main component
// ============================================================================

export const EndpointHealthFlow = memo((props: EndpointHealthFlowProps) => {
  const { segments, gatewayIP, metrics, onSegmentClick } = props;
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const isInteractive = !!onSegmentClick;
  const uid = useId().replace(/:/g, '');

  // Layout — generous spacing
  const nodeWidth = 150;
  const nodeHeight = 66;
  const nodeSpacing = 80;
  const topPadding = 90; // room for tooltip above nodes
  const bottomPadding = 36; // room for metrics below connections
  const width = 5 * nodeWidth + 4 * nodeSpacing + 40; // 40 side padding
  const height = topPadding + nodeHeight + bottomPadding;

  const flowNodes: FlowNodeDef[] = [
    { id: 'agent', label: 'Agent', sublabel: 'Endpoint', status: getOverallStatus(segments) },
    { id: 'connection', label: 'Connection', sublabel: metrics?.connectionLatency != null ? `${metrics.connectionLatency.toFixed(0)}ms` : undefined, status: getSegmentStatus(segments, 'Connection') },
    { id: 'gateway', label: 'Gateway', sublabel: gatewayIP || undefined, status: getSegmentStatus(segments, 'Gateway') },
    { id: 'internet', label: 'Internet', sublabel: metrics?.internetLatency != null ? `${metrics.internetLatency.toFixed(0)}ms` : undefined, status: getSegmentStatus(segments, 'Internet') },
    { id: 'apps', label: 'Applications', sublabel: metrics?.appLatency != null ? `${metrics.appLatency.toFixed(0)}ms` : undefined, status: getSegmentStatus(segments, 'Applications') },
  ];

  const connectionMetrics = [
    { latency: metrics?.connectionLatency, loss: metrics?.connectionLoss },
    { latency: metrics?.gatewayLatency, loss: metrics?.gatewayLoss },
    { latency: metrics?.internetLatency, loss: metrics?.internetLoss },
    { latency: metrics?.appLatency, loss: metrics?.appLoss },
  ];

  const startX = (width - (flowNodes.length * nodeWidth + (flowNodes.length - 1) * nodeSpacing)) / 2;
  const centerY = topPadding + nodeHeight / 2;

  const handleNodeClick = (node: FlowNodeDef) => {
    if (!onSegmentClick) return;
    onSegmentClick(node.id, buildSegmentContext(node, props));
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ minHeight: 160 }}
      overflow="visible"
    >
      <defs>
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <filter key={status} id={`${uid}-glow-${status}`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feFlood floodColor={colors.glow} floodOpacity="0.15" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
        <filter id={`${uid}-glow-hover`} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feFlood floodColor="#06b6d4" floodOpacity="0.35" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connection lines with animated packets */}
      {flowNodes.slice(0, -1).map((node, i) => {
        const fromX = startX + i * (nodeWidth + nodeSpacing) + nodeWidth;
        const toX = startX + (i + 1) * (nodeWidth + nodeSpacing);
        const y = centerY;
        const nextStatus = flowNodes[i + 1].status;
        const lineColor = STATUS_COLORS[nextStatus]?.stroke || '#94a3b8';
        const isFailing = nextStatus === 'critical';
        const metric = connectionMetrics[i];
        const midX = (fromX + toX) / 2;

        return (
          <g key={`conn-${node.id}`}>
            {/* Connection line */}
            <line
              x1={fromX + 6}
              y1={y}
              x2={toX - 6}
              y2={y}
              stroke={lineColor}
              strokeWidth={2}
              strokeDasharray={isFailing ? '6,4' : undefined}
              opacity={0.45}
            />
            {/* Arrow */}
            <polygon
              points={`${toX - 4},${y} ${toX - 12},${y - 5} ${toX - 12},${y + 5}`}
              fill={lineColor}
              opacity={0.55}
            />
            {/* Animated packet dots */}
            <circle r={3.5} fill={lineColor} opacity={0.8}>
              <animateMotion
                dur={isFailing ? '3s' : '2s'}
                repeatCount="indefinite"
                path={`M${fromX + 6},${y} L${toX - 6},${y}`}
              />
            </circle>
            <circle r={2.5} fill={lineColor} opacity={0.45}>
              <animateMotion
                dur={isFailing ? '3s' : '2s'}
                repeatCount="indefinite"
                begin="1s"
                path={`M${fromX + 6},${y} L${toX - 6},${y}`}
              />
            </circle>
            {/* Metrics label between nodes */}
            {(metric.latency != null || (metric.loss != null && metric.loss > 0)) && (
              <text
                x={midX}
                y={y + 28}
                textAnchor="middle"
                fontSize={10}
                fill="#64748b"
              >
                {metric.latency != null ? `${metric.latency.toFixed(0)}ms` : ''}
                {metric.latency != null && metric.loss != null && metric.loss > 0 ? ' · ' : ''}
                {metric.loss != null && metric.loss > 0 ? `${metric.loss.toFixed(1)}%` : ''}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {flowNodes.map((node, i) => {
        const x = startX + i * (nodeWidth + nodeSpacing);
        const y = centerY - nodeHeight / 2;
        const colors = STATUS_COLORS[node.status];
        const isHovered = hoveredNode === node.id;
        const filterUrl = isHovered && isInteractive
          ? `url(#${uid}-glow-hover)`
          : `url(#${uid}-glow-${node.status})`;

        return (
          <g
            key={node.id}
            style={{ cursor: isInteractive ? 'pointer' : 'default' }}
            onMouseEnter={() => isInteractive && setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => handleNodeClick(node)}
          >
            {/* Node card */}
            <g filter={filterUrl}>
              <rect
                x={x}
                y={y}
                width={nodeWidth}
                height={nodeHeight}
                rx={14}
                fill={colors.fill}
                stroke={isHovered && isInteractive ? '#06b6d4' : colors.stroke}
                strokeWidth={isHovered && isInteractive ? 2.5 : 1.5}
              />

              {/* Status dot */}
              <circle cx={x + 24} cy={y + nodeHeight / 2} r={11} fill={colors.stroke} opacity={0.15} />
              <circle cx={x + 24} cy={y + nodeHeight / 2} r={6} fill={colors.stroke} />

              {/* Label */}
              <text
                x={x + 46}
                y={y + nodeHeight / 2 - (node.sublabel ? 6 : 0)}
                dominantBaseline="central"
                fontSize={13}
                fontWeight={700}
                fill={colors.text}
              >
                {node.label}
              </text>

              {/* Sublabel */}
              {node.sublabel && (
                <text
                  x={x + 46}
                  y={y + nodeHeight / 2 + 13}
                  fontSize={10.5}
                  fill={colors.text}
                  opacity={0.65}
                >
                  {node.sublabel.length > 16 ? node.sublabel.slice(0, 15) + '..' : node.sublabel}
                </text>
              )}
            </g>

            {/* Hover tooltip card */}
            {isHovered && (
              <TooltipCard
                node={node}
                x={x}
                y={y}
                nodeWidth={nodeWidth}
                metricLines={getNodeMetricLines(node, props)}
                isInteractive={isInteractive}
                filterId={`${uid}-tip-${node.id}`}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
});

EndpointHealthFlow.displayName = 'EndpointHealthFlow';
