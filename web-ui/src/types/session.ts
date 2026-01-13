/**
 * Session Types - AI Chat Page Redesign
 *
 * Types for session-based canvas management following the "Show, Don't Tell" philosophy.
 * Sessions persist chat history, canvas cards, and metrics across page reloads.
 */

import type { FlowNode, FlowEdge, FlowPhase, TimelineEvent } from './agent-flow';

// Backend card suggestion (from knowledge retrieval, etc.)
export interface CardSuggestion {
  type: string;
  title: string;
  data: any;
  metadata?: Record<string, any>;
}

// Re-export Message type for convenience (defined in ChatMessage.tsx)
export interface Message {
  id: number | string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  data?: any;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
  };
  tools_used?: string[];
  isStreaming?: boolean;
  // New fields for duration tracking
  duration_ms?: number;
  // Per-agent breakdown (for multi-agent responses)
  agent_breakdown?: AgentUsage[];
  // Knowledge base card suggestions from backend
  card_suggestions?: CardSuggestion[];
}

export interface AgentUsage {
  agent_type: 'knowledge' | 'implementation' | 'orchestrator' | 'specialist';
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
}

// =====================================================
// Agent Flow Persistence Types
// =====================================================

/**
 * Serializable version of TimelineEvent for persistence
 * Converts Date to ISO string for JSON storage
 */
export interface SerializedTimelineEvent {
  id: string;
  timestamp: string;  // ISO string instead of Date
  type: string;
  title: string;
  description?: string;
  details?: Record<string, unknown>;
  status?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  agentId?: string;
  toolName?: string;
}

/**
 * Persisted Agent Flow State
 * Includes additional fields needed to fully restore the flow visualization
 */
export interface PersistedAgentFlowState {
  /** All flow nodes (User, Orchestrator, Platform, Response, etc.) */
  nodes: FlowNode[];
  /** All flow edges connecting nodes */
  edges: FlowEdge[];
  /** Current phase of the flow */
  currentPhase: FlowPhase;
  /** Timeline events (with serialized timestamps) */
  timeline: SerializedTimelineEvent[];
  /** Whether the flow is in expanded layout mode */
  isExpanded: boolean;
  /** Platform node IDs that were created */
  platformNodes: string[];
  /** Tools that were used during the flow */
  toolsUsed: string[];
  /** Duration of the flow in milliseconds */
  duration?: number;
}

