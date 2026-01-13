// Agent Flow Types - Phase 2 of Chat UI Overhaul
// TypeScript definitions for real-time agent collaboration visualization

import type { Node, Edge } from '@xyflow/react';

// ============================================================================
// Node Types
// ============================================================================

export type AgentNodeStatus = 'idle' | 'active' | 'completed' | 'error';

// Base interface with index signature for React Flow compatibility
export interface BaseNodeData extends Record<string, unknown> {
  label: string;
  status: AgentNodeStatus;
  timestamp?: Date;
}

export interface UserNodeData extends BaseNodeData {
  query: string;
}

export interface OrchestratorNodeData extends BaseNodeData {
  intent?: string;
  routedTo?: AgentType[];
}

export type AgentType = 'knowledge' | 'implementation' | 'tool' | 'specialist';

// Specialist agent identifiers for the new multi-agent system
export type SpecialistAgentId =
  | 'meraki-agent'
  | 'thousandeyes-agent'
  | 'catalyst-agent'
  | 'splunk-agent'
  | 'ui-agent';

// Specialist agent display information
export interface SpecialistAgentInfo {
  id: SpecialistAgentId;
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  darkBgColor: string;
  darkBorderColor: string;
}

// Specialist agent configuration
export const SPECIALIST_AGENTS: Record<SpecialistAgentId, SpecialistAgentInfo> = {
  'meraki-agent': {
    id: 'meraki-agent',
    name: 'Meraki Network Specialist',
    shortName: 'Meraki',
    color: '#00bceb',
    bgColor: 'bg-[#00bceb]/10',
    borderColor: 'border-[#00bceb]',
    darkBgColor: 'dark:bg-[#00bceb]/20',
    darkBorderColor: 'dark:border-[#00bceb]',
  },
  'thousandeyes-agent': {
    id: 'thousandeyes-agent',
    name: 'ThousandEyes Monitoring Specialist',
    shortName: 'ThousandEyes',
    color: '#ff6b35',
    bgColor: 'bg-[#ff6b35]/10',
    borderColor: 'border-[#ff6b35]',
    darkBgColor: 'dark:bg-[#ff6b35]/20',
    darkBorderColor: 'dark:border-[#ff6b35]',
  },
  'catalyst-agent': {
    id: 'catalyst-agent',
    name: 'Catalyst Center Specialist',
    shortName: 'Catalyst',
    color: '#6abf4b',
    bgColor: 'bg-[#6abf4b]/10',
    borderColor: 'border-[#6abf4b]',
    darkBgColor: 'dark:bg-[#6abf4b]/20',
    darkBorderColor: 'dark:border-[#6abf4b]',
  },
  'splunk-agent': {
    id: 'splunk-agent',
    name: 'Splunk Log Analysis Specialist',
    shortName: 'Splunk',
    color: '#65a637',
    bgColor: 'bg-[#65a637]/10',
    borderColor: 'border-[#65a637]',
    darkBgColor: 'dark:bg-[#65a637]/20',
    darkBorderColor: 'dark:border-[#65a637]',
  },
  'ui-agent': {
    id: 'ui-agent',
    name: 'UI Visualization Agent',
    shortName: 'UI',
    color: '#9b59b6',
    bgColor: 'bg-[#9b59b6]/10',
    borderColor: 'border-[#9b59b6]',
    darkBgColor: 'dark:bg-[#9b59b6]/20',
    darkBorderColor: 'dark:border-[#9b59b6]',
  },
};

// ============================================================================
// Platform Types (for tool-based flow visualization)
// ============================================================================

export type PlatformId = 'meraki' | 'catalyst' | 'thousandeyes' | 'splunk' | 'knowledge';

