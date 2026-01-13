'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export type WebSocketMessageType =
  | 'connected'
  | 'subscribed'
  | 'unsubscribed'
  | 'update'
  | 'heartbeat'
  | 'pong'
  | 'error'
  // Legacy types for backwards compatibility
  | 'device_status'
  | 'network_status'
  | 'alert'
  | 'health'
  | 'metric'
  | 'agent_activity'
  | 'ping';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload?: Record<string, unknown>;
  timestamp: string;
  // New fields for live card updates
  topic?: string;
  data?: Record<string, unknown>;
  client_id?: string;
  message?: string;  // For error messages
}

export interface TopicUpdate {
  topic: string;
  data: Record<string, unknown>;
  source: string;
  event_type: string;
  timestamp: string;
  org_id?: string;
  severity?: string;
}

export interface WebSocketOptions {
  url: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onTopicUpdate?: (update: TopicUpdate) => void;
  onConnect?: (clientId: string) => void;
  onDisconnect?: () => void;
  onError?: (error: Event | string) => void;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  clientId: string | null;
  lastMessage: WebSocketMessage | null;
  lastTopicUpdate: TopicUpdate | null;
  subscriptions: Set<string>;
  error: string | null;
  reconnectCount: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useWebSocket(options: WebSocketOptions) {
  const {
    url,
    reconnectAttempts = 5,
    reconnectDelay = 3000,
    heartbeatInterval = 30000,
    onMessage,
    onTopicUpdate,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    clientId: null,
    lastMessage: null,
    lastTopicUpdate: null,
    subscriptions: new Set(),
    error: null,
    reconnectCount: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const pendingSubscriptionsRef = useRef<Set<string>>(new Set());

  // Send a message through the WebSocket
  const send = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      }));
      return true;
    }
    return false;
  }, []);

  // Subscribe to a topic
  const subscribe = useCallback((topic: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', topic }));
      return true;
    } else {
      // Queue for when connected
      pendingSubscriptionsRef.current.add(topic);
      return false;
    }
  }, []);

  // Unsubscribe from a topic
  const unsubscribe = useCallback((topic: string) => {
    pendingSubscriptionsRef.current.delete(topic);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', topic }));
      setState((prev) => {
        const newSubs = new Set(prev.subscriptions);
        newSubs.delete(topic);
        return { ...prev, subscriptions: newSubs };
      });
      return true;
    }
    return false;
  }, []);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ping',
          payload: {},
          timestamp: new Date().toISOString(),
        }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Clear existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }

        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          reconnectCount: 0,
          error: null,
        }));

        startHeartbeat();

        // Re-subscribe to pending topics
        pendingSubscriptionsRef.current.forEach((topic) => {
          ws.send(JSON.stringify({ type: 'subscribe', topic }));
        });
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message = JSON.parse(event.data) as WebSocketMessage;

          // Handle different message types
          switch (message.type) {
            case 'connected':
              // Server acknowledged connection with client_id
              setState((prev) => ({
                ...prev,
                clientId: message.client_id || null,
                lastMessage: message,
              }));
              onConnect?.(message.client_id || '');
              break;

            case 'subscribed':
              // Server acknowledged subscription
              if (message.topic) {
                pendingSubscriptionsRef.current.delete(message.topic);
                setState((prev) => {
                  const newSubs = new Set(prev.subscriptions);
                  newSubs.add(message.topic!);
                  return { ...prev, subscriptions: newSubs, lastMessage: message };
                });
              }
              break;

            case 'unsubscribed':
              // Server acknowledged unsubscription
              if (message.topic) {
                setState((prev) => {
                  const newSubs = new Set(prev.subscriptions);
                  newSubs.delete(message.topic!);
                  return { ...prev, subscriptions: newSubs, lastMessage: message };
                });
              }
              break;

            case 'update':
              // Live data update for a topic
              if (message.topic && message.data) {
                const topicUpdate: TopicUpdate = {
                  topic: message.topic,
                  data: message.data,
                  source: (message.data.source as string) || 'unknown',
                  event_type: (message.data.event_type as string) || 'update',
                  timestamp: message.timestamp,
                  org_id: message.data.org_id as string | undefined,
                  severity: message.data.severity as string | undefined,
                };
                setState((prev) => ({
                  ...prev,
                  lastMessage: message,
                  lastTopicUpdate: topicUpdate,
                }));
                onTopicUpdate?.(topicUpdate);
              }
              break;

            case 'error':
              setState((prev) => ({
                ...prev,
                error: message.message || 'WebSocket error',
                lastMessage: message,
              }));
              onError?.(message.message || 'WebSocket error');
              break;

            case 'heartbeat':
            case 'pong':
              // Heartbeat received, connection is healthy
              setState((prev) => ({ ...prev, lastMessage: message }));
              break;

            default:
              // Handle legacy message types
              setState((prev) => ({
                ...prev,
                lastMessage: message,
              }));
              onMessage?.(message);
          }
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;

        stopHeartbeat();

        setState((prev) => {
          const shouldReconnect = prev.reconnectCount < reconnectAttempts;

          if (shouldReconnect) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                connect();
              }
            }, reconnectDelay);
          }

          return {
            ...prev,
            isConnected: false,
            isConnecting: false,
            reconnectCount: shouldReconnect ? prev.reconnectCount + 1 : prev.reconnectCount,
          };
        });

        onDisconnect?.();
      };

      ws.onerror = (error) => {
        if (!mountedRef.current) return;

        setState((prev) => ({
          ...prev,
          error: 'WebSocket connection error',
        }));

        onError?.(error);
      };

      wsRef.current = ws;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: 'Failed to create WebSocket connection',
      }));
    }
  }, [url, reconnectAttempts, reconnectDelay, startHeartbeat, stopHeartbeat, onConnect, onDisconnect, onMessage, onTopicUpdate, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      clientId: null,
      subscriptions: new Set(),
    }));
  }, [stopHeartbeat]);

  // Store connect/disconnect in refs to avoid dependency issues
  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  connectRef.current = connect;
  disconnectRef.current = disconnect;

  // Connect on mount, disconnect on unmount
  // Only re-runs when URL changes - connect/disconnect accessed via refs
  useEffect(() => {
    mountedRef.current = true;

    // Only connect if URL is provided and valid
    if (url && url.startsWith('ws')) {
      connectRef.current();
    }

    return () => {
      mountedRef.current = false;
      disconnectRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return {
    ...state,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

// ============================================================================
// Event-specific hooks
// ============================================================================

export function useDeviceStatusUpdates(wsUrl: string) {
  const [devices, setDevices] = useState<Map<string, Record<string, unknown>>>(new Map());

  const { isConnected, lastMessage, connect, disconnect } = useWebSocket({
    url: wsUrl,
    onMessage: (message) => {
      if (message.type === 'device_status') {
        const { serial, ...status } = message.payload as { serial: string; [key: string]: unknown };
        setDevices((prev) => new Map(prev).set(serial, status));
      }
    },
  });

  return {
    devices,
    isConnected,
    lastMessage,
    connect,
    disconnect,
    clearDevices: () => setDevices(new Map()),
  };
}

export function useAlertStream(wsUrl: string) {
  const [alerts, setAlerts] = useState<WebSocketMessage[]>([]);

  const { isConnected, connect, disconnect } = useWebSocket({
    url: wsUrl,
    onMessage: (message) => {
      if (message.type === 'alert') {
        setAlerts((prev) => [message, ...prev].slice(0, 100)); // Keep last 100 alerts
      }
    },
  });

  return {
    alerts,
    isConnected,
    connect,
    disconnect,
    clearAlerts: () => setAlerts([]),
  };
}
