'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { apiClient } from '@/lib/api-client';
import {
  TopologyNode,
  TopologyEdge,
  DEVICE_COLORS,
  STATUS_COLORS,
  getDeviceType,
  getDeviceStatus,
} from '@/types/visualization';

interface NetworkTopologyProps {
  organization: string;
  networkId: string;
  networkName?: string;
}

// Device type hierarchy for left-to-right layout
const DEVICE_HIERARCHY: Record<string, number> = {
  MX: 0,    // Security Appliance - leftmost (gateway)
  Z: 0,     // Z-series Teleworker Gateway - WAN device (same tier as MX)
  MG: 0,    // Cellular Gateway - WAN device
  MS: 1,    // Switch - middle layer
  MR: 2,    // Wireless AP
  CW: 2,    // Cisco Wireless AP
  MV: 2,    // Camera - connected to switches via ethernet
  MT: 3,    // IoT Sensor - connected to APs via wireless (after APs)
  Client: 4, // Client devices - rightmost
  unknown: 2,
};

// Helper to format bytes into human-readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function NetworkTopology({ organization, networkId, networkName }: NetworkTopologyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [edges, setEdges] = useState<TopologyEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Client visibility state
  const [showClients, setShowClients] = useState(false);
  const [_clientCount, setClientCount] = useState(0);

  // Device incidents state
  interface DeviceEvent {
    id: number;
    source: string;
    event_type: string;
    severity: string;
    title: string;
    description?: string;
    timestamp: string;
    affected_resource?: string;
    incident_id?: number;
    incident?: {
      id: number;
      title: string;
      status: string;
      severity: string;
    };
  }
  const [deviceEvents, setDeviceEvents] = useState<DeviceEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Update dimensions based on the canvas container size using ResizeObserver
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        // Use the actual container size, ensuring minimum dimensions
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

  // Fetch topology data
  useEffect(() => {
    async function fetchTopology() {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.getNetworkTopology(organization, networkId, showClients);
        const transformedNodes = transformNodes(response);
        const transformedEdges = transformEdges(response, transformedNodes);

        // Update client count from response
        if (response.clientCount !== undefined) {
          setClientCount(response.clientCount);
        }

        if (transformedNodes.length === 0) {
          setError('No topology data available for this network');
          setNodes([]);
          setEdges([]);
        } else {
          // Apply hierarchical layout
          const layoutedNodes = applyHierarchicalLayout(transformedNodes, transformedEdges, dimensions);
          setNodes(layoutedNodes);
          setEdges(transformedEdges);
        }
      } catch (err) {
        console.error('Failed to fetch topology:', err);
        setError('Failed to load network topology.');
        setNodes([]);
        setEdges([]);
      } finally {
        setLoading(false);
      }
    }

    if (networkId && organization) {
      fetchTopology();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, networkId, dimensions.width, dimensions.height, showClients]); // Using specific dimension props

  // Request AI analysis for selected device
  const requestAiAnalysis = useCallback(async (device: TopologyNode) => {
    setAiLoading(true);
    setAiAnalysis(null);

    try {
      // Get device health data
      const healthData = await apiClient.getDeviceHealth(organization, device.serial, 86400);

      // Build context for AI
      const deviceContext = {
        name: device.name,
        model: device.model,
        type: device.type,
        status: device.status,
        serial: device.serial,
        lanIp: device.lanIp,
        wan1Ip: device.wan1Ip,
        healthData: healthData,
      };

      // Call AI analysis endpoint
      const response = await fetch('/api/ai/analyze-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          device: deviceContext,
          organization,
          networkId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAiAnalysis(result.analysis);
      } else {
        // Fallback to local analysis
        setAiAnalysis(generateLocalAnalysis(device, healthData));
      }
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAiAnalysis(generateLocalAnalysis(device, null));
    } finally {
      setAiLoading(false);
    }
  }, [organization, networkId]);

  // Fetch device events/incidents
  const fetchDeviceEvents = useCallback(async (device: TopologyNode) => {
    setEventsLoading(true);
    setDeviceEvents([]);

    try {
      // Search by device name (affected_resource stores device names)
      // Fall back to serial if no name
      const searchTerm = device.name || device.serial;
      const response = await fetch(`/api/events/device/${encodeURIComponent(searchTerm)}?hours=720`, {
        credentials: 'include',
      });

      if (response.ok) {
        const events = await response.json();
        setDeviceEvents(events);
      }
    } catch (err) {
      console.error('Failed to fetch device events:', err);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((node: TopologyNode) => {
    setSelectedNode(node);
    setAiAnalysis(null);
    setDeviceEvents([]);
    // Fetch events for this device
    fetchDeviceEvents(node);
  }, [fetchDeviceEvents]);

  // Calculate edge line coordinates
  const getEdgePath = (edge: TopologyEdge) => {
    const sourceNode = nodes.find(
      (n) => n.id === (typeof edge.source === 'string' ? edge.source : edge.source.id)
    );
    const targetNode = nodes.find(
      (n) => n.id === (typeof edge.target === 'string' ? edge.target : edge.target.id)
    );

    if (!sourceNode || !targetNode || sourceNode.x === undefined || targetNode.x === undefined) {
      return null;
    }

    return {
      x1: sourceNode.x,
      y1: sourceNode.y || 0,
      x2: targetNode.x,
      y2: targetNode.y || 0,
    };
  };

  // Summary stats
  const stats = useMemo(() => {
    const deviceNodes = nodes.filter(n => n.type !== 'Client');
    const clientNodes = nodes.filter(n => n.type === 'Client');
    const online = deviceNodes.filter(n => n.status === 'online').length;
    const offline = deviceNodes.filter(n => n.status === 'offline').length;
    const alerting = deviceNodes.filter(n => n.status === 'alerting').length;
    const clients = clientNodes.length;
    return { online, offline, alerting, total: deviceNodes.length, clients };
  }, [nodes]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-280px)] min-h-[500px] flex items-center justify-center theme-bg-secondary rounded-xl border theme-border">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 theme-text-muted">Loading network topology...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-280px)] min-h-[500px] flex items-center justify-center theme-bg-secondary rounded-xl border theme-border">
        <div className="text-center">
          <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold theme-text-primary mb-2">No Topology Data</h3>
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
            {/* Network Info */}
            <div className="px-4 py-2 rounded-lg theme-bg-primary border theme-border shadow-lg">
              <p className="text-sm font-semibold theme-text-primary">{networkName || networkId}</p>
              <p className="text-xs theme-text-muted">{stats.total} devices • {edges.length} connections{showClients && stats.clients > 0 ? ` • ${stats.clients} clients` : ''}</p>
            </div>

            {/* Client Toggle */}
            <button
              onClick={() => setShowClients(!showClients)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-lg transition-all ${
                showClients
                  ? 'bg-teal-500/20 border-teal-500/50 text-teal-400'
                  : 'theme-bg-primary theme-border theme-text-muted hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={showClients ? 'Hide Clients' : 'Show Clients'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium">{showClients ? 'Hide Clients' : 'Show Clients'}</span>
            </button>

            {/* Status Summary */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg theme-bg-primary border theme-border shadow-lg">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-xs theme-text-secondary">{stats.online}</span>
              </div>
              {stats.alerting > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs theme-text-secondary">{stats.alerting}</span>
                </div>
              )}
              {stats.offline > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-xs theme-text-secondary">{stats.offline}</span>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 rounded-lg theme-bg-primary border theme-border shadow-lg">
            {Object.entries(DEVICE_COLORS)
              .filter(([type]) => type !== 'unknown' && (type !== 'Client' || showClients))
              .slice(0, showClients ? 6 : 5)
              .map(([type, colors]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded border"
                    style={{ backgroundColor: colors.fill, borderColor: colors.stroke }}
                  />
                  <span className="text-xs theme-text-secondary">{type}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Flow Direction Indicator */}
        <div className="absolute bottom-4 left-4 z-20 px-3 py-2 rounded-lg theme-bg-primary border theme-border shadow-lg">
          <div className="flex items-center gap-2 text-xs theme-text-muted">
            <span>Gateway</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span>Switches</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span>Access Points</span>
            {showClients && (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span>Clients</span>
              </>
            )}
          </div>
        </div>

        {/* Zoom Controls */}
        <TransformWrapper
          initialScale={0.9}
          minScale={0.3}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
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
                    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width={dimensions.width} height={dimensions.height} fill="url(#grid)" />

                  {/* Edges with curved paths */}
                  <g className="edges">
                    {edges.map((edge, i) => {
                      const path = getEdgePath(edge);
                      if (!path) return null;

                      const isHighlighted =
                        hoveredNode &&
                        ((typeof edge.source === 'string' ? edge.source : edge.source.id) === hoveredNode ||
                          (typeof edge.target === 'string' ? edge.target : edge.target.id) === hoveredNode);

                      const isSelected =
                        selectedNode &&
                        ((typeof edge.source === 'string' ? edge.source : edge.source.id) === selectedNode.id ||
                          (typeof edge.target === 'string' ? edge.target : edge.target.id) === selectedNode.id);

                      // Create curved path for better visualization
                      const midX = (path.x1 + path.x2) / 2;
                      const curveOffset = Math.abs(path.y1 - path.y2) * 0.2;
                      const pathD = `M ${path.x1} ${path.y1} Q ${midX} ${Math.min(path.y1, path.y2) - curveOffset} ${path.x2} ${path.y2}`;

                      return (
                        <g key={i}>
                          {/* Shadow/glow for highlighted edges */}
                          {(isHighlighted || isSelected) && (
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#06b6d4"
                              strokeWidth={6}
                              strokeOpacity={0.3}
                              className="transition-all duration-200"
                            />
                          )}
                          <path
                            d={pathD}
                            fill="none"
                            stroke={isHighlighted || isSelected ? '#06b6d4' : '#64748b'}
                            strokeWidth={isHighlighted || isSelected ? 3 : 2}
                            strokeOpacity={isHighlighted || isSelected ? 1 : 0.4}
                            className="transition-all duration-200"
                          />
                        </g>
                      );
                    })}
                  </g>

                  {/* Nodes - Clean enterprise-style circles with type labels */}
                  <g className="nodes">
                    {nodes.map((node) => {
                      const colors = DEVICE_COLORS[node.type] || DEVICE_COLORS.unknown;
                      const statusColors = STATUS_COLORS[node.status] || STATUS_COLORS.unknown;
                      const isHovered = hoveredNode === node.id;
                      const isSelected = selectedNode?.id === node.id;
                      const isClient = node.type === 'Client';
                      const size = isClient ? 28 : 48;
                      const halfSize = size / 2;

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
                          }}
                        >
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

                          {/* Status pulse ring for alerting devices */}
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

                          {/* Device type label */}
                          <text
                            y={1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className={`font-bold fill-white pointer-events-none select-none ${isClient ? 'text-[10px]' : 'text-[12px]'}`}
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                          >
                            {node.type === 'unknown' ? '?' : node.type}
                          </text>

                          {/* Device name label below */}
                          <text
                            y={halfSize + 14}
                            textAnchor="middle"
                            className="text-[10px] fill-slate-600 dark:fill-slate-300 pointer-events-none select-none font-medium"
                          >
                            {(node.name || node.serial || '').slice(0, 12)}
                            {(node.name || node.serial || '').length > 12 ? '…' : ''}
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

      {/* Right Panel - Device Details + AI Analysis */}
      <div
        className={`w-96 theme-bg-secondary rounded-xl border theme-border overflow-hidden flex flex-col transition-all duration-300 ${
          selectedNode ? 'opacity-100' : 'opacity-50 pointer-events-none'
        }`}
      >
        {selectedNode ? (
          <>
            {/* Device Header */}
            <div className="p-4 border-b theme-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center border-2"
                    style={{
                      backgroundColor: DEVICE_COLORS[selectedNode.type]?.fill || '#6b7280',
                      borderColor: DEVICE_COLORS[selectedNode.type]?.stroke || '#4b5563',
                    }}
                  >
                    <span className="text-white font-bold">{selectedNode.type}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold theme-text-primary">{selectedNode.name || 'Unnamed'}</h3>
                    <p className="text-xs theme-text-muted font-mono">{selectedNode.model}</p>
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
                  className="px-2.5 py-1 rounded-full text-xs font-medium cursor-default hover:scale-105 transition-transform"
                  style={{
                    backgroundColor: `${STATUS_COLORS[selectedNode.status]?.border}20`,
                    color: STATUS_COLORS[selectedNode.status]?.border,
                  }}
                >
                  {selectedNode.status.toUpperCase()}
                </span>
                <span className="text-xs theme-text-muted cursor-default hover:text-slate-600 dark:hover:text-slate-400 transition-colors">Serial: {selectedNode.serial}</span>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Device Info */}
              <div>
                <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2">
                  {selectedNode.isClient ? 'Client Info' : 'Device Info'}
                </h4>
                <div className="space-y-1.5">
                  {selectedNode.lanIp && <InfoRow label="LAN IP" value={selectedNode.lanIp} mono />}
                  {selectedNode.wan1Ip && <InfoRow label="WAN IP" value={selectedNode.wan1Ip} mono />}
                  {selectedNode.mac && <InfoRow label="MAC" value={selectedNode.mac} mono />}
                  {selectedNode.firmware && <InfoRow label="Firmware" value={selectedNode.firmware} />}
                  {/* Client-specific fields */}
                  {selectedNode.isClient && (
                    <>
                      {selectedNode.connectedDeviceName && (
                        <InfoRow label="Connected To" value={selectedNode.connectedDeviceName} />
                      )}
                      {selectedNode.ssid && <InfoRow label="SSID" value={selectedNode.ssid} />}
                      {selectedNode.manufacturer && <InfoRow label="Manufacturer" value={selectedNode.manufacturer} />}
                      {selectedNode.os && <InfoRow label="OS" value={selectedNode.os} />}
                      {selectedNode.vlan !== undefined && <InfoRow label="VLAN" value={String(selectedNode.vlan)} />}
                      {selectedNode.usage && (
                        <InfoRow
                          label="Usage"
                          value={`↓ ${formatBytes(selectedNode.usage.recv)} / ↑ ${formatBytes(selectedNode.usage.sent)}`}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* AI Analysis Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Analysis
                  </h4>
                  <button
                    onClick={() => requestAiAnalysis(selectedNode)}
                    disabled={aiLoading}
                    className="px-3 py-1 text-xs rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {aiLoading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Analyze
                      </>
                    )}
                  </button>
                </div>

                {aiAnalysis ? (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 hover:border-purple-500/30 transition-colors cursor-default">
                    <div className="text-sm theme-text-secondary whitespace-pre-wrap">{aiAnalysis}</div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg theme-bg-primary border theme-border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default">
                    <p className="text-xs theme-text-muted text-center">
                      Click &quot;Analyze&quot; to get AI-powered insights about this device&apos;s health, performance, and recommendations.
                    </p>
                  </div>
                )}
              </div>

              {/* Device Incidents Section */}
              <div>
                {(() => {
                  // Extract unique incidents from events
                  const incidentMap = new Map<number, { id: number; title: string; status: string; severity: string; eventCount: number }>();
                  deviceEvents.forEach(event => {
                    if (event.incident && event.incident_id) {
                      if (!incidentMap.has(event.incident_id)) {
                        incidentMap.set(event.incident_id, {
                          id: event.incident_id,
                          title: event.incident.title,
                          status: event.incident.status,
                          severity: event.incident.severity,
                          eventCount: 1,
                        });
                      } else {
                        const existing = incidentMap.get(event.incident_id)!;
                        existing.eventCount++;
                      }
                    }
                  });
                  const incidents = Array.from(incidentMap.values());

                  return (
                    <>
                      <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Related Incidents ({incidents.length})
                      </h4>

                      {eventsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : incidents.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                          {/* Sort incidents by severity: critical > high > medium > low > info */}
                          {[...incidents]
                            .sort((a, b) => {
                              const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
                              return (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5);
                            })
                            .slice(0, 5)
                            .map((incident) => {
                              const severityColors: Record<string, string> = {
                                critical: 'bg-red-500',
                                high: 'bg-orange-500',
                                medium: 'bg-yellow-500',
                                low: 'bg-blue-500',
                                info: 'bg-slate-500',
                              };
                              const statusColors: Record<string, string> = {
                                open: 'text-red-500',
                                investigating: 'text-orange-500',
                                resolved: 'text-green-500',
                                closed: 'text-slate-500',
                              };
                              const dotColor = severityColors[incident.severity] || 'bg-slate-500';
                              const statusColor = statusColors[incident.status] || 'theme-text-muted';

                              return (
                                <button
                                  key={incident.id}
                                  onClick={() => {
                                    window.location.href = `/incidents?selected=${incident.id}`;
                                  }}
                                  className="w-full p-2.5 rounded-lg theme-bg-primary border theme-border hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600 transition-all text-left group"
                                >
                                  <div className="flex items-start gap-2">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium theme-text-primary line-clamp-2">
                                        {incident.title}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] font-medium uppercase ${statusColor}`}>
                                          {incident.status}
                                        </span>
                                        <span className="text-[10px] theme-text-muted">
                                          •
                                        </span>
                                        <span className="text-[10px] theme-text-muted">
                                          {incident.eventCount} event{incident.eventCount !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    </div>
                                    <svg className="w-4 h-4 theme-text-muted group-hover:text-cyan-500 transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </button>
                              );
                            })}
                          {incidents.length > 5 && (
                            <button
                              onClick={() => window.location.href = '/incidents'}
                              className="w-full text-center text-xs text-cyan-600 dark:text-cyan-400 hover:underline py-1"
                            >
                              View all {incidents.length} incidents →
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg theme-bg-primary border theme-border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default">
                          <p className="text-xs theme-text-muted text-center">
                            No incidents found for this device in the last 30 days.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Connected Devices */}
              <div>
                <h4 className="text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2">
                  Connections ({edges.filter(e =>
                    (typeof e.source === 'string' ? e.source : e.source.id) === selectedNode.id ||
                    (typeof e.target === 'string' ? e.target : e.target.id) === selectedNode.id
                  ).length})
                </h4>
                <div className="space-y-1.5">
                  {edges
                    .filter(e =>
                      (typeof e.source === 'string' ? e.source : e.source.id) === selectedNode.id ||
                      (typeof e.target === 'string' ? e.target : e.target.id) === selectedNode.id
                    )
                    .map((edge, i) => {
                      const otherId = (typeof edge.source === 'string' ? edge.source : edge.source.id) === selectedNode.id
                        ? (typeof edge.target === 'string' ? edge.target : edge.target.id)
                        : (typeof edge.source === 'string' ? edge.source : edge.source.id);
                      const otherNode = nodes.find(n => n.id === otherId);
                      if (!otherNode) return null;

                      return (
                        <button
                          key={i}
                          onClick={() => handleNodeClick(otherNode)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 transition-all text-left group"
                        >
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white group-hover:scale-105 transition-transform"
                            style={{ backgroundColor: DEVICE_COLORS[otherNode.type]?.fill || '#6b7280' }}
                          >
                            {otherNode.type}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm theme-text-primary truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{otherNode.name || otherNode.serial}</p>
                            <p className="text-xs theme-text-muted">
                              {edge.portFrom && edge.portTo ? `Port ${edge.portFrom} → ${edge.portTo}` : otherNode.model}
                            </p>
                          </div>
                          <div
                            className="w-2 h-2 rounded-full group-hover:scale-125 transition-transform"
                            style={{ backgroundColor: STATUS_COLORS[otherNode.status]?.border }}
                          />
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t theme-border space-y-2">
              <button
                onClick={() => window.open(`https://dashboard.meraki.com/go/device/${selectedNode.serial}`, '_blank')}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <h3 className="font-semibold theme-text-primary mb-1">Select a Device</h3>
              <p className="text-sm theme-text-muted">Click on any device in the topology to view details and AI analysis</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default group">
      <span className="text-xs theme-text-muted group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">{label}</span>
      <span className={`text-xs theme-text-primary ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

// ============================================================================
// Layout Algorithm - Hierarchical Left-to-Right
// ============================================================================

function applyHierarchicalLayout(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  dimensions: { width: number; height: number }
): TopologyNode[] {
  if (nodes.length === 0) return nodes;

  // Group nodes by hierarchy level
  const levels: Map<number, TopologyNode[]> = new Map();

  nodes.forEach(node => {
    const level = DEVICE_HIERARCHY[node.type] ?? 2;
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(node);
  });

  // Calculate positions using the actual dimensions
  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  const levelCount = sortedLevels.length;
  const horizontalGap = dimensions.width / (levelCount + 1);
  const padding = 40;

  const positionedNodes: TopologyNode[] = [];

  sortedLevels.forEach((level, levelIndex) => {
    const levelNodes = levels.get(level)!;
    const xPos = horizontalGap * (levelIndex + 1);

    // Calculate available height and spacing
    const availableHeight = dimensions.height - padding * 2;
    const nodeCount = levelNodes.length;

    // Calculate vertical gap - scale based on number of nodes
    // Use smaller gaps for clients (many nodes) vs devices (few nodes)
    const isClientLevel = level === DEVICE_HIERARCHY['Client'];
    const minGap = isClientLevel ? 30 : 60; // Smaller gap for clients

    let verticalGap: number;
    if (nodeCount === 1) {
      verticalGap = 0;
    } else {
      // Calculate gap that fits all nodes within available height
      const calculatedGap = availableHeight / (nodeCount + 1);
      verticalGap = Math.max(minGap, calculatedGap);
    }

    // Calculate total height needed
    const totalHeight = nodeCount === 1 ? 0 : verticalGap * (nodeCount + 1);

    // If total height exceeds available, compress the spacing
    if (totalHeight > availableHeight && nodeCount > 1) {
      verticalGap = availableHeight / (nodeCount + 1);
    }

    levelNodes.forEach((node, nodeIndex) => {
      let yPos: number;
      if (nodeCount === 1) {
        yPos = dimensions.height / 2;
      } else {
        // Start from padding and distribute evenly
        yPos = padding + verticalGap * (nodeIndex + 1);
      }

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
// Data Transformation Functions
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformNodes(response: any): TopologyNode[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawNodes: any[] = [];

  if (response.topology?.nodes) {
    rawNodes = response.topology.nodes;
  } else if (response.nodes) {
    rawNodes = response.nodes;
  } else if (Array.isArray(response)) {
    rawNodes = response;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rawNodes.map((node: any) => ({
    id: node.derivedId || node.id || node.serial || node.mac || `node-${Math.random()}`,
    serial: node.serial || node.device?.serial || '',
    name: node.name || node.device?.name || node.description || '',
    model: node.model || node.device?.model || '',
    type: getDeviceType(node.model || node.device?.model || ''),
    status: getDeviceStatus(node.status || node.device?.status),
    networkId: node.networkId || '',
    networkName: node.networkName || '',
    lat: node.lat,
    lng: node.lng,
    lanIp: node.lanIp || node.device?.lanIp,
    wan1Ip: node.wan1Ip || node.device?.wan1Ip,
    mac: node.mac || node.device?.mac,
    firmware: node.firmware || node.device?.firmware,
    // Client-specific fields
    isClient: node.isClient || false,
    manufacturer: node.manufacturer,
    os: node.os,
    vlan: node.vlan,
    ssid: node.ssid,
    usage: node.usage,
    connectedDeviceSerial: node.connectedDeviceSerial,
    connectedDeviceName: node.connectedDeviceName,
    recentDeviceName: node.recentDeviceName,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformEdges(response: any, nodes: TopologyNode[]): TopologyEdge[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawLinks: any[] = [];

  if (response.topology?.links) {
    rawLinks = response.topology.links;
  } else if (response.links) {
    rawLinks = response.links;
  } else if (response.edges) {
    rawLinks = response.edges;
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: TopologyEdge[] = [];

  for (const link of rawLinks) {
    let sourceId: string | undefined;
    let targetId: string | undefined;
    let portFrom: string | undefined;
    let portTo: string | undefined;

    if (link.ends && Array.isArray(link.ends) && link.ends.length >= 2) {
      const end0 = link.ends[0];
      const end1 = link.ends[1];
      sourceId = end0.node?.derivedId || end0.device?.serial || end0.node?.mac;
      targetId = end1.node?.derivedId || end1.device?.serial || end1.node?.mac;
      portFrom = end0.discovered?.lldp?.portId || end0.discovered?.cdp?.portId;
      portTo = end1.discovered?.lldp?.portId || end1.discovered?.cdp?.portId;
    } else {
      // Handle both object format (with derivedId/serial/mac) and simple string format
      if (typeof link.source === 'string') {
        sourceId = link.source;
      } else {
        sourceId = link.source?.derivedId || link.source?.serial || link.source?.mac || link.sourceSerial;
      }
      if (typeof link.target === 'string') {
        targetId = link.target;
      } else {
        targetId = link.target?.derivedId || link.target?.serial || link.target?.mac || link.targetSerial;
      }
      portFrom = link.portFrom || link.sourcePort;
      portTo = link.portTo || link.targetPort;
    }

    if (!sourceId || !targetId || !nodeIds.has(sourceId) || !nodeIds.has(targetId)) {
      continue;
    }

    edges.push({
      source: sourceId,
      target: targetId,
      type: link.type || 'ethernet',
      speed: link.speed,
      portFrom,
      portTo,
    });
  }
  return edges;
}

// ============================================================================
// Local AI Analysis Fallback
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateLocalAnalysis(device: TopologyNode, healthData: any): string {
  const lines: string[] = [];

  lines.push(`**Device Overview**`);
  lines.push(`${device.name || 'This device'} is a ${device.model} (${DEVICE_COLORS[device.type]?.label || device.type}).`);

  if (device.status === 'online') {
    lines.push(`\n**Status**: The device is currently online and operational.`);
  } else if (device.status === 'offline') {
    lines.push(`\n**Status**: ⚠️ The device is OFFLINE. Check power and network connectivity.`);
  } else {
    lines.push(`\n**Status**: ⚠️ The device has active alerts that may need attention.`);
  }

  if (healthData?.lossAndLatency?.timeSeries?.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latencies = healthData.lossAndLatency.timeSeries.map((d: any) => d.latencyMs || 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const losses = healthData.lossAndLatency.timeSeries.map((d: any) => d.lossPercent || 0);
    const avgLatency = latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length;
    const avgLoss = losses.reduce((a: number, b: number) => a + b, 0) / losses.length;

    lines.push(`\n**Performance (24h)**`);
    lines.push(`• Average Latency: ${avgLatency.toFixed(1)}ms ${avgLatency > 100 ? '⚠️ High' : '✓ Normal'}`);
    lines.push(`• Average Packet Loss: ${avgLoss.toFixed(2)}% ${avgLoss > 1 ? '⚠️ Elevated' : '✓ Healthy'}`);
  }

  lines.push(`\n**Recommendations**`);
  if (device.status !== 'online') {
    lines.push(`• Investigate the ${device.status} status immediately`);
    lines.push(`• Check physical connections and power supply`);
  } else {
    lines.push(`• Device is healthy - no immediate action required`);
    lines.push(`• Consider scheduling firmware updates if available`);
  }

  return lines.join('\n');
}
