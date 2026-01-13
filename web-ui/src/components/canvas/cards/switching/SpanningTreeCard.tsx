'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, type ActionState } from '@/services/cardActions';

interface STPPort {
  portId: string;
  name?: string;
  role: 'root' | 'designated' | 'alternate' | 'backup' | 'disabled';
  state: 'forwarding' | 'blocking' | 'listening' | 'learning' | 'disabled';
  cost?: number;
  priority?: number;
  neighborSwitch?: string;
  neighborPort?: string;
}

interface STPSwitch {
  serial: string;
  name: string;
  model?: string;
  bridgeId?: string;
  bridgePriority?: number;
  isRoot: boolean;
  rootBridgeId?: string;
  rootCost?: number;
  rootPort?: string;
  ports: STPPort[];
  macAddress?: string;
}

interface SpanningTreeCardData {
  switches?: STPSwitch[];
  rootBridge?: {
    serial?: string;
    name: string;
    bridgeId: string;
    priority: number;
  };
  stpMode?: 'rstp' | 'mstp' | 'pvst' | 'rapid-pvst';
  vlanId?: number;
  networkId?: string;
  topologyChanges?: number;
  lastTopologyChange?: string;
}

interface SpanningTreeCardProps {
  data: SpanningTreeCardData;
  config?: {
    showPortDetails?: boolean;
  };
}

const STATE_CONFIG: Record<string, { label: string; color: string; strokeColor: string }> = {
  forwarding: { label: 'FWD', color: '#22c55e', strokeColor: '#22c55e' },
  blocking: { label: 'BLK', color: '#ef4444', strokeColor: '#ef4444' },
  listening: { label: 'LIS', color: '#f59e0b', strokeColor: '#f59e0b' },
  learning: { label: 'LRN', color: '#3b82f6', strokeColor: '#3b82f6' },
  disabled: { label: 'DIS', color: '#64748b', strokeColor: '#64748b' },
};

const ROLE_CONFIG: Record<string, { label: string; icon: string }> = {
  root: { label: 'Root', icon: '⭐' },
  designated: { label: 'Designated', icon: '→' },
  alternate: { label: 'Alternate', icon: '↔' },
  backup: { label: 'Backup', icon: '⟲' },
  disabled: { label: 'Disabled', icon: '○' },
};

/**
 * SpanningTreeCard - Interactive STP Topology Visualization
 *
 * Shows:
 * - Visual tree topology with root at center
 * - Animated forwarding paths
 * - Blocking ports highlighted in red
 * - Click-to-expand switch details
 * - Force Root Election action
 */