// Canvas card types
export type CanvasCardType =
  | 'network-health'
  | 'client-distribution'
  | 'performance-chart'
  | 'device-table'
  | 'topology'
  | 'network-topology'
  | 'alert-summary'
  | 'action'  // Interactive action card (ping, traceroute, etc.)
  | 'custom'
  // AI-powered cards
  | 'device-chat'  // Context-aware AI chat for a specific device
  // Phase 2 visualization types
  | 'rf-analysis'      // RF/wireless analysis with AP utilization
  | 'health-trend'     // Historical health scores over time
  | 'comparison'       // Before/after configuration comparisons
  | 'path-analysis'    // Connectivity path trace for troubleshooting
  // Phase 3 device-centric cards (AI Canvas Overhaul)
  | 'device-detail'    // Single device with embedded actions
  | 'device-status'    // Device status grid with health indicators
  | 'client-list'      // Client table with filters
  | 'ssid-performance' // Per-SSID wireless metrics
  | 'uplink-status'    // WAN uplink health and failover
  | 'switch-ports'     // Switch port status grid
  // Phase 4: Core Infrastructure Monitoring cards
  | 'bandwidth-utilization'   // Real-time bandwidth usage per interface
  | 'interface-status'        // Port status grid with up/down/errors
  | 'latency-monitor'         // WAN latency with historical trend
  | 'packet-loss'             // Packet loss percentage with alerts
  | 'cpu-memory-health'       // Device resource utilization
  | 'uptime-tracker'          // Device uptime with history
  | 'sla-compliance'          // SLA metrics vs targets
  | 'wan-failover'            // Primary/backup WAN status
  // Phase 5: Traffic & Performance Analytics cards
  | 'top-talkers'             // Top bandwidth consumers
  | 'traffic-composition'     // Protocol/app breakdown
  | 'application-usage'       // Top applications by bandwidth
  | 'qos-statistics'          // QoS queue performance
  | 'traffic-heatmap'         // Time-of-day traffic patterns
  | 'client-timeline'         // Client connection history
  | 'throughput-comparison'   // Compare throughput across devices
  // Phase 6: Security & Compliance cards
  | 'security-events'         // Security event timeline
  | 'threat-map'              // Geographic threat origins
  | 'firewall-hits'           // Firewall rule match counts
  | 'blocked-connections'     // Blocked traffic summary
  | 'intrusion-detection'     // IDS/IPS alert summary
  | 'compliance-score'        // Security compliance status
  // Phase 7: Wireless Deep Dive cards
  | 'channel-utilization-heatmap'  // AP channel usage heatmap
  | 'client-signal-strength'       // Client RSSI distribution
  | 'ssid-client-breakdown'        // Clients per SSID
  | 'roaming-events'               // Client roaming activity
  | 'interference-monitor'         // Non-WiFi interference
  // Phase 8: Switch & Infrastructure cards
  | 'port-utilization-heatmap'     // Switch port usage heatmap
  | 'vlan-distribution'            // VLAN traffic distribution
  | 'poe-budget'                   // PoE power consumption
  | 'spanning-tree-status'         // STP topology status
  | 'stack-status'                 // Switch stack health
  // Phase 9: Alerts & Incidents cards
  | 'alert-timeline'               // Chronological alert history
  | 'incident-tracker'             // Open incident Kanban
  | 'alert-correlation'            // AI-grouped related alerts
  | 'mttr-metrics'                 // Mean time to resolution
  // Phase 10: Splunk & Log Integration cards
  | 'log-volume-trend'             // Log ingestion over time
  | 'splunk-event-summary'         // Events breakdown by type (device-specific)
  | 'splunk-search-results'        // General Splunk search results with breakdown
  | 'error-distribution'           // Errors by source/type
  | 'event-correlation'            // Correlated log events
  | 'log-severity-breakdown'       // Logs by severity level
  // Phase 11: Knowledge Base cards
  | 'knowledge-sources'            // Cited documents with relevance scores
  | 'datasheet-comparison'         // Product spec comparison table
  | 'knowledge-detail'             // Full document viewer
  | 'product-detail'               // Single product specs and features
  // Phase 12: AI Contextual Cards (data provided by AI, not fetched)
  | 'ai-metric'                    // Single key metric with optional trend
  | 'ai-stats-grid'                // Grid of 2-6 related stats
  | 'ai-gauge'                     // Circular gauge for percentages
  | 'ai-breakdown'                 // Pie/bar chart for distributions
  | 'ai-finding'                   // Important finding or alert card
  | 'ai-device-summary';           // Device/entity summary card

// Action types for action cards
export type ActionType =
  | 'ping'
  | 'traceroute'
  | 'cable-test'
  | 'blink-led'
  | 'reboot'
  | 'wake-on-lan'
  | 'cycle-port';

// Configuration for action cards
export interface ActionCardConfig {
  actionType: ActionType;
  targetDevice?: {
    serial: string;
    name: string;
    model?: string;
    networkId?: string;
    ip?: string;
  };
  targetNetwork?: {
    id: string;
    name: string;
  };
  // Action-specific parameters
  parameters?: {
    target?: string;      // For ping/traceroute: IP or hostname
    count?: number;       // For ping: number of pings
    ports?: string[];     // For cable-test: port numbers
    duration?: number;    // For blink-led: duration in seconds
  };
  // Last execution result
  lastResult?: unknown;
  lastRunAt?: string;
  isRunning?: boolean;
}

// RF Analysis card data structure
export interface RFAnalysisData {
  accessPoints: Array<{
    name: string;
    serial: string;
    band: '2.4GHz' | '5GHz' | '6GHz';
    channel: number;
    channelWidth: number;
    power: number;
    utilization: number;      // 0-100%
    interference: number;     // 0-100%
    noiseFloor: number;       // dBm
    clients: number;
  }>;
  networkId?: string;
  networkName?: string;
  recommendations?: string[];
}

