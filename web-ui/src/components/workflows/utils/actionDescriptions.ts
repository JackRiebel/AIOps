/**
 * Action Descriptions - Human-readable descriptions for workflow actions
 * Maps technical tool names to user-friendly descriptions, icons, and risk levels.
 */

import type { RiskLevel } from '../types';

export interface ActionDescription {
  label: string;
  description: string;
  icon: string;
  category: 'remediation' | 'notification' | 'configuration' | 'diagnostic' | 'security';
  riskLevel: RiskLevel;
}

/**
 * Map of tool names to human-readable action descriptions
 */
export const ACTION_DESCRIPTIONS: Record<string, ActionDescription> = {
  // Remediation Actions
  'meraki_reboot_device': {
    label: 'Reboot Device',
    description: 'Restart the affected Meraki device',
    icon: 'RefreshCw',
    category: 'remediation',
    riskLevel: 'medium',
  },
  'meraki_disable_switch_port': {
    label: 'Disable Port',
    description: 'Disable the switch port',
    icon: 'XCircle',
    category: 'security',
    riskLevel: 'high',
  },
  'meraki_enable_switch_port': {
    label: 'Enable Port',
    description: 'Enable the switch port',
    icon: 'CheckCircle',
    category: 'remediation',
    riskLevel: 'medium',
  },
  'meraki_update_device': {
    label: 'Update Device',
    description: 'Update device configuration',
    icon: 'Settings',
    category: 'configuration',
    riskLevel: 'medium',
  },
  'meraki_blink_led': {
    label: 'Blink LED',
    description: 'Blink device LEDs for identification',
    icon: 'Lightbulb',
    category: 'diagnostic',
    riskLevel: 'low',
  },
  'meraki_ping_device': {
    label: 'Ping Device',
    description: 'Send ping to test connectivity',
    icon: 'Activity',
    category: 'diagnostic',
    riskLevel: 'low',
  },
  'catalyst_restart_interface': {
    label: 'Restart Interface',
    description: 'Restart the network interface',
    icon: 'RefreshCw',
    category: 'remediation',
    riskLevel: 'medium',
  },
  'catalyst_clear_arp': {
    label: 'Clear ARP',
    description: 'Clear ARP cache on the device',
    icon: 'Trash2',
    category: 'remediation',
    riskLevel: 'low',
  },

  // Notification Actions
  'slack_notify': {
    label: 'Slack Notification',
    description: 'Send alert to Slack channel',
    icon: 'MessageSquare',
    category: 'notification',
    riskLevel: 'low',
  },
  'email_notify': {
    label: 'Email Notification',
    description: 'Send email alert',
    icon: 'Mail',
    category: 'notification',
    riskLevel: 'low',
  },
  'teams_notify': {
    label: 'Teams Notification',
    description: 'Send alert to Microsoft Teams',
    icon: 'MessageCircle',
    category: 'notification',
    riskLevel: 'low',
  },
  'pagerduty_trigger': {
    label: 'PagerDuty Alert',
    description: 'Trigger PagerDuty incident',
    icon: 'AlertTriangle',
    category: 'notification',
    riskLevel: 'low',
  },
  'webhook_notify': {
    label: 'Webhook',
    description: 'Send HTTP webhook notification',
    icon: 'Send',
    category: 'notification',
    riskLevel: 'low',
  },

  // Configuration Actions
  'meraki_create_vlan': {
    label: 'Create VLAN',
    description: 'Create a new VLAN',
    icon: 'Plus',
    category: 'configuration',
    riskLevel: 'medium',
  },
  'meraki_update_vlan': {
    label: 'Update VLAN',
    description: 'Modify VLAN configuration',
    icon: 'Edit2',
    category: 'configuration',
    riskLevel: 'medium',
  },
  'meraki_update_firewall_rules': {
    label: 'Update Firewall',
    description: 'Modify firewall rules',
    icon: 'Shield',
    category: 'security',
    riskLevel: 'high',
  },
  'meraki_update_ssid': {
    label: 'Update SSID',
    description: 'Modify wireless SSID settings',
    icon: 'Wifi',
    category: 'configuration',
    riskLevel: 'medium',
  },

  // Incident Management
  'create_incident': {
    label: 'Create Incident',
    description: 'Create incident ticket',
    icon: 'AlertCircle',
    category: 'notification',
    riskLevel: 'low',
  },
  'update_incident': {
    label: 'Update Incident',
    description: 'Update incident status',
    icon: 'Edit',
    category: 'notification',
    riskLevel: 'low',
  },
  'close_incident': {
    label: 'Close Incident',
    description: 'Close the incident ticket',
    icon: 'CheckCircle2',
    category: 'notification',
    riskLevel: 'low',
  },

  // Security Actions
  'quarantine_client': {
    label: 'Quarantine Client',
    description: 'Isolate the client from network',
    icon: 'Lock',
    category: 'security',
    riskLevel: 'high',
  },
  'block_mac_address': {
    label: 'Block MAC',
    description: 'Block MAC address on network',
    icon: 'Ban',
    category: 'security',
    riskLevel: 'high',
  },
  'revoke_client': {
    label: 'Revoke Client',
    description: 'Revoke client access',
    icon: 'UserX',
    category: 'security',
    riskLevel: 'high',
  },
};

/**
 * Get action description with fallback for unknown tools
 */
export function getActionDescription(toolName: string): ActionDescription {
  if (ACTION_DESCRIPTIONS[toolName]) {
    return ACTION_DESCRIPTIONS[toolName];
  }

  // Generate default description from tool name
  const label = toolName
    .replace(/_/g, ' ')
    .replace(/^meraki |^catalyst |^thousandeyes /i, '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    label,
    description: `Execute ${label.toLowerCase()}`,
    icon: 'Wrench',
    category: 'remediation',
    riskLevel: 'medium',
  };
}

/**
 * Check if an action is a notification type
 */
export function isNotificationAction(toolName: string): boolean {
  const desc = ACTION_DESCRIPTIONS[toolName];
  return desc?.category === 'notification' ||
    toolName.includes('notify') ||
    toolName.includes('email') ||
    toolName.includes('slack') ||
    toolName.includes('teams') ||
    toolName.includes('webhook');
}

/**
 * Get risk level color class
 */
export function getRiskLevelColor(riskLevel: RiskLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (riskLevel) {
    case 'low':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
      };
    case 'medium':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
      };
    case 'high':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
      };
    default:
      return {
        bg: 'bg-slate-50 dark:bg-slate-900/20',
        text: 'text-slate-700 dark:text-slate-400',
        border: 'border-slate-200 dark:border-slate-800',
      };
  }
}
