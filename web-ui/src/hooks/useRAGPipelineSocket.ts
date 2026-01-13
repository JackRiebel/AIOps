/**
 * React hook for real-time Agentic RAG pipeline updates via WebSocket.
 *
 * Connects to the /ws/rag-pipeline endpoint and provides live updates
 * as the pipeline processes through its various agents.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PipelineEvent {
  type: string;
  session_id: string;
  timestamp: string;
  [key: string]: any;
}

export interface PipelineState {
  isConnected: boolean;
  currentAgent: string | null;
  completedAgents: string[];
  iteration: number;
  quality: string | null;
  totalDurationMs: number | null;
  events: PipelineEvent[];
  error: string | null;
}

interface UseRAGPipelineSocketOptions {
  sessionId?: string;
  autoConnect?: boolean;
  onEvent?: (event: PipelineEvent) => void;
  onComplete?: (state: PipelineState) => void;
  onError?: (error: string) => void;
}

const AGENT_ORDER = [
  'QueryAnalysisAgent',
  'RetrievalRouterAgent',
  'DocumentGraderAgent',
  'CorrectiveRAGAgent',
  'SynthesisAgent',
  'ReflectionAgent',
];

export function useRAGPipelineSocket(options: UseRAGPipelineSocketOptions = {}) {
  const {
    sessionId,
    autoConnect = false,
    onEvent,
    onComplete,
    onError,
  } = options;

  const [state, setState] = useState<PipelineState>({
    isConnected: false,
    currentAgent: null,
    completedAgents: [],
    iteration: 0,
    quality: null,
    totalDurationMs: null,
    events: [],
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Build WebSocket URL from environment or use default backend port
    const envApiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!envApiUrl && process.env.NODE_ENV === 'production') {
      console.warn('[RAGPipeline] NEXT_PUBLIC_API_URL not set - using localhost fallback. Set this in production!');
    }
    const apiUrl = envApiUrl || 'https://localhost:8002';
    const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
    const host = apiUrl.replace(/^https?:\/\//, '');
    const wsUrl = sessionId
      ? `${wsProtocol}//${host}/ws/rag-pipeline?session_id=${sessionId}`
      : `${wsProtocol}//${host}/ws/rag-pipeline`;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setState(prev => ({ ...prev, isConnected: true, error: null }));
    };

    ws.onmessage = (event) => {
      try {
        const data: PipelineEvent = JSON.parse(event.data);

        setState(prev => {
          const newState = { ...prev, events: [...prev.events, data] };

          switch (data.type) {
            case 'agent_start':
              newState.currentAgent = data.agent;
              break;

            case 'agent_complete':
              newState.currentAgent = null;
              if (data.agent && !prev.completedAgents.includes(data.agent)) {
                newState.completedAgents = [...prev.completedAgents, data.agent];
              }
              break;

            case 'iteration_start':
              newState.iteration = data.iteration;
              break;

            case 'reflection_complete':
              newState.quality = data.quality;
              break;

            case 'pipeline_complete':
              newState.totalDurationMs = data.total_duration_ms;
              newState.quality = data.quality;
              newState.currentAgent = null;
              if (onComplete) {
                onComplete(newState);
              }
              break;

            case 'pipeline_error':
              newState.error = data.error;
              if (onError) {
                onError(data.error);
              }
              break;

            case 'pong':
              // Keepalive response, no state update needed
              break;
          }

          return newState;
        });

        if (onEvent) {
          onEvent(data);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setState(prev => ({ ...prev, error: 'WebSocket connection error' }));
      if (onError) {
        onError('WebSocket connection error');
      }
    };

    ws.onclose = () => {
      setState(prev => ({ ...prev, isConnected: false }));
      wsRef.current = null;
    };

    wsRef.current = ws;
  }, [sessionId, onEvent, onComplete, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isConnected: state.isConnected,
      currentAgent: null,
      completedAgents: [],
      iteration: 0,
      quality: null,
      totalDurationMs: null,
      events: [],
      error: null,
    });
  }, [state.isConnected]);

  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // Get agent progress as percentage
  const getProgress = useCallback(() => {
    const completed = state.completedAgents.length;
    const total = AGENT_ORDER.length;
    return Math.round((completed / total) * 100);
  }, [state.completedAgents]);

  // Get current stage name for display
  const getCurrentStageName = useCallback(() => {
    if (state.currentAgent) {
      return state.currentAgent.replace('Agent', '').replace(/([A-Z])/g, ' $1').trim();
    }
    return null;
  }, [state.currentAgent]);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Keepalive ping every 30 seconds
  useEffect(() => {
    if (!state.isConnected) return;

    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, [state.isConnected, sendPing]);

  return {
    ...state,
    connect,
    disconnect,
    reset,
    sendPing,
    getProgress,
    getCurrentStageName,
    agentOrder: AGENT_ORDER,
  };
}

export default useRAGPipelineSocket;
