'use client';

import { useState, useCallback, useMemo, useEffect, useRef, memo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  Panel,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Eye,
  EyeOff,
  Layers,
  Wifi,
  Shield,
  Server,
  Monitor,
  Camera,
  Radio,
  Cpu,
  Smartphone,
  Network as NetworkIcon,
  Globe,
  AlertTriangle,
  Activity,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  BarChart3,
  Info,
} from 'lucide-react';
import type { VisualizationHubState } from './useVisualizationHub';
import { isAgentOnline } from '@/components/thousandeyes/types';
import type { Alert, TestHealthCell } from '@/components/thousandeyes/types';
import {
  DEVICE_COLORS,
  STATUS_COLORS,
  NETWORK_ROLE_COLORS,
  VPN_TUNNEL_COLORS,
  type DeviceType,
  type TopologyNode,
  type TopologyEdge,
  type OrgNetworkNode,
  type OrgVpnEdge,
} from '@/types/visualization';
import { useTopologyLayout } from './hooks/useTopologyLayout';
import type { LayoutType } from './TopologyToolbar';

// ============================================================================
// Types
// ============================================================================

interface NetworkMapViewProps {
  hub: VisualizationHubState;
  networkName: string;
}

type ViewMode = 'network' | 'vpn';
type DetailTab = 'overview' | 'te' | 'peers';

interface DeviceNodeData {
  label: string;
  deviceType: DeviceType;
  status: string;
  model: string;
  serial: string;
  lanIp?: string;
  wan1Ip?: string;
  firmware?: string;
  hasTEAgent: boolean;
  teTestCount: number;
  teAlertCount: number;
  isClient?: boolean;
  [key: string]: unknown;
}

interface VpnNodeData {
  label: string;
  role: 'hub' | 'spoke' | 'standalone';
  status: string;
  peerCount: number;
  productTypes: string[];
  subnetCount: number;
  hasTECoverage: boolean;
  teTestCount: number;
  [key: string]: unknown;
}

// ============================================================================
// Device Icon Map
// ============================================================================

const DEVICE_ICONS: Record<DeviceType, React.ComponentType<{ className?: string }>> = {
  MX: Shield,
  MS: Server,
  MR: Wifi,
  MV: Camera,
  MG: Radio,
  MT: Cpu,
  Z: Smartphone,
  CW: Wifi,
  Client: Monitor,
  unknown: Server,
};

// ============================================================================
// Custom Node: Enhanced Device
// ============================================================================

