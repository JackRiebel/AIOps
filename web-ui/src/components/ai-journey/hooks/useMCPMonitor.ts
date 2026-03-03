'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MCPServer,
  MCPTool,
  MCPHealthEvent,
  MCPSecurityPosture,
  MCPNetworkHealth,
} from '@/types/mcp-monitor';

// ============================================================================
// Types
// ============================================================================

interface RegisterServerConfig {
  name: string;
  endpoint_url: string;
  auth_type?: string;
  auth_token?: string;
  description?: string;
}

interface UseMCPMonitorReturn {
  servers: MCPServer[];
  selectedServer: MCPServer | null;
  setSelectedServer: (server: MCPServer | null) => void;
  tools: MCPTool[];
  events: MCPHealthEvent[];
  securityPosture: MCPSecurityPosture | null;
  networkHealth: MCPNetworkHealth | null;
  loading: boolean;
  detailsLoading: boolean;
  error: string | null;
  registerServer: (config: RegisterServerConfig) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  refreshServers: () => Promise<void>;
  startOAuth: (serverId: string) => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const REFRESH_INTERVAL_MS = 60_000;

// ============================================================================
// Hook
// ============================================================================

export function useMCPMonitor(): UseMCPMonitorReturn {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [events, setEvents] = useState<MCPHealthEvent[]>([]);
  const [securityPosture, setSecurityPosture] = useState<MCPSecurityPosture | null>(null);
  const [networkHealth, setNetworkHealth] = useState<MCPNetworkHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedOnce = useRef(false);

  // ------------------------------------------
  // Fetch servers list
  // ------------------------------------------
  const fetchServers = useCallback(async (signal?: AbortSignal): Promise<MCPServer[]> => {
    const res = await fetch('/api/mcp-monitor/servers', {
      credentials: 'include',
      signal,
    });
    if (!res.ok) throw new Error('Failed to fetch MCP servers');
    const data = await res.json();
    return (data.servers ?? []) as MCPServer[];
  }, []);

  // ------------------------------------------
  // Fetch tools for a server
  // ------------------------------------------
  const fetchTools = useCallback(async (serverId: string, signal?: AbortSignal) => {
    const res = await fetch(`/api/mcp-monitor/servers/${serverId}/tools`, {
      credentials: 'include',
      signal,
    });
    if (!res.ok) throw new Error('Failed to fetch MCP tools');
    const data = await res.json();
    return (data.tools ?? []) as MCPTool[];
  }, []);

  // ------------------------------------------
  // Fetch events for a server
  // ------------------------------------------
  const fetchEvents = useCallback(async (serverId: string, signal?: AbortSignal) => {
    const res = await fetch(`/api/mcp-monitor/servers/${serverId}/events`, {
      credentials: 'include',
      signal,
    });
    if (!res.ok) throw new Error('Failed to fetch MCP events');
    const data = await res.json();
    return (data.events ?? []) as MCPHealthEvent[];
  }, []);

  // ------------------------------------------
  // Fetch security posture
  // ------------------------------------------
  const fetchSecurityPosture = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch('/api/mcp-monitor/security-posture', {
      credentials: 'include',
      signal,
    });
    if (!res.ok) throw new Error('Failed to fetch security posture');
    return (await res.json()) as MCPSecurityPosture;
  }, []);

  // ------------------------------------------
  // Fetch network health for a server
  // ------------------------------------------
  const fetchNetworkHealth = useCallback(async (serverId: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/mcp-monitor/servers/${serverId}/network-health`, {
        credentials: 'include',
        signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as MCPNetworkHealth;
    } catch {
      return null;
    }
  }, []);

  // ------------------------------------------
  // Fetch server details (tools + events + network health)
  // ------------------------------------------
  const fetchServerDetails = useCallback(
    async (server: MCPServer, signal?: AbortSignal) => {
      const [toolsResult, eventsResult, healthResult] = await Promise.allSettled([
        fetchTools(server.id, signal),
        fetchEvents(server.id, signal),
        fetchNetworkHealth(server.id, signal),
      ]);
      if (toolsResult.status === 'fulfilled') setTools(toolsResult.value);
      if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);
      if (healthResult.status === 'fulfilled') setNetworkHealth(healthResult.value);
    },
    [fetchTools, fetchEvents, fetchNetworkHealth],
  );

  // ------------------------------------------
  // Full refresh
  // ------------------------------------------
  const selectedServerIdRef = useRef<string | null>(null);
  selectedServerIdRef.current = selectedServer?.id ?? null;

  const refreshServers = useCallback(async () => {
    // Abort any in-flight requests
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    // Only show loading skeleton on initial load — keep previous data visible during background refreshes
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const [serverList, posture] = await Promise.all([
        fetchServers(controller.signal),
        fetchSecurityPosture(controller.signal),
      ]);

      setServers(serverList);
      setSecurityPosture(posture);

      // Auto-select first server if none selected or selected no longer exists.
      // Use ref to read the CURRENT selectedServer without adding it as a dependency.
      const currentId = selectedServerIdRef.current;
      const stillExists = serverList.find((s) => s.id === currentId);
      if (!stillExists) {
        setSelectedServer(serverList[0] ?? null);
      }
      // NOTE: Do NOT call fetchServerDetails here — the selectedServer useEffect
      // is the single source of truth for per-server data (tools, events, health).
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [fetchServers, fetchSecurityPosture]);

  // ------------------------------------------
  // When selectedServer changes, fetch details
  // ------------------------------------------
  useEffect(() => {
    // Always clear previous server's data immediately to prevent stale data leaking
    setTools([]);
    setEvents([]);
    setNetworkHealth(null);

    if (!selectedServer) {
      setDetailsLoading(false);
      return;
    }

    setDetailsLoading(true);
    const controller = new AbortController();

    fetchServerDetails(selectedServer, controller.signal)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to fetch server details:', err);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDetailsLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedServer, fetchServerDetails]);

  // ------------------------------------------
  // Initial load + interval refresh
  // ------------------------------------------
  useEffect(() => {
    refreshServers();

    const interval = setInterval(() => {
      refreshServers();
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------
  // Register a new server
  // ------------------------------------------
  const startOAuth = useCallback(
    async (serverId: string) => {
      const res = await fetch(`/api/mcp-monitor/servers/${serverId}/oauth/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Failed to start OAuth flow');
      }
      const data = await res.json();
      if (data.authorization_url) {
        // Open Cloudflare (or other OAuth provider) authorization in a new window
        const authWindow = window.open(data.authorization_url, '_blank', 'width=600,height=700');
        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/mcp-monitor/servers/${serverId}/oauth/status`, {
              credentials: 'include',
            });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.status === 'authorized') {
                clearInterval(pollInterval);
                if (authWindow && !authWindow.closed) authWindow.close();
                await refreshServers();
              }
            }
          } catch {
            // ignore polling errors
          }
        }, 2000);
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
      }
    },
    [refreshServers],
  );

  const registerServer = useCallback(
    async (config: RegisterServerConfig) => {
      const res = await fetch('/api/mcp-monitor/servers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Failed to register MCP server');
      }
      const data = await res.json();
      // For OAuth servers, automatically start the OAuth flow
      if (config.auth_type === 'oauth' && data.server_id) {
        await startOAuth(data.server_id);
      }
      await refreshServers();
    },
    [refreshServers, startOAuth],
  );

  // ------------------------------------------
  // Remove a server
  // ------------------------------------------
  const removeServer = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/mcp-monitor/servers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove MCP server');
      await refreshServers();
    },
    [refreshServers],
  );

  return {
    servers,
    selectedServer,
    setSelectedServer,
    tools,
    events,
    securityPosture,
    networkHealth,
    loading,
    detailsLoading,
    error,
    registerServer,
    removeServer,
    refreshServers,
    startOAuth,
  };
}

export default useMCPMonitor;
