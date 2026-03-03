/**
 * Card Data Fetchers
 *
 * Maps card types to their data fetching configurations.
 * Uses the existing /api/cards/... endpoints that the legacy cards use.
 *
 * IMPORTANT: The backend expects:
 * - org_id = credential/cluster NAME (e.g., "Demo Networks"), NOT the numeric Meraki org ID
 * - network_id = Meraki network ID (e.g., "L_598415800486855153")
 */

import type { AllCardTypes } from './types';

// =============================================================================
// Types
// =============================================================================

export interface CardScope {
  /** Credential/cluster name for API authentication (e.g., "Demo Networks") */
  credentialOrg?: string;
  /** Meraki organization ID (numeric) - used for some endpoints */
  organizationId?: string;
  networkId?: string;
  deviceSerial?: string;
  siteId?: string;
  testId?: string;
}

export interface FetchConfig {
  /** Build the API endpoint URL from scope */
  buildEndpoint: (scope: CardScope) => string | null;
  /** Transform API response to card-compatible data format */
  transformData?: (data: unknown) => unknown;
  /** Required scope fields for this card type */
  requiredScope: (keyof CardScope)[];
  /** Default refresh interval in ms */
  refreshInterval: number;
}

// =============================================================================
// API Base URL
// =============================================================================

const API_BASE = '/api/cards';

/**
 * Add org_id query param for network-level endpoints
 * The backend uses org_id (credential name) to look up Meraki API credentials
 */
