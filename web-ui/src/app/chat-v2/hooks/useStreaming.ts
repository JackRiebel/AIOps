'use client';

/**
 * useStreaming - SSE Streaming Hook for Chat V2
 *
 * Self-contained streaming implementation with:
 * - Clean SSE event processing
 * - Multi-agent orchestration support
 * - Card suggestion handling
 * - Abort/cancellation support
 */

import { useState, useCallback, useRef } from 'react';
import type { StreamingPhase } from '../types';

// Re-export StreamingPhase for convenience
export type { StreamingPhase };

// =============================================================================
// Types
// =============================================================================

export interface ToolExecution {
  id: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  startedAt: number;
  completedAt?: number;
  success?: boolean;
  resultSummary?: string;
  resultCount?: number;
  resultPreview?: Record<string, unknown>;
  errorMessage?: string;
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

export interface CardSuggestion {
  type: string;
  title: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

export interface StreamingState {
  phase: StreamingPhase;
  content: string;
  currentTool?: string;
  currentAgent?: string;
  toolExecutions: ToolExecution[];
  agentTurns: AgentTurn[];
  cardSuggestions: CardSuggestion[];
  error?: string;
}

export interface StreamOptions {
  message: string;
  history?: Array<{ role: string; content: string; tool_data?: unknown }>;
  sessionId?: string;
  editMode?: boolean;
  verbosity?: 'brief' | 'standard' | 'detailed';
  // Organization context - empty string means use all orgs
  organization?: string;
  // Display name mappings for orgs
  orgDisplayNames?: Record<string, string>;
  // Current canvas cards for AI context awareness
  currentCards?: Array<{ id: string; type: string; title: string; networkId?: string; orgId?: string }>;
}

export interface StreamResult {
  content: string;
  usage?: TokenUsage;
  toolsUsed: string[];
  toolData?: Array<{ tool: string; data: unknown }>;
  cardSuggestions: CardSuggestion[];
  error?: string;
}

// =============================================================================
// Tool Summary Extraction
// =============================================================================

/** Priority fields to pick for preview */
const PREVIEW_FIELDS = ['name', 'status', 'count', 'total', 'latency', 'loss', 'jitter', 'severity', 'score', 'type', 'ip', 'hostname', 'network', 'message'];

function pickPreviewFields(obj: Record<string, unknown>, limit = 6): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let picked = 0;
  // Priority fields first
  for (const key of PREVIEW_FIELDS) {
    if (picked >= limit) break;
    if (obj[key] !== undefined && obj[key] !== null) {
      result[key] = obj[key];
      picked++;
    }
  }
  // Fill remaining with other scalar fields
  for (const [key, value] of Object.entries(obj)) {
    if (picked >= limit) break;
    if (key in result) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
      picked++;
    }
  }
  return result;
}

function inferItemType(toolName: string): string {
  const name = toolName.toLowerCase();
  if (name.includes('alert')) return 'alerts';
  if (name.includes('device') || name.includes('client')) return 'devices';
  if (name.includes('network')) return 'networks';
  if (name.includes('test')) return 'tests';
  if (name.includes('event')) return 'events';
  if (name.includes('incident')) return 'incidents';
  if (name.includes('policy') || name.includes('rule')) return 'rules';
  return 'results';
}

function extractToolSummary(
  toolName: string,
  result: unknown,
  success: boolean
): { summary?: string; count?: number; preview?: Record<string, unknown>; errorMsg?: string } {
  if (!success) {
    const errorMsg = typeof result === 'string' ? result
      : (result && typeof result === 'object' && 'error' in result) ? String((result as Record<string, unknown>).error)
      : 'Tool execution failed';
    return { summary: `Error: ${errorMsg.slice(0, 80)}`, errorMsg };
  }

  if (result === null || result === undefined) {
    return { summary: 'No data returned' };
  }

  // Array result
  if (Array.isArray(result)) {
    const count = result.length;
    const itemType = inferItemType(toolName);
    const summary = count === 0 ? `No ${itemType} found` : `Found ${count} ${itemType}`;
    const preview = count > 0 && typeof result[0] === 'object' && result[0] !== null
      ? pickPreviewFields(result[0] as Record<string, unknown>)
      : undefined;
    return { summary, count: count || undefined, preview };
  }

  // Object result
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;

    // Object with nested array (e.g., { devices: [...], alerts: [...] })
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value) && value.length > 0) {
        const count = value.length;
        return {
          summary: `Found ${count} ${key}`,
          count,
          preview: typeof value[0] === 'object' && value[0] !== null
            ? pickPreviewFields(value[0] as Record<string, unknown>)
            : undefined,
        };
      }
    }

    // Path/latency data
    if (typeof obj.avgLatency === 'number' || typeof obj.latency === 'number') {
      const lat = (obj.avgLatency ?? obj.latency) as number;
      const parts = [`${lat.toFixed(0)}ms latency`];
      if (typeof obj.loss === 'number') parts.push(`${obj.loss}% loss`);
      if (typeof obj.jitter === 'number') parts.push(`${obj.jitter}ms jitter`);
      return { summary: parts.join(', '), preview: pickPreviewFields(obj) };
    }

    // Status summary (e.g., { online: 3, offline: 2 })
    if (typeof obj.online === 'number' || typeof obj.status === 'string') {
      const preview = pickPreviewFields(obj);
      const summary = typeof obj.online === 'number'
        ? `${obj.online} online, ${obj.offline ?? 0} offline`
        : `Status: ${obj.status}`;
      return { summary, preview };
    }

    // Generic object with some fields
    const preview = pickPreviewFields(obj);
    const fieldCount = Object.keys(obj).length;
    return { summary: `${fieldCount} fields returned`, preview };
  }

  // Scalar
  return { summary: String(result).slice(0, 100) };
}

