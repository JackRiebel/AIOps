/**
 * Pre-built Workflow Templates for Card Mode
 *
 * Each template contains:
 * - metadata (name, description, category, icon)
 * - nodes array with pre-configured node definitions
 * - edges array defining the flow connections
 */

import { CanvasNodeType } from '../types';

// Template node definition (simplified for serialization)
export interface TemplateNode {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

// Template edge definition
export interface TemplateEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'monitoring' | 'security' | 'operations' | 'automation' | 'integration';
  icon: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  tags: string[];
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

// Helper to generate unique IDs
let idCounter = 0;
const genId = (prefix: string) => `${prefix}-${++idCounter}`;

/**
 * Template 1: Network Health Monitor
 * Monitors network health and sends notifications when issues are detected
 */
export const networkHealthMonitorTemplate: WorkflowTemplate = {
  id: 'network-health-monitor',
  name: 'Network Health Monitor',
  description: 'Monitor network health across all networks, automatically create incidents when issues are detected',
  category: 'monitoring',
  icon: '💓',
  difficulty: 'beginner',
  estimatedTime: '5 min',
  tags: ['meraki', 'health', 'monitoring', 'alerts', 'incident'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Schedule Check',
        triggerType: 'schedule',
        schedule: '*/5 * * * *', // Every 5 minutes
        description: 'Check network health every 5 minutes',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 200 },
      data: {
        label: 'Monitor Health & Create Incident',
        actionId: 'monitor_network_health',
        actionName: 'Monitor Network Health',
        parameters: {
          organization_id: '', // Set your Meraki org ID for all networks
          create_incident: true, // Auto-create incident if alerts found
          min_severity: 'warning', // warning or critical
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 600, y: 200 },
      data: {
        label: 'Send Alert',
        notifyType: 'slack',
        channel: '#network-alerts',
        message: 'Network health issues detected: {{alerts_found}} alert(s). Incident #{{incident_id}} created.',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'action-1', target: 'notify-1' },
  ],
};

/**
 * Template 2: Security Alert Response
 * Responds to security events with AI analysis and automated actions
 */
export const securityAlertResponseTemplate: WorkflowTemplate = {
  id: 'security-alert-response',
  name: 'Security Alert Response',
  description: 'Automatically analyze and respond to security alerts using AI',
  category: 'security',
  icon: '🛡️',
  difficulty: 'intermediate',
  estimatedTime: '10 min',
  tags: ['security', 'ai', 'automation', 'splunk'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Security Event',
        triggerType: 'event',
        eventType: 'security.alert',
        description: 'Triggered by security alert events',
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 350, y: 200 },
      data: {
        label: 'AI Analysis',
        analysisType: 'security',
        prompt: 'Analyze this security alert and determine severity and recommended actions',
      },
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 600, y: 200 },
      data: {
        label: 'Severity Check',
        conditionType: 'ai',
        expression: 'severity >= "high"',
        description: 'Check if severity is high or critical',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 850, y: 150 },
      data: {
        label: 'Isolate Device',
        actionId: 'meraki.quarantine_device',
        actionName: 'Quarantine Device',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
          client_mac: '{{trigger.client_mac}}', // From trigger data
          policy: 'blocked',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Alert Security Team',
        notifyType: 'slack',
        channel: '#security-incidents',
        message: 'Security incident detected: {{ai_analysis}}',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'ai-1' },
    { id: 'e2', source: 'ai-1', target: 'condition-1' },
    { id: 'e3', source: 'condition-1', target: 'action-1', sourceHandle: 'true' },
    { id: 'e4', source: 'action-1', target: 'notify-1' },
    { id: 'e5', source: 'condition-1', target: 'notify-1', sourceHandle: 'false' },
  ],
};

/**
 * Template 3: Scheduled Backup
 * Backs up device configurations on a schedule
 */
export const scheduledBackupTemplate: WorkflowTemplate = {
  id: 'scheduled-backup',
  name: 'Scheduled Config Backup',
  description: 'Automatically backup device configurations on a schedule',
  category: 'operations',
  icon: '💾',
  difficulty: 'beginner',
  estimatedTime: '5 min',
  tags: ['backup', 'config', 'scheduled', 'meraki'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Daily Schedule',
        triggerType: 'schedule',
        schedule: '0 2 * * *', // Daily at 2 AM
        description: 'Run backup daily at 2 AM',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 200 },
      data: {
        label: 'List Devices',
        actionId: 'meraki.list_devices',
        actionName: 'List Network Devices',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
        },
      },
    },
    {
      id: 'loop-1',
      type: 'loop',
      position: { x: 600, y: 200 },
      data: {
        label: 'For Each Device',
        loopVariable: 'device',
        iterateOver: 'devices',
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 850, y: 200 },
      data: {
        label: 'Backup Config',
        actionId: 'meraki.backup_device_config',
        actionName: 'Backup Device Config',
        parameters: {
          serial: '{{device.serial}}',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Log Completion',
        notifyType: 'webhook',
        url: '/api/logs',
        message: 'Backup completed for {{devices.length}} devices',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'action-1', target: 'loop-1' },
    { id: 'e3', source: 'loop-1', target: 'action-2', sourceHandle: 'loop' },
    { id: 'e4', source: 'action-2', target: 'loop-1', sourceHandle: 'next' },
    { id: 'e5', source: 'loop-1', target: 'notify-1', sourceHandle: 'done' },
  ],
};

