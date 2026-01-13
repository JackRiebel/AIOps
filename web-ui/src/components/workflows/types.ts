/**
 * Workflow Types - TypeScript interfaces for the Workflows feature
 */

// ============================================================================
// Enums
// ============================================================================

export type WorkflowStatus = 'active' | 'paused' | 'draft';
export type TriggerType = 'splunk_query' | 'schedule' | 'manual';
export type ExecutionStatus = 'pending_approval' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high';

// ============================================================================
// Condition & Action Types
// ============================================================================

export interface WorkflowCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

export interface WorkflowAction {
  tool: string;
  params: Record<string, unknown>;
  requires_approval: boolean;
  reason?: string;
}

// ============================================================================
// Workflow Types
// ============================================================================

export interface Workflow {
  id: number;
  name: string;
  description?: string;
  status: WorkflowStatus;
  trigger_type: TriggerType;
  splunk_query?: string;
  schedule_cron?: string;
  poll_interval_seconds: number;
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
  ai_enabled: boolean;
  ai_prompt?: string;
  ai_confidence_threshold: number;
  // Auto-execute settings
  auto_execute_enabled: boolean;
  auto_execute_min_confidence: number;
  auto_execute_max_risk: RiskLevel;
  flow_data?: FlowData;
  created_by?: number;
  organization?: string;
  template_id?: string;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
  trigger_count: number;
  success_count: number;
  failure_count: number;
}

export interface WorkflowExecution {
  id: number;
  workflow_id: number;
  workflow?: Workflow;
  status: ExecutionStatus;
  trigger_data?: Record<string, unknown>[];
  trigger_event_count: number;
  ai_analysis?: string;
  ai_confidence?: number;
  ai_risk_level?: RiskLevel;
  recommended_actions?: WorkflowAction[];
  requires_approval: boolean;
  approved_by?: number;
  approved_at?: string;
  rejection_reason?: string;
  executed_at?: string;
  completed_at?: string;
  result?: Record<string, unknown>;
  error?: string;
  executed_actions?: WorkflowAction[];
  ai_cost_usd: number;
  ai_input_tokens: number;
  ai_output_tokens: number;
  created_at: string;
}

// ============================================================================
// Flow Builder Types (React Flow)
// ============================================================================

export interface FlowNode {
  id: string;
  type: 'trigger' | 'condition' | 'ai' | 'action' | 'notify';
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// ============================================================================
// Template Types
// ============================================================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  trigger_type: TriggerType;
  ai_enabled: boolean;
  action_count: number;
  category?: 'network_health' | 'compliance' | 'security' | 'custom';
}

// ============================================================================
// Stats Types
// ============================================================================

export interface WorkflowStats {
  workflows: {
    active: number;
    paused: number;
    draft: number;
    total: number;
  };
  pending_approvals: number;
  triggered_today: number;
  total_triggers: number;
  total_successes: number;
  total_failures: number;
  success_rate: number;
  // AI Value Metrics
  total_ai_cost_usd?: number;
  total_time_saved_seconds?: number;
  avg_time_saved_per_execution?: number;
  estimated_manual_cost_usd?: number;
  roi_percentage?: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  trigger_type: TriggerType;
  splunk_query?: string;
  schedule_cron?: string;
  poll_interval_seconds?: number;
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
  ai_enabled?: boolean;
  ai_prompt?: string;
  ai_confidence_threshold?: number;
  // Auto-execute settings
  auto_execute_enabled?: boolean;
  auto_execute_min_confidence?: number;
  auto_execute_max_risk?: RiskLevel;
  flow_data?: FlowData;
  organization?: string;
  template_id?: string;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  trigger_type?: TriggerType;
  splunk_query?: string;
  schedule_cron?: string;
  poll_interval_seconds?: number;
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
  ai_enabled?: boolean;
  ai_prompt?: string;
  ai_confidence_threshold?: number;
  // Auto-execute settings
  auto_execute_enabled?: boolean;
  auto_execute_min_confidence?: number;
  auto_execute_max_risk?: RiskLevel;
  flow_data?: FlowData;
}

