/**
 * React hook for consuming Server-Sent Events (SSE) streaming chat responses.
 * Enhanced with agent activity tracking and streaming status for Phase 1 chat components.
 * Now includes multi-agent orchestration support for specialist agent coordination.
 *
 * Usage:
 *   const {
 *     streamMessage,
 *     isStreaming,
 *     streamingStatus,
 *     streamingToolName,
 *     agentActivity,
 *     streamedContent,
 *     error,
 *     // Multi-agent state
 *     conversationTurns,
 *     currentTurn,
 *     activeAgents,
 *     routingDecision,
 *     isParallelExecution,
 *     isSynthesizing,
 *   } = useStreamingChat();
 *   await streamMessage({ message: "Hello", organization: "my-org" });
 */

import { useState, useCallback, useRef } from 'react';
import type { StreamingStatus, AgentActivityInfo } from '@/components/chat';
import type { ConversationTurn, RoutingDecision, ModelInfo } from '@/types/agent-flow';

// Card suggestion from knowledge retrieval
export interface CardSuggestion {
  type: string;
  title: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface StreamingChatOptions {
  message: string;
  organization?: string | null;
  network_id?: string | null;  // User's currently selected network (for card context)
  orgDisplayNames?: Record<string, string>;  // Map of org name -> display name
  session_id?: string;  // AI session ID for tracking and conversation memory persistence
  history?: Array<{ role: string; content: string }>;
  // Card context from "Ask about this" feature (networkId, deviceSerial, orgId)
  cardContext?: Record<string, string>;
  // Use multi-agent endpoint instead of legacy chat endpoint
  useMultiAgent?: boolean;
  maxTurns?: number;
  // Edit mode - when true, write/update/delete operations are allowed
  edit_mode?: boolean;
  // Verbosity level for AI responses
  verbosity?: 'brief' | 'standard' | 'detailed';
  // Legacy callbacks
  onThinking?: () => void;
  onTextDelta?: (text: string) => void;
  onToolStart?: (tool: string) => void;
  onToolProgress?: (tool: string, progress: any) => void;
  onToolComplete?: (tool: string, success: boolean) => void;
  onAgentActivityStart?: (agent: string, query?: string) => void;
  onAgentActivityComplete?: (agent: string, result: AgentActivityResult) => void;
  onComplete?: (usage: { input_tokens: number; output_tokens: number }, tools_used: string[]) => void;
  onError?: (error: string) => void;
  // Card suggestion callback (for knowledge sources, etc.)
  onCardSuggestion?: (card: CardSuggestion) => void;
  // Multi-agent callbacks
  onOrchestratorRouting?: (decision: RoutingDecision) => void;
  onTurnStart?: (turn: ConversationTurn) => void;
  onTurnComplete?: (turn: ConversationTurn) => void;
  onParallelStart?: (agents: string[], agentNames: string[]) => void;
  onParallelComplete?: (agents: string[], allSucceeded: boolean) => void;
  onAgentHandoff?: (fromAgent: string, toAgent: string, context: string) => void;
  onSynthesisStart?: (agents: string[], turnCount: number) => void;
  onMultiAgentComplete?: (summary: MultiAgentSummary) => void;
}

export interface AgentActivityResult {
  success: boolean;
  confidence?: number;
  sources_count?: number;
  steps_count?: number;
  response_summary?: string;
}

export interface MultiAgentSummary {
  conversationId: string;
  totalTurns: number;
  agentsConsulted: string[];
  totalDurationMs: number;
  entitiesDiscovered: Record<string, string[]>;
  usage: { input_tokens: number; output_tokens: number; cost_usd?: number };
}

export interface StreamingChatResult {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cost_usd?: number;
  };
  tools_used: string[];
  tool_data?: Array<{ tool: string; data: any }>;
  card_suggestions?: CardSuggestion[];
  error?: string;
}