/**
 * Template 4: Bandwidth Alert
 * Monitors bandwidth usage and scales/alerts when thresholds are exceeded
 */
export const bandwidthAlertTemplate: WorkflowTemplate = {
  id: 'bandwidth-alert',
  name: 'Bandwidth Alert & Response',
  description: 'Monitor bandwidth usage and take action when thresholds are exceeded',
  category: 'monitoring',
  icon: '📊',
  difficulty: 'intermediate',
  estimatedTime: '8 min',
  tags: ['bandwidth', 'monitoring', 'scaling', 'meraki'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Monitor Bandwidth',
        triggerType: 'schedule',
        schedule: '*/10 * * * *', // Every 10 minutes
        description: 'Check bandwidth every 10 minutes',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 200 },
      data: {
        label: 'Get Bandwidth Stats',
        actionId: 'meraki.get_bandwidth_usage',
        actionName: 'Get Bandwidth Usage',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
        },
      },
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 600, y: 200 },
      data: {
        label: 'Check Threshold',
        conditionType: 'expression',
        expression: 'usage_percent > 90',
        description: 'Is bandwidth usage above 90%?',
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 850, y: 100 },
      data: {
        label: 'Apply QoS Policy',
        actionId: 'meraki.apply_traffic_shaping',
        actionName: 'Apply Traffic Shaping',
        parameters: {
          policy: 'high-priority-only',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1100, y: 100 },
      data: {
        label: 'Alert Network Team',
        notifyType: 'slack',
        channel: '#network-ops',
        message: 'High bandwidth usage detected: {{usage_percent}}%. QoS policy applied.',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'action-1', target: 'condition-1' },
    { id: 'e3', source: 'condition-1', target: 'action-2', sourceHandle: 'true' },
    { id: 'e4', source: 'action-2', target: 'notify-1' },
  ],
};

/**
 * Template 5: Device Onboarding
 * Automates device onboarding with configuration and verification
 */
export const deviceOnboardingTemplate: WorkflowTemplate = {
  id: 'device-onboarding',
  name: 'Automated Device Onboarding',
  description: 'Automatically configure and verify new devices when they connect',
  category: 'automation',
  icon: '🔌',
  difficulty: 'advanced',
  estimatedTime: '15 min',
  tags: ['onboarding', 'automation', 'meraki', 'provisioning'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'New Device Webhook',
        triggerType: 'webhook',
        webhookPath: '/webhooks/new-device',
        description: 'Triggered when a new device is detected',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 200 },
      data: {
        label: 'Get Device Info',
        actionId: 'meraki.get_device',
        actionName: 'Get Device Details',
        parameters: {
          serial: '{{webhook.serial}}',
        },
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 600, y: 200 },
      data: {
        label: 'Apply Base Config',
        actionId: 'meraki.update_device',
        actionName: 'Update Device',
        parameters: {
          serial: '{{device.serial}}',
          name: '{{device.model}}-{{device.serial}}',
          tags: ['auto-provisioned'],
        },
      },
    },
    {
      id: 'delay-1',
      type: 'delay',
      position: { x: 850, y: 200 },
      data: {
        label: 'Wait for Boot',
        duration: 60,
        unit: 'seconds',
        description: 'Wait for device to fully boot',
      },
    },
    {
      id: 'action-3',
      type: 'action',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Verify Connectivity',
        actionId: 'meraki.ping_device',
        actionName: 'Ping Device',
        parameters: {
          serial: '{{device.serial}}',
        },
      },
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 1350, y: 200 },
      data: {
        label: 'Ping Success?',
        conditionType: 'expression',
        expression: 'ping.success === true',
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1600, y: 150 },
      data: {
        label: 'Success Notification',
        notifyType: 'slack',
        channel: '#network-ops',
        message: 'Device {{device.name}} successfully onboarded and verified',
      },
    },
    {
      id: 'notify-2',
      type: 'notify',
      position: { x: 1600, y: 280 },
      data: {
        label: 'Failure Alert',
        notifyType: 'slack',
        channel: '#network-alerts',
        message: 'Device onboarding failed for {{device.serial}} - verification failed',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'action-1', target: 'action-2' },
    { id: 'e3', source: 'action-2', target: 'delay-1' },
    { id: 'e4', source: 'delay-1', target: 'action-3' },
    { id: 'e5', source: 'action-3', target: 'condition-1' },
    { id: 'e6', source: 'condition-1', target: 'notify-1', sourceHandle: 'true' },
    { id: 'e7', source: 'condition-1', target: 'notify-2', sourceHandle: 'false' },
  ],
};

/**
 * Template 6: VLAN Provisioning Workflow
 * Automates VLAN creation and assignment across devices
 */
