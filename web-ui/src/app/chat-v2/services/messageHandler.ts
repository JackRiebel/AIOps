/**
 * messageHandler - Shared message handling logic for chat responses
 *
 * Consolidates duplicated message processing code from page.tsx
 */

import type { AllCardTypes, ChatMessage, IncidentContextData } from '../types';
import type { SmartCard } from '../cards/types';
import type { AddCardOptions as SessionAddCardOptions } from '../hooks/useSession';
import type { StreamResult as StreamingResult, CardSuggestion, FollowUpSuggestion } from '../hooks/useStreaming';
import { mapBackendCardType } from '../cards';

// =============================================================================
// Re-export Types from Source Files
// =============================================================================

export type { CardSuggestion } from '../hooks/useStreaming';

// StreamResult matches useStreaming's StreamResult
export type StreamResult = StreamingResult;

// Session type for message handler (subset of ChatSession)
export interface ChatSession {
  id: string;
  cards: Array<{ type: AllCardTypes }>;
}

// AddCardOptions matches useSession's AddCardOptions
export type AddCardOptions = SessionAddCardOptions;

// AddMessage function type matches useSession's addMessage
export type AddMessageFn = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;

// AddCard function type matches useSession's addCard
export type AddCardFn = (options: AddCardOptions) => SmartCard;

export interface LogAIQueryFn {
  (
    query: string,
    response: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    metadata: {
      chatSessionId: string;
      toolsUsed?: string[];
      durationMs?: number;
      costUsd?: number;
    }
  ): void;
}

// =============================================================================
// Message Processing Functions
// =============================================================================

export interface ProcessStreamResultOptions {
  result: StreamResult;
  session: ChatSession;
  addMessage: AddMessageFn;
  addCard: AddCardFn;
  originalQuery: string;
  durationMs: number;
  isAISessionActive: boolean;
  logAIQuery: LogAIQueryFn;
  lastAssistantMessageId?: string | null;
}

export interface ProcessStreamResultOutput {
  followupSuggestions: FollowUpSuggestion[];
}

/**
 * Process a stream result and add messages/cards to the session
 */
export function processStreamResult({
  result,
  session,
  addMessage,
  addCard,
  originalQuery,
  durationMs,
  isAISessionActive,
  logAIQuery,
  lastAssistantMessageId,
}: ProcessStreamResultOptions): ProcessStreamResultOutput {
  const output: ProcessStreamResultOutput = {
    followupSuggestions: result.followupSuggestions || [],
  };

  // Add assistant response
  if (result.content) {
    addMessage({
      role: 'assistant',
      content: result.content,
      metadata: {
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        costUsd: result.usage?.costUsd,
        durationMs,
        toolsUsed: result.toolsUsed,
        structuredData: result.toolData,
      },
    });

    // Log to AI Session for costs/ROI tracking (if session is active)
    if (isAISessionActive && result.usage) {
      logAIQuery(
        originalQuery,
        result.content,
        'claude-3-5-haiku-20241022', // model (backend tracks actual model)
        result.usage.inputTokens || 0,
        result.usage.outputTokens || 0,
        {
          chatSessionId: session.id,
          toolsUsed: result.toolsUsed,
          durationMs,
          costUsd: result.usage.costUsd,
        }
      );
    }

    // Handle card suggestions
    if (result.cardSuggestions && result.cardSuggestions.length > 0) {
      processCardSuggestions(
        result.cardSuggestions,
        session.cards,
        addCard,
        lastAssistantMessageId ?? null,
        originalQuery
      );
    }
  }

  if (result.error) {
    addMessage({
      role: 'system',
      content: `Error: ${result.error}`,
    });
  }

  return output;
}

/**
 * Process card suggestions from AI response with deduplication
 */
export function processCardSuggestions(
  suggestions: CardSuggestion[],
  existingCards: Array<{ type: AllCardTypes }>,
  addCard: AddCardFn,
  lastMessageId: string | null,
  originalQuery: string
): void {
  // Track cards added in this batch to prevent duplicates within same response
  const addedTypes = new Set<string>();

  suggestions.forEach((suggestion) => {
    // Map backend card type to frontend SmartCard type
    const mappedType = mapBackendCardType(suggestion.type);
    if (!mappedType) {
      console.warn(`[messageHandler] Skipping unknown card type: ${suggestion.type}`);
      return;
    }

    // Skip if we already have a card of this type (deduplication)
    // Check both existing session cards AND cards added in this batch
    if (existingCards.some((c) => c.type === mappedType) || addedTypes.has(mappedType)) {
      console.log(`[messageHandler] Skipping duplicate card type: ${mappedType}`);
      return;
    }

    addedTypes.add(mappedType);
    const metadata = suggestion.metadata ?? {};
    addCard({
      type: mappedType,
      title: suggestion.title,
      subtitle: metadata.subtitle as string | undefined,
      data: suggestion.data,
      toolCallId: metadata.toolCallId as string || `suggestion-${crypto.randomUUID()}`,
      sourceMessageId: lastMessageId ?? undefined,
      originalQuery,
      refreshEndpoint: metadata.refreshEndpoint as string | undefined,
      refreshInterval: metadata.refreshInterval as number | undefined,
      scope: metadata.scope as {
        credentialOrg?: string;
        organizationId?: string;
        organizationName?: string;
        networkId?: string;
        networkName?: string;
        deviceSerial?: string;
        siteId?: string;
        testId?: string;
      } | undefined,
    });
  });
}
