// Agent Flow Components - Phase 2 of Chat UI Overhaul
// Real-time agent collaboration visualization with React Flow

// Main Diagram Component
export { AgentFlowDiagram } from './AgentFlowDiagram';
export type { AgentFlowDiagramProps } from '@/types/agent-flow';

// Hook for managing flow state
export { useAgentFlow } from '@/hooks/useAgentFlow';

// Node Components
export { UserNode } from './nodes/UserNode';
export { OrchestratorNode } from './nodes/OrchestratorNode';
export { AgentNode } from './nodes/AgentNode';
export { ResponseNode } from './nodes/ResponseNode';

// Edge Components
export { AnimatedEdge } from './edges/AnimatedEdge';

// Re-export types for convenience
export type {
  // Node Data Types
  BaseNodeData,
  UserNodeData,
  OrchestratorNodeData,
  AgentNodeData,
  ResponseNodeData,
  AgentNodeStatus,
  AgentType,
  // Typed Node Types
  UserNode as UserNodeType,
  OrchestratorNode as OrchestratorNodeType,
  AgentNode as AgentNodeType,
  ResponseNode as ResponseNodeType,
  FlowNode,
  // Edge Types
  EdgeStatus,
  AnimatedEdgeData,
  FlowEdge,
  // Flow State Types
  AgentFlowState,
  FlowPhase,
  // SSE Event Types
  SSEEvent,
  ThinkingEvent,
  TextDeltaEvent,
  ToolUseStartEvent,
  ToolUseProgressEvent,
  ToolUseCompleteEvent,
  AgentActivityStartEvent,
  AgentActivityCompleteEvent,
  DoneEvent,
  ErrorEvent,
  // Hook Types
  UseAgentFlowReturn,
  // Layout Constants
  FLOW_LAYOUT,
  NODE_DIMENSIONS,
} from '@/types/agent-flow';