const DeviceNode = memo(({ data, selected }: NodeProps<Node<DeviceNodeData>>) => {
  const deviceType = data.deviceType || 'unknown';
  const colors = DEVICE_COLORS[deviceType];
  const statusKey = (data.status as keyof typeof STATUS_COLORS) || 'unknown';
  const statusColors = STATUS_COLORS[statusKey];
  const Icon = DEVICE_ICONS[deviceType];
  const isOffline = data.status === 'offline';
  const isAlerting = data.status === 'alerting';

  // Status-based border color
  const borderColor = selected ? '#06b6d4'
    : isOffline ? '#ef4444'
    : isAlerting ? '#f59e0b'
    : '#e2e8f0';

  const darkBorderColor = selected ? '#06b6d4'
    : isOffline ? '#ef4444'
    : isAlerting ? '#f59e0b'
    : '#334155';

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-transparent !border-0 !-top-0.5" />
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-transparent !border-0 !-bottom-0.5" />
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-transparent !border-0 !-left-0.5" id="left" />
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-transparent !border-0 !-right-0.5" id="right" />

      <div
        className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg border min-w-[160px] bg-white dark:bg-slate-800 ${
          selected ? 'ring-2 ring-cyan-500/50 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''
        } ${isOffline ? 'opacity-70' : ''}`}
        style={{ borderColor, ['--dark-border' as string]: darkBorderColor }}
      >
        {/* Icon */}
        <div
          className="relative w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${colors.fill}15` }}
        >
          <span style={{ color: colors.fill }}><Icon className="w-4.5 h-4.5" /></span>
          {/* Status indicator */}
          <div
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800"
            style={{ backgroundColor: statusColors.border }}
          />
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
            {data.label}
          </span>
          <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate leading-tight">
            {data.model}
          </span>
          {(data.lanIp || data.wan1Ip) && (
            <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 truncate leading-tight mt-0.5">
              {data.lanIp || data.wan1Ip}
            </span>
          )}
        </div>

        {/* TE badge */}
        {data.hasTEAgent && (
          <div className={`absolute -top-2.5 -right-2.5 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-orange-500 text-white text-[8px] font-bold shadow-lg shadow-orange-500/40 ring-2 ring-orange-400/50 ${data.teAlertCount > 0 ? 'animate-pulse' : ''}`}>
            <Globe className="w-3 h-3" />
            {data.teTestCount}
          </div>
        )}

        {/* Micro TE quality bar */}
        {data.hasTEAgent && (
          <div className="absolute -bottom-1 left-3 right-3 h-0.5 rounded-full bg-orange-400/60" />
        )}

        {/* Alert badge */}
        {data.teAlertCount > 0 && (
          <div className="absolute -top-2 -left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[7px] font-bold">
            <AlertTriangle className="w-2.5 h-2.5" />
            {data.teAlertCount}
          </div>
        )}

        {/* Offline indicator stripe */}
        {isOffline && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-red-500 rounded-t-lg" />
        )}
        {isAlerting && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-amber-500 rounded-t-lg" />
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
        <div className="bg-slate-900 text-white text-[10px] rounded-lg p-3 shadow-xl whitespace-nowrap border border-slate-700 min-w-[180px]">
          <div className="font-semibold text-xs mb-1.5">{data.label}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-300">
            <span className="text-slate-500">Model</span><span>{data.model}</span>
            <span className="text-slate-500">Serial</span><span className="font-mono text-[9px]">{data.serial}</span>
            {data.lanIp && <><span className="text-slate-500">LAN IP</span><span className="font-mono text-[9px]">{data.lanIp}</span></>}
            {data.wan1Ip && <><span className="text-slate-500">WAN IP</span><span className="font-mono text-[9px]">{data.wan1Ip}</span></>}
            {data.firmware && <><span className="text-slate-500">Firmware</span><span className="text-[9px]">{data.firmware}</span></>}
            <span className="text-slate-500">Status</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColors.border }} />
              {data.status}
            </span>
          </div>
          {data.hasTEAgent && (
            <div className="mt-1.5 pt-1.5 bg-orange-500/5 border border-orange-500/20 rounded px-2 py-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <Globe className="w-2.5 h-2.5 text-orange-400" />
                <span className="text-orange-400 font-medium">ThousandEyes</span>
              </div>
              <span className="text-slate-400">{data.teTestCount} tests</span>
              {data.teAlertCount > 0 && <span className="text-red-400 ml-1.5">{data.teAlertCount} alerts</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
DeviceNode.displayName = 'DeviceNode';

// ============================================================================
// Custom Node: Enhanced VPN Network
// ============================================================================

const VpnNode = memo(({ data, selected }: NodeProps<Node<VpnNodeData>>) => {
  const role = data.role || 'standalone';
  const roleColors = NETWORK_ROLE_COLORS[role];
  const statusKey = (data.status as keyof typeof STATUS_COLORS) || 'unknown';
  const statusColors = STATUS_COLORS[statusKey];
  const isOffline = data.status === 'offline' || data.status === 'unreachable';

  const RoleIcon = role === 'hub' ? Shield : role === 'spoke' ? NetworkIcon : Server;

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-transparent !border-0 !-top-0.5" />
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-transparent !border-0 !-bottom-0.5" />
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-transparent !border-0 !-left-0.5" id="left" />
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-transparent !border-0 !-right-0.5" id="right" />

      <div
        className={`relative flex flex-col px-4 py-3 rounded-lg border min-w-[180px] bg-white dark:bg-slate-800 ${
          selected ? 'ring-2 ring-cyan-500/50 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''
        } ${isOffline ? 'opacity-60' : ''}`}
        style={{ borderColor: selected ? '#06b6d4' : isOffline ? '#ef4444' : `${roleColors.fill}50` }}
      >
        {/* Role badge + status */}
        <div className="flex items-center justify-between mb-2">
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold text-white"
            style={{ backgroundColor: roleColors.fill }}
          >
            <RoleIcon className="w-3 h-3" />
            {role.toUpperCase()}
          </div>
          <div
            className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-800"
            style={{ backgroundColor: statusColors.border }}
          />
        </div>

        {/* Network name */}
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate mb-1.5">
          {data.label}
        </span>

        {/* Metrics */}
        <div className="flex items-center gap-3 text-[9px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400">Peers</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{data.peerCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400">Subnets</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{data.subnetCount}</span>
          </div>
          {data.productTypes.length > 0 && (
            <div className="flex items-center gap-0.5">
              {data.productTypes.slice(0, 3).map(p => (
                <span key={p} className="px-1 py-0 rounded text-[7px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                  {p.replace('appliance', 'MX').replace('switch', 'MS').replace('wireless', 'MR').replace('camera', 'MV').replace('cellularGateway', 'MG')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* TE coverage */}
        {data.hasTECoverage && (
          <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-700">
            <Globe className="w-3 h-3 text-orange-500" />
            <span className="text-[8px] font-semibold text-orange-600 dark:text-orange-400">
              TE: {data.teTestCount} tests
            </span>
          </div>
        )}

        {/* Role-colored bottom border accent */}
        <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-lg" style={{ backgroundColor: roleColors.fill }} />

        {/* Offline stripe */}
        {isOffline && <div className="absolute inset-x-0 top-0 h-0.5 bg-red-500 rounded-t-lg" />}
      </div>
    </div>
  );
});
VpnNode.displayName = 'VpnNode';

// ============================================================================
// Custom Edge: Enhanced Connection
// ============================================================================

interface EnhancedEdgeData {
  edgeType?: string;
  teLatency?: number;
  teLoss?: number;
  teHealth?: string;
  teTestName?: string;
  vpnStatus?: string;
  highlighted?: boolean;
  dimmed?: boolean;
  [key: string]: unknown;
}

function EnhancedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
}: EdgeProps<Edge<EnhancedEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeType = data?.edgeType || 'ethernet';
  const teLatency = data?.teLatency;
  const teLoss = data?.teLoss;
  const teHealth = data?.teHealth || 'unknown';
  const teTestName = data?.teTestName;
  const vpnStatus = data?.vpnStatus;
  const highlighted = data?.highlighted;
  const dimmed = data?.dimmed;

  // Edge styling: TE health takes priority, then VPN status, then link type
  let strokeColor = '#94a3b8'; // default slate-400
  let strokeWidth = 1.5;
  let dashArray: string | undefined;
  let hasTE = false;

  if (teLatency !== undefined && teHealth !== 'unknown') {
    // TE-monitored link — bold orange to stand out
    hasTE = true;
    strokeColor = '#f97316'; // orange-500 — vivid and unmistakable
    strokeWidth = 4;
    if (teHealth === 'degraded') { strokeColor = '#ea580c'; strokeWidth = 4.5; }
    else if (teHealth === 'failing') { strokeColor = '#ef4444'; strokeWidth = 5; }
  } else if (vpnStatus) {
    strokeColor = VPN_TUNNEL_COLORS[vpnStatus as keyof typeof VPN_TUNNEL_COLORS] || '#64748b';
    strokeWidth = 2;
    dashArray = '6 3';
  } else {
    if (edgeType === 'wireless') { strokeColor = '#8b5cf6'; dashArray = '4 3'; }
    else if (edgeType === 'vpn') { strokeColor = '#a855f7'; dashArray = '6 3'; }
    else if (edgeType === 'stack') { strokeColor = '#06b6d4'; strokeWidth = 2; }
  }

  // Hover highlight: brighten connected edges, dim others
  if (highlighted) {
    strokeWidth = Math.max(strokeWidth, 3);
  } else if (dimmed) {
    strokeColor = '#cbd5e1'; // slate-300
    strokeWidth = 1;
  }

  const opacity = dimmed ? 0.25 : 1;

  return (
    <>
      {/* TE glow layer — thicker translucent stroke behind the main edge */}
      {hasTE && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: strokeColor,
            strokeWidth: strokeWidth + 6,
            strokeDasharray: dashArray,
            opacity: 0.25,
            filter: 'blur(3px)',
          }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
          opacity,
          transition: 'stroke 0.15s, stroke-width 0.15s, opacity 0.15s',
        }}
        markerEnd={markerEnd}
      />
      {/* TE metrics label — bold orange badge on the edge */}
      {teLatency !== undefined && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              title={teTestName || undefined}
              className={`flex flex-col items-center px-2.5 py-1 rounded-md border-2 shadow-lg cursor-pointer ${
              teHealth === 'failing' ? 'bg-red-500 text-white border-red-600'
              : teHealth === 'degraded' ? 'bg-orange-500 text-white border-orange-600'
              : 'bg-orange-500 text-white border-orange-600'
            }`}>
              <span className="text-[10px] font-bold leading-tight">
                {teLatency.toFixed(0)}ms
                {teLoss !== undefined && teLoss > 0 && (
                  <span className="ml-1 text-orange-100">{teLoss.toFixed(1)}%</span>
                )}
              </span>
              {teTestName && (
                <span className="text-[7px] text-orange-100 leading-tight truncate max-w-[100px]">{teTestName}</span>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
      {/* VPN status label */}
      {vpnStatus && teLatency === undefined && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
          >
            <div className={`px-1.5 py-0.5 rounded text-[8px] font-medium border ${
              vpnStatus === 'reachable' ? 'bg-emerald-50 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
              : vpnStatus === 'unreachable' ? 'bg-red-50 dark:bg-red-900/80 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}>
              {vpnStatus}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// ============================================================================
// Node & Edge Type Registries
// ============================================================================

const nodeTypes = {
  device: DeviceNode,
  vpnNetwork: VpnNode,
};

const edgeTypes = {
  enhanced: EnhancedEdge,
};

// ============================================================================
// Persistent TE Status Panel
// ============================================================================

const TEStatusPanel = memo(({ hub }: { hub: VisualizationHubState }) => {
  const [expanded, setExpanded] = useState(false);

  const activeAlerts = useMemo(() => hub.teAlerts.filter(a => a.active), [hub.teAlerts]);
  const onlineAgents = useMemo(() => hub.teAgents.filter(a => isAgentOnline(a)).length, [hub.teAgents]);

  const healthCounts = useMemo(() => {
    const counts = { healthy: 0, degraded: 0, failing: 0, disabled: 0 };
    hub.teTestHealth.forEach(t => { counts[t.health] = (counts[t.health] || 0) + 1; });
    return counts;
  }, [hub.teTestHealth]);

  const scoreColor = hub.teHealthScore >= 80 ? 'text-emerald-500' : hub.teHealthScore >= 60 ? 'text-amber-500' : 'text-red-500';
  const barColor = hub.teHealthScore >= 80 ? 'bg-emerald-500' : hub.teHealthScore >= 60 ? 'bg-amber-500' : 'bg-red-500';

  if (!hub.teConfigured) return null;

  return (
    <div className="absolute bottom-16 right-4 z-10">
      <motion.div
        layout
        className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-orange-500 overflow-hidden"
        style={{ width: expanded ? 260 : 'auto' }}
      >
        {/* Collapsed bar */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-3 py-2 w-full hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
        >
          <Globe className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className={`text-sm font-bold ${scoreColor}`}>{hub.teHealthScore}%</span>
          {activeAlerts.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold">
              {activeAlerts.length}
            </span>
          )}
          <span className="ml-auto">
            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </span>
        </button>

        {/* Expanded panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-3">
                {/* Health score bar */}
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Health Score</span>
                    <span className={`text-lg font-bold ${scoreColor}`}>{hub.teHealthScore}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${hub.teHealthScore}%` }} />
                  </div>
                </div>

                {/* Quick stats 2x2 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2">
                    <div className="text-[8px] text-slate-500 uppercase tracking-wider">Tests</div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span className="text-emerald-500">{healthCounts.healthy}</span>
                      {healthCounts.degraded > 0 && <span className="text-amber-500 ml-1">/{healthCounts.degraded}</span>}
                      {healthCounts.failing > 0 && <span className="text-red-500 ml-1">/{healthCounts.failing}</span>}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2">
                    <div className="text-[8px] text-slate-500 uppercase tracking-wider">Agents</div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {onlineAgents}<span className="text-slate-400 font-normal">/{hub.teAgents.length}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2">
                    <div className="text-[8px] text-slate-500 uppercase tracking-wider">Alerts</div>
                    <div className={`text-xs font-bold ${activeAlerts.length > 0 ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {activeAlerts.length}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2">
                    <div className="text-[8px] text-slate-500 uppercase tracking-wider">Outages</div>
                    <div className={`text-xs font-bold ${hub.teActiveOutageCount > 0 ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {hub.teActiveOutageCount}
                    </div>
                  </div>
                </div>

                {/* Active alerts list */}
                {activeAlerts.length > 0 && (
                  <div>
                    <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Active Alerts</div>
                    <div className="space-y-1 max-h-[90px] overflow-y-auto">
                      {activeAlerts.slice(0, 3).map(alert => (
                        <div key={alert.alertId} className="flex items-start gap-1.5 text-[9px] p-1.5 bg-red-500/5 border border-red-500/15 rounded">
                          <div className={`w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0 ${
                            alert.severity === 'critical' ? 'bg-red-500' : alert.severity === 'major' ? 'bg-orange-500' : 'bg-amber-500'
                          }`} />
                          <div className="min-w-0">
                            <div className="text-slate-700 dark:text-slate-300 font-medium truncate">{alert.testName}</div>
                            <div className="text-slate-400 truncate">{alert.ruleExpression}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test health breakdown */}
                <div>
                  <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Test Health</div>
                  <div className="flex items-center gap-3 text-[10px]">
                    {healthCounts.healthy > 0 && (
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{healthCounts.healthy}</span>
                    )}
                    {healthCounts.degraded > 0 && (
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{healthCounts.degraded}</span>
                    )}
                    {healthCounts.failing > 0 && (
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{healthCounts.failing}</span>
                    )}
                    {healthCounts.disabled > 0 && (
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" />{healthCounts.disabled}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});
TEStatusPanel.displayName = 'TEStatusPanel';

// ============================================================================
// Detail Sidebar
// ============================================================================

interface DetailSidebarProps {
  selectedNode: TopologyNode | OrgNetworkNode;
  hub: VisualizationHubState;
  onClose: () => void;
  onAnalyzeDevice: (node: TopologyNode) => void;
  onAnalyzeNetwork: (node: OrgNetworkNode) => void;
}

const DetailSidebar = memo(({ selectedNode, hub, onClose, onAnalyzeDevice, onAnalyzeNetwork }: DetailSidebarProps) => {
  const isDevice = 'serial' in selectedNode;
  const isVpn = 'peerCount' in selectedNode && !isDevice;
  const annotation = isDevice ? hub.deviceAnnotations.get(selectedNode.id) : null;
  const hasTE = !!annotation;

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Reset tab when node changes
  useEffect(() => { setActiveTab('overview'); }, [selectedNode.id]);

  // Device-specific data
  const matchedAgents = useMemo(() => {
    if (!annotation) return [];
    return hub.teAgents.filter(a => annotation.teAgentIds.includes(a.agentId));
  }, [hub.teAgents, annotation]);

  const deviceTests = useMemo(() => {
    if (!annotation) return [];
    return hub.teTests.filter(t => t.agents?.some(a => annotation.teAgentIds.includes(a.agentId)));
  }, [hub.teTests, annotation]);

  const deviceAlerts = useMemo(() => {
    if (!annotation) return [];
    return hub.teAlerts.filter(a => a.active && a.agents?.some((ag: any) => annotation.teAgentIds.includes(ag.agentId)));
  }, [hub.teAlerts, annotation]);

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 340, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden flex-shrink-0"
    >
      <div className="h-full overflow-y-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{selectedNode.name}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Device node content */}
        {isDevice && (
          <div className="space-y-3">
            {/* Tab bar */}
            {hasTE && (
              <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                {(['overview', 'te'] as DetailTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md transition-all ${
                      activeTab === tab
                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab === 'overview' ? 'Overview' : 'ThousandEyes'}
                  </button>
                ))}
              </div>
            )}

            {/* Overview tab */}
            {activeTab === 'overview' && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[(selectedNode as TopologyNode).status]?.border || '#64748b' }} />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 capitalize">{(selectedNode as TopologyNode).status}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                    backgroundColor: `${DEVICE_COLORS[(selectedNode as TopologyNode).type]?.fill}15`,
                    color: DEVICE_COLORS[(selectedNode as TopologyNode).type]?.fill,
                  }}>
                    {DEVICE_COLORS[(selectedNode as TopologyNode).type]?.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Model', value: (selectedNode as TopologyNode).model },
                    { label: 'Serial', value: (selectedNode as TopologyNode).serial },
                    { label: 'LAN IP', value: (selectedNode as TopologyNode).lanIp },
                    { label: 'WAN IP', value: (selectedNode as TopologyNode).wan1Ip },
                    { label: 'Firmware', value: (selectedNode as TopologyNode).firmware },
                  ].filter(item => item.value).map(item => (
                    <div key={item.label} className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2">
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</div>
                      <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate font-mono">{item.value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* TE tab */}
            {activeTab === 'te' && annotation && (
              <div className="space-y-2">
                {/* Summary card */}
                <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs font-semibold text-orange-400">ThousandEyes</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Agents:</span>{' '}
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{matchedAgents.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Tests:</span>{' '}
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{annotation.teTestCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Alerts:</span>{' '}
                      <span className={annotation.teAlertCount > 0 ? 'text-red-400 font-semibold' : 'text-slate-700 dark:text-slate-300'}>
                        {annotation.teAlertCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Matched agents with online status */}
                {matchedAgents.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Agents</div>
                    {matchedAgents.map(agent => {
                      const online = isAgentOnline(agent);
                      return (
                        <div key={agent.agentId} className="flex items-center gap-1.5 text-[10px] py-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-slate-700 dark:text-slate-300 truncate">{agent.agentName}</span>
                          <span className="text-slate-400 text-[8px] ml-auto">{agent.agentType}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Test results with health coloring */}
                {deviceTests.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tests</div>
                    {deviceTests.slice(0, 5).map(test => {
                      const health = hub.teTestHealth.find(h => h.testId === test.testId);
                      const results = hub.teTestResults[test.testId];
                      const latest = results && results.length > 0 ? results[results.length - 1] : null;
                      const healthColor = health?.health === 'healthy' ? 'text-emerald-500'
                        : health?.health === 'degraded' ? 'text-amber-500'
                        : health?.health === 'failing' ? 'text-red-500'
                        : 'text-slate-400';
                      return (
                        <div key={test.testId} className="text-[10px] py-0.5 flex items-center justify-between">
                          <span className={`truncate mr-2 font-medium ${healthColor}`}>{test.testName}</span>
                          <span className="text-slate-400 flex-shrink-0">
                            {latest?.latency ? `${latest.latency.toFixed(0)}ms` : ''}
                            {latest?.loss && latest.loss > 0 ? ` ${latest.loss.toFixed(1)}%` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Active alerts with severity and duration */}
                {deviceAlerts.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Alerts</div>
                    {deviceAlerts.slice(0, 3).map(alert => (
                      <div key={alert.alertId} className="p-2 bg-red-500/5 border border-red-500/20 rounded-lg">
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />
                          <span className="text-red-400 font-medium truncate">{alert.testName}</span>
                          <span className="ml-auto text-[8px] text-slate-400 flex-shrink-0">
                            {alert.severity}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5 truncate">{alert.ruleExpression}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI analysis button */}
            <button
              onClick={() => onAnalyzeDevice(selectedNode as TopologyNode)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Analyze with AI
            </button>
          </div>
        )}

        {/* VPN node content */}
        {isVpn && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="px-2 py-0.5 rounded-full text-[9px] font-semibold text-white"
                style={{ backgroundColor: NETWORK_ROLE_COLORS[(selectedNode as OrgNetworkNode).type]?.fill }}
              >
                {(selectedNode as OrgNetworkNode).type.toUpperCase()}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {(selectedNode as OrgNetworkNode).peerCount} VPN peers
              </span>
            </div>

            {/* Subnets */}
            {(selectedNode as OrgNetworkNode).subnets?.length > 0 && (
              <div>
                <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Subnets</div>
                {(selectedNode as OrgNetworkNode).subnets.slice(0, 5).map((subnet, i) => (
                  <div key={i} className="text-[10px] font-mono text-slate-600 dark:text-slate-400 py-0.5">
                    {subnet.localSubnet} {subnet.useVpn && <span className="text-cyan-400 ml-1">VPN</span>}
                  </div>
                ))}
              </div>
            )}

            {/* VPN peers grouped by reachability */}
            <div>
              <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">VPN Peers</div>
              {(() => {
                const peers = (selectedNode as OrgNetworkNode).merakiVpnPeers;
                const reachable = peers.filter(p => p.reachability === 'reachable');
                const unreachable = peers.filter(p => p.reachability !== 'reachable');
                const sorted = [...reachable, ...unreachable];
                return (
                  <>
                    <div className="text-[8px] text-slate-400 mb-1">
                      {reachable.length} reachable, {unreachable.length} unreachable
                    </div>
                    {sorted.slice(0, 10).map((peer, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 px-2 bg-slate-50 dark:bg-slate-700/30 rounded mb-0.5">
                        <span className="text-slate-700 dark:text-slate-300 truncate">{peer.networkName}</span>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: VPN_TUNNEL_COLORS[peer.reachability] }} />
                          <span className="text-[8px] text-slate-500">{peer.reachability}</span>
                        </div>
                      </div>
                    ))}
                    {peers.length > 10 && (
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 text-center py-1">
                        +{peers.length - 10} more
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* AI analysis button for VPN */}
            <button
              onClick={() => onAnalyzeNetwork(selectedNode as OrgNetworkNode)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Analyze with AI
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});
DetailSidebar.displayName = 'DetailSidebar';

// ============================================================================
// Inner component (needs ReactFlowProvider parent)
// ============================================================================

function NetworkMapInner({ hub, networkName }: NetworkMapViewProps) {
  const router = useRouter();
  const reactFlowInstance = useReactFlow();
  const [viewMode, setViewMode] = useState<ViewMode>('network');
  const [layout, setLayout] = useState<LayoutType>('hierarchical');
  const [showClients, setShowClients] = useState(false);
  const [showTEOverlay, setShowTEOverlay] = useState(true);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | OrgNetworkNode | null>(null);
  const [typeFilter, setTypeFilter] = useState<DeviceType | 'all'>('all');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const prevNodeCountRef = useRef(0);

  const layoutDimensions = { width: 1400, height: 800 };

  // Filter topology nodes
  const filteredNodes = useMemo(() => {
    let nodes = hub.topologyNodes;
    if (!showClients) nodes = nodes.filter(n => !n.isClient);
    if (typeFilter !== 'all') nodes = nodes.filter(n => n.type === typeFilter);
    return nodes;
  }, [hub.topologyNodes, showClients, typeFilter]);

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return hub.topologyEdges.filter(e => {
      const srcId = typeof e.source === 'string' ? e.source : e.source.id;
      const tgtId = typeof e.target === 'string' ? e.target : e.target.id;
      return nodeIds.has(srcId) && nodeIds.has(tgtId);
    });
  }, [hub.topologyEdges, filteredNodes]);

  const positionedNodes = useTopologyLayout(filteredNodes, filteredEdges, layout, layoutDimensions);

  // Re-fit view when nodes change count (data loaded async)
  useEffect(() => {
    const currentCount = viewMode === 'vpn' ? hub.vpnNodes.length : positionedNodes.length;
    if (currentCount > 0 && currentCount !== prevNodeCountRef.current) {
      prevNodeCountRef.current = currentCount;
      // Small delay to let ReactFlow process new nodes first
      const timer = setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [positionedNodes.length, hub.vpnNodes.length, viewMode, reactFlowInstance]);

  // Convert to @xyflow nodes
  const flowNodes = useMemo((): Node[] => {
    if (viewMode === 'vpn') {
      const hubs = hub.vpnNodes.filter(n => n.type === 'hub');
      const spokes = hub.vpnNodes.filter(n => n.type === 'spoke');
      const standalones = hub.vpnNodes.filter(n => n.type !== 'hub' && n.type !== 'spoke');

      const nodes: Node[] = [];
      const placedIds = new Set<string>();

      // Build hub->spoke adjacency from edges
      const hubSpokeMap = new Map<string, string[]>();
      hubs.forEach(h => hubSpokeMap.set(h.id, []));
      const spokeHubMap = new Map<string, string[]>();

      hub.vpnEdges.forEach(e => {
        const src = typeof e.source === 'string' ? e.source : e.source.id;
        const tgt = typeof e.target === 'string' ? e.target : e.target.id;
        // Determine which is hub, which is spoke
        if (hubSpokeMap.has(src) && spokes.some(s => s.id === tgt)) {
          hubSpokeMap.get(src)!.push(tgt);
          spokeHubMap.set(tgt, [...(spokeHubMap.get(tgt) || []), src]);
        } else if (hubSpokeMap.has(tgt) && spokes.some(s => s.id === src)) {
          hubSpokeMap.get(tgt)!.push(src);
          spokeHubMap.set(src, [...(spokeHubMap.get(src) || []), tgt]);
        }
      });

      // Also use connectedHubs field as fallback
      spokes.forEach(s => {
        if (s.connectedHubs?.length) {
          s.connectedHubs.forEach(hubId => {
            if (hubSpokeMap.has(hubId)) {
              if (!hubSpokeMap.get(hubId)!.includes(s.id)) {
                hubSpokeMap.get(hubId)!.push(s.id);
              }
              spokeHubMap.set(s.id, [...(spokeHubMap.get(s.id) || []), hubId]);
            }
          });
        }
      });

      // Layout: each hub is a cluster center, spokes radiate around it
      const hubSpacing = 600;
      const spokeRadius = 250;
      const hubY = 300;

      const totalHubWidth = (hubs.length - 1) * hubSpacing;
      const hubStartX = (layoutDimensions.width - totalHubWidth) / 2;

      const makeNodeData = (node: typeof hub.vpnNodes[0]): VpnNodeData => {
        // Check device annotations (direct device IP match)
        const deviceAnn = hub.deviceAnnotations.get(node.id);
        // Also check link annotations for network-level TE coverage
        const linkAnn = hub.linkAnnotations.get(`node-${node.id}`);
        const hasCoverage = !!deviceAnn || !!linkAnn;
        return {
          label: node.name,
          role: node.type,
          status: node.status,
          peerCount: node.peerCount,
          productTypes: node.productTypes,
          subnetCount: node.subnets?.length || 0,
          hasTECoverage: hasCoverage,
          teTestCount: deviceAnn?.teTestCount || (linkAnn ? 1 : 0),
        };
      };

      // Place hubs and their spokes
      hubs.forEach((hubNode, hi) => {
        const cx = hubStartX + hi * hubSpacing;
        const cy = hubY;

        nodes.push({
          id: hubNode.id,
          type: 'vpnNetwork',
          position: { x: cx - 90, y: cy - 30 },
          data: makeNodeData(hubNode),
        });
        placedIds.add(hubNode.id);

        // Radial spoke placement around this hub
        const spokeIds = hubSpokeMap.get(hubNode.id) || [];
        // Only place spokes not already placed (multi-hub spokes go to first hub)
        const toPlace = spokeIds.filter(id => !placedIds.has(id));
        const count = toPlace.length;

        toPlace.forEach((spokeId, si) => {
          const spokeNode = spokes.find(s => s.id === spokeId);
          if (!spokeNode) return;

          // Spread spokes in lower semicircle (pi/6 to 5pi/6) to avoid overlapping hub row
          const angleStart = Math.PI * 0.15;
          const angleEnd = Math.PI * 0.85;
          const angle = count === 1
            ? Math.PI / 2
            : angleStart + (si / (count - 1)) * (angleEnd - angleStart);

          const r = spokeRadius + (count > 8 ? (si % 2) * 80 : 0); // stagger if many spokes
          const sx = cx - 90 + Math.cos(angle) * r;
          const sy = cy - 30 + Math.sin(angle) * r;

          nodes.push({
            id: spokeNode.id,
            type: 'vpnNetwork',
            position: { x: sx, y: sy },
            data: makeNodeData(spokeNode),
          });
          placedIds.add(spokeNode.id);
        });
      });

      // Place unconnected spokes (no hub connection) in a row below
      const unplacedSpokes = spokes.filter(s => !placedIds.has(s.id));
      if (unplacedSpokes.length > 0) {
        const rowY = hubY + spokeRadius + 200;
        const xSpace = 240;
        const rowWidth = (unplacedSpokes.length - 1) * xSpace;
        const rowStartX = (layoutDimensions.width - rowWidth) / 2;
        unplacedSpokes.forEach((node, i) => {
          nodes.push({
            id: node.id,
            type: 'vpnNetwork',
            position: { x: rowStartX + i * xSpace, y: rowY },
            data: makeNodeData(node),
          });
          placedIds.add(node.id);
        });
      }

      // Place standalone nodes in a separate row at bottom
      if (standalones.length > 0) {
        const rowY = hubY + spokeRadius + (unplacedSpokes.length > 0 ? 380 : 200);
        const xSpace = 240;
        const rowWidth = (standalones.length - 1) * xSpace;
        const rowStartX = (layoutDimensions.width - rowWidth) / 2;
        standalones.forEach((node, i) => {
          nodes.push({
            id: node.id,
            type: 'vpnNetwork',
            position: { x: rowStartX + i * xSpace, y: rowY },
            data: makeNodeData(node),
          });
        });
      }

      return nodes;
    }

    return positionedNodes.map(node => {
      const annotation = hub.deviceAnnotations.get(node.id);
      return {
        id: node.id,
        type: 'device',
        position: { x: node.x, y: node.y },
        data: {
          label: node.name || node.serial,
          deviceType: node.type,
          status: node.status,
          model: node.model,
          serial: node.serial,
          lanIp: node.lanIp,
          wan1Ip: node.wan1Ip,
          firmware: node.firmware,
          hasTEAgent: !!annotation,
          teTestCount: annotation?.teTestCount || 0,
          teAlertCount: annotation?.teAlertCount || 0,
          isClient: node.isClient,
        } satisfies DeviceNodeData,
      };
    });
  }, [viewMode, positionedNodes, hub.vpnNodes, hub.deviceAnnotations, hub.linkAnnotations, layoutDimensions]);

  // Convert to @xyflow edges
  const flowEdges = useMemo((): Edge[] => {
    if (viewMode === 'vpn') {
      // Build global TE annotations keyed by te-{testId} for overlay
      const teByTestId = showTEOverlay
        ? Array.from(hub.linkAnnotations.entries()).filter(([k]) => k.startsWith('te-'))
        : [];

      return hub.vpnEdges.map((edge, i) => {
        const srcId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const tgtId = typeof edge.target === 'string' ? edge.target : edge.target.id;

        // Apply TE overlay if annotations reference agents on either endpoint network
        let teLatency: number | undefined;
        let teLoss: number | undefined;
        let teHealth: string | undefined;
        let teTestName: string | undefined;

        if (showTEOverlay) {
          // Direct node-level lookup (created by annotations hook for VPN network IDs)
          const srcAnn = hub.linkAnnotations.get(`node-${srcId}`);
          const tgtAnn = hub.linkAnnotations.get(`node-${tgtId}`);
          let ann = srcAnn && tgtAnn
            ? ((srcAnn.teLatency || 0) > (tgtAnn.teLatency || 0) ? srcAnn : tgtAnn)
            : srcAnn || tgtAnn;

          // Fallback: search te-* entries whose _nodeIds reference either endpoint
          if (!ann && teByTestId.length > 0) {
            for (const [, teAnn] of teByTestId) {
              const nodeIds = teAnn._nodeIds;
              if (nodeIds && (nodeIds.includes(srcId) || nodeIds.includes(tgtId))) {
                ann = teAnn;
                break;
              }
            }
          }

          if (ann) {
            teLatency = ann.teLatency;
            teLoss = ann.teLoss;
            teHealth = ann.teHealth;
            teTestName = ann.teTestName;
          }
        }

        return {
          id: `vpn-${srcId}-${tgtId}-${i}`,
          source: srcId,
          target: tgtId,
          type: 'enhanced',
          data: {
            edgeType: 'vpn',
            vpnStatus: edge.status,
            teLatency: showTEOverlay ? teLatency : undefined,
            teLoss: showTEOverlay ? teLoss : undefined,
            teHealth: showTEOverlay ? teHealth : undefined,
            teTestName: showTEOverlay ? teTestName : undefined,
          } satisfies EnhancedEdgeData,
        };
      });
    }

    // Build set of node IDs that actually have TE device annotations (IP-matched agents)
    const teAnnotatedNodeIds = showTEOverlay
      ? new Set(Array.from(hub.deviceAnnotations.keys()))
      : new Set<string>();

    return filteredEdges.map((edge, i) => {
      const srcId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const tgtId = typeof edge.target === 'string' ? edge.target : edge.target.id;

      let teLatency: number | undefined;
      let teLoss: number | undefined;
      let teHealth = 'unknown';
      let teTestName: string | undefined;

      if (showTEOverlay) {
        // Only apply TE overlay if at least one endpoint has a REAL device annotation
        // (i.e., the device's IP actually matches a TE agent's IP)
        const srcHasTE = teAnnotatedNodeIds.has(srcId);
        const tgtHasTE = teAnnotatedNodeIds.has(tgtId);

        if (srcHasTE || tgtHasTE) {
          const srcAnn = srcHasTE ? hub.linkAnnotations.get(`node-${srcId}`) : undefined;
          const tgtAnn = tgtHasTE ? hub.linkAnnotations.get(`node-${tgtId}`) : undefined;
          const ann = srcAnn && tgtAnn
            ? ((srcAnn.teLatency || 0) > (tgtAnn.teLatency || 0) ? srcAnn : tgtAnn)
            : srcAnn || tgtAnn;
          if (ann) {
            teLatency = ann.teLatency;
            teLoss = ann.teLoss;
            teHealth = ann.teHealth;
            teTestName = ann.teTestName;
          }
        }
      }

      // Determine highlight/dim for hover
      const isConnected = hoveredNodeId ? (srcId === hoveredNodeId || tgtId === hoveredNodeId) : false;
      const hasTE = showTEOverlay && teLatency !== undefined;
      // Dim non-TE edges when overlay is active so TE edges pop
      const shouldDim = hoveredNodeId ? !isConnected : (showTEOverlay && !hasTE);

      return {
        id: `edge-${srcId}-${tgtId}-${i}`,
        source: srcId,
        target: tgtId,
        type: 'enhanced',
        data: {
          edgeType: edge.type,
          teLatency: showTEOverlay ? teLatency : undefined,
          teLoss: showTEOverlay ? teLoss : undefined,
          teHealth: showTEOverlay ? teHealth : undefined,
          teTestName: showTEOverlay ? teTestName : undefined,
          highlighted: isConnected,
          dimmed: shouldDim,
        } satisfies EnhancedEdgeData,
      };
    });
  }, [viewMode, filteredEdges, hub.vpnEdges, hub.deviceAnnotations, hub.linkAnnotations, showTEOverlay, hoveredNodeId]);

  // Handle node hover — highlight connected edges
  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // Handle node click
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (viewMode === 'network') {
      const topoNode = hub.topologyNodes.find(n => n.id === node.id);
      if (topoNode) setSelectedNode(topoNode);
    } else {
      const vpnNode = hub.vpnNodes.find(n => n.id === node.id);
      if (vpnNode) setSelectedNode(vpnNode);
    }
  }, [viewMode, hub.topologyNodes, hub.vpnNodes]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setSelectedNode(null);
    prevNodeCountRef.current = 0; // Reset so fitView triggers on data load
    if (mode === 'vpn' && hub.vpnNodes.length === 0) {
      hub.fetchVpnTopology();
    }
  }, [hub]);

  // AI analysis
  const analyzeTopology = useCallback(() => {
    if (viewMode === 'vpn') {
      const summary = hub.vpnSummary;
      const prompt = `Analyze the organization VPN topology. ${summary?.totalNetworks || 0} networks: ${summary?.hubCount || 0} hubs, ${summary?.spokeCount || 0} spokes, ${summary?.standaloneCount || 0} standalone. ${summary?.totalVpnTunnels || 0} VPN tunnels. ${hub.teAlerts.filter(a => a.active).length} active TE alerts. Assess tunnel health and recommend optimizations.`;
      router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
    } else {
      const nodeCount = hub.topologyNodes.length;
      const onlineCount = hub.topologyNodes.filter(n => n.status === 'online').length;
      const teCount = hub.deviceAnnotations.size;
      const prompt = `Analyze the network topology for ${networkName}. ${nodeCount} devices total, ${onlineCount} online. ${teCount} devices have ThousandEyes monitoring. ${hub.teAlerts.filter(a => a.active).length} active TE alerts. Provide health assessment and recommendations.`;
      router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
    }
  }, [viewMode, hub, networkName, router]);

  const analyzeDevice = useCallback((node: TopologyNode) => {
    const annotation = hub.deviceAnnotations.get(node.id);
    const prompt = `Analyze device ${node.name} (${node.model}, ${node.status}). IP: ${node.lanIp || 'N/A'}. ${annotation ? `Has ${annotation.teTestCount} TE tests, ${annotation.teAlertCount} active alerts.` : 'No TE monitoring.'} Provide health assessment.`;
    router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
  }, [hub.deviceAnnotations, router]);

  const analyzeVpnNetwork = useCallback((node: OrgNetworkNode) => {
    const reachable = node.merakiVpnPeers.filter(p => p.reachability === 'reachable').length;
    const unreachable = node.merakiVpnPeers.filter(p => p.reachability !== 'reachable').length;
    const prompt = `Analyze VPN network "${node.name}" (${node.type}). ${node.peerCount} peers: ${reachable} reachable, ${unreachable} unreachable. ${node.subnets?.length || 0} subnets. Assess VPN health and recommend optimizations.`;
    router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
  }, [router]);

  // Empty states
  if (!hub.selectedOrg) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <NetworkIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-3" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Select an Organization</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Choose an organization to view the network map</p>
      </div>
    );
  }

  if (viewMode === 'network' && !hub.selectedNetwork) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <NetworkIcon className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-3" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Select a Network</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Choose a network to view device topology</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Main Canvas */}
      <div className="flex-1 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden relative">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={4}
          proOptions={{ hideAttribution: true }}
          className="bg-slate-50 dark:bg-slate-900/50"
          defaultEdgeOptions={{ type: 'enhanced' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#334155" />
          <Controls
            showInteractive={false}
            className="!bg-slate-800 !border-slate-700 !rounded-lg !shadow-xl [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700"
          />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'vpnNetwork') {
                const role = (n.data as VpnNodeData)?.role;
                return role ? NETWORK_ROLE_COLORS[role]?.fill || '#64748b' : '#64748b';
              }
              const dt = (n.data as DeviceNodeData)?.deviceType;
              return dt ? DEVICE_COLORS[dt]?.fill || '#64748b' : '#64748b';
            }}
            className="!bg-slate-800/80 !border-slate-700 !rounded-lg"
            maskColor="rgba(0,0,0,0.5)"
          />

          {/* Floating Control Panel */}
          <Panel position="top-right">
            <div className="bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-3 space-y-3 backdrop-blur-sm w-[180px]">
              {/* View mode toggle */}
              <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                <button
                  onClick={() => handleViewModeChange('network')}
                  className={`flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md transition-all ${
                    viewMode === 'network'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Network
                </button>
                <button
                  onClick={() => handleViewModeChange('vpn')}
                  className={`flex-1 px-2 py-1.5 text-[10px] font-semibold rounded-md transition-all ${
                    viewMode === 'vpn'
                      ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  VPN
                </button>
              </div>

              {/* Layout toggle (network mode only) */}
              {viewMode === 'network' && (
                <div>
                  <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Layout</div>
                  <div className="flex gap-1">
                    {(['hierarchical', 'force', 'radial'] as LayoutType[]).map(l => (
                      <button
                        key={l}
                        onClick={() => setLayout(l)}
                        className={`flex-1 px-1.5 py-1 text-[9px] font-medium rounded-md transition-all ${
                          layout === l
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent'
                        }`}
                      >
                        {l.charAt(0).toUpperCase() + l.slice(1, 5)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Device type filter (network mode only) */}
              {viewMode === 'network' && (
                <div>
                  <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Filter</div>
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as DeviceType | 'all')}
                    className="w-full px-2 py-1 text-[10px] rounded-md bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                  >
                    <option value="all">All Devices</option>
                    {(['MX', 'MS', 'MR', 'MV', 'MG', 'MT', 'Z', 'CW'] as DeviceType[]).map(t => (
                      <option key={t} value={t}>{t} - {DEVICE_COLORS[t].label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Toggles — shown for BOTH views */}
              <div className="space-y-1">
                {viewMode === 'network' && (
                  <button
                    onClick={() => {
                      const next = !showClients;
                      setShowClients(next);
                      hub.setIncludeClients(next);
                    }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-md transition"
                  >
                    {showClients ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    Client Devices
                  </button>
                )}
                {/* TE Overlay — available for both network AND vpn */}
                <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Monitoring</div>
                <button
                  onClick={() => setShowTEOverlay(!showTEOverlay)}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-[10px] font-medium rounded-md transition ${
                    showTEOverlay
                      ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  TE Overlay
                </button>
              </div>

              {/* AI Analysis */}
              <button
                onClick={analyzeTopology}
                className="flex items-center gap-2 w-full px-3 py-2 text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/25 rounded-lg hover:bg-purple-500/20 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Analyze {viewMode === 'vpn' ? 'VPN' : 'Topology'}
              </button>

              {/* Legend */}
              <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/30">
                <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</div>
                <div className="grid grid-cols-2 gap-1">
                  {(['online', 'offline', 'alerting', 'dormant'] as const).map(s => (
                    <div key={s} className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s].border }} />
                      <span className="text-[8px] text-slate-500 dark:text-slate-400 capitalize">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* Loading overlay */}
          {hub.topologyLoading && (
            <Panel position="top-left">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/90 rounded-lg backdrop-blur-sm">
                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-300">Loading topology...</span>
              </div>
            </Panel>
          )}

          {/* Node count info */}
          <Panel position="bottom-left">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-800/80 rounded-lg backdrop-blur-sm text-[10px]">
              <span className="text-slate-400">
                {viewMode === 'vpn'
                  ? `${hub.vpnNodes.length} networks | ${hub.vpnEdges.length} tunnels`
                  : `${filteredNodes.length} devices | ${filteredEdges.length} links`
                }
              </span>
              {showTEOverlay && hub.teConfigured && (
                <span className="text-orange-400">TE: {hub.linkAnnotations.size} annotations</span>
              )}
            </div>
          </Panel>
        </ReactFlow>

        {/* Persistent TE Status Panel */}
        {hub.teConfigured && showTEOverlay && <TEStatusPanel hub={hub} />}
      </div>

      {/* Detail Sidebar */}
      <AnimatePresence>
        {selectedNode && (
          <DetailSidebar
            selectedNode={selectedNode}
            hub={hub}
            onClose={() => setSelectedNode(null)}
            onAnalyzeDevice={analyzeDevice}
            onAnalyzeNetwork={analyzeVpnNetwork}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Wrapper with ReactFlowProvider
// ============================================================================

export function NetworkMapView(props: NetworkMapViewProps) {
  return (
    <ReactFlowProvider>
      <NetworkMapInner {...props} />
    </ReactFlowProvider>
  );
}

export default NetworkMapView;
