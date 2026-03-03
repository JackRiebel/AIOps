/**
 * Smart Cards Type System
 *
 * Comprehensive type definitions for the Hybrid Smart Cards architecture.
 * Supports Meraki, ThousandEyes, Splunk, Catalyst Center, and general networking cards.
 */

// =============================================================================
// Core Card Types
// =============================================================================

/**
 * Visualization types supported by cards
 */
export type VisualizationType =
  | 'big_number'       // Single large metric with optional trend
  | 'donut'            // Donut/pie chart for distributions
  | 'line_chart'       // Time series line chart
  | 'area_chart'       // Stacked area chart
  | 'bar_chart'        // Horizontal or vertical bars
  | 'table'            // Data table with sorting/filtering
  | 'status_grid'      // Grid of status indicators
  | 'gauge'            // Single gauge meter
  | 'multi_gauge'      // Multiple gauges in a row
  | 'badge_list'       // List of count badges
  | 'timeline'         // Event timeline
  | 'heatmap'          // Heat map grid
  | 'topology'         // Network topology diagram
  | 'progress_list'    // List with progress bars
  | 'stat_row'         // Row of stat boxes
  | 'alert_list'       // Alert/incident list
  | 'device_list'      // Device status list
  | 'sparkline'        // Compact inline chart
  // Enhanced enterprise-style visualizations
  | 'network_health'   // Network health with gauges and metrics
  | 'wireless_overview' // Wireless APs, channels, SSIDs
  | 'device_status'    // Device grid with filters
  | 'security_events'  // Security event timeline
  | 'traffic_analytics' // Top talkers and traffic analysis
  | 'performance_overview' // Performance metrics with gauges
  | 'change_comparison' // Before/after metric comparison
  | 'change_history'    // Timeline of configuration changes
  // ThousandEyes-specific visualizations
  | 'te_path_flow'         // ThousandEyes path flow diagram
  | 'te_latency_waterfall' // Per-hop latency waterfall
  | 'te_bgp_routing'       // BGP route changes
  | 'te_network_diagnostic' // Cross-platform network diagnostic
  | 'custom';          // Custom component

/**
 * Card size presets for CSS Grid layout
 * colSpan: number of columns (1-3)
 * rowSpan: number of rows (1-3)
 * minHeight: fallback minimum height in pixels
 */
export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'wide' | 'tall';

export const CARD_SIZES: Record<CardSize, {
  minHeight: number;
  colSpan: number;
  rowSpan: number;
}> = {
  xs: { minHeight: 120, colSpan: 1, rowSpan: 1 },      // Compact single metric (big number)
  sm: { minHeight: 160, colSpan: 1, rowSpan: 1 },      // Small card (single gauge, simple badge list)
  md: { minHeight: 220, colSpan: 1, rowSpan: 2 },      // Medium card (donuts, simple charts)
  lg: { minHeight: 280, colSpan: 2, rowSpan: 2 },      // Large card (multi-gauge, bar charts, tables)
  xl: { minHeight: 360, colSpan: 2, rowSpan: 3 },      // Extra large (detailed tables, complex viz)
  wide: { minHeight: 180, colSpan: 3, rowSpan: 1 },    // Full-width card
  tall: { minHeight: 400, colSpan: 1, rowSpan: 3 },    // Tall card for timelines and lists
};

/**
 * Data freshness status
 */
export type FreshnessStatus = 'live' | 'recent' | 'stale' | 'error' | 'loading';

/**
 * Card platform/source
 */
export type CardPlatform =
  | 'meraki'
  | 'thousandeyes'
  | 'splunk'
  | 'catalyst'
  | 'general'
  | 'system';

// =============================================================================
// Card Type Registry
// =============================================================================

/**
 * All supported card types organized by platform
 */
export type MerakiCardType =
  | 'meraki_network_health'           // Network-wide device health donut
  | 'meraki_device_table'             // Device inventory table
  | 'meraki_alert_summary'            // Alert counts and list
  | 'meraki_top_clients'              // Top bandwidth clients
  | 'meraki_uplink_status'            // WAN uplink health
  | 'meraki_ssid_clients'             // SSID client distribution
  | 'meraki_switch_ports'             // Switch port utilization
  | 'meraki_vpn_status'               // VPN tunnel status
  | 'meraki_security_events'          // Security event timeline
  | 'meraki_top_applications'         // Top apps by usage
  | 'meraki_rf_health'                // Wireless RF metrics
  | 'meraki_device_uptime'            // Device uptime stats
  | 'meraki_bandwidth_usage'          // Bandwidth time series
  | 'meraki_client_count'             // Connected client count
  | 'meraki_latency_loss'             // Latency/packet loss metrics
  | 'meraki_wireless_stats'           // Wireless connection stats
  | 'meraki_firewall_rules'           // L3/L7 firewall rules table
  | 'meraki_vlan_list';               // VLAN configuration table