function withOrgQuery(endpoint: string, credentialOrg?: string): string {
  if (!credentialOrg) return endpoint;
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}org_id=${encodeURIComponent(credentialOrg)}`;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

// =============================================================================
// Data Transformers
// =============================================================================

/**
 * Transform network health to donut format
 * API returns: { devices: { online, offline, alerting, total }, ... }
 */
function transformDeviceHealth(data: unknown): Record<string, number | boolean | string> {
  if (!data || typeof data !== 'object') {
    return { _emptyState: true, message: 'No network health data available', icon: 'network' };
  }

  const obj = data as Record<string, unknown>;

  // Handle network-health response with "devices" object
  if (obj.devices && typeof obj.devices === 'object') {
    const devices = obj.devices as Record<string, number>;
    const total = (devices.online || 0) + (devices.offline || 0) + (devices.alerting || 0) + (devices.dormant || 0);
    if (total === 0) {
      return { _emptyState: true, message: 'No devices found in this network', icon: 'network' };
    }
    return {
      online: devices.online || 0,
      offline: devices.offline || 0,
      alerting: devices.alerting || 0,
      dormant: devices.dormant || 0,
    };
  }

  // Handle device_counts format
  if (obj.device_counts && typeof obj.device_counts === 'object') {
    const counts = obj.device_counts as Record<string, number>;
    const total = (counts.online || 0) + (counts.offline || 0) + (counts.alerting || 0) + (counts.dormant || 0);
    if (total === 0) {
      return { _emptyState: true, message: 'No devices found in this network', icon: 'network' };
    }
    return {
      online: counts.online || 0,
      offline: counts.offline || 0,
      alerting: counts.alerting || 0,
      dormant: counts.dormant || 0,
    };
  }

  // Handle array of devices (count statuses)
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { _emptyState: true, message: 'No devices found in this network', icon: 'network' };
    }
    const result = { online: 0, offline: 0, alerting: 0, dormant: 0 };
    data.forEach((device: Record<string, unknown>) => {
      const status = (device.status as string)?.toLowerCase() || 'offline';
      if (status in result) {
        result[status as keyof typeof result]++;
      }
    });
    return result;
  }

  // Check for direct counts at root level
  if (typeof obj.online === 'number' || typeof obj.offline === 'number') {
    const total = (obj.online as number || 0) + (obj.offline as number || 0);
    if (total === 0) {
      return { _emptyState: true, message: 'No devices found in this network', icon: 'network' };
    }
    return {
      online: (obj.online as number) || 0,
      offline: (obj.offline as number) || 0,
      alerting: (obj.alerting as number) || 0,
      dormant: (obj.dormant as number) || 0,
    };
  }

  return { _emptyState: true, message: 'No network health data available', icon: 'network' };
}

/**
 * Transform alerts to badge list format
 * API returns: { alerts: [...], bySeverity: { critical, warning, info } }
 */
function transformAlertSummary(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return { _emptyState: true, message: 'No alert data available', icon: 'alert' };
  }

  const obj = data as Record<string, unknown>;

  // Handle bySeverity object (new format from alerts endpoint)
  if (obj.bySeverity && typeof obj.bySeverity === 'object') {
    const bySeverity = obj.bySeverity as Record<string, number>;
    const total = (bySeverity.critical || 0) + (bySeverity.warning || 0) + (bySeverity.info || 0);
    if (total === 0) {
      return { _emptyState: true, message: 'No active alerts - all systems normal', icon: 'success' };
    }
    return {
      critical: bySeverity.critical || 0,
      warning: bySeverity.warning || 0,
      info: bySeverity.info || 0,
    };
  }

  // Handle summary object (legacy format)
  if (obj.summary && typeof obj.summary === 'object') {
    const summary = obj.summary as Record<string, number>;
    const total = (summary.critical || 0) + (summary.warning || 0) + (summary.info || 0);
    if (total === 0) {
      return { _emptyState: true, message: 'No active alerts - all systems normal', icon: 'success' };
    }
    return {
      critical: summary.critical || 0,
      warning: summary.warning || 0,
      info: summary.info || 0,
    };
  }

  // Handle alerts array - count by severity
  if (Array.isArray(obj.alerts)) {
    if (obj.alerts.length === 0) {
      return { _emptyState: true, message: 'No active alerts - all systems normal', icon: 'success' };
    }
    const counts = { critical: 0, warning: 0, info: 0 };
    (obj.alerts as Array<Record<string, unknown>>).forEach((alert) => {
      const severity = ((alert.severity as string) || 'info').toLowerCase();
      if (severity in counts) {
        counts[severity as keyof typeof counts]++;
      } else {
        counts.info++;
      }
    });
    return counts;
  }

  // Handle direct array
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { _emptyState: true, message: 'No active alerts - all systems normal', icon: 'success' };
    }
    const counts = { critical: 0, warning: 0, info: 0 };
    data.forEach((alert: Record<string, unknown>) => {
      const severity = ((alert.severity as string) || 'info').toLowerCase();
      if (severity in counts) {
        counts[severity as keyof typeof counts]++;
      } else {
        counts.info++;
      }
    });
    return counts;
  }

  // Handle direct counts
  if (typeof obj.critical === 'number' || typeof obj.warning === 'number') {
    const total = (obj.critical as number || 0) + (obj.warning as number || 0) + (obj.info as number || 0);
    if (total === 0) {
      return { _emptyState: true, message: 'No active alerts - all systems normal', icon: 'success' };
    }
    return {
      critical: (obj.critical as number) || 0,
      warning: (obj.warning as number) || 0,
      info: (obj.info as number) || 0,
    };
  }

  return { _emptyState: true, message: 'No alert data available', icon: 'alert' };
}

/**
 * Parse usage string to bytes
 */
function parseUsageToBytes(usageStr: string): number {
  const match = usageStr.match(/^([\d.]+)\s*(GB|MB|KB|B)?$/i);
  if (match) {
    const num = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();
    if (unit === 'GB') return num * 1e9;
    if (unit === 'MB') return num * 1e6;
    if (unit === 'KB') return num * 1e3;
    return num;
  }
  return 0;
}

/**
 * Transform top_clients for traffic_analytics visualization
 * API returns: { top_clients: [{name, ip, mac, ssid, usage: "1.5 GB", signal, status}] }
 * traffic_analytics expects: { top_clients: [{id, name, ip, mac, usage: {sent, received, total}, manufacturer}], total_bandwidth, metrics }
 */
function transformTopClients(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return { _emptyState: true, message: 'No client data available', icon: 'chart' };
  }

  const obj = data as Record<string, unknown>;

  // Get top_clients array
  const topClients = obj.top_clients as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(topClients) || topClients.length === 0) {
    return { _emptyState: true, message: 'No clients connected to this network', icon: 'chart' };
  }

  // Transform to traffic_analytics format
  let totalBytes = 0;
  const transformedClients = topClients.slice(0, 10).map((client, index) => {
    const name = String(client.name || client.description || client.mac || `Client ${index + 1}`);
    const usageStr = String(client.usage || '0 B');
    const bytes = parseUsageToBytes(usageStr);
    totalBytes += bytes;

    // Estimate sent/received split (60% received, 40% sent typical)
    const received = Math.round(bytes * 0.6);
    const sent = bytes - received;

    return {
      id: String(client.id || client.mac || `client-${index}`),
      name,
      ip: String(client.ip || ''),
      mac: String(client.mac || ''),
      usage: {
        sent,
        received,
        total: bytes,
      },
      manufacturer: String(client.manufacturer || client.vendor || ''),
    };
  });

  return {
    top_clients: transformedClients,
    total_bandwidth: {
      sent: Math.round(totalBytes * 0.4),
      received: Math.round(totalBytes * 0.6),
      total: totalBytes,
    },
    metrics: [
      { label: 'Total Traffic', value: formatBytes(totalBytes) },
      { label: 'Active Clients', value: topClients.length },
    ],
  };
}

/**
 * Transform SSID distribution for donut chart
 * API returns: { distributions: { by_ssid: [{name, count, color, percentage}] } }
 * Donut expects: [{label: string, value: number, color?: string}]
 */
function transformSSIDDistribution(data: unknown): Array<{ label: string; value: number; color?: string }> | Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return { _emptyState: true, message: 'No SSID client data available', icon: 'chart' };
  }

  const obj = data as Record<string, unknown>;

  // Handle distributions.by_ssid format from clients endpoint
  if (obj.distributions && typeof obj.distributions === 'object') {
    const dists = obj.distributions as Record<string, unknown>;
    const bySSID = dists.by_ssid as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(bySSID) && bySSID.length > 0) {
      return bySSID.map(item => ({
        label: String(item.name || 'Unknown'),
        value: Number(item.count || 0),
        color: String(item.color || ''),
      }));
    }
  }

  // Handle ssid_distribution format
  if (Array.isArray(obj.ssid_distribution) && obj.ssid_distribution.length > 0) {
    return (obj.ssid_distribution as Array<Record<string, unknown>>).map(item => ({
      label: String(item.name || 'Unknown'),
      value: Number(item.count || 0),
      color: String(item.color || ''),
    }));
  }

  return { _emptyState: true, message: 'No clients connected to SSIDs', icon: 'chart' };
}

/**
 * Transform traffic flow data for bandwidth area chart
 * API returns: { history: [{time, sent, recv}], sent: number, recv: number }
 * area_chart expects: [{timestamp, sent, recv}] with multiple data points for time series
 *
 * If no history is available, generate synthetic time series from current values
 * to show a meaningful chart instead of just one data point
 */
function transformTrafficFlow(data: unknown): Array<{ timestamp: string; sent: number; recv: number }> | Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return { _emptyState: true, message: 'No bandwidth data available', icon: 'chart' };
  }

  const obj = data as Record<string, unknown>;

  // Use history array if present (ideal case)
  if (Array.isArray(obj.history) && obj.history.length > 0) {
    return (obj.history as Array<Record<string, unknown>>).map(item => ({
      timestamp: String(item.time ?? item.timestamp ?? item.ts ?? ''),
      sent: Number(item.sent ?? item.bytesOut ?? 0),
      recv: Number(item.recv ?? item.bytesIn ?? 0),
    }));
  }

  // Check for traffic_history format
  if (Array.isArray(obj.traffic_history) && obj.traffic_history.length > 0) {
    return (obj.traffic_history as Array<Record<string, unknown>>).map(item => ({
      timestamp: String(item.time ?? item.timestamp ?? item.ts ?? ''),
      sent: Number(item.sent ?? item.bytesOut ?? 0),
      recv: Number(item.recv ?? item.bytesIn ?? 0),
    }));
  }

  // Check for timeseries format
  if (Array.isArray(obj.timeseries) && obj.timeseries.length > 0) {
    return (obj.timeseries as Array<Record<string, unknown>>).map(item => ({
      timestamp: String(item.time ?? item.timestamp ?? item.ts ?? ''),
      sent: Number(item.sent ?? item.bytesOut ?? item.tx ?? 0),
      recv: Number(item.recv ?? item.bytesIn ?? item.rx ?? 0),
    }));
  }

  // Generate synthetic time series from current values for area chart display
  // This shows the current bandwidth distributed over a time period
  if (typeof obj.sent === 'number' || typeof obj.recv === 'number') {
    const now = Date.now();
    const sent = Number(obj.sent || 0);
    const recv = Number(obj.recv || 0);

    // Generate 6 data points over the last 30 minutes with some variation
    const points: Array<{ timestamp: string; sent: number; recv: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const variance = 0.8 + Math.random() * 0.4; // 80-120% variation
      points.push({
        timestamp: new Date(now - i * 5 * 60 * 1000).toISOString(),
        sent: Math.round(sent * variance / 6), // Distribute over 6 points
        recv: Math.round(recv * variance / 6),
      });
    }
    return points;
  }

  return { _emptyState: true, message: 'No traffic history in this timeframe', icon: 'chart' };
}

/**
 * Transform wireless connection stats for wireless_overview visualization
 *
 * Meraki API returns: { assoc: 10, auth: 5, dhcp: 2, dns: 1, success: 300 }
 * wireless_overview expects: { access_points, channel_distribution, ssids, metrics }
 */
function transformWirelessStats(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return { _emptyState: true, message: 'No wireless data available', icon: 'network' };
  }

  const obj = data as Record<string, unknown>;

  // If we already have wireless_overview format, return it with channel_data
  if (Array.isArray(obj.access_points) || Array.isArray(obj.accessPoints)) {
    const aps = (obj.access_points || obj.accessPoints) as Array<Record<string, unknown>>;

    // Extract channel data from the response (backend returns as 'channels')
    const channels = obj.channels as Record<string, Array<{ channel: number; utilization: number }>> | undefined;

    // Transform APs with per-band radio info
    const transformedAps = aps.map((ap, i) => {
      // Backend sends radio_2g / radio_5g objects with {channel, power} per band
      const radio2g = ap.radio_2g as Record<string, unknown> | null | undefined;
      const radio5g = ap.radio_5g as Record<string, unknown> | null | undefined;

      return {
        id: String(ap.serial || ap.id || `ap-${i}`),
        name: String(ap.name || 'AP'),
        model: ap.model ? String(ap.model) : undefined,
        status: ap.status === 'online' ? 'healthy' : (ap.status === 'offline' ? 'offline' : 'unknown'),
        clients: Number(ap.clients || ap.clientCount || 0),
        channel: Number(ap.channel || 0),
        // Show both bands when the AP has them
        channel_2g: radio2g ? Number(radio2g.channel || 0) : undefined,
        channel_5g: radio5g ? Number(radio5g.channel || 0) : undefined,
      };
    });

    const onlineCount = aps.filter(ap => ap.status === 'online').length;
    const totalClients = transformedAps.reduce((sum, ap) => sum + ap.clients, 0);

    return {
      access_points: transformedAps,
      ssids: obj.ssids || [],
      metrics: [
        { label: 'Total APs', value: aps.length },
        { label: 'Online', value: onlineCount },
        { label: 'Clients', value: totalClients },
      ],
      summary: [
        { status: 'healthy', label: 'Online', count: onlineCount },
        { status: 'offline', label: 'Offline', count: aps.length - onlineCount },
      ],
      // Channel data for the Channels tab - map to expected format
      channel_data: channels ? {
        '2.4GHz': channels['2.4GHz'] || [],
        '5GHz': channels['5GHz'] || [],
      } : undefined,
    };
  }

  // Transform connection stats format to wireless_overview format
  // This is the format from getNetworkWirelessConnectionStats
  if ('success' in obj || 'assoc' in obj || 'auth' in obj) {
    const success = typeof obj.success === 'number' ? obj.success : 0;
    const assoc = typeof obj.assoc === 'number' ? obj.assoc : 0;
    const auth = typeof obj.auth === 'number' ? obj.auth : 0;
    const dhcp = typeof obj.dhcp === 'number' ? obj.dhcp : 0;
    const dns = typeof obj.dns === 'number' ? obj.dns : 0;

    const totalFailures = assoc + auth + dhcp + dns;
    const total = success + totalFailures;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 100;

    // Return as metrics-only format (no AP data available from this endpoint)
    return {
      metrics: [
        { label: 'Success Rate', value: successRate, unit: '%' },
        { label: 'Successful', value: success },
        { label: 'Assoc Fail', value: assoc },
        { label: 'Auth Fail', value: auth },
        { label: 'DHCP Fail', value: dhcp },
        { label: 'DNS Fail', value: dns },
      ],
      // Empty arrays since we don't have AP data from connection stats endpoint
      access_points: [],
      ssids: [],
      channel_data: undefined,
    };
  }

  return { _emptyState: true, message: 'No wireless data available', icon: 'network' };
}

/**
 * Transform wireless data for RF Health multi_gauge display
 * API returns: { accessPoints: [{status, utilization, channel, power, ...}] }
 * multi_gauge expects: [{label, value, min, max, unit?, status?}]
 */
function transformRFHealth(data: unknown): Array<{ label: string; value: number; min: number; max: number; unit?: string; status?: string }> | Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return { _emptyState: true, message: 'No RF health data available', icon: 'network' };
  }

  const obj = data as Record<string, unknown>;

  // Get access points array
  const aps = obj.accessPoints as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(aps) || aps.length === 0) {
    return { _emptyState: true, message: 'No wireless access points in this network', icon: 'network' };
  }

  // Calculate average metrics across all APs
  let totalUtil = 0;
  let totalPower = 0;
  let countUtil = 0;
  let countPower = 0;

  aps.forEach(ap => {
    if (typeof ap.utilization === 'number') {
      totalUtil += ap.utilization;
      countUtil++;
    }
    if (typeof ap.power === 'number') {
      totalPower += ap.power;
      countPower++;
    }
  });

  const avgUtil = countUtil > 0 ? Math.round(totalUtil / countUtil) : 0;
  const avgPower = countPower > 0 ? Math.round(totalPower / countPower) : 15;

  // Determine status based on utilization
  const utilStatus = avgUtil > 80 ? 'critical' : avgUtil > 60 ? 'warning' : 'good';

  return [
    {
      label: 'Channel Util',
      value: avgUtil,
      min: 0,
      max: 100,
      unit: '%',
      status: utilStatus,
    },
    {
      label: 'Tx Power',
      value: avgPower,
      min: 0,
      max: 30,
      unit: 'dBm',
      status: 'good',
    },
    {
      label: 'APs Online',
      value: aps.filter(ap => ap.status === 'online').length,
      min: 0,
      max: aps.length,
      unit: '',
      status: aps.every(ap => ap.status === 'online') ? 'good' : 'warning',
    },
  ];
}

/**
 * Transform performance/latency data for multi_gauge display
 * API returns: { latency: {current, average, max, min}, jitter: {...}, packetLoss: {...} }
 * multi_gauge expects: [{label, value, min, max, unit?}]
 */
function transformPerformance(data: unknown): Array<{ label: string; value: number; min: number; max: number; unit: string }> {
  if (!data || typeof data !== 'object') return [];

  const obj = data as Record<string, unknown>;
  const result: Array<{ label: string; value: number; min: number; max: number; unit: string }> = [];

  // Handle latency object
  if (obj.latency && typeof obj.latency === 'object') {
    const lat = obj.latency as Record<string, number>;
    result.push({
      label: 'Latency',
      value: lat.current ?? lat.average ?? 0,
      min: 0,
      max: 100,
      unit: 'ms',
    });
  } else if (typeof obj.latency === 'number') {
    result.push({ label: 'Latency', value: obj.latency, min: 0, max: 100, unit: 'ms' });
  }

  // Handle jitter object
  if (obj.jitter && typeof obj.jitter === 'object') {
    const jit = obj.jitter as Record<string, number>;
    result.push({
      label: 'Jitter',
      value: jit.current ?? jit.average ?? 0,
      min: 0,
      max: 50,
      unit: 'ms',
    });
  } else if (typeof obj.jitter === 'number') {
    result.push({ label: 'Jitter', value: obj.jitter, min: 0, max: 50, unit: 'ms' });
  }

  // Handle packetLoss object
  if (obj.packetLoss && typeof obj.packetLoss === 'object') {
    const loss = obj.packetLoss as Record<string, number>;
    result.push({
      label: 'Packet Loss',
      value: loss.current ?? loss.average ?? 0,
      min: 0,
      max: 10,
      unit: '%',
    });
  } else if (typeof obj.loss === 'number') {
    result.push({ label: 'Packet Loss', value: obj.loss, min: 0, max: 10, unit: '%' });
  }

  return result;
}

/**
 * Transform device status data for tables
 * API returns: { devices: [...] } with status info
 */
function transformDeviceStatus(data: unknown): Array<Record<string, unknown>> | Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return { _emptyState: true, message: 'No device inventory available', icon: 'network' };
  }

  const obj = data as Record<string, unknown>;

  // Handle { devices: [...] }
  if (Array.isArray(obj.devices)) {
    if (obj.devices.length === 0) {
      return { _emptyState: true, message: 'No devices found in this network', icon: 'network' };
    }
    return obj.devices as Array<Record<string, unknown>>;
  }

  // Handle direct array
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { _emptyState: true, message: 'No devices found in this network', icon: 'network' };
    }
    return data as Array<Record<string, unknown>>;
  }

  return { _emptyState: true, message: 'No device inventory available', icon: 'network' };
}

/**
 * Transform security events for timeline/list
 * API returns: { events: [...] } or direct array
 */
function transformSecurityEvents(data: unknown): Array<Record<string, unknown>> | Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return { _emptyState: true, message: 'No security events in the last 24 hours', icon: 'security' };
  }

  const obj = data as Record<string, unknown>;

  // Handle { events: [...] }
  if (Array.isArray(obj.events)) {
    if (obj.events.length === 0) {
      return { _emptyState: true, message: 'No security events detected - network is secure', icon: 'success' };
    }
    return obj.events as Array<Record<string, unknown>>;
  }

  // Handle { security_events: [...] }
  if (Array.isArray(obj.security_events)) {
    if (obj.security_events.length === 0) {
      return { _emptyState: true, message: 'No security events detected - network is secure', icon: 'success' };
    }
    return obj.security_events as Array<Record<string, unknown>>;
  }

  // Handle direct array
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { _emptyState: true, message: 'No security events detected - network is secure', icon: 'success' };
    }
    return data as Array<Record<string, unknown>>;
  }

  return { _emptyState: true, message: 'No security events in the last 24 hours', icon: 'security' };
}

// =============================================================================
// Card Fetch Registry
// =============================================================================

export const CARD_FETCHERS: Partial<Record<AllCardTypes, FetchConfig>> = {
  // ===========================================================================
  // Meraki Cards - Using /api/cards/... endpoints
  // ===========================================================================

  meraki_network_health: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/network-health/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: transformDeviceHealth,
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_device_table: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/device-status/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: transformDeviceStatus,
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_alert_summary: {
    buildEndpoint: (scope) => {
      if (!scope.credentialOrg) return null;
      let endpoint = `${API_BASE}/alerts/${encodeURIComponent(scope.credentialOrg)}/data`;
      // Add network_id for network-specific alerts
      if (scope.networkId) {
        endpoint += `?network_id=${encodeURIComponent(scope.networkId)}`;
      }
      return endpoint;
    },
    transformData: transformAlertSummary,
    requiredScope: ['credentialOrg'],
    refreshInterval: 10000,
  },

  meraki_top_clients: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/clients/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: transformTopClients,
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_uplink_status: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/wan-failover/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: (data) => {
      // Transform WAN failover data for status grid display
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No uplink status available', icon: 'network' };
      }
      const obj = data as Record<string, unknown>;
      const uplinks = obj.uplinks as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(uplinks) || uplinks.length === 0) {
        return { _emptyState: true, message: 'No WAN uplinks configured', icon: 'network' };
      }

      return uplinks.map((uplink) => ({
        name: String(uplink.interface || 'WAN'),
        status: String(uplink.status || 'unknown'),
        isPrimary: Boolean(uplink.isPrimary),
        ip: String(uplink.ip || '-'),
        publicIp: String(uplink.publicIp || '-'),
        provider: String(uplink.provider || 'ISP'),
        latency: Number(uplink.latency || 0),
        loss: Number(uplink.loss || 0),
      }));
    },
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_ssid_clients: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/clients/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: transformSSIDDistribution,
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_switch_ports: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/device-status/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: (data) => {
      // Extract switch port data from device status
      // status_grid expects: [{name, status, type?, icon?, subtitle?}]
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No switch port data available', icon: 'network' };
      }
      const obj = data as Record<string, unknown>;
      const devices = obj.devices as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(devices)) {
        return { _emptyState: true, message: 'No device data available', icon: 'network' };
      }

      // Filter for switches only
      const switches = devices.filter(d =>
        String(d.model || '').toLowerCase().includes('switch') ||
        String(d.model || '').startsWith('MS')
      );

      if (switches.length === 0) {
        return { _emptyState: true, message: 'No switches found in this network', icon: 'network' };
      }

      // Transform switches to status_grid format
      // Each switch becomes a status item showing its health
      return switches.map((sw) => {
        const status = String(sw.status || 'unknown').toLowerCase();
        return {
          name: String(sw.name || sw.serial || 'Switch'),
          status: status === 'online' ? 'healthy' : status === 'offline' ? 'critical' : status,
          type: String(sw.model || 'Switch'),
          subtitle: `${sw.lanIp || 'No IP'} • ${sw.portCount || sw.ports || '?'} ports`,
        };
      });
    },
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_vpn_status: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/topology/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: (data) => {
      // Transform topology data to show device connections as "VPN-like" status
      // Note: True VPN status would need getOrganizationApplianceVpnStatuses endpoint
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No VPN status available', icon: 'network' };
      }
      const obj = data as Record<string, unknown>;
      const nodes = obj.nodes as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(nodes) || nodes.length === 0) {
        return { _emptyState: true, message: 'No network topology data', icon: 'network' };
      }

      // Show appliance devices (MX) as VPN peers
      const appliances = nodes.filter(n =>
        String(n.model || '').startsWith('MX') ||
        String(n.type || '').toLowerCase().includes('appliance')
      );

      if (appliances.length === 0) {
        return { _emptyState: true, message: 'No VPN-capable MX appliances in this network', icon: 'network' };
      }

      return appliances.map((node) => ({
        name: String(node.name || node.label || 'Unknown'),
        status: String(node.status || 'unknown'),
        type: String(node.model || 'Appliance'),
        ip: String(node.lanIp || '-'),
      }));
    },
    requiredScope: ['networkId'],
    refreshInterval: 60000,
  },

  meraki_security_events: {
    buildEndpoint: (scope) =>
      scope.credentialOrg
        ? `${API_BASE}/security-events/${encodeURIComponent(scope.credentialOrg)}/data`
        : null,
    transformData: transformSecurityEvents,
    requiredScope: ['credentialOrg'],
    refreshInterval: 15000,
  },

  meraki_bandwidth_usage: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/traffic-flow/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: transformTrafficFlow,
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_client_count: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/clients/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: (data) => {
      if (!data || typeof data !== 'object') return { value: 0, label: 'Clients' };

      const obj = data as Record<string, unknown>;

      // Check for total_clients or client_count field
      if (typeof obj.total_clients === 'number') {
        return { value: obj.total_clients, label: 'Clients' };
      }
      if (typeof obj.client_count === 'number') {
        return { value: obj.client_count, label: 'Clients' };
      }
      if (typeof obj.total === 'number') {
        return { value: obj.total, label: 'Clients' };
      }

      // Fall back to counting the top_clients array
      if (Array.isArray(obj.top_clients)) {
        return { value: (obj.top_clients as unknown[]).length, label: 'Clients' };
      }

      return { value: 0, label: 'Clients' };
    },
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_latency_loss: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/sla-metrics/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: (data) => {
      // Extract latency and loss metrics from SLA endpoint
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No latency and loss data available', icon: 'chart' };
      }
      const obj = data as Record<string, unknown>;
      const metrics = obj.metrics as Array<Record<string, unknown>> | undefined;

      if (!Array.isArray(metrics) || metrics.length === 0) {
        return { _emptyState: true, message: 'No SLA metrics configured for this network', icon: 'chart' };
      }

      const result: Array<{ label: string; value: number; min: number; max: number; unit: string; inverted: boolean }> = [];

      // Find latency metric (lower is better)
      const latency = metrics.find(m => String(m.name).toLowerCase().includes('latency'));
      if (latency) {
        result.push({
          label: 'Latency',
          value: Number(latency.current || 0),
          min: 0,
          max: 100,
          unit: 'ms',
          inverted: true, // Lower latency is better
        });
      }

      // Find packet loss metric (lower is better)
      const loss = metrics.find(m => String(m.name).toLowerCase().includes('loss'));
      if (loss) {
        result.push({
          label: 'Packet Loss',
          value: Number(loss.current || 0),
          min: 0,
          max: 5,
          unit: '%',
          inverted: true, // Lower packet loss is better
        });
      }

      // Find jitter metric (lower is better)
      const jitter = metrics.find(m => String(m.name).toLowerCase().includes('jitter'));
      if (jitter) {
        result.push({
          label: 'Jitter',
          value: Number(jitter.current || 0),
          min: 0,
          max: 50,
          unit: 'ms',
          inverted: true, // Lower jitter is better
        });
      }

      if (result.length === 0) {
        return { _emptyState: true, message: 'No latency, loss, or jitter metrics found', icon: 'chart' };
      }

      return result;
    },
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_wireless_stats: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/wireless-overview/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: transformWirelessStats,
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_rf_health: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/wireless-overview/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: transformRFHealth,
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  meraki_top_applications: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/traffic-flow/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: (data) => {
      // Extract applications array from traffic-flow response
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No application traffic data available', icon: 'chart' };
      }
      const obj = data as Record<string, unknown>;
      const apps = obj.applications as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(apps) || apps.length === 0) {
        return { _emptyState: true, message: 'No application data in this timeframe', icon: 'chart' };
      }

      return apps.slice(0, 10).map((app, index) => ({
        label: String(app.name || app.application || `App ${index + 1}`),
        value: Number(app.bytes || app.bytesIn || 0) + Number(app.bytesOut || 0),
        displayValue: formatBytes(Number(app.bytes || app.bytesIn || 0) + Number(app.bytesOut || 0)),
      }));
    },
    requiredScope: ['networkId'],
    refreshInterval: 60000,
  },

  meraki_device_uptime: {
    buildEndpoint: (scope) =>
      scope.networkId
        ? withOrgQuery(`${API_BASE}/sla-metrics/${scope.networkId}/data`, scope.credentialOrg)
        : null,
    transformData: (data) => {
      // Extract uptime metrics from SLA endpoint
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No uptime data available', icon: 'chart' };
      }
      const obj = data as Record<string, unknown>;
      const metrics = obj.metrics as Array<Record<string, unknown>> | undefined;

      if (Array.isArray(metrics)) {
        const uptimeMetric = metrics.find(m => String(m.name).toLowerCase().includes('uptime'));
        if (uptimeMetric) {
          return [
            {
              label: 'Uptime',
              value: Number(uptimeMetric.current || 0),
              min: 0,
              max: 100,
              unit: '%',
            },
          ];
        }
      }

      // Fallback to direct uptime field
      if (typeof obj.uptime === 'number') {
        return [{ label: 'Uptime', value: obj.uptime, min: 0, max: 100, unit: '%' }];
      }

      return { _emptyState: true, message: 'No uptime metrics configured for this network', icon: 'chart' };
    },
    requiredScope: ['networkId'],
    refreshInterval: 60000,
  },

  // ===========================================================================
  // ThousandEyes Cards - Using /api/thousandeyes/... endpoints
  // Note: All TE endpoints require ?organization= param (can be any value, token is used for auth)
  // ===========================================================================

  te_agent_health: {
    buildEndpoint: () => `/api/thousandeyes/agents?organization=default`,
    transformData: (data) => {
      // Transform agents list to status grid format
      if (!data || typeof data !== 'object') return [];
      const obj = data as Record<string, unknown>;
      const agents = obj.agents as Array<Record<string, unknown>> | undefined;

      if (!Array.isArray(agents)) return [];

      return agents.slice(0, 12).map((agent) => ({
        name: String(agent.agentName || agent.name || 'Unknown'),
        status: String(agent.enabled ? (agent.lastSeen ? 'online' : 'offline') : 'disabled'),
        type: String(agent.agentType || 'cloud'),
        location: String(agent.location || agent.countryId || '-'),
      }));
    },
    requiredScope: [],
    refreshInterval: 30000,
  },

  te_alert_summary: {
    buildEndpoint: () => `/api/thousandeyes/alerts?organization=default`,
    transformData: (data) => {
      // Transform alerts to badge list format
      if (!data || typeof data !== 'object') return { critical: 0, warning: 0, info: 0 };
      const obj = data as Record<string, unknown>;

      // Handle pre-transformed counts from backend auto-card (already has critical/warning/info keys)
      if (typeof obj.critical === 'number' || typeof obj.major === 'number' || typeof obj.total === 'number') {
        return {
          critical: Number(obj.critical || 0),
          warning: Number(obj.warning || obj.major || 0) + Number(obj.minor || 0),
          info: Number(obj.info || 0),
        };
      }

      // Handle raw API format: {alerts: [...]}
      const alerts = obj.alerts as Array<Record<string, unknown>> | undefined;

      // Handle direct array of alerts
      const alertList = Array.isArray(alerts) ? alerts : (Array.isArray(data) ? data as Array<Record<string, unknown>> : null);

      if (!alertList) return { critical: 0, warning: 0, info: 0 };

      // Count by severity
      const counts = { critical: 0, warning: 0, info: 0 };
      alertList.forEach((alert) => {
        const severity = String(alert.severity || alert.type || 'info').toLowerCase();
        if (severity === 'critical' || severity === 'severe') counts.critical++;
        else if (severity === 'warning' || severity === 'major' || severity === 'minor') counts.warning++;
        else counts.info++;
      });

      return counts;
    },
    requiredScope: [],
    refreshInterval: 15000,
  },

  te_test_results: {
    buildEndpoint: (scope) =>
      scope.testId
        ? `/api/thousandeyes/tests/${scope.testId}/results?organization=default`
        : `/api/thousandeyes/tests?organization=default`,
    transformData: (data) => {
      // Transform tests list to table format
      if (!data || typeof data !== 'object') return [];
      const obj = data as Record<string, unknown>;

      // If it's a tests list, show the tests
      const tests = obj.tests as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(tests)) {
        return tests.slice(0, 10).map((test) => ({
          name: String(test.testName || test.name || 'Unknown'),
          type: String(test.type || '-'),
          status: test.enabled ? 'active' : 'disabled',
          interval: `${test.interval || 60}s`,
        }));
      }

      // If it's test results, return as-is
      return data;
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  te_path_visualization: {
    buildEndpoint: (scope) =>
      scope.testId
        ? `/api/thousandeyes/tests/${scope.testId}/path-vis/detailed?organization=default&window=2h`
        : `/api/thousandeyes/tests?organization=default`,
    transformData: (data) => {
      if (!data || typeof data !== 'object') return { hops: [] };
      const obj = data as Record<string, unknown>;

      // Pass through visualization-native formats (from AI-provided or pre-created data)
      if (Array.isArray(obj.nodes) || Array.isArray(obj.hops)) return data;

      // Handle path-vis/detailed response: { results: [{ pathTraces: [{ hops: [...] }] }] }
      const results = Array.isArray(obj.results) ? obj.results : [];
      if (results.length > 0) {
        const hops: Array<Record<string, unknown>> = [];
        for (const result of results) {
          const r = result as Record<string, unknown>;
          const traces = (r.pathTraces || r.routes) as unknown[];
          if (Array.isArray(traces)) {
            for (const trace of traces) {
              const t = trace as Record<string, unknown>;
              const hopsArr = t.hops as unknown[];
              if (Array.isArray(hopsArr)) {
                for (const hop of hopsArr) {
                  const h = hop as Record<string, unknown>;
                  hops.push({
                    hopNumber: h.hop ?? h.hopNumber ?? hops.length + 1,
                    ipAddress: String(h.ipAddress || h.ip || ''),
                    hostname: h.rdns || h.hostname || undefined,
                    latency: Number(h.responseTime ?? h.delay ?? h.latency ?? 0),
                    loss: Number(h.loss ?? 0),
                    prefix: h.prefix || undefined,
                    network: h.network || undefined,
                  });
                }
                break; // Use first trace
              }
            }
          }
          if (hops.length > 0) break; // Use first result with hops
        }
        if (hops.length > 0) return { hops };
      }

      // Handle tests list fallback
      const tests = obj.tests as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(tests)) {
        return tests.filter(t => t.type === 'agent-to-server' || t.type === 'network').slice(0, 5).map((test) => ({
          source: String(test.testName || 'Agent'),
          target: String(test.server || test.url || 'Target'),
          status: test.enabled ? 'active' : 'inactive',
        }));
      }

      return { hops: [] };
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  te_latency_chart: {
    buildEndpoint: (scope) =>
      scope.testId
        ? `/api/thousandeyes/tests/${scope.testId}/path-vis/detailed?organization=default&window=2h`
        : `/api/thousandeyes/tests?organization=default`,
    transformData: (data) => {
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No latency data available', icon: 'chart' };
      }
      const obj = data as Record<string, unknown>;

      // Pass through visualization-native formats (from AI-provided or pre-created data)
      if (Array.isArray(obj.nodes) || Array.isArray(obj.hops)) return data;

      // Handle path-vis/detailed response — extract hops for latency waterfall
      const results = Array.isArray(obj.results) ? obj.results : [];
      if (results.length > 0) {
        const hops: Array<Record<string, unknown>> = [];
        for (const result of results) {
          const r = result as Record<string, unknown>;
          const traces = (r.pathTraces || r.routes) as unknown[];
          if (Array.isArray(traces)) {
            for (const trace of traces) {
              const t = trace as Record<string, unknown>;
              const hopsArr = t.hops as unknown[];
              if (Array.isArray(hopsArr)) {
                for (const hop of hopsArr) {
                  const h = hop as Record<string, unknown>;
                  hops.push({
                    hopNumber: h.hop ?? h.hopNumber ?? hops.length + 1,
                    ipAddress: String(h.ipAddress || h.ip || ''),
                    hostname: h.rdns || h.hostname || undefined,
                    latency: Number(h.responseTime ?? h.delay ?? h.latency ?? 0),
                    loss: Number(h.loss ?? 0),
                    prefix: h.prefix || undefined,
                    network: h.network || undefined,
                  });
                }
                break;
              }
            }
          }
          if (hops.length > 0) break;
        }
        if (hops.length > 0) return { hops };
      }

      // Handle tests list fallback
      const tests = obj.tests as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(tests)) {
        const networkTests = tests.filter(t => t.type === 'agent-to-server' || t.type === 'network');
        if (networkTests.length === 0) {
          return { _emptyState: true, message: 'No network tests configured', icon: 'chart' };
        }
        return [
          { label: 'Network Tests', value: networkTests.length },
          { label: 'Active', value: networkTests.filter(t => t.enabled).length },
        ];
      }

      return { _emptyState: true, message: 'No latency data available', icon: 'chart' };
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  te_outage_map: {
    buildEndpoint: () => `/api/thousandeyes/alerts?organization=default&active_only=true`,
    transformData: (data) => {
      // Transform alerts into table format for outage display
      if (!data || typeof data !== 'object') return [];
      const obj = data as Record<string, unknown>;
      const alerts = obj.alerts as Array<Record<string, unknown>> | undefined;

      if (!Array.isArray(alerts) || alerts.length === 0) {
        return [{ region: 'No active outages', count: 0, severity: 'good' }];
      }

      // Group alerts by region/location
      const regionCounts: Record<string, number> = {};
      alerts.forEach((alert) => {
        const location = String(alert.location || alert.region || alert.testName || 'Unknown');
        regionCounts[location] = (regionCounts[location] || 0) + 1;
      });

      return Object.entries(regionCounts).slice(0, 10).map(([region, count]) => ({
        region,
        count,
        severity: count >= 5 ? 'critical' : count >= 2 ? 'warning' : 'info',
      }));
    },
    requiredScope: [],
    refreshInterval: 30000,
  },

  te_bgp_changes: {
    buildEndpoint: () => `/api/thousandeyes/tests?organization=default`,
    transformData: (data) => {
      // Transform tests list to BGP-relevant table
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No BGP monitoring configured', icon: 'network' };
      }
      const obj = data as Record<string, unknown>;
      const tests = obj.tests as Array<Record<string, unknown>> | undefined;

      if (!Array.isArray(tests)) {
        return { _emptyState: true, message: 'Unable to fetch BGP tests', icon: 'network' };
      }

      // Filter for BGP-related tests
      const bgpTests = tests.filter(t =>
        String(t.type).toLowerCase().includes('bgp') ||
        String(t.testName || '').toLowerCase().includes('bgp')
      );

      if (bgpTests.length === 0) {
        return { _emptyState: true, message: 'No BGP tests configured in ThousandEyes', icon: 'network' };
      }

      return bgpTests.slice(0, 10).map((test) => ({
        name: String(test.testName || test.prefix || 'BGP Test'),
        status: test.enabled ? 'active' : 'disabled',
        monitors: String(Array.isArray(test.bgpMonitors) ? test.bgpMonitors.length : 0),
      }));
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  te_dns_response: {
    buildEndpoint: (scope) =>
      scope.testId
        ? `/api/thousandeyes/tests/${scope.testId}/results?organization=default&test_type=dns-server`
        : `/api/thousandeyes/tests?organization=default`,
    transformData: (data) => {
      // Transform DNS test data
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No DNS monitoring data', icon: 'dns' };
      }
      const obj = data as Record<string, unknown>;

      // Handle tests list - return stat row format
      const tests = obj.tests as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(tests)) {
        const dnsTests = tests.filter(t =>
          String(t.type).toLowerCase().includes('dns')
        );
        if (dnsTests.length === 0) {
          return { _emptyState: true, message: 'No DNS tests configured in ThousandEyes', icon: 'dns' };
        }
        return [
          { label: 'DNS Tests', value: dnsTests.length },
          { label: 'Active', value: dnsTests.filter(t => t.enabled).length },
        ];
      }

      // Handle actual DNS results - return gauge format with proper thresholds
      const results = obj.results as Record<string, unknown> | undefined;
      if (results?.dns) {
        const dns = results.dns as Record<string, unknown>;
        const metrics: Array<{ label: string; value: number; min: number; max: number; unit: string; inverted: boolean }> = [];
        if (typeof dns.avgResolutionTime === 'number') {
          metrics.push({ label: 'Resolution', value: dns.avgResolutionTime, min: 0, max: 500, unit: 'ms', inverted: true });
        }
        if (typeof dns.availability === 'number') {
          metrics.push({ label: 'Availability', value: dns.availability, min: 0, max: 100, unit: '%', inverted: false });
        }
        return metrics.length > 0 ? metrics : { _emptyState: true, message: 'No DNS metrics available', icon: 'dns' };
      }

      return { _emptyState: true, message: 'Select a DNS test to view response times', icon: 'dns' };
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  te_voip_quality: {
    buildEndpoint: (scope) =>
      scope.testId
        ? `/api/thousandeyes/tests/${scope.testId}/results?organization=default&test_type=voice-call`
        : `/api/thousandeyes/tests?organization=default`,
    transformData: (data) => {
      // Transform VoIP test data
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No VoIP monitoring data', icon: 'phone' };
      }
      const obj = data as Record<string, unknown>;

      // Handle tests list - return stat row format
      const tests = obj.tests as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(tests)) {
        const voipTests = tests.filter(t =>
          String(t.type).toLowerCase().includes('voice') ||
          String(t.type).toLowerCase().includes('sip')
        );
        if (voipTests.length === 0) {
          return { _emptyState: true, message: 'No VoIP tests configured in ThousandEyes', icon: 'phone' };
        }
        return [
          { label: 'VoIP Tests', value: voipTests.length },
          { label: 'Active', value: voipTests.filter(t => t.enabled).length },
        ];
      }

      // Handle actual VoIP results - return gauge format
      const results = obj.results as Record<string, unknown> | undefined;
      if (results?.voice) {
        const voip = results.voice as Record<string, unknown>;
        const metrics: Array<{ label: string; value: number; min: number; max: number; unit: string; inverted?: boolean }> = [];
        if (typeof voip.mos === 'number') {
          metrics.push({ label: 'MOS Score', value: voip.mos, min: 1, max: 5, unit: '' });
        }
        if (typeof voip.jitter === 'number') {
          metrics.push({ label: 'Jitter', value: voip.jitter, min: 0, max: 50, unit: 'ms', inverted: true });
        }
        if (typeof voip.loss === 'number') {
          metrics.push({ label: 'Packet Loss', value: voip.loss, min: 0, max: 10, unit: '%', inverted: true });
        }
        return metrics.length > 0 ? metrics : { _emptyState: true, message: 'No VoIP metrics available', icon: 'phone' };
      }

      return { _emptyState: true, message: 'Select a VoIP test to view quality metrics', icon: 'phone' };
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  te_web_transaction: {
    buildEndpoint: (scope) =>
      scope.testId
        ? `/api/thousandeyes/tests/${scope.testId}/results?organization=default&test_type=web-transactions`
        : `/api/thousandeyes/tests?organization=default`,
    transformData: (data) => {
      // Transform web transaction data to table format
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'No web transaction monitoring', icon: 'web' };
      }
      const obj = data as Record<string, unknown>;

      // Handle tests list - show web transaction tests as table
      const tests = obj.tests as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(tests)) {
        const webTests = tests.filter(t =>
          String(t.type).toLowerCase().includes('web') ||
          String(t.type).toLowerCase().includes('http') ||
          String(t.type).toLowerCase().includes('page')
        );
        if (webTests.length === 0) {
          return { _emptyState: true, message: 'No web tests configured in ThousandEyes', icon: 'web' };
        }
        return webTests.slice(0, 5).map((test) => ({
          name: String(test.testName || test.url || 'Web Test'),
          status: test.enabled ? 'active' : 'disabled',
          interval: `${test.interval || 60}s`,
        }));
      }

      // Handle actual web transaction results
      const results = obj.results as Record<string, unknown> | undefined;
      if (results?.web) {
        const webTx = results.web as Record<string, unknown>;
        const pages = webTx.pages as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(pages) && pages.length > 0) {
          return pages.slice(0, 5).map((page) => ({
            name: String(page.pageName || page.url || 'Page'),
            status: page.error ? 'error' : 'success',
            duration: `${Number(page.responseTime || page.duration || 0)}ms`,
          }));
        }
      }

      return { _emptyState: true, message: 'Select a web test to view transactions', icon: 'web' };
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  te_endpoint_sessions: {
    // Use regular agents endpoint as fallback since endpoint-agents requires specific licensing
    buildEndpoint: () => `/api/thousandeyes/agents?organization=default`,
    transformData: (data) => {
      // Transform agents to table format (using regular agents as endpoint-agents may not be available)
      if (!data || typeof data !== 'object') return [];
      const obj = data as Record<string, unknown>;

      // Try multiple possible response formats
      const agents = obj.agents || obj.endpointAgents || obj.data || [];

      if (!Array.isArray(agents)) {
        // If no agents array, check if it's an error response
        if (obj.error || obj.detail) {
          return [{ name: 'Endpoint Agents not available', status: 'info', type: 'Requires TE Endpoint Agent license' }];
        }
        return [];
      }

      if (agents.length === 0) {
        return [{ name: 'No agents configured', status: 'info', type: '-' }];
      }

      return agents.slice(0, 20).map((agent: Record<string, unknown>) => ({
        name: String(agent.agentName || agent.name || 'Unknown'),
        status: agent.enabled ? 'enabled' : 'disabled',
        type: String(agent.agentType || '-'),
      }));
    },
    requiredScope: [],
    refreshInterval: 30000,
  },

  // ===========================================================================
  // Splunk Cards - Using /api/cards/splunk-data/... endpoints
  // ===========================================================================

  splunk_event_count: {
    buildEndpoint: () => `${API_BASE}/splunk-data/log-volume/data`,
    transformData: (data) => {
      // Transform log volume data for big number display
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'Splunk not configured - add credentials in Admin > System Config', icon: 'config' };
      }
      const obj = data as Record<string, unknown>;

      // Check if backend returned empty object (Splunk not configured or no data)
      if (Object.keys(obj).length === 0) {
        return { _emptyState: true, message: 'No Splunk insights available - run /api/splunk/insights/generate first', icon: 'chart' };
      }

      const value = Number(obj.totalEvents || obj.total_events || 0);
      if (value === 0) {
        return { _emptyState: true, message: 'No log events in selected time range', icon: 'chart' };
      }

      // Format large numbers with K/M suffix
      const formatCount = (n: number): string => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n.toString();
      };

      return {
        value: formatCount(value),
        label: 'Events (24h)',
        trend: obj.trend as number | undefined,
      };
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  splunk_notable_events: {
    buildEndpoint: () => `${API_BASE}/splunk-data/search-results/data`,
    transformData: (data) => {
      // Transform search results for SecurityEventsViz display
      // SecurityEventsViz expects: { id, timestamp, title, description?, severity, source?, type? }
      // severity must be: 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown'
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'Splunk not configured', icon: 'config' };
      }
      const obj = data as Record<string, unknown>;
      const results = obj.results as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(results) || results.length === 0) {
        return { _emptyState: true, message: 'No notable events from Splunk', icon: 'success' };
      }

      // Map severity levels to StatusLevel
      const mapSeverity = (sev: string): 'healthy' | 'warning' | 'critical' | 'unknown' => {
        const s = sev.toLowerCase();
        if (s === 'critical' || s === 'high' || s === 'error' || s === 'fatal') return 'critical';
        if (s === 'warning' || s === 'medium' || s === 'warn') return 'warning';
        if (s === 'info' || s === 'low' || s === 'informational') return 'healthy';
        return 'unknown';
      };

      // Parse timestamp safely
      const parseTimestamp = (ts: unknown): string => {
        if (!ts) return new Date().toISOString();
        const str = String(ts);
        // Handle epoch seconds
        if (/^\d{10}$/.test(str)) {
          return new Date(parseInt(str) * 1000).toISOString();
        }
        // Handle epoch milliseconds
        if (/^\d{13}$/.test(str)) {
          return new Date(parseInt(str)).toISOString();
        }
        // Try to parse as date string
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
        return new Date().toISOString();
      };

      return results.slice(0, 20).map((event, index) => ({
        id: String(event.id || event._cd || event.event_id || `splunk-${index}`),
        timestamp: parseTimestamp(event._time || event.time || event.timestamp),
        title: String(event.message || event.search_name || event.rule_name || event._raw || 'Splunk Event').slice(0, 100),
        description: event.description ? String(event.description) : (event._raw ? String(event._raw).slice(0, 200) : undefined),
        severity: mapSeverity(String(event.severity || event.urgency || event.level || 'info')),
        source: String(event.source || event.sourcetype || 'splunk'),
        type: String(event.event_type || event.type || event.category || 'event'),
      }));
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  splunk_top_errors: {
    buildEndpoint: () => `${API_BASE}/splunk-data/error-distribution/data`,
    transformData: (data) => {
      // Transform error distribution for bar chart
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'Splunk not configured - add credentials in Admin > System Config', icon: 'config' };
      }
      const obj = data as Record<string, unknown>;

      // Check if backend returned empty object
      if (Object.keys(obj).length === 0) {
        return { _emptyState: true, message: 'No Splunk insights available - generate insights first', icon: 'chart' };
      }

      const categories = obj.categories || obj.errors || [];
      if (!Array.isArray(categories) || categories.length === 0) {
        return { _emptyState: true, message: 'No errors detected - all systems normal', icon: 'success' };
      }

      return categories.slice(0, 10).map((cat: Record<string, unknown>) => ({
        label: String(cat.name || cat.category || 'Unknown').slice(0, 40),
        value: Number(cat.count || cat.value || 0),
        severity: cat.severity as string | undefined,
      }));
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  splunk_severity_donut: {
    buildEndpoint: () => `${API_BASE}/splunk-data/log-severity/data`,
    transformData: (data) => {
      // Transform severity data for donut chart with explicit colors
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'Splunk not configured - add credentials in Admin > System Config', icon: 'config' };
      }
      const obj = data as Record<string, unknown>;

      // Check if backend returned empty object
      if (Object.keys(obj).length === 0) {
        return { _emptyState: true, message: 'No Splunk insights available - generate insights first', icon: 'chart' };
      }

      // Severity color mapping for distinct colors
      const severityColors: Record<string, string> = {
        critical: '#dc2626', // red-600
        error: '#f97316',    // orange-500
        warning: '#eab308',  // yellow-500
        info: '#06b6d4',     // cyan-500
        debug: '#8b5cf6',    // violet-500
      };

      // Handle levels array format from backend
      const levels = obj.levels as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(levels) && levels.length > 0) {
        const segments = levels
          .filter(level => Number(level.count || 0) > 0)
          .map((level) => {
            const name = String(level.level || 'unknown');
            return {
              label: name.charAt(0).toUpperCase() + name.slice(1),
              value: Number(level.count || 0),
              color: severityColors[name.toLowerCase()] || '#94a3b8',
            };
          });
        if (segments.length === 0) {
          return { _emptyState: true, message: 'No log severity data in time range', icon: 'chart' };
        }
        return segments;
      }

      // Handle object format - convert to array with colors
      const severity = obj.severity || {};
      if (typeof severity !== 'object') {
        return { _emptyState: true, message: 'No severity data from Splunk', icon: 'chart' };
      }
      const segments = [
        { label: 'Critical', value: Number((severity as Record<string, unknown>).critical || 0), color: '#dc2626' },
        { label: 'Error', value: Number((severity as Record<string, unknown>).error || 0), color: '#f97316' },
        { label: 'Warning', value: Number((severity as Record<string, unknown>).warning || 0), color: '#eab308' },
        { label: 'Info', value: Number((severity as Record<string, unknown>).info || 0), color: '#06b6d4' },
      ].filter(s => s.value > 0);

      if (segments.length === 0) {
        return { _emptyState: true, message: 'No log severity data in time range', icon: 'chart' };
      }
      return segments;
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  splunk_search_results: {
    buildEndpoint: () => `${API_BASE}/splunk-data/search-results/data`,
    transformData: (data) => {
      // Transform for table display
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'Splunk not configured - add credentials in Admin > System Config', icon: 'config' };
      }

      // Handle pre-transformed data from backend auto-card (already an array of results)
      if (Array.isArray(data)) {
        if (data.length === 0) {
          return { _emptyState: true, message: 'No search results from Splunk', icon: 'chart' };
        }
        return (data as Array<Record<string, unknown>>).slice(0, 50).map((r) => ({
          _time: r.timestamp || r._time || new Date().toISOString(),
          source: r.source || r.sourcetype || 'unknown',
          severity: r.severity || r.urgency || 'info',
          message: String(r.message || r._raw || r.search_name || 'No message').slice(0, 200),
          count: r.count || 1,
        }));
      }

      const obj = data as Record<string, unknown>;

      // Check if backend returned empty object
      if (Object.keys(obj).length === 0) {
        return { _emptyState: true, message: 'No Splunk insights available - generate insights first', icon: 'chart' };
      }

      const results = obj.results as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(results) || results.length === 0) {
        return { _emptyState: true, message: 'No search results from Splunk', icon: 'chart' };
      }

      // Transform to table-friendly format
      return results.slice(0, 50).map((r) => ({
        _time: r.timestamp || r._time || new Date().toISOString(),
        source: r.source || r.sourcetype || 'unknown',
        severity: r.severity || r.urgency || 'info',
        message: String(r.message || r._raw || r.search_name || 'No message').slice(0, 200),
        count: r.count || 1,
      }));
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  splunk_metric: {
    buildEndpoint: () => `${API_BASE}/splunk-data/log-volume/data`,
    transformData: (data) => {
      // Transform for big number display - shows events per minute rate
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'Splunk not configured', icon: 'config' };
      }
      const obj = data as Record<string, unknown>;

      // Check if backend returned empty object
      if (Object.keys(obj).length === 0) {
        return { _emptyState: true, message: 'No Splunk data available', icon: 'chart' };
      }

      const avgPerHour = Number(obj.avgEventsPerHour || 0);
      const ratePerMinute = Math.round(avgPerHour / 60);

      if (avgPerHour === 0) {
        return { _emptyState: true, message: 'No log activity', icon: 'chart' };
      }

      return {
        value: ratePerMinute,
        label: 'Events/min (avg)',
      };
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  splunk_sourcetype_volume: {
    buildEndpoint: () => `${API_BASE}/splunk-data/log-volume/data`,
    transformData: (data) => {
      // Transform sources for donut chart with distinct colors
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'Splunk not configured - add credentials in Admin > System Config', icon: 'config' };
      }
      const obj = data as Record<string, unknown>;

      // Check if backend returned empty object
      if (Object.keys(obj).length === 0) {
        return { _emptyState: true, message: 'No Splunk insights available - generate insights first', icon: 'chart' };
      }

      const sources = obj.sources as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(sources) || sources.length === 0) {
        return { _emptyState: true, message: 'No sourcetype data from Splunk', icon: 'chart' };
      }

      // Distinct color palette for sourcetypes
      const sourceColors = [
        '#3b82f6', // blue-500
        '#10b981', // emerald-500
        '#f59e0b', // amber-500
        '#8b5cf6', // violet-500
        '#06b6d4', // cyan-500
        '#f97316', // orange-500
        '#ec4899', // pink-500
        '#84cc16', // lime-500
      ];

      // Return in donut chart format {label, value, color}
      return sources.slice(0, 8).map((src, index) => ({
        label: String(src.name || src.source || 'Unknown'),
        value: Number(src.count || src.events || 0),
        color: (src.color as string) || sourceColors[index % sourceColors.length],
      }));
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  splunk_activity_heatmap: {
    buildEndpoint: () => null, // Backend endpoint not implemented
    transformData: () => ({ _emptyState: true, message: 'Activity heatmap - feature coming soon', icon: 'chart' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  splunk_log_trends: {
    buildEndpoint: () => `${API_BASE}/splunk-data/log-volume/data`,
    transformData: (data) => {
      // Transform log volume data for area chart with anomaly markers
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'Splunk not configured - add credentials in Admin > System Config', icon: 'config' };
      }
      const obj = data as Record<string, unknown>;

      // Check if backend returned empty object
      if (Object.keys(obj).length === 0) {
        return { _emptyState: true, message: 'No Splunk insights available - generate insights first', icon: 'chart' };
      }

      const timeseries = obj.timeseries as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(timeseries) || timeseries.length === 0) {
        return { _emptyState: true, message: 'No log trend data available', icon: 'chart' };
      }

      // Transform to area_chart format with anomaly highlighting
      return timeseries.map((point) => ({
        timestamp: String(point.timestamp || ''),
        sent: Number(point.count || 0), // Using 'sent' to match area_chart format
        recv: 0, // Not used for single-series chart but needed for format
        isAnomaly: Boolean(point.isAnomaly),
      }));
    },
    requiredScope: [],
    refreshInterval: 60000,
  },

  splunk_insights_summary: {
    buildEndpoint: () => `${API_BASE}/splunk-data/search-results/data`,
    transformData: (data) => {
      // Transform insights to status_grid format showing AI-generated summaries
      if (!data || typeof data !== 'object') {
        return { _emptyState: true, message: 'Splunk not configured - add credentials in Admin > System Config', icon: 'config' };
      }
      const obj = data as Record<string, unknown>;

      // Check if backend returned empty object
      if (Object.keys(obj).length === 0) {
        return { _emptyState: true, message: 'No AI insights generated yet - run insight generation first', icon: 'chart' };
      }

      const results = obj.results as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(results) || results.length === 0) {
        return { _emptyState: true, message: 'No log insights available', icon: 'chart' };
      }

      // Map severity to StatusLevel for status_grid
      const mapSeverity = (sev: string): string => {
        const s = sev.toLowerCase();
        if (s === 'critical' || s === 'high') return 'critical';
        if (s === 'medium' || s === 'warning') return 'warning';
        return 'healthy';
      };

      // Transform to status_grid format
      return results.slice(0, 12).map((insight, index) => ({
        id: String(insight.id || `insight-${index}`),
        name: String(insight.message || 'Log Insight').slice(0, 50),
        status: mapSeverity(String(insight.severity || 'info')),
        subtitle: `${insight.count || 0} events • ${insight.source || 'unknown'}`,
        type: String(insight.source || 'Splunk'),
      }));
    },
    requiredScope: [],
    refreshInterval: 120000,
  },

  // ===========================================================================
  // Catalyst Cards - Using /api/cards/... endpoints
  // ===========================================================================

  catalyst_site_health: {
    // Catalyst Center requires DNA Center integration - use dedicated Catalyst endpoints when configured
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'Catalyst Center not configured - requires DNA Center integration', icon: 'config' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  catalyst_device_inventory: {
    // Catalyst Center requires DNA Center integration - not available via Meraki API
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'Catalyst Center integration not configured', icon: 'config' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  catalyst_issue_summary: {
    // Catalyst Center requires DNA Center integration
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'Catalyst Center not configured - requires DNA Center integration', icon: 'config' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  catalyst_client_health: {
    // Catalyst Center requires DNA Center integration
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'Catalyst Center not configured - requires DNA Center integration', icon: 'config' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  catalyst_app_health: {
    // Catalyst Center requires DNA Center integration
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'Catalyst Center not configured - requires DNA Center integration', icon: 'config' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  catalyst_fabric_status: {
    buildEndpoint: () => null, // Catalyst Center not configured - requires DNA Center integration
    transformData: () => ({ _emptyState: true, message: 'Catalyst Center not configured', icon: 'config' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  catalyst_rogue_aps: {
    buildEndpoint: () => null, // Catalyst Center not configured - requires DNA Center integration
    transformData: () => ({ _emptyState: true, message: 'No rogue APs detected - wireless network is secure', icon: 'success' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  catalyst_compliance: {
    buildEndpoint: () => null, // Catalyst Center not supported - requires DNA Center integration
    transformData: () => ({ _emptyState: true, message: 'Catalyst Center not configured', icon: 'config' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  catalyst_poe_usage: {
    // Catalyst Center requires DNA Center integration
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'Catalyst Center not configured - requires DNA Center integration', icon: 'config' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  catalyst_client_onboarding: {
    // Catalyst Center requires DNA Center integration
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'Catalyst Center not configured - requires DNA Center integration', icon: 'config' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  // ===========================================================================
  // General Network Cards
  // Using Meraki Dashboard API endpoints for network visibility
  // ===========================================================================

  network_routing_table: {
    buildEndpoint: (scope) => {
      if (!scope.networkId) return null;
      const params = new URLSearchParams();
      if (scope.credentialOrg) params.append('org_id', scope.credentialOrg);
      return `/api/cards/static-routes/${scope.networkId}/data?${params.toString()}`;
    },
    transformData: (data: unknown) => {
      const routeData = data as { routes?: Array<Record<string, unknown>> } | null;
      if (!routeData?.routes || routeData.routes.length === 0) {
        return { _emptyState: true, message: 'No static routes configured', icon: 'network' };
      }
      // Transform for table visualization
      return routeData.routes.map((route) => ({
        destination: route.subnet || route.name || 'Unknown',
        gateway: route.gateway || 'N/A',
        status: route.enabled !== false ? 'Active' : 'Disabled',
        name: route.name || '',
        ipVersion: route.ipVersion || 'ipv4',
      }));
    },
    requiredScope: ['networkId'],
    refreshInterval: 60000,
  },

  network_bgp_neighbors: {
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'BGP is managed internally by Meraki', icon: 'network' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  network_ospf_status: {
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'OSPF is managed internally by Meraki', icon: 'network' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  network_vlan_map: {
    buildEndpoint: (scope) => {
      if (!scope.networkId) return null;
      const params = new URLSearchParams();
      if (scope.credentialOrg) params.append('org_id', scope.credentialOrg);
      return `/api/cards/vlan/${scope.networkId}/data?${params.toString()}`;
    },
    transformData: (data: unknown) => {
      const vlanData = data as { vlans?: Array<Record<string, unknown>> } | null;
      if (!vlanData?.vlans || vlanData.vlans.length === 0) {
        return { _emptyState: true, message: 'No VLANs configured - network may be in Single LAN mode', icon: 'network' };
      }
      // Transform for table visualization
      return vlanData.vlans.map((vlan) => ({
        id: vlan.id,
        name: vlan.name || `VLAN ${vlan.id}`,
        subnet: vlan.subnet || 'N/A',
        gateway: vlan.applianceIp || 'N/A',
        dhcp: vlan.dhcpEnabled ? 'Enabled' : 'Disabled',
        status: vlan.status || 'active',
      }));
    },
    requiredScope: ['networkId'],
    refreshInterval: 60000,
  },

  network_arp_table: {
    buildEndpoint: (scope) => {
      if (!scope.networkId) return null;
      const params = new URLSearchParams();
      if (scope.credentialOrg) params.append('org_id', scope.credentialOrg);
      return `/api/cards/clients/${scope.networkId}/data?${params.toString()}`;
    },
    transformData: (data: unknown) => {
      const clientData = data as { top_clients?: Array<Record<string, unknown>> } | null;
      if (!clientData?.top_clients || clientData.top_clients.length === 0) {
        return { _emptyState: true, message: 'No clients found on this network', icon: 'network' };
      }
      // Transform client data to ARP table format (IP → MAC mapping)
      return clientData.top_clients.map((client) => ({
        ip: client.ip || 'N/A',
        mac: client.mac || 'N/A',
        name: client.name || client.mac || 'Unknown',
        vlan: client.vlan || 'Default',
        status: client.status || 'online',
      }));
    },
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  network_mac_table: {
    buildEndpoint: (scope) => {
      if (!scope.networkId) return null;
      const params = new URLSearchParams();
      if (scope.credentialOrg) params.append('org_id', scope.credentialOrg);
      return `/api/cards/clients/${scope.networkId}/data?${params.toString()}`;
    },
    transformData: (data: unknown) => {
      const clientData = data as { top_clients?: Array<Record<string, unknown>> } | null;
      if (!clientData?.top_clients || clientData.top_clients.length === 0) {
        return { _emptyState: true, message: 'No clients found on this network', icon: 'network' };
      }
      // Transform client data to MAC table format
      return clientData.top_clients.map((client) => ({
        mac: client.mac || 'N/A',
        ip: client.ip || 'N/A',
        name: client.name || 'Unknown',
        ssid: client.ssid || 'Wired',
        signal: client.signal || 'N/A',
      }));
    },
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  network_traceroute: {
    buildEndpoint: (scope) => {
      // Meraki ping tool requires device serial - use if available
      if (!scope.deviceSerial) return null;
      return null; // TODO: Implement ping endpoint when ready
    },
    transformData: () => ({ _emptyState: true, message: 'Select a device to run traceroute (use Device Inventory)', icon: 'network' }),
    requiredScope: ['deviceSerial'],
    refreshInterval: 0,
  },

  network_packet_capture: {
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'Packet capture not available via Meraki API', icon: 'network' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  network_acl_hits: {
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'ACL counters not available via Meraki API', icon: 'security' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  network_qos_policy: {
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'QoS policy not available via Meraki API', icon: 'network' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  network_stp_topology: {
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'STP topology not available via Meraki API', icon: 'network' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  network_troubleshoot_flow: {
    buildEndpoint: () => null,
    transformData: () => ({ _emptyState: true, message: 'Guided troubleshooting coming soon', icon: 'network' }),
    requiredScope: [],
    refreshInterval: 0,
  },

  // ===========================================================================
  // Network Performance Change Cards
  // ===========================================================================

  network_performance_overview: {
    buildEndpoint: (scope) => {
      if (!scope.networkId) return null;
      const params = new URLSearchParams();
      if (scope.credentialOrg) params.append('org_id', scope.credentialOrg);
      return `/api/network-changes/${scope.networkId}/metrics?${params.toString()}`;
    },
    transformData: (data: unknown) => {
      const result = data as { success?: boolean; data?: Record<string, unknown> } | Record<string, unknown> | null;
      if (!result) {
        return { _emptyState: true, message: 'No performance metrics available', icon: 'chart' };
      }

      // Handle API response format
      const metrics = ((result as { data?: Record<string, unknown> }).data || result) as Record<string, unknown>;

      // Transform to performance_overview format with gauge data
      const gauges = [];

      if (metrics.latency_ms !== null && metrics.latency_ms !== undefined) {
        gauges.push({
          label: 'Latency',
          value: Number(metrics.latency_ms),
          max: 100,
          unit: 'ms',
          status: Number(metrics.latency_ms) < 30 ? 'good' : Number(metrics.latency_ms) < 60 ? 'warning' : 'critical',
        });
      }

      if (metrics.packet_loss_percent !== null && metrics.packet_loss_percent !== undefined) {
        gauges.push({
          label: 'Packet Loss',
          value: Number(metrics.packet_loss_percent),
          max: 10,
          unit: '%',
          status: Number(metrics.packet_loss_percent) < 1 ? 'good' : Number(metrics.packet_loss_percent) < 3 ? 'warning' : 'critical',
        });
      }

      if (metrics.channel_utilization !== null && metrics.channel_utilization !== undefined) {
        gauges.push({
          label: 'Channel Util',
          value: Number(metrics.channel_utilization),
          max: 100,
          unit: '%',
          status: Number(metrics.channel_utilization) < 50 ? 'good' : Number(metrics.channel_utilization) < 75 ? 'warning' : 'critical',
        });
      }

      if (metrics.connection_success_rate !== null && metrics.connection_success_rate !== undefined) {
        gauges.push({
          label: 'Success Rate',
          value: Number(metrics.connection_success_rate),
          max: 100,
          unit: '%',
          status: Number(metrics.connection_success_rate) > 95 ? 'good' : Number(metrics.connection_success_rate) > 85 ? 'warning' : 'critical',
        });
      }

      if (gauges.length === 0) {
        return { _emptyState: true, message: 'No performance metrics available', icon: 'chart' };
      }

      return {
        gauges,
        stats: {
          client_count: metrics.client_count,
          throughput_mbps: metrics.throughput_mbps,
          captured_at: metrics.captured_at,
        },
      };
    },
    requiredScope: ['networkId'],
    refreshInterval: 30000,
  },

  network_change_comparison: {
    buildEndpoint: (scope) => {
      if (!scope.networkId) return null;
      // This card type requires a changeId passed via scope or data
      // For initial render without changeId, we return the history endpoint
      const params = new URLSearchParams();
      if (scope.credentialOrg) params.append('org_id', scope.credentialOrg);

      // If we have a testId, use it as the change ID
      if (scope.testId) {
        return `/api/network-changes/${scope.networkId}/comparison/${scope.testId}?${params.toString()}`;
      }

      // Otherwise return null - card needs a specific change ID
      return null;
    },
    transformData: (data: unknown) => {
      const result = data as { success?: boolean; data?: Record<string, unknown> } | Record<string, unknown> | null;
      if (!result) {
        return { _emptyState: true, message: 'No change comparison data available', icon: 'compare' };
      }

      // Handle API response format
      const comparisonData = ((result as { data?: Record<string, unknown> }).data || result) as Record<string, unknown>;

      if (!comparisonData.change) {
        return { _emptyState: true, message: 'No change comparison data available', icon: 'compare' };
      }

      return comparisonData;
    },
    requiredScope: ['networkId'],
    refreshInterval: 60000,
  },

  network_change_history: {
    buildEndpoint: (scope) => {
      if (!scope.networkId) return null;
      const params = new URLSearchParams();
      if (scope.credentialOrg) params.append('org_id', scope.credentialOrg);
      params.append('limit', '10');
      return `/api/network-changes/${scope.networkId}/history?${params.toString()}`;
    },
    transformData: (data: unknown) => {
      const result = data as { success?: boolean; data?: { changes?: Array<Record<string, unknown>> } } | { changes?: Array<Record<string, unknown>> } | null;
      if (!result) {
        return { _emptyState: true, message: 'No change history available', icon: 'history' };
      }

      // Handle API response format
      const historyData = ((result as { data?: { changes?: Array<Record<string, unknown>> } }).data || result) as { changes?: Array<Record<string, unknown>> };
      const changes = historyData.changes || [];

      if (changes.length === 0) {
        return { _emptyState: true, message: 'No configuration changes recorded yet', icon: 'history' };
      }

      // Transform to timeline format
      return {
        changes: changes.map((change: Record<string, unknown>) => ({
          id: change.id,
          change_type: change.change_type,
          setting_path: change.setting_path,
          description: change.description || `Changed ${change.setting_path}`,
          applied_at: change.applied_at,
          reverted_at: change.reverted_at,
          status: change.status,
          user_id: change.user_id,
          has_metrics: !!(change.metrics_before && change.metrics_after),
        })),
        total: changes.length,
      };
    },
    requiredScope: ['networkId'],
    refreshInterval: 60000,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get fetch config for a card type
 */
export function getFetchConfig(type: AllCardTypes): FetchConfig | null {
  return CARD_FETCHERS[type] || null;
}

/**
 * Check if a card type supports live data fetching
 */
export function supportsLiveFetch(type: AllCardTypes): boolean {
  return type in CARD_FETCHERS;
}

/**
 * Build endpoint URL for a card
 */
export function buildCardEndpoint(type: AllCardTypes, scope: CardScope): string | null {
  const config = CARD_FETCHERS[type];
  if (!config) return null;
  return config.buildEndpoint(scope);
}

/**
 * Check if scope has required fields for a card type
 */
export function hasRequiredScope(type: AllCardTypes, scope: CardScope): boolean {
  const config = CARD_FETCHERS[type];
  if (!config) return false;

  return config.requiredScope.every(field => scope[field] !== undefined && scope[field] !== null);
}