export interface PlatformConfig {
  name: string;
  color: string;
  icon: string;
  bgColor: string;
  borderColor: string;
}

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  meraki: {
    name: 'Meraki',
    color: '#00bceb',
    icon: '🌐',
    bgColor: 'bg-[#00bceb]/10',
    borderColor: 'border-[#00bceb]',
  },
  catalyst: {
    name: 'Catalyst',
    color: '#049fd9',
    icon: '🔧',
    bgColor: 'bg-[#049fd9]/10',
    borderColor: 'border-[#049fd9]',
  },
  thousandeyes: {
    name: 'ThousandEyes',
    color: '#ff6b35',
    icon: '👁',
    bgColor: 'bg-[#ff6b35]/10',
    borderColor: 'border-[#ff6b35]',
  },
  splunk: {
    name: 'Splunk',
    color: '#65a637',
    icon: '📊',
    bgColor: 'bg-[#65a637]/10',
    borderColor: 'border-[#65a637]',
  },
  knowledge: {
    name: 'Knowledge',
    color: '#9333ea',
    icon: '📚',
    bgColor: 'bg-[#9333ea]/10',
    borderColor: 'border-[#9333ea]',
  },
};

export interface PlatformNodeData extends BaseNodeData {
  platform: PlatformId;
  currentTool?: string;
  toolsExecuted: string[];
  duration?: number;
}

// Helper function to extract platform from tool name
// Handles both direct tool names (meraki_*, thousandeyes_*) and
// Claude service names (get_meraki_*, get_thousandeyes_*)
export function getPlatformFromTool(toolName: string): PlatformId | null {
  const name = toolName.toLowerCase();

  // Check for meraki tools
  if (name.startsWith('meraki_') || name.includes('_meraki_') || name.startsWith('get_meraki')) return 'meraki';

  // Check for catalyst tools
  if (name.startsWith('catalyst_') || name.includes('_catalyst_') || name.startsWith('get_catalyst')) return 'catalyst';

  // Check for thousandeyes tools (various patterns)
  if (name.startsWith('thousandeyes_') || name.includes('thousandeyes') || name.startsWith('get_thousandeyes')) return 'thousandeyes';

  // Check for splunk tools
  if (name.startsWith('splunk_') || name.includes('_splunk_') || name.startsWith('get_splunk') || name.includes('splunk_search')) return 'splunk';

  // Check for knowledge tools
  if (name.startsWith('knowledge_') || name.includes('_knowledge') || name.startsWith('consult_knowledge')) return 'knowledge';

  return null;
}

export interface AgentNodeData extends BaseNodeData {
  agentType: AgentType;
  query?: string;
  confidence?: number;
  sourcesCount?: number;
  stepsCount?: number;
  responsePreview?: string;
  duration?: number;
  // Enhanced enterprise features
  thought?: string;
  currentTool?: string;
  toolsUsed?: string[];
  tokensUsed?: { input: number; output: number };
  error?: string;
  isExpanded?: boolean;
  // Specialist agent fields
  specialistAgentId?: SpecialistAgentId;
  artifactsCount?: number;
  entitiesExtracted?: string[];
  turnNumber?: number;
}

export interface ResponseNodeData extends BaseNodeData {
  tokensUsed?: {
    input: number;
    output: number;
  };
  toolsUsed?: string[];
}

// ============================================================================
// Typed Node Definitions
// ============================================================================

export type UserNode = Node<UserNodeData, 'user'>;
export type OrchestratorNode = Node<OrchestratorNodeData, 'orchestrator'>;
export type AgentNode = Node<AgentNodeData, 'agent'>;
export type ResponseNode = Node<ResponseNodeData, 'response'>;
export type PlatformNode = Node<PlatformNodeData, 'platform'>;

export type FlowNode = UserNode | OrchestratorNode | AgentNode | ResponseNode | PlatformNode;

// ============================================================================
// Edge Types
// ============================================================================

export type EdgeStatus = 'idle' | 'active' | 'completed';

// Edge data interface with index signature for React Flow compatibility
export interface AnimatedEdgeData extends Record<string, unknown> {
  status: EdgeStatus;
  label?: string;
  animated?: boolean;
}

export type FlowEdge = Edge<AnimatedEdgeData>;

// ============================================================================
// Flow State
// ============================================================================

export interface AgentFlowState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  isActive: boolean;
  currentPhase: FlowPhase;
  timeline?: TimelineEvent[];
}

