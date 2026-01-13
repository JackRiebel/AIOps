'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface PresenceUser {
  user_id: string;
  username?: string;
  avatar_url?: string;
  color?: string;
  joined_at?: string;
  cursor?: { x: number; y: number };
}

interface UseCanvasPresenceOptions {
  /** Canvas/session ID to track presence for */
  canvasId: string | null;
  /** Current user info */
  user: {
    id: string;
    username?: string;
    avatar_url?: string;
  } | null;
  /** WebSocket URL (defaults to /api/ws) */
  wsUrl?: string;
  /** Whether presence is enabled */
  enabled?: boolean;
}

interface UseCanvasPresenceReturn {
  /** List of users currently in the room */
  members: PresenceUser[];
  /** Whether connected to presence service */
  isConnected: boolean;
  /** Update cursor position (throttled internally) */
  updateCursor: (x: number, y: number) => void;
  /** Manually join a room */
  join: () => void;
  /** Manually leave a room */
  leave: () => void;
}

// Generate a random color for the user
function generateUserColor(): string {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#d946ef', // fuchsia
    '#ec4899', // pink
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// =============================================================================
// Hook
// =============================================================================

export function useCanvasPresence({
  canvasId,
  user,
  wsUrl,
  enabled = true,
}: UseCanvasPresenceOptions): UseCanvasPresenceReturn {
  const [members, setMembers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const userColorRef = useRef<string>(generateUserColor());
  const currentRoomRef = useRef<string | null>(null);
  const enabledRef = useRef(enabled);

  // Keep enabledRef in sync
  enabledRef.current = enabled;

  const roomId = canvasId ? `canvas:${canvasId}` : null;

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!enabledRef.current || !roomId || !user) return;

    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = wsUrl || `${protocol}//${host}/api/ws`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Presence] WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error('[Presence] Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        console.log('[Presence] WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
        clientIdRef.current = null;

        // Attempt to reconnect after 3 seconds (use ref to get latest enabled value)
        if (enabledRef.current && roomId) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (enabledRef.current) {
              connect();
            }
          }, 3000);
        }
      };

      ws.onerror = () => {
        // WebSocket errors are expected when the presence server is unavailable
        // The onclose handler will handle reconnection
      };
    } catch (e) {
      // Connection failed - will retry on next attempt
      console.debug('[Presence] Connection unavailable');
    }
  }, [roomId, user, wsUrl]);

  // Handle incoming messages
  const handleMessage = useCallback((message: Record<string, unknown>) => {
    const type = message.type as string;

    switch (type) {
      case 'connected':
        clientIdRef.current = message.client_id as string;
        // Join the room after connection
        if (roomId && user) {
          joinRoom();
        }
        break;

      case 'presence_state':
        // Full state update - replace members list
        setMembers(message.members as PresenceUser[]);
        currentRoomRef.current = message.room_id as string;
        break;

      case 'presence_join':
        // A user joined - add to members
        setMembers((prev) => {
          const newUser = message.user as PresenceUser;
          // Don't add duplicates
          if (prev.some((m) => m.user_id === newUser.user_id)) {
            return prev;
          }
          return [...prev, newUser];
        });
        break;

      case 'presence_leave':
        // A user left - remove from members
        setMembers((prev) =>
          prev.filter((m) => m.user_id !== message.user_id)
        );
        break;

      case 'presence_cursor':
        // Update cursor position for a user
        setMembers((prev) =>
          prev.map((m) =>
            m.user_id === message.user_id
              ? { ...m, cursor: message.cursor as { x: number; y: number } }
              : m
          )
        );
        break;

      case 'pong':
        // Heartbeat response - ignore
        break;

      default:
        // Ignore other message types
        break;
    }
  }, [roomId, user]);

  // Join the room
  const joinRoom = useCallback(() => {
    if (!wsRef.current || !roomId || !user) return;

    wsRef.current.send(JSON.stringify({
      type: 'presence_join',
      room_id: roomId,
      user: {
        user_id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        color: userColorRef.current,
      },
    }));
  }, [roomId, user]);

  // Leave the room
  const leaveRoom = useCallback(() => {
    if (!wsRef.current || !currentRoomRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'presence_leave',
      room_id: currentRoomRef.current,
    }));

    currentRoomRef.current = null;
    setMembers([]);
  }, []);

  // Update cursor position (throttled)
  const updateCursor = useCallback((x: number, y: number) => {
    if (!wsRef.current || !currentRoomRef.current) return;

    // Throttle cursor updates to 50ms
    if (cursorThrottleRef.current) return;

    cursorThrottleRef.current = setTimeout(() => {
      if (wsRef.current && currentRoomRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'presence_cursor',
          room_id: currentRoomRef.current,
          cursor: { x, y },
        }));
      }
      cursorThrottleRef.current = null;
    }, 50);
  }, []);

  // Connect when enabled and have room
  useEffect(() => {
    if (enabled && roomId && user) {
      connect();
    }

    return () => {
      // Clean up on unmount or when dependencies change
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (cursorThrottleRef.current) {
        clearTimeout(cursorThrottleRef.current);
      }
      if (wsRef.current) {
        leaveRoom();
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, roomId, user, connect, leaveRoom]);

  // Rejoin when room changes
  useEffect(() => {
    if (isConnected && roomId && user && roomId !== currentRoomRef.current) {
      // Leave old room if any
      if (currentRoomRef.current) {
        leaveRoom();
      }
      // Join new room
      joinRoom();
    }
  }, [isConnected, roomId, user, joinRoom, leaveRoom]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected]);

  return {
    members,
    isConnected,
    updateCursor,
    join: joinRoom,
    leave: leaveRoom,
  };
}

export default useCanvasPresence;
