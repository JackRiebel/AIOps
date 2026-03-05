/**
 * useQueryIngestion - Hook for handling ?q= URL parameter ingestion
 *
 * Many pages across the app navigate to /chat-v2?q=<query> to "Ask AI".
 * This hook detects the ?q= parameter, creates a new user message,
 * and auto-streams the AI response.
 *
 * State machine: idle -> waiting_for_session -> sending -> done | error
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { AddMessageFn, AddCardFn, LogAIQueryFn, ChatSession } from '../services/messageHandler';
import type { StreamOptions as UseStreamingOptions, StreamResult as UseStreamingResult } from './useStreaming';
import { processStreamResult } from '../services/messageHandler';

// =============================================================================
// Types
// =============================================================================

export type QueryIngestionState = 'idle' | 'waiting_for_session' | 'sending' | 'done' | 'error';

export interface QueryIngestionChatSession extends ChatSession {
  messages: Array<{ role: string; content: string }>;
}

export interface UseQueryIngestionOptions {
  session: QueryIngestionChatSession | null;
  sessionLoading: boolean;
  isStreaming: boolean;
  addMessage: AddMessageFn;
  addCard: AddCardFn;
  stream: (options: UseStreamingOptions) => Promise<UseStreamingResult>;
  orgDisplayNames: Record<string, string>;
  isAISessionActive: boolean;
  logAIQuery: LogAIQueryFn;
}

export interface UseQueryIngestionReturn {
  queryIngestionState: QueryIngestionState;
  error: string | null;
}

// =============================================================================
// Hook
// =============================================================================

export function useQueryIngestion({
  session,
  sessionLoading,
  isStreaming,
  addMessage,
  addCard,
  stream,
  orgDisplayNames,
  isAISessionActive,
  logAIQuery,
}: UseQueryIngestionOptions): UseQueryIngestionReturn {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [state, setState] = useState<QueryIngestionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [storedQuery, setStoredQuery] = useState<string | null>(null);

  const isSendingRef = useRef(false);

  const query = searchParams.get('q');

  // Detect ?q= param and start flow
  useEffect(() => {
    if (query && state === 'idle' && !isSendingRef.current) {
      const decoded = query.replace(/\+/g, ' ');
      if (decoded.trim()) {
        setStoredQuery(decoded.trim());
        setError(null);
        isSendingRef.current = false;
        setState('waiting_for_session');
      }
    }
  }, [query, state]);

  // Clear ?q= from URL after processing starts
  useEffect(() => {
    if (state !== 'idle' && query) {
      const timer = setTimeout(() => {
        router.replace('/chat-v2', { scroll: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [state, query, router]);

  // State machine
  useEffect(() => {
    if (state === 'idle' || state === 'done' || state === 'error') return;

    const q = storedQuery;
    if (!q) { setState('idle'); return; }

    if (state === 'waiting_for_session') {
      if (sessionLoading) return;
      if (!session) return;
      setState('sending');
      return;
    }

    if (state === 'sending') {
      if (isSendingRef.current) return;
      if (!session || isStreaming) return;

      isSendingRef.current = true;

      // Add user message
      addMessage({
        role: 'user',
        content: q,
      });

      setState('done');
      setStoredQuery(null);

      // Send to AI immediately (no setTimeout to avoid race with debounced session save)
      const sessionId = session.id;
      (async () => {
        const startTime = Date.now();
        try {
          const result = await stream({
            message: q,
            history: [],
            sessionId,
            verbosity: 'standard',
            organization: '',
            orgDisplayNames,
          });
          processStreamResult({
            result,
            session,
            addMessage,
            addCard,
            originalQuery: q,
            durationMs: Date.now() - startTime,
            isAISessionActive,
            logAIQuery,
            lastAssistantMessageId: null,
          });
        } catch (err) {
          addMessage({
            role: 'system',
            content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          });
        } finally {
          isSendingRef.current = false;
        }
      })();
    }
  }, [state, storedQuery, session, sessionLoading, isStreaming, addMessage, addCard, stream, orgDisplayNames, isAISessionActive, logAIQuery]);

  return { queryIngestionState: state, error };
}
