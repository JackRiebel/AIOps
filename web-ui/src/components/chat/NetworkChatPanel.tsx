'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ChatContainer } from './ChatContainer';
import type { Message } from './ChatMessage';
import type { StreamingStatus, AgentActivityInfo } from './StreamingIndicator';
import { useStreamingChat, type AgentActivityResult } from '@/hooks/useStreamingChat';
import { useAgentFlow } from '@/components/agent-flow';
import { useAISession } from '@/contexts/AISessionContext';
import type { SSEEvent } from '@/types/agent-flow';

// ============================================================================
// Types
// ============================================================================

export interface SelectedNetwork {
  id: string;
  name: string;
  productTypes?: string[];
}

export interface NetworkChatPanelProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  organization?: string | null;
  selectedNetwork?: SelectedNetwork | null;
  selectedDevices?: Array<{ serial: string; name?: string; model: string }>;
  onClearSelection?: () => void;
  onNewChat?: () => void;
  autoRemediateMode?: boolean;
  renderToolResults?: (data: any) => React.ReactNode;
  onSendComplete?: (usage: { input_tokens: number; output_tokens: number }, tools_used: string[]) => void;
  className?: string;
  // Agent Flow Visualization
  showAgentFlow?: boolean;
}

// ============================================================================
// NetworkChatPanel Component
// ============================================================================

