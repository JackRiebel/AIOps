'use client';

import { useRef, useEffect, useCallback, memo } from 'react';
import { ChatMessage, type Message } from './ChatMessage';
import { ChatInput, type ChatInputRef } from './ChatInput';
import { StreamingIndicator, type StreamingStatus, type AgentActivityInfo } from './StreamingIndicator';
import { AgentFlowPanel } from './AgentFlowPanel';
import type { FlowNode, FlowEdge, FlowPhase, ModelInfo, TimelineEvent } from '@/types/agent-flow';

// ============================================================================
// Types
// ============================================================================

export interface AgentFlowState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  isActive: boolean;
  currentPhase: FlowPhase;
  timeline?: TimelineEvent[];
}

export interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onClear?: () => void;
  onNewChat?: () => void;
  onShowHistory?: () => void;
  chatTitle?: string;
  isStreaming?: boolean;
  streamingStatus?: StreamingStatus;
  streamingToolName?: string;
  agentActivity?: AgentActivityInfo;
  streamingContent?: string;
  disabled?: boolean;
  placeholder?: string;
  showActions?: boolean;
  onCopy?: (content: string) => void;
  onFeedback?: (id: string | number, type: 'positive' | 'negative') => void;
  renderToolResults?: (data: any) => React.ReactNode;
  emptyStateContent?: React.ReactNode;
  className?: string;
  // Agent Flow Visualization props
  agentFlow?: AgentFlowState;
  showAgentFlow?: boolean;
  onAgentFlowNodeClick?: (nodeId: string) => void;
  // Model info for displaying current AI model
  modelInfo?: ModelInfo;
  // Known devices for inline action suggestions
  knownDevices?: Array<{ name: string; serial: string; model?: string; lanIp?: string }>;
}

// ============================================================================
// Empty State Component
// ============================================================================

const DefaultEmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
      Welcome to Lumen AI
    </h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
      Your intelligent network assistant. Ask questions about your network, troubleshoot issues, or get optimization recommendations.
    </p>
  </div>
));

DefaultEmptyState.displayName = 'DefaultEmptyState';

// ============================================================================
// Model Badge Component
// ============================================================================

const ModelBadge = memo(({ modelInfo }: { modelInfo: ModelInfo }) => {
  // Format model name for display (e.g., "claude-sonnet-4-5-20250929" -> "Claude Sonnet 4.5")
  const formatModelName = (modelId: string): string => {
    if (modelId.includes('opus')) return 'Claude Opus';
    if (modelId.includes('sonnet')) {
      if (modelId.includes('4-5') || modelId.includes('4.5')) return 'Claude Sonnet 4.5';
      if (modelId.includes('3-5') || modelId.includes('3.5')) return 'Claude Sonnet 3.5';
      return 'Claude Sonnet';
    }
    if (modelId.includes('haiku')) return 'Claude Haiku';
    if (modelId.includes('gpt-4')) return 'GPT-4';
    if (modelId.includes('gpt-3')) return 'GPT-3.5';
    // Fallback: return first part of model name
    return modelId.split('-').slice(0, 2).join(' ');
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30">
      <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
        {formatModelName(modelInfo.modelId)}
      </span>
      {modelInfo.temperature !== 0.7 && (
        <span className="text-xs text-purple-500 dark:text-purple-400" title={`Temperature: ${modelInfo.temperature}`}>
          t:{modelInfo.temperature}
        </span>
      )}
    </div>
  );
});

ModelBadge.displayName = 'ModelBadge';

// ============================================================================
// Messages List Component
// ============================================================================

interface MessagesListProps {
  messages: Message[];
  streamingContent?: string;
  showActions?: boolean;
  onCopy?: (content: string) => void;
  onFeedback?: (id: string | number, type: 'positive' | 'negative') => void;
  renderToolResults?: (data: any) => React.ReactNode;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  knownDevices?: Array<{ name: string; serial: string; model?: string; lanIp?: string }>;
}