// Health Trend card data structure
export interface HealthTrendData {
  history: Array<{
    timestamp: string;
    score: number;  // 0-100
    category?: 'good' | 'warning' | 'critical';
  }>;
  current: {
    score: number;
    timestamp: string;
    delta?: number;  // Change from previous
  };
  thresholds?: {
    warning: number;  // e.g., 80
    critical: number; // e.g., 60
  };
  networkId?: string;
  networkName?: string;
}

// Comparison card data structure
export interface ComparisonData {
  before: {
    label: string;
    timestamp: string;
    metrics: Record<string, number | string>;
    config?: Record<string, unknown>;
  };
  after: {
    label: string;
    timestamp: string;
    metrics: Record<string, number | string>;
    config?: Record<string, unknown>;
  };
  changes: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
    improvement?: boolean;  // true = better, false = worse, undefined = neutral
  }>;
  summary?: string;
}

// Path Analysis card data structure
export interface PathAnalysisData {
  source: {
    name: string;
    type: 'device' | 'client' | 'gateway';
    ip?: string;
    serial?: string;
  };
  destination: {
    name: string;
    type: 'device' | 'client' | 'gateway' | 'internet';
    ip?: string;
  };
  hops: Array<{
    order: number;
    name: string;
    ip?: string;
    serial?: string;
    deviceType?: string;
    latency?: number;  // ms
    status: 'reachable' | 'unreachable' | 'unknown';
    isBottleneck?: boolean;
  }>;
  overallStatus: 'healthy' | 'degraded' | 'failed';
  totalLatency?: number;
  issues?: string[];
}

// Device Detail card data structure (with embedded actions)
export interface DeviceDetailData {
  device: {
    serial: string;
    name: string;
    model: string;
    status: 'online' | 'offline' | 'alerting' | 'dormant' | 'unknown';
    lanIp?: string;
    publicIp?: string;
    mac?: string;
    firmware?: string;
    lastReportedAt?: string;
    tags?: string[];
    networkId?: string;
    networkName?: string;
  };
  clients?: Array<{
    id: string;
    mac: string;
    description?: string;
    ip?: string;
    vlan?: number;
    usage?: { sent: number; recv: number };
  }>;
  clientCount?: number;
  uplinks?: Array<{
    interface: string;
    status: 'active' | 'failed' | 'not connected';
    ip?: string;
    gateway?: string;
    publicIp?: string;
    primaryDns?: string;
  }>;
  neighbors?: Array<{
    port: string;
    type: 'LLDP' | 'CDP';
    deviceId?: string;
    portId?: string;
    systemName?: string;
  }>;
  recentEvents?: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
  availableActions: ActionType[];
  networkId?: string;
}

// Network Overview card data structure
export interface NetworkOverviewData {
  network: {
    id: string;
    name: string;
    organizationId?: string;
    organizationName?: string;
    timeZone?: string;
    productTypes?: string[];
  };
  health: {
    score: number;
    category: 'good' | 'warning' | 'critical';
  };
  devices: {
    total: number;
    online: number;
    alerting: number;
    offline: number;
  };
  clients: {
    total: number;
    wireless?: number;
    wired?: number;
  };
  alerts: {
    total: number;
    critical?: number;
    warning?: number;
  };
  uplinks: {
    total: number;
    active: number;
  };
}

// Client List card data structure
export interface ClientListData {
  clients: Array<{
    id: string;
    mac: string;
    description?: string;
    ip?: string;
    ip6?: string;
    vlan?: number;
    switchport?: string;
    ssid?: string;
    status?: 'online' | 'offline';
    firstSeen?: string;
    lastSeen?: string;
    manufacturer?: string;
    os?: string;
    usage?: { sent: number; recv: number };
    rssi?: number;  // For wireless clients
  }>;
  networkId: string;
  networkName?: string;
  totalCount: number;
}

