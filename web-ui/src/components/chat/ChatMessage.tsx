'use client';

import { useState, useCallback, memo, useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock, InlineCode } from './CodeBlock';
import { SmartCardSuggestions } from './SmartCardSuggestions';
import { CitationsDisplay } from './CitationsDisplay';
import { IncidentContextCard, isIncidentContext } from './IncidentContextCard';
import { HelpTooltip } from '@/components/common';
import type { CanvasCard } from '@/types/session';

// ============================================================================
// Types
// ============================================================================

export interface Citation {
  index: number;
  chunk_id: number;
  document_id: number;
  title: string;
  section?: string;
  quote?: string;
  relevance: number;
}

export interface AgenticRAGMetrics {
  enabled: boolean;
  iterations: number;
  agents_used: string[];
  query_type?: string;
  quality?: string;
  latency_ms?: number;
  web_search_used?: boolean;
}

// Backend card suggestion (from knowledge retrieval, etc.)
export interface CardSuggestion {
  type: string;
  title: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface Message {
  id: number | string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  data?: any;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
  };
  tools_used?: string[];
  duration_ms?: number;
  /** Estimated time saved in seconds compared to manual resolution */
  time_saved_seconds?: number;
  /** Model name that generated this response */
  model_name?: string;
  /** Confidence score (0-100) if available */
  confidence_score?: number;
  isStreaming?: boolean;
  citations?: Citation[];
  knowledge_used?: boolean;
  sources_markdown?: string;
  agentic_rag?: AgenticRAGMetrics;
  // Knowledge base card suggestions from backend
  card_suggestions?: CardSuggestion[];
}

export interface ChatMessageProps {
  message: Message;
  isExpanded?: boolean;
  onToggleExpand?: (id: string | number) => void;
  onCopy?: (content: string) => void;
  onFeedback?: (id: string | number, type: 'positive' | 'negative') => void;
  showActions?: boolean;
  renderToolResults?: (data: any) => React.ReactNode;
  /** Handler when user clicks to add a card to canvas */
  onAddCard?: (card: CanvasCard) => void;
  /** Existing canvas cards (for layout positioning) */
  existingCards?: CanvasCard[];
  /** Source query that triggered this response (for card context) */
  sourceQuery?: string;
  /** Known devices from session context for action suggestions */
  knownDevices?: Array<{ name: string; serial: string; model?: string; lanIp?: string }>;
  /** Only allow auto-adding cards for the most recent message */
  isLatestMessage?: boolean;
}

// ============================================================================
// Markdown Components with Syntax Highlighting
// ============================================================================

