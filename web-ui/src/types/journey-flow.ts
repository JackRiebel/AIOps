import type { Node, Edge } from '@xyflow/react';
import type { NetworkHop, SpanStatus } from './ai-trace';

// ============================================================================
// TE Enrichment Types
// ============================================================================

export interface TEPathHop {
  ip: string;
  prefix: string;
  delay: number;
  loss: number;
  network: string;
  rdns: string;
  asNumber?: string;
  location?: string;
  mpls?: { label: number; ttl: number }[];
}

export interface TENetworkMetrics {
  loss: number;
  latency: number;
  jitter: number;
  bandwidth?: number;
}

export interface TEBGPRoute {
  prefix: string;
  asPath: number[];
  reachability: number;
  updates: number;
  monitor: string;
}

export interface TEHttpTiming {
  dnsTime: number;
  connectTime: number;
  sslTime: number;
  waitTime: number;
  receiveTime: number;
  responseTime: number;
  wireSize: number;
  throughput?: number;
}

export interface TEEnrichment {
  path_hops: TEPathHop[];
  network_metrics: TENetworkMetrics | null;
  bgp_routes: TEBGPRoute[];
  http_timing: TEHttpTiming | null;
  test_id: number | null;
  test_type: string | null;
  agent_name: string | null;
}

export interface SpanCostImpact {
  costUsd: number;
  baselineLatencyMs: number | null;
  actualLatencyMs: number | null;
  excessLatencyMs: number;
  wastedComputeUsd: number;
}

export interface JourneyCostSummary {
  totalCostUsd: number;
  totalNetworkTaxMs: number;
  totalRawNetworkMs?: number;
  avgRawNetworkMs?: number;
  totalWastedUsd: number;
  networkTaxPct: number;
  userWaitMs?: number;
}

// ============================================================================
// Node Data Types
// ============================================================================

export interface BaseJourneyNodeData extends Record<string, unknown> {
  label: string;
}

export interface UserQueryNodeData extends BaseJourneyNodeData {
  query: string;
  timestamp: string;
}

export interface AIProviderNodeData extends BaseJourneyNodeData {
  model: string | null;
  provider: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  ttfbMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  serverIp: string | null;
  tlsVersion: string | null;
  httpVersion: string | null;
  iteration: number;
  durationMs: number | null;
  status: SpanStatus;
  anomalies?: AnomalyFlags;
  baseline?: BaselineInfo;
  teEnrichment?: TEEnrichment;
  costImpact?: SpanCostImpact;
}

export interface ToolBranchNodeData extends BaseJourneyNodeData {
  toolName: string;
  platform: string | null;
  platformColor: string;
  durationMs: number | null;
  success: boolean | null;
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  serverIp: string | null;
  status: SpanStatus;
  anomalies?: AnomalyFlags;
  baseline?: BaselineInfo;
  teEnrichment?: TEEnrichment;
  costImpact?: SpanCostImpact;
}

export interface NetworkSegmentNodeData extends BaseJourneyNodeData {
  destination: string;
  platform: string | null;
  hops: NetworkHop[];
  totalLatency: number;
  isExpanded: boolean;
  hasAnomaly: boolean;
  onToggle?: () => void;
  teEnrichment?: TEEnrichment;
  tcpMs?: number | null;
  tlsMs?: number | null;
  ttfbMs?: number | null;
  serverIp?: string | null;
  tlsVersion?: string | null;
  httpVersion?: string | null;
}

export interface PlatformEndpointNodeData extends BaseJourneyNodeData {
  platform: string | null;
  platformColor: string;
  serverIp: string | null;
  serverPort: number | null;
  tlsVersion: string | null;
  httpVersion: string | null;
}

export interface SynthesisNodeData extends BaseJourneyNodeData {
  durationMs: number | null;
  tokens: number;
  costUsd: number | null;
}

export interface ResponseNodeData extends BaseJourneyNodeData {
  totalDurationMs: number | null;
  totalCostUsd: number;
  totalTokens: number;
  status: SpanStatus;
  costSummary?: JourneyCostSummary;
  tokenWaste?: { retryCount: number; wastedTokens: number };
  userImpact?: { p50WaitMs: number; p95WaitMs: number; timeoutProbability: number; addedWaitMs: number };
}

// ============================================================================
// Edge Data
// ============================================================================

export interface LatencyEdgeData extends Record<string, unknown> {
  latencyMs: number | null;
  platformColor: string | null;
  animated: boolean;
  dashed: boolean;
}

// ============================================================================
// Baselines & Anomalies
// ============================================================================

export interface BaselineInfo {
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  durationMs: number | null;
  isValid: boolean;
}

export interface AnomalyFlags {
  tcpSlow: boolean;
  tlsSlow: boolean;
  ttfbSlow: boolean;
  durationSlow: boolean;
}

// ============================================================================
// Typed Node/Edge Definitions
// ============================================================================

export type UserQueryNode = Node<UserQueryNodeData, 'userQuery'>;
export type AIProviderNode = Node<AIProviderNodeData, 'aiProvider'>;
export type ToolBranchNode = Node<ToolBranchNodeData, 'toolBranch'>;
export type NetworkSegmentNode = Node<NetworkSegmentNodeData, 'networkSegment'>;
export type PlatformEndpointNode = Node<PlatformEndpointNodeData, 'platformEndpoint'>;
export type SynthesisNode = Node<SynthesisNodeData, 'synthesis'>;
export type ResponseNode = Node<ResponseNodeData, 'response'>;

export type JourneyNode =
  | UserQueryNode
  | AIProviderNode
  | ToolBranchNode
  | NetworkSegmentNode
  | PlatformEndpointNode
  | SynthesisNode
  | ResponseNode;

export type JourneyEdge = Edge<LatencyEdgeData>;

// ============================================================================
// Journey Node Type Keys
// ============================================================================

export type JourneyNodeType =
  | 'userQuery'
  | 'aiProvider'
  | 'toolBranch'
  | 'networkSegment'
  | 'platformEndpoint'
  | 'synthesis'
  | 'response';