export const vlanProvisioningTemplate: WorkflowTemplate = {
  id: 'vlan-provisioning',
  name: 'VLAN Provisioning',
  description: 'Automate VLAN creation and assignment across network devices',
  category: 'automation',
  icon: '🌐',
  difficulty: 'intermediate',
  estimatedTime: '10 min',
  tags: ['meraki', 'vlan', 'provisioning', 'network'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'VLAN Request',
        triggerType: 'manual',
        description: 'Triggered when VLAN provisioning is requested',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 200 },
      data: {
        label: 'Create VLAN',
        actionId: 'meraki.create_vlan',
        actionName: 'Create VLAN',
        parameters: {
          name: '{{vlan_name}}',
          subnet: '{{vlan_subnet}}',
          vlanId: '{{vlan_id}}',
        },
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 600, y: 200 },
      data: {
        label: 'Configure DHCP',
        actionId: 'meraki.update_vlan_dhcp',
        actionName: 'Update VLAN DHCP',
        parameters: {
          vlanId: '{{vlan_id}}',
          dhcpEnabled: true,
        },
      },
    },
    {
      id: 'action-3',
      type: 'action',
      position: { x: 850, y: 200 },
      data: {
        label: 'Update Switch Ports',
        actionId: 'meraki.update_switch_port',
        actionName: 'Assign VLAN to Ports',
        parameters: {
          vlan: '{{vlan_id}}',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Notify Team',
        notifyType: 'slack',
        channel: '#network-changes',
        message: 'VLAN {{vlan_name}} ({{vlan_id}}) provisioned successfully',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'action-1', target: 'action-2' },
    { id: 'e3', source: 'action-2', target: 'action-3' },
    { id: 'e4', source: 'action-3', target: 'notify-1' },
  ],
};

/**
 * Template 7: Firmware Upgrade with Rollback
 * Manages firmware upgrades with automatic rollback on failure
 */
export const firmwareUpgradeTemplate: WorkflowTemplate = {
  id: 'firmware-upgrade-rollback',
  name: 'Firmware Upgrade with Rollback',
  description: 'Safely upgrade firmware with automatic rollback on failure',
  category: 'operations',
  icon: '⬆️',
  difficulty: 'advanced',
  estimatedTime: '20 min',
  tags: ['meraki', 'firmware', 'upgrade', 'rollback'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Upgrade Request',
        triggerType: 'manual',
        description: 'Start firmware upgrade process',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 200 },
      data: {
        label: 'Backup Config',
        actionId: 'meraki.backup_device_config',
        actionName: 'Backup Device Config',
        parameters: {
          serial: '{{device_serial}}',
        },
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 600, y: 200 },
      data: {
        label: 'Schedule Upgrade',
        actionId: 'meraki.schedule_firmware_upgrade',
        actionName: 'Schedule Upgrade',
        parameters: {
          serial: '{{device_serial}}',
          version: '{{target_version}}',
        },
      },
    },
    {
      id: 'delay-1',
      type: 'delay',
      position: { x: 850, y: 200 },
      data: {
        label: 'Wait for Reboot',
        duration: 300,
        unit: 'seconds',
      },
    },
    {
      id: 'action-3',
      type: 'action',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Verify Status',
        actionId: 'meraki.get_device',
        actionName: 'Check Device Status',
        parameters: {
          serial: '{{device_serial}}',
        },
      },
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 1350, y: 200 },
      data: {
        label: 'Upgrade Success?',
        conditionType: 'expression',
        expression: 'device.status === "online" && device.firmware === target_version',
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1600, y: 100 },
      data: {
        label: 'Success',
        notifyType: 'slack',
        channel: '#firmware-updates',
        message: 'Firmware upgrade successful for {{device_serial}}',
      },
    },
    {
      id: 'action-4',
      type: 'action',
      position: { x: 1600, y: 300 },
      data: {
        label: 'Rollback',
        actionId: 'meraki.restore_device_config',
        actionName: 'Restore Config',
        parameters: {
          serial: '{{device_serial}}',
        },
      },
    },
    {
      id: 'notify-2',
      type: 'notify',
      position: { x: 1850, y: 300 },
      data: {
        label: 'Rollback Alert',
        notifyType: 'slack',
        channel: '#firmware-updates',
        message: 'ALERT: Firmware upgrade failed, rollback initiated for {{device_serial}}',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'action-1', target: 'action-2' },
    { id: 'e3', source: 'action-2', target: 'delay-1' },
    { id: 'e4', source: 'delay-1', target: 'action-3' },
    { id: 'e5', source: 'action-3', target: 'condition-1' },
    { id: 'e6', source: 'condition-1', target: 'notify-1', sourceHandle: 'true' },
    { id: 'e7', source: 'condition-1', target: 'action-4', sourceHandle: 'false' },
    { id: 'e8', source: 'action-4', target: 'notify-2' },
  ],
};

/**
 * Template 8: Client Isolation on Security Event
 * Automatically isolates clients when security threats are detected
 */
