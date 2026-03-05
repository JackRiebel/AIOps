/**
 * usePathAnalysisIngestion - Hook for handling path analysis URL parameter ingestion
 *
 * Implements a state machine for the "Analyze Path" flow from the AI Journey page:
 * idle -> waiting_for_session -> creating_session -> sending -> done | error
 *
 * Follows the same pattern as useIncidentIngestion.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { StreamResult, AddMessageFn, AddCardFn, LogAIQueryFn, ChatSession } from '../services/messageHandler';
import type { StreamOptions as UseStreamingOptions, StreamResult as UseStreamingResult } from './useStreaming';
import { processStreamResult } from '../services/messageHandler';
import type { PathAnalysisContextData } from '../components/PathAnalysisContextCard';

// =============================================================================
// Types
// =============================================================================

export type PathAnalysisState = 'idle' | 'waiting_for_session' | 'creating_session' | 'sending' | 'done' | 'error';

export interface PathAnalysisPayload {
  message: string;
  context: {
    type: 'path_analysis';
    pathData: PathAnalysisContextData;
  };
}

export interface PathAnalysisChatSession extends ChatSession {
  messages: Array<{ role: string; content: string }>;
}

export interface UsePathAnalysisIngestionOptions {
  session: PathAnalysisChatSession | null;
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

export interface UsePathAnalysisIngestionReturn {
  pathAnalysisState: PathAnalysisState;
  error: string | null;
  retry: () => void;
  cancel: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function decodePathAnalysisPayload(encoded: string | null): PathAnalysisPayload | null {
  if (!encoded) return null;

  try {
    return JSON.parse(decodeURIComponent(atob(encoded)));
  } catch (e) {
    console.error('[usePathAnalysisIngestion] Failed to decode path analysis payload:', e);
    return null;
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function usePathAnalysisIngestion({
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
}: UsePathAnalysisIngestionOptions): UsePathAnalysisIngestionReturn {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [pathAnalysisState, setPathAnalysisState] = useState<PathAnalysisState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [storedPayload, setStoredPayload] = useState<PathAnalysisPayload | null>(null);
  const [processedProvider, setProcessedProvider] = useState<string | null>(null);

  const targetSessionIdRef = useRef<string | null>(null);
  const isSendingRef = useRef(false);

  const encodedPathAnalysis = searchParams.get('path_analysis');
  const needsNewSession = searchParams.get('new_session') === 'true';
  const urlPayload = useMemo(() => decodePathAnalysisPayload(encodedPathAnalysis), [encodedPathAnalysis]);

  // Detect new path analysis and start flow
  useEffect(() => {
    if (urlPayload && pathAnalysisState === 'idle' && processedProvider !== urlPayload.context.pathData.providerName) {
      console.log('[usePathAnalysisIngestion] New path analysis detected, starting flow:', urlPayload.context.pathData.providerName);
      setStoredPayload(urlPayload);
      setError(null);
      isSendingRef.current = false;
      setPathAnalysisState('waiting_for_session');
    }
  }, [urlPayload, pathAnalysisState, processedProvider]);

  // Clear URL params after processing starts
  useEffect(() => {
    if (pathAnalysisState !== 'idle' && encodedPathAnalysis) {
      const timer = setTimeout(() => {
        router.replace('/chat-v2', { scroll: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pathAnalysisState, encodedPathAnalysis, router]);

  // Main state machine effect
  useEffect(() => {
    if (pathAnalysisState === 'idle' || pathAnalysisState === 'done' || pathAnalysisState === 'error') return;

    const payload = storedPayload;
    if (!payload) {
      setPathAnalysisState('idle');
      return;
    }

    // State: waiting_for_session
    if (pathAnalysisState === 'waiting_for_session') {
      if (sessionLoading) return;

      if (needsNewSession) {
        setPathAnalysisState('creating_session');
        newSession().catch((err) => {
          console.error('[usePathAnalysisIngestion] Failed to create session:', err);
          setError('Failed to create new session');
          setPathAnalysisState('error');
        });
      } else {
        targetSessionIdRef.current = session?.id || null;
        setPathAnalysisState('sending');
      }
      return;
    }

    // State: creating_session
    if (pathAnalysisState === 'creating_session') {
      if (!session || session.messages.length > 0) return;

      targetSessionIdRef.current = session.id;
      setPathAnalysisState('sending');
      return;
    }

    // State: sending
    if (pathAnalysisState === 'sending') {
      if (isSendingRef.current) return;
      if (!session || isStreaming) return;
      if (targetSessionIdRef.current && session.id !== targetSessionIdRef.current) return;

      isSendingRef.current = true;

      // Add user message with path analysis context
      addMessage({
        role: 'user',
        content: payload.message,
        metadata: {
          pathAnalysisContext: payload.context,
        },
      });

      // Pre-create SmartCards with structured path data so they render immediately
      // Cards will live-refresh via the path-vis/detailed endpoint when testId is available
      const pathData = payload.context.pathData;
      if (pathData.hops.length > 0) {
        const hopsForCard = pathData.hops.map(h => ({
          hopNumber: h.hopNumber,
          ipAddress: h.ip,
          hostname: h.hostname,
          latency: h.latency,
          loss: h.loss,
          network: h.network,
        }));

        const cardScope = pathData.testId
          ? { testId: String(pathData.testId) }
          : undefined;

        addCard({
          type: 'te_path_visualization' as never,
          title: `${pathData.providerName} — Network Path`,
          subtitle: `${pathData.hopCount} hops`,
          data: { hops: hopsForCard },
          toolCallId: `path-analysis-viz-${Date.now()}`,
          scope: cardScope,
        });

        addCard({
          type: 'te_latency_chart' as never,
          title: `${pathData.providerName} — Latency & Loss`,
          subtitle: `${pathData.bottleneck.latency.toFixed(0)}ms bottleneck at hop ${pathData.bottleneck.hopNumber}`,
          data: { hops: hopsForCard },
          toolCallId: `path-analysis-latency-${Date.now()}`,
          scope: cardScope,
        });
      }

      setPathAnalysisState('done');
      setProcessedProvider(pathData.providerName);
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
          console.error('[usePathAnalysisIngestion] Stream error:', err);
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
    pathAnalysisState,
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

  const retry = useCallback(() => {
    if (pathAnalysisState === 'error' && storedPayload) {
      setError(null);
      isSendingRef.current = false;
      setPathAnalysisState('waiting_for_session');
    }
  }, [pathAnalysisState, storedPayload]);

  const cancel = useCallback(() => {
    setPathAnalysisState('idle');
    setStoredPayload(null);
    setError(null);
    isSendingRef.current = false;
    targetSessionIdRef.current = null;
  }, []);

  return {
    pathAnalysisState,
    error,
    retry,
    cancel,
  };
}