export type ThousandEyesCardType =
  | 'te_agent_health'                 // Agent status grid
  | 'te_alert_summary'                // Active alert badges
  | 'te_path_visualization'           // Network path diagram
  | 'te_latency_chart'                // Loss/latency/jitter chart
  | 'te_outage_map'                   // Internet outage heatmap
  | 'te_bgp_changes'                  // BGP route changes
  | 'te_dns_response'                 // DNS response times
  | 'te_voip_quality'                 // VoIP MOS scores
  | 'te_web_transaction'              // Web transaction waterfall
  | 'te_endpoint_sessions'            // Endpoint agent sessions
  | 'te_test_results'                 // Test results summary
  | 'te_network_diagnostic';          // Cross-platform network diagnostic

export type SplunkCardType =
  | 'splunk_event_count'              // Event count time series
  | 'splunk_top_errors'               // Top error messages
  | 'splunk_severity_donut'           // Severity distribution
  | 'splunk_metric'                   // Key metric big number
  | 'splunk_search_results'           // Search result table
  | 'splunk_notable_events'           // Notable events list
  | 'splunk_activity_heatmap'         // User activity heatmap
  | 'splunk_sourcetype_volume'        // Sourcetype volume chart
  | 'splunk_log_trends'               // Log volume over time
  | 'splunk_insights_summary';        // AI insights summary

export type CatalystCardType =
  | 'catalyst_site_health'            // Site health score
  | 'catalyst_device_inventory'       // Device inventory table
  | 'catalyst_issue_summary'          // Assurance issues
  | 'catalyst_client_health'          // Client health timeline
  | 'catalyst_app_health'             // Application health
  | 'catalyst_fabric_status'          // Fabric site status
  | 'catalyst_rogue_aps'              // Rogue AP detection
  | 'catalyst_client_onboarding'      // Client onboarding
  | 'catalyst_compliance'             // Device compliance
  | 'catalyst_poe_usage'              // PoE consumption
  | 'catalyst_interfaces';            // Interface details table

export type GeneralNetworkCardType =
  | 'network_routing_table'           // Routing table view
  | 'network_bgp_neighbors'           // BGP neighbor status
  | 'network_ospf_status'             // OSPF area/neighbor
  | 'network_vlan_map'                // VLAN/port mapping
  | 'network_arp_table'               // ARP table summary
  | 'network_mac_table'               // MAC address table
  | 'network_traceroute'              // Traceroute visualization
  | 'network_packet_capture'          // Packet capture summary
  | 'network_acl_hits'                // ACL hit counters
  | 'network_qos_policy'              // QoS policy diagram
  | 'network_stp_topology'            // Spanning tree topology
  | 'network_troubleshoot_flow'       // Troubleshooting flowchart
  | 'network_performance_overview'    // Current performance snapshot
  | 'network_change_comparison'       // Before/after comparison with revert
  | 'network_change_history';         // History of changes with impact

/**
 * AI Contextual Cards - Data provided directly by the AI, not fetched from APIs
 */
export type AICardType =
  | 'ai_metric'                       // Single key metric (big number)
  | 'ai_stats_grid'                   // Grid of 2-6 related stats
  | 'ai_gauge'                        // Circular gauge for percentages
  | 'ai_breakdown'                    // Pie/donut/bar chart for distributions
  | 'ai_finding'                      // Important finding or alert
  | 'ai_device_summary';             // Device summary with attributes

/**
 * Knowledge Base Cards - Documentation, datasheets, product comparisons
 */
export type KnowledgeCardType =
  | 'knowledge_sources'               // Source documents/citations
  | 'product_detail'                  // Product datasheet/specs
  | 'datasheet_comparison';           // Side-by-side product comparison

export type AllCardTypes =
  | MerakiCardType
  | ThousandEyesCardType
  | SplunkCardType
  | CatalystCardType
  | GeneralNetworkCardType
  | AICardType
  | KnowledgeCardType;

// =============================================================================
// Visualization Configuration
// =============================================================================

export interface ThresholdConfig {
  value: number;
  color: string;
  label?: string;
}