export const clientIsolationTemplate: WorkflowTemplate = {
  id: 'client-isolation-security',
  name: 'Client Isolation on Security Event',
  description: 'Automatically quarantine clients when security threats are detected',
  category: 'security',
  icon: '🔒',
  difficulty: 'intermediate',
  estimatedTime: '10 min',
  tags: ['security', 'meraki', 'quarantine', 'automation'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Security Alert',
        triggerType: 'event',
        eventType: 'security.threat_detected',
        description: 'Triggered by security threat detection',
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 350, y: 200 },
      data: {
        label: 'Assess Threat',
        analysisType: 'security',
        prompt: 'Analyze this security event and determine if client isolation is warranted',
      },
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 600, y: 200 },
      data: {
        label: 'Should Isolate?',
        conditionType: 'ai',
        expression: 'ai_recommendation === "isolate"',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 850, y: 150 },
      data: {
        label: 'Quarantine Client',
        actionId: 'meraki.quarantine_client',
        actionName: 'Block Client',
        parameters: {
          clientMac: '{{event.client_mac}}',
          policy: 'Blocked',
        },
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 1100, y: 150 },
      data: {
        label: 'Log Event',
        actionId: 'splunk.create_event',
        actionName: 'Log to Splunk',
        parameters: {
          index: 'security_actions',
          event: 'client_isolated',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1350, y: 200 },
      data: {
        label: 'Alert Security',
        notifyType: 'slack',
        channel: '#security-ops',
        message: 'Client {{event.client_mac}} isolated due to security threat: {{ai_summary}}',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'ai-1' },
    { id: 'e2', source: 'ai-1', target: 'condition-1' },
    { id: 'e3', source: 'condition-1', target: 'action-1', sourceHandle: 'true' },
    { id: 'e4', source: 'action-1', target: 'action-2' },
    { id: 'e5', source: 'action-2', target: 'notify-1' },
    { id: 'e6', source: 'condition-1', target: 'notify-1', sourceHandle: 'false' },
  ],
};

/**
 * Template 9: Splunk Alert to ServiceNow Ticket
 * Creates ServiceNow tickets from Splunk alerts
 */
export const splunkAlertToTicketTemplate: WorkflowTemplate = {
  id: 'splunk-alert-ticket',
  name: 'Splunk Alert to Ticket',
  description: 'Automatically create tickets from Splunk alerts',
  category: 'integration',
  icon: '🎫',
  difficulty: 'beginner',
  estimatedTime: '5 min',
  tags: ['splunk', 'ticketing', 'servicenow', 'automation'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Splunk Alert',
        triggerType: 'splunk',
        query: 'index=alerts severity>=high',
        description: 'Triggered by high-severity Splunk alerts',
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 350, y: 200 },
      data: {
        label: 'Categorize Alert',
        analysisType: 'classification',
        prompt: 'Categorize this alert and suggest priority level',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 600, y: 200 },
      data: {
        label: 'Create Ticket',
        actionId: 'servicenow.create_incident',
        actionName: 'Create ServiceNow Incident',
        parameters: {
          short_description: '{{alert.title}}',
          description: '{{alert.description}}',
          priority: '{{ai_priority}}',
          category: '{{ai_category}}',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 850, y: 200 },
      data: {
        label: 'Notify Team',
        notifyType: 'slack',
        channel: '#tickets',
        message: 'Ticket created from Splunk alert: {{ticket.number}}',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'ai-1' },
    { id: 'e2', source: 'ai-1', target: 'action-1' },
    { id: 'e3', source: 'action-1', target: 'notify-1' },
  ],
};

/**
 * Template 10: Log Aggregation Report
 * Aggregates logs and generates daily reports
 */
export const logAggregationReportTemplate: WorkflowTemplate = {
  id: 'log-aggregation-report',
  name: 'Daily Log Aggregation Report',
  description: 'Aggregate logs from multiple sources and generate daily reports',
  category: 'monitoring',
  icon: '📋',
  difficulty: 'intermediate',
  estimatedTime: '10 min',
  tags: ['splunk', 'reporting', 'logs', 'scheduled'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Daily Schedule',
        triggerType: 'schedule',
        schedule: '0 8 * * *',
        description: 'Run daily at 8 AM',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 150 },
      data: {
        label: 'Query Error Logs',
        actionId: 'splunk.search',
        actionName: 'Search Splunk',
        parameters: {
          query: 'index=* level=error | stats count by source',
          earliest: '-24h',
        },
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 350, y: 280 },
      data: {
        label: 'Query Warnings',
        actionId: 'splunk.search',
        actionName: 'Search Splunk',
        parameters: {
          query: 'index=* level=warning | stats count by source',
          earliest: '-24h',
        },
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 600, y: 200 },
      data: {
        label: 'Generate Summary',
        analysisType: 'summarize',
        prompt: 'Summarize these log statistics and highlight key concerns',
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 850, y: 200 },
      data: {
        label: 'Send Report',
        notifyType: 'email',
        recipients: 'ops-team@company.com',
        subject: 'Daily Log Aggregation Report',
        message: '{{ai_summary}}',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'trigger-1', target: 'action-2' },
    { id: 'e3', source: 'action-1', target: 'ai-1' },
    { id: 'e4', source: 'action-2', target: 'ai-1' },
    { id: 'e5', source: 'ai-1', target: 'notify-1' },
  ],
};

