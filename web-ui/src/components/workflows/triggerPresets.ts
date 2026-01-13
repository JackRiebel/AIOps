/**
 * Trigger and Action Presets - Human-readable configurations for Simple Mode
 *
 * These presets map friendly labels to technical configurations,
 * allowing users to create workflows without Splunk/cron knowledge.
 */

import { TriggerType } from './types';

// ============================================================================
// Trigger Presets
// ============================================================================

export interface TriggerPreset {
  id: string;
  label: string;
  icon: string;
  type: TriggerType;
  description: string;
  // For Splunk triggers
  query?: string;
  // For schedule triggers
  cron?: string;
  cronDescription?: string;
  // Configurable threshold (optional)
  configurable?: {
    field: string;
    label: string;
    default: number;
    unit: string;
    min?: number;
    max?: number;
  };
}

export const TRIGGER_PRESETS: TriggerPreset[] = [
  // Device & Connectivity
  {
    id: 'device_offline',
    label: 'A device goes offline',
    icon: 'WifiOff',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:events type="device_offline" OR status="offline"',
    description: 'Triggers when any network device becomes unreachable',
  },
  {
    id: 'high_latency',
    label: 'Network latency exceeds threshold',
    icon: 'Activity',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:performance latency_ms>{threshold}',
    description: 'Triggers when latency exceeds the configured threshold',
    configurable: {
      field: 'threshold',
      label: 'Latency threshold',
      default: 100,
      unit: 'ms',
      min: 10,
      max: 5000,
    },
  },
  {
    id: 'high_bandwidth',
    label: 'Bandwidth exceeds threshold',
    icon: 'Gauge',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:performance bandwidth_mbps>{threshold}',
    description: 'Triggers when bandwidth usage exceeds threshold',
    configurable: {
      field: 'threshold',
      label: 'Bandwidth threshold',
      default: 80,
      unit: '%',
      min: 50,
      max: 100,
    },
  },
  {
    id: 'uplink_down',
    label: 'Uplink goes down',
    icon: 'Plug',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:events type="uplink" status="failed"',
    description: 'Triggers when a WAN uplink fails',
  },
  {
    id: 'port_flapping',
    label: 'Port flapping detected',
    icon: 'Radio',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:events type="port_flap"',
    description: 'Triggers when a switch port repeatedly changes state',
  },

  // Security
  {
    id: 'security_event',
    label: 'A security event is detected',
    icon: 'Shield',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:security (type="ids_alert" OR type="malware" OR type="firewall_block")',
    description: 'Triggers on firewall blocks, IDS alerts, or malware detection',
  },
  {
    id: 'client_vpn_failure',
    label: 'VPN connection fails',
    icon: 'Lock',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:events type="vpn" status="failed"',
    description: 'Triggers when a VPN connection attempt fails',
  },
  {
    id: 'rogue_ap_detected',
    label: 'Rogue AP detected',
    icon: 'Radio',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:security type="rogue_ap"',
    description: 'Triggers when an unauthorized access point is detected',
  },
  {
    id: 'new_client_connected',
    label: 'New client connects',
    icon: 'Network',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:clients type="new_client"',
    description: 'Triggers when a new device joins the network',
  },

  // Firmware
  {
    id: 'firmware_update',
    label: 'New firmware available',
    icon: 'Download',
    type: 'splunk_query',
    query: 'index=meraki sourcetype=meraki:firmware status="available"',
    description: 'Triggers when new firmware is available for devices',
  },

  // Scheduled
  {
    id: 'schedule_hourly',
    label: 'Every hour',
    icon: 'Clock',
    type: 'schedule',
    cron: '0 * * * *',
    cronDescription: 'Runs at the start of every hour',
    description: 'Scheduled to run every hour',
  },
  {
    id: 'schedule_daily',
    label: 'Once daily (6 AM)',
    icon: 'Calendar',
    type: 'schedule',
    cron: '0 6 * * *',
    cronDescription: 'Runs every day at 6:00 AM',
    description: 'Scheduled to run once per day at 6 AM',
  },
  {
    id: 'schedule_weekly',
    label: 'Once weekly (Sunday midnight)',
    icon: 'CalendarDays',
    type: 'schedule',
    cron: '0 0 * * 0',
    cronDescription: 'Runs every Sunday at midnight',
    description: 'Scheduled to run once per week on Sunday',
  },

  // Manual
  {
    id: 'manual',
    label: 'Manual trigger only',
    icon: 'Play',
    type: 'manual',
    description: 'Only runs when you click the Run button',
  },
];

