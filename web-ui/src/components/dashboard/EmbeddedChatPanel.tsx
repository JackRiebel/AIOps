'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Sparkles,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useStreamingChat } from '@/hooks/useStreamingChat';
import { useAISession } from '@/contexts/AISessionContext';
import ReactMarkdown from 'react-markdown';

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentsUsed?: string[];
  isStreaming?: boolean;
}

export interface EmbeddedChatPanelProps {
  organization?: string;
  onInvestigate?: (prompt: string) => void;
  className?: string;
}

// ============================================================================
// Quick Prompts
// ============================================================================

const QUICK_PROMPTS = [
  { label: 'Network Health', prompt: 'Give me a quick summary of network health across all integrations' },
  { label: 'Critical Alerts', prompt: 'What are the most critical alerts or incidents right now?' },
  { label: 'Recent Changes', prompt: 'What changes have happened in the network in the last hour?' },
];

// ============================================================================
// MessageBubble Component
// ============================================================================

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white'
        }`}
      >
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {/* Agent indicators */}
        {!isUser && message.agentsUsed && message.agentsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
            {message.agentsUsed.map((agent) => (
              <span
                key={agent}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
              >
                {agent}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-[10px] mt-1 ${isUser ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// StreamingIndicator Component
// ============================================================================

function StreamingIndicator({
  status,
  agentName,
}: {
  status: string;
  agentName?: string;
}) {
  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    thinking: {
      icon: <Sparkles className="w-3.5 h-3.5 animate-pulse" />,
      label: 'Thinking...',
      color: 'text-cyan-500',
    },
    agent_activity: {
      icon: <Activity className="w-3.5 h-3.5 animate-pulse" />,
      label: agentName ? `${agentName} working...` : 'Agent working...',
      color: 'text-blue-500',
    },
    streaming: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      label: 'Generating...',
      color: 'text-green-500',
    },
    error: {
      icon: <XCircle className="w-3.5 h-3.5" />,
      label: 'Error occurred',
      color: 'text-red-500',
    },
  };

  const config = statusConfig[status] || statusConfig.thinking;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg mb-3">
      <span className={config.color}>{config.icon}</span>
      <span className="text-xs text-slate-600 dark:text-slate-400">{config.label}</span>
    </div>
  );
}

// ============================================================================
// EmbeddedChatPanel Component
// ============================================================================

export const EmbeddedChatPanel = memo(({
  organization,
  onInvestigate,
  className = '',
}: EmbeddedChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { session } = useAISession();
  const {
    streamMessage,
    isStreaming,
    streamingStatus,
    streamedContent,
    activeAgents,
    agentsConsulted,
  } = useStreamingChat();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedContent]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const result = await streamMessage({
        message: userMessage.content,
        organization: organization || undefined,
        session_id: session?.id?.toString(),
        useMultiAgent: true,
        maxTurns: 5,
      });

      if (result.content) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
          agentsUsed: result.tools_used,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
    }
  }, [input, isStreaming, streamMessage, organization, session?.id]);

  const handleQuickPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    // Auto-send after a brief delay
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          /* Empty State with Quick Prompts */
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
              How can I help?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Ask me anything about your network
            </p>

            {/* Quick Prompts */}
            <div className="flex flex-col gap-2 w-full">
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickPrompt(qp.prompt)}
                  className="w-full px-4 py-2.5 text-left text-sm bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message List */
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Streaming Content */}
            {isStreaming && streamedContent && (
              <div className="flex justify-start mb-3">
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50">
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{streamedContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Streaming Indicator */}
            {isStreaming && streamingStatus !== 'idle' && (
              <StreamingIndicator
                status={streamingStatus}
                agentName={activeAgents[0]}
              />
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your network..."
            disabled={isStreaming}
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="p-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            aria-label="Send message"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

EmbeddedChatPanel.displayName = 'EmbeddedChatPanel';

export default EmbeddedChatPanel;
