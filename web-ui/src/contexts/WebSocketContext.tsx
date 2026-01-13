'use client';

import React, { createContext, useContext, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useWebSocket, TopicUpdate, WebSocketMessage } from '@/hooks/useWebSocket';

// ============================================================================
// Types
// ============================================================================

export type TopicListener = (update: TopicUpdate) => void;

export interface WebSocketContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  clientId: string | null;
  error: string | null;

  // Subscriptions
  subscriptions: Set<string>;
  subscribe: (topic: string) => boolean;
  unsubscribe: (topic: string) => boolean;

  // Topic listeners (for per-component cleanup)
  addTopicListener: (topic: string, listener: TopicListener) => void;
  removeTopicListener: (topic: string, listener: TopicListener) => void;

  // Last updates
  lastMessage: WebSocketMessage | null;
  lastTopicUpdate: TopicUpdate | null;

  // Connection control
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface WebSocketProviderProps {
  children: React.ReactNode;
  /** WebSocket URL - defaults to backend ws/cards endpoint */
  url?: string;
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
}

export function WebSocketProvider({
  children,
  url,
  autoConnect = true,
}: WebSocketProviderProps) {
  // Build WebSocket URL from environment or prop
  const wsUrl = useMemo(() => {
    if (url) return url;

    // Default to backend WebSocket endpoint using environment variable
    if (typeof window !== 'undefined') {
      const envApiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!envApiUrl && process.env.NODE_ENV === 'production') {
        console.warn('[WebSocket] NEXT_PUBLIC_API_URL not set - using localhost fallback. Set this in production!');
      }
      const apiUrl = envApiUrl || 'https://localhost:8002';
      // Convert http(s) to ws(s)
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const baseUrl = apiUrl.replace(/^https?/, wsProtocol);
      return `${baseUrl}/ws/cards`;
    }
    return '';
  }, [url]);

  // Track topic update listeners with ref to avoid memory leaks
  const topicListenersRef = useRef(new Map<string, Set<(update: TopicUpdate) => void>>());

  // Cleanup topic listeners on unmount to prevent memory leaks
  useEffect(() => {
    const listeners = topicListenersRef.current;
    return () => {
      // Clear all listeners on unmount
      listeners.forEach((set) => set.clear());
      listeners.clear();
    };
  }, []);

  // Add a topic listener (for per-component subscriptions)
  const addTopicListener = useCallback((topic: string, listener: TopicListener) => {
    const topicListeners = topicListenersRef.current;
    if (!topicListeners.has(topic)) {
      topicListeners.set(topic, new Set());
    }
    topicListeners.get(topic)!.add(listener);
  }, []);

  // Remove a topic listener (for cleanup on component unmount)
  const removeTopicListener = useCallback((topic: string, listener: TopicListener) => {
    const topicListeners = topicListenersRef.current;
    const listeners = topicListeners.get(topic);
    if (listeners) {
      listeners.delete(listener);
      // Clean up empty sets
      if (listeners.size === 0) {
        topicListeners.delete(topic);
      }
    }
  }, []);

  // Topic update handler
  const handleTopicUpdate = useCallback((update: TopicUpdate) => {
    const topicListeners = topicListenersRef.current;

    // Notify all listeners for this topic
    const listeners = topicListeners.get(update.topic);
    if (listeners) {
      listeners.forEach(listener => listener(update));
    }

    // Also notify wildcard listeners
    const wildcardListeners = topicListeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => listener(update));
    }
  }, []);

  // Use the WebSocket hook
  const ws = useWebSocket({
    url: autoConnect ? wsUrl : '',
    onTopicUpdate: handleTopicUpdate,
    onConnect: (clientId) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[WebSocket] Connected with client ID:', clientId);
      }
    },
    onDisconnect: () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[WebSocket] Disconnected');
      }
    },
    onError: () => {
      // WebSocket errors are often empty - provide helpful context
      if (process.env.NODE_ENV === 'development') {
        console.warn('[WebSocket] Connection failed - backend may be unavailable or SSL cert untrusted');
      }
    },
  });

  // Context value - memoize with specific dependencies to avoid unnecessary re-renders
  const value = useMemo<WebSocketContextValue>(() => ({
    isConnected: ws.isConnected,
    isConnecting: ws.isConnecting,
    clientId: ws.clientId,
    error: ws.error,
    subscriptions: ws.subscriptions,
    subscribe: ws.subscribe,
    unsubscribe: ws.unsubscribe,
    addTopicListener,
    removeTopicListener,
    lastMessage: ws.lastMessage,
    lastTopicUpdate: ws.lastTopicUpdate,
    connect: ws.connect,
    disconnect: ws.disconnect,
  }), [
    ws.isConnected,
    ws.isConnecting,
    ws.clientId,
    ws.error,
    ws.subscriptions,
    ws.subscribe,
    ws.unsubscribe,
    ws.lastMessage,
    ws.lastTopicUpdate,
    ws.connect,
    ws.disconnect,
    addTopicListener,
    removeTopicListener,
  ]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the WebSocket context
 */
export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);

  if (!context) {
    // Return a no-op context if not within provider (for SSR safety)
    return {
      isConnected: false,
      isConnecting: false,
      clientId: null,
      error: null,
      subscriptions: new Set(),
      subscribe: () => false,
      unsubscribe: () => false,
      addTopicListener: () => {},
      removeTopicListener: () => {},
      lastMessage: null,
      lastTopicUpdate: null,
      connect: () => {},
      disconnect: () => {},
    };
  }

  return context;
}

/**
 * Hook to subscribe to a specific topic with proper cleanup
 *
 * This hook handles both WebSocket subscription and topic listener registration,
 * ensuring proper cleanup when the component unmounts to prevent memory leaks.
 */
export function useTopicSubscription(topic: string | undefined) {
  const {
    subscribe,
    unsubscribe,
    addTopicListener,
    removeTopicListener,
    isConnected
  } = useWebSocketContext();
  const [latestUpdate, setLatestUpdate] = useState<TopicUpdate | null>(null);

  // Subscribe to WebSocket topic and register listener
  useEffect(() => {
    if (!topic || !isConnected) return;

    // Subscribe to the WebSocket topic
    subscribe(topic);

    // Create a stable listener callback
    const listener: TopicListener = (update) => {
      setLatestUpdate(update);
    };

    // Register the listener for this topic
    addTopicListener(topic, listener);

    // Cleanup: remove listener and unsubscribe
    return () => {
      removeTopicListener(topic, listener);
      unsubscribe(topic);
    };
  }, [topic, isConnected, subscribe, unsubscribe, addTopicListener, removeTopicListener]);

  return latestUpdate;
}
