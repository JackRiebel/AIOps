'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import type {
  SplunkServerInfo,
  SplunkUserInfo,
  SplunkIndex,
} from '../types';

export interface UseSplunkEnvironmentReturn {
  serverInfo: SplunkServerInfo | null;
  userInfo: SplunkUserInfo | null;
  indexes: SplunkIndex[];
  isConfigured: boolean;
  error: string | null;
  loadingEnvironment: boolean;
  lastSyncTime: Date | null;
  saiaAvailable: boolean;
  saiaTools: string[];
  totalEventCount: number;
  initialFetchDone: React.MutableRefObject<boolean>;
  fetchEnvironment: () => Promise<void>;
  checkSaiaStatus: () => Promise<void>;
  setError: (err: string | null) => void;
  setIsConfigured: (v: boolean) => void;
  fetchApi: <T>(url: string, options?: RequestInit) => Promise<T | null>;
}

export function useSplunkEnvironment(): UseSplunkEnvironmentReturn {
  const selectedOrg = 'default';

  const [serverInfo, setServerInfo] = useState<SplunkServerInfo | null>(null);
  const [userInfo, setUserInfo] = useState<SplunkUserInfo | null>(null);
  const [indexes, setIndexes] = useState<SplunkIndex[]>([]);
  const [isConfigured, setIsConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingEnvironment, setLoadingEnvironment] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [saiaAvailable, setSaiaAvailable] = useState(false);
  const [saiaTools, setSaiaTools] = useState<string[]>([]);
  const initialFetchDone = useRef(false);

  const fetchApi = useCallback(async <T>(
    url: string,
    options: RequestInit = {},
  ): Promise<T | null> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        ...options,
      });
      if (response.status === 503) {
        setIsConfigured(false);
        return null;
      }
      if (response.status === 501) {
        return null;
      }
      if (response.status === 502) {
        setIsConfigured(true);
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Splunk MCP server unreachable. Check that npx and mcp-remote are installed.');
      }
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${response.status}`);
      }
      setIsConfigured(true);
      return await response.json();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  const fetchEnvironment = useCallback(async () => {
    try {
      setLoadingEnvironment(true);
      setError(null);
      const data = await fetchApi<any>(`/api/splunk/environment?organization=${selectedOrg}`);
      if (!data) return;

      const si = data.server_info;
      setServerInfo(Array.isArray(si) ? si[0] || null : si || null);
      const ui = data.user_info;
      setUserInfo(Array.isArray(ui) ? ui[0] || null : ui || null);

      const rawIndexes = data.indexes;
      let parsedIndexes: SplunkIndex[] = [];
      if (Array.isArray(rawIndexes)) {
        parsedIndexes = rawIndexes.map((idx: Record<string, any>) => ({
          ...idx,
          name: idx.name || idx.title || 'unknown',
        }));
      } else if (rawIndexes && typeof rawIndexes === 'object') {
        parsedIndexes = Object.entries(rawIndexes).map(([name, val]) => ({
          name,
          ...(typeof val === 'object' && val !== null ? val as Record<string, any> : {}),
        }));
      }
      setIndexes(parsedIndexes);
      setLastSyncTime(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load environment';
      setError(msg);
    } finally {
      setLoadingEnvironment(false);
    }
  }, [fetchApi, selectedOrg]);

  const checkSaiaStatus = useCallback(async () => {
    try {
      const data = await fetchApi<any>(`/api/splunk/saia/status?organization=${selectedOrg}`);
      if (!data) return;
      setSaiaAvailable(data.available || false);
      setSaiaTools(data.tools || []);
    } catch {
      setSaiaAvailable(false);
    }
  }, [fetchApi, selectedOrg]);

  const totalEventCount = useMemo(() => {
    return indexes.reduce((sum, idx) => {
      const count = typeof idx.totalEventCount === 'string'
        ? parseInt(idx.totalEventCount, 10) || 0
        : (idx.totalEventCount || 0);
      return sum + count;
    }, 0);
  }, [indexes]);

  return {
    serverInfo,
    userInfo,
    indexes,
    isConfigured,
    error,
    loadingEnvironment,
    lastSyncTime,
    saiaAvailable,
    saiaTools,
    totalEventCount,
    initialFetchDone,
    fetchEnvironment,
    checkSaiaStatus,
    setError,
    setIsConfigured,
    fetchApi,
  };
}