export type FlowPhase =
  | 'idle'
  | 'user_query'
  | 'orchestrator_routing'
  | 'agent_processing'
  | 'response_generation'
  | 'complete';

// ============================================================================
// SSE Event Types (maps to backend streaming events)
// ============================================================================

// Legacy event types (for backward compatibility)
export interface ThinkingEvent {
  type: 'thinking';
}

export interface TextDeltaEvent {
  type: 'text_delta';
  text: string;
}

export interface ToolUseStartEvent {
  type: 'tool_use_start';
  tool: string;
}

export interface ToolUseProgressEvent {
  type: 'tool_use_progress';
  tool: string;
  progress: unknown;
}

export interface ToolUseCompleteEvent {
  type: 'tool_use_complete';
  tool: string;
  success: boolean;
}

export interface AgentActivityStartEvent {
  type: 'agent_activity_start';
  agent: string;
  query?: string;
  agentId?: string;  // Specific agent ID (e.g., "meraki-agent")
  agentName?: string;  // Display name (e.g., "Meraki Specialist")
}

export interface AgentActivityCompleteEvent {
  type: 'agent_activity_complete';
  agent: string;
  success: boolean;
  confidence?: number;
  sources_count?: number;
  steps_count?: number;
  response_summary?: string;
  agentId?: string;  // Specific agent ID for matching the start event
  agentName?: string;  // Display name
}

export interface DoneEvent {
  type: 'done';
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  tools_used?: string[];
  workflow?: WorkflowSummary;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
  code?: string;
}

// ============================================================================
// Enterprise Event Types (new protocol)
// ============================================================================

export type EnterpriseAgentType =
  | 'orchestrator'
  | 'knowledge'
  | 'implementation'
  | 'specialist'
  | 'tool_executor';

export type EnterpriseEventStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'error'
  | 'skipped';

export interface WorkflowStartEvent {
  type: 'workflow_start';
  agent_id: string;
  agent_type: EnterpriseAgentType;
  workflow_id: string;
  timestamp: string;
  status: EnterpriseEventStatus;
  metadata: {
    query: string;
    organization?: string | null;
  };
}

export interface WorkflowCompleteEvent {
  type: 'workflow_complete';
  agent_id: string;
  agent_type: EnterpriseAgentType;
  workflow_id: string;
  timestamp: string;
  status: EnterpriseEventStatus;
  duration_ms?: number;
  tokens_used?: { input: number; output: number };
  metadata: {
    agents_used: string[];
    tools_called: string[];
    total_cost: number;
  };
}

export interface AgentSpawnEvent {
  type: 'agent_spawn';
  agent_id: string;
  agent_type: EnterpriseAgentType;
  workflow_id: string;
  timestamp: string;
  status: EnterpriseEventStatus;
  metadata: {
    purpose: string;
  };
}

export interface AgentThinkingEvent {
  type: 'agent_thinking';
  agent_id: string;
  agent_type: EnterpriseAgentType;
  workflow_id: string;
  timestamp: string;
  status: EnterpriseEventStatus;
  metadata: {
    thought: string;
    confidence?: number | null;
  };
}

export interface AgentResponseEvent {
  type: 'agent_response';
  agent_id: string;
  agent_type: EnterpriseAgentType;
  workflow_id: string;
  timestamp: string;
  status: EnterpriseEventStatus;
  tokens_used?: { input: number; output: number };
  metadata: {
    response_preview: string;
  };
}

export interface ToolCallStartEvent {
  type: 'tool_call_start';
  agent_id: string;
  agent_type: EnterpriseAgentType;
  workflow_id: string;
  timestamp: string;
  status: EnterpriseEventStatus;
  metadata: {
    tool_name: string;
    parameters: Record<string, string>;
    reason?: string | null;
  };
}

export interface ToolCallCompleteEvent {
  type: 'tool_call_complete' | 'tool_call_error';
  agent_id: string;
  agent_type: EnterpriseAgentType;
  workflow_id: string;
  timestamp: string;
  status: EnterpriseEventStatus;
  duration_ms?: number;
  error?: string;
  metadata: {
    tool_name: string;
    success: boolean;
    result_summary?: string | null;
  };
}

