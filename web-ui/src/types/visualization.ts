// Visualization types for Network Topology and Performance Charts

// ============================================================================
// Network Topology Types
// ============================================================================

export type DeviceType = 'MX' | 'MS' | 'MR' | 'MV' | 'MG' | 'MT' | 'Z' | 'CW' | 'Client' | 'unknown';
export type DeviceStatus = 'online' | 'offline' | 'alerting' | 'dormant' | 'unknown';
export type EdgeType = 'ethernet' | 'wireless' | 'vpn' | 'stack' | 'unknown';

export interface TopologyNode {
  id: string;
  serial: string;
  name: string;
  model: string;
  type: DeviceType;
  status: DeviceStatus;
  networkId?: string;
  networkName?: string;
  lat?: number;
  lng?: number;
  lanIp?: string;
  wan1Ip?: string;
  mac?: string;
  firmware?: string;
  // Client-specific fields
  isClient?: boolean;
  manufacturer?: string;
  os?: string;
  vlan?: number;
  ssid?: string;
  usage?: { sent: number; recv: number };
  connectedDeviceSerial?: string;
  connectedDeviceName?: string;
  recentDeviceName?: string;
  // d3-force simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  index?: number;
}

export interface TopologyEdge {
  source: string | TopologyNode;
  target: string | TopologyNode;
  type: EdgeType;
  speed?: string;
  portFrom?: string;
  portTo?: string;
  index?: number;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  networkId?: string;
  networkName?: string;
}

// ============================================================================
// Performance Chart Types
// ============================================================================

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

export interface PerformanceDataPoint {
  timestamp: string;
  latency?: number;
  packetLoss?: number;
  throughput?: number;
  channelUtilization?: number;
  signalQuality?: number;
}

export interface PerformanceMetrics {
  trafficAnalysis?: any[];
  performanceScore?: number;
  channelUtilization?: any[];
  timespan: number;
}

export interface DeviceHealthData {
  lossAndLatency?: {
    timeSeries?: Array<{
      ts: string;
      lossPercent: number;
      latencyMs: number;
    }>;
  };
  uplink?: {
    interface?: string;
    status?: string;
    ip?: string;
    gateway?: string;
    publicIp?: string;
    dns?: string;
  };
}

// ============================================================================
// UI State Types
// ============================================================================

export type VisualizationTab = 'organization' | 'topology' | 'performance';

export interface VisualizationFilters {
  organization?: string;
  networkId?: string;
  timeRange?: TimeRange;
  deviceTypes?: DeviceType[];
  showOffline?: boolean;
}

// ============================================================================
// Device Color Configuration
// ============================================================================

export const DEVICE_COLORS: Record<DeviceType, { fill: string; stroke: string; label: string }> = {
  MX: { fill: '#3b82f6', stroke: '#1d4ed8', label: 'Security Appliance' },
  MS: { fill: '#22c55e', stroke: '#15803d', label: 'Switch' },
  MR: { fill: '#a855f7', stroke: '#7c3aed', label: 'Wireless AP' },
  MV: { fill: '#f59e0b', stroke: '#d97706', label: 'Camera' },
  MG: { fill: '#06b6d4', stroke: '#0891b2', label: 'Cellular Gateway' },
  MT: { fill: '#ec4899', stroke: '#db2777', label: 'IoT Sensor' },
  Z: { fill: '#f43f5e', stroke: '#e11d48', label: 'Teleworker Gateway' },
  CW: { fill: '#8b5cf6', stroke: '#6d28d9', label: 'Cisco Wireless AP' },
  Client: { fill: '#14b8a6', stroke: '#0d9488', label: 'Client Device' },
  unknown: { fill: '#64748b', stroke: '#475569', label: 'Unknown' },
};

export const STATUS_COLORS: Record<DeviceStatus, { glow: string; border: string }> = {
  online: { glow: 'rgba(34, 197, 94, 0.6)', border: '#22c55e' },
  offline: { glow: 'rgba(239, 68, 68, 0.6)', border: '#ef4444' },
  alerting: { glow: 'rgba(245, 158, 11, 0.6)', border: '#f59e0b' },
  dormant: { glow: 'rgba(156, 163, 175, 0.4)', border: '#9ca3af' },
  unknown: { glow: 'rgba(100, 116, 139, 0.4)', border: '#64748b' },
};

export const METRIC_COLORS: Record<string, string> = {
  latency: '#06b6d4',      // Cyan
  packetLoss: '#ef4444',   // Red
  throughput: '#22c55e',   // Green
  channelUtilization: '#a855f7', // Purple
  signalQuality: '#f59e0b', // Amber
};

// ============================================================================
// Utility Functions
// ============================================================================

export function getDeviceType(model: string): DeviceType {
  if (!model) return 'unknown';
  const m = model.toUpperCase();
  if (m === 'CLIENT') return 'Client';
  if (/^Z\d/.test(m)) return 'Z';
  if (m.startsWith('MX')) return 'MX';
  if (m.startsWith('MS')) return 'MS';
  if (m.startsWith('MR')) return 'MR';
  if (m.startsWith('MV')) return 'MV';
  if (m.startsWith('MG')) return 'MG';
  if (m.startsWith('MT')) return 'MT';
  if (m.startsWith('CW')) return 'CW';  // Cisco Wireless AP
  return 'unknown';
}

export function getDeviceStatus(status: string | undefined): DeviceStatus {
  if (!status) return 'unknown';
  const s = status.toLowerCase();
  if (s === 'online') return 'online';
  if (s === 'offline') return 'offline';
  if (s === 'alerting') return 'alerting';
  if (s === 'dormant') return 'dormant';
  return 'unknown';
}

export const TIME_RANGE_SECONDS: Record<TimeRange, number> = {
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
};

// ============================================================================
// Organization-Wide VPN Topology Types
// ============================================================================

export type NetworkRole = 'hub' | 'spoke' | 'standalone';
export type VpnTunnelStatus = 'reachable' | 'unreachable' | 'unknown';

export interface OrgNetworkNode {
  id: string;
  name: string;
  type: NetworkRole;
  vpnMode: string;
  status: DeviceStatus;
  productTypes: string[];
  timeZone?: string;
  peerCount: number;
  connectedHubs: string[];
  subnets: Array<{ localSubnet: string; useVpn: boolean }>;
  merakiVpnPeers: Array<{
    networkId: string;
    networkName: string;
    reachability: VpnTunnelStatus;
  }>;
  // d3-force simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  index?: number;
}

export interface OrgVpnEdge {
  source: string | OrgNetworkNode;
  target: string | OrgNetworkNode;
  type: 'vpn';
  status: VpnTunnelStatus;
  index?: number;
}

export interface OrgVpnTopology {
  organizationId: string;
  nodes: OrgNetworkNode[];
  edges: OrgVpnEdge[];
  summary: {
    totalNetworks: number;
    hubCount: number;
    spokeCount: number;
    standaloneCount: number;
    totalVpnTunnels: number;
  };
}

export const NETWORK_ROLE_COLORS: Record<NetworkRole, { fill: string; stroke: string; label: string }> = {
  hub: { fill: '#3b82f6', stroke: '#1d4ed8', label: 'Hub Network' },
  spoke: { fill: '#22c55e', stroke: '#15803d', label: 'Spoke Network' },
  standalone: { fill: '#64748b', stroke: '#475569', label: 'Standalone' },
};

export const VPN_TUNNEL_COLORS: Record<VpnTunnelStatus, string> = {
  reachable: '#22c55e',
  unreachable: '#ef4444',
  unknown: '#64748b',
};