// ============================================================================
// Action Presets
// ============================================================================

export interface ActionPreset {
  id: string;
  label: string;
  icon: string;
  tool: string;
  requiresApproval: boolean;
  warning?: string;
  description?: string;
  params?: Record<string, unknown>;
  category: ActionCategory;
  /** Whether this action has a working backend implementation. Default is true. */
  available?: boolean;
  /** Reason why action is not available (shown in UI) */
  unavailableReason?: string;
  // Configuration options
  configurable?: {
    field: string;
    label: string;
    type: 'text' | 'select' | 'number';
    default?: string | number;
    options?: { value: string; label: string }[];
    placeholder?: string;
  }[];
}

export type ActionCategory = 'notifications' | 'remediation' | 'diagnostics' | 'documentation' | 'config';

export interface ActionCategoryInfo {
  id: ActionCategory;
  label: string;
  icon: string;
  description: string;
  defaultExpanded: boolean;
}

export const ACTION_CATEGORIES: ActionCategoryInfo[] = [
  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'Bell',
    description: 'Send alerts and messages',
    defaultExpanded: true,
  },
  {
    id: 'remediation',
    label: 'Remediation',
    icon: 'Wrench',
    description: 'Take corrective actions',
    defaultExpanded: true,
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    icon: 'Search',
    description: 'Gather information and test',
    defaultExpanded: false,
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: 'FileText',
    description: 'Log and track events',
    defaultExpanded: false,
  },
  {
    id: 'config',
    label: 'Configuration',
    icon: 'Settings',
    description: 'Firmware and config management',
    defaultExpanded: false,
  },
];

