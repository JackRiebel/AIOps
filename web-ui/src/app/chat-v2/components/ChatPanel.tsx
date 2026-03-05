'use client';

/**
 * ChatPanel - Self-Contained Chat Interface
 *
 * A clean chat panel with:
 * - Message list with auto-scroll
 * - Markdown rendering
 * - Streaming status indicators
 * - Agent activity display
 */

import { useState, useCallback, useRef, useEffect, memo, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, StreamingPhase } from '../types';
import type { FollowUpSuggestion } from '../hooks/useStreaming';
import HighlightContext from '../contexts/HighlightContext';
import { IncidentContextCard, hasIncidentContext } from './IncidentContextCard';
import { PathAnalysisContextCard, hasPathAnalysisContext } from './PathAnalysisContextCard';
import { TestDataPointContextCard, hasTestDataPointContext } from './TestDataPointContextCard';
import { TEAnalysisContextCard, hasTEAnalysisContext } from './TEAnalysisContextCard';
import { SplunkAnalysisContextCard, hasSplunkAnalysisContext } from './SplunkAnalysisContextCard';
import PendingActionsBar from '@/components/cards/PendingActionsBar';

// =============================================================================
// Types
// =============================================================================

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isStreaming?: boolean;
  streamingPhase?: StreamingPhase;
  streamingContent?: string;
  streamingError?: string | null;
  currentTool?: string;
  currentAgent?: string;
  onCancel?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  sessionId?: string;
  onActionApproval?: (actionId: string, approved: boolean) => void;
  followupSuggestions?: FollowUpSuggestion[];
  onFollowupClick?: (query: string) => void;
}

// =============================================================================
// Sub-Components
// =============================================================================

// Inline code styling
const InlineCode = memo(({ children }: { children: React.ReactNode }) => (
  <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 text-sm font-mono">
    {children}
  </code>
));
InlineCode.displayName = 'InlineCode';

// Code block with syntax highlighting (simplified)
const CodeBlock = memo(({ language, children }: { language: string; children: string }) => (
  <div className="relative group my-3">
    <div className="absolute top-2 right-2 text-xs text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
      {language}
    </div>
    <pre className="overflow-x-auto rounded-lg bg-slate-900 dark:bg-slate-950 p-4">
      <code className="text-sm text-slate-100 font-mono whitespace-pre">{children}</code>
    </pre>
  </div>
));
CodeBlock.displayName = 'CodeBlock';

// Usage info component - matches /network page ChatMessage UsageInfo exactly
const UsageInfo = memo(({ metadata }: { metadata: ChatMessage['metadata'] }) => {
  if (!metadata) return null;

  const hasUsage = metadata.inputTokens !== undefined || metadata.outputTokens !== undefined;
  const hasCost = metadata.costUsd !== undefined;
  const hasDuration = metadata.durationMs !== undefined && metadata.durationMs > 0;
  const hasTools = metadata.toolsUsed && metadata.toolsUsed.length > 0;

  if (!hasUsage && !hasCost && !hasDuration && !hasTools) return null;

  // Format duration: show as seconds if >= 1000ms, otherwise ms
  const formatDuration = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
  };

  // Build quiet metadata parts (numbers only, minimal labels)
  const metaParts: string[] = [];

  if (hasUsage) {
    metaParts.push(`${(metadata.inputTokens || 0).toLocaleString()} in`);
    metaParts.push(`${(metadata.outputTokens || 0).toLocaleString()} out`);
  }

  if (hasCost) {
    metaParts.push(`$${metadata.costUsd!.toFixed(4)}`);
  }

  if (hasDuration) {
    metaParts.push(formatDuration(metadata.durationMs!));
  }

  if (hasTools) {
    metaParts.push(`${metadata.toolsUsed!.length} tool${metadata.toolsUsed!.length !== 1 ? 's' : ''}`);
  }

  return (
    <div className="mt-2 pt-2 border-t border-slate-700/20">
      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
        {metaParts.join(' · ')}
      </div>
    </div>
  );
});
UsageInfo.displayName = 'UsageInfo';