// SSID Performance card data structure
export interface SSIDPerformanceData {
  ssids: Array<{
    number: number;
    name: string;
    enabled: boolean;
    clientCount: number;
    avgSignal?: number;
    avgLatency?: number;
    bandwidthUsage?: { sent: number; recv: number };
    authMode?: string;
  }>;
  networkId: string;
  networkName?: string;
}

// Uplink Status card data structure
export interface UplinkStatusData {
  uplinks: Array<{
    interface: string;
    status: 'active' | 'ready' | 'connecting' | 'not connected' | 'failed';
    ip?: string;
    gateway?: string;
    publicIp?: string;
    dns?: string[];
    connectionType?: string;
    provider?: string;
    signalStat?: number;  // For cellular
    model?: string;
    serial?: string;
    loss?: number;
    latency?: number;
    lastActive?: string;
  }>;
  failoverEnabled?: boolean;
  primaryUplink?: string;
  networkId?: string;
  deviceSerial?: string;
}

// Switch Ports card data structure
export interface SwitchPortsData {
  ports: Array<{
    portId: string;
    name?: string;
    enabled: boolean;
    poeEnabled?: boolean;
    type: 'access' | 'trunk';
    vlan?: number;
    allowedVlans?: string;
    status?: 'connected' | 'disconnected' | 'disabled' | 'err-disabled';
    speed?: string;
    duplex?: string;
    clientCount?: number;
    trafficInKbps?: { sent: number; recv: number };
    errors?: { crc: number; collision: number };
  }>;
  deviceSerial: string;
  deviceName?: string;
  model?: string;
  networkId?: string;
}

// Product Detail card data structure (for single-product queries)
export interface ProductDetailData {
  product: {
    name: string;           // e.g., "Catalyst 9200L"
    model?: string;         // e.g., "C9200L-24P-4G"
    family?: string;        // e.g., "Catalyst 9200 Series"
    description?: string;
  };
  specs: Record<string, string | number | boolean>;  // Key-value specs
  categories?: Array<{
    name: string;           // e.g., "Hardware", "Software", "Performance"
    specs: Record<string, string | number | boolean>;
  }>;
  models?: Array<{
    name: string;
    description?: string;
  }>;
  features?: string[];      // Key features list
  useCases?: string[];      // Recommended use cases
  sources?: Array<{
    id: number;
    title: string;
    relevance: number;
  }>;
}

// =====================================================
// AI Contextual Card Data Types (Phase 12)
// These cards display data provided directly by the AI
// rather than fetching data from APIs
// =====================================================

// Single key metric with optional trend indicator
export interface AIMetricData {
  label: string;           // "Wireless Success Rate"
  value: number;           // 91
  unit?: string;           // "%"
  trend?: 'up' | 'down' | 'stable';
  context?: string;        // "Last 24 hours"
  status?: 'good' | 'warning' | 'critical';
}

// Grid of 2-6 related metrics
export interface AIStatsGridData {
  title?: string;          // "Network Health Summary"
  stats: Array<{
    label: string;         // "Online Devices"
    value: string;         // "47"
    icon?: string;         // "device", "client", "alert", etc.
    status?: 'good' | 'warning' | 'critical';
  }>;
}

// Circular gauge for percentages/utilization
export interface AIGaugeData {
  label: string;           // "CPU Utilization"
  value: number;           // 67
  max: number;             // 100
  unit?: string;           // "%"
  thresholds?: {
    warning: number;       // 70
    critical: number;      // 90
  };
}

// Category breakdown with pie/bar/donut chart
export interface AIBreakdownData {
  title: string;           // "Device Status Breakdown"
  items: Array<{
    label: string;         // "Online"
    value: number;         // 42
    color?: string;        // "#22c55e"
  }>;
  displayAs: 'pie' | 'bar' | 'donut';
}

// Important finding or alert
export interface AIFindingData {
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;           // "High Latency Detected"
  description: string;     // "3 APs showing >100ms latency"
  details?: Array<{
    label: string;
    value: string;
  }>;
  recommendation?: string;
}

