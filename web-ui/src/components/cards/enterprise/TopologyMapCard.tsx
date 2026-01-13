'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { DeviceIcon, DeviceType } from '../widgets/DeviceIcon';
import { StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import '../styles/cisco-theme.css';

export interface TopologyNode {
  id: string;
  name: string;
  type: DeviceType;
  model?: string;
  status: StatusLevel;
  ip?: string;
  position?: { x: number; y: number };
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  status: StatusLevel;
  bandwidth?: string;
  utilization?: number;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  layout: 'hierarchical' | 'force' | 'radial';
  options: {
    zoomable: boolean;
    pannable: boolean;
    selectable: boolean;
    showLabels: boolean;
  };
  summary: {
    total_devices: number;
    healthy: number;
    warning: number;
    offline: number;
  };
}

export interface TopologyMapCardProps {
  networkId: string;
  orgId?: string;
  title?: string;
  pollingInterval?: number;
  initialData?: TopologyData;
  onNodeClick?: (nodeId: string) => void;
  onDataUpdate?: (data: TopologyData) => void;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

export function TopologyMapCard({
  networkId,
  orgId,
  title = 'Network Topology',
  pollingInterval = 30000,
  initialData,
  onNodeClick,
  onDataUpdate,
}: TopologyMapCardProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const endpoint = `/api/cards/topology/${networkId}/data${orgId ? `?org_id=${orgId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<TopologyData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: TopologyData };
      return response.data || (raw as TopologyData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNode(nodeId === selectedNode ? null : nodeId);
    if (onNodeClick) {
      onNodeClick(nodeId);
    }
  }, [selectedNode, onNodeClick]);

  const handleZoom = useCallback((delta: number) => {
    setZoom((prev) => Math.min(2, Math.max(0.5, prev + delta)));
  }, []);

  // Build node position map
  const nodePositions = useMemo(() => {
    if (!data?.nodes) return {};
    const positions: Record<string, { x: number; y: number }> = {};
    data.nodes.forEach((node) => {
      if (node.position) {
        positions[node.id] = node.position;
      }
    });
    return positions;
  }, [data?.nodes]);

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load topology data</p>
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
          {data?.summary && (
            <p className="enterprise-card-subtitle">
              {data.summary.total_devices} devices
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={() => handleZoom(-0.1)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-xs text-gray-500 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => handleZoom(0.1)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
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

      {/* Body - Topology Canvas */}
      <div className="enterprise-card-body p-0 min-h-[400px] relative overflow-hidden bg-gray-50 dark:bg-gray-900">
        {loading && !data ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="skeleton w-full h-full" />
          </div>
        ) : data ? (
          <svg
            className="w-full h-full"
            viewBox="0 0 800 500"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: 'center',
            }}
          >
            {/* Edges */}
            <g className="edges">
              {data.edges.map((edge) => {
                const sourceNode = data.nodes.find((n) => n.id === edge.source);
                const targetNode = data.nodes.find((n) => n.id === edge.target);
                if (!sourceNode?.position || !targetNode?.position) return null;

                const x1 = sourceNode.position.x;
                const y1 = sourceNode.position.y;
                const x2 = targetNode.position.x;
                const y2 = targetNode.position.y;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                return (
                  <g key={edge.id}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={STATUS_COLORS[edge.status]}
                      strokeWidth={edge.utilization && edge.utilization > 70 ? 3 : 2}
                      strokeOpacity={0.8}
                    />
                    {edge.label && (
                      <>
                        <rect
                          x={midX - 25}
                          y={midY - 10}
                          width={50}
                          height={20}
                          rx={4}
                          fill="white"
                          stroke="#E0E0E0"
                        />
                        <text
                          x={midX}
                          y={midY + 4}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#6E6E6E"
                        >
                          {edge.label}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Nodes */}
            <g className="nodes">
              {data.nodes.map((node) => {
                if (!node.position) return null;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.position.x - 25}, ${node.position.y - 25})`}
                    onClick={() => handleNodeClick(node.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={0}
                      y={0}
                      width={50}
                      height={50}
                      rx={8}
                      fill="white"
                      stroke={STATUS_COLORS[node.status]}
                      strokeWidth={selectedNode === node.id ? 3 : 2}
                    />
                    <text
                      x={25}
                      y={70}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#6E6E6E"
                    >
                      {node.name.length > 12 ? node.name.slice(0, 10) + '...' : node.name}
                    </text>
                    {/* Device type indicator */}
                    <text
                      x={25}
                      y={30}
                      textAnchor="middle"
                      fontSize="20"
                      fill={node.status === 'offline' ? '#8E8E93' : '#1A1A1A'}
                    >
                      {node.type === 'router' && '\u2638'}
                      {node.type === 'switch' && '\u2630'}
                      {node.type === 'ap' && '\u25C9'}
                      {node.type === 'firewall' && '\u26E8'}
                      {node.type === 'server' && '\u25A1'}
                      {node.type === 'client' && '\u25A0'}
                      {node.type === 'cloud' && '\u2601'}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : null}

        {/* Legend */}
        {data && (
          <div className="absolute bottom-2 left-2 flex gap-3 bg-white/90 dark:bg-gray-800/90 p-2 rounded-md text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Online ({data.summary.healthy})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Warning ({data.summary.warning})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span>Offline ({data.summary.offline})</span>
            </div>
          </div>
        )}
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

export default TopologyMapCard;
