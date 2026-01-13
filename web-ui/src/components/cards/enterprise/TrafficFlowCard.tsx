'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import { MetricGrid } from '../widgets/MetricTile';
import { DataTable, Column } from '../widgets/DataTable';
import '../styles/cisco-theme.css';

export interface FlowNode {
  id: string;
  name: string;
  type: 'source' | 'destination' | 'intermediate';
  value: number;
  color?: string;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
  protocol?: string;
  color?: string;
}

export interface TopFlow {
  source: string;
  destination: string;
  protocol: string;
  port: number;
  bytes: string;
  packets: string;
  percentage: number;
}

export interface TrafficFlowData {
  nodes: FlowNode[];
  links: FlowLink[];
  top_flows: TopFlow[];
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
    status?: StatusLevel;
  }>;
  protocols: Array<{
    name: string;
    percentage: number;
    color: string;
  }>;
  time_range: string;
}

export interface TrafficFlowCardProps {
  networkId: string;
  orgId?: string;
  title?: string;
  pollingInterval?: number;
  initialData?: TrafficFlowData;
  onFlowClick?: (source: string, destination: string) => void;
  onDataUpdate?: (data: TrafficFlowData) => void;
}

const FLOW_COLUMNS: Column<TopFlow>[] = [
  { key: 'source', label: 'Source', width: '20%' },
  { key: 'destination', label: 'Destination', width: '20%' },
  { key: 'protocol', label: 'Protocol', width: '15%' },
  { key: 'bytes', label: 'Traffic', align: 'right', width: '20%' },
  {
    key: 'percentage',
    label: '%',
    align: 'right',
    width: '10%',
    render: (value) => `${(value as number).toFixed(1)}%`,
  },
];

const DEFAULT_COLORS = [
  '#049FD9', // Cisco Blue
  '#00A86B', // Green
  '#F5A623', // Orange
  '#9B59B6', // Purple
  '#E74C3C', // Red
  '#3498DB', // Light Blue
  '#1ABC9C', // Teal
  '#F39C12', // Yellow
];