export function useStreamingChat() {
  // Legacy state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>('idle');
  const [streamingToolName, setStreamingToolName] = useState<string | undefined>(undefined);
  const [agentActivity, setAgentActivity] = useState<AgentActivityInfo | undefined>(undefined);
  const [streamedContent, setStreamedContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Multi-agent orchestration state
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [routingDecision, setRoutingDecision] = useState<RoutingDecision | undefined>(undefined);
  const [modelInfo, setModelInfo] = useState<ModelInfo | undefined>(undefined);
  const [isParallelExecution, setIsParallelExecution] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [agentsConsulted, setAgentsConsulted] = useState<string[]>([]);
  const [entitiesDiscovered, setEntitiesDiscovered] = useState<Record<string, string[]>>({});

  // Card suggestions from knowledge retrieval
  const [cardSuggestions, setCardSuggestions] = useState<CardSuggestion[]>([]);

  const streamMessage = useCallback(async (options: StreamingChatOptions): Promise<StreamingChatResult> => {
    const {
      message,
      organization,
      network_id,
      orgDisplayNames,
      session_id,
      history = [],
      useMultiAgent = true,  // Default to multi-agent orchestrator with specialist agents
      maxTurns = 10,
      // Legacy callbacks
      onThinking,
      onTextDelta,
      onToolStart,
      onToolProgress,
      onToolComplete,
      onAgentActivityStart,
      onAgentActivityComplete,
      onComplete,
      onError,
      // Card suggestion callback
      onCardSuggestion,
      // Multi-agent callbacks
      onOrchestratorRouting,
      onTurnStart,
      onTurnComplete,
      onParallelStart,
      onParallelComplete,
      onAgentHandoff,
      onSynthesisStart,
      onMultiAgentComplete,
    } = options;

    // Reset legacy state
    setIsStreaming(true);
    setStreamingStatus('thinking');
    setStreamingToolName(undefined);
    setAgentActivity(undefined);
    setStreamedContent('');
    setError(null);

    // Reset multi-agent state
    setConversationTurns([]);
    setCurrentTurn(0);
    setActiveAgents([]);
    setRoutingDecision(undefined);
    setModelInfo(undefined);
    setIsParallelExecution(false);
    setIsSynthesizing(false);
    setAgentsConsulted([]);
    setEntitiesDiscovered({});

    // Reset card suggestions
    setCardSuggestions([]);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    let fullContent = '';
    let usage = { input_tokens: 0, output_tokens: 0 };
    let tools_used: string[] = [];
    let tool_data: Array<{ tool: string; data: any }> | undefined;
    let result_card_suggestions: CardSuggestion[] = [];
    let errorMessage: string | undefined;

    try {
      // Choose endpoint based on mode
      const endpoint = useMultiAgent ? '/api/agent/chat/stream' : '/api/network/chat/stream';
      const requestBody = useMultiAgent
        ? {
            message,
            organization,
            network_id: network_id || undefined,  // User's currently selected network for card context
            org_display_names: orgDisplayNames,
            session_id,  // Pass AI session ID for conversation memory persistence
            history,
            max_turns: maxTurns,
            edit_mode: options.edit_mode || false,  // Pass edit mode to backend
            verbosity: options.verbosity || 'standard',  // Response detail level
            card_context: options.cardContext,  // Card context from "Ask about this" feature
          }
        : {
            message,
            organization,
            network_id: network_id || undefined,  // User's currently selected network for card context
            org_display_names: orgDisplayNames,
            session_id,
            history,
            edit_mode: options.edit_mode || false,  // Pass edit mode to backend
            verbosity: options.verbosity || 'standard',  // Response detail level
            card_context: options.cardContext,  // Card context from "Ask about this" feature
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr) {
              try {
                const event = JSON.parse(jsonStr);

                switch (event.type) {
                  case 'thinking':
                    setStreamingStatus('thinking');
                    onThinking?.();
                    break;

                  case 'text_delta':
                    if (streamingStatus !== 'streaming') {
                      setStreamingStatus('streaming');
                    }
                    fullContent += event.text;
                    setStreamedContent(fullContent);
                    onTextDelta?.(event.text);
                    break;

                  case 'tool_use_start':
                    setStreamingStatus('tool_use');
                    setStreamingToolName(event.tool);
                    onToolStart?.(event.tool);
                    break;

                  case 'tool_use_progress':
                    onToolProgress?.(event.tool, event.progress);
                    break;

                  case 'tool_use_complete':
                    setStreamingStatus('thinking');
                    setStreamingToolName(undefined);
                    onToolComplete?.(event.tool, event.success);
                    break;

                  case 'agent_activity_start':
                    setStreamingStatus('agent_activity');
                    setAgentActivity({
                      agent: event.agent,
                      query: event.query,
                    });
                    onAgentActivityStart?.(event.agent, event.query);
                    break;

                  case 'agent_activity_complete':
                    const result: AgentActivityResult = {
                      success: event.success ?? true,
                      confidence: event.confidence,
                      sources_count: event.sources_count,
                      steps_count: event.steps_count,
                      response_summary: event.response_summary,
                    };
                    setAgentActivity((prev) => prev ? {
                      ...prev,
                      success: result.success,
                      confidence: result.confidence,
                      sources_count: result.sources_count,
                      steps_count: result.steps_count,
                    } : undefined);
                    setStreamingStatus('thinking');
                    onAgentActivityComplete?.(event.agent, result);
                    break;

                  case 'done':
                    setStreamingStatus('idle');
                    setStreamingToolName(undefined);
                    setAgentActivity(undefined);
                    setStreamedContent(''); // Clear streaming content when done
                    setIsSynthesizing(false);
                    setActiveAgents([]);
                    usage = event.usage || { input_tokens: 0, output_tokens: 0 };
                    tools_used = event.tools_used || [];
                    tool_data = event.tool_data || undefined;
                    onComplete?.(usage, tools_used);
                    break;

                  case 'card_suggestion': {
                    // Knowledge sources or other card suggestions from the backend
                    const card: CardSuggestion = event.card;
                    if (card) {
                      result_card_suggestions.push(card);
                      setCardSuggestions(prev => [...prev, card]);
                      onCardSuggestion?.(card);
                    }
                    break;
                  }

                  case 'error':
                    setStreamingStatus('error');
                    setStreamedContent(''); // Clear streaming content on error
                    errorMessage = event.error;
                    setError(event.error);
                    onError?.(event.error);
                    break;

                  // ============================================
                  // Multi-Agent Orchestrator Events
                  // ============================================

                  case 'workflow_info': {
                    const info: ModelInfo = {
                      modelId: event.model?.model_id || 'unknown',
                      temperature: event.model?.temperature ?? 0.7,
                      maxTokens: event.model?.max_tokens ?? 4096,
                    };
                    setModelInfo(info);
                    break;
                  }

                  case 'orchestrator_routing': {
                    // Backend sends fields directly, not nested under routing_decision
                    const decision: RoutingDecision = {
                      primaryAgent: event.primary_agent,
                      primaryAgentName: event.primary_agent_name,
                      primarySkill: event.primary_skill,
                      secondaryAgents: event.secondary_agents || [],
                      confidence: event.confidence,
                      reasoning: event.reasoning,
                      parallelExecution: event.parallel_execution || false,
                    };
                    setRoutingDecision(decision);
                    setStreamingStatus('agent_activity');
                    onOrchestratorRouting?.(decision);
                    break;
                  }

                  case 'turn_start': {
                    const turn: ConversationTurn = {
                      turnId: `turn-${event.turn_number}`,
                      turnNumber: event.turn_number,
                      agentId: event.agent_id,
                      agentName: event.agent_name,
                      query: event.query,
                      turnType: event.turn_type || 'specialist',
                      status: 'active',
                      startedAt: new Date(),
                    };
                    setCurrentTurn(event.turn_number);
                    setActiveAgents(prev => [...prev.filter(a => a !== event.agent_id), event.agent_id]);
                    setConversationTurns(prev => [...prev, turn]);
                    setStreamingStatus('agent_activity');
                    onTurnStart?.(turn);
                    break;
                  }

                  case 'turn_progress': {
                    // Update the current turn with progress info
                    setConversationTurns(prev => prev.map(t =>
                      t.turnNumber === event.turn_number
                        ? { ...t, status: 'active' as const }
                        : t
                    ));
                    break;
                  }

                  case 'turn_complete': {
                    const completedTurn: ConversationTurn = {
                      turnId: `turn-${event.turn_number}`,
                      turnNumber: event.turn_number,
                      agentId: event.agent_id,
                      agentName: event.agent_name,
                      query: '', // Will be filled from existing turn
                      turnType: 'specialist',
                      status: event.success ? 'completed' : 'error',
                      durationMs: event.duration_ms,
                      artifactsCount: event.artifacts_count,
                      entitiesExtracted: event.entities_extracted || [],
                      response: event.response_preview,
                      error: event.error,
                      startedAt: new Date(), // Placeholder
                      completedAt: new Date(),
                    };

                    setConversationTurns(prev => prev.map(t =>
                      t.turnNumber === event.turn_number
                        ? { ...t, ...completedTurn, query: t.query, startedAt: t.startedAt }
                        : t
                    ));
                    setActiveAgents(prev => prev.filter(a => a !== event.agent_id));

                    // Track consulted agents
                    if (!agentsConsulted.includes(event.agent_id)) {
                      setAgentsConsulted(prev => [...prev, event.agent_id]);
                    }

                    // Track entities discovered
                    if (event.entities_extracted && event.entities_extracted.length > 0) {
                      setEntitiesDiscovered(prev => ({
                        ...prev,
                        [event.agent_id]: event.entities_extracted,
                      }));
                    }

                    setStreamingStatus('thinking');
                    onTurnComplete?.(completedTurn);
                    break;
                  }

                  case 'parallel_start': {
                    setIsParallelExecution(true);
                    setActiveAgents(event.agents || []);
                    setStreamingStatus('agent_activity');
                    onParallelStart?.(event.agents || [], event.agent_names || []);
                    break;
                  }

                  case 'parallel_complete': {
                    setIsParallelExecution(false);
                    setActiveAgents([]);
                    setStreamingStatus('thinking');
                    onParallelComplete?.(event.agents_completed || [], event.all_succeeded ?? true);
                    break;
                  }

                  case 'multi_agent_handoff': {
                    // Update active agents for handoff visualization
                    setActiveAgents(prev => {
                      const filtered = prev.filter(a => a !== event.from_agent);
                      return [...filtered, event.to_agent];
                    });
                    onAgentHandoff?.(event.from_agent, event.to_agent, event.context_summary || '');
                    break;
                  }

                  case 'synthesis_start': {
                    setIsSynthesizing(true);
                    setStreamingStatus('thinking');
                    // Backend sends turns_to_synthesize and agents_consulted
                    onSynthesisStart?.(event.agents_consulted || [], event.turns_to_synthesize || 0);
                    break;
                  }

                  case 'multi_agent_done': {
                    setStreamingStatus('idle');
                    setStreamingToolName(undefined);
                    setAgentActivity(undefined);
                    setIsSynthesizing(false);
                    setActiveAgents([]);
                    usage = event.usage || { input_tokens: 0, output_tokens: 0 };

                    // Extract tool_data for canvas cards - pass through as-is
                    // Backend sends: {tool, data, data_type, live_topic, network_id, org_id}
                    if (event.tool_data && event.tool_data.length > 0) {
                      tool_data = event.tool_data;
                    }

                    // Use the final_response from the multi-agent workflow
                    if (event.final_response) {
                      fullContent = event.final_response;
                      setStreamedContent(fullContent);
                    }

                    const summary: MultiAgentSummary = {
                      conversationId: event.conversation_id,
                      totalTurns: event.total_turns,
                      agentsConsulted: event.agents_consulted || [],
                      totalDurationMs: event.total_duration_ms || 0,
                      entitiesDiscovered: event.entities_discovered || {},
                      usage,
                    };
                    onMultiAgentComplete?.(summary);
                    // Pass agents_consulted as tools_used for cost tracking display
                    onComplete?.(usage, event.agents_consulted || []);
                    break;
                  }
                }
              } catch {
                // Failed to parse SSE event - continue processing
              }
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled
        errorMessage = 'Request cancelled';
      } else {
        setStreamingStatus('error');
        const errMsg = err instanceof Error ? err.message : 'Streaming failed';
        errorMessage = errMsg;
        setError(errMsg);
        onError?.(errMsg);
      }
    } finally {
      setIsStreaming(false);
      // Don't clear streamedContent here - the content should persist for the message
      // It gets cleared at the start of the next streamMessage call
      if (!errorMessage) {
        setStreamingStatus('idle');
      }
      abortControllerRef.current = null;
    }

    return {
      content: fullContent,
      usage,
      tools_used,
      tool_data,
      card_suggestions: result_card_suggestions.length > 0 ? result_card_suggestions : undefined,
      error: errorMessage,
    };
  }, [streamingStatus]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStreamingStatus('idle');
      setIsStreaming(false);
    }
  }, []);

  const resetState = useCallback(() => {
    // Reset legacy state
    setIsStreaming(false);
    setStreamingStatus('idle');
    setStreamingToolName(undefined);
    setAgentActivity(undefined);
    setStreamedContent('');
    setError(null);

    // Reset multi-agent state
    setConversationTurns([]);
    setCurrentTurn(0);
    setActiveAgents([]);
    setRoutingDecision(undefined);
    setModelInfo(undefined);
    setIsParallelExecution(false);
    setIsSynthesizing(false);
    setAgentsConsulted([]);
    setEntitiesDiscovered({});

    // Reset card suggestions
    setCardSuggestions([]);
  }, []);

  return {
    // Methods
    streamMessage,
    cancelStream,
    resetState,

    // Legacy state
    isStreaming,
    streamingStatus,
    streamingToolName,
    agentActivity,
    streamedContent,
    error,

    // Multi-agent orchestration state
    conversationTurns,
    currentTurn,
    activeAgents,
    routingDecision,
    modelInfo,
    isParallelExecution,
    isSynthesizing,
    agentsConsulted,
    entitiesDiscovered,

    // Card suggestions from knowledge retrieval
    cardSuggestions,
  };
}

export default useStreamingChat;