/**
 * Template 11: ThousandEyes Performance Response
 * Responds to performance degradation detected by ThousandEyes
 */
export const thousandEyesPerformanceTemplate: WorkflowTemplate = {
  id: 'thousandeyes-performance',
  name: 'ThousandEyes Performance Response',
  description: 'Automatically respond to performance degradation alerts from ThousandEyes',
  category: 'monitoring',
  icon: '👁️',
  difficulty: 'intermediate',
  estimatedTime: '10 min',
  tags: ['thousandeyes', 'performance', 'alerts', 'automation'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'TE Alert',
        triggerType: 'webhook',
        webhookPath: '/webhooks/thousandeyes',
        description: 'ThousandEyes alert webhook',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 200 },
      data: {
        label: 'Get Test Details',
        actionId: 'thousandeyes.get_test_results',
        actionName: 'Get Test Results',
        parameters: {
          testId: '{{webhook.test_id}}',
        },
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 600, y: 200 },
      data: {
        label: 'Analyze Impact',
        analysisType: 'performance',
        prompt: 'Analyze the performance degradation and identify root cause',
      },
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 850, y: 200 },
      data: {
        label: 'Severity Check',
        conditionType: 'expression',
        expression: 'severity >= "major"',
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 1100, y: 150 },
      data: {
        label: 'Run Diagnostics',
        actionId: 'meraki.get_network_health',
        actionName: 'Network Diagnostics',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1350, y: 200 },
      data: {
        label: 'Alert NOC',
        notifyType: 'pagerduty',
        service: 'network-noc',
        message: 'Performance degradation: {{ai_analysis}}',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'action-1', target: 'ai-1' },
    { id: 'e3', source: 'ai-1', target: 'condition-1' },
    { id: 'e4', source: 'condition-1', target: 'action-2', sourceHandle: 'true' },
    { id: 'e5', source: 'action-2', target: 'notify-1' },
    { id: 'e6', source: 'condition-1', target: 'notify-1', sourceHandle: 'false' },
  ],
};

/**
 * Template 12: Multi-Platform Incident Correlation
 * Correlates events from multiple platforms to identify incidents
 */
export const incidentCorrelationTemplate: WorkflowTemplate = {
  id: 'incident-correlation',
  name: 'Multi-Platform Incident Correlation',
  description: 'Correlate events from Splunk, Meraki, and ThousandEyes to identify incidents',
  category: 'monitoring',
  icon: '🔗',
  difficulty: 'advanced',
  estimatedTime: '15 min',
  tags: ['splunk', 'meraki', 'thousandeyes', 'ai', 'correlation'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Alert Received',
        triggerType: 'event',
        eventType: 'alert.received',
        description: 'Any alert from monitored platforms',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 100 },
      data: {
        label: 'Query Splunk',
        actionId: 'splunk.search',
        actionName: 'Search Related Events',
        parameters: {
          query: 'index=* | where _time > relative_time(now(), "-15m")',
        },
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 350, y: 200 },
      data: {
        label: 'Check Meraki',
        actionId: 'meraki.get_network_events',
        actionName: 'Get Network Events',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
        },
      },
    },
    {
      id: 'action-3',
      type: 'action',
      position: { x: 350, y: 300 },
      data: {
        label: 'Check ThousandEyes',
        actionId: 'thousandeyes.get_alerts',
        actionName: 'Get Active Alerts',
        parameters: {}, // No required parameters for ThousandEyes alerts
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 600, y: 200 },
      data: {
        label: 'Correlate Events',
        analysisType: 'correlation',
        prompt: 'Correlate these events to identify if they are related to the same incident',
      },
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 850, y: 200 },
      data: {
        label: 'Correlation Found?',
        conditionType: 'ai',
        expression: 'correlation_confidence > 0.7',
      },
    },
    {
      id: 'action-4',
      type: 'action',
      position: { x: 1100, y: 150 },
      data: {
        label: 'Create Incident',
        actionId: 'servicenow.create_incident',
        actionName: 'Create Major Incident',
        parameters: {
          priority: '{{ai_severity}}',
          description: '{{ai_summary}}',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1350, y: 200 },
      data: {
        label: 'Notify Teams',
        notifyType: 'slack',
        channel: '#incidents',
        message: 'Correlated incident detected: {{ai_summary}}',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'trigger-1', target: 'action-2' },
    { id: 'e3', source: 'trigger-1', target: 'action-3' },
    { id: 'e4', source: 'action-1', target: 'ai-1' },
    { id: 'e5', source: 'action-2', target: 'ai-1' },
    { id: 'e6', source: 'action-3', target: 'ai-1' },
    { id: 'e7', source: 'ai-1', target: 'condition-1' },
    { id: 'e8', source: 'condition-1', target: 'action-4', sourceHandle: 'true' },
    { id: 'e9', source: 'action-4', target: 'notify-1' },
    { id: 'e10', source: 'condition-1', target: 'notify-1', sourceHandle: 'false' },
  ],
};

/**
 * Template 13: Change Management Workflow
 * Manages network changes with approval and verification
 */