// =============================================================================
// Hook
// =============================================================================

export interface UseStreamingReturn {
  // State
  isStreaming: boolean;
  phase: StreamingPhase;
  content: string;
  currentTool?: string;
  currentAgent?: string;
  toolExecutions: ToolExecution[];
  agentTurns: AgentTurn[];
  cardSuggestions: CardSuggestion[];
  error?: string;

  // Actions
  stream: (options: StreamOptions) => Promise<StreamResult>;
  cancel: () => void;
  reset: () => void;
}

export function useStreaming(): UseStreamingReturn {
  // Core state
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState<StreamingPhase>('idle');
  const [content, setContent] = useState('');
  const [currentTool, setCurrentTool] = useState<string>();
  const [currentAgent, setCurrentAgent] = useState<string>();
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [agentTurns, setAgentTurns] = useState<AgentTurn[]>([]);
  const [cardSuggestions, setCardSuggestions] = useState<CardSuggestion[]>([]);
  const [error, setError] = useState<string>();

  // Abort controller ref
  const abortRef = useRef<AbortController | null>(null);

  // Reset all state
  const reset = useCallback(() => {
    setIsStreaming(false);
    setPhase('idle');
    setContent('');
    setCurrentTool(undefined);
    setCurrentAgent(undefined);
    setToolExecutions([]);
    setAgentTurns([]);
    setCardSuggestions([]);
    setError(undefined);
  }, []);

  // Cancel current stream
  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
    setPhase('idle');
  }, []);

  // Stream message
  const stream = useCallback(async (options: StreamOptions): Promise<StreamResult> => {
    const {
      message,
      history = [],
      sessionId,
      editMode = false,
      verbosity = 'standard',
      organization = '',
      orgDisplayNames = {},
      currentCards = [],
    } = options;

    // Reset state
    reset();
    setIsStreaming(true);
    setPhase('thinking');

    // Create abort controller
    abortRef.current = new AbortController();

    // Sync canvas state to backend so AI knows what's already displayed
    if (sessionId && currentCards.length > 0) {
      try {
        await fetch(`/api/ai-sessions/${sessionId}/canvas-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            cards: currentCards.map(card => ({
              card_id: card.id,
              card_type: card.type,
              title: card.title,
              data_summary: '',
              network_id: card.networkId || null,
              org_id: card.orgId || null,
            })),
          }),
        });
      } catch {
        // Non-critical — continue streaming even if sync fails
      }
    }

    // Result accumulators
    let fullContent = '';
    let usage: TokenUsage | undefined;
    let toolsUsed: string[] = [];
    let toolData: Array<{ tool: string; data: unknown }> | undefined;
    const suggestions: CardSuggestion[] = [];
    let errorMessage: string | undefined;

    try {
      const response = await fetch('/api/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message,
          history,
          session_id: sessionId,
          edit_mode: editMode,
          verbosity,
          max_turns: 10,
          organization,
          org_display_names: orgDisplayNames,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              // ==================
              // Core Events
              // ==================

              case 'thinking':
                setPhase('thinking');
                break;

              case 'text_delta':
                setPhase('streaming');
                fullContent += event.text || '';
                setContent(fullContent);
                break;

              // ==================
              // Tool Events
              // ==================

              case 'tool_use_start':
                console.log('[useStreaming] tool_use_start:', event.tool);
                setPhase('tool_call');
                setCurrentTool(event.tool);
                setToolExecutions(prev => {
                  const updated = [...prev, {
                    id: `tool-${Date.now()}`,
                    name: event.tool,
                    status: 'running' as const,
                    startedAt: Date.now(),
                  }];
                  console.log('[useStreaming] toolExecutions now:', updated.length);
                  return updated;
                });
                break;

              case 'tool_use_complete':
              case 'tool_result': {
                // Handle both event names - backend sends 'tool_result', some paths send 'tool_use_complete'
                console.log('[useStreaming] tool_result/complete:', event.tool, event.type);
                setPhase('thinking');
                setCurrentTool(undefined);
                // For tool_result, success is implied if we got a result (no explicit success field)
                const toolSuccess = event.success !== undefined ? event.success : true;
                // Extract summary from result data if available
                const { summary: resultSummary, count: resultCount, preview: resultPreview, errorMsg } =
                  extractToolSummary(event.tool, event.result, toolSuccess);
                setToolExecutions(prev => {
                  const updated = prev.map(t =>
                    t.name === event.tool && t.status === 'running'
                      ? {
                          ...t,
                          status: toolSuccess ? 'complete' as const : 'error' as const,
                          completedAt: Date.now(),
                          success: toolSuccess,
                          resultSummary,
                          resultCount,
                          resultPreview,
                          errorMessage: errorMsg,
                        }
                      : t
                  );
                  console.log('[useStreaming] Updated tool to complete:', event.tool);
                  return updated;
                });
                break;
              }

              // ==================
              // Agent Events
              // ==================

              case 'orchestrator_routing':
                setPhase('agent_work');
                setCurrentAgent(event.primary_agent_name || event.primary_agent);
                break;

              case 'turn_start':
                setPhase('agent_work');
                setCurrentAgent(event.agent_name);
                setAgentTurns(prev => [...prev, {
                  id: `turn-${event.turn_number}`,
                  agentId: event.agent_id,
                  agentName: event.agent_name,
                  query: event.query || '',
                  status: 'active',
                }]);
                break;

              case 'turn_complete':
                setAgentTurns(prev => prev.map(t =>
                  t.agentId === event.agent_id && t.status === 'active'
                    ? { ...t, status: event.success ? 'complete' : 'error', durationMs: event.duration_ms, response: event.response_preview }
                    : t
                ));
                setCurrentAgent(undefined);
                setPhase('thinking');
                break;

              case 'synthesis_start':
                setPhase('synthesizing');
                break;

              // ==================
              // Card Suggestions
              // ==================

              case 'card_suggestion':
                if (event.card) {
                  const card: CardSuggestion = event.card;
                  suggestions.push(card);
                  setCardSuggestions(prev => [...prev, card]);
                }
                break;

              // ==================
              // Completion Events
              // ==================

              case 'done':
                usage = event.usage ? {
                  inputTokens: event.usage.input_tokens || 0,
                  outputTokens: event.usage.output_tokens || 0,
                  costUsd: event.usage.cost_usd,
                } : undefined;
                toolsUsed = event.tools_used || [];
                toolData = event.tool_data;
                break;

              case 'multi_agent_done':
                usage = event.usage ? {
                  inputTokens: event.usage.input_tokens || 0,
                  outputTokens: event.usage.output_tokens || 0,
                  costUsd: event.usage.cost_usd,
                } : undefined;
                toolData = event.tool_data;
                toolsUsed = event.agents_consulted || [];

                // Use final response from multi-agent
                if (event.final_response) {
                  fullContent = event.final_response;
                  setContent(fullContent);
                }
                break;

              case 'error':
                setPhase('error');
                errorMessage = event.error;
                setError(event.error);
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        errorMessage = 'Cancelled';
      } else {
        setPhase('error');
        errorMessage = err instanceof Error ? err.message : 'Stream failed';
        setError(errorMessage);
      }
    } finally {
      setIsStreaming(false);
      setCurrentTool(undefined);
      setCurrentAgent(undefined);
      if (!errorMessage) {
        setPhase('idle');
      }
      abortRef.current = null;
    }

    return {
      content: fullContent,
      usage,
      toolsUsed,
      toolData,
      cardSuggestions: suggestions,
      error: errorMessage,
    };
  }, [reset]);

  return {
    // State
    isStreaming,
    phase,
    content,
    currentTool,
    currentAgent,
    toolExecutions,
    agentTurns,
    cardSuggestions,
    error,

    // Actions
    stream,
    cancel,
    reset,
  };
}

export default useStreaming;