export interface ColumnConfig {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'status' | 'date' | 'badge' | 'progress';
  sortable?: boolean;
  width?: string;
  format?: string;
  colorMap?: Record<string, string>;
}

export interface ChartConfig {
  xField?: string;
  yField?: string;
  seriesField?: string;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  animate?: boolean;
}

export interface VisualizationConfig {
  type: VisualizationType;
  // Table config
  columns?: ColumnConfig[];
  pageSize?: number;
  // Chart config
  chart?: ChartConfig;
  // Metric config
  valueField?: string;
  labelField?: string;
  trendField?: string;
  unit?: string;
  precision?: number;
  // Status config
  statusField?: string;
  statusColors?: Record<string, string>;
  // Thresholds
  thresholds?: ThresholdConfig[];
  // Layout
  orientation?: 'horizontal' | 'vertical';
  showValues?: boolean;
  compact?: boolean;
}

// =============================================================================
// Smart Card Interface
// =============================================================================

export interface SmartCard<T = unknown> {
  // Identity
  id: string;
  type: AllCardTypes;
  title: string;
  subtitle?: string;

  // Size
  size: CardSize;

  // Data from AI/tool call
  initialData: {
    payload: T;
    toolCallId: string;
    generatedAt: string;
  };

  // Current data state (for refresh)
  data: {
    current: T;
    lastUpdated: string;
    isStale: boolean;
    error?: string;
    status: FreshnessStatus;
  };

  // Refresh configuration
  refresh: {
    endpoint?: string;
    interval: number;       // ms, 0 = manual only
    enabled: boolean;
    lastAttempt?: string;
    retryCount?: number;
  };

  // Platform-specific scope
  scope?: {
    /** Credential/cluster name for API authentication (e.g., "Demo Networks") */
    credentialOrg?: string;
    /** Meraki organization ID (numeric) */
    organizationId?: string;
    /** Display name for the organization */
    organizationName?: string;
    networkId?: string;
    networkName?: string;
    deviceSerial?: string;
    siteId?: string;
    testId?: string;
    productType?: string;
  };

  // Visualization
  visualization: VisualizationConfig;

  // AI context for follow-up
  aiContext?: {
    originalQuery: string;
    sourceMessageId?: string;
    suggestedActions?: string[];
  };