export const changeManagementTemplate: WorkflowTemplate = {
  id: 'change-management',
  name: 'Change Management Workflow',
  description: 'Manage network changes with approval workflow and post-change verification',
  category: 'operations',
  icon: '📝',
  difficulty: 'advanced',
  estimatedTime: '15 min',
  tags: ['change-management', 'approval', 'verification', 'governance'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Change Request',
        triggerType: 'manual',
        description: 'Change request submitted',
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 350, y: 200 },
      data: {
        label: 'Risk Assessment',
        analysisType: 'risk',
        prompt: 'Assess the risk of this network change and identify potential impacts',
      },
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 600, y: 200 },
      data: {
        label: 'Auto-Approve?',
        conditionType: 'expression',
        expression: 'risk_level === "low" && business_hours === false',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 850, y: 100 },
      data: {
        label: 'Apply Change',
        actionId: 'meraki.update_network',
        actionName: 'Apply Network Change',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
          // Add network update fields based on your change requirements
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 850, y: 300 },
      data: {
        label: 'Request Approval',
        notifyType: 'slack',
        channel: '#change-approvals',
        message: 'Change request pending approval: {{change_summary}}',
      },
    },
    {
      id: 'delay-1',
      type: 'delay',
      position: { x: 1100, y: 100 },
      data: {
        label: 'Wait for Stabilization',
        duration: 300,
        unit: 'seconds',
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 1350, y: 100 },
      data: {
        label: 'Verify Change',
        actionId: 'meraki.get_network_health',
        actionName: 'Check Network Health',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
        },
      },
    },
    {
      id: 'notify-2',
      type: 'notify',
      position: { x: 1600, y: 200 },
      data: {
        label: 'Change Complete',
        notifyType: 'slack',
        channel: '#changes',
        message: 'Change completed and verified: {{verification_status}}',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'ai-1' },
    { id: 'e2', source: 'ai-1', target: 'condition-1' },
    { id: 'e3', source: 'condition-1', target: 'action-1', sourceHandle: 'true' },
    { id: 'e4', source: 'condition-1', target: 'notify-1', sourceHandle: 'false' },
    { id: 'e5', source: 'action-1', target: 'delay-1' },
    { id: 'e6', source: 'delay-1', target: 'action-2' },
    { id: 'e7', source: 'action-2', target: 'notify-2' },
  ],
};

/**
 * Template 14: Compliance Check Workflow
 * Scheduled compliance verification against security policies
 */
export const complianceCheckTemplate: WorkflowTemplate = {
  id: 'compliance-check',
  name: 'Scheduled Compliance Check',
  description: 'Verify network configuration compliance against security policies',
  category: 'security',
  icon: '✅',
  difficulty: 'intermediate',
  estimatedTime: '10 min',
  tags: ['compliance', 'security', 'audit', 'scheduled'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Weekly Schedule',
        triggerType: 'schedule',
        schedule: '0 0 * * 0',
        description: 'Run weekly on Sunday',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 150 },
      data: {
        label: 'Get Firewall Rules',
        actionId: 'meraki.get_firewall_rules',
        actionName: 'List Firewall Rules',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
        },
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 350, y: 280 },
      data: {
        label: 'Get SSID Config',
        actionId: 'meraki.get_ssids',
        actionName: 'List SSIDs',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
        },
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 600, y: 200 },
      data: {
        label: 'Compliance Check',
        analysisType: 'compliance',
        prompt: 'Check these configurations against security policies and identify violations',
      },
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 850, y: 200 },
      data: {
        label: 'Violations Found?',
        conditionType: 'expression',
        expression: 'violations.length > 0',
      },
    },
    {
      id: 'action-3',
      type: 'action',
      position: { x: 1100, y: 150 },
      data: {
        label: 'Create Report',
        actionId: 'splunk.create_event',
        actionName: 'Log Compliance Report',
        parameters: {
          index: 'compliance_reports',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1350, y: 150 },
      data: {
        label: 'Alert Violations',
        notifyType: 'email',
        recipients: 'security-team@company.com',
        subject: 'Compliance Violations Detected',
        message: '{{compliance_report}}',
      },
    },
    {
      id: 'notify-2',
      type: 'notify',
      position: { x: 1100, y: 280 },
      data: {
        label: 'Compliance OK',
        notifyType: 'slack',
        channel: '#compliance',
        message: 'Weekly compliance check passed ✓',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'trigger-1', target: 'action-2' },
    { id: 'e3', source: 'action-1', target: 'ai-1' },
    { id: 'e4', source: 'action-2', target: 'ai-1' },
    { id: 'e5', source: 'ai-1', target: 'condition-1' },
    { id: 'e6', source: 'condition-1', target: 'action-3', sourceHandle: 'true' },
    { id: 'e7', source: 'action-3', target: 'notify-1' },
    { id: 'e8', source: 'condition-1', target: 'notify-2', sourceHandle: 'false' },
  ],
};