export const SpanningTreeCard = memo(({ data, config }: SpanningTreeCardProps) => {
  const { demoMode } = useDemoMode();
  const [hoveredSwitch, setHoveredSwitch] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [selectedSwitch, setSelectedSwitch] = useState<STPSwitch | null>(null);
  const [showForceRoot, setShowForceRoot] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    // Generate mock data if no real data and demo mode is enabled
    if (!data && demoMode) {
      const mockSwitches: STPSwitch[] = [
        {
          serial: 'Q2XX-STP-001', name: 'Core-Root', isRoot: true, bridgePriority: 4096, rootPort: undefined,
          ports: [
            { portId: '1', role: 'designated', state: 'forwarding', cost: 4, neighborSwitch: 'Q2XX-STP-002', neighborPort: '1' },
            { portId: '2', role: 'designated', state: 'forwarding', cost: 4, neighborSwitch: 'Q2XX-STP-003', neighborPort: '1' },
          ]
        },
        {
          serial: 'Q2XX-STP-002', name: 'Dist-Switch-1', isRoot: false, bridgePriority: 32768, rootPort: '1',
          ports: [
            { portId: '1', role: 'root', state: 'forwarding', cost: 4, neighborSwitch: 'Q2XX-STP-001', neighborPort: '1' },
            { portId: '2', role: 'designated', state: 'forwarding', cost: 4, neighborSwitch: 'Q2XX-STP-004', neighborPort: '1' },
          ]
        },
        {
          serial: 'Q2XX-STP-003', name: 'Dist-Switch-2', isRoot: false, bridgePriority: 32768, rootPort: '1',
          ports: [
            { portId: '1', role: 'root', state: 'forwarding', cost: 4, neighborSwitch: 'Q2XX-STP-001', neighborPort: '2' },
            { portId: '2', role: 'alternate', state: 'blocking', cost: 4, neighborSwitch: 'Q2XX-STP-004', neighborPort: '2' },
          ]
        },
        {
          serial: 'Q2XX-STP-004', name: 'Access-Switch-1', isRoot: false, bridgePriority: 32768, rootPort: '1',
          ports: [
            { portId: '1', role: 'root', state: 'forwarding', cost: 4, neighborSwitch: 'Q2XX-STP-002', neighborPort: '2' },
            { portId: '2', role: 'alternate', state: 'blocking', cost: 4, neighborSwitch: 'Q2XX-STP-003', neighborPort: '2' },
          ]
        },
      ];
      // Calculate blocking count from mock ports
      const mockBlockingCount = mockSwitches.reduce((count, sw) =>
        count + (sw.ports || []).filter(p => p.state === 'blocking').length, 0
      );
      // Create positions for mock switches (simple layout)
      const mockPositions: Record<string, { x: number; y: number; level: number }> = {};
      mockSwitches.forEach((sw, idx) => {
        if (idx === 0) {
          mockPositions[sw.serial] = { x: 170, y: 30, level: 0 };
        } else if (idx <= 2) {
          mockPositions[sw.serial] = { x: idx === 1 ? 85 : 255, y: 90, level: 1 };
        } else {
          mockPositions[sw.serial] = { x: 170, y: 150, level: 2 };
        }
      });
      // Create mock links
      const mockLinks: { from: string; to: string; fromPort: string; toPort: string; state: string; role: string }[] = [
        { from: 'Q2XX-STP-001', to: 'Q2XX-STP-002', fromPort: '1', toPort: '1', state: 'forwarding', role: 'designated' },
        { from: 'Q2XX-STP-001', to: 'Q2XX-STP-003', fromPort: '2', toPort: '1', state: 'forwarding', role: 'designated' },
        { from: 'Q2XX-STP-002', to: 'Q2XX-STP-004', fromPort: '2', toPort: '1', state: 'forwarding', role: 'designated' },
        { from: 'Q2XX-STP-003', to: 'Q2XX-STP-004', fromPort: '2', toPort: '2', state: 'blocking', role: 'alternate' },
      ];
      return {
        switches: mockSwitches,
        rootSwitch: mockSwitches[0],
        blockingCount: mockBlockingCount,
        forwardingCount: mockSwitches.reduce((count, sw) =>
          count + (sw.ports || []).filter(p => p.state === 'forwarding').length, 0
        ),
        links: mockLinks,
        positions: mockPositions,
        stpMode: 'rstp',
        topologyChanges: 0,
      };
    }

    if (!data) return null;

    const switches = data.switches || [];
    if (switches.length === 0) return null;

    const rootSwitch = switches.find(s => s.isRoot) || switches[0];

    // Build topology - find connections between switches
    const links: { from: string; to: string; fromPort: string; toPort: string; state: string; role: string }[] = [];
    const seenLinks = new Set<string>();

    for (const sw of switches) {
      const ports = sw.ports || [];
      for (const port of ports) {
        if (port.neighborSwitch && port.neighborPort) {
          const linkKey = [sw.serial, port.neighborSwitch].sort().join('-');
          if (!seenLinks.has(linkKey)) {
            seenLinks.add(linkKey);
            links.push({
              from: sw.serial,
              to: port.neighborSwitch,
              fromPort: port.portId,
              toPort: port.neighborPort,
              state: port.state,
              role: port.role,
            });
          }
        }
      }
    }

    // Position switches in a tree layout
    // Root at top center, others below
    const positions: Record<string, { x: number; y: number; level: number }> = {};
    const width = 340;
    const height = 180;
    const centerX = width / 2;

    // BFS to assign levels from root
    const levels: Record<string, number> = {};
    const visited = new Set<string>();
    const queue: { serial: string; level: number }[] = [{ serial: rootSwitch.serial, level: 0 }];
    visited.add(rootSwitch.serial);

    while (queue.length > 0) {
      const { serial, level } = queue.shift()!;
      levels[serial] = level;

      for (const link of links) {
        let neighbor: string | null = null;
        if (link.from === serial && !visited.has(link.to)) {
          neighbor = link.to;
        } else if (link.to === serial && !visited.has(link.from)) {
          neighbor = link.from;
        }
        if (neighbor) {
          visited.add(neighbor);
          queue.push({ serial: neighbor, level: level + 1 });
        }
      }
    }

    // Assign any unvisited switches
    for (const sw of switches) {
      if (!visited.has(sw.serial)) {
        levels[sw.serial] = 1;
      }
    }

    // Group by level for positioning
    const byLevel: Record<number, string[]> = {};
    for (const [serial, level] of Object.entries(levels)) {
      if (!byLevel[level]) byLevel[level] = [];
      byLevel[level].push(serial);
    }

    const maxLevel = Math.max(...Object.values(levels), 0);
    const levelHeight = height / (maxLevel + 2);

    for (const [level, serials] of Object.entries(byLevel)) {
      const y = 30 + parseInt(level) * levelHeight;
      const count = serials.length;
      serials.forEach((serial, idx) => {
        const x = centerX - ((count - 1) * 70) / 2 + idx * 70;
        positions[serial] = { x, y, level: parseInt(level) };
      });
    }

    // Count port states
    const allPorts = switches.flatMap(s => s.ports || []);
    const blockingPorts = allPorts.filter(p => p?.state === 'blocking');
    const forwardingPorts = allPorts.filter(p => p?.state === 'forwarding');

    return {
      switches,
      rootSwitch,
      links,
      positions,
      stpMode: data.stpMode || 'rstp',
      blockingCount: blockingPorts.length,
      forwardingCount: forwardingPorts.length,
      topologyChanges: data.topologyChanges || 0,
    };
  }, [data, demoMode]);

  const handleForceRoot = useCallback(async (switchSerial: string) => {
    setActionState({ status: 'loading', message: 'Forcing root bridge election...' });

    const result = await executeCardAction('force-root-bridge', {
      serial: switchSerial,
      priority: 4096, // Lower priority = higher preference to become root
      networkId: data?.networkId,
    });

    if (result.success) {
      setActionState({ status: 'success', message: `${selectedSwitch?.name || switchSerial} is now root bridge` });
    } else {
      setActionState({ status: 'error', message: result.message });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
    setShowForceRoot(false);
    setSelectedSwitch(null);
  }, [data?.networkId, selectedSwitch?.name]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No STP data available
      </div>
    );
  }

  // SVG dimensions
  const width = 340;
  const height = 180;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Spanning Tree
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 uppercase">
              {processedData.stpMode}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {processedData.blockingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {processedData.blockingCount} BLK
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Topology Visualization */}
      <div className="flex-1 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Gradient for forwarding links */}
            <linearGradient id="forwardingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
            </linearGradient>
            {/* Gradient for blocking links */}
            <linearGradient id="blockingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.3" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="stpGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background grid */}
          <pattern id="stpGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
          </pattern>
          <rect width={width} height={height} fill="url(#stpGrid)" className="text-slate-400" />

          {/* Links between switches */}
          {processedData.links.map((link, idx) => {
            const fromPos = processedData.positions[link.from];
            const toPos = processedData.positions[link.to];
            if (!fromPos || !toPos) return null;

            const isBlocking = link.state === 'blocking';
            const linkId = `${link.from}-${link.to}`;
            const isHovered = hoveredLink === linkId ||
                             hoveredSwitch === link.from ||
                             hoveredSwitch === link.to;

            // Calculate path with slight curve
            const midX = (fromPos.x + toPos.x) / 2;
            const midY = (fromPos.y + toPos.y) / 2;
            const dx = toPos.x - fromPos.x;
            const offset = dx === 0 ? 10 : 0;
            const pathD = `M ${fromPos.x} ${fromPos.y} Q ${midX + offset} ${midY} ${toPos.x} ${toPos.y}`;
            const pathId = `stpPath-${idx}`;

            return (
              <g
                key={linkId}
                opacity={hoveredSwitch || hoveredLink ? (isHovered ? 1 : 0.2) : 0.8}
                onMouseEnter={() => setHoveredLink(linkId)}
                onMouseLeave={() => setHoveredLink(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Link path */}
                <path
                  id={pathId}
                  d={pathD}
                  fill="none"
                  stroke={isBlocking ? 'url(#blockingGradient)' : 'url(#forwardingGradient)'}
                  strokeWidth={isHovered ? 3 : 2}
                  strokeDasharray={isBlocking ? '4,4' : 'none'}
                  filter={isHovered ? 'url(#stpGlow)' : undefined}
                />

                {/* Animated particle for forwarding links */}
                {!isBlocking && (
                  <circle r="2.5" fill="#22c55e">
                    <animateMotion dur="1.5s" repeatCount="indefinite">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                )}

                {/* Blocking X indicator */}
                {isBlocking && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <circle r="8" fill="#ef4444" opacity="0.9" />
                    <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </g>
                )}

                {/* Port labels on hover */}
                {isHovered && (
                  <>
                    <text x={fromPos.x} y={fromPos.y + 25} fontSize="7" fill="#64748b" textAnchor="middle">
                      {link.fromPort}
                    </text>
                    <text x={toPos.x} y={toPos.y + 25} fontSize="7" fill="#64748b" textAnchor="middle">
                      {link.toPort}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Switches */}
          {processedData.switches.map((sw) => {
            const pos = processedData.positions[sw.serial];
            if (!pos) return null;

            const isRoot = sw.isRoot;
            const isHovered = hoveredSwitch === sw.serial;
            const isInvolvedInHoveredLink = hoveredLink && (
              hoveredLink.includes(sw.serial)
            );

            return (
              <g
                key={sw.serial}
                opacity={hoveredSwitch || hoveredLink ? (isHovered || isInvolvedInHoveredLink ? 1 : 0.4) : 1}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredSwitch(sw.serial)}
                onMouseLeave={() => setHoveredSwitch(null)}
                onClick={() => setSelectedSwitch(sw)}
              >
                {/* Switch node */}
                <rect
                  x={pos.x - 25}
                  y={pos.y - 15}
                  width="50"
                  height="30"
                  rx="4"
                  fill={isRoot ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.8)'}
                  stroke={isRoot ? '#f59e0b' : isHovered ? '#06b6d4' : '#64748b'}
                  strokeWidth={isHovered ? 2 : 1.5}
                  filter={isHovered ? 'url(#stpGlow)' : undefined}
                />

                {/* Root crown */}
                {isRoot && (
                  <text x={pos.x} y={pos.y - 20} fontSize="12" textAnchor="middle">
                    👑
                  </text>
                )}

                {/* Switch icon */}
                <g transform={`translate(${pos.x - 8}, ${pos.y - 8})`}>
                  <rect width="16" height="16" rx="2" fill="none" stroke={isRoot ? '#f59e0b' : '#64748b'} strokeWidth="1" />
                  <line x1="0" y1="5" x2="16" y2="5" stroke={isRoot ? '#f59e0b' : '#64748b'} strokeWidth="0.5" />
                  <line x1="0" y1="11" x2="16" y2="11" stroke={isRoot ? '#f59e0b' : '#64748b'} strokeWidth="0.5" />
                  {/* Port indicators */}
                  {[2, 6, 10, 14].map((x, i) => (
                    <circle key={i} cx={x} cy="13.5" r="1" fill={i < (sw.ports || []).filter(p => p?.state === 'forwarding').length ? '#22c55e' : '#64748b'} />
                  ))}
                </g>

                {/* Switch name */}
                <text
                  x={pos.x}
                  y={pos.y + 28}
                  fontSize="8"
                  fill={isHovered ? '#06b6d4' : '#94a3b8'}
                  textAnchor="middle"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                >
                  {sw.name.length > 10 ? sw.name.slice(0, 8) + '...' : sw.name}
                </text>

                {/* Priority badge */}
                <text
                  x={pos.x}
                  y={pos.y + 6}
                  fontSize="7"
                  fill={isRoot ? '#f59e0b' : '#94a3b8'}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {sw.bridgePriority || 32768}
                </text>

                {/* Hover tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={pos.x - 40}
                      y={pos.y - 50}
                      width="80"
                      height="28"
                      rx="4"
                      fill="rgba(15, 23, 42, 0.95)"
                      stroke="#06b6d4"
                      strokeWidth="1"
                    />
                    <text x={pos.x} y={pos.y - 38} fontSize="8" fill="white" textAnchor="middle" fontWeight="bold">
                      {sw.ports.filter(p => p.state === 'forwarding').length} FWD / {sw.ports.filter(p => p.state === 'blocking').length} BLK
                    </text>
                    {!isRoot && sw.rootCost !== undefined && (
                      <text x={pos.x} y={pos.y - 28} fontSize="7" fill="#94a3b8" textAnchor="middle">
                        Root Cost: {sw.rootCost}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <g transform="translate(10, 10)">
            <rect x="0" y="0" width="60" height="35" rx="4" fill="rgba(15, 23, 42, 0.7)" />
            <g transform="translate(5, 10)">
              <line x1="0" y1="0" x2="12" y2="0" stroke="#22c55e" strokeWidth="2" />
              <text x="16" y="3" fontSize="7" fill="#94a3b8">Forwarding</text>
            </g>
            <g transform="translate(5, 22)">
              <line x1="0" y1="0" x2="12" y2="0" stroke="#ef4444" strokeWidth="2" strokeDasharray="3,3" />
              <text x="16" y="3" fontSize="7" fill="#94a3b8">Blocking</text>
            </g>
          </g>

          {/* Stats badge */}
          <g transform={`translate(${width - 60}, 10)`}>
            <rect x="0" y="0" width="50" height="25" rx="4" fill="rgba(15, 23, 42, 0.7)" />
            <text x="25" y="10" fontSize="7" fill="#94a3b8" textAnchor="middle">Switches</text>
            <text x="25" y="20" fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">
              {processedData.switches.length}
            </text>
          </g>
        </svg>
      </div>

      {/* Selected Switch Details */}
      {selectedSwitch ? (
        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          {showForceRoot ? (
            <div className="p-3">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Force {selectedSwitch.name} as root bridge?
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                This will set priority to 4096 and trigger a topology recalculation.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleForceRoot(selectedSwitch.serial)}
                  className="flex-1 px-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded transition-colors"
                >
                  Force Root
                </button>
                <button
                  onClick={() => setShowForceRoot(false)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {selectedSwitch.isRoot && <span className="text-sm">👑</span>}
                  <div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {selectedSwitch.name}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Priority: {selectedSwitch.bridgePriority || 32768}
                      {!selectedSwitch.isRoot && selectedSwitch.rootCost !== undefined && ` · Cost: ${selectedSwitch.rootCost}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSwitch(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                <div>
                  <div className="text-sm font-bold text-emerald-500">
                    {selectedSwitch.ports.filter(p => p.state === 'forwarding').length}
                  </div>
                  <div className="text-[8px] text-slate-500">FWD</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-red-500">
                    {selectedSwitch.ports.filter(p => p.state === 'blocking').length}
                  </div>
                  <div className="text-[8px] text-slate-500">BLK</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-amber-500">
                    {selectedSwitch.ports.filter(p => p.role === 'root').length}
                  </div>
                  <div className="text-[8px] text-slate-500">Root</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {selectedSwitch.ports.length}
                  </div>
                  <div className="text-[8px] text-slate-500">Total</div>
                </div>
              </div>

              {!selectedSwitch.isRoot && (
                <button
                  onClick={() => setShowForceRoot(true)}
                  className="mt-2 w-full px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Force Root Election
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        // Port states summary
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[9px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600 dark:text-slate-400">
                  {processedData.forwardingCount} forwarding
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-slate-600 dark:text-slate-400">
                  {processedData.blockingCount} blocking
                </span>
              </div>
            </div>
            <span className="text-[9px] text-slate-400">
              Click switch for details
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

SpanningTreeCard.displayName = 'SpanningTreeCard';

export default SpanningTreeCard;