export const ACTION_PRESETS: ActionPreset[] = [
  // ===== NOTIFICATIONS =====
  {
    id: 'slack_notify',
    label: 'Send a Slack notification',
    icon: 'MessageSquare',
    tool: 'slack_notify',
    requiresApproval: false,
    category: 'notifications',
    description: 'Send a message to a Slack channel',
    params: { channel: '#network-alerts' },
    configurable: [
      {
        field: 'channel',
        label: 'Slack channel',
        type: 'text',
        default: '#network-alerts',
        placeholder: '#channel-name',
      },
    ],
  },
  {
    id: 'email_alert',
    label: 'Send an email alert',
    icon: 'Mail',
    tool: 'email_notify',
    requiresApproval: false,
    category: 'notifications',
    description: 'Send an email notification',
    params: {},
    configurable: [
      {
        field: 'recipients',
        label: 'Recipients',
        type: 'text',
        placeholder: 'email@example.com',
      },
    ],
  },
  {
    id: 'teams_notify',
    label: 'Send a Teams message',
    icon: 'Users',
    tool: 'teams_notify',
    requiresApproval: false,
    category: 'notifications',
    description: 'Post a message to Microsoft Teams',
    params: {},
  },
  {
    id: 'pagerduty_alert',
    label: 'Send PagerDuty alert',
    icon: 'AlertTriangle',
    tool: 'pagerduty_trigger',
    requiresApproval: false,
    category: 'notifications',
    description: 'Trigger a PagerDuty incident',
    configurable: [
      {
        field: 'severity',
        label: 'Severity',
        type: 'select',
        default: 'warning',
        options: [
          { value: 'info', label: 'Info' },
          { value: 'warning', label: 'Warning' },
          { value: 'error', label: 'Error' },
          { value: 'critical', label: 'Critical' },
        ],
      },
    ],
  },
  {
    id: 'webhook_post',
    label: 'Call a webhook',
    icon: 'Globe',
    tool: 'http_webhook',
    requiresApproval: false,
    category: 'notifications',
    description: 'Make an HTTP POST request to a URL',
    configurable: [
      {
        field: 'url',
        label: 'Webhook URL',
        type: 'text',
        placeholder: 'https://example.com/webhook',
      },
    ],
  },
  {
    id: 'webex_notify',
    label: 'Send a Webex message',
    icon: 'Video',
    tool: 'webex_notify',
    requiresApproval: false,
    category: 'notifications',
    description: 'Send a notification to Cisco Webex',
    configurable: [
      {
        field: 'room_id',
        label: 'Webex Room ID',
        type: 'text',
        placeholder: 'Room or space ID (optional)',
      },
    ],
  },

  // ===== REMEDIATION =====
  {
    id: 'reboot_device',
    label: 'Reboot the affected device',
    icon: 'RefreshCw',
    tool: 'meraki_reboot_device',
    requiresApproval: true,
    category: 'remediation',
    warning: 'This action requires approval before execution',
    description: 'Reboot a network device',
  },
  {
    id: 'disable_port',
    label: 'Disable switch port',
    icon: 'Power',
    tool: 'meraki_disable_switch_port',
    requiresApproval: true,
    category: 'remediation',
    warning: 'This will disconnect any device on this port',
    description: 'Disable a switch port to isolate a device',
  },
  {
    id: 'block_client',
    label: 'Block network client',
    icon: 'Ban',
    tool: 'meraki_block_client',
    requiresApproval: true,
    category: 'remediation',
    warning: 'This will block the client from the network',
    description: 'Block a client MAC address',
  },
  {
    id: 'restart_service',
    label: 'Cycle switch port',
    icon: 'RotateCcw',
    tool: 'meraki_cycle_port',
    requiresApproval: true,
    category: 'remediation',
    warning: 'This will briefly disconnect the port',
    description: 'Power cycle a switch port',
  },
  {
    id: 'failover_wan',
    label: 'Trigger WAN failover',
    icon: 'ArrowRightLeft',
    tool: 'meraki_failover',
    requiresApproval: true,
    category: 'remediation',
    warning: 'This will switch to the backup WAN connection',
    description: 'Manually trigger WAN failover',
    configurable: [
      {
        field: 'target_uplink',
        label: 'Target uplink',
        type: 'select',
        default: 'wan2',
        options: [
          { value: 'wan1', label: 'WAN 1' },
          { value: 'wan2', label: 'WAN 2' },
        ],
      },
    ],
  },
  {
    id: 'quarantine_device',
    label: 'Quarantine device',
    icon: 'ShieldOff',
    tool: 'meraki_quarantine',
    requiresApproval: true,
    category: 'remediation',
    warning: 'Device will be isolated from the network',
    description: 'Move device to quarantine VLAN',
  },

  // ===== DIAGNOSTICS =====
  {
    id: 'collect_diagnostics',
    label: 'Collect device diagnostics',
    icon: 'FileText',
    tool: 'meraki_get_device_diagnostics',
    requiresApproval: false,
    category: 'diagnostics',
    description: 'Gather diagnostic information from the device',
  },
  {
    id: 'run_speed_test',
    label: 'Run network speed test',
    icon: 'Gauge',
    tool: 'meraki_run_speed_test',
    requiresApproval: false,
    category: 'diagnostics',
    description: 'Execute a speed test from the device',
    available: false,
    unavailableReason: 'Not supported by Meraki API',
  },
  {
    id: 'ping_test',
    label: 'Run ping test',
    icon: 'Radio',
    tool: 'meraki_ping',
    requiresApproval: false,
    category: 'diagnostics',
    description: 'Ping a target from the device',
    configurable: [
      {
        field: 'target',
        label: 'Target IP/hostname',
        type: 'text',
        default: '8.8.8.8',
        placeholder: '8.8.8.8',
      },
    ],
  },
  {
    id: 'trace_route',
    label: 'Run traceroute',
    icon: 'Route',
    tool: 'meraki_traceroute',
    requiresApproval: false,
    category: 'diagnostics',
    description: 'Trace the route to a target (limited device support)',
    configurable: [
      {
        field: 'target',
        label: 'Target IP/hostname',
        type: 'text',
        default: '8.8.8.8',
        placeholder: '8.8.8.8',
      },
    ],
  },
  {
    id: 'capture_packets',
    label: 'Capture packets',
    icon: 'Database',
    tool: 'meraki_pcap',
    requiresApproval: true,
    category: 'diagnostics',
    warning: 'Packet captures may contain sensitive data',
    description: 'Capture network packets for analysis',
    available: false,
    unavailableReason: 'Limited Meraki API support',
  },

  // ===== DOCUMENTATION =====
  {
    id: 'create_incident',
    label: 'Create an incident ticket',
    icon: 'AlertCircle',
    tool: 'create_incident',
    requiresApproval: false,
    category: 'documentation',
    description: 'Create a new incident in the system',
    configurable: [
      {
        field: 'priority',
        label: 'Priority',
        type: 'select',
        default: 'medium',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' },
        ],
      },
    ],
  },
  {
    id: 'update_cmdb',
    label: 'Update CMDB record',
    icon: 'Database',
    tool: 'cmdb_update',
    requiresApproval: false,
    category: 'documentation',
    description: 'Update CMDB via webhook (ServiceNow, Freshservice, etc.)',
    configurable: [
      {
        field: 'ci_type',
        label: 'CI Type',
        type: 'select',
        default: 'network_device',
        options: [
          { value: 'network_device', label: 'Network Device' },
          { value: 'server', label: 'Server' },
          { value: 'application', label: 'Application' },
        ],
      },
      {
        field: 'action',
        label: 'Action',
        type: 'select',
        default: 'update',
        options: [
          { value: 'create', label: 'Create' },
          { value: 'update', label: 'Update' },
          { value: 'delete', label: 'Delete' },
        ],
      },
    ],
  },
  {
    id: 'log_splunk',
    label: 'Log event to Splunk',
    icon: 'FileJson',
    tool: 'splunk_log',
    requiresApproval: false,
    category: 'documentation',
    description: 'Log a custom event to Splunk',
  },
  {
    id: 'generate_report',
    label: 'Generate incident report',
    icon: 'FileBarChart',
    tool: 'generate_report',
    requiresApproval: false,
    category: 'documentation',
    description: 'Generate a detailed incident report',
  },

  // ===== CONFIGURATION =====
  {
    id: 'update_firmware',
    label: 'Schedule firmware update',
    icon: 'Download',
    tool: 'meraki_schedule_firmware',
    requiresApproval: true,
    category: 'config',
    warning: 'Firmware updates may cause brief downtime',
    description: 'Schedule a firmware update for the device',
  },
  {
    id: 'backup_config',
    label: 'Backup device config',
    icon: 'Save',
    tool: 'meraki_backup_config',
    requiresApproval: false,
    category: 'config',
    description: 'Create a backup of the device configuration',
  },
  {
    id: 'apply_template',
    label: 'Apply config template',
    icon: 'FileCode',
    tool: 'meraki_apply_template',
    requiresApproval: true,
    category: 'config',
    warning: 'This will overwrite current device settings',
    description: 'Apply a configuration template to the device',
  },
  {
    id: 'rollback_config',
    label: 'Rollback to previous config',
    icon: 'History',
    tool: 'meraki_rollback',
    requiresApproval: true,
    category: 'config',
    warning: 'This will restore the previous configuration',
    description: 'Restore device to a previous configuration',
    available: false,
    unavailableReason: 'Requires config history system',
  },
];