export interface AgentHandoffEvent {
  type: 'agent_handoff';
  agent_id: string;
  agent_type: EnterpriseAgentType;
  workflow_id: string;
  timestamp: string;
  status: EnterpriseEventStatus;
  metadata: {
    to_agent: string;
    to_type: EnterpriseAgentType;
    context_summary: string;
  };
}

export interface WorkflowSummary {
  workflow_id: string;
  user_query: string;
  organization?: string | null;
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  status: EnterpriseEventStatus;
  agents_used: string[];
  tools_called: string[];
  total_tokens: { input: number; output: number };
  total_cost: number;
  error?: string | null;
  event_count: number;
}

// ============================================================================
// Multi-Agent Orchestrator Events (new specialist agent protocol)
// ============================================================================

export interface OrchestratorRoutingEvent {
  type: 'orchestrator_routing';
  routing_decision: {
    primary_agent: string;
    primary_agent_name: string;
    primary_skill: string;
    secondary_agents: string[];
    confidence: number;
    reasoning: string;
    parallel_execution: boolean;
  };
}

export interface TurnStartEvent {
  type: 'turn_start';
  turn_number: number;
  agent_id: string;
  agent_name: string;
  query: string;
  turn_type: 'specialist' | 'synthesis' | 'follow_up';
}

export interface TurnProgressEvent {
  type: 'turn_progress';
  turn_number: number;
  agent_id: string;
  status: 'executing_skill' | 'processing' | 'extracting_entities';
  detail?: string;
}

export interface TurnCompleteEvent {
  type: 'turn_complete';
  turn_number: number;
  agent_id: string;
  agent_name: string;
  success: boolean;
  duration_ms: number;
  artifacts_count: number;
  entities_extracted: string[];
  response_preview?: string;
  error?: string;
}

export interface ParallelStartEvent {
  type: 'parallel_start';
  agents: string[];
  agent_names: string[];
  queries: string[];
}

export interface ParallelCompleteEvent {
  type: 'parallel_complete';
  agents_completed: string[];
  total_duration_ms: number;
  all_succeeded: boolean;
}

export interface MultiAgentHandoffEvent {
  type: 'multi_agent_handoff';
  from_agent: string;
  from_agent_name: string;
  to_agent: string;
  to_agent_name: string;
  context_summary: string;
  entities_passed: string[];
}

export interface SynthesisStartEvent {
  type: 'synthesis_start';
  agents_to_synthesize: string[];
  turn_count: number;
  total_entities: Record<string, number>;
}

export interface WorkflowInfoEvent {
  type: 'workflow_info';
  model: {
    model_id: string;
    temperature: number;
    max_tokens: number;
  };
}

export interface QueryCorrection {
  original: string;
  corrected: string;
  confidence: number;
  method: 'dictionary' | 'fuzzy' | 'abbreviation' | 'phonetic';
}

export interface QueryPreprocessedEvent {
  type: 'query_preprocessed';
  preprocessing: {
    original_query: string;
    corrected_query: string;
    corrections: QueryCorrection[];
    overall_confidence: number;
  };
}

export interface MultiAgentDoneEvent {
  type: 'multi_agent_done';
  conversation_id: string;
  total_turns: number;
  agents_consulted: string[];
  total_duration_ms: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  entities_discovered: Record<string, string[]>;
}

// Union of all multi-agent events
export type MultiAgentEvent =
  | OrchestratorRoutingEvent
  | TurnStartEvent
  | TurnProgressEvent
  | TurnCompleteEvent
  | ParallelStartEvent
  | ParallelCompleteEvent
  | MultiAgentHandoffEvent
  | SynthesisStartEvent
  | WorkflowInfoEvent
  | QueryPreprocessedEvent
  | MultiAgentDoneEvent;

// Union of all enterprise events
export type EnterpriseEvent =
  | WorkflowStartEvent
  | WorkflowCompleteEvent
  | AgentSpawnEvent
  | AgentThinkingEvent
  | AgentResponseEvent
  | ToolCallStartEvent
  | ToolCallCompleteEvent
  | AgentHandoffEvent;

