/**
 * useIncidentIngestion - Hook for handling incident URL parameter ingestion
 *
 * Implements a state machine for the "Ask AI" flow from the incidents page:
 * idle -> waiting_for_session -> creating_session -> sending -> done | error
 *
 * Improvements over the original implementation:
 * - Single effect managing all state transitions
 * - Explicit state instead of refs for payload persistence
 * - Error state with recovery
 * - Clear state machine with predictable transitions
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { StreamResult, AddMessageFn, AddCardFn, LogAIQueryFn, ChatSession } from '../services/messageHandler';
import type { StreamOptions as UseStreamingOptions, StreamResult as UseStreamingResult } from './useStreaming';
import { processStreamResult } from '../services/messageHandler';
import type { AllCardTypes, IncidentContextData } from '../types';

// =============================================================================
// Types
// =============================================================================

export type AskAIState = 'idle' | 'waiting_for_session' | 'creating_session' | 'sending' | 'done' | 'error';

export interface IncidentPayload {
  message: string;
  context: {
    type: 'incident_analysis';
    incident: IncidentContextData;
  };
}

// Extended session type with messages for incident ingestion
export interface IncidentChatSession extends ChatSession {
  messages: Array<{ role: string; content: string }>;
}

export interface UseIncidentIngestionOptions {
  session: IncidentChatSession | null;
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

export interface UseIncidentIngestionReturn {
  /** Current state of the Ask AI flow */
  askAIState: AskAIState;
  /** Error message if in error state */
  error: string | null;
  /** Retry after an error */
  retry: () => void;
  /** Cancel the current operation */
  cancel: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function decodeIncidentPayload(encodedIncident: string | null): IncidentPayload | null {
  if (!encodedIncident) return null;

  try {
    return JSON.parse(decodeURIComponent(atob(encodedIncident)));
  } catch (e) {
    console.error('[useIncidentIngestion] Failed to decode incident payload:', e);
    return null;
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useIncidentIngestion({
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
}: UseIncidentIngestionOptions): UseIncidentIngestionReturn {
  const searchParams = useSearchParams();
  const router = useRouter();

  // State machine state
  const [askAIState, setAskAIState] = useState<AskAIState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Store incident payload in state (persists after URL is cleared)
  const [storedPayload, setStoredPayload] = useState<IncidentPayload | null>(null);

  // Track processed incident IDs to prevent re-processing
  const [processedIncidentId, setProcessedIncidentId] = useState<number | null>(null);

  // Refs for tracking async operations
  const targetSessionIdRef = useRef<string | null>(null);
  const isSendingRef = useRef(false);

  // Decode incident payload from URL params
  const encodedIncident = searchParams.get('incident');
  const needsNewSession = searchParams.get('new_session') === 'true';
  const urlPayload = useMemo(() => decodeIncidentPayload(encodedIncident), [encodedIncident]);

  // Detect new incident and start flow
  useEffect(() => {
    if (urlPayload && askAIState === 'idle' && processedIncidentId !== urlPayload.context.incident.id) {
      console.log('[useIncidentIngestion] New incident detected, starting flow:', urlPayload.context.incident.id);
      setStoredPayload(urlPayload);
      setError(null);
      isSendingRef.current = false;
      setAskAIState('waiting_for_session');
    }
  }, [urlPayload, askAIState, processedIncidentId]);

  // Clear URL params after processing starts
  useEffect(() => {
    if (askAIState !== 'idle' && encodedIncident) {
      const timer = setTimeout(() => {
        router.replace('/chat-v2', { scroll: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [askAIState, encodedIncident, router]);

  // Main state machine effect
  useEffect(() => {
    // Skip if idle, done, or error
    if (askAIState === 'idle' || askAIState === 'done' || askAIState === 'error') return;

    const payload = storedPayload;
    if (!payload) {
      console.log('[useIncidentIngestion] No payload stored, resetting to idle');
      setAskAIState('idle');
      return;
    }

    // State: waiting_for_session
    if (askAIState === 'waiting_for_session') {
      if (sessionLoading) return;

      if (needsNewSession) {
        console.log('[useIncidentIngestion] Creating new session');
        setAskAIState('creating_session');
        newSession().catch((err) => {
          console.error('[useIncidentIngestion] Failed to create session:', err);
          setError('Failed to create new session');
          setAskAIState('error');
        });
      } else {
        console.log('[useIncidentIngestion] Using existing session');
        targetSessionIdRef.current = session?.id || null;
        setAskAIState('sending');
      }
      return;
    }

    // State: creating_session
    if (askAIState === 'creating_session') {
      if (!session || session.messages.length > 0) return;

      console.log('[useIncidentIngestion] New session ready:', session.id);
      targetSessionIdRef.current = session.id;
      setAskAIState('sending');
      return;
    }

    // State: sending
    if (askAIState === 'sending') {
      if (isSendingRef.current) return;
      if (!session || isStreaming) return;
      if (targetSessionIdRef.current && session.id !== targetSessionIdRef.current) return;

      isSendingRef.current = true;
      console.log('[useIncidentIngestion] Sending message for incident:', payload.context.incident.id);

      // Add user message with incident context
      addMessage({
        role: 'user',
        content: payload.message,
        metadata: {
          incidentContext: payload.context,
        },
      });

      // Mark as done and record processed incident
      setAskAIState('done');
      setProcessedIncidentId(payload.context.incident.id);
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

          const duration = Date.now() - startTime;

          processStreamResult({
            result,
            session,
            addMessage,
            addCard,
            originalQuery: payload.message,
            durationMs: duration,
            isAISessionActive,
            logAIQuery,
            lastAssistantMessageId: null,
          });
        } catch (err) {
          console.error('[useIncidentIngestion] Stream error:', err);
          addMessage({
            role: 'system',
            content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          });
        } finally {
          isSendingRef.current = false;
        }
      })();
    }
  }, [
    askAIState,
    storedPayload,
    needsNewSession,
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
  ]);

  // Retry handler
  const retry = useCallback(() => {
    if (askAIState === 'error' && storedPayload) {
      setError(null);
      isSendingRef.current = false;
      setAskAIState('waiting_for_session');
    }
  }, [askAIState, storedPayload]);

  // Cancel handler
  const cancel = useCallback(() => {
    setAskAIState('idle');
    setStoredPayload(null);
    setError(null);
    isSendingRef.current = false;
    targetSessionIdRef.current = null;
  }, []);

  return {
    askAIState,
    error,
    retry,
    cancel,
  };
}
