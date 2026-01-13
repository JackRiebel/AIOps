'use client';

import React from 'react';
import { StatusLevel } from './StatusIndicator';

export interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  status?: StatusLevel;
  label?: string;
  utilization?: number; // 0-100
  animated?: boolean;
  strokeWidth?: number;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

export function ConnectionLine({
  x1,
  y1,
  x2,
  y2,
  status = 'healthy',
  label,
  utilization,
  animated = false,
  strokeWidth = 2,
}: ConnectionLineProps) {
  const color = STATUS_COLORS[status];

  // Calculate midpoint for label
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Calculate line length for dash animation
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

  return (
    <g>
      {/* Background line (for visual depth) */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#E0E0E0"
        strokeWidth={strokeWidth + 2}
        strokeLinecap="round"
      />

      {/* Main connection line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={animated ? '8 4' : undefined}
        className={animated ? 'animate-dash' : undefined}
      />

      {/* Utilization indicator (if provided) */}
      {utilization !== undefined && (
        <line
          x1={x1}
          y1={y1}
          x2={x1 + (x2 - x1) * (utilization / 100)}
          y2={y1 + (y2 - y1) * (utilization / 100)}
          stroke={utilization > 80 ? '#D0021B' : utilization > 60 ? '#F5A623' : '#00A86B'}
          strokeWidth={strokeWidth + 1}
          strokeLinecap="round"
          opacity={0.7}
        />
      )}

      {/* Label background and text */}
      {label && (
        <>
          <rect
            x={midX - 20}
            y={midY - 8}
            width={40}
            height={16}
            rx={4}
            fill="white"
            stroke="#E0E0E0"
            strokeWidth={1}
          />
          <text
            x={midX}
            y={midY + 4}
            textAnchor="middle"
            fontSize={10}
            fill="#6E6E6E"
          >
            {label}
          </text>
        </>
      )}
    </g>
  );
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  status?: StatusLevel;
  utilization?: number;
}

export interface TopologyNode {
  id: string;
  x: number;
  y: number;
}

export interface ConnectionLayerProps {
  edges: TopologyEdge[];
  nodes: Record<string, TopologyNode>;
  animated?: boolean;
}

export function ConnectionLayer({
  edges,
  nodes,
  animated = false,
}: ConnectionLayerProps) {
  return (
    <g className="connections">
      {edges.map((edge) => {
        const sourceNode = nodes[edge.source];
        const targetNode = nodes[edge.target];

        if (!sourceNode || !targetNode) return null;

        return (
          <ConnectionLine
            key={edge.id}
            x1={sourceNode.x}
            y1={sourceNode.y}
            x2={targetNode.x}
            y2={targetNode.y}
            status={edge.status}
            label={edge.label}
            utilization={edge.utilization}
            animated={animated}
          />
        );
      })}
    </g>
  );
}

export default ConnectionLine;
