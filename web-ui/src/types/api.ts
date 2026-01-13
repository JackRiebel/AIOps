/**
 * API Response Types
 *
 * This file contains TypeScript interfaces for API responses,
 * eliminating the need for `any` types in api-client.ts
 */

import type { DeviceStatus } from './visualization';

// ============================================================================
// Generic Response Types
// ============================================================================

export interface ApiSuccessResponse {
  success: boolean;
  message?: string;
}

export interface ApiErrorResponse {
  error: string;
  detail?: string;
  status_code?: number;
}

// ============================================================================
// Network List Response Types
// ============================================================================

export interface MerakiNetwork {
  id: string;
  organizationId: string;
  name: string;
  productTypes: string[];
  timeZone?: string;
  tags?: string[];
  enrollmentString?: string;
  url?: string;
  notes?: string;
  isBoundToConfigTemplate?: boolean;
}

export interface MerakiDevice {
  serial: string;
  name: string;
  mac: string;
  networkId: string;
  model: string;
  address?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  tags?: string[];
  lanIp?: string;
  configurationUpdatedAt?: string;
  firmware?: string;
  url?: string;
  // Status fields
  status: string;
  publicIp?: string;
  wan1Ip?: string;
  wan2Ip?: string;
}

export interface NetworkListResponse {
  networks?: MerakiNetwork[];
  devices?: MerakiDevice[];
  // Data field can contain networks or devices depending on the request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any[];
  organization: string;
  count: number;
}

// ============================================================================
// Device Operations Response Types
// ============================================================================

export interface DeviceRebootResponse {
  success: boolean;
  serial: string;
  message: string;
}

export interface DeviceRemoveResponse {
  success: boolean;
  serial: string;
  message: string;
}

// ============================================================================
// Visualization API Response Types
// ============================================================================

export interface NetworkTopologyResponse {
  nodes: Array<{
    id: string;
    serial: string;
    name: string;
    model: string;
    type: string;
    status: string;
    networkId?: string;
    networkName?: string;
    lanIp?: string;
    wan1Ip?: string;
    mac?: string;
    firmware?: string;
    lat?: number;
    lng?: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    speed?: string;
    portFrom?: string;
    portTo?: string;
  }>;
  networkId?: string;
  networkName?: string;
  clientCount?: number;
}

export interface NetworkPerformanceResponse {
  trafficAnalysis?: Array<{
    timestamp: string;
    sent: number;
    recv: number;
  }>;
  performanceScore?: number;
  channelUtilization?: Array<{
    timestamp: string;
    utilization24?: number;
    utilization5?: number;
  }>;
  timespan: number;
}

export interface DeviceHealthResponse {
  lossAndLatency?: {
    timeSeries?: Array<{
      ts: string;
      lossPercent: number;
      latencyMs: number;
    }>;
  };
  uplink?: {
    interface?: string;
    status?: string;
    ip?: string;
    gateway?: string;
    publicIp?: string;
    dns?: string;
  };
}

export interface OrgVpnTopologyResponse {
  organizationId: string;
  nodes: Array<{
    id: string;
    name: string;
    type: 'hub' | 'spoke' | 'standalone';
    vpnMode: string;
    status: DeviceStatus;
    productTypes: string[];
    timeZone?: string;
    peerCount: number;
    connectedHubs: string[];
    subnets: Array<{ localSubnet: string; useVpn: boolean }>;
    merakiVpnPeers: Array<{
      networkId: string;
      networkName: string;
      reachability: 'reachable' | 'unreachable' | 'unknown';
    }>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: 'vpn';
    status: 'reachable' | 'unreachable' | 'unknown';
  }>;
  summary: {
    totalNetworks: number;
    hubCount: number;
    spokeCount: number;
    standaloneCount: number;
    totalVpnTunnels: number;
  };
}

export interface VpnStatusResponse {
  networkId: string;
  networkName: string;
  mode: string;
  peers: Array<{
    networkId: string;
    networkName: string;
    publicIp?: string;
    reachability: 'reachable' | 'unreachable' | 'unknown';
  }>;
}

export interface VpnConfigResponse {
  mode: 'none' | 'hub' | 'spoke';
  hubs?: Array<{
    hubId: string;
    useDefaultRoute: boolean;
  }>;
  subnets?: Array<{
    localSubnet: string;
    useVpn: boolean;
  }>;
}

// ============================================================================
// AI Chat Types
// ============================================================================

export interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  tools_used?: string[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
  };
  duration_ms?: number;
  time_saved_seconds?: number;
  model_name?: string;
  confidence_score?: number;
}

export interface ChatConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  total_cost_usd?: number;
  total_tokens?: number;
}

// ============================================================================
// Feedback Types
// ============================================================================

export interface FeedbackSubmitRequest {
  message_id: number | string;
  conversation_id?: number;
  rating: 'positive' | 'negative';
  comment?: string;
  categories?: string[];
}

export interface FeedbackSubmitResponse {
  success: boolean;
  feedback_id: number;
  message: string;
}

// ============================================================================
// Cost & ROI Types
// ============================================================================

export interface CostSummaryResponse {
  total_cost_usd: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  query_count: number;
  cost_per_1k_tokens: number;
  avg_cost_per_query: number;
  avg_tokens_per_query: number;
  period_start: string;
  period_end: string;
}

export interface SessionROIData {
  session_id: number;
  title: string;
  cost_usd: number;
  time_saved_seconds: number;
  roi_percentage: number;
  created_at: string;
  tools_used: string[];
}

export interface ROISummaryResponse {
  total_ai_cost_usd: number;
  total_time_saved_seconds: number;
  estimated_manual_cost_usd: number;
  roi_percentage: number;
  sessions_count: number;
  avg_time_saved_per_session: number;
  hourly_rate_used: number;
}

// ============================================================================
// Incident Types
// ============================================================================

export interface IncidentResponse {
  id: number;
  title: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  severity: 'critical' | 'high' | 'medium' | 'info';
  start_time: string;
  end_time?: string;
  root_cause_hypothesis?: string;
  confidence_score?: number;
  affected_services: string[];
  event_count: number;
  network_id?: string;
  network_name?: string;
  device_config?: Record<string, unknown>;
  ai_assisted?: boolean;
  ai_session_id?: string;
  ai_time_saved_seconds?: number;
}

export interface IncidentEventResponse {
  id: number;
  incident_id: number;
  source: string;
  title: string;
  severity: string;
  timestamp: string;
  description?: string;
  raw_data?: Record<string, unknown>;
}

// ============================================================================
// Workflow Types (extending existing types)
// ============================================================================

export interface WorkflowExecutionStatsResponse {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  total_ai_cost_usd: number;
  total_time_saved_seconds: number;
  avg_time_saved_per_execution: number;
  roi_percentage: number;
}

// ============================================================================
// System Health Types
// ============================================================================

export interface IntegrationTestResponse {
  success: boolean;
  integration: string;
  message: string;
  response_time_ms?: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  MerakiNetwork as Network,
  MerakiDevice as Device,
};