const markdownComponents: Components = {
  // Custom code block renderer with syntax highlighting
  code({ node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match && !className;

    if (isInline) {
      return <InlineCode>{children}</InlineCode>;
    }

    const language = match ? match[1] : 'text';
    const codeString = String(children).replace(/\n$/, '');

    return (
      <CodeBlock language={language} showLineNumbers={codeString.split('\n').length > 5}>
        {codeString}
      </CodeBlock>
    );
  },
  // Custom pre handler - just return children since CodeBlock handles the wrapper
  pre({ children }) {
    return <>{children}</>;
  },
};

// ============================================================================
// Content Processing Utilities
// ============================================================================

/**
 * Strip structured JSON blocks from content before display.
 * The AI includes these for structured data extraction (cards), but users shouldn't see them.
 */
function stripStructuredJson(content: string): string {
  // Remove ```json:comparison blocks (with flexible whitespace handling)
  let cleaned = content.replace(/```json:comparison[\s\S]*?```/gi, '');

  // Remove ```json:product blocks (with flexible whitespace handling)
  cleaned = cleaned.replace(/```json:product[\s\S]*?```/gi, '');

  // Also remove regular json blocks that contain "products" (comparison data)
  cleaned = cleaned.replace(/```json[\s\S]*?"products"\s*:[\s\S]*?```/gi, '');

  // Also remove regular json blocks that contain "product" at start (single product data)
  cleaned = cleaned.replace(/```json\s*\n\s*\{\s*\n?\s*"product"\s*:[\s\S]*?```/gi, '');

  // Clean up extra whitespace at the end
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

// ============================================================================
// Markdown Content Component
// ============================================================================

const MarkdownContent = memo(({ content }: { content: string }) => {
  // Strip structured JSON blocks before rendering (comparison, product, etc.)
  const cleanedContent = stripStructuredJson(content);

  return (
    <div className="prose dark:prose-invert prose-sm max-w-none
      prose-headings:text-slate-900 dark:prose-headings:text-white prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
      prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed prose-p:my-2
      prose-a:text-cyan-600 dark:prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
      prose-ul:text-slate-700 dark:prose-ul:text-slate-300 prose-ol:text-slate-700 dark:prose-ol:text-slate-300
      prose-li:my-1 prose-li:marker:text-slate-500 dark:prose-li:marker:text-slate-500
      prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-semibold
      prose-blockquote:border-l-cyan-500 prose-blockquote:text-slate-500 dark:prose-blockquote:text-slate-400 prose-blockquote:italic
      prose-table:text-sm prose-th:text-cyan-700 dark:prose-th:text-cyan-300 prose-th:font-semibold prose-td:text-slate-700 dark:prose-td:text-slate-300
      prose-hr:border-slate-200 dark:prose-hr:border-slate-700"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {cleanedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownContent.displayName = 'MarkdownContent';

// ============================================================================
// Collapsible Content Component
// ============================================================================

const CollapsibleContent = memo(({
  content,
  isExpanded,
  onToggle
}: {
  content: string;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  // Extract a short summary - first sentence or first 100 chars
  const getSummary = (text: string): string => {
    const plainText = text.replace(/[#*`_~\[\]]/g, '').trim();
    const firstSentence = plainText.match(/^[^.!?]+[.!?]/);
    if (firstSentence && firstSentence[0].length < 150) {
      return firstSentence[0];
    }
    if (plainText.length <= 100) return plainText;
    return plainText.slice(0, 100).trim() + '...';
  };

  const summary = getSummary(content);
  const hasMoreContent = content.length > summary.length + 20;

  if (!hasMoreContent) {
    return <MarkdownContent content={content} />;
  }

  return (
    <div>
      {isExpanded ? (
        <MarkdownContent content={content} />
      ) : (
        <p className="text-sm text-slate-700 dark:text-slate-300">{summary}</p>
      )}
      <button
        onClick={onToggle}
        className="mt-2 text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1"
      >
        {isExpanded ? (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            Show less
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Show more
          </>
        )}
      </button>
    </div>
  );
});

CollapsibleContent.displayName = 'CollapsibleContent';

// ============================================================================
// Message Actions Component
// ============================================================================

const MessageActions = memo(({
  message,
  onCopy,
  onFeedback,
  showActions
}: {
  message: Message;
  onCopy?: (content: string) => void;
  onFeedback?: (id: string | number, type: 'positive' | 'negative') => void;
  showActions?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      onCopy?.(message.content);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [message.content, onCopy]);

  const handleFeedback = useCallback((type: 'positive' | 'negative') => {
    setFeedbackGiven(type);
    onFeedback?.(message.id, type);
  }, [message.id, onFeedback]);

  if (!showActions || message.role !== 'assistant') return null;

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/30">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        title="Copy to clipboard"
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* Feedback buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleFeedback('positive')}
          disabled={feedbackGiven !== null}
          className={`p-1.5 rounded-lg transition-colors ${
            feedbackGiven === 'positive'
              ? 'text-green-500 bg-green-50 dark:bg-green-500/10'
              : feedbackGiven !== null
              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10'
          }`}
          title="Good response"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
        </button>
        <button
          onClick={() => handleFeedback('negative')}
          disabled={feedbackGiven !== null}
          className={`p-1.5 rounded-lg transition-colors ${
            feedbackGiven === 'negative'
              ? 'text-red-500 bg-red-50 dark:bg-red-500/10'
              : feedbackGiven !== null
              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
          }`}
          title="Poor response"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
          </svg>
        </button>
      </div>
    </div>
  );
});

MessageActions.displayName = 'MessageActions';

// ============================================================================
// Usage Information Component (Quiet Metadata Format)
// ============================================================================

interface UsageInfoProps {
  usage?: Message['usage'];
  toolsUsed?: string[];
  durationMs?: number;
  timeSavedSeconds?: number;
  modelName?: string;
  confidenceScore?: number;
}

const UsageInfo = memo(({ usage, toolsUsed, durationMs, timeSavedSeconds, modelName, confidenceScore }: UsageInfoProps) => {
  const hasUsage = usage && (usage.input_tokens || usage.output_tokens);
  // Show cost when defined (even if $0 - so users know it was tracked)
  const hasCost = usage?.cost_usd !== undefined;
  const hasDuration = durationMs !== undefined && durationMs > 0;
  const hasTools = toolsUsed && toolsUsed.length > 0;
  const hasTimeSaved = timeSavedSeconds !== undefined && timeSavedSeconds > 0;
  const hasModel = !!modelName;
  const hasConfidence = confidenceScore !== undefined && confidenceScore > 0;

  if (!hasUsage && !hasCost && !hasDuration && !hasTools && !hasTimeSaved && !hasModel && !hasConfidence) return null;

  // Format duration: show as seconds if >= 1000ms, otherwise ms
  const formatDuration = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
  };

  // Format time saved: show in minutes/hours
  const formatTimeSaved = (seconds: number) => {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.round((seconds % 3600) / 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (seconds >= 60) {
      return `${Math.round(seconds / 60)}m`;
    }
    return `${seconds}s`;
  };

  // Build quiet metadata parts (numbers only, no labels)
  const metaParts: string[] = [];
  // Model name first if available
  if (hasModel) {
    // Shorten common model names for display
    const shortName = modelName
      .replace('claude-', '')
      .replace('gpt-', '')
      .replace('-20250514', '')
      .replace('-20241022', '')
      .replace('-20240620', '');
    metaParts.push(shortName);
  }
  if (hasUsage) {
    metaParts.push(`${usage.input_tokens?.toLocaleString() || 0} in`);
    metaParts.push(`${usage.output_tokens?.toLocaleString() || 0} out`);
  }
  if (hasCost) {
    metaParts.push(`$${usage!.cost_usd!.toFixed(4)}`);
  }
  if (hasDuration) {
    metaParts.push(formatDuration(durationMs));
  }
  // Add tools summary as part of the metadata line
  if (hasTools) {
    metaParts.push(`${toolsUsed.length} tool${toolsUsed.length !== 1 ? 's' : ''} used`);
  }

  // Confidence badge color
  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10';
    return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10';
  };

  return (
    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/20">
      {/* Quiet metadata line with all info including tools summary */}
      <div className="flex items-center gap-2 flex-wrap">
        {metaParts.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            {metaParts.join(' · ')}
            <HelpTooltip content="Model · input tokens · output tokens · cost · response time · tools used. Tokens measure text processed; costs reflect API pricing." />
          </div>
        )}
        {/* Confidence score badge */}
        {hasConfidence && (
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${getConfidenceColor(confidenceScore)}`}>
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {confidenceScore}%
          </span>
        )}
      </div>
      {/* Time saved indicator - highlighted in emerald to show value */}
      {hasTimeSaved && (
        <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          ~{formatTimeSaved(timeSavedSeconds)} saved vs manual
          <HelpTooltip content="Estimated time saved compared to manually gathering this information. Based on tools used, platforms queried, and query complexity." />
        </div>
      )}
    </div>
  );
});

UsageInfo.displayName = 'UsageInfo';

// ============================================================================
// Main ChatMessage Component
// ============================================================================

export const ChatMessage = memo(({
  message,
  isExpanded = false,
  onToggleExpand,
  onCopy,
  onFeedback,
  showActions = true,
  renderToolResults,
  onAddCard,
  existingCards,
  sourceQuery,
  knownDevices = [],
  isLatestMessage = false,
}: ChatMessageProps) => {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);

  const handleToggleExpand = useCallback(() => {
    const newExpanded = !localExpanded;
    setLocalExpanded(newExpanded);
    onToggleExpand?.(message.id);
  }, [localExpanded, message.id, onToggleExpand]);

  const hasToolResults = message.data && renderToolResults;

  // Get alignment and styling based on role
  const alignmentClass = message.role === 'user' ? 'justify-end' : 'justify-start';

  const bubbleClass = message.role === 'user'
    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
    : message.role === 'system'
    ? 'bg-slate-100 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/30'
    : 'bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/30 shadow-sm dark:shadow-none';

  // Streaming indicator
  const StreamingDots = () => (
    <span className="inline-flex items-center gap-1 ml-1">
      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );

  return (
    <div className={`flex ${alignmentClass}`}>
      <div className={`max-w-4xl rounded-xl px-6 py-4 ${bubbleClass}`}>
        {/* Message Content */}
        {message.role === 'user' ? (
          // Check if this is an incident analysis request - show card instead of text
          isIncidentContext(message.data) ? (
            <IncidentContextCard incident={message.data.incident} />
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </div>
          )
        ) : message.role === 'system' ? (
          <MarkdownContent content={message.content} />
        ) : hasToolResults ? (
          <CollapsibleContent
            content={message.content}
            isExpanded={localExpanded}
            onToggle={handleToggleExpand}
          />
        ) : (
          <MarkdownContent content={message.content} />
        )}

        {/* Streaming indicator */}
        {message.isStreaming && <StreamingDots />}

        {/* Tool Results */}
        {hasToolResults && renderToolResults && (
          <div className="mt-4">
            {renderToolResults(message.data)}
          </div>
        )}

        {/* Knowledge Citations */}
        {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
          <CitationsDisplay citations={message.citations} agenticRag={message.agentic_rag} />
        )}

        {/* Smart Card Suggestions - AI-like recommendations based on context */}
        {message.role === 'assistant' && !message.isStreaming && onAddCard && sourceQuery && (
          <SmartCardSuggestions
            query={sourceQuery}
            responseContent={message.content}
            structuredData={message.data}
            onAddCard={(card) => onAddCard(card as CanvasCard)}
            existingCards={existingCards}
            sourceMessageId={String(message.id)}
            toolName={message.tools_used?.[0]}
            backendSuggestions={message.card_suggestions}
            isLatestMessage={isLatestMessage}
          />
        )}

        {/* Usage Information (quiet metadata) */}
        {message.role === 'assistant' && !message.isStreaming && (
          <UsageInfo
            usage={message.usage}
            toolsUsed={message.tools_used}
            durationMs={message.duration_ms}
            timeSavedSeconds={message.time_saved_seconds}
            modelName={message.model_name}
            confidenceScore={message.confidence_score}
          />
        )}

        {/* Message Actions */}
        {!message.isStreaming && (
          <MessageActions
            message={message}
            onCopy={onCopy}
            onFeedback={onFeedback}
            showActions={showActions}
          />
        )}
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
