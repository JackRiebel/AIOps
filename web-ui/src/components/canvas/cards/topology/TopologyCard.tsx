'use client';

import React, { memo, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useTheme } from '@/contexts/ThemeContext';

// Import directly - we'll handle SSR with a mounted check
import ForceGraph2DImport from 'react-force-graph-2d';

interface TopologyNode {
    id: string;
    name: string;
    group: string;
    status: 'online' | 'alerting' | 'offline';
    val?: number;
    model?: string;
    ip?: string;
    clients?: number;
    fx?: number;  // Fixed x position
    fy?: number;  // Fixed y position
}

interface TopologyLink {
    source: string;
    target: string;
    status: 'active' | 'down';
    type?: string;
}

interface TopologyCardProps {
    data?: {
        nodes?: TopologyNode[];
        links?: TopologyLink[];
    };
    config?: Record<string, unknown>;
}

// Calculate tree layout positions for nodes
function calculateTreeLayout(
    nodes: TopologyNode[],
    links: TopologyLink[],
    levelWidth: number = 140,
    nodeSpacing: number = 70
): Map<string, { fx: number; fy: number }> {
    // Build children map from links
    const children = new Map<string, string[]>();
    const hasParent = new Set<string>();

    for (const link of links) {
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

        if (!children.has(sourceId)) children.set(sourceId, []);
        children.get(sourceId)!.push(targetId);
        hasParent.add(targetId);
    }

    // Find roots (nodes with no parent)
    const roots = nodes.filter(n => !hasParent.has(n.id)).map(n => n.id);
    if (roots.length === 0 && nodes.length > 0) {
        roots.push(nodes[0].id); // Fallback to first node
    }

    // BFS to assign levels
    const levels = new Map<string, number>();
    const queue: string[] = [...roots];
    for (const root of roots) {
        levels.set(root, 0);
    }

    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const currentLevel = levels.get(nodeId)!;
        const nodeChildren = children.get(nodeId) || [];

        for (const childId of nodeChildren) {
            if (!levels.has(childId)) {
                levels.set(childId, currentLevel + 1);
                queue.push(childId);
            }
        }
    }

    // Handle disconnected nodes
    for (const node of nodes) {
        if (!levels.has(node.id)) {
            levels.set(node.id, 0);
        }
    }

    // Group nodes by level
    const nodesByLevel = new Map<number, string[]>();
    let maxLevel = 0;
    for (const [nodeId, level] of levels) {
        if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
        nodesByLevel.get(level)!.push(nodeId);
        maxLevel = Math.max(maxLevel, level);
    }

    // Calculate positions - left to right tree
    const positions = new Map<string, { fx: number; fy: number }>();

    for (const [level, levelNodes] of nodesByLevel) {
        const totalHeight = (levelNodes.length - 1) * nodeSpacing;
        const startY = -totalHeight / 2;

        levelNodes.forEach((nodeId, idx) => {
            positions.set(nodeId, {
                fx: level * levelWidth,
                fy: startY + idx * nodeSpacing,
            });
        });
    }

    return positions;
}

// Simple tree data - guaranteed DAG structure
const DEMO_DATA = {
    nodes: [
        { id: 'wan', name: 'Internet', group: 'wan', status: 'online' as const, val: 20 },
        { id: 'fw', name: 'MX95 Firewall', group: 'firewall', status: 'online' as const, val: 18, model: 'MX95', ip: '192.168.1.1' },
        { id: 'sw1', name: 'Core Switch 1', group: 'switch', status: 'online' as const, val: 16, model: 'MS390' },
        { id: 'sw2', name: 'Core Switch 2', group: 'switch', status: 'online' as const, val: 16, model: 'MS390' },
        { id: 'ap1', name: 'Lobby AP', group: 'ap', status: 'online' as const, val: 12, model: 'MR56', clients: 15 },
        { id: 'ap2', name: 'Office AP', group: 'ap', status: 'alerting' as const, val: 12, model: 'MR56', clients: 28 },
        { id: 'ap3', name: 'Conf Room AP', group: 'ap', status: 'offline' as const, val: 12, model: 'MR46', clients: 0 },
        { id: 'cam', name: 'Security Cam', group: 'camera', status: 'online' as const, val: 10, model: 'MV72' },
        { id: 'printer', name: 'Printer', group: 'endpoint', status: 'online' as const, val: 10 },
    ],
    links: [
        { source: 'wan', target: 'fw', status: 'active' as const },
        { source: 'fw', target: 'sw1', status: 'active' as const },
        { source: 'fw', target: 'sw2', status: 'active' as const },
        { source: 'sw1', target: 'ap1', status: 'active' as const },
        { source: 'sw1', target: 'ap2', status: 'active' as const },
        { source: 'sw2', target: 'ap3', status: 'down' as const },
        { source: 'sw2', target: 'cam', status: 'active' as const },
        { source: 'ap2', target: 'printer', status: 'active' as const },
    ]
};