// ============================================================================
// Quick Start Templates (Featured on Landing Page)
// ============================================================================

export interface QuickStartTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  triggerId: string;
  actionIds: string[];
  aiEnabled: boolean;
  category: 'monitoring' | 'security' | 'maintenance' | 'custom';
}

export const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  // Monitoring
  {
    id: 'device_offline_alert',
    name: 'Device Offline Alert',
    description: 'Get notified when devices go offline',
    icon: 'WifiOff',
    color: 'red',
    triggerId: 'device_offline',
    actionIds: ['slack_notify', 'create_incident'],
    aiEnabled: true,
    category: 'monitoring',
  },
  {
    id: 'high_latency_response',
    name: 'High Latency Detection',
    description: 'Monitor and respond to network slowdowns',
    icon: 'Activity',
    color: 'amber',
    triggerId: 'high_latency',
    actionIds: ['slack_notify', 'collect_diagnostics'],
    aiEnabled: true,
    category: 'monitoring',
  },
  {
    id: 'bandwidth_threshold',
    name: 'Bandwidth Threshold Alert',
    description: 'Alert when bandwidth usage is high',
    icon: 'Gauge',
    color: 'amber',
    triggerId: 'high_bandwidth',
    actionIds: ['email_alert', 'log_splunk'],
    aiEnabled: true,
    category: 'monitoring',
  },
  {
    id: 'port_flapping_response',
    name: 'Port Flapping Response',
    description: 'Detect and respond to unstable ports',
    icon: 'Radio',
    color: 'amber',
    triggerId: 'port_flapping',
    actionIds: ['slack_notify', 'disable_port', 'create_incident'],
    aiEnabled: true,
    category: 'monitoring',
  },
  {
    id: 'uplink_failover',
    name: 'Uplink Failover Alert',
    description: 'Alert and respond to WAN failures',
    icon: 'Plug',
    color: 'red',
    triggerId: 'uplink_down',
    actionIds: ['slack_notify', 'pagerduty_alert', 'create_incident'],
    aiEnabled: true,
    category: 'monitoring',
  },

  // Security
  {
    id: 'security_audit',
    name: 'Security Event Response',
    description: 'Respond to security threats automatically',
    icon: 'Shield',
    color: 'purple',
    triggerId: 'security_event',
    actionIds: ['slack_notify', 'create_incident', 'collect_diagnostics'],
    aiEnabled: true,
    category: 'security',
  },
  {
    id: 'vpn_monitor',
    name: 'VPN Connection Monitor',
    description: 'Track and alert on VPN failures',
    icon: 'Lock',
    color: 'purple',
    triggerId: 'client_vpn_failure',
    actionIds: ['slack_notify', 'collect_diagnostics', 'create_incident'],
    aiEnabled: true,
    category: 'security',
  },
  {
    id: 'rogue_ap_detection',
    name: 'Rogue AP Detection',
    description: 'Detect and isolate unauthorized APs',
    icon: 'Radio',
    color: 'purple',
    triggerId: 'rogue_ap_detected',
    actionIds: ['slack_notify', 'quarantine_device', 'create_incident'],
    aiEnabled: true,
    category: 'security',
  },

  // Maintenance
  {
    id: 'daily_health_check',
    name: 'Daily Health Report',
    description: 'Get a daily summary of network health',
    icon: 'Calendar',
    color: 'cyan',
    triggerId: 'schedule_daily',
    actionIds: ['email_alert'],
    aiEnabled: true,
    category: 'maintenance',
  },
  {
    id: 'firmware_update_workflow',
    name: 'Firmware Update Workflow',
    description: 'Backup config and update firmware',
    icon: 'Download',
    color: 'green',
    triggerId: 'firmware_update',
    actionIds: ['email_alert', 'backup_config', 'update_firmware'],
    aiEnabled: true,
    category: 'maintenance',
  },
  {
    id: 'weekly_config_backup',
    name: 'Weekly Config Backup',
    description: 'Automatically backup configs weekly',
    icon: 'Calendar',
    color: 'green',
    triggerId: 'schedule_weekly',
    actionIds: ['backup_config', 'email_alert'],
    aiEnabled: false,
    category: 'maintenance',
  },

  // Custom
  {
    id: 'client_onboarding',
    name: 'New Client Tracking',
    description: 'Log when new clients join the network',
    icon: 'Network',
    color: 'blue',
    triggerId: 'new_client_connected',
    actionIds: ['log_splunk', 'create_incident'],
    aiEnabled: false,
    category: 'custom',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a trigger preset by ID
 */
export function getTriggerPreset(id: string): TriggerPreset | undefined {
  return TRIGGER_PRESETS.find(t => t.id === id);
}

/**
 * Get an action preset by ID
 */
export function getActionPreset(id: string): ActionPreset | undefined {
  return ACTION_PRESETS.find(a => a.id === id);
}

/**
 * Get a quick start template by ID
 */
export function getQuickStartTemplate(id: string): QuickStartTemplate | undefined {
  return QUICK_START_TEMPLATES.find(t => t.id === id);
}

/**
 * Get actions by category
 */
export function getActionsByCategory(category: ActionCategory): ActionPreset[] {
  return ACTION_PRESETS.filter(a => a.category === category);
}

/**
 * Get only available actions (filters out unavailable ones)
 */
export function getAvailableActions(): ActionPreset[] {
  return ACTION_PRESETS.filter(a => a.available !== false);
}

/**
 * Get available actions by category
 */
export function getAvailableActionsByCategory(category: ActionCategory): ActionPreset[] {
  return ACTION_PRESETS.filter(a => a.category === category && a.available !== false);
}

/**
 * Check if an action is available
 */
export function isActionAvailable(actionId: string): boolean {
  const action = getActionPreset(actionId);
  return action ? action.available !== false : false;
}

/**
 * Get category info by ID
 */
export function getActionCategoryInfo(category: ActionCategory): ActionCategoryInfo | undefined {
  return ACTION_CATEGORIES.find(c => c.id === category);
}

/**
 * Build a Splunk query from a trigger preset with configured threshold
 */
export function buildSplunkQuery(preset: TriggerPreset, configValue?: number): string {
  if (!preset.query) return '';
  if (!preset.configurable || configValue === undefined) {
    return preset.query;
  }
  return preset.query.replace(`{${preset.configurable.field}}`, String(configValue));
}

/**
 * Get icon color class for a template category
 */
export function getCategoryColor(category: QuickStartTemplate['category']): string {
  switch (category) {
    case 'monitoring':
      return 'text-cyan-500 bg-cyan-500/10';
    case 'security':
      return 'text-purple-500 bg-purple-500/10';
    case 'maintenance':
      return 'text-emerald-500 bg-emerald-500/10';
    default:
      return 'text-slate-500 bg-slate-500/10';
  }
}
