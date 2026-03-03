// ============================================================================
// ThousandEyes Types
// ============================================================================

export interface Test {
  testId: number;
  testName: string;
  type: string;
  enabled: number | boolean;
  interval: number;
  createdDate: string;
  modifiedDate: string;
  // Fields from TE v7 API
  url?: string;
  server?: string;
  port?: number;
  protocol?: string;
  domain?: string;
  description?: string;
  alertsEnabled?: number | boolean;
  agents?: { agentId: number; agentName: string; agentType?: string }[];
  // Latest computed metrics (populated from auto-fetched results)
  _latestMetrics?: { latency?: number; loss?: number; availability?: number; responseTime?: number };
}

export interface TestResult {
  timestamp: string;
  responseTime?: number;
  availability?: number;
  loss?: number;
  latency?: number;
  jitter?: number;
  throughput?: number;
  [key: string]: any;
}

export interface Alert {
  alertId: number;
  testName: string;
  active: number | boolean;
  ruleExpression: string;
  dateStart: string;
  dateEnd?: string;
  violationCount: number;
  severity: string;
  testId?: number;
  type?: string;
  agents?: { agentId: number; agentName: string }[];
}

export interface Agent {
  agentId: number;
  agentName: string;
  agentType: string;
  countryId: string;
  enabled: number | boolean;
  agentState?: string; // "online" | "offline" | "disabled" — from TE v7 API
  ipAddresses: string[];
  location: string;
  network: string;
}

// Helper: check if an agent/test is enabled (handles both boolean and number from TE v7 API)
export function isEnabled(val: number | boolean | undefined): boolean {
  return val === true || val === 1;
}

// Helper: check if an agent is online (prefers agentState, falls back to enabled)
// TE v7 API returns capitalized values: "Online", "Offline", "Disabled"
export function isAgentOnline(agent: Agent): boolean {
  if (agent.agentState) return agent.agentState.toLowerCase() === 'online';
  // Cloud agents are always online — they don't report agentState and their
  // "enabled" field reflects license assignment, not availability.
  if (agent.agentType?.toLowerCase() === 'cloud') return true;
  return isEnabled(agent.enabled);
}

export interface TEEvent {
  eventId: string;
  type: string;
  summary: string;
  startDate: string;
  endDate?: string;
  agents?: { agentId: number; agentName: string }[];
  severity: string;
  groupBy?: string;
  affectedTargets?: number;
}

export interface Outage {
  id: string;
  type: 'application' | 'network';
  provider: string;
  startDate: string;
  endDate?: string;
  affectedTests: number;
  affectedInterfaces?: number;
  server?: string;
}

export interface PathHop {
  hopNumber: number;
  ipAddress: string;
  hostname?: string;
  latency: number;
  loss: number;
  prefix?: string;
  network?: string;
}

export interface BGPResult {
  prefix: string;
  asPath: number[];
  reachability: number;
  updates: number;
  monitor: string;
  isActive?: boolean;
}

export interface EndpointMetric {
  agentId: string;
  agentName: string;
  metric: string;
  value: number;
  timestamp: string;
  platform?: string;
  osVersion?: string;
}

export interface Anomaly {
  testId: number;
  metric: string;
  severity: string;
  startDate: string;
  value: number;
  baseline: number;
  testName?: string;
}

// ============================================================================
// Endpoint Agent Detail Types
// ============================================================================

export interface HealthSegment {
  id: string;
  label: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
}

export interface EndpointScheduledTest {
  testId: string;
  testName: string;
  testType: string;
  target: string;
  score?: number;
  loss?: number;
  latency?: number;
  jitter?: number;
  throughput?: number;
  httpStatusCode?: number;
}

// ============================================================================
// Internet Insights Types
// ============================================================================

export interface InternetInsightsOutage {
  id: string;
  type: 'application' | 'network';
  providerName: string;
  asNumber?: number;
  startDate: string;
  endDate?: string;
  affectedTests: number;
  affectedInterfaces?: number;
  severity?: string;
}

export type TabType = 'tests' | 'alerts' | 'agents' | 'events' | 'outages' | 'endpoint-agents' | 'path-analysis' | 'bgp';