/**
 * Template 15: Intelligent Alert Triage (AI-Enhanced)
 *
 * PARADIGM SHIFT DEMO: Traditional vs AI-Enhanced Workflows
 *
 * TRADITIONAL APPROACH (what we've always done):
 *   Splunk Query → If error_count > 10 → Send Email
 *   Problem: Alerts on EVERY spike, including:
 *     - Scheduled maintenance windows
 *     - Known transient issues
 *     - False positives from log parsing
 *     - Non-actionable informational errors
 *   Result: Alert fatigue, ignored notifications, missed real issues
 *
 * AI-ENHANCED APPROACH (this workflow):
 *   Splunk Query → AI Analyzes Context → Only Alert if AI Confident (>80%)
 *   AI evaluates:
 *     1. Is this a real issue or false positive?
 *     2. Is this during a maintenance window?
 *     3. Has this been seen before and auto-resolved?
 *     4. What's the actual business impact?
 *     5. Is this actionable by a human?
 *   Result: Only genuine, actionable alerts reach humans
 */
export const intelligentAlertTriageTemplate: WorkflowTemplate = {
  id: 'intelligent-alert-triage',
  name: 'Intelligent Alert Triage',
  description: 'AI-powered alert analysis that only notifies when confidence exceeds 80% that the issue is real, impactful, and actionable',
  category: 'monitoring',
  icon: '🧠',
  difficulty: 'intermediate',
  estimatedTime: '10 min',
  tags: ['ai', 'intelligent', 'alerts', 'triage', 'confidence', 'noise-reduction', 'splunk'],
  nodes: [
    // STAGE 1: Data Collection (same as traditional)
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 250 },
      data: {
        label: 'Monitor Errors',
        triggerType: 'schedule',
        schedule: '*/5 * * * *', // Every 5 minutes
        description: 'Poll for errors every 5 minutes (same as traditional)',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 250 },
      data: {
        label: 'Query Splunk',
        actionId: 'splunk.run_query',
        actionName: 'Run Splunk Query',
        parameters: {
          query: 'index=network sourcetype=syslog level=error | stats count by host, source, message | where count > 5',
          earliest: '-5m',
          latest: 'now',
        },
      },
    },
    // STAGE 2: AI Analysis (THE PARADIGM SHIFT)
    // Traditional would just check: if count > threshold → alert
    // AI-enhanced analyzes CONTEXT and CONFIDENCE
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 600, y: 250 },
      data: {
        label: 'AI Triage Analysis',
        analysisType: 'triage',
        prompt: `Analyze these error logs and determine:

1. REAL_ISSUE (0-100%): Is this a genuine problem or noise?
   - Check for: maintenance patterns, known transient issues, log parsing errors

2. SEVERITY (critical/high/medium/low): What's the actual impact?
   - Consider: user impact, business criticality, blast radius

3. ACTIONABLE (0-100%): Can a human meaningfully respond?
   - Consider: is manual intervention needed, or will it auto-resolve?

4. ROOT_CAUSE: What's likely causing this?
   - Correlate with: recent changes, similar past incidents

Return structured assessment with confidence scores.`,
        confidenceThreshold: 80,
        evaluationCriteria: [
          'real_issue_confidence >= 80',
          'severity in ["critical", "high"]',
          'actionable_confidence >= 80',
        ],
      },
    },
    // STAGE 3: Multi-Gate Confidence Check
    // Only proceed if AI is confident on ALL THREE criteria
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 850, y: 250 },
      data: {
        label: 'Confidence Gate',
        conditionType: 'ai',
        expression: 'ai.real_issue_confidence >= 80 && ai.actionable_confidence >= 80',
        description: 'Only proceed if AI is 80%+ confident this is real AND actionable',
      },
    },
    // STAGE 4A: High-Confidence Path → Alert (TRUE branch)
    {
      id: 'action-2',
      type: 'action',
      position: { x: 1100, y: 150 },
      data: {
        label: 'Create Incident',
        actionId: 'custom.create_incident',
        actionName: 'Create Incident Record',
        parameters: {
          title: '{{ai.summary}}',
          description: '{{ai.detailed_analysis}}',
          severity: '{{ai.severity}}',
          rootCause: '{{ai.root_cause}}',
          confidence: '{{ai.real_issue_confidence}}%',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1350, y: 150 },
      data: {
        label: 'Alert On-Call',
        notifyType: 'pagerduty',
        service: 'network-oncall',
        message: `🚨 HIGH-CONFIDENCE ALERT ({{ai.real_issue_confidence}}%)

{{ai.summary}}

Severity: {{ai.severity}}
Root Cause: {{ai.root_cause}}
Recommended Action: {{ai.recommended_action}}

This alert passed AI triage with 80%+ confidence on:
✓ Real Issue: {{ai.real_issue_confidence}}%
✓ Actionable: {{ai.actionable_confidence}}%`,
      },
    },
    // STAGE 4B: Low-Confidence Path → Log Only (FALSE branch)
    {
      id: 'action-3',
      type: 'action',
      position: { x: 1100, y: 350 },
      data: {
        label: 'Log for Review',
        actionId: 'splunk.run_query',
        actionName: 'Log to Splunk',
        parameters: {
          query: `| makeresults
            | eval event_type="ai_filtered_alert"
            | eval original_alert="{{trigger.raw}}"
            | eval ai_confidence="{{ai.real_issue_confidence}}"
            | eval ai_reasoning="{{ai.reasoning}}"
            | eval filter_reason="Below 80% confidence threshold"
            | collect index=ai_filtered_alerts`,
        },
      },
    },
    {
      id: 'notify-2',
      type: 'notify',
      position: { x: 1350, y: 350 },
      data: {
        label: 'Daily Digest',
        notifyType: 'slack',
        channel: '#network-ops-digest',
        message: `📊 Alert filtered by AI ({{ai.real_issue_confidence}}% confidence)

Summary: {{ai.summary}}
Reason for filtering: {{ai.reasoning}}

This alert was logged but not escalated because AI confidence was below 80%.
Review in Splunk: index=ai_filtered_alerts`,
        // Only send digest once per day, not per filtered alert
        aggregation: 'daily_digest',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'action-1', target: 'ai-1' },
    { id: 'e3', source: 'ai-1', target: 'condition-1' },
    // TRUE path: High confidence → Create incident → Alert on-call
    { id: 'e4', source: 'condition-1', target: 'action-2', sourceHandle: 'true' },
    { id: 'e5', source: 'action-2', target: 'notify-1' },
    // FALSE path: Low confidence → Log for review → Daily digest
    { id: 'e6', source: 'condition-1', target: 'action-3', sourceHandle: 'false' },
    { id: 'e7', source: 'action-3', target: 'notify-2' },
  ],
};