export function NetworkChatPanel({
  messages,
  setMessages,
  organization,
  selectedNetwork,
  selectedDevices = [],
  onClearSelection,
  onNewChat,
  autoRemediateMode = false,
  renderToolResults,
  onSendComplete,
  className = '',
  showAgentFlow = false,
}: NetworkChatPanelProps) {
  const [nextId, setNextId] = useState(() => Math.max(...messages.map(m => typeof m.id === 'number' ? m.id : 0), 0) + 1);

  // AI Session tracking integration
  const { session, logAIQuery } = useAISession();

  const {
    streamMessage,
    cancelStream,
    isStreaming,
    streamingStatus,
    streamingToolName,
    agentActivity,
    streamedContent,
    error,
    // Multi-agent state
    modelInfo,
  } = useStreamingChat();

  // Agent Flow Visualization state
  const {
    nodes: agentFlowNodes,
    edges: agentFlowEdges,
    isActive: agentFlowIsActive,
    currentPhase: agentFlowPhase,
    startFlow,
    handleEvent: handleFlowEvent,
    resetFlow,
  } = useAgentFlow();

  // Build history for API calls
  const history = useMemo(() => {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: nextId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setNextId(prev => prev + 1);

    // Start agent flow visualization if enabled
    if (showAgentFlow) {
      startFlow(content);
    }

    // Build context from selected network and devices
    let messageWithContext = content;
    const contextParts: string[] = [];

    if (selectedNetwork) {
      const productTypes = selectedNetwork.productTypes?.length
        ? ` (${selectedNetwork.productTypes.join(', ')})`
        : '';
      contextParts.push(`Network: ${selectedNetwork.name}${productTypes} [ID: ${selectedNetwork.id}]`);
    }

    if (selectedDevices.length > 0) {
      const deviceList = selectedDevices.map(d => `${d.name || d.model} (${d.serial})`).join(', ');
      contextParts.push(`Selected devices: ${deviceList}`);
    }

    if (contextParts.length > 0) {
      messageWithContext = `[Context: ${contextParts.join('; ')}]\n\n${content}`;
    }

    // Stream the response with agent flow event handlers
    // Pass AI session ID for conversation memory persistence and tracking
    const result = await streamMessage({
      message: messageWithContext,
      organization,
      session_id: session?.id?.toString(),  // Link to AI session tracking
      history,
      onThinking: showAgentFlow ? () => {
        handleFlowEvent({ type: 'thinking' });
      } : undefined,
      onTextDelta: showAgentFlow ? (text) => {
        handleFlowEvent({ type: 'text_delta', text });
      } : undefined,
      onToolStart: showAgentFlow ? (tool) => {
        handleFlowEvent({ type: 'tool_use_start', tool });
      } : undefined,
      onToolComplete: showAgentFlow ? (tool, success) => {
        handleFlowEvent({ type: 'tool_use_complete', tool, success });
      } : undefined,
      onAgentActivityStart: showAgentFlow ? (agent, query) => {
        handleFlowEvent({ type: 'agent_activity_start', agent, query });
      } : undefined,
      onAgentActivityComplete: showAgentFlow ? (agent, result) => {
        handleFlowEvent({
          type: 'agent_activity_complete',
          agent,
          success: result.success,
          confidence: result.confidence,
          sources_count: result.sources_count,
          steps_count: result.steps_count,
          response_summary: result.response_summary,
        });
      } : undefined,
      onComplete: (usage, tools_used) => {
        if (showAgentFlow) {
          handleFlowEvent({
            type: 'done',
            usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
            tools_used,
          });
        }
        onSendComplete?.(usage, tools_used);
      },
      onError: showAgentFlow ? (error) => {
        handleFlowEvent({ type: 'error', error });
      } : undefined,
    });

    // Add assistant message when complete
    if (result.content) {
      // INTENSIVE LOGGING: Log result.tool_data before creating message
      console.log('[NetworkChatPanel][DEBUG] ===== CREATING ASSISTANT MESSAGE =====');
      console.log('[NetworkChatPanel][DEBUG] result.tool_data:', result.tool_data);
      console.log('[NetworkChatPanel][DEBUG] tool_data count:', result.tool_data?.length || 0);
      if (result.tool_data && Array.isArray(result.tool_data)) {
        result.tool_data.forEach((td: any, i: number) => {
          console.log(`[NetworkChatPanel][DEBUG] tool_data[${i}]:`, {
            tool: td.tool,
            network_id: td.network_id,
            org_id: td.org_id,
            data_type: td.data_type,
            hasData: !!td.data,
          });
        });
      }

      // Calculate cost (using Claude 3.5 Sonnet pricing: $3/1M input, $15/1M output)
      const inputCost = result.usage ? (result.usage.input_tokens / 1_000_000) * 3 : 0;
      const outputCost = result.usage ? (result.usage.output_tokens / 1_000_000) * 15 : 0;
      const totalCost = inputCost + outputCost;

      const assistantMessage: Message = {
        id: nextId + 1,
        role: 'assistant',
        content: result.content,
        created_at: new Date().toISOString(),
        data: result.tool_data,  // Pass tool_data for CardableSuggestions
        usage: result.usage ? {
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
          cost_usd: totalCost,
        } : undefined,
        tools_used: result.tools_used,
      };
      console.log('[NetworkChatPanel][DEBUG] assistantMessage.data:', assistantMessage.data);
      console.log('[NetworkChatPanel][DEBUG] ===== END CREATING ASSISTANT MESSAGE =====');
      setMessages(prev => [...prev, assistantMessage]);
      setNextId(prev => prev + 2);

      // Log AI query to session tracking for cost/token tracking
      if (result.usage && session) {
        logAIQuery(
          content,
          result.content,
          modelInfo?.modelId || 'agent-orchestrator',
          result.usage.input_tokens,
          result.usage.output_tokens
        );
      }
    }

    // Handle error
    if (result.error) {
      const errorMessage: Message = {
        id: nextId + 1,
        role: 'system',
        content: `Error: ${result.error}`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setNextId(prev => prev + 2);
    }
  }, [nextId, setMessages, selectedDevices, organization, history, streamMessage, onSendComplete, showAgentFlow, startFlow, handleFlowEvent, session, logAIQuery, modelInfo]);

  // Handle clearing the chat
  const handleClear = useCallback(() => {
    setMessages([]);
    setNextId(1);
    onClearSelection?.();
    if (showAgentFlow) {
      resetFlow();
    }
  }, [setMessages, onClearSelection, showAgentFlow, resetFlow]);

  // Handle copying content
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // Handle feedback - send to AI feedback API for continuous learning
  const handleFeedback = useCallback(async (id: string | number, type: 'positive' | 'negative') => {
    try {
      // Find the message to get context
      const message = messages.find(m => m.id === id);
      const userQuery = messages.find(m => m.role === 'user' && messages.indexOf(m) < messages.indexOf(message!))?.content;

      // Send feedback to API
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message_id: String(id),
          feedback_type: type,
          session_id: session?.id?.toString(),
          query: userQuery,
          response_preview: message?.content?.substring(0, 500),
          tools_used: message?.tools_used,
          model: 'claude-3-5-sonnet', // Could be extracted from response
          latency_ms: message?.duration_ms,
          token_count: message?.usage ? (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0) : undefined,
        }),
      });

      console.log(`Feedback submitted for message ${id}: ${type}`);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  }, [messages, session]);

  // Dynamic placeholder based on selection
  const placeholder = useMemo(() => {
    if (selectedNetwork && selectedDevices.length > 0) {
      return `Ask about ${selectedNetwork.name} and ${selectedDevices.length} device${selectedDevices.length > 1 ? 's' : ''}...`;
    }
    if (selectedNetwork) {
      return `Ask about ${selectedNetwork.name}...`;
    }
    if (selectedDevices.length > 0) {
      return `Ask about your ${selectedDevices.length} selected device${selectedDevices.length > 1 ? 's' : ''}...`;
    }
    return 'Ask about your network...';
  }, [selectedNetwork, selectedDevices.length]);

  // Extract known devices from selectedDevices + tool results for inline action buttons
  const knownDevices = useMemo(() => {
    const devices: Array<{ name: string; serial: string; model?: string; lanIp?: string }> = [];
    const seenSerials = new Set<string>();

    // Add selected devices first
    for (const d of selectedDevices) {
      if (!seenSerials.has(d.serial)) {
        seenSerials.add(d.serial);
        devices.push({
          name: d.name || d.model,
          serial: d.serial,
          model: d.model,
        });
      }
    }

    // Extract devices from tool_data in messages
    for (const msg of messages) {
      if (msg.data && Array.isArray(msg.data)) {
        for (const td of msg.data) {
          // Check if this is device data
          if (td.data_type === 'devices' || td.tool?.includes('device')) {
            const dataArray = td.data || [];
            if (Array.isArray(dataArray)) {
              for (const item of dataArray) {
                if (item.serial && !seenSerials.has(item.serial)) {
                  seenSerials.add(item.serial);
                  devices.push({
                    name: item.name || item.model || item.serial,
                    serial: item.serial,
                    model: item.model,
                    lanIp: item.lanIp,
                  });
                }
              }
            }
          }
        }
      }
    }

    return devices;
  }, [selectedDevices, messages]);

  // Custom empty state showing context
  const emptyStateContent = useMemo(() => {
    const hasContext = selectedNetwork || selectedDevices.length > 0;

    if (!hasContext) return undefined;

    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>

        {/* Network Info */}
        {selectedNetwork && (
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              {selectedNetwork.name}
            </h3>
            {selectedNetwork.productTypes && selectedNetwork.productTypes.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center">
                {selectedNetwork.productTypes.map((type) => (
                  <span
                    key={type}
                    className="px-2 py-0.5 text-xs bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 rounded"
                  >
                    {type}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Device Info */}
        {selectedDevices.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
              {selectedDevices.length} device{selectedDevices.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {selectedDevices.slice(0, 5).map((d, i) => (
                <span
                  key={d.serial || i}
                  className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg"
                >
                  {d.name || d.model}
                </span>
              ))}
              {selectedDevices.length > 5 && (
                <span className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg">
                  +{selectedDevices.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          Ask questions about your selected {selectedNetwork ? 'network' : ''}{selectedNetwork && selectedDevices.length > 0 ? ' and ' : ''}{selectedDevices.length > 0 ? 'devices' : ''}.
        </p>
      </div>
    );
  }, [selectedNetwork, selectedDevices]);

  // Prepare agent flow state for ChatContainer
  const agentFlowState = showAgentFlow ? {
    nodes: agentFlowNodes,
    edges: agentFlowEdges,
    isActive: agentFlowIsActive,
    currentPhase: agentFlowPhase,
  } : undefined;

  return (
    <ChatContainer
      messages={messages}
      onSendMessage={handleSendMessage}
      onClear={handleClear}
      onNewChat={onNewChat}
      isStreaming={isStreaming}
      streamingStatus={streamingStatus}
      streamingToolName={streamingToolName}
      agentActivity={agentActivity}
      streamingContent={streamedContent}
      disabled={false}
      placeholder={placeholder}
      showActions={true}
      onCopy={handleCopy}
      onFeedback={handleFeedback}
      renderToolResults={renderToolResults}
      emptyStateContent={emptyStateContent}
      className={className}
      // Agent Flow Visualization
      showAgentFlow={showAgentFlow}
      agentFlow={agentFlowState}
      // Model info display
      modelInfo={modelInfo}
      // Known devices for inline action suggestions
      knownDevices={knownDevices}
    />
  );
}

export default NetworkChatPanel;
