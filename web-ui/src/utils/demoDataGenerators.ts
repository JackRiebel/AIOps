/**
 * Demo Data Generators
 *
 * Centralized utility functions for generating realistic mock data
 * for card components when demo mode is enabled.
 */

// ============================================================================
// Time Series Data
// ============================================================================

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface BandwidthPoint {
  timestamp: string;
  sent: number;
  recv: number;
}

/**
 * Generate time series data with natural variation
 */
export function generateTimeSeriesData(
  hours: number,
  baseValue: number,
  variance: number,
  options: {
    interval?: 'hour' | 'minute' | '5min' | '15min';
    trend?: 'up' | 'down' | 'stable' | 'wave';
    spikes?: boolean;
  } = {}
): TimeSeriesPoint[] {
  const { interval = 'hour', trend = 'stable', spikes = false } = options;
  const now = Date.now();

  const intervalMs = {
    hour: 3600000,
    minute: 60000,
    '5min': 300000,
    '15min': 900000,
  }[interval];

  const points = Math.ceil((hours * 3600000) / intervalMs);
  const data: TimeSeriesPoint[] = [];

  for (let i = 0; i < points; i++) {
    const timestamp = new Date(now - (points - 1 - i) * intervalMs).toISOString();

    // Calculate trend factor
    let trendFactor = 0;
    if (trend === 'up') trendFactor = (i / points) * variance * 0.5;
    if (trend === 'down') trendFactor = -((i / points) * variance * 0.5);
    if (trend === 'wave') trendFactor = Math.sin((i / points) * Math.PI * 2) * variance * 0.3;

    // Base value with trend
    let value = baseValue + trendFactor;

    // Add random variance
    value += (Math.random() - 0.5) * variance;

    // Add occasional spikes
    if (spikes && Math.random() < 0.05) {
      value += variance * (1 + Math.random());
    }

    data.push({
      timestamp,
      value: Math.max(0, Math.round(value * 100) / 100),
    });
  }

  return data;
}

/**
 * Generate bandwidth data with send/receive
 */
export function generateBandwidthData(
  hours: number,
  options: {
    baseLoad?: number; // Percentage 0-100
    peakHours?: number[]; // Hours with higher traffic (0-23)
  } = {}
): BandwidthPoint[] {
  const { baseLoad = 50, peakHours = [9, 10, 11, 14, 15, 16] } = options;
  const now = Date.now();
  const data: BandwidthPoint[] = [];

  for (let i = 0; i < hours; i++) {
    const timestamp = new Date(now - (hours - 1 - i) * 3600000);
    const hour = timestamp.getHours();

    // Increase load during peak hours
    const isPeak = peakHours.includes(hour);
    const loadMultiplier = isPeak ? 1.5 + Math.random() * 0.5 : 1;

    const load = baseLoad * loadMultiplier + Math.sin(i / 3) * 20;

    data.push({
      timestamp: timestamp.toISOString(),
      sent: Math.round((load + Math.random() * 15) * 1000000), // bytes
      recv: Math.round((load * 1.5 + Math.random() * 20) * 1000000),
    });
  }

  return data;
}

// ============================================================================
// Network Devices
// ============================================================================

export type DeviceStatus = 'online' | 'offline' | 'alerting' | 'dormant';
export type DeviceType = 'switch' | 'router' | 'access_point' | 'firewall' | 'camera';

export interface MockDevice {
  serial: string;
  name: string;
  model: string;
  type: DeviceType;
  status: DeviceStatus;
  lastSeen: string;
  ipAddress: string;
  mac: string;
  uptime?: number; // seconds
  firmware?: string;
}

const DEVICE_MODELS: Record<DeviceType, string[]> = {
  switch: ['MS120-8', 'MS120-24', 'MS225-48', 'MS350-24X', 'MS425-32'],
  router: ['MX64', 'MX67', 'MX84', 'MX100', 'MX250'],
  access_point: ['MR33', 'MR42', 'MR46', 'MR56', 'MR76'],
  firewall: ['MX84', 'MX100', 'MX250', 'MX450'],
  camera: ['MV12', 'MV22', 'MV32', 'MV72'],
};