// Custom table component with nice styling
const StyledTable = memo(({ children }: { children?: React.ReactNode }) => (
  <div className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/50">
    <table className="w-full text-sm">
      {children}
    </table>
  </div>
));
StyledTable.displayName = 'StyledTable';

const StyledTableHead = memo(({ children }: { children?: React.ReactNode }) => (
  <thead className="bg-slate-100 dark:bg-slate-800/80 text-left">
    {children}
  </thead>
));
StyledTableHead.displayName = 'StyledTableHead';

const StyledTableRow = memo(({ children, isHeader }: { children?: React.ReactNode; isHeader?: boolean }) => (
  <tr className={isHeader ? '' : 'border-t border-slate-200 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors'}>
    {children}
  </tr>
));
StyledTableRow.displayName = 'StyledTableRow';

const StyledTableCell = memo(({ children, isHeader }: { children?: React.ReactNode; isHeader?: boolean }) => {
  const Component = isHeader ? 'th' : 'td';
  return (
    <Component className={`px-3 py-2 ${isHeader ? 'font-medium text-cyan-600 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>
      {children}
    </Component>
  );
});
StyledTableCell.displayName = 'StyledTableCell';

// Custom list components
const StyledList = memo(({ children, ordered }: { children?: React.ReactNode; ordered?: boolean }) => {
  const Component = ordered ? 'ol' : 'ul';
  return (
    <Component className={`my-2 space-y-1 ${ordered ? 'list-decimal' : 'list-none'} pl-4`}>
      {children}
    </Component>
  );
});
StyledList.displayName = 'StyledList';

const StyledListItem = memo(({ children }: { children?: React.ReactNode }) => (
  <li className="text-slate-700 dark:text-slate-300 flex items-start gap-2">
    <span className="text-cyan-600 dark:text-cyan-500 mt-1.5 flex-shrink-0">•</span>
    <span className="flex-1">{children}</span>
  </li>
));
StyledListItem.displayName = 'StyledListItem';

// Markdown renderer with enhanced components
const MarkdownContent = memo(({ content }: { content: string }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: any = {
    // Code blocks
    code({ className, children }: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match && !className;

      if (isInline) {
        return <InlineCode>{children}</InlineCode>;
      }

      const language = match ? match[1] : 'text';
      const codeString = String(children).replace(/\n$/, '');
      return <CodeBlock language={language}>{codeString}</CodeBlock>;
    },
    pre({ children }: { children?: React.ReactNode }) {
      return <>{children}</>;
    },

    // Tables
    table({ children }: { children?: React.ReactNode }) {
      return <StyledTable>{children}</StyledTable>;
    },
    thead({ children }: { children?: React.ReactNode }) {
      return <StyledTableHead>{children}</StyledTableHead>;
    },
    tbody({ children }: { children?: React.ReactNode }) {
      return <tbody>{children}</tbody>;
    },
    tr({ children }: { children?: React.ReactNode }) {
      return <StyledTableRow>{children}</StyledTableRow>;
    },
    th({ children }: { children?: React.ReactNode }) {
      return <StyledTableCell isHeader>{children}</StyledTableCell>;
    },
    td({ children }: { children?: React.ReactNode }) {
      return <StyledTableCell>{children}</StyledTableCell>;
    },

    // Lists
    ul({ children }: { children?: React.ReactNode }) {
      return <StyledList>{children}</StyledList>;
    },
    ol({ children }: { children?: React.ReactNode }) {
      return <StyledList ordered>{children}</StyledList>;
    },
    li({ children }: { children?: React.ReactNode }) {
      return <StyledListItem>{children}</StyledListItem>;
    },

    // Headings
    h1({ children }: { children?: React.ReactNode }) {
      return <h1 className="text-lg font-semibold text-slate-900 dark:text-white mt-4 mb-2 first:mt-0">{children}</h1>;
    },
    h2({ children }: { children?: React.ReactNode }) {
      return <h2 className="text-base font-semibold text-slate-900 dark:text-white mt-3 mb-2 first:mt-0">{children}</h2>;
    },
    h3({ children }: { children?: React.ReactNode }) {
      return <h3 className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 mt-3 mb-1 first:mt-0">{children}</h3>;
    },

    // Paragraphs
    p({ children }: { children?: React.ReactNode }) {
      return <p className="text-slate-700 dark:text-slate-300 leading-relaxed my-2 first:mt-0 last:mb-0 break-words">{children}</p>;
    },

    // Strong/Bold
    strong({ children }: { children?: React.ReactNode }) {
      return <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>;
    },

    // Emphasis/Italic
    em({ children }: { children?: React.ReactNode }) {
      return <em className="italic text-slate-600 dark:text-slate-200">{children}</em>;
    },

    // Links
    a({ href, children }: { href?: string; children?: React.ReactNode }) {
      return (
        <a href={href} className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 break-all" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },

    // Blockquotes - useful for highlighting key info
    blockquote({ children }: { children?: React.ReactNode }) {
      return (
        <blockquote className="my-3 pl-4 border-l-2 border-cyan-500 bg-cyan-500/5 py-2 pr-3 rounded-r-lg text-slate-600 dark:text-slate-300 italic">
          {children}
        </blockquote>
      );
    },

    // Horizontal rule
    hr() {
      return <hr className="my-4 border-slate-200 dark:border-slate-700/50" />;
    },
  };

  return (
    <div className="text-sm max-w-full min-w-0 break-words overflow-hidden">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
MarkdownContent.displayName = 'MarkdownContent';

// Single message component with highlight support
const Message = memo(({ message, isHighlighted, onMouseEnter, onMouseLeave, isLastMessage, isStreaming }: {
  message: ChatMessage;
  isHighlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isLastMessage?: boolean;
  isStreaming?: boolean;
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Check if this message has incident context (from "Ask AI" on incidents page)
  const showIncidentCard = isUser && hasIncidentContext(message.metadata);
  // Check if this message has path analysis context (from "Analyze Path" on AI Journey page)
  const showPathAnalysisCard = isUser && hasPathAnalysisContext(message.metadata);
  // Check if this message has test data point context (from "Ask AI" on ThousandEyes tests page)
  const showTestDataPointCard = isUser && hasTestDataPointContext(message.metadata);
  // Check if this message has generic TE analysis context (from any ThousandEyes "Ask AI" button)
  const showTEAnalysisCard = isUser && hasTEAnalysisContext(message.metadata);
  // Check if this message has Splunk analysis context (from Splunk page "Ask AI" buttons)
  const showSplunkAnalysisCard = isUser && hasSplunkAnalysisContext(message.metadata);

  // Show analyzing state only if this is the last user message and AI is still responding
  const isAnalyzing = (showIncidentCard || showPathAnalysisCard || showTestDataPointCard || showTEAnalysisCard || showSplunkAnalysisCard) && isLastMessage && isStreaming;

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} min-w-0 transition-all duration-200`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={`flex flex-col gap-3 ${isUser ? 'items-end' : 'items-start'} max-w-full min-w-0`}>
        {/* Incident Context Card - shown above user message when navigating from incidents page */}
        {showIncidentCard && (
          <IncidentContextCard
            incident={message.metadata!.incidentContext!.incident}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* Path Analysis Context Card - shown above user message when navigating from AI Journey page */}
        {showPathAnalysisCard && (
          <PathAnalysisContextCard
            pathData={message.metadata!.pathAnalysisContext!.pathData}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* Test Data Point Context Card - shown above user message when navigating from Tests page */}
        {showTestDataPointCard && (
          <TestDataPointContextCard
            data={message.metadata!.testDataPointContext!.data}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* TE Analysis Context Card - shown above user message from any ThousandEyes "Ask AI" button */}
        {showTEAnalysisCard && (
          <TEAnalysisContextCard
            data={message.metadata!.teAnalysisContext!.data}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* Splunk Analysis Context Card - shown above user message from Splunk "Ask AI" buttons */}
        {showSplunkAnalysisCard && (
          <SplunkAnalysisContextCard
            data={message.metadata!.splunkAnalysisContext!.data}
            isAnalyzing={isAnalyzing}
          />
        )}

        <div
          className={`rounded-2xl px-5 py-3.5 overflow-hidden transition-all duration-200 ${
            isUser
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
              : isSystem
              ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50'
              : 'bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 shadow-sm'
          } ${isHighlighted ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-950' : ''}`}
        >
          {isUser ? (
            // For context card messages, show a simplified prompt instead of the full AI-facing message
            showIncidentCard ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                Analyze this incident and provide recommendations.
              </p>
            ) : showPathAnalysisCard ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                Analyze this network path and identify optimizations.
              </p>
            ) : showTestDataPointCard ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {message.metadata!.testDataPointContext!.data.userQuestion || 'Analyze this test data point.'}
              </p>
            ) : showTEAnalysisCard ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                Analyze this {message.metadata!.teAnalysisContext!.data.category.replace('-', ' ')} and provide insights.
              </p>
            ) : showSplunkAnalysisCard ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                Run {message.metadata!.splunkAnalysisContext!.data.category === 'security-briefing' ? 'a security intelligence briefing' : `a ${message.metadata!.splunkAnalysisContext!.data.category.replace('-', ' ')} analysis`} and provide recommendations.
              </p>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
            )
          ) : (
            <MarkdownContent content={message.content} />
          )}

          {/* Usage info for assistant messages */}
          {message.role === 'assistant' && message.metadata && (
            <UsageInfo metadata={message.metadata} />
          )}
        </div>
      </div>
    </div>
  );
});
Message.displayName = 'Message';