export interface ApproveExecutionRequest {
  modified_actions?: WorkflowAction[];
}

export interface RejectExecutionRequest {
  reason?: string;
}

// ============================================================================
// UI State Types
// ============================================================================

export type WorkflowTab = 'all' | 'active' | 'pending' | 'history';

export interface WorkflowWizardStep {
  step: 1 | 2 | 3;
  title: string;
  description: string;
}

export const WIZARD_STEPS: WorkflowWizardStep[] = [
  { step: 1, title: 'Trigger', description: 'When to run' },
  { step: 2, title: 'Conditions', description: 'What to check' },
  { step: 3, title: 'Actions', description: 'What to do' },
];

// ============================================================================
// Polling Intervals
// ============================================================================

export const POLL_INTERVALS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '24 hours' },
];

// ============================================================================
// Condition Operators
// ============================================================================

export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '>=', label: 'greater than or equals' },
  { value: '<', label: 'less than' },
  { value: '<=', label: 'less than or equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'matches', label: 'matches regex' },
];

// ============================================================================
// Action Registry Types
// ============================================================================

export type WorkflowActionCategory = 'network' | 'security' | 'notification' | 'data' | 'custom';
export type WorkflowActionPlatform = 'meraki' | 'splunk' | 'ise' | 'thousandeyes' | 'umbrella' | 'catalyst';

// Smart parameter types for cascading selectors
export type SmartParameterType = 'organization' | 'network' | 'device' | 'client' | 'ssid';
export type BasicParameterType = 'string' | 'number' | 'boolean' | 'select' | 'text';
export type ParameterType = BasicParameterType | SmartParameterType;

export interface ActionParameter {
  id: string;
  name: string;
  type: ParameterType;
  required?: boolean;
  default?: string | number | boolean;
  options?: string[];
  source?: string; // Dynamic data source like 'meraki_devices'
  dependsOn?: string; // Parameter ID this depends on (for cascading)
  description?: string;
  min?: number;
  max?: number;
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  category: WorkflowActionCategory;
  platform?: WorkflowActionPlatform;
  icon: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  parameters: ActionParameter[];
  verified: boolean;  // Does backend actually support this?
  riskLevel: RiskLevel;
  example?: {
    scenario: string;
    config: Record<string, unknown>;
  };
}

// ============================================================================
// Action Registry - All Available Actions
// ============================================================================