const DEVICE_NAMES: Record<DeviceType, string[]> = {
  switch: ['Core-SW', 'Access-SW', 'Distribution-SW', 'Floor-SW', 'Server-SW'],
  router: ['Edge-Router', 'Branch-Router', 'Core-Router', 'WAN-Router'],
  access_point: ['Lobby-AP', 'Office-AP', 'Conference-AP', 'Floor-AP', 'Warehouse-AP'],
  firewall: ['Perimeter-FW', 'Internal-FW', 'DMZ-FW'],
  camera: ['Entrance-Cam', 'Parking-Cam', 'Lobby-Cam', 'Server-Room-Cam'],
};

/**
 * Generate random MAC address
 */
function generateMac(): string {
  const hex = '0123456789ABCDEF';
  let mac = '';
  for (let i = 0; i < 6; i++) {
    mac += hex[Math.floor(Math.random() * 16)];
    mac += hex[Math.floor(Math.random() * 16)];
    if (i < 5) mac += ':';
  }
  return mac;
}

/**
 * Generate random IP address
 */
function generateIp(subnet = '10.0'): string {
  return `${subnet}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
}

/**
 * Generate random serial number
 */
function generateSerial(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let serial = 'Q2';
  for (let i = 0; i < 10; i++) {
    serial += chars[Math.floor(Math.random() * chars.length)];
  }
  return serial;
}

/**
 * Generate mock network devices
 */
export function generateNetworkDevices(
  count: number,
  options: {
    types?: DeviceType[];
    statusDistribution?: Partial<Record<DeviceStatus, number>>; // percentages
  } = {}
): MockDevice[] {
  const {
    types = ['switch', 'router', 'access_point'],
    statusDistribution = { online: 85, alerting: 10, offline: 3, dormant: 2 },
  } = options;

  const devices: MockDevice[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const models = DEVICE_MODELS[type];
    const names = DEVICE_NAMES[type];

    // Determine status based on distribution
    const rand = Math.random() * 100;
    let status: DeviceStatus = 'online';
    let cumulative = 0;
    for (const [s, pct] of Object.entries(statusDistribution)) {
      cumulative += pct || 0;
      if (rand < cumulative) {
        status = s as DeviceStatus;
        break;
      }
    }

    devices.push({
      serial: generateSerial(),
      name: `${names[Math.floor(Math.random() * names.length)]}-${i + 1}`,
      model: models[Math.floor(Math.random() * models.length)],
      type,
      status,
      lastSeen: new Date(now - Math.random() * 3600000).toISOString(),
      ipAddress: generateIp(),
      mac: generateMac(),
      uptime: status === 'online' ? Math.floor(Math.random() * 30 * 24 * 3600) : 0,
      firmware: `${type.charAt(0).toUpperCase()}S ${14 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 50)}`,
    });
  }

  return devices;
}

// ============================================================================
// Security Events
// ============================================================================

export type EventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type EventCategory = 'intrusion' | 'malware' | 'policy' | 'authentication' | 'network';

export interface MockSecurityEvent {
  id: string;
  timestamp: string;
  severity: EventSeverity;
  category: EventCategory;
  title: string;
  description: string;
  sourceIp?: string;
  destinationIp?: string;
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved';
  count: number;
}

const SECURITY_EVENTS: Record<EventCategory, { title: string; description: string }[]> = {
  intrusion: [
    { title: 'Port Scan Detected', description: 'Multiple port scan attempts from external IP' },
    { title: 'Brute Force Attack', description: 'Repeated failed login attempts detected' },
    { title: 'SQL Injection Attempt', description: 'Suspicious SQL patterns in HTTP requests' },
    { title: 'DDoS Attack Pattern', description: 'Unusual traffic volume from multiple sources' },
  ],
  malware: [
    { title: 'Malware Communication', description: 'Device communicating with known C2 server' },
    { title: 'Suspicious Download', description: 'Executable downloaded from untrusted source' },
    { title: 'Ransomware Activity', description: 'File encryption patterns detected' },
  ],
  policy: [
    { title: 'Policy Violation', description: 'User accessed restricted resource' },
    { title: 'Data Exfiltration Risk', description: 'Large data transfer to external destination' },
    { title: 'Unauthorized Application', description: 'Blocked application execution attempt' },
  ],
  authentication: [
    { title: 'Failed Login Attempts', description: 'Multiple failed authentication attempts' },
    { title: 'Account Lockout', description: 'User account locked due to failed attempts' },
    { title: 'Unusual Login Location', description: 'Login from unexpected geographic location' },
  ],
  network: [
    { title: 'ARP Spoofing Detected', description: 'Possible man-in-the-middle attack' },
    { title: 'DNS Tunneling', description: 'Suspicious DNS query patterns detected' },
    { title: 'Rogue DHCP Server', description: 'Unauthorized DHCP server on network' },
  ],
};

/**
 * Generate mock security events
 */
export function generateSecurityEvents(
  count: number,
  options: {
    severityDistribution?: Partial<Record<EventSeverity, number>>;
    hoursBack?: number;
  } = {}
): MockSecurityEvent[] {
  const {
    severityDistribution = { critical: 5, high: 15, medium: 35, low: 30, info: 15 },
    hoursBack = 24,
  } = options;

  const events: MockSecurityEvent[] = [];
  const now = Date.now();
  const categories = Object.keys(SECURITY_EVENTS) as EventCategory[];

  for (let i = 0; i < count; i++) {
    // Determine severity
    const rand = Math.random() * 100;
    let severity: EventSeverity = 'medium';
    let cumulative = 0;
    for (const [s, pct] of Object.entries(severityDistribution)) {
      cumulative += pct || 0;
      if (rand < cumulative) {
        severity = s as EventSeverity;
        break;
      }
    }

    const category = categories[Math.floor(Math.random() * categories.length)];
    const eventTemplates = SECURITY_EVENTS[category];
    const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];

    const statuses: MockSecurityEvent['status'][] = ['new', 'acknowledged', 'investigating', 'resolved'];
    const statusWeights = [0.4, 0.25, 0.2, 0.15];
    const statusRand = Math.random();
    let status: MockSecurityEvent['status'] = 'new';
    let statusCum = 0;
    for (let j = 0; j < statuses.length; j++) {
      statusCum += statusWeights[j];
      if (statusRand < statusCum) {
        status = statuses[j];
        break;
      }
    }

    events.push({
      id: `evt-${Date.now()}-${i}`,
      timestamp: new Date(now - Math.random() * hoursBack * 3600000).toISOString(),
      severity,
      category,
      title: template.title,
      description: template.description,
      sourceIp: Math.random() > 0.3 ? generateIp('192.168') : undefined,
      destinationIp: Math.random() > 0.5 ? generateIp('10.0') : undefined,
      status,
      count: Math.floor(Math.random() * 50) + 1,
    });
  }

  // Sort by timestamp descending
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ============================================================================
// Wireless Metrics
// ============================================================================

export interface MockAccessPoint {
  name: string;
  serial: string;
  model: string;
  status: 'online' | 'offline' | 'alerting';
  clientCount: number;
  channel24: number;
  channel5: number;
  rssi: number; // average client RSSI
  utilization: number; // percentage
  interference: 'none' | 'low' | 'medium' | 'high';
}

export interface MockSSID {
  number: number;
  name: string;
  enabled: boolean;
  clientCount: number;
  band: '2.4GHz' | '5GHz' | 'dual';
  security: 'open' | 'wpa2' | 'wpa3';
}

/**
 * Generate mock access point data
 */
export function generateAccessPoints(count: number): MockAccessPoint[] {
  const aps: MockAccessPoint[] = [];
  const locations = ['Lobby', 'Office', 'Conference', 'Warehouse', 'Cafeteria', 'Floor'];
  const models = ['MR33', 'MR42', 'MR46', 'MR56', 'MR76'];

  for (let i = 0; i < count; i++) {
    const location = locations[Math.floor(Math.random() * locations.length)];
    const statusRand = Math.random();
    const status = statusRand < 0.9 ? 'online' : statusRand < 0.97 ? 'alerting' : 'offline';

    aps.push({
      name: `${location}-AP-${i + 1}`,
      serial: generateSerial(),
      model: models[Math.floor(Math.random() * models.length)],
      status,
      clientCount: status === 'online' ? Math.floor(Math.random() * 50) : 0,
      channel24: [1, 6, 11][Math.floor(Math.random() * 3)],
      channel5: [36, 40, 44, 48, 149, 153, 157, 161][Math.floor(Math.random() * 8)],
      rssi: -45 - Math.floor(Math.random() * 40), // -45 to -85 dBm
      utilization: Math.floor(Math.random() * 80),
      interference: (['none', 'low', 'medium', 'high'] as const)[Math.floor(Math.random() * 4)],
    });
  }

  return aps;
}

/**
 * Generate mock SSID data
 */
export function generateSSIDs(count: number = 4): MockSSID[] {
  const ssidNames = ['Corporate', 'Guest', 'IoT', 'Admin', 'Conference', 'Secure'];
  const ssids: MockSSID[] = [];

  for (let i = 0; i < count; i++) {
    ssids.push({
      number: i,
      name: ssidNames[i] || `SSID-${i}`,
      enabled: Math.random() > 0.2,
      clientCount: Math.floor(Math.random() * 100),
      band: (['2.4GHz', '5GHz', 'dual'] as const)[Math.floor(Math.random() * 3)],
      security: (['open', 'wpa2', 'wpa3'] as const)[Math.floor(Math.random() * 3)],
    });
  }

  return ssids;
}

// ============================================================================
// Incidents
// ============================================================================

export type IncidentPriority = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';

export interface MockIncident {
  id: string;
  title: string;
  description: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  assignee?: string;
  affectedDevices: number;
  relatedAlerts: number;
}

const INCIDENT_TITLES = [
  'Network Connectivity Issues',
  'High CPU Utilization on Core Switch',
  'Wireless Coverage Degradation',
  'Security Policy Violations',
  'DHCP Pool Exhaustion',
  'WAN Link Saturation',
  'Authentication Service Degradation',
  'DNS Resolution Failures',
];

const ASSIGNEES = ['John Smith', 'Jane Doe', 'Bob Wilson', 'Alice Brown', 'Charlie Davis'];

/**
 * Generate mock incidents
 */
export function generateIncidents(
  count: number,
  options: {
    priorityDistribution?: Partial<Record<IncidentPriority, number>>;
    statusDistribution?: Partial<Record<IncidentStatus, number>>;
  } = {}
): MockIncident[] {
  const {
    priorityDistribution = { critical: 10, high: 25, medium: 40, low: 25 },
    statusDistribution = { open: 30, investigating: 25, identified: 20, monitoring: 15, resolved: 10 },
  } = options;

  const incidents: MockIncident[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    // Determine priority
    let priority: IncidentPriority = 'medium';
    let cumulative = 0;
    const priorityRand = Math.random() * 100;
    for (const [p, pct] of Object.entries(priorityDistribution)) {
      cumulative += pct || 0;
      if (priorityRand < cumulative) {
        priority = p as IncidentPriority;
        break;
      }
    }

    // Determine status
    let status: IncidentStatus = 'open';
    cumulative = 0;
    const statusRand = Math.random() * 100;
    for (const [s, pct] of Object.entries(statusDistribution)) {
      cumulative += pct || 0;
      if (statusRand < cumulative) {
        status = s as IncidentStatus;
        break;
      }
    }

    const createdAt = new Date(now - Math.random() * 7 * 24 * 3600000);
    const updatedAt = new Date(createdAt.getTime() + Math.random() * (now - createdAt.getTime()));

    incidents.push({
      id: `INC-${String(1000 + i).padStart(4, '0')}`,
      title: INCIDENT_TITLES[Math.floor(Math.random() * INCIDENT_TITLES.length)],
      description: 'Auto-generated incident for demo purposes',
      priority,
      status,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      assignee: Math.random() > 0.3 ? ASSIGNEES[Math.floor(Math.random() * ASSIGNEES.length)] : undefined,
      affectedDevices: Math.floor(Math.random() * 20) + 1,
      relatedAlerts: Math.floor(Math.random() * 15),
    });
  }

  // Sort by priority (critical first) then by createdAt
  const priorityOrder: Record<IncidentPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return incidents.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ============================================================================
// Traffic Data
// ============================================================================

export interface MockTopTalker {
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  port: number;
  bytesIn: number;
  bytesOut: number;
  packets: number;
  application?: string;
  isAnomaly?: boolean;
}

export interface MockApplication {
  id: string;
  name: string;
  category: string;
  bytesIn: number;
  bytesOut: number;
  sessions: number;
  blocked: boolean;
}

/**
 * Generate mock top talkers data
 */
export function generateTopTalkers(count: number): MockTopTalker[] {
  const protocols = ['TCP', 'UDP', 'ICMP'];
  const apps = ['Microsoft 365', 'Zoom', 'Slack', 'Google Workspace', 'Salesforce', 'AWS', 'Azure'];
  const talkers: MockTopTalker[] = [];

  for (let i = 0; i < count; i++) {
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const bytes = Math.floor(Math.random() * 1000000000);

    talkers.push({
      sourceIp: generateIp('192.168'),
      destinationIp: generateIp('10.0'),
      protocol,
      port: [80, 443, 22, 3389, 8080, 3306, 5432][Math.floor(Math.random() * 7)],
      bytesIn: bytes,
      bytesOut: Math.floor(bytes * (0.3 + Math.random() * 0.7)),
      packets: Math.floor(bytes / (500 + Math.random() * 1000)),
      application: Math.random() > 0.3 ? apps[Math.floor(Math.random() * apps.length)] : undefined,
      isAnomaly: Math.random() < 0.1,
    });
  }

  // Sort by total bytes descending
  return talkers.sort((a, b) => (b.bytesIn + b.bytesOut) - (a.bytesIn + a.bytesOut));
}

/**
 * Generate mock application usage data
 */
export function generateApplicationUsage(count: number = 10): MockApplication[] {
  const apps = [
    { name: 'Microsoft 365', category: 'Productivity' },
    { name: 'Zoom', category: 'Video Conferencing' },
    { name: 'Slack', category: 'Collaboration' },
    { name: 'Salesforce', category: 'CRM' },
    { name: 'Google Workspace', category: 'Productivity' },
    { name: 'AWS', category: 'Cloud' },
    { name: 'Azure', category: 'Cloud' },
    { name: 'Dropbox', category: 'File Sharing' },
    { name: 'YouTube', category: 'Streaming' },
    { name: 'Netflix', category: 'Streaming' },
    { name: 'Spotify', category: 'Streaming' },
    { name: 'GitHub', category: 'Development' },
  ];

  const result: MockApplication[] = [];

  for (let i = 0; i < Math.min(count, apps.length); i++) {
    const app = apps[i];
    const bytes = Math.floor(Math.random() * 10000000000);

    result.push({
      id: `app-${i}`,
      name: app.name,
      category: app.category,
      bytesIn: bytes,
      bytesOut: Math.floor(bytes * (0.2 + Math.random() * 0.5)),
      sessions: Math.floor(Math.random() * 1000) + 10,
      blocked: Math.random() < 0.05,
    });
  }

  // Sort by total bytes descending
  return result.sort((a, b) => (b.bytesIn + b.bytesOut) - (a.bytesIn + a.bytesOut));
}

// ============================================================================
// Compliance
// ============================================================================

export type ComplianceStatus = 'pass' | 'fail' | 'warning' | 'not-applicable';

export interface MockComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  status: ComplianceStatus;
  remediation?: string;
  lastChecked: string;
}

/**
 * Generate mock compliance checks
 */
export function generateComplianceChecks(): MockComplianceCheck[] {
  const now = Date.now();

  const checks: Omit<MockComplianceCheck, 'description' | 'lastChecked'>[] = [
    { id: 'cc-001', name: 'Enforce MFA for all users', category: 'Access Control', status: 'pass' as const },
    { id: 'cc-002', name: 'Network segmentation', category: 'Network Security', status: 'pass' as const },
    { id: 'cc-003', name: 'Encrypt data at rest', category: 'Data Protection', status: 'pass' as const },
    { id: 'cc-004', name: 'Firewall rules review', category: 'Network Security', status: 'warning' as const, remediation: 'Review and update firewall rules quarterly' },
    { id: 'cc-005', name: 'Intrusion detection enabled', category: 'Threat Detection', status: 'pass' as const },
    { id: 'cc-006', name: 'Patch management', category: 'Vulnerability Management', status: 'fail' as const, remediation: '15 devices have critical patches pending' },
    { id: 'cc-007', name: 'Log retention policy', category: 'Audit & Logging', status: 'pass' as const },
    { id: 'cc-008', name: 'Password complexity', category: 'Access Control', status: 'pass' as const },
    { id: 'cc-009', name: 'Wireless security standards', category: 'Wireless Security', status: 'warning' as const, remediation: 'Upgrade to WPA3 on legacy APs' },
    { id: 'cc-010', name: 'Device inventory accuracy', category: 'Asset Management', status: 'pass' as const },
    { id: 'cc-011', name: 'Backup verification', category: 'Data Protection', status: 'pass' as const },
    { id: 'cc-012', name: 'Endpoint protection', category: 'Endpoint Security', status: 'fail' as const, remediation: '3 endpoints missing antivirus' },
  ];

  return checks.map((check) => ({
    ...check,
    description: `Verify ${check.name.toLowerCase()} compliance`,
    lastChecked: new Date(now - Math.random() * 24 * 3600000).toISOString(),
  }));
}

// ============================================================================
// VLAN Data
// ============================================================================

export interface MockVLAN {
  id: number;
  name: string;
  subnet: string;
  deviceCount: number;
  clientCount: number;
  utilization: number;
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * Generate mock VLAN data
 */
export function generateVLANs(count: number = 8): MockVLAN[] {
  const vlanNames = ['Management', 'Users', 'Servers', 'IoT', 'Guest', 'Voice', 'Security', 'DMZ'];
  const vlans: MockVLAN[] = [];

  for (let i = 0; i < count; i++) {
    const utilization = Math.floor(Math.random() * 100);
    const status = utilization > 90 ? 'critical' : utilization > 75 ? 'warning' : 'healthy';

    vlans.push({
      id: (i + 1) * 10,
      name: vlanNames[i] || `VLAN-${(i + 1) * 10}`,
      subnet: `10.${i}.0.0/24`,
      deviceCount: Math.floor(Math.random() * 50) + 5,
      clientCount: Math.floor(Math.random() * 200) + 10,
      utilization,
      status,
    });
  }

  return vlans;
}

// ============================================================================
// Splunk/Log Data
// ============================================================================

export type LogSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface MockLogEntry {
  timestamp: string;
  severity: LogSeverity;
  source: string;
  message: string;
  count: number;
}

/**
 * Generate mock log volume data
 */
export function generateLogVolume(hours: number = 24): { timestamp: string; count: number; severity: LogSeverity }[] {
  const now = Date.now();
  const data: { timestamp: string; count: number; severity: LogSeverity }[] = [];
  const severities: LogSeverity[] = ['debug', 'info', 'warning', 'error', 'critical'];

  for (let i = 0; i < hours; i++) {
    const timestamp = new Date(now - (hours - 1 - i) * 3600000).toISOString();
    const baseCount = 1000 + Math.floor(Math.random() * 500);

    // Add entries for each severity
    data.push(
      { timestamp, severity: 'info', count: Math.floor(baseCount * 0.7) },
      { timestamp, severity: 'debug', count: Math.floor(baseCount * 0.15) },
      { timestamp, severity: 'warning', count: Math.floor(baseCount * 0.1) },
      { timestamp, severity: 'error', count: Math.floor(baseCount * 0.04) },
      { timestamp, severity: 'critical', count: Math.floor(baseCount * 0.01) }
    );
  }

  return data;
}

/**
 * Generate status distribution data
 */
export function generateStatusDistribution<T extends string>(
  total: number,
  statusTypes: T[],
  weights?: Partial<Record<T, number>>
): Record<T, number> {
  const result = {} as Record<T, number>;
  let remaining = total;

  // Calculate weighted distribution
  const defaultWeight = 100 / statusTypes.length;
  const totalWeight = statusTypes.reduce((sum, s) => sum + (weights?.[s] ?? defaultWeight), 0);

  for (let i = 0; i < statusTypes.length; i++) {
    const status = statusTypes[i];
    const weight = weights?.[status] ?? defaultWeight;

    if (i === statusTypes.length - 1) {
      result[status] = remaining;
    } else {
      const count = Math.round((total * weight) / totalWeight);
      result[status] = Math.min(count, remaining);
      remaining -= result[status];
    }
  }

  return result;
}
