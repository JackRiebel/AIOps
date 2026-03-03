/**
 * Smart Cards Registry
 *
 * Central registry of all card type definitions with their
 * default configurations, visualization types, and data shapes.
 */

import {
  AllCardTypes,
  CardDefinition,
  CardPlatform,
  CardSize,
  VisualizationType,
  DEFAULT_REFRESH_INTERVAL,
  SmartCard,
  FreshnessStatus,
} from './types';

// =============================================================================
// Card Definitions
// =============================================================================

export const CARD_REGISTRY: Record<AllCardTypes, CardDefinition> = {
  // ===========================================================================
  // Meraki Cards
  // ===========================================================================
  meraki_network_health: {
    type: 'meraki_network_health',
    platform: 'meraki',
    title: 'Network Health',
    description: 'Device status distribution across the network',
    defaultSize: 'md',
    defaultRefreshInterval: 60000,
    visualization: 'network_health',  // Enhanced enterprise visualization
    icon: 'network',
    dataShape: { type: 'object', fields: ['online', 'offline', 'alerting', 'dormant', 'total'] },
  },
  meraki_device_table: {
    type: 'meraki_device_table',
    platform: 'meraki',
    title: 'Device Inventory',
    description: 'Complete device list with status and details',
    defaultSize: 'lg',
    defaultRefreshInterval: 30000,
    visualization: 'table',
    icon: 'server',
    dataShape: { type: 'list', fields: ['serial', 'name', 'model', 'status', 'lanIp', 'firmware'] },
  },
  meraki_alert_summary: {
    type: 'meraki_alert_summary',
    platform: 'meraki',
    title: 'Alert Summary',
    description: 'Active alerts by severity',
    defaultSize: 'md',  // Badge list needs room for multiple severity badges
    defaultRefreshInterval: 15000,
    visualization: 'badge_list',
    icon: 'alert',
    dataShape: { type: 'object', fields: ['critical', 'high', 'medium', 'low', 'info', 'total'] },
  },
  meraki_top_clients: {
    type: 'meraki_top_clients',
    platform: 'meraki',
    title: 'Top Clients',
    description: 'Highest bandwidth consumers',
    defaultSize: 'lg',
    defaultRefreshInterval: 60000,
    visualization: 'traffic_analytics',  // Enhanced enterprise visualization
    icon: 'users',
    dataShape: { type: 'list', fields: ['description', 'ip', 'usage', 'ssid'] },
  },
  meraki_uplink_status: {
    type: 'meraki_uplink_status',
    platform: 'meraki',
    title: 'Uplink Status',
    description: 'WAN uplink health and connectivity',
    defaultSize: 'md',
    defaultRefreshInterval: 30000,
    visualization: 'status_grid',
    icon: 'upload',
    dataShape: { type: 'list', fields: ['interface', 'status', 'ip', 'publicIp', 'latencyMs', 'lossPercent'] },
  },
  meraki_ssid_clients: {
    type: 'meraki_ssid_clients',
    platform: 'meraki',
    title: 'SSID Clients',
    description: 'Client distribution by SSID',
    defaultSize: 'md',  // Donut chart with legend for multiple SSIDs
    defaultRefreshInterval: 60000,
    visualization: 'donut',
    icon: 'wifi',
    dataShape: { type: 'list', fields: ['ssid', 'clientCount'] },
  },
  meraki_switch_ports: {
    type: 'meraki_switch_ports',
    platform: 'meraki',
    title: 'Switch Ports',
    description: 'Switch port utilization and status',
    defaultSize: 'lg',  // Status grid for multiple ports needs more space
    defaultRefreshInterval: 30000,
    visualization: 'status_grid',
    icon: 'switch',
    dataShape: { type: 'list', fields: ['portId', 'status', 'vlan', 'speed', 'clientCount'] },
  },
  meraki_vpn_status: {
    type: 'meraki_vpn_status',
    platform: 'meraki',
    title: 'VPN Tunnels',
    description: 'Site-to-site VPN tunnel status',
    defaultSize: 'md',
    defaultRefreshInterval: 30000,
    visualization: 'status_grid',
    icon: 'shield',
    dataShape: { type: 'list', fields: ['networkName', 'status', 'latencyMs', 'mode'] },
  },
  meraki_security_events: {
    type: 'meraki_security_events',
    platform: 'meraki',
    title: 'Security Events',
    description: 'Recent security events timeline',
    defaultSize: 'tall',
    defaultRefreshInterval: 30000,
    visualization: 'security_events',  // Enhanced enterprise visualization
    icon: 'shield',
    dataShape: { type: 'list', fields: ['timestamp', 'eventType', 'srcIp', 'destIp', 'blocked'] },
  },
  meraki_top_applications: {
    type: 'meraki_top_applications',
    platform: 'meraki',
    title: 'Top Applications',
    description: 'Applications by bandwidth usage',
    defaultSize: 'lg',  // Bar chart with multiple applications needs height
    defaultRefreshInterval: 60000,
    visualization: 'bar_chart',
    icon: 'app',
    dataShape: { type: 'list', fields: ['application', 'sent', 'recv'] },
  },
  meraki_rf_health: {
    type: 'meraki_rf_health',
    platform: 'meraki',
    title: 'RF Health',
    description: 'Wireless RF quality metrics',
    defaultSize: 'lg',  // Multi-gauge display needs horizontal space
    defaultRefreshInterval: 60000,
    visualization: 'multi_gauge',
    icon: 'wifi',
    dataShape: { type: 'object', fields: ['signalStrength', 'snr', 'channelUtilization'] },
  },
  meraki_device_uptime: {
    type: 'meraki_device_uptime',
    platform: 'meraki',
    title: 'Device Uptime',
    description: 'Device uptime statistics',
    defaultSize: 'md',
    defaultRefreshInterval: 60000,
    visualization: 'progress_list',
    icon: 'clock',
    dataShape: { type: 'list', fields: ['name', 'serial', 'uptime', 'lastReboot'] },
  },
  meraki_bandwidth_usage: {
    type: 'meraki_bandwidth_usage',
    platform: 'meraki',
    title: 'Bandwidth Usage',
    description: 'Network bandwidth over time',
    defaultSize: 'md',
    defaultRefreshInterval: 60000,
    visualization: 'area_chart',
    icon: 'chart',
    dataShape: { type: 'timeseries', fields: ['timestamp', 'sent', 'recv'] },
  },
  meraki_client_count: {
    type: 'meraki_client_count',
    platform: 'meraki',
    title: 'Client Count',
    description: 'Connected clients big number',
    defaultSize: 'xs',
    defaultRefreshInterval: 60000,
    visualization: 'big_number',
    icon: 'users',
    dataShape: { type: 'scalar', fields: ['count', 'trend'] },
  },
  meraki_latency_loss: {
    type: 'meraki_latency_loss',
    platform: 'meraki',
    title: 'Latency & Loss',
    description: 'Network latency and packet loss metrics',
    defaultSize: 'lg',  // Multi-gauge with 4 traffic types needs space
    defaultRefreshInterval: 30000,
    visualization: 'multi_gauge',
    icon: 'chart',
    dataShape: { type: 'object', fields: ['latencyMs', 'lossPercent', 'jitterMs'] },
  },
  meraki_wireless_stats: {
    type: 'meraki_wireless_stats',
    platform: 'meraki',
    title: 'Wireless Stats',
    description: 'Wireless connection statistics and performance',
    defaultSize: 'lg',
    defaultRefreshInterval: 60000,
    visualization: 'wireless_overview',  // Enhanced enterprise visualization
    icon: 'wifi',
    dataShape: { type: 'object', fields: ['successRate', 'authFailures', 'assocFailures', 'dhcpFailures', 'dnsFailures'] },
  },

  meraki_firewall_rules: {
    type: 'meraki_firewall_rules',
    platform: 'meraki',
    title: 'Firewall Rules',
    description: 'L3/L7 firewall rules and security policies',
    defaultSize: 'lg',
    defaultRefreshInterval: 0,
    visualization: 'table',
    icon: 'shield',
    dataShape: { type: 'list', fields: ['policy', 'protocol', 'srcCidr', 'destCidr', 'destPort', 'comment'] },
  },
  meraki_vlan_list: {
    type: 'meraki_vlan_list',
    platform: 'meraki',
    title: 'VLANs',
    description: 'VLAN configuration and subnets',
    defaultSize: 'lg',
    defaultRefreshInterval: 0,
    visualization: 'table',
    icon: 'layers',
    dataShape: { type: 'list', fields: ['id', 'name', 'subnet', 'applianceIp', 'dhcpHandling'] },
  },

  // ===========================================================================
  // ThousandEyes Cards
  // ===========================================================================
  te_agent_health: {
    type: 'te_agent_health',
    platform: 'thousandeyes',
    title: 'Agent Health',
    description: 'ThousandEyes agent status grid',
    defaultSize: 'lg',
    defaultRefreshInterval: 30000,
    visualization: 'device_status',  // Enhanced enterprise visualization
    icon: 'server',
    dataShape: { type: 'list', fields: ['agentId', 'name', 'status', 'location', 'lastSeen'] },
  },
  te_alert_summary: {
    type: 'te_alert_summary',
    platform: 'thousandeyes',
    title: 'TE Alerts',
    description: 'Active ThousandEyes alerts',
    defaultSize: 'md',  // Badge list with multiple severity levels
    defaultRefreshInterval: 15000,
    visualization: 'badge_list',
    icon: 'alert',
    dataShape: { type: 'object', fields: ['critical', 'major', 'minor', 'info', 'total'] },
  },
  te_path_visualization: {
    type: 'te_path_visualization',
    platform: 'thousandeyes',
    title: 'Path Visualization',
    description: 'Network path diagram with per-hop metrics, zone legend, and hop table',
    defaultSize: 'xl',
    defaultRefreshInterval: 60000,
    visualization: 'te_path_flow',
    icon: 'network',
    dataShape: { type: 'nested', fields: ['nodes', 'links', 'hops'] },
  },
  te_latency_chart: {
    type: 'te_latency_chart',
    platform: 'thousandeyes',
    title: 'Latency Trends',
    description: 'Loss, latency, and jitter over time',
    defaultSize: 'lg',
    defaultRefreshInterval: 60000,
    visualization: 'te_latency_waterfall',
    icon: 'chart',
    dataShape: { type: 'timeseries', fields: ['timestamp', 'latency', 'loss', 'jitter'] },
  },
  te_outage_map: {
    type: 'te_outage_map',
    platform: 'thousandeyes',
    title: 'Outage Map',
    description: 'Internet outage heatmap',
    defaultSize: 'lg',
    defaultRefreshInterval: 120000,
    visualization: 'heatmap',
    icon: 'globe',
    dataShape: { type: 'nested', fields: ['regions', 'outages', 'severity'] },
  },
  te_bgp_changes: {
    type: 'te_bgp_changes',
    platform: 'thousandeyes',
    title: 'BGP Changes',
    description: 'BGP route changes and updates',
    defaultSize: 'lg',
    defaultRefreshInterval: 60000,
    visualization: 'te_bgp_routing',
    icon: 'network',
    dataShape: { type: 'list', fields: ['timestamp', 'prefix', 'asPath', 'changeType'] },
  },
  te_dns_response: {
    type: 'te_dns_response',
    platform: 'thousandeyes',
    title: 'DNS Response',
    description: 'DNS query response times',
    defaultSize: 'sm',
    defaultRefreshInterval: 30000,
    visualization: 'gauge',
    icon: 'dns',
    dataShape: { type: 'object', fields: ['avgMs', 'minMs', 'maxMs', 'errorRate'] },
  },
  te_voip_quality: {
    type: 'te_voip_quality',
    platform: 'thousandeyes',
    title: 'VoIP Quality',
    description: 'VoIP MOS scores and metrics',
    defaultSize: 'sm',
    defaultRefreshInterval: 60000,
    visualization: 'gauge',
    icon: 'phone',
    dataShape: { type: 'object', fields: ['mos', 'latency', 'jitter', 'packetLoss'] },
  },
  te_web_transaction: {
    type: 'te_web_transaction',
    platform: 'thousandeyes',
    title: 'Web Transaction',
    description: 'Web transaction tests',
    defaultSize: 'md',
    defaultRefreshInterval: 60000,
    visualization: 'table',
    icon: 'globe',
    dataShape: { type: 'list', fields: ['name', 'status', 'url', 'interval'] },
  },
  te_endpoint_sessions: {
    type: 'te_endpoint_sessions',
    platform: 'thousandeyes',
    title: 'Endpoint Sessions',
    description: 'Endpoint agent session data',
    defaultSize: 'md',
    defaultRefreshInterval: 60000,
    visualization: 'table',
    icon: 'laptop',
    dataShape: { type: 'list', fields: ['agentId', 'user', 'location', 'network', 'status'] },
  },
  te_test_results: {
    type: 'te_test_results',
    platform: 'thousandeyes',
    title: 'Test Results',
    description: 'ThousandEyes test summary',
    defaultSize: 'md',
    defaultRefreshInterval: 30000,
    visualization: 'status_grid',
    icon: 'check',
    dataShape: { type: 'list', fields: ['testId', 'testName', 'type', 'status', 'lastRun'] },
  },
  te_network_diagnostic: {
    type: 'te_network_diagnostic',
    platform: 'thousandeyes',
    title: 'Network Diagnostic',
    description: 'Cross-platform diagnostic combining ThousandEyes path data, Splunk logs, and Meraki findings',
    defaultSize: 'xl',
    defaultRefreshInterval: 0,
    visualization: 'te_network_diagnostic',
    icon: 'network',
    dataShape: { type: 'object', fields: ['severity', 'device', 'metrics', 'findings', 'pathHops', 'logExcerpts', 'rootCause'] },
  },

  // ===========================================================================
  // Splunk Cards
  // ===========================================================================
  splunk_event_count: {
    type: 'splunk_event_count',
    platform: 'splunk',
    title: 'Event Count',
    description: 'Total event count',
    defaultSize: 'sm',
    defaultRefreshInterval: 30000,
    visualization: 'big_number',
    icon: 'chart',
    dataShape: { type: 'object', fields: ['value', 'label', 'trend'] },
  },
  splunk_top_errors: {
    type: 'splunk_top_errors',
    platform: 'splunk',
    title: 'Top Errors',
    description: 'Most frequent error messages',
    defaultSize: 'lg',  // Bar chart with multiple errors needs height
    defaultRefreshInterval: 60000,
    visualization: 'bar_chart',
    icon: 'alert',
    dataShape: { type: 'list', fields: ['message', 'count', 'source'] },
  },
  splunk_severity_donut: {
    type: 'splunk_severity_donut',
    platform: 'splunk',
    title: 'Event Severity',
    description: 'Events by severity level',
    defaultSize: 'md',  // Donut chart with legend
    defaultRefreshInterval: 30000,
    visualization: 'donut',
    icon: 'pie',
    dataShape: { type: 'list', fields: ['severity', 'count'] },
  },
  splunk_metric: {
    type: 'splunk_metric',
    platform: 'splunk',
    title: 'Key Metric',
    description: 'Single metric big number',
    defaultSize: 'xs',
    defaultRefreshInterval: 60000,
    visualization: 'big_number',
    icon: 'chart',
    dataShape: { type: 'scalar', fields: ['value', 'label', 'trend'] },
  },
  splunk_search_results: {
    type: 'splunk_search_results',
    platform: 'splunk',
    title: 'Search Results',
    description: 'Splunk search result table',
    defaultSize: 'lg',
    defaultRefreshInterval: 0, // Manual refresh
    visualization: 'table',
    icon: 'search',
    dataShape: { type: 'list', fields: ['_time', '_raw', 'source', 'sourcetype'] },
  },
  splunk_notable_events: {
    type: 'splunk_notable_events',
    platform: 'splunk',
    title: 'Notable Events',
    description: 'Security notable events',
    defaultSize: 'tall',
    defaultRefreshInterval: 15000,
    visualization: 'security_events',  // Enhanced enterprise visualization
    icon: 'shield',
    dataShape: { type: 'list', fields: ['time', 'rule', 'severity', 'status', 'owner'] },
  },
  splunk_activity_heatmap: {
    type: 'splunk_activity_heatmap',
    platform: 'splunk',
    title: 'Activity Heatmap',
    description: 'Activity by hour/day heatmap',
    defaultSize: 'md',
    defaultRefreshInterval: 300000,
    visualization: 'heatmap',
    icon: 'calendar',
    dataShape: { type: 'nested', fields: ['day', 'hour', 'count'] },
  },
  splunk_sourcetype_volume: {
    type: 'splunk_sourcetype_volume',
    platform: 'splunk',
    title: 'Sourcetype Volume',
    description: 'Data volume by sourcetype',
    defaultSize: 'sm',
    defaultRefreshInterval: 60000,
    visualization: 'donut',
    icon: 'database',
    dataShape: { type: 'list', fields: ['sourcetype', 'bytes', 'eventCount'] },
  },
  splunk_log_trends: {
    type: 'splunk_log_trends',
    platform: 'splunk',
    title: 'Log Trends',
    description: 'Log volume over time with anomaly detection',
    defaultSize: 'md',
    defaultRefreshInterval: 60000,
    visualization: 'area_chart',
    icon: 'chart',
    dataShape: { type: 'timeseries', fields: ['timestamp', 'count', 'isAnomaly'] },
  },
  splunk_insights_summary: {
    type: 'splunk_insights_summary',
    platform: 'splunk',
    title: 'AI Insights',
    description: 'AI-generated log analysis summary',
    defaultSize: 'lg',
    defaultRefreshInterval: 120000,
    visualization: 'status_grid',
    icon: 'ai',
    dataShape: { type: 'list', fields: ['title', 'severity', 'count', 'description'] },
  },

  // ===========================================================================
  // Catalyst Center Cards
  // ===========================================================================
  catalyst_site_health: {
    type: 'catalyst_site_health',
    platform: 'catalyst',
    title: 'Site Health',
    description: 'Site health score gauge',
    defaultSize: 'sm',
    defaultRefreshInterval: 60000,
    visualization: 'gauge',
    icon: 'building',
    dataShape: { type: 'object', fields: ['score', 'issueCount', 'deviceCount'] },
  },
  catalyst_device_inventory: {
    type: 'catalyst_device_inventory',
    platform: 'catalyst',
    title: 'Device Inventory',
    description: 'Catalyst managed device list',
    defaultSize: 'lg',
    defaultRefreshInterval: 60000,
    visualization: 'table',
    icon: 'server',
    dataShape: { type: 'list', fields: ['hostname', 'family', 'platform', 'managementIp', 'reachabilityStatus'] },
  },
  catalyst_issue_summary: {
    type: 'catalyst_issue_summary',
    platform: 'catalyst',
    title: 'Assurance Issues',
    description: 'Active assurance issues by priority',
    defaultSize: 'md',
    defaultRefreshInterval: 30000,
    visualization: 'badge_list',
    icon: 'alert',
    dataShape: { type: 'object', fields: ['p1', 'p2', 'p3', 'p4', 'total'] },
  },
  catalyst_client_health: {
    type: 'catalyst_client_health',
    platform: 'catalyst',
    title: 'Client Health',
    description: 'Client health score over time',
    defaultSize: 'md',
    defaultRefreshInterval: 60000,
    visualization: 'line_chart',
    icon: 'users',
    dataShape: { type: 'timeseries', fields: ['timestamp', 'wired', 'wireless', 'overall'] },
  },
  catalyst_app_health: {
    type: 'catalyst_app_health',
    platform: 'catalyst',
    title: 'Application Health',
    description: 'Application experience scores',
    defaultSize: 'md',
    defaultRefreshInterval: 60000,
    visualization: 'progress_list',
    icon: 'app',
    dataShape: { type: 'list', fields: ['appName', 'healthScore', 'usage', 'businessRelevance'] },
  },
  catalyst_fabric_status: {
    type: 'catalyst_fabric_status',
    platform: 'catalyst',
    title: 'Fabric Status',
    description: 'SDA fabric site status',
    defaultSize: 'md',
    defaultRefreshInterval: 60000,
    visualization: 'status_grid',
    icon: 'network',
    dataShape: { type: 'list', fields: ['siteName', 'fabricType', 'status', 'deviceCount'] },
  },
  catalyst_rogue_aps: {
    type: 'catalyst_rogue_aps',
    platform: 'catalyst',
    title: 'Rogue APs',
    description: 'Detected rogue access points',
    defaultSize: 'md',
    defaultRefreshInterval: 30000,
    visualization: 'alert_list',
    icon: 'wifi',
    dataShape: { type: 'list', fields: ['macAddress', 'ssid', 'classification', 'firstSeen', 'containmentStatus'] },
  },
  catalyst_client_onboarding: {
    type: 'catalyst_client_onboarding',
    platform: 'catalyst',
    title: 'Client Onboarding',
    description: 'Client onboarding success rate',
    defaultSize: 'sm',
    defaultRefreshInterval: 60000,
    visualization: 'gauge',
    icon: 'users',
    dataShape: { type: 'object', fields: ['successRate', 'attempts', 'failures', 'avgTimeMs'] },
  },
  catalyst_compliance: {
    type: 'catalyst_compliance',
    platform: 'catalyst',
    title: 'Compliance Status',
    description: 'Device compliance summary',
    defaultSize: 'sm',
    defaultRefreshInterval: 120000,
    visualization: 'donut',
    icon: 'check',
    dataShape: { type: 'object', fields: ['compliant', 'nonCompliant', 'notApplicable'] },
  },
  catalyst_poe_usage: {
    type: 'catalyst_poe_usage',
    platform: 'catalyst',
    title: 'PoE Usage',
    description: 'Power over Ethernet consumption',
    defaultSize: 'sm',
    defaultRefreshInterval: 60000,
    visualization: 'gauge',
    icon: 'power',
    dataShape: { type: 'object', fields: ['usedWatts', 'availableWatts', 'utilization'] },
  },

  catalyst_interfaces: {
    type: 'catalyst_interfaces',
    platform: 'catalyst',
    title: 'Interfaces',
    description: 'Network interface details and status',
    defaultSize: 'lg',
    defaultRefreshInterval: 0,
    visualization: 'table',
    icon: 'port',
    dataShape: { type: 'list', fields: ['portName', 'status', 'speed', 'duplex', 'vlanId'] },
  },

  // ===========================================================================
  // General Network Cards
  // ===========================================================================
  network_routing_table: {
    type: 'network_routing_table',
    platform: 'general',
    title: 'Routing Table',
    description: 'IP routing table entries',
    defaultSize: 'md',  // Table with routes
    defaultRefreshInterval: 120000,
    visualization: 'table',
    icon: 'network',
    dataShape: { type: 'list', fields: ['prefix', 'nextHop', 'metric', 'protocol', 'interface'] },
  },
  network_bgp_neighbors: {
    type: 'network_bgp_neighbors',
    platform: 'general',
    title: 'BGP Neighbors',
    description: 'BGP peering status',
    defaultSize: 'sm',  // Info message only
    defaultRefreshInterval: 30000,
    visualization: 'status_grid',
    icon: 'network',
    dataShape: { type: 'list', fields: ['neighbor', 'asn', 'state', 'uptime', 'prefixesReceived'] },
  },
  network_ospf_status: {
    type: 'network_ospf_status',
    platform: 'general',
    title: 'OSPF Status',
    description: 'OSPF area and neighbor status',
    defaultSize: 'sm',  // Info message only
    defaultRefreshInterval: 60000,
    visualization: 'status_grid',
    icon: 'network',
    dataShape: { type: 'list', fields: ['area', 'neighbor', 'state', 'priority', 'deadTime'] },
  },
  network_vlan_map: {
    type: 'network_vlan_map',
    platform: 'general',
    title: 'VLAN Map',
    description: 'VLAN to port mapping',
    defaultSize: 'md',  // Table with VLANs
    defaultRefreshInterval: 120000,
    visualization: 'table',
    icon: 'layers',
    dataShape: { type: 'list', fields: ['vlanId', 'name', 'ports', 'status'] },
  },
  network_arp_table: {
    type: 'network_arp_table',
    platform: 'general',
    title: 'ARP Table',
    description: 'ARP cache entries',
    defaultSize: 'lg',  // Table with many rows
    defaultRefreshInterval: 60000,
    visualization: 'table',
    icon: 'list',
    dataShape: { type: 'list', fields: ['ip', 'mac', 'interface', 'age'] },
  },
  network_mac_table: {
    type: 'network_mac_table',
    platform: 'general',
    title: 'MAC Table',
    description: 'MAC address table',
    defaultSize: 'lg',  // Table with many rows
    defaultRefreshInterval: 60000,
    visualization: 'table',
    icon: 'list',
    dataShape: { type: 'list', fields: ['mac', 'vlan', 'port', 'type'] },
  },
  network_traceroute: {
    type: 'network_traceroute',
    platform: 'general',
    title: 'Traceroute',
    description: 'Network path visualization',
    defaultSize: 'sm',  // Info message only
    defaultRefreshInterval: 0, // Manual
    visualization: 'topology',
    icon: 'route',
    dataShape: { type: 'list', fields: ['hop', 'address', 'hostname', 'rtt1', 'rtt2', 'rtt3'] },
  },
  network_packet_capture: {
    type: 'network_packet_capture',
    platform: 'general',
    title: 'Packet Capture',
    description: 'Captured packet summary',
    defaultSize: 'sm',  // Info message only
    defaultRefreshInterval: 0, // Manual
    visualization: 'table',
    icon: 'capture',
    dataShape: { type: 'list', fields: ['timestamp', 'srcIp', 'destIp', 'protocol', 'length', 'info'] },
  },
  network_acl_hits: {
    type: 'network_acl_hits',
    platform: 'general',
    title: 'ACL Hits',
    description: 'Access list hit counters',
    defaultSize: 'sm',  // Info message only
    defaultRefreshInterval: 30000,
    visualization: 'bar_chart',
    icon: 'shield',
    dataShape: { type: 'list', fields: ['aclName', 'rule', 'hits', 'action'] },
  },
  network_qos_policy: {
    type: 'network_qos_policy',
    platform: 'general',
    title: 'QoS Policy',
    description: 'QoS class statistics',
    defaultSize: 'sm',  // Info message only
    defaultRefreshInterval: 60000,
    visualization: 'bar_chart',
    icon: 'sliders',
    dataShape: { type: 'list', fields: ['class', 'matched', 'transmitted', 'dropped'] },
  },
  network_stp_topology: {
    type: 'network_stp_topology',
    platform: 'general',
    title: 'STP Topology',
    description: 'Spanning tree topology',
    defaultSize: 'sm',  // Info message only
    defaultRefreshInterval: 120000,
    visualization: 'topology',
    icon: 'tree',
    dataShape: { type: 'nested', fields: ['root', 'bridges', 'ports', 'state'] },
  },
  network_troubleshoot_flow: {
    type: 'network_troubleshoot_flow',
    platform: 'general',
    title: 'Troubleshooting',
    description: 'Guided troubleshooting flowchart',
    defaultSize: 'sm',  // Info message only
    defaultRefreshInterval: 0, // Static
    visualization: 'custom',
    icon: 'help',
    dataShape: { type: 'nested', fields: ['steps', 'checks', 'recommendations'] },
  },

  // ===========================================================================
  // Network Performance Change Cards
  // ===========================================================================
  network_performance_overview: {
    type: 'network_performance_overview',
    platform: 'general',
    title: 'Network Performance',
    description: 'Current performance metrics snapshot with real-time gauges',
    defaultSize: 'lg',
    defaultRefreshInterval: 30000,
    visualization: 'performance_overview',
    icon: 'chart',
    dataShape: {
      type: 'object',
      fields: ['latency_ms', 'packet_loss_percent', 'jitter_ms', 'throughput_mbps', 'client_count', 'channel_utilization'],
    },
  },
  network_change_comparison: {
    type: 'network_change_comparison',
    platform: 'general',
    title: 'Change Impact Analysis',
    description: 'Before/after performance comparison with revert capability',
    defaultSize: 'lg',
    defaultRefreshInterval: 60000,
    visualization: 'change_comparison',
    icon: 'compare',
    dataShape: {
      type: 'object',
      fields: ['change', 'metrics_before', 'metrics_after', 'deltas', 'assessment', 'can_revert'],
    },
  },
  network_change_history: {
    type: 'network_change_history',
    platform: 'general',
    title: 'Change History',
    description: 'Timeline of configuration changes with impact scores',
    defaultSize: 'tall',
    defaultRefreshInterval: 60000,
    visualization: 'change_history',
    icon: 'history',
    dataShape: {
      type: 'list',
      fields: ['id', 'change_type', 'setting_path', 'applied_at', 'status', 'description'],
    },
  },

  // ===========================================================================
  // AI Contextual Cards - Data provided by AI, not fetched from APIs
  // ===========================================================================
  ai_metric: {
    type: 'ai_metric',
    platform: 'system',
    title: 'Key Metric',
    description: 'Single key metric highlighted by AI',
    defaultSize: 'xs',
    defaultRefreshInterval: 0,
    visualization: 'big_number',
    dataShape: { type: 'scalar', fields: ['label', 'value', 'unit', 'trend', 'context'] },
  },
  ai_stats_grid: {
    type: 'ai_stats_grid',
    platform: 'system',
    title: 'Stats Overview',
    description: 'Grid of related statistics from AI analysis',
    defaultSize: 'lg',
    defaultRefreshInterval: 0,
    visualization: 'stat_row',
    dataShape: { type: 'list', fields: ['label', 'value', 'icon', 'status'] },
  },
  ai_gauge: {
    type: 'ai_gauge',
    platform: 'system',
    title: 'Gauge',
    description: 'Circular gauge for percentages/utilization from AI',
    defaultSize: 'sm',
    defaultRefreshInterval: 0,
    visualization: 'gauge',
    dataShape: { type: 'object', fields: ['label', 'value', 'max', 'unit'] },
  },
  ai_breakdown: {
    type: 'ai_breakdown',
    platform: 'system',
    title: 'Breakdown',
    description: 'Distribution breakdown from AI analysis',
    defaultSize: 'md',
    defaultRefreshInterval: 0,
    visualization: 'donut',
    dataShape: { type: 'list', fields: ['label', 'value', 'color'] },
  },
  ai_finding: {
    type: 'ai_finding',
    platform: 'system',
    title: 'Finding',
    description: 'Important finding or recommendation from AI',
    defaultSize: 'md',
    defaultRefreshInterval: 0,
    visualization: 'alert_list',
    dataShape: { type: 'object', fields: ['severity', 'title', 'description', 'recommendation'] },
  },
  ai_device_summary: {
    type: 'ai_device_summary',
    platform: 'system',
    title: 'Device Summary',
    description: 'Device summary with status and attributes from AI',
    defaultSize: 'md',
    defaultRefreshInterval: 0,
    visualization: 'device_status',
    dataShape: { type: 'object', fields: ['name', 'type', 'status', 'attributes', 'metrics'] },
  },

  // ===========================================================================
  // Knowledge Base Cards
  // ===========================================================================
  knowledge_sources: {
    type: 'knowledge_sources',
    platform: 'system',
    title: 'Sources',
    description: 'Source documents and citations used for AI response',
    defaultSize: 'md',
    defaultRefreshInterval: 0,
    visualization: 'table',
    dataShape: { type: 'list', fields: ['title', 'excerpt', 'relevance', 'doc_type'] },
  },
  product_detail: {
    type: 'product_detail',
    platform: 'system',
    title: 'Product Details',
    description: 'Product datasheet or specification card',
    defaultSize: 'md',
    defaultRefreshInterval: 0,
    visualization: 'stat_row',
    dataShape: { type: 'object', fields: ['name', 'category', 'specs'] },
  },
  datasheet_comparison: {
    type: 'datasheet_comparison',
    platform: 'system',
    title: 'Product Comparison',
    description: 'Side-by-side comparison of multiple products',
    defaultSize: 'lg',
    defaultRefreshInterval: 0,
    visualization: 'table',
    dataShape: { type: 'list', fields: ['name', 'specs', 'highlights'] },
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get card definition by type
 */
export function getCardDefinition(type: AllCardTypes): CardDefinition {
  return CARD_REGISTRY[type];
}

/**
 * Get all cards for a platform
 */
export function getCardsByPlatform(platform: CardPlatform): CardDefinition[] {
  return Object.values(CARD_REGISTRY).filter(card => card.platform === platform);
}

/**
 * Get all cards with a specific visualization type
 */
export function getCardsByVisualization(visualization: VisualizationType): CardDefinition[] {
  return Object.values(CARD_REGISTRY).filter(card => card.visualization === visualization);
}

/**
 * Get default refresh interval for a card type
 */
export function getDefaultRefreshInterval(type: AllCardTypes): number {
  const definition = CARD_REGISTRY[type];
  return definition?.defaultRefreshInterval ?? DEFAULT_REFRESH_INTERVAL;
}

/**
 * Get default size for a card type
 */
export function getDefaultSize(type: AllCardTypes): CardSize {
  const definition = CARD_REGISTRY[type];
  return definition?.defaultSize ?? 'md';
}

/**
 * Check if a card type supports auto-refresh
 */
export function supportsAutoRefresh(type: AllCardTypes): boolean {
  const definition = CARD_REGISTRY[type];
  return definition?.defaultRefreshInterval > 0;
}

/**
 * Get all card types
 */
export function getAllCardTypes(): AllCardTypes[] {
  return Object.keys(CARD_REGISTRY) as AllCardTypes[];
}

/**
 * Get card types grouped by platform
 */
export function getCardTypesGroupedByPlatform(): Record<CardPlatform, AllCardTypes[]> {
  const grouped: Record<CardPlatform, AllCardTypes[]> = {
    meraki: [],
    thousandeyes: [],
    splunk: [],
    catalyst: [],
    general: [],
    system: [],
  };

  for (const [type, definition] of Object.entries(CARD_REGISTRY)) {
    grouped[definition.platform].push(type as AllCardTypes);
  }

  return grouped;
}

// =============================================================================
// Card Generation for Live Data
// =============================================================================

/**
 * Scope options for generating cards with real data
 */
export interface CardScope {
  credentialOrg?: string;
  organizationId?: string;
  organizationName?: string;
  networkId?: string;
  networkName?: string;
  deviceSerial?: string;
  siteId?: string;
  testId?: string;
}

/**
 * Generate SmartCards for all registered card types of a specific platform
 * Cards are created without initial data so they fetch from real APIs
 */
export function generateCardsForPlatform(
  platform: CardPlatform,
  scope: CardScope
): SmartCard[] {
  const cards: SmartCard[] = [];
  const platformCards = getCardsByPlatform(platform);
  const now = new Date().toISOString();

  platformCards.forEach((definition, index) => {
    const card: SmartCard = {
      id: `live-${definition.type}-${Date.now()}-${index}`,
      type: definition.type,
      title: definition.title,
      subtitle: `${definition.platform} • Live Data`,
      size: definition.defaultSize,
      initialData: {
        payload: undefined, // No initial data - will fetch from API
        toolCallId: `live-${definition.type}-${index}`,
        generatedAt: now,
      },
      data: {
        current: undefined,
        lastUpdated: now,
        isStale: true,
        status: 'loading' as FreshnessStatus,
      },
      visualization: {
        type: definition.visualization,
      },
      refresh: {
        enabled: true,
        interval: definition.defaultRefreshInterval,
      },
      scope: {
        credentialOrg: scope.credentialOrg,
        organizationId: scope.organizationId,
        organizationName: scope.organizationName,
        networkId: scope.networkId,
        networkName: scope.networkName,
        deviceSerial: scope.deviceSerial,
        siteId: scope.siteId,
        testId: scope.testId,
      },
      aiContext: {
        originalQuery: 'Card test page - live data',
        sourceMessageId: 'card-test',
      },
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };

    cards.push(card);
  });

  return cards;
}

/**
 * Generate a single SmartCard for a specific card type with real data
 */
export function generateCard(
  type: AllCardTypes,
  scope: CardScope
): SmartCard {
  const definition = CARD_REGISTRY[type];
  const now = new Date().toISOString();

  return {
    id: `live-${type}-${Date.now()}`,
    type: definition.type,
    title: definition.title,
    subtitle: `${definition.platform} • Live Data`,
    size: definition.defaultSize,
    initialData: {
      payload: undefined,
      toolCallId: `live-${type}`,
      generatedAt: now,
    },
    data: {
      current: undefined,
      lastUpdated: now,
      isStale: true,
      status: 'loading' as FreshnessStatus,
    },
    visualization: {
      type: definition.visualization,
    },
    refresh: {
      enabled: true,
      interval: definition.defaultRefreshInterval,
    },
    scope: {
      credentialOrg: scope.credentialOrg,
      organizationId: scope.organizationId,
      organizationName: scope.organizationName,
      networkId: scope.networkId,
      networkName: scope.networkName,
      deviceSerial: scope.deviceSerial,
      siteId: scope.siteId,
      testId: scope.testId,
    },
    aiContext: {
      originalQuery: 'Card test page - live data',
      sourceMessageId: 'card-test',
    },
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}