export function TrafficFlowCard({
  networkId,
  orgId,
  title = 'Traffic Flow',
  pollingInterval = 30000,
  initialData,
  onFlowClick,
  onDataUpdate,
}: TrafficFlowCardProps) {
  const [view, setView] = useState<'sankey' | 'table'>('sankey');
  const [hoveredFlow, setHoveredFlow] = useState<string | null>(null);

  const endpoint = `/api/cards/traffic-flow/${networkId}/data${orgId ? `?org_id=${orgId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<TrafficFlowData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: TrafficFlowData };
      return response.data || (raw as TrafficFlowData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  // Simple Sankey-like visualization using SVG
  const renderSankeyDiagram = () => {
    if (!data?.nodes || !data?.links || data.nodes.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-500">
          No traffic flow data
        </div>
      );
    }

    const sources = data.nodes.filter((n) => n.type === 'source');
    const destinations = data.nodes.filter((n) => n.type === 'destination');
    const maxValue = Math.max(...data.links.map((l) => l.value), 1);

    const width = 400;
    const height = Math.max(200, Math.max(sources.length, destinations.length) * 40);
    const nodeWidth = 20;
    const padding = 20;

    // Position sources on the left
    const sourcePositions: Record<string, number> = {};
    sources.forEach((node, i) => {
      sourcePositions[node.id] = padding + (i * (height - 2 * padding)) / Math.max(sources.length - 1, 1);
    });

    // Position destinations on the right
    const destPositions: Record<string, number> = {};
    destinations.forEach((node, i) => {
      destPositions[node.id] = padding + (i * (height - 2 * padding)) / Math.max(destinations.length - 1, 1);
    });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-64">
        {/* Flow Links */}
        {data.links.map((link, i) => {
          const sourceY = sourcePositions[link.source] ?? height / 2;
          const targetY = destPositions[link.target] ?? height / 2;
          const thickness = Math.max(2, (link.value / maxValue) * 30);
          const linkId = `${link.source}-${link.target}`;
          const isHovered = hoveredFlow === linkId;
          const color = link.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];

          return (
            <g
              key={linkId}
              onMouseEnter={() => setHoveredFlow(linkId)}
              onMouseLeave={() => setHoveredFlow(null)}
              onClick={() => onFlowClick?.(link.source, link.target)}
              className="cursor-pointer"
            >
              <path
                d={`M ${nodeWidth + 10} ${sourceY}
                    C ${width / 2} ${sourceY}, ${width / 2} ${targetY}, ${width - nodeWidth - 10} ${targetY}`}
                fill="none"
                stroke={color}
                strokeWidth={thickness}
                opacity={isHovered ? 1 : 0.6}
                className="transition-opacity"
              />
              {isHovered && (
                <text
                  x={width / 2}
                  y={(sourceY + targetY) / 2 - 10}
                  textAnchor="middle"
                  className="text-xs fill-gray-700 dark:fill-gray-300"
                >
                  {link.protocol || ''} - {((link.value / maxValue) * 100).toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}

        {/* Source Nodes */}
        {sources.map((node, i) => {
          const y = sourcePositions[node.id] ?? 0;
          const color = node.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          return (
            <g key={node.id}>
              <rect
                x={0}
                y={y - 15}
                width={nodeWidth}
                height={30}
                fill={color}
                rx={4}
              />
              <text
                x={nodeWidth + 5}
                y={y + 4}
                className="text-xs fill-gray-700 dark:fill-gray-300"
              >
                {node.name}
              </text>
            </g>
          );
        })}

        {/* Destination Nodes */}
        {destinations.map((node, i) => {
          const y = destPositions[node.id] ?? 0;
          const color = node.color || DEFAULT_COLORS[(i + sources.length) % DEFAULT_COLORS.length];
          return (
            <g key={node.id}>
              <rect
                x={width - nodeWidth}
                y={y - 15}
                width={nodeWidth}
                height={30}
                fill={color}
                rx={4}
              />
              <text
                x={width - nodeWidth - 5}
                y={y + 4}
                textAnchor="end"
                className="text-xs fill-gray-700 dark:fill-gray-300"
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load traffic flow data</p>
          <button
            onClick={refresh}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="enterprise-card">
      {/* Header */}
      <div className="enterprise-card-header">
        <div>
          <h3 className="enterprise-card-title">{title}</h3>
          {data?.time_range && (
            <p className="enterprise-card-subtitle">{data.time_range}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setView('sankey')}
              className={`px-2 py-1 text-xs ${
                view === 'sankey'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              Flow
            </button>
            <button
              onClick={() => setView('table')}
              className={`px-2 py-1 text-xs ${
                view === 'table'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              Table
            </button>
          </div>
          <button
            onClick={isPaused ? resume : pause}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isPaused ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
              </svg>
            )}
          </button>
          <button
            onClick={refresh}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="enterprise-card-body">
        {loading && !data ? (
          <div className="space-y-4">
            <div className="skeleton h-48 rounded" />
            <div className="grid grid-cols-3 gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-12 rounded" />
              ))}
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <MetricGrid metrics={data.metrics} columns={4} size="sm" />
            )}

            {/* Sankey Diagram or Table */}
            {view === 'sankey' ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {renderSankeyDiagram()}
              </div>
            ) : (
              <DataTable
                columns={FLOW_COLUMNS}
                data={data.top_flows || []}
                maxRows={10}
                size="sm"
                searchable
              />
            )}

            {/* Protocol Distribution */}
            {data.protocols && data.protocols.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Protocol Distribution
                </h4>
                <div className="flex gap-1 h-6 rounded-md overflow-hidden">
                  {data.protocols.map((protocol) => (
                    <div
                      key={protocol.name}
                      className="relative group"
                      style={{
                        width: `${protocol.percentage}%`,
                        backgroundColor: protocol.color,
                        minWidth: protocol.percentage > 0 ? '2px' : '0',
                      }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {protocol.name}: {protocol.percentage.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {data.protocols.map((protocol) => (
                    <div key={protocol.name} className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: protocol.color }}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {protocol.name} ({protocol.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Flows (compact view in Sankey mode) */}
            {view === 'sankey' && data.top_flows && data.top_flows.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Top Flows
                </h4>
                <div className="space-y-1">
                  {data.top_flows.slice(0, 5).map((flow, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      onClick={() => onFlowClick?.(flow.source, flow.destination)}
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {flow.source} → {flow.destination}
                      </span>
                      <span className="text-gray-500">
                        {flow.bytes} ({flow.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="enterprise-card-footer">
        <span>Last updated: {formatTime(lastUpdated)}</span>
        <span className="flex items-center gap-1">
          <StatusIndicator
            status={isPaused ? 'offline' : 'healthy'}
            size="sm"
            showLabel={false}
          />
          <span>{isPaused ? 'Paused' : 'Live'}</span>
        </span>
      </div>
    </div>
  );
}

export default TrafficFlowCard;