  // UI state
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Card Definition (for registry)
// =============================================================================

export interface CardDefinition {
  type: AllCardTypes;
  platform: CardPlatform;
  title: string;
  description: string;
  defaultSize: CardSize;
  defaultRefreshInterval: number;  // ms
  visualization: VisualizationType;
  icon?: string;
  // Data shape hints for AI
  dataShape: {
    type: 'scalar' | 'list' | 'timeseries' | 'object' | 'nested';
    fields?: string[];
  };
}

// =============================================================================
// Card Creation Helpers
// =============================================================================

export interface CreateCardOptions<T = unknown> {
  type: AllCardTypes;
  title: string;
  subtitle?: string;
  data: T;
  toolCallId: string;
  scope?: SmartCard['scope'];
  visualization?: Partial<VisualizationConfig>;
  refreshEndpoint?: string;
  refreshInterval?: number;
  sourceMessageId?: string;
  originalQuery?: string;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface CardRefreshResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// =============================================================================
// Status/Health Types (common across platforms)
// =============================================================================

export type DeviceStatus = 'online' | 'offline' | 'alerting' | 'dormant' | 'unknown';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type HealthScore = 'good' | 'fair' | 'poor' | 'unknown';

export interface StatusCount {
  online: number;
  offline: number;
  alerting: number;
  dormant?: number;
  total: number;
}

export interface AlertCount {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface DeviceInfo {
  serial: string;
  name: string;
  model: string;
  status: DeviceStatus;
  networkId?: string;
  networkName?: string;
  lanIp?: string;
  mac?: string;
  firmware?: string;
  lastReportedAt?: string;
  tags?: string[];
}

export interface ClientInfo {
  id: string;
  mac: string;
  description?: string;
  ip?: string;
  vlan?: number;
  ssid?: string;
  status: string;
  usage?: {
    sent: number;
    recv: number;
  };
  manufacturer?: string;
  os?: string;
  firstSeen?: string;
  lastSeen?: string;
}

export interface UplinkInfo {
  interface: string;
  status: 'active' | 'ready' | 'not connected' | 'failed';
  ip?: string;
  gateway?: string;
  publicIp?: string;
  dns?: string[];
  provider?: string;
  latencyMs?: number;
  lossPercent?: number;
}

// =============================================================================
// Chart Data Types
// =============================================================================

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

export interface GaugeData {
  value: number;
  min: number;
  max: number;
  label: string;
  unit?: string;
  status?: 'good' | 'warning' | 'critical';
}

// =============================================================================
// Default Status Colors
// =============================================================================

export const STATUS_COLORS: Record<string, string> = {
  // Device status
  online: '#10b981',       // emerald-500
  offline: '#ef4444',      // red-500
  alerting: '#f59e0b',     // amber-500
  dormant: '#6b7280',      // gray-500
  unknown: '#94a3b8',      // slate-400

  // Health status
  good: '#10b981',
  fair: '#f59e0b',
  poor: '#ef4444',
  healthy: '#10b981',

  // Alert severity (distinct colors for each level)
  critical: '#dc2626',     // red-600 (darker red)
  high: '#f97316',         // orange-500
  medium: '#f59e0b',       // amber-500
  warning: '#eab308',      // yellow-500
  low: '#3b82f6',          // blue-500
  info: '#06b6d4',         // cyan-500
  debug: '#8b5cf6',        // violet-500

  // General
  active: '#10b981',
  inactive: '#6b7280',
  pending: '#f59e0b',
  error: '#f97316',        // orange-500 (distinct from critical)
  success: '#10b981',
};

// =============================================================================
// Default Refresh Intervals (ms)
// =============================================================================

export const DEFAULT_REFRESH_INTERVALS: Partial<Record<AllCardTypes, number>> = {
  // Meraki - most update frequently
  meraki_alert_summary: 15000,        // 15s - alerts are critical
  meraki_uplink_status: 30000,        // 30s
  meraki_network_health: 60000,       // 60s
  meraki_device_table: 30000,         // 30s
  meraki_top_clients: 60000,          // 60s
  meraki_bandwidth_usage: 60000,      // 60s
  meraki_security_events: 30000,      // 30s
  meraki_client_count: 60000,         // 60s
  meraki_wireless_stats: 60000,       // 60s - wireless connection stats
  meraki_rf_health: 60000,            // 60s - RF metrics
  meraki_latency_loss: 60000,         // 60s - latency metrics

  // ThousandEyes
  te_alert_summary: 15000,            // 15s
  te_agent_health: 30000,             // 30s
  te_latency_chart: 60000,            // 60s
  te_voip_quality: 60000,             // 60s

  // Splunk
  splunk_event_count: 30000,          // 30s
  splunk_notable_events: 15000,       // 15s
  splunk_metric: 60000,               // 60s

  // Catalyst
  catalyst_site_health: 60000,        // 60s
  catalyst_issue_summary: 30000,      // 30s
  catalyst_device_inventory: 60000,   // 60s
};

export const DEFAULT_REFRESH_INTERVAL = 60000; // 60s default

// =============================================================================
// Backend to Frontend Card Type Mapping
// =============================================================================

/**
 * Maps backend canvas.py card types to frontend SmartCard types.
 * The backend uses kebab-case names (e.g., 'device-table'),
 * while the frontend uses snake_case with platform prefix (e.g., 'meraki_device_table').
 */
export const BACKEND_TO_FRONTEND_CARD_TYPE: Record<string, AllCardTypes> = {
  // Core monitoring cards
  'network-health': 'meraki_network_health',
  'device-table': 'meraki_device_table',
  'topology': 'network_stp_topology',
  'alert-summary': 'meraki_alert_summary',
  'performance-chart': 'meraki_bandwidth_usage',
  'client-distribution': 'meraki_ssid_clients',

  // Device-centric cards
  'device-detail': 'meraki_device_table',
  'device-status': 'meraki_network_health',
  'client-list': 'meraki_top_clients',
  'uplink-status': 'meraki_uplink_status',
  'switch-ports': 'meraki_switch_ports',

  // Infrastructure monitoring
  'bandwidth-utilization': 'meraki_bandwidth_usage',
  'latency-monitor': 'meraki_latency_loss',
  'packet-loss': 'meraki_latency_loss',
  'cpu-memory-health': 'meraki_device_uptime',
  'uptime-tracker': 'meraki_device_uptime',
  'wan-failover': 'meraki_uplink_status',

  // Traffic analytics
  'top-talkers': 'meraki_top_clients',
  'traffic-composition': 'meraki_top_applications',
  'application-usage': 'meraki_top_applications',

  // Security cards
  'security-events': 'meraki_security_events',
  'firewall-hits': 'meraki_security_events',
  'firewall-rules': 'meraki_firewall_rules',
  'blocked-connections': 'meraki_security_events',
  'vlan-list': 'meraki_vlan_list',

  // Wireless cards
  'rf-analysis': 'meraki_rf_health',
  'channel-utilization-heatmap': 'meraki_rf_health',
  'client-signal-strength': 'meraki_wireless_stats',
  'ssid-client-breakdown': 'meraki_ssid_clients',
  'roaming-events': 'meraki_wireless_stats',

  // Alerts & incidents
  'alert-timeline': 'meraki_security_events',
  'incident-tracker': 'meraki_alert_summary',
  'alert-correlation': 'meraki_alert_summary',

  // Splunk integration
  'splunk-search-results': 'splunk_search_results',
  'log-volume-trend': 'splunk_event_count',
  'error-distribution': 'splunk_top_errors',

  // VPN
  'vpn-status': 'meraki_vpn_status',

  // Network Performance Cards
  'performance-overview': 'network_performance_overview',
  'change-comparison': 'network_change_comparison',
  'change-history': 'network_change_history',

  // AI Contextual Cards (backend sends kebab-case)
  'ai-metric': 'ai_metric',
  'ai-stats-grid': 'ai_stats_grid',
  'ai-gauge': 'ai_gauge',
  'ai-breakdown': 'ai_breakdown',
  'ai-finding': 'ai_finding',
  'ai-device-summary': 'ai_device_summary',

  // Knowledge Base Cards (backend sends kebab-case)
  'knowledge-sources': 'knowledge_sources',
  'product-detail': 'product_detail',
  'datasheet-comparison': 'datasheet_comparison',
};

/**
 * Convert a backend card type to frontend SmartCard type.
 * Returns the mapped type if found, otherwise returns the input as-is
 * (allowing for direct frontend type names to pass through).
 */
export function mapBackendCardType(backendType: string): AllCardTypes | null {
  // First check direct mapping
  const mapped = BACKEND_TO_FRONTEND_CARD_TYPE[backendType];
  if (mapped) {
    return mapped;
  }

  // Check if it's already a valid frontend type (snake_case with platform prefix)
  const frontendTypes: AllCardTypes[] = [
    'meraki_network_health', 'meraki_device_table', 'meraki_alert_summary',
    'meraki_top_clients', 'meraki_uplink_status', 'meraki_ssid_clients',
    'meraki_switch_ports', 'meraki_vpn_status', 'meraki_security_events',
    'meraki_top_applications', 'meraki_rf_health', 'meraki_device_uptime',
    'meraki_bandwidth_usage', 'meraki_client_count', 'meraki_latency_loss',
    'meraki_wireless_stats', 'meraki_firewall_rules', 'meraki_vlan_list',
    'te_agent_health', 'te_alert_summary', 'te_path_visualization',
    'te_latency_chart', 'te_outage_map', 'te_bgp_changes', 'te_dns_response',
    'te_voip_quality', 'te_web_transaction', 'te_endpoint_sessions', 'te_test_results',
    'te_network_diagnostic',
    'splunk_event_count', 'splunk_top_errors', 'splunk_severity_donut',
    'splunk_metric', 'splunk_search_results', 'splunk_notable_events',
    'splunk_activity_heatmap', 'splunk_sourcetype_volume',
    'splunk_log_trends', 'splunk_insights_summary',
    'catalyst_site_health', 'catalyst_device_inventory', 'catalyst_issue_summary',
    'catalyst_client_health', 'catalyst_app_health', 'catalyst_fabric_status',
    'catalyst_rogue_aps', 'catalyst_client_onboarding', 'catalyst_compliance',
    'catalyst_poe_usage', 'catalyst_interfaces',
    'network_routing_table', 'network_bgp_neighbors', 'network_ospf_status',
    'network_vlan_map', 'network_arp_table', 'network_mac_table',
    'network_traceroute', 'network_packet_capture', 'network_acl_hits',
    'network_qos_policy', 'network_stp_topology', 'network_troubleshoot_flow',
    'network_performance_overview', 'network_change_comparison', 'network_change_history',
    // AI Contextual Cards
    'ai_metric', 'ai_stats_grid', 'ai_gauge', 'ai_breakdown', 'ai_finding', 'ai_device_summary',
    // Knowledge Base Cards
    'knowledge_sources', 'product_detail', 'datasheet_comparison',
  ];

  if (frontendTypes.includes(backendType as AllCardTypes)) {
    return backendType as AllCardTypes;
  }

  // Unknown type - log warning and return null
  console.warn(`[CardTypeMapping] Unknown card type: ${backendType}`);
  return null;
}