const MessagesList = memo(({
  messages,
  streamingContent,
  showActions,
  onCopy,
  onFeedback,
  renderToolResults,
  messagesEndRef,
  knownDevices = [],
}: MessagesListProps) => {
  return (
    <>
      {messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          showActions={showActions}
          onCopy={onCopy}
          onFeedback={onFeedback}
          renderToolResults={renderToolResults}
          knownDevices={knownDevices}
        />
      ))}

      {/* Streaming message placeholder */}
      {streamingContent && (
        <ChatMessage
          key="streaming"
          message={{
            id: 'streaming',
            role: 'assistant',
            content: streamingContent,
            isStreaming: true,
          }}
          showActions={false}
          knownDevices={knownDevices}
        />
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </>
  );
});

MessagesList.displayName = 'MessagesList';

// ============================================================================
// Main ChatContainer Component
// ============================================================================

export const ChatContainer = memo(({
  messages,
  onSendMessage,
  onClear,
  onNewChat,
  onShowHistory,
  chatTitle,
  isStreaming = false,
  streamingStatus = 'idle',
  streamingToolName,
  agentActivity,
  streamingContent,
  disabled = false,
  placeholder,
  showActions = true,
  onCopy,
  onFeedback,
  renderToolResults,
  emptyStateContent,
  className = '',
  agentFlow,
  showAgentFlow = false,
  onAgentFlowNodeClick,
  modelInfo,
  knownDevices = [],
}: ChatContainerProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming content updates
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Handle edit last message
  const handleEditLast = useCallback((): string | undefined => {
    // Find last user message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    return lastUserMessage?.content;
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isEmpty = messages.length === 0 && !streamingContent;
  const hasMessages = messages.length > 0;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Chat Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          {/* Chat Icon */}
          <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-500/20">
            <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {chatTitle || 'Lumen AI'}
          </span>
          {hasMessages && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              ({messages.length} message{messages.length !== 1 ? 's' : ''})
            </span>
          )}
          {/* Model Info Badge */}
          {modelInfo && <ModelBadge modelInfo={modelInfo} />}
        </div>

        <div className="flex items-center gap-1">
          {/* History Button */}
          {onShowHistory && (
            <button
              onClick={onShowHistory}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Chat history"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}

          {/* New Chat Button */}
          {onNewChat && (
            <button
              onClick={onNewChat}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="New chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}

          {/* Clear Chat Button */}
          {hasMessages && onClear && (
            <button
              onClick={onClear}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Clear chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Agent Flow Visualization Panel */}
      {showAgentFlow && agentFlow && (
        <AgentFlowPanel
          nodes={agentFlow.nodes}
          edges={agentFlow.edges}
          isActive={agentFlow.isActive}
          currentPhase={agentFlow.currentPhase}
          timeline={agentFlow.timeline}
          onNodeClick={onAgentFlowNodeClick}
          defaultExpanded={true}
        />
      )}

      {/* Messages Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
      >
        {isEmpty ? (
          emptyStateContent || <DefaultEmptyState />
        ) : (
          <MessagesList
            messages={messages}
            streamingContent={streamingContent}
            showActions={showActions}
            onCopy={onCopy}
            onFeedback={onFeedback}
            renderToolResults={renderToolResults}
            messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            knownDevices={knownDevices}
          />
        )}

        {/* Streaming Indicator */}
        {isStreaming && streamingStatus !== 'idle' && !streamingContent && (
          <StreamingIndicator
            status={streamingStatus}
            toolName={streamingToolName}
            agentActivity={agentActivity}
          />
        )}
      </div>

      {/* Input Area */}
      <ChatInput
        ref={inputRef}
        onSend={onSendMessage}
        onEditLast={handleEditLast}
        disabled={disabled}
        isLoading={isStreaming}
        placeholder={placeholder}
      />
    </div>
  );
});

ChatContainer.displayName = 'ChatContainer';

export default ChatContainer;