/**
 * Template 16: Capacity Planning Report
 * Analyzes trends and generates capacity planning recommendations
 */
export const capacityPlanningTemplate: WorkflowTemplate = {
  id: 'capacity-planning',
  name: 'Capacity Planning Report',
  description: 'Analyze usage trends and generate capacity planning recommendations',
  category: 'monitoring',
  icon: '📈',
  difficulty: 'intermediate',
  estimatedTime: '10 min',
  tags: ['capacity', 'planning', 'analytics', 'ai'],
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Monthly Schedule',
        triggerType: 'schedule',
        schedule: '0 6 1 * *',
        description: 'Run monthly on 1st at 6 AM',
      },
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 350, y: 150 },
      data: {
        label: 'Get Usage Trends',
        actionId: 'splunk.search',
        actionName: 'Query Usage Metrics',
        parameters: {
          query: 'index=metrics | timechart span=1d avg(bandwidth), avg(clients)',
          earliest: '-90d',
        },
      },
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 350, y: 280 },
      data: {
        label: 'Get Device Inventory',
        actionId: 'meraki.list_devices',
        actionName: 'List All Devices',
        parameters: {
          network_id: '', // Required: Set your Meraki network ID
        },
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 600, y: 200 },
      data: {
        label: 'Capacity Analysis',
        analysisType: 'forecast',
        prompt: 'Analyze usage trends and forecast capacity needs for the next quarter',
      },
    },
    {
      id: 'action-3',
      type: 'action',
      position: { x: 850, y: 200 },
      data: {
        label: 'Generate Report',
        actionId: 'custom.generate_report',
        actionName: 'Create PDF Report',
        parameters: {
          template: 'capacity-planning',
          data: '{{ai_analysis}}',
        },
      },
    },
    {
      id: 'notify-1',
      type: 'notify',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Distribute Report',
        notifyType: 'email',
        recipients: 'leadership@company.com',
        subject: 'Monthly Capacity Planning Report',
        attachReport: true,
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'action-1' },
    { id: 'e2', source: 'trigger-1', target: 'action-2' },
    { id: 'e3', source: 'action-1', target: 'ai-1' },
    { id: 'e4', source: 'action-2', target: 'ai-1' },
    { id: 'e5', source: 'ai-1', target: 'action-3' },
    { id: 'e6', source: 'action-3', target: 'notify-1' },
  ],
};

// Export all templates as an array
export const CARD_TEMPLATES: WorkflowTemplate[] = [
  // Featured: AI-Enhanced Demo (shows paradigm shift)
  intelligentAlertTriageTemplate,
  // Monitoring
  networkHealthMonitorTemplate,
  bandwidthAlertTemplate,
  thousandEyesPerformanceTemplate,
  incidentCorrelationTemplate,
  logAggregationReportTemplate,
  capacityPlanningTemplate,
  // Security
  securityAlertResponseTemplate,
  clientIsolationTemplate,
  complianceCheckTemplate,
  // Operations
  scheduledBackupTemplate,
  firmwareUpgradeTemplate,
  changeManagementTemplate,
  // Automation
  deviceOnboardingTemplate,
  vlanProvisioningTemplate,
  // Integration
  splunkAlertToTicketTemplate,
];

// Helper function to get template by ID
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return CARD_TEMPLATES.find(t => t.id === id);
}

// Helper function to get templates by category
export function getTemplatesByCategory(category: WorkflowTemplate['category']): WorkflowTemplate[] {
  return CARD_TEMPLATES.filter(t => t.category === category);
}

// Helper function to search templates
export function searchTemplates(query: string): WorkflowTemplate[] {
  const lowerQuery = query.toLowerCase();
  return CARD_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export default CARD_TEMPLATES;