// Device or entity summary
export interface AIDeviceSummaryData {
  name: string;            // "AP-Office-Main"
  type: string;            // "Access Point"
  status: 'online' | 'offline' | 'alerting';
  attributes: Array<{
    label: string;
    value: string;
  }>;
  metrics?: Array<{
    label: string;
    value: string;
    status?: 'good' | 'warning' | 'critical';
  }>;
}

export interface CanvasCardLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

// Live card subscription for real-time updates
export interface CardSubscription {
  topic: string;  // e.g., "meraki:devices:248496"
  dataPath?: string;  // JSONPath to extract from updates
  transformFn?: string;  // Named transform function
}

export interface CanvasCardMetadata {
  createdAt: string;
  updatedAt: string;
  costUsd: number;
  isLive: boolean;
  refreshInterval?: number; // ms between auto-refreshes
  subscription?: CardSubscription;  // WebSocket subscription for live updates
  lastLiveUpdate?: string;  // ISO timestamp of last live update
  // Query context - links card to the query that created it
  sourceQuery?: string;      // The user's original query
  sourceMessageId?: string;  // Link to the message that created this card
  toolName?: string;         // The tool that generated this data
  // Template context - for cards generated from templates
  templateSource?: string;   // ID of the template that created this card
  // Auto-add context - for cards automatically added by AI recommendations
  autoAdded?: boolean;       // Whether this card was auto-added by AI
}

export interface CanvasCard {
  id: string;
  type: CanvasCardType;
  title: string;
  layout: CanvasCardLayout;
  data?: any;
  metadata: CanvasCardMetadata;
  // Configuration specific to card type
  config?: Record<string, any>;
}

// Session metrics (aggregated from all messages and cards)
export interface SessionMetrics {
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  totalDurationMs: number;
  cardCount: number;
  messageCount: number;
}

// Main session interface
export interface ChatSession {
  id: string;
  name: string;  // Auto-generated from first query, truncated to 50 chars
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  canvasCards: CanvasCard[];
  metrics: SessionMetrics;
  organization?: string;
  thumbnail?: string;  // Base64 data URL of canvas snapshot
  /** Agent flow state for persistence across navigation */
  agentFlowState?: PersistedAgentFlowState;
}

// Canvas suggestion (appears in chat after AI response)
export interface CanvasSuggestion {
  id: string;
  label: string;  // e.g., "Add network health chart"
  cardType: CanvasCardType;
  data: any;
  config?: Record<string, any>;
}

// Session list item (for dropdown/list views)
export interface SessionListItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metrics: SessionMetrics;
  thumbnail?: string;
}

// Helper function to create default metrics
export function createDefaultMetrics(): SessionMetrics {
  return {
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCostUsd: 0,
    totalDurationMs: 0,
    cardCount: 0,
    messageCount: 0,
  };
}

// Helper function to create a new session
export function createNewSession(organization?: string): ChatSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: 'New Session',
    createdAt: now,
    updatedAt: now,
    messages: [],
    canvasCards: [],
    metrics: createDefaultMetrics(),
    organization,
  };
}

// Helper function to generate session name from first query
export function generateSessionName(query: string): string {
  // Remove special characters and truncate
  const cleaned = query
    .replace(/[^\w\s]/g, '')
    .trim()
    .slice(0, 50);
  return cleaned || 'New Session';
}

// Helper function to compute metrics from messages and cards
export function computeSessionMetrics(
  messages: Message[],
  cards: CanvasCard[]
): SessionMetrics {
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCostUsd = 0;
  let totalDurationMs = 0;

  for (const msg of messages) {
    if (msg.usage) {
      totalTokensIn += msg.usage.input_tokens ?? 0;
      totalTokensOut += msg.usage.output_tokens ?? 0;
      totalCostUsd += msg.usage.cost_usd ?? 0;
    }
    totalDurationMs += msg.duration_ms ?? 0;
  }

  // Add card costs
  for (const card of cards) {
    totalCostUsd += card.metadata.costUsd;
  }

  return {
    totalTokensIn,
    totalTokensOut,
    totalCostUsd,
    totalDurationMs,
    cardCount: cards.length,
    messageCount: messages.length,
  };
}