export const ACTION_REGISTRY: ActionDefinition[] = [
  // =============================================================================
  // MERAKI ACTIONS - Device Operations (with smart cascading selectors)
  // =============================================================================
  {
    id: 'meraki.reboot_device',
    name: 'Reboot Meraki Device',
    description: 'Restart a Meraki device (AP, switch, or appliance)',
    category: 'network',
    platform: 'meraki',
    icon: '🔄',
    endpoint: '/api/actions/meraki/devices/{serial}/reboot',
    method: 'POST',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
    ],
    verified: true,
    riskLevel: 'medium',
    example: {
      scenario: 'Reboot an access point that is unresponsive',
      config: { serial: 'Q2HP-XXXX-XXXX' }
    }
  },
  {
    id: 'meraki.blink_leds',
    name: 'Blink Device LEDs',
    description: 'Flash the LEDs on a device to help locate it',
    category: 'network',
    platform: 'meraki',
    icon: '💡',
    endpoint: '/api/actions/meraki/devices/{serial}/blinkLeds',
    method: 'POST',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
      { id: 'duration', name: 'Duration (seconds)', type: 'number', default: 20, min: 5, max: 120 },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'meraki.update_device',
    name: 'Update Device Info',
    description: 'Update device name, tags, or address',
    category: 'network',
    platform: 'meraki',
    icon: '✏️',
    endpoint: '/api/meraki/devices/{serial}',
    method: 'PUT',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
      { id: 'name', name: 'Device Name', type: 'string' },
      { id: 'tags', name: 'Tags (comma-separated)', type: 'string' },
      { id: 'address', name: 'Address', type: 'string' },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'meraki.claim_device',
    name: 'Claim Device to Network',
    description: 'Add a device to a network using its serial number',
    category: 'network',
    platform: 'meraki',
    icon: '➕',
    endpoint: '/api/meraki/networks/{networkId}/devices/claim',
    method: 'POST',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serials', name: 'Device Serials (comma-separated)', type: 'string', required: true },
    ],
    verified: true,
    riskLevel: 'medium',
  },
  {
    id: 'meraki.remove_device',
    name: 'Remove Device from Network',
    description: 'Remove a device from the network',
    category: 'network',
    platform: 'meraki',
    icon: '➖',
    endpoint: '/api/meraki/networks/{networkId}/devices/remove',
    method: 'POST',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
    ],
    verified: true,
    riskLevel: 'high',
  },

  // =============================================================================
  // MERAKI ACTIONS - Wireless Operations
  // =============================================================================
  {
    id: 'meraki.enable_ssid',
    name: 'Enable/Disable SSID',
    description: 'Turn a wireless network on or off',
    category: 'network',
    platform: 'meraki',
    icon: '📶',
    endpoint: '/api/meraki/networks/{networkId}/wireless/ssids/{number}',
    method: 'PUT',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'number', name: 'SSID Number', type: 'number', required: true, min: 0, max: 14 },
      { id: 'enabled', name: 'Enable SSID', type: 'boolean', required: true },
    ],
    verified: true,
    riskLevel: 'high',
  },
  {
    id: 'meraki.update_ssid',
    name: 'Update SSID Settings',
    description: 'Modify SSID name, authentication, or PSK',
    category: 'network',
    platform: 'meraki',
    icon: '📡',
    endpoint: '/api/meraki/networks/{networkId}/wireless/ssids/{number}',
    method: 'PUT',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'number', name: 'SSID Number', type: 'number', required: true, min: 0, max: 14 },
      { id: 'name', name: 'SSID Name', type: 'string' },
      { id: 'authMode', name: 'Auth Mode', type: 'select', options: ['open', 'psk', '8021x-radius'] },
      { id: 'psk', name: 'Pre-Shared Key', type: 'string', description: 'Required if auth is PSK' },
    ],
    verified: true,
    riskLevel: 'high',
  },

  // =============================================================================
  // MERAKI ACTIONS - Switch Operations
  // =============================================================================
  {
    id: 'meraki.cycle_port',
    name: 'Cycle Switch Port',
    description: 'Power cycle a switch port to reset connected device',
    category: 'network',
    platform: 'meraki',
    icon: '🔌',
    endpoint: '/api/meraki/devices/{serial}/switch/ports/cycle',
    method: 'POST',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
      { id: 'ports', name: 'Port Numbers (comma-separated)', type: 'string', required: true },
    ],
    verified: true,
    riskLevel: 'high',
  },
  {
    id: 'meraki.update_port',
    name: 'Update Switch Port',
    description: 'Modify switch port settings (VLAN, PoE, enabled)',
    category: 'network',
    platform: 'meraki',
    icon: '⚡',
    endpoint: '/api/meraki/devices/{serial}/switch/ports/{portId}',
    method: 'PUT',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
      { id: 'portId', name: 'Port ID', type: 'string', required: true },
      { id: 'vlan', name: 'VLAN', type: 'number' },
      { id: 'poeEnabled', name: 'PoE Enabled', type: 'boolean' },
      { id: 'enabled', name: 'Port Enabled', type: 'boolean' },
    ],
    verified: true,
    riskLevel: 'medium',
  },
  {
    id: 'meraki.cable_test',
    name: 'Run Cable Test',
    description: 'Run cable diagnostics on switch ports',
    category: 'network',
    platform: 'meraki',
    icon: '🔬',
    endpoint: '/api/meraki/devices/{serial}/liveTools/cableTest',
    method: 'POST',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
      { id: 'ports', name: 'Port Numbers (comma-separated)', type: 'string', required: true },
    ],
    verified: true,
    riskLevel: 'low',
  },

  // =============================================================================
  // MERAKI ACTIONS - Security Operations
  // =============================================================================
  {
    id: 'meraki.quarantine_client',
    name: 'Quarantine Client',
    description: 'Block a client from network access',
    category: 'security',
    platform: 'meraki',
    icon: '🚫',
    endpoint: '/api/meraki/networks/{networkId}/clients/{clientId}/policy',
    method: 'PUT',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'clientId', name: 'Client', type: 'client', required: true, dependsOn: 'networkId' },
      { id: 'devicePolicy', name: 'Policy', type: 'select', options: ['Blocked', 'Normal', 'Whitelisted'] },
    ],
    verified: true,
    riskLevel: 'high',
  },
  {
    id: 'meraki.update_client_policy',
    name: 'Update Client Policy',
    description: 'Change the group policy for a specific client',
    category: 'security',
    platform: 'meraki',
    icon: '👤',
    endpoint: '/api/meraki/networks/{networkId}/clients/{clientId}/policy',
    method: 'PUT',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'clientId', name: 'Client', type: 'client', required: true, dependsOn: 'networkId' },
      { id: 'groupPolicyId', name: 'Group Policy ID', type: 'string' },
    ],
    verified: true,
    riskLevel: 'medium',
  },
  {
    id: 'meraki.update_firewall_rules',
    name: 'Update L3 Firewall Rules',
    description: 'Modify MX L3 outbound firewall rules',
    category: 'security',
    platform: 'meraki',
    icon: '🛡️',
    endpoint: '/api/meraki/networks/{networkId}/appliance/firewall/l3FirewallRules',
    method: 'PUT',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'rules', name: 'Rules (JSON array)', type: 'text', required: true, description: 'Array of firewall rule objects' },
    ],
    verified: true,
    riskLevel: 'high',
  },
  {
    id: 'meraki.update_content_filter',
    name: 'Update Content Filtering',
    description: 'Update content filtering rules and blocked categories',
    category: 'security',
    platform: 'meraki',
    icon: '🔒',
    endpoint: '/api/meraki/networks/{networkId}/appliance/contentFiltering',
    method: 'PUT',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'blockedUrlPatterns', name: 'Blocked URLs (comma-separated)', type: 'string' },
      { id: 'blockedUrlCategories', name: 'Blocked Categories (JSON)', type: 'text' },
    ],
    verified: true,
    riskLevel: 'medium',
  },
  {
    id: 'meraki.get_security_events',
    name: 'Get Security Events',
    description: 'Retrieve security events for the network',
    category: 'security',
    platform: 'meraki',
    icon: '🔍',
    endpoint: '/api/meraki/networks/{networkId}/appliance/security/events',
    method: 'GET',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'timespan', name: 'Timespan (seconds)', type: 'number', default: 86400 },
    ],
    verified: true,
    riskLevel: 'low',
  },

  // =============================================================================
  // MERAKI ACTIONS - VPN Operations
  // =============================================================================
  {
    id: 'meraki.get_vpn_status',
    name: 'Get VPN Status',
    description: 'Get site-to-site VPN status for a network',
    category: 'network',
    platform: 'meraki',
    icon: '🔐',
    endpoint: '/api/meraki/networks/{networkId}/appliance/vpn/siteToSiteVpn',
    method: 'GET',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'meraki.update_vpn_config',
    name: 'Update Site-to-Site VPN',
    description: 'Modify VPN configuration (mode, hubs, subnets)',
    category: 'network',
    platform: 'meraki',
    icon: '🌐',
    endpoint: '/api/meraki/networks/{networkId}/appliance/vpn/siteToSiteVpn',
    method: 'PUT',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'mode', name: 'VPN Mode', type: 'select', options: ['none', 'hub', 'spoke'], required: true },
      { id: 'hubs', name: 'Hub Networks (JSON)', type: 'text' },
      { id: 'subnets', name: 'Subnets (JSON)', type: 'text' },
    ],
    verified: true,
    riskLevel: 'high',
  },
  {
    id: 'meraki.get_vpn_topology',
    name: 'Get VPN Topology',
    description: 'Get organization-wide VPN status and topology',
    category: 'network',
    platform: 'meraki',
    icon: '🗺️',
    endpoint: '/api/meraki/organizations/{organizationId}/appliance/vpn/statuses',
    method: 'GET',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
    ],
    verified: true,
    riskLevel: 'low',
  },

  // =============================================================================
  // MERAKI ACTIONS - Monitoring Operations
  // =============================================================================
  {
    id: 'meraki.get_network_health',
    name: 'Get Network Health',
    description: 'Get overall health metrics for a network',
    category: 'network',
    platform: 'meraki',
    icon: '💚',
    endpoint: '/api/meraki/networks/{networkId}/health/alerts',
    method: 'GET',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'meraki.get_device_status',
    name: 'Get Device Status',
    description: 'Get status and uplink information for a device',
    category: 'network',
    platform: 'meraki',
    icon: '📊',
    endpoint: '/api/meraki/devices/{serial}/status',
    method: 'GET',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'meraki.run_ping',
    name: 'Run Ping Test',
    description: 'Ping a target IP from a device',
    category: 'network',
    platform: 'meraki',
    icon: '📡',
    endpoint: '/api/meraki/devices/{serial}/liveTools/ping',
    method: 'POST',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
      { id: 'target', name: 'Target IP/Hostname', type: 'string', required: true },
      { id: 'count', name: 'Ping Count', type: 'number', default: 5, min: 1, max: 10 },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'meraki.get_topology',
    name: 'Get Network Topology',
    description: 'Get network topology including LLDP/CDP neighbors',
    category: 'network',
    platform: 'meraki',
    icon: '🕸️',
    endpoint: '/api/meraki/networks/{networkId}/topology/linkLayer',
    method: 'GET',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'meraki.get_events',
    name: 'Get Network Events',
    description: 'Retrieve recent network events and logs',
    category: 'network',
    platform: 'meraki',
    icon: '📋',
    endpoint: '/api/meraki/networks/{networkId}/events',
    method: 'GET',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'productType', name: 'Product Type', type: 'select', options: ['appliance', 'switch', 'wireless', 'camera', 'sensor'] },
      { id: 'perPage', name: 'Results per Page', type: 'number', default: 100, max: 1000 },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'meraki.wake_on_lan',
    name: 'Wake on LAN',
    description: 'Send a Wake-on-LAN packet to wake a device',
    category: 'network',
    platform: 'meraki',
    icon: '⚡',
    endpoint: '/api/meraki/devices/{serial}/liveTools/wakeOnLan',
    method: 'POST',
    parameters: [
      { id: 'organization', name: 'Organization', type: 'organization', required: true },
      { id: 'networkId', name: 'Network', type: 'network', required: true, dependsOn: 'organization' },
      { id: 'serial', name: 'Device', type: 'device', required: true, dependsOn: 'networkId' },
      { id: 'mac', name: 'Target MAC Address', type: 'string', required: true },
      { id: 'vlanId', name: 'VLAN ID', type: 'number' },
    ],
    verified: true,
    riskLevel: 'low',
  },

  // =============================================================================
  // SPLUNK ACTIONS
  // =============================================================================
  {
    id: 'splunk.run_query',
    name: 'Run Splunk Query',
    description: 'Execute a Splunk search and return results',
    category: 'data',
    platform: 'splunk',
    icon: '🔍',
    endpoint: '/api/splunk/search',
    method: 'POST',
    parameters: [
      { id: 'query', name: 'SPL Query', type: 'text', required: true },
      { id: 'earliest', name: 'Time Range Start', type: 'string', default: '-24h' },
      { id: 'latest', name: 'Time Range End', type: 'string', default: 'now' },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'splunk.run_saved_search',
    name: 'Run Saved Search',
    description: 'Execute a saved/scheduled search by name',
    category: 'data',
    platform: 'splunk',
    icon: '📌',
    endpoint: '/api/splunk/saved-searches/{name}/dispatch',
    method: 'POST',
    parameters: [
      { id: 'name', name: 'Saved Search Name', type: 'string', required: true },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'splunk.create_saved_search',
    name: 'Create Saved Search',
    description: 'Create a new saved search with optional schedule',
    category: 'data',
    platform: 'splunk',
    icon: '➕',
    endpoint: '/api/splunk/saved-searches',
    method: 'POST',
    parameters: [
      { id: 'name', name: 'Search Name', type: 'string', required: true },
      { id: 'query', name: 'SPL Query', type: 'text', required: true },
      { id: 'cronSchedule', name: 'Cron Schedule', type: 'string', description: 'e.g., */15 * * * *' },
      { id: 'isScheduled', name: 'Enable Schedule', type: 'boolean', default: false },
    ],
    verified: true,
    riskLevel: 'medium',
  },
  {
    id: 'splunk.get_server_health',
    name: 'Get Splunk Health',
    description: 'Get Splunk server health and status',
    category: 'data',
    platform: 'splunk',
    icon: '💚',
    endpoint: '/api/splunk/health',
    method: 'GET',
    parameters: [],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'splunk.list_indexes',
    name: 'List Indexes',
    description: 'List all available Splunk indexes',
    category: 'data',
    platform: 'splunk',
    icon: '📚',
    endpoint: '/api/splunk/indexes',
    method: 'GET',
    parameters: [],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'splunk.kvstore_query',
    name: 'Query KV Store',
    description: 'Query data from a Splunk KV Store collection',
    category: 'data',
    platform: 'splunk',
    icon: '🗃️',
    endpoint: '/api/splunk/kvstore/{collection}',
    method: 'GET',
    parameters: [
      { id: 'collection', name: 'Collection Name', type: 'string', required: true },
      { id: 'app', name: 'App Name', type: 'string', default: 'search' },
      { id: 'query', name: 'Query (JSON)', type: 'text', description: 'MongoDB-style query' },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'splunk.kvstore_insert',
    name: 'Insert KV Store Data',
    description: 'Insert data into a Splunk KV Store collection',
    category: 'data',
    platform: 'splunk',
    icon: '📥',
    endpoint: '/api/splunk/kvstore/{collection}',
    method: 'POST',
    parameters: [
      { id: 'collection', name: 'Collection Name', type: 'string', required: true },
      { id: 'app', name: 'App Name', type: 'string', default: 'search' },
      { id: 'data', name: 'Data (JSON)', type: 'text', required: true },
    ],
    verified: true,
    riskLevel: 'medium',
  },
  {
    id: 'splunk.generate_insights',
    name: 'Generate AI Insights',
    description: 'Use AI to analyze Splunk data and generate insights',
    category: 'data',
    platform: 'splunk',
    icon: '🤖',
    endpoint: '/api/splunk/insights/generate',
    method: 'POST',
    parameters: [
      { id: 'query', name: 'SPL Query', type: 'text', required: true },
      { id: 'timespan', name: 'Time Range', type: 'string', default: '-24h' },
      { id: 'context', name: 'Analysis Context', type: 'text', description: 'Additional context for AI analysis' },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'splunk.ai_search',
    name: 'Natural Language Search',
    description: 'Search Splunk using natural language (AI converts to SPL)',
    category: 'data',
    platform: 'splunk',
    icon: '💬',
    endpoint: '/api/splunk/ai-search',
    method: 'POST',
    parameters: [
      { id: 'naturalQuery', name: 'Natural Language Query', type: 'text', required: true },
      { id: 'timeRange', name: 'Time Range', type: 'string', default: '-24h' },
    ],
    verified: true,
    riskLevel: 'low',
  },

  // =============================================================================
  // THOUSANDEYES ACTIONS
  // =============================================================================
  {
    id: 'thousandeyes.list_tests',
    name: 'List ThousandEyes Tests',
    description: 'Get all configured tests from ThousandEyes',
    category: 'network',
    platform: 'thousandeyes',
    icon: '📋',
    endpoint: '/api/thousandeyes/tests',
    method: 'GET',
    parameters: [
      { id: 'testType', name: 'Test Type', type: 'select', options: ['all', 'http-server', 'page-load', 'network', 'dns-server', 'voice'] },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'thousandeyes.get_test_results',
    name: 'Get Test Results',
    description: 'Get results for a specific ThousandEyes test',
    category: 'network',
    platform: 'thousandeyes',
    icon: '📊',
    endpoint: '/api/thousandeyes/tests/{testId}/results',
    method: 'GET',
    parameters: [
      { id: 'testId', name: 'Test ID', type: 'string', required: true },
      { id: 'window', name: 'Time Window', type: 'select', options: ['1h', '2h', '4h', '12h', '24h', '7d'] },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'thousandeyes.create_test',
    name: 'Create Test',
    description: 'Create a new ThousandEyes test',
    category: 'network',
    platform: 'thousandeyes',
    icon: '➕',
    endpoint: '/api/thousandeyes/tests',
    method: 'POST',
    parameters: [
      { id: 'testType', name: 'Test Type', type: 'select', options: ['http-server', 'page-load', 'network', 'dns-server'], required: true },
      { id: 'testName', name: 'Test Name', type: 'string', required: true },
      { id: 'url', name: 'Target URL/IP', type: 'string', required: true },
      { id: 'interval', name: 'Interval (seconds)', type: 'number', default: 300 },
    ],
    verified: true,
    riskLevel: 'medium',
  },
  {
    id: 'thousandeyes.run_instant_test',
    name: 'Run Instant Test',
    description: 'Trigger an immediate run of an existing test',
    category: 'network',
    platform: 'thousandeyes',
    icon: '▶️',
    endpoint: '/api/thousandeyes/tests/{testId}/instant',
    method: 'POST',
    parameters: [
      { id: 'testId', name: 'Test ID', type: 'string', required: true },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'thousandeyes.list_alerts',
    name: 'List Active Alerts',
    description: 'Get all active ThousandEyes alerts',
    category: 'network',
    platform: 'thousandeyes',
    icon: '🚨',
    endpoint: '/api/thousandeyes/alerts',
    method: 'GET',
    parameters: [
      { id: 'activeOnly', name: 'Active Only', type: 'boolean', default: true },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'thousandeyes.get_path_visualization',
    name: 'Get Path Trace',
    description: 'Get network path visualization data',
    category: 'network',
    platform: 'thousandeyes',
    icon: '🛤️',
    endpoint: '/api/thousandeyes/tests/{testId}/path-vis',
    method: 'GET',
    parameters: [
      { id: 'testId', name: 'Test ID', type: 'string', required: true },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'thousandeyes.list_agents',
    name: 'List Agents',
    description: 'Get all ThousandEyes agents',
    category: 'network',
    platform: 'thousandeyes',
    icon: '🤖',
    endpoint: '/api/thousandeyes/agents',
    method: 'GET',
    parameters: [
      { id: 'agentType', name: 'Agent Type', type: 'select', options: ['all', 'cloud', 'enterprise'] },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'thousandeyes.get_agent_status',
    name: 'Get Agent Status',
    description: 'Get detailed status for a specific agent',
    category: 'network',
    platform: 'thousandeyes',
    icon: '📡',
    endpoint: '/api/thousandeyes/agents/{agentId}',
    method: 'GET',
    parameters: [
      { id: 'agentId', name: 'Agent ID', type: 'string', required: true },
    ],
    verified: true,
    riskLevel: 'low',
  },

  // =============================================================================
  // AI/CUSTOM ACTIONS
  // Note: Notification actions removed - use the dedicated Notification node instead
  // which provides a better UI with channel-specific fields for Slack, Email,
  // Teams, Webex, PagerDuty, and Webhook.
  // =============================================================================
  {
    id: 'ai.summarize_events',
    name: 'AI Summarize Events',
    description: 'Use AI to summarize and correlate network events',
    category: 'custom',
    icon: '📝',
    endpoint: '/api/ai/summarize',
    method: 'POST',
    parameters: [
      { id: 'eventsQuery', name: 'Events Query/Data', type: 'text', required: true },
      { id: 'context', name: 'Additional Context', type: 'text' },
      { id: 'format', name: 'Output Format', type: 'select', options: ['summary', 'bullet_points', 'timeline'] },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'ai.recommend_actions',
    name: 'AI Recommend Actions',
    description: 'Get AI recommendations for remediation steps',
    category: 'custom',
    icon: '💡',
    endpoint: '/api/ai/recommend',
    method: 'POST',
    parameters: [
      { id: 'incidentDescription', name: 'Incident Description', type: 'text', required: true },
      { id: 'includeAutomation', name: 'Include Automation Suggestions', type: 'boolean', default: true },
    ],
    verified: true,
    riskLevel: 'low',
  },
  {
    id: 'custom.webhook',
    name: 'Call Custom Webhook',
    description: 'Send data to any HTTP endpoint',
    category: 'custom',
    icon: '🔗',
    endpoint: '/api/actions/webhook',
    method: 'POST',
    parameters: [
      { id: 'url', name: 'Webhook URL', type: 'string', required: true },
      { id: 'method', name: 'HTTP Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
      { id: 'headers', name: 'Headers (JSON)', type: 'text' },
      { id: 'body', name: 'Body (JSON)', type: 'text' },
    ],
    verified: true,
    riskLevel: 'medium',
  },
  {
    id: 'custom.create_incident',
    name: 'Create Incident',
    description: 'Create an incident record in the system',
    category: 'custom',
    icon: '📋',
    endpoint: '/api/incidents',
    method: 'POST',
    parameters: [
      { id: 'title', name: 'Incident Title', type: 'string', required: true },
      { id: 'description', name: 'Description', type: 'text', required: true },
      { id: 'severity', name: 'Severity', type: 'select', options: ['critical', 'high', 'medium', 'low'], required: true },
      { id: 'rootCause', name: 'Root Cause', type: 'text' },
      { id: 'affectedSystems', name: 'Affected Systems', type: 'string' },
    ],
    verified: true,
    riskLevel: 'low',
  },
];

// Helper functions for action registry
export function getActionById(id: string): ActionDefinition | undefined {
  return ACTION_REGISTRY.find(a => a.id === id);
}

export function getRegistryActionsByCategory(category: WorkflowActionCategory): ActionDefinition[] {
  return ACTION_REGISTRY.filter(a => a.category === category);
}

export function getRegistryActionsByPlatform(platform: WorkflowActionPlatform): ActionDefinition[] {
  return ACTION_REGISTRY.filter(a => a.platform === platform);
}

export function getVerifiedActions(): ActionDefinition[] {
  return ACTION_REGISTRY.filter(a => a.verified);
}

// ============================================================================
// Execution Step Types (for monitoring)
// ============================================================================

export interface ExecutionStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  output?: unknown;
  error?: string;
  duration_ms?: number;
}