// Combined SSE event type (supports legacy, enterprise, and multi-agent)
export type SSEEvent =
  | ThinkingEvent
  | TextDeltaEvent
  | ToolUseStartEvent
  | ToolUseProgressEvent
  | ToolUseCompleteEvent
  | AgentActivityStartEvent
  | AgentActivityCompleteEvent
  | DoneEvent
  | ErrorEvent
  | EnterpriseEvent
  | MultiAgentEvent;

// ============================================================================
// Hook Return Types
// ============================================================================

// Timeline event for tracking all events during a flow
export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: string;
  title: string;
  description?: string;
  details?: Record<string, unknown>;
  status?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  agentId?: string;
  toolName?: string;
}

// Forward declaration for persistence type (defined in session.ts to avoid circular imports)
export interface PersistedAgentFlowStateRef {
  nodes: FlowNode[];
  edges: FlowEdge[];
  currentPhase: FlowPhase;
  timeline: Array<{ id: string; timestamp: string; type: string; title: string; description?: string; details?: Record<string, unknown>; status?: 'success' | 'error' | 'info' | 'warning'; duration?: number; agentId?: string; toolName?: string; }>;
  isExpanded: boolean;
  platformNodes: string[];
  toolsUsed: string[];
  duration?: number;
}

export interface UseAgentFlowReturn {
  nodes: FlowNode[];
  edges: FlowEdge[];
  isActive: boolean;
  currentPhase: FlowPhase;
  timeline: TimelineEvent[];
  startFlow: (query: string) => void;
  handleEvent: (event: SSEEvent) => void;
  resetFlow: () => void;
  /** Get current flow state for persistence */
  getFlowState: () => PersistedAgentFlowStateRef | undefined;
  /** Restore flow from persisted state */
  restoreFlow: (savedState: PersistedAgentFlowStateRef) => void;
}

// ============================================================================
// Multi-Agent Chat State Types
// ============================================================================

export interface ConversationTurn {
  turnId: string;
  turnNumber: number;
  agentId: string;
  agentName: string;
  query: string;
  response?: string;
  turnType: 'specialist' | 'synthesis' | 'follow_up';
  status: 'pending' | 'active' | 'completed' | 'error';
  durationMs?: number;
  artifactsCount?: number;
  entitiesExtracted?: string[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface RoutingDecision {
  primaryAgent: string;
  primaryAgentName: string;
  primarySkill: string;
  secondaryAgents: string[];
  confidence: number;
  reasoning: string;
  parallelExecution: boolean;
}

export interface ModelInfo {
  modelId: string;
  temperature: number;
  maxTokens: number;
}

export interface MultiAgentChatState {
  conversationId?: string;
  conversationTurns: ConversationTurn[];
  currentTurn: number;
  activeAgents: string[];
  routingDecision?: RoutingDecision;
  modelInfo?: ModelInfo;
  isParallelExecution: boolean;
  isSynthesizing: boolean;
  entitiesDiscovered: Record<string, string[]>;
  agentsConsulted: string[];
  totalDurationMs?: number;
}

// ============================================================================
// Component Props
// ============================================================================

export interface AgentFlowDiagramProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  isActive: boolean;
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

export interface UserNodeProps {
  data: UserNodeData;
}

export interface OrchestratorNodeProps {
  data: OrchestratorNodeData;
}

export interface AgentNodeProps {
  data: AgentNodeData;
}

export interface ResponseNodeProps {
  data: ResponseNodeData;
}

// ============================================================================
// Layout Constants
// ============================================================================

export const FLOW_LAYOUT = {
  userNode: { x: 50, y: 200 },
  orchestratorNode: { x: 250, y: 200 },
  knowledgeAgentNode: { x: 450, y: 100 },
  implementationAgentNode: { x: 450, y: 300 },
  responseNode: { x: 650, y: 200 },
} as const;

export const NODE_DIMENSIONS = {
  user: { width: 150, height: 80 },
  orchestrator: { width: 150, height: 100 },
  agent: { width: 180, height: 120 },
  response: { width: 150, height: 80 },
} as const;