// Streaming indicator
const StreamingIndicator = memo(({
  phase,
  content,
  currentTool,
  currentAgent,
}: {
  phase: StreamingPhase;
  content: string;
  currentTool?: string;
  currentAgent?: string;
}) => {
  const getPhaseLabel = () => {
    switch (phase) {
      case 'thinking':
        return 'Thinking...';
      case 'tool_call':
        return currentTool ? `Using ${currentTool}...` : 'Using tool...';
      case 'agent_work':
        return currentAgent ? `${currentAgent} working...` : 'Agent working...';
      case 'streaming':
        return 'Generating...';
      case 'synthesizing':
        return 'Synthesizing results...';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="flex justify-start min-w-0">
      <div className="max-w-full rounded-2xl px-5 py-3.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden">
        {/* Phase indicator */}
        <div className="flex items-center gap-2 mb-2 text-xs text-cyan-600 dark:text-cyan-400">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="font-medium">{getPhaseLabel()}</span>
        </div>

        {/* Streaming content */}
        {content && <MarkdownContent content={content} />}
      </div>
    </div>
  );
});
StreamingIndicator.displayName = 'StreamingIndicator';

// Follow-up suggestion buttons — first is always a primary "dig deeper" action
const FollowUpButtons = memo(({
  suggestions,
  onClick,
}: {
  suggestions: FollowUpSuggestion[];
  onClick: (query: string) => void;
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  const [primary, ...secondary] = suggestions;

  return (
    <div className="flex justify-start min-w-0">
      <div className="flex flex-col gap-2 max-w-full">
        {/* Primary action — prominent "dig deeper" button */}
        <button
          onClick={() => onClick(primary.query)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
            text-white
            bg-gradient-to-r from-cyan-600 to-blue-600
            rounded-xl hover:from-cyan-500 hover:to-blue-500
            shadow-md hover:shadow-lg hover:shadow-cyan-500/20
            transition-all duration-150 hover:scale-[1.02]"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
          {primary.label}
        </button>

        {/* Secondary suggestions — smaller, outlined */}
        {secondary.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {secondary.map((s, i) => (
              <button
                key={i}
                onClick={() => onClick(s.query)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                  text-cyan-700 dark:text-cyan-300
                  bg-cyan-50 dark:bg-cyan-500/10
                  border border-cyan-200 dark:border-cyan-500/20
                  rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20
                  hover:border-cyan-300 dark:hover:border-cyan-500/30
                  transition-all duration-150"
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
FollowUpButtons.displayName = 'FollowUpButtons';

// Chat input
const ChatInput = memo(({
  onSend,
  onStop,
  disabled,
  isLoading,
  placeholder,
}: {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate rows based on value (derived state, no effect needed)
  const rows = Math.min(Math.max((value.match(/\n/g) || []).length + 1, 1), 6);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && !disabled && !isLoading) {
      onSend(trimmed);
      setValue('');
    }
  }, [value, disabled, isLoading, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700/50">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Ask anything...'}
          disabled={disabled || isLoading}
          rows={rows}
          className="flex-1 px-4 py-3 rounded-xl border resize-none transition-all
            bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50
            text-slate-900 dark:text-white text-sm
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:focus:border-cyan-600
            disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {isLoading && onStop ? (
          <button
            onClick={onStop}
            className="p-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-600/20 hover:text-red-500 dark:hover:text-red-400 transition-all"
            title="Stop generation"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || disabled || isLoading}
            className={`p-3 rounded-xl transition-all ${
              value.trim() && !disabled && !isLoading
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg hover:shadow-cyan-500/25 hover:scale-105'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});
ChatInput.displayName = 'ChatInput';

// =============================================================================
// Main Component
// =============================================================================

export function ChatPanel({
  messages,
  onSendMessage,
  isStreaming = false,
  streamingPhase = 'idle',
  streamingContent = '',
  streamingError,
  currentTool,
  currentAgent,
  onCancel,
  disabled = false,
  placeholder,
  className = '',
  sessionId,
  onActionApproval,
  followupSuggestions,
  onFollowupClick,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Try to get highlight context (may be null if not wrapped in provider)
  const highlightContext = useContext(HighlightContext);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className={`flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden ${className}`}>
      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 min-w-0"
      >
        {!hasMessages && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Start a Conversation</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                Ask questions, analyze your network, or get AI-powered insights.
              </p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <Message
            key={message.id}
            message={message}
            isHighlighted={highlightContext?.isMessageHighlighted(message.id)}
            onMouseEnter={() => highlightContext?.highlightFromMessage(message.id)}
            onMouseLeave={() => highlightContext?.clearHighlight()}
            isLastMessage={index === messages.length - 1}
            isStreaming={isStreaming}
          />
        ))}

        {isStreaming && streamingPhase !== 'idle' && streamingPhase !== 'error' && (
          <StreamingIndicator
            phase={streamingPhase}
            content={streamingContent}
            currentTool={currentTool}
            currentAgent={currentAgent}
          />
        )}

        {streamingPhase === 'error' && streamingError && (
          <div className="flex justify-start min-w-0">
            <div className="max-w-full rounded-2xl px-5 py-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>{streamingError}</span>
              </div>
            </div>
          </div>
        )}

        {/* Follow-up suggestion buttons */}
        {!isStreaming && followupSuggestions && followupSuggestions.length > 0 && onFollowupClick && (
          <FollowUpButtons suggestions={followupSuggestions} onClick={onFollowupClick} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending Actions Bar - shown when there are actions awaiting approval */}
      <PendingActionsBar
        sessionId={sessionId}
        onActionComplete={onActionApproval}
      />

      {/* Input area */}
      <ChatInput
        onSend={onSendMessage}
        onStop={onCancel}
        disabled={disabled}
        isLoading={isStreaming}
        placeholder={placeholder}
      />
    </div>
  );
}

export default ChatPanel;
