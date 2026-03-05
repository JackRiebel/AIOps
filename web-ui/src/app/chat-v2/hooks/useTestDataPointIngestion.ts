/**
 * useTestDataPointIngestion - Hook for handling test data point URL parameter ingestion
 *
 * Implements a state machine for the "Ask AI" flow from the ThousandEyes tests page:
 * idle -> waiting_for_session -> creating_session -> sending -> done | error
 *
 * Follows the same pattern as useIncidentIngestion.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { StreamResult, AddMessageFn, AddCardFn, LogAIQueryFn, ChatSession } from '../services/messageHandler';
import type { StreamOptions as UseStreamingOptions, StreamResult as UseStreamingResult } from './useStreaming';
import { processStreamResult } from '../services/messageHandler';
import type { TestDataPointContextData } from '../components/TestDataPointContextCard';

// =============================================================================
// Types
// =============================================================================

export type TestDataPointState = 'idle' | 'waiting_for_session' | 'creating_session' | 'sending' | 'done' | 'error';

export interface TestDataPointPayload {
  message: string;
  context: {
    type: 'test_data_point';
    data: TestDataPointContextData;
  };
}

export interface TestDataPointChatSession extends ChatSession {
  messages: Array<{ role: string; content: string }>;
}

export interface UseTestDataPointIngestionOptions {
  session: TestDataPointChatSession | null;
  sessionLoading: boolean;
  isStreaming: boolean;
  newSession: () => Promise<void>;
  addMessage: AddMessageFn;
  addCard: AddCardFn;
  stream: (options: UseStreamingOptions) => Promise<UseStreamingResult>;
  orgDisplayNames: Record<string, string>;
  isAISessionActive: boolean;
  logAIQuery: LogAIQueryFn;
}

export interface UseTestDataPointIngestionReturn {
  testDataPointState: TestDataPointState;
  error: string | null;
  retry: () => void;
  cancel: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function decodePayload(encoded: string | null): TestDataPointPayload | null {
  if (!encoded) return null;
  try {
    return JSON.parse(decodeURIComponent(atob(encoded)));
  } catch (e) {
    console.error('[useTestDataPointIngestion] Failed to decode payload:', e);
    return null;
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useTestDataPointIngestion({
  session,
  sessionLoading,
  isStreaming,
  newSession,
  addMessage,
  addCard,
  stream,
  orgDisplayNames,
  isAISessionActive,
  logAIQuery,
}: UseTestDataPointIngestionOptions): UseTestDataPointIngestionReturn {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [state, setState] = useState<TestDataPointState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [storedPayload, setStoredPayload] = useState<TestDataPointPayload | null>(null);
  const [processedKey, setProcessedKey] = useState<string | null>(null);

  const targetSessionIdRef = useRef<string | null>(null);
  const isSendingRef = useRef(false);

  const encoded = searchParams.get('test_data_point');
  const needsNewSession = searchParams.get('new_session') === 'true';
  const urlPayload = useMemo(() => decodePayload(encoded), [encoded]);

  // Detect new data point and start flow
  useEffect(() => {
    if (urlPayload && state === 'idle') {
      const key = `${urlPayload.context.data.testId}-${urlPayload.context.data.timestamp}`;
      if (processedKey !== key) {
        setStoredPayload(urlPayload);
        setError(null);
        isSendingRef.current = false;
        setState('waiting_for_session');
      }
    }
  }, [urlPayload, state, processedKey]);

  // Clear URL after processing starts
  useEffect(() => {
    if (state !== 'idle' && encoded) {
      const timer = setTimeout(() => {
        router.replace('/chat-v2', { scroll: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [state, encoded, router]);

  // State machine
  useEffect(() => {
    if (state === 'idle' || state === 'done' || state === 'error') return;

    const payload = storedPayload;
    if (!payload) { setState('idle'); return; }

    if (state === 'waiting_for_session') {
      if (sessionLoading) return;
      if (needsNewSession) {
        setState('creating_session');
        newSession().catch(() => {
          setError('Failed to create new session');
          setState('error');
        });
      } else {
        targetSessionIdRef.current = session?.id || null;
        setState('sending');
      }
      return;
    }

    if (state === 'creating_session') {
      if (!session || session.messages.length > 0) return;
      targetSessionIdRef.current = session.id;
      setState('sending');
      return;
    }

    if (state === 'sending') {
      if (isSendingRef.current) return;
      if (!session || isStreaming) return;
      if (targetSessionIdRef.current && session.id !== targetSessionIdRef.current) return;

      isSendingRef.current = true;

      addMessage({
        role: 'user',
        content: payload.message,
        metadata: {
          testDataPointContext: payload.context,
        },
      });

      setState('done');
      setProcessedKey(`${payload.context.data.testId}-${payload.context.data.timestamp}`);
      targetSessionIdRef.current = null;
      setStoredPayload(null);

      // Send to AI immediately (no setTimeout to avoid race with debounced session save)
      const sessionId = session.id;
      (async () => {
        const startTime = Date.now();
        try {
          const result = await stream({
            message: payload.message,
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
            originalQuery: payload.message,
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
  }, [state, storedPayload, needsNewSession, session, sessionLoading, isStreaming, newSession, addMessage, addCard, stream, orgDisplayNames, isAISessionActive, logAIQuery]);

  const retry = useCallback(() => {
    if (state === 'error' && storedPayload) {
      setError(null);
      isSendingRef.current = false;
      setState('waiting_for_session');
    }
  }, [state, storedPayload]);

  const cancel = useCallback(() => {
    setState('idle');
    setStoredPayload(null);
    setError(null);
    isSendingRef.current = false;
    targetSessionIdRef.current = null;
  }, []);

  return { testDataPointState: state, error, retry, cancel };
}