const TopologyCard = memo(({ data }: TopologyCardProps) => {
    const { demoMode } = useDemoMode();
    const { theme } = useTheme();
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
    const [mounted, setMounted] = useState(false);

    // Handle client-side only rendering
    useEffect(() => {
        setMounted(true);
    }, []);

    // Resize observer
    useEffect(() => {
        if (!containerRef.current) return;

        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDimensions({ width: rect.width, height: rect.height });
            }
        };

        updateDimensions();

        const resizeObserver = new ResizeObserver(() => {
            updateDimensions();
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [mounted]);

    // Auto-fit after graph renders (positions are fixed, so no need to wait long)
    useEffect(() => {
        if (mounted && graphRef.current && dimensions.width > 100) {
            const timer = setTimeout(() => {
                graphRef.current?.zoomToFit(400, 50);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [mounted, dimensions]);

    // Use demo data or provided data, with tree layout positions
    const graphData = useMemo(() => {
        const sourceData = (data?.nodes?.length) ? data : DEMO_DATA;
        const nodes = sourceData.nodes || [];
        const links = sourceData.links || [];

        // Calculate tree layout positions
        const positions = calculateTreeLayout(nodes as TopologyNode[], links as TopologyLink[]);

        // Apply fixed positions to nodes
        const nodesWithPositions = nodes.map(node => {
            const pos = positions.get(node.id);
            return {
                ...node,
                fx: pos?.fx ?? 0,
                fy: pos?.fy ?? 0,
            };
        });

        return {
            nodes: nodesWithPositions,
            links: links,
        };
    }, [data]);

    const isDark = theme === 'dark';

    // Color by status
    const getColor = useCallback((status: string) => {
        switch (status) {
            case 'online': return '#22c55e';
            case 'alerting': return '#f59e0b';
            case 'offline': return '#ef4444';
            default: return '#64748b';
        }
    }, []);

    // Custom node rendering
    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { x, y, name, status, val = 12 } = node;
        if (x === undefined || y === undefined) return;

        const size = val;
        const color = getColor(status);
        const fontSize = Math.max(9, 11 / globalScale);

        // Draw node
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = isDark ? '#1e293b' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
        const label = name?.length > 14 ? name.slice(0, 13) + '…' : name;
        ctx.fillText(label || node.id, x, y + size + 4);
    }, [getColor, isDark]);

    if (!mounted) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400">
                Loading topology...
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="h-full w-full relative bg-slate-50 dark:bg-slate-900"
            style={{ minHeight: '200px' }}
        >
            {/* Legend */}
            <div className="absolute top-2 left-2 z-10 p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm text-[10px] font-medium">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Online
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Alerting
                </div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Offline
                </div>
            </div>

            {/* Reset button */}
            <div className="absolute top-2 right-2 z-10">
                <button
                    onClick={() => graphRef.current?.zoomToFit(400, 80)}
                    className="px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded shadow-sm hover:bg-slate-100"
                >
                    Fit View
                </button>
            </div>

            {/* Force Graph */}
            {dimensions.width > 100 && dimensions.height > 100 && (
                <ForceGraph2DImport
                    ref={graphRef}
                    graphData={graphData}
                    width={dimensions.width}
                    height={dimensions.height}
                    backgroundColor="transparent"
                    // Nodes - using fx/fy for fixed tree layout positions
                    nodeId="id"
                    nodeCanvasObject={nodeCanvasObject}
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, (node.val || 12) + 5, 0, 2 * Math.PI);
                        ctx.fill();
                    }}
                    // Links
                    linkSource="source"
                    linkTarget="target"
                    linkColor={(link: any) => link.status === 'down' ? '#ef4444' : '#22c55e'}
                    linkWidth={(link: any) => link.status === 'down' ? 1.5 : 2}
                    linkDirectionalParticles={2}
                    linkDirectionalParticleWidth={3}
                    linkDirectionalParticleSpeed={0.008}
                    linkDirectionalParticleColor={() => '#22c55e'}
                    // Minimal physics - nodes have fixed positions via fx/fy
                    cooldownTicks={0}
                    // Interaction
                    onNodeClick={(node: any) => setSelectedNode(node)}
                    onBackgroundClick={() => setSelectedNode(null)}
                    enableNodeDrag={false}
                />
            )}

            {/* Debug info */}
            <div className="absolute bottom-2 left-2 text-[9px] text-slate-400 bg-white/50 dark:bg-slate-800/50 px-1 rounded">
                {dimensions.width}x{dimensions.height} | {graphData.nodes.length} nodes
            </div>

            {/* Selected node panel */}
            {selectedNode && (
                <div className="absolute bottom-2 right-2 z-10 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2.5">
                    <div className="flex justify-between items-start mb-1.5">
                        <span className="font-semibold text-xs text-slate-800 dark:text-white truncate">{selectedNode.name}</span>
                        <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-slate-600 ml-1">&times;</button>
                    </div>
                    <div className="text-[10px] space-y-0.5 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                            <span>Status:</span>
                            <span className={`font-medium ${
                                selectedNode.status === 'online' ? 'text-green-600' :
                                selectedNode.status === 'alerting' ? 'text-amber-600' : 'text-red-600'
                            }`}>{selectedNode.status}</span>
                        </div>
                        {selectedNode.model && <div className="flex justify-between"><span>Model:</span><span>{selectedNode.model}</span></div>}
                        {selectedNode.ip && <div className="flex justify-between"><span>IP:</span><span className="font-mono">{selectedNode.ip}</span></div>}
                    </div>
                </div>
            )}
        </div>
    );
});

TopologyCard.displayName = 'TopologyCard';

export { TopologyCard };
