'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { apiClient } from '@/lib/api-client';
import {
  OrgNetworkNode,
  OrgVpnEdge,
  OrgVpnTopology,
  NETWORK_ROLE_COLORS,
  VPN_TUNNEL_COLORS,
  STATUS_COLORS,
  VpnTunnelStatus,
} from '@/types/visualization';

interface OrgWideTopologyProps {
  organization: string;
  organizationId: string;
  organizationName?: string;
}

// Network role hierarchy for left-to-right layout
const NETWORK_HIERARCHY: Record<string, number> = {
  hub: 0,        // Hubs - leftmost (core)
  spoke: 1,      // Spokes - middle layer
  standalone: 2, // Standalone - rightmost (edge)
};

export default function OrgWideTopology({
  organization,
  organizationId,
  organizationName,
}: OrgWideTopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [_topology, setTopology] = useState<OrgVpnTopology | null>(null);
  const [nodes, setNodes] = useState<OrgNetworkNode[]>([]);
  const [edges, setEdges] = useState<OrgVpnEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<OrgNetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showStandalone, setShowStandalone] = useState(true);

  // Update dimensions based on the canvas container size using ResizeObserver
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const newWidth = Math.max(rect.width || 800, 400);
        const newHeight = Math.max(rect.height || 600, 400);
        setDimensions({ width: newWidth, height: newHeight });
      }
    };

    // Use ResizeObserver for reliable dimension tracking
    let observer: ResizeObserver | null = null;
    if (canvasRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateDimensions();
      });
      observer.observe(canvasRef.current);
    }

    // Initial update and fallback resize listener
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // Multiple delayed updates to catch layout shifts
    const timers = [
      setTimeout(updateDimensions, 50),
      setTimeout(updateDimensions, 150),
      setTimeout(updateDimensions, 300),
    ];

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
      timers.forEach(clearTimeout);
    };
  }, []);

  // Fetch org VPN topology data
  useEffect(() => {
    async function fetchTopology() {
      setLoading(true);
      setError(null);

      try {
        const data = await apiClient.getOrgVpnTopology(organization, organizationId);
        setTopology(data);

        if (!data.nodes || data.nodes.length === 0) {
          setError('No networks found in this organization');
          setNodes([]);
          setEdges([]);
        } else {
          // Apply hierarchical layout immediately
          const layoutedNodes = applyHierarchicalLayout(data.nodes, data.edges, dimensions);
          setNodes(layoutedNodes);
          setEdges(data.edges || []);
        }
      } catch (err) {
        console.error('Failed to fetch org VPN topology:', err);
        setError('Failed to load organization VPN topology');
        setNodes([]);
        setEdges([]);
      } finally {
        setLoading(false);
      }
    }

    if (organizationId && organization) {
      fetchTopology();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, organizationId, dimensions.width, dimensions.height]); // Using specific dimension props

  // Filter nodes based on showStandalone
  const visibleNodes = useMemo(() => {
    if (showStandalone) return nodes;
    return nodes.filter((n) => n.type !== 'standalone');
  }, [nodes, showStandalone]);

  // Filter edges to only include visible nodes
  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    return edges.filter((e) => {
      const sourceId = typeof e.source === 'string' ? e.source : e.source.id;
      const targetId = typeof e.target === 'string' ? e.target : e.target.id;
      return visibleIds.has(sourceId) && visibleIds.has(targetId);
    });
  }, [edges, visibleNodes]);

  // Handle node click
  const handleNodeClick = useCallback((node: OrgNetworkNode) => {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  // Calculate edge line coordinates
  const getEdgePath = useCallback(
    (edge: OrgVpnEdge) => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const targetNode = nodes.find((n) => n.id === targetId);

      if (!sourceNode || !targetNode || sourceNode.x === undefined || targetNode.x === undefined) {
        return null;
      }

      return {
        x1: sourceNode.x,
        y1: sourceNode.y || 0,
        x2: targetNode.x,
        y2: targetNode.y || 0,
      };
    },
    [nodes]
  );

  // Summary stats
  const stats = useMemo(() => {
    const hubs = visibleNodes.filter(n => n.type === 'hub').length;
    const spokes = visibleNodes.filter(n => n.type === 'spoke').length;
    const standalone = visibleNodes.filter(n => n.type === 'standalone').length;
    const reachable = visibleEdges.filter(e => e.status === 'reachable').length;
    const unreachable = visibleEdges.filter(e => e.status === 'unreachable').length;
    return { hubs, spokes, standalone, total: visibleNodes.length, reachable, unreachable };
  }, [visibleNodes, visibleEdges]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-280px)] min-h-[500px] flex items-center justify-center theme-bg-secondary rounded-xl border theme-border">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 theme-text-muted">Loading organization VPN topology...</p>
          <p className="text-sm theme-text-muted opacity-60 mt-1">This may take a moment for large organizations</p>
        </div>
      </div>
    );
  }

  if (error && nodes.length === 0) {
    return (
      <div className="h-[calc(100vh-280px)] min-h-[500px] flex items-center justify-center theme-bg-secondary rounded-xl border theme-border">
        <div className="text-center">
          <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h3 className="text-lg font-semibold theme-text-primary mb-2">No VPN Topology Data</h3>
          <p className="text-sm theme-text-muted max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] gap-4" ref={containerRef}>
      {/* Main Topology Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 theme-bg-secondary rounded-xl border theme-border overflow-hidden relative"
      >
        {/* Stats Bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Organization Info */}
            <div className="px-4 py-2 rounded-lg theme-bg-primary border theme-border shadow-lg">
              <p className="text-sm font-semibold theme-text-primary">{organizationName || organizationId}</p>
              <p className="text-xs theme-text-muted">{stats.total} networks • {visibleEdges.length} VPN tunnels</p>
            </div>

            {/* Status Summary */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg theme-bg-primary border theme-border shadow-lg">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: NETWORK_ROLE_COLORS.hub.fill }} />
                <span className="text-xs theme-text-secondary">{stats.hubs} Hubs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: NETWORK_ROLE_COLORS.spoke.fill }} />
                <span className="text-xs theme-text-secondary">{stats.spokes} Spokes</span>
              </div>
              {stats.unreachable > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-red-500" />
                  <span className="text-xs theme-text-secondary">{stats.unreachable} Down</span>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg theme-bg-primary border theme-border shadow-lg">
            {/* Show Standalone Toggle */}
            <label className="flex items-center gap-2 text-xs theme-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={showStandalone}
                onChange={(e) => setShowStandalone(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              Show Standalone
            </label>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute top-20 left-4 z-20 px-3 py-2 rounded-lg theme-bg-primary border theme-border shadow-lg">
          <p className="text-[10px] font-semibold theme-text-muted uppercase tracking-wider mb-2">Network Types</p>
          <div className="space-y-1.5">
            {Object.entries(NETWORK_ROLE_COLORS).map(([type, colors]) => (
              <div key={type} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded border"
                  style={{ backgroundColor: colors.fill, borderColor: colors.stroke }}
                />
                <span className="theme-text-secondary">{colors.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t theme-border">
            <p className="text-[10px] font-semibold theme-text-muted uppercase tracking-wider mb-1.5">VPN Status</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-0.5" style={{ backgroundColor: VPN_TUNNEL_COLORS.reachable }} />
                <span className="theme-text-secondary">Reachable</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-0.5" style={{ backgroundColor: VPN_TUNNEL_COLORS.unreachable }} />
                <span className="theme-text-secondary">Unreachable</span>
              </div>
            </div>
          </div>
        </div>

        {/* Flow Direction Indicator */}
        <div className="absolute bottom-4 left-4 z-20 px-3 py-2 rounded-lg theme-bg-primary border theme-border shadow-lg">
          <div className="flex items-center gap-2 text-xs theme-text-muted">
            <span>Hubs</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span>Spokes</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span>Standalone</span>
          </div>
        </div>

        {/* Zoom Controls */}
        <TransformWrapper
          initialScale={0.9}
          minScale={0.2}
          maxScale={3}
          centerOnInit
          limitToBounds={false}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1">
                <button
                  onClick={() => zoomIn()}
                  className="p-2 rounded-lg theme-bg-primary border theme-border shadow-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Zoom In"
                >
                  <svg className="w-4 h-4 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
                <button
                  onClick={() => zoomOut()}
                  className="p-2 rounded-lg theme-bg-primary border theme-border shadow-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Zoom Out"
                >
                  <svg className="w-4 h-4 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <button
                  onClick={() => resetTransform()}
                  className="p-2 rounded-lg theme-bg-primary border theme-border shadow-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Reset View"
                >
                  <svg className="w-4 h-4 theme-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                </button>
              </div>

              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%' }}
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  style={{ minWidth: dimensions.width, minHeight: dimensions.height }}
                >
                  {/* Grid pattern for visual reference */}
                  <defs>
                    <pattern id="vpn-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width={dimensions.width} height={dimensions.height} fill="url(#vpn-grid)" />

                  {/* Edges (VPN Tunnels) */}
                  <g className="edges">
                    {visibleEdges.map((edge, i) => {
                      const path = getEdgePath(edge);
                      if (!path) return null;

                      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
                      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
                      const isHighlighted =
                        hoveredNode === sourceId ||
                        hoveredNode === targetId ||
                        selectedNode?.id === sourceId ||
                        selectedNode?.id === targetId;

                      const tunnelColor = VPN_TUNNEL_COLORS[edge.status as VpnTunnelStatus] || VPN_TUNNEL_COLORS.unknown;

                      // Create curved path for better visualization
                      const midX = (path.x1 + path.x2) / 2;
                      const curveOffset = Math.abs(path.y1 - path.y2) * 0.2;
                      const pathD = `M ${path.x1} ${path.y1} Q ${midX} ${Math.min(path.y1, path.y2) - curveOffset} ${path.x2} ${path.y2}`;

                      return (
                        <g key={i}>
                          {/* Background line for glow effect */}
                          {isHighlighted && (
                            <path
                              d={pathD}
                              fill="none"
                              stroke={tunnelColor}
                              strokeWidth={8}
                              strokeOpacity={0.3}
                              className="transition-all duration-200"
                            />
                          )}
                          {/* Main line */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke={tunnelColor}
                            strokeWidth={isHighlighted ? 3 : 2}
                            strokeOpacity={isHighlighted ? 1 : 0.6}
                            strokeDasharray={edge.status === 'unreachable' ? '8,4' : undefined}
                            className="transition-all duration-200"
                          />
                        </g>
                      );
                    })}
                  </g>

                  {/* Nodes (Networks) - Clean enterprise-style circles with role labels */}
                  <g className="nodes">
                    {visibleNodes.map((node) => {
                      if (node.x === undefined) return null;

                      const colors = NETWORK_ROLE_COLORS[node.type];
                      const statusColors = STATUS_COLORS[node.status] || STATUS_COLORS.unknown;
                      const isHovered = hoveredNode === node.id;
                      const isSelected = selectedNode?.id === node.id;

                      // Size based on network role - hubs are larger
                      const size = node.type === 'hub' ? 56 : node.type === 'spoke' ? 48 : 40;
                      const halfSize = size / 2;

                      // Role label text
                      const roleLabel = node.type === 'hub' ? 'HUB' : node.type === 'spoke' ? 'SPK' : 'NET';

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x || 0}, ${node.y || 0})`}
                          onClick={() => handleNodeClick(node)}
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                          className="cursor-pointer"
                          style={{
                            filter: isHovered || isSelected
                              ? `drop-shadow(0 4px 12px ${statusColors.glow})`
                              : 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
                            transition: 'filter 0.2s ease',
                          }}
                        >
                          {/* Invisible hit area to prevent hover flicker */}
                          <circle r={size} fill="transparent" pointerEvents="all" />
                          {/* Selection indicator ring */}
                          {isSelected && (
                            <circle
                              r={halfSize + 6}
                              fill="none"
                              stroke="#06b6d4"
                              strokeWidth={2}
                              strokeDasharray="6 3"
                              className="animate-pulse"
                            />
                          )}

                          {/* Status pulse ring for alerting networks */}
                          {node.status === 'alerting' && (
                            <circle
                              r={halfSize + 4}
                              fill="none"
                              stroke={statusColors.border}
                              strokeWidth={2}
                              opacity={0.5}
                              className="animate-ping"
                            />
                          )}

                          {/* Background glow */}
                          <circle
                            r={halfSize + 2}
                            fill={statusColors.border}
                            opacity={0.15}
                          />

                          {/* Main circle */}
                          <circle
                            r={halfSize}
                            fill={colors.fill}
                            stroke={isSelected ? '#06b6d4' : colors.stroke}
                            strokeWidth={2}
                          />

                          {/* Network role label */}
                          <text
                            y={1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[12px] font-bold fill-white pointer-events-none select-none"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                          >
                            {roleLabel}
                          </text>

                          {/* Network name label below */}
                          <text
                            y={halfSize + 14}
                            textAnchor="middle"
                            className="text-[10px] fill-slate-600 dark:fill-slate-300 pointer-events-none select-none font-medium"
                          >
                            {(node.name || '').slice(0, 12)}
                            {(node.name || '').length > 12 ? '…' : ''}
                          </text>

                          {/* Status badge */}
                          <g transform={`translate(${halfSize - 8}, ${-halfSize})`}>
                            <circle
                              r={8}
                              fill={statusColors.border}
                              stroke="#fff"
                              strokeWidth={2}
                            />
                            {node.status === 'online' && (
                              <path
                                d="M-2.5 0.5L-0.5 2.5L3 -1"
                                stroke="#fff"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              />
                            )}
                            {node.status === 'alerting' && (
                              <>
                                <line x1="0" y1="-2" x2="0" y2="1" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
                                <circle cx="0" cy="3" r="1" fill="#fff" />
                              </>
                            )}
                            {node.status === 'offline' && (
                              <path
                                d="M-2 -2L2 2M2 -2L-2 2"
                                stroke="#fff"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                              />
                            )}
                          </g>

                          {/* Peer count badge (bottom left corner) */}
                          {node.peerCount > 0 && (
                            <g transform={`translate(${-halfSize + 6}, ${halfSize - 6})`}>
                              <circle
                                r={10}
                                fill="#06b6d4"
                                stroke="#fff"
                                strokeWidth={2}
                              />
                              <text
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="text-[9px] font-bold fill-white pointer-events-none select-none"
                              >
                                {node.peerCount}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

      {/* Right Panel - Network Details */}
      <div
        className={`w-96 theme-bg-secondary rounded-xl border theme-border overflow-hidden flex flex-col transition-all duration-300 ${
          selectedNode ? 'opacity-100' : 'opacity-50 pointer-events-none'
        }`}
      >
        {selectedNode ? (
          <>
            {/* Network Header */}
            <div className="p-4 border-b theme-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center border-2"
                    style={{
                      backgroundColor: NETWORK_ROLE_COLORS[selectedNode.type]?.fill || '#6b7280',
                      borderColor: NETWORK_ROLE_COLORS[selectedNode.type]?.stroke || '#4b5563',
                    }}
                  >
                    <span className="text-white font-bold text-xs">
                      {selectedNode.type === 'hub' ? 'HUB' : selectedNode.type === 'spoke' ? 'SPOKE' : 'NET'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold theme-text-primary">{selectedNode.name || 'Unnamed'}</h3>
                    <p className="text-xs theme-text-muted">{selectedNode.vpnMode}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <svg className="w-5 h-5 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status Badge */}
              <div className="mt-3 flex items-center gap-2">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${NETWORK_ROLE_COLORS[selectedNode.type]?.fill}20`,
                    color: NETWORK_ROLE_COLORS[selectedNode.type]?.fill,
                  }}
                >
                  {selectedNode.type.toUpperCase()}
                </span>
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${STATUS_COLORS[selectedNode.status]?.border || '#64748b'}20`,
                    color: STATUS_COLORS[selectedNode.status]?.border || '#64748b',
                  }}
                >
                  {selectedNode.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Network Info */}
              <div>
                <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2">Network Info</h4>
                <div className="space-y-1.5">
                  <InfoRow label="VPN Peers" value={String(selectedNode.peerCount)} />
                  <InfoRow label="Products" value={selectedNode.productTypes.join(', ')} />
                  {selectedNode.timeZone && <InfoRow label="Time Zone" value={selectedNode.timeZone} />}
                </div>
              </div>

              {/* Connected VPN Peers */}
              {selectedNode.merakiVpnPeers.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    VPN Peers ({selectedNode.merakiVpnPeers.length})
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedNode.merakiVpnPeers.map((peer, i) => {
                      const peerNode = nodes.find(n => n.id === peer.networkId);
                      return (
                        <button
                          key={i}
                          onClick={() => peerNode && handleNodeClick(peerNode)}
                          className="w-full flex items-center justify-between text-xs py-2 px-2 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left group"
                        >
                          <span className="theme-text-secondary truncate flex-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                            {peer.networkName || peer.networkId}
                          </span>
                          <span
                            className="ml-2 px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                              backgroundColor: `${VPN_TUNNEL_COLORS[peer.reachability as VpnTunnelStatus] || VPN_TUNNEL_COLORS.unknown}20`,
                              color: VPN_TUNNEL_COLORS[peer.reachability as VpnTunnelStatus] || VPN_TUNNEL_COLORS.unknown,
                            }}
                          >
                            {peer.reachability}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VPN Subnets */}
              {selectedNode.subnets.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    VPN Subnets ({selectedNode.subnets.filter(s => s.useVpn).length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedNode.subnets.filter((s) => s.useVpn).map((subnet, i) => (
                      <div key={i} className="text-xs font-mono theme-text-secondary py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        {subnet.localSubnet}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Hubs (for spoke networks) */}
              {selectedNode.connectedHubs.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2">
                    Connected Hubs ({selectedNode.connectedHubs.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedNode.connectedHubs.map((hubId, i) => {
                      const hubNode = nodes.find(n => n.id === hubId);
                      return (
                        <button
                          key={i}
                          onClick={() => hubNode && handleNodeClick(hubNode)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left group"
                        >
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold text-white group-hover:scale-105 transition-transform"
                            style={{ backgroundColor: NETWORK_ROLE_COLORS.hub.fill }}
                          >
                            HUB
                          </div>
                          <span className="text-sm theme-text-primary group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                            {hubNode?.name || hubId}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t theme-border">
              <button
                onClick={() => window.open(`https://dashboard.meraki.com/go/network/${selectedNode.id}`, '_blank')}
                className="w-full px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in Meraki Dashboard
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <svg className="w-12 h-12 theme-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <h3 className="font-semibold theme-text-primary mb-1">Select a Network</h3>
              <p className="text-sm theme-text-muted">Click on any network in the topology to view VPN details and connections</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Layout Algorithm - Hierarchical Left-to-Right (Hub → Spoke → Standalone)
// ============================================================================

function applyHierarchicalLayout(
  nodes: OrgNetworkNode[],
  edges: OrgVpnEdge[],
  dimensions: { width: number; height: number }
): OrgNetworkNode[] {
  if (nodes.length === 0) return nodes;

  // Group nodes by hierarchy level
  const levels: Map<number, OrgNetworkNode[]> = new Map();

  nodes.forEach(node => {
    const level = NETWORK_HIERARCHY[node.type] ?? 2;
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push({ ...node });
  });

  // Calculate positions using the actual dimensions
  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const levelCount = sortedLevels.length;
  const horizontalGap = dimensions.width / (levelCount + 1);
  const padding = 100;

  const positionedNodes: OrgNetworkNode[] = [];

  sortedLevels.forEach((level, levelIndex) => {
    const levelNodes = levels.get(level)!;
    const verticalGap = (dimensions.height - padding * 2) / (levelNodes.length + 1);
    const xPos = horizontalGap * (levelIndex + 1);

    levelNodes.forEach((node, nodeIndex) => {
      const yPos = padding + verticalGap * (nodeIndex + 1);
      positionedNodes.push({
        ...node,
        x: xPos,
        y: yPos,
      });
    });
  });

  return positionedNodes;
}

// ============================================================================
// Helper Components
// ============================================================================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default group">
      <span className="text-xs theme-text-muted group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">{label}</span>
      <span className="text-xs theme-text-primary">{value || '—'}</span>
    </div>
  );
}
