/**
 * Chat V2 - Type Definitions
 *
 * Self-contained type definitions for the new chat implementation.
 * Inspired by but independent from the network page types.
 */

// Re-export SmartCard types for convenience
export type {
  SmartCard,
  AllCardTypes,
  CardSize,
  VisualizationType,
  FreshnessStatus,
  CardPlatform,
  VisualizationConfig,
} from './cards/types';

// =============================================================================
// Message Types
// =============================================================================

// Incident context data from incidents page "Ask AI" action
export interface IncidentContextData {
  id: number;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  eventCount: number;
  networkName?: string;
  networkId?: string;
  hypothesis?: string;
  confidenceScore?: number;
  affectedServices?: string[];
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    durationMs?: number;
    toolsUsed?: string[];
    structuredData?: unknown;
    cardIds?: string[]; // IDs of cards generated from this message
    // Incident context from incidents page "Ask AI" action
    incidentContext?: {
      type: 'incident_analysis';
      incident: IncidentContextData;
    };
    // Path analysis context from AI Journey page "Analyze Path" action
    pathAnalysisContext?: {
      type: 'path_analysis';
      pathData: import('./components/PathAnalysisContextCard').PathAnalysisContextData;
    };
    // Test data point context from ThousandEyes Tests page "Ask AI" action
    testDataPointContext?: {
      type: 'test_data_point';
      data: import('./components/TestDataPointContextCard').TestDataPointContextData;
    };
    // Generic TE analysis context from any ThousandEyes "Ask AI" button
    teAnalysisContext?: {
      type: 'te_analysis';
      data: import('./components/TEAnalysisContextCard').TEAnalysisContextData;
    };
  };
}

// =============================================================================
// Canvas Card Types
// =============================================================================

export type CardType =
  | 'network-health'
  | 'device-table'
  | 'client-distribution'
  | 'alert-summary'
  | 'topology'
  | 'performance-chart'
  | 'security-events'
  | 'custom';

export interface CardLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasCard {
  id: string;
  type: CardType;
  title: string;
  layout: CardLayout;
  data?: unknown;
  config?: {
    pinned?: boolean;
    sourceMessageId?: string; // Links card to the message that created it
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Session Types
// =============================================================================

import type { SmartCard } from './cards/types';

// Session version for migration detection
export const CURRENT_SESSION_VERSION = 2;

// Agent flow data types - persisted per session
export interface ToolExecution {
  id: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  startedAt: number;
  completedAt?: number;
  success?: boolean;
}

export interface AgentTurn {
  id: string;
  agentId: string;
  agentName: string;
  query: string;
  status: 'active' | 'complete' | 'error';
  durationMs?: number;
  response?: string;
}

export interface AgentFlowData {
  toolExecutions: ToolExecution[];
  agentTurns: AgentTurn[];
  lastUpdated?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  cards: SmartCard[];  // V2: Now uses SmartCard instead of CanvasCard
  agentFlow?: AgentFlowData;  // Persisted agent flow from last query
  createdAt: string;
  updatedAt: string;
  version?: number;  // For migration detection
  metrics: {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost: number;
    messageCount: number;
    cardCount: number;
  };
}

// Legacy session type for migration
export interface LegacyChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  cards: CanvasCard[];  // Old CanvasCard type
  createdAt: string;
  updatedAt: string;
  version?: number;
  metrics: {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCost: number;
    messageCount: number;
    cardCount: number;
  };
}

export interface SessionListItem {
  id: string;
  name: string;
  updatedAt: string;
  messageCount: number;
}

// =============================================================================
// Streaming Types
// =============================================================================

export type StreamingPhase =
  | 'idle'
  | 'thinking'
  | 'tool_call'
  | 'agent_work'
  | 'streaming'
  | 'synthesizing'
  | 'error';

export interface StreamingState {
  isActive: boolean;
  phase: StreamingPhase;
  currentTool?: string;
  content: string;
  toolsUsed: string[];
}

// =============================================================================
// UI State Types
// =============================================================================

export interface PanelSizes {
  chatWidth: number;
  canvasWidth: number;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  query: string;
  icon: 'network' | 'security' | 'health' | 'help';
}

// =============================================================================
// Card Size Defaults
// =============================================================================

export const CARD_DEFAULT_SIZES: Record<CardType, { w: number; h: number }> = {
  'network-health': { w: 4, h: 3 },
  'device-table': { w: 6, h: 4 },
  'client-distribution': { w: 4, h: 3 },
  'alert-summary': { w: 4, h: 3 },
  'topology': { w: 8, h: 5 },
  'performance-chart': { w: 6, h: 4 },
  'security-events': { w: 6, h: 4 },
  'custom': { w: 4, h: 3 },
};

export const GRID_COLS = 12;
export const GRID_ROW_HEIGHT = 80;