export interface SelectedDataPoint {
  testId: number;
  data: TestResult;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export type TEDashboardView = 'overview' | 'investigate' | 'platform';

// ============================================================================
// MCP Dashboard Types
// ============================================================================

export interface TEDashboard {
  id: string;
  title: string;
  description?: string;
  isBuiltin: boolean;
  modifiedDate: string;
  widgetCount?: number;
}

export interface TEDashboardWidget {
  id: string;
  title: string;
  type: string;
  dataComponents: any[];
}

export interface TEMCPStatus {
  available: boolean;
  tools: string[];
  endpoint?: string;
}

export interface TESplunkCorrelation {
  splunkMatches: Array<{ host: string; count: string | number }>;
  correlatedDevices: Array<{ ip: string; hostname?: string; platform: string; networkName?: string }>;
}

export interface HealthMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  sparklineData: number[];
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface TestHealthCell {
  testId: number;
  testName: string;
  type: string;
  health: 'healthy' | 'degraded' | 'failing' | 'disabled';
  latestMetrics?: { latency?: number; loss?: number; availability?: number };
}

export interface TimelineItem {
  id: string;
  type: 'alert' | 'event' | 'outage';
  severity: 'critical' | 'major' | 'minor' | 'info';
  title: string;
  description: string;
  timestamp: string;
  endTimestamp?: string;
  isActive: boolean;
  source: Alert | TEEvent | Outage;
}

export interface AgentGroupSummary {
  region: string;
  total: number;
  online: number;
  types: Record<string, number>;
}

export interface MerakiCachedDevice {
  serial: string;
  name: string;
  model: string;
  status: string;
  networkId: string;
  lanIp?: string;
  publicIp?: string;
  mac?: string;
  firmware?: string;
  tags?: string[];
  organizationName?: string;
  networkName?: string;
}

export interface MerakiCachedNetwork {
  id: string;
  name: string;
  organizationId?: string;
  organizationName?: string;
  organizationType?: string;
  productTypes?: string[];
}

// Catalyst Center cached data (from /api/network/cache)
export interface CatalystCachedDevice {
  serial: string;
  name: string;
  model: string;
  status: string;
  networkId: string;
  lanIp?: string;
  publicIp?: string;
  organizationName?: string;
  networkName?: string;
  family?: string;
  osVersion?: string;
  upTime?: string;
  reachabilityStatus?: string;
}

export interface CatalystCachedNetwork {
  id: string;
  name: string;
  organizationName?: string;
  organizationType?: string;
  siteType?: string;
}

// Organization summary from cache
export interface CachedOrganization {
  name: string;
  displayName: string;
  type: 'meraki' | 'catalyst' | 'thousandeyes';
  networkCount: number;
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
  isStale: boolean;
}

// Platform health summary for cross-platform view
export interface PlatformHealthSummary {
  platform: 'thousandeyes' | 'meraki' | 'catalyst';
  configured: boolean;
  deviceCount: number;
  onlineCount: number;
  offlineCount: number;
  healthPercent: number;
  alertCount: number;
  networkCount: number;
  lastSync?: string;
}

// Correlated device - matched across platforms by IP
export interface CorrelatedDevice {
  id: string;
  name: string;
  matchedIp: string;
  teAgent?: { agentId: number; agentName: string; agentType: string; enabled: number | boolean; agentState?: string };
  merakiDevice?: MerakiCachedDevice;
  catalystDevice?: CatalystCachedDevice;
  platforms: ('thousandeyes' | 'meraki' | 'catalyst')[];
  healthStatus: 'healthy' | 'degraded' | 'critical' | 'offline';
}

// Enhanced cross-platform insight with AI context
export interface CrossPlatformInsight {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'infrastructure' | 'performance' | 'availability' | 'correlation' | 'security';
  platforms: ('thousandeyes' | 'meraki' | 'catalyst')[];
  relatedItems: { type: string; id: string; name: string; platform: string }[];
  aiContext?: string; // Pre-built context for AI analysis
  timestamp?: string;
}

// Site-level health aggregation
export interface SiteHealthSummary {
  siteName: string;
  merakiNetworkId?: string;
  catalystSiteId?: string;
  merakiDeviceCount: number;
  merakiOnline: number;
  catalystDeviceCount: number;
  catalystReachable: number;
  teAgentCount: number;
  teAgentsOnline: number;
  teActiveAlerts: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
}

// ============================================================================
// Topology / Path Visualization Types
// ============================================================================

export interface TopologyNode {
  id: string;
  label: string;
  ip: string;
  zone: 'source' | 'local' | 'isp' | 'cloud' | 'destination';
  latency: number;
  loss: number;
  network?: string;
  hopNumber: number;
  prefix?: string;
  asNumber?: string;
}

export interface TopologyLink {
  from: string;
  to: string;
  latency: number;
  loss: number;
  health: 'healthy' | 'degraded' | 'failing';
}

export interface AgentTrace {
  agentId: string;
  agentName: string;
  hops: PathHop[];
}

export interface PathTopology {
  testId: number;
  testName: string;
  testType: string;
  nodes: TopologyNode[];
  links: TopologyLink[];
  totalLatency: number;
  maxLoss: number;
  bottleneckZone: string | null;
  loading: boolean;
  error: string | null;
  agentTraces: AgentTrace[];
}

// ============================================================================
// Zone Configuration & Helpers
// ============================================================================

export interface ZoneConfigEntry {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  dotColorHex: string;
}

export const ZONE_CONFIG: Record<string, ZoneConfigEntry> = {
  source: { label: 'Agent', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-100 dark:bg-cyan-500/20', borderColor: 'border-cyan-300 dark:border-cyan-500/40', dotColor: 'bg-cyan-500', dotColorHex: '#06b6d4' },
  local: { label: 'Local Network', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-500/20', borderColor: 'border-blue-300 dark:border-blue-500/40', dotColor: 'bg-blue-500', dotColorHex: '#3b82f6' },
  isp: { label: 'ISP / Transit', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-500/20', borderColor: 'border-purple-300 dark:border-purple-500/40', dotColor: 'bg-purple-500', dotColorHex: '#a855f7' },
  cloud: { label: 'Cloud / CDN', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-500/20', borderColor: 'border-emerald-300 dark:border-emerald-500/40', dotColor: 'bg-emerald-500', dotColorHex: '#10b981' },
  destination: { label: 'Destination', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-500/20', borderColor: 'border-amber-300 dark:border-amber-500/40', dotColor: 'bg-amber-500', dotColorHex: '#f59e0b' },
};

export const ZONE_ORDER = ['source', 'local', 'isp', 'cloud', 'destination'] as const;

export function classifyZone(hop: PathHop, hopIndex: number, totalHops: number): TopologyNode['zone'] {
  if (hopIndex === 0) return 'source';
  if (hopIndex === totalHops - 1) return 'destination';

  const network = (hop.network || '').toLowerCase();
  const hostname = (hop.hostname || '').toLowerCase();
  const ip = hop.ipAddress || '';

  // Private IP ranges → local network
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
      ip.startsWith('172.2') || ip.startsWith('172.30.') || ip.startsWith('172.31.')) {
    return 'local';
  }

  // Cloud provider detection
  const cloudKeywords = ['aws', 'amazon', 'azure', 'microsoft', 'google', 'gcp', 'cloudflare', 'akamai', 'fastly', 'cdn'];
  if (cloudKeywords.some(k => network.includes(k) || hostname.includes(k))) return 'cloud';

  // ISP detection
  const ispKeywords = ['comcast', 'att', 'verizon', 'level3', 'lumen', 'cogent', 'ntt', 'telia', 'zayo', 'centurylink', 'sprint', 'core', 'backbone', 'transit', 'peer'];
  if (ispKeywords.some(k => network.includes(k) || hostname.includes(k))) return 'isp';

  // Heuristic: early hops = local, middle = ISP, late = cloud
  const position = hopIndex / totalHops;
  if (position < 0.3) return 'local';
  if (position < 0.7) return 'isp';
  return 'cloud';
}

export function getLinkHealth(latency: number, loss: number): TopologyLink['health'] {
  if (loss > 5 || latency > 200) return 'failing';
  if (loss > 1 || latency > 100) return 'degraded';
  return 'healthy';
}

export function extractAsNumber(network?: string): string | undefined {
  if (!network) return undefined;
  const match = network.match(/AS\s*(\d+)/i);
  return match ? match[1] : undefined;
}

export function latencyColor(ms: number): string {
  if (ms > 100) return 'text-red-500';
  if (ms > 50) return 'text-amber-500';
  return 'text-emerald-600 dark:text-emerald-400';
}

export function latencyBarColor(ms: number): string {
  if (ms > 100) return 'bg-red-500';
  if (ms > 50) return 'bg-amber-500';
  return 'bg-emerald-500';
}
