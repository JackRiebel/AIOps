'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type {
  SplunkServerInfo,
  SplunkUserInfo,
  SplunkIndex,
  SplunkIndexDetail,
  SplunkIndexMetadata,
  SplunkKnowledgeObject,
  SplunkInsight,
  SplunkLog,
  SplunkDashboardView,
  SplunkCorrelatedDevice,
  SplunkCrossPlatformInsight,
} from './types';
import { useSplunkEnvironment } from './hooks/useSplunkEnvironment';
import { useSplunkIndexes } from './hooks/useSplunkIndexes';
import { useSplunkInsights } from './hooks/useSplunkInsights';
import { useSplunkSearch } from './hooks/useSplunkSearch';
import { useSplunkSAIA } from './hooks/useSplunkSAIA';
import { useSplunkCorrelation } from './hooks/useSplunkCorrelation';

// ============================================================================
// Types
// ============================================================================

export interface SplunkCommandCenterState {
  // Raw data
  serverInfo: SplunkServerInfo | null;
  userInfo: SplunkUserInfo | null;
  indexes: SplunkIndex[];
  indexDetails: Record<string, SplunkIndexDetail>;
  indexMetadata: Record<string, SplunkIndexMetadata>;
  knowledgeObjects: SplunkKnowledgeObject[];
  insights: SplunkInsight[];
  searchResults: any[];
  rawLogs: SplunkLog[];

  // SAIA
  saiaAvailable: boolean;
  saiaTools: string[];
  generatedSpl: string | null;
  splExplanation: string | null;
  optimizedSpl: string | null;
  saiaAnswer: string | null;

  // Cross-platform
  correlatedDevices: SplunkCorrelatedDevice[];
  crossPlatformInsights: SplunkCrossPlatformInsight[];
  merakiDevices: any[];
  catalystDevices: any[];
  loadingCorrelation: boolean;

  // Loading
  loadingEnvironment: boolean;
  loadingSearch: boolean;
  loadingKnowledge: boolean;
  loadingInsights: boolean;
  loadingSaia: boolean;
  loading: boolean;

  // Derived
  indexCount: number;
  totalEventCount: number;
  sourceCount: number;
  hostCount: number;

  // UI
  isConfigured: boolean;
  error: string | null;
  lastSyncTime: Date | null;
  initialLoadComplete: boolean;
  currentView: SplunkDashboardView;
  setCurrentView: (view: SplunkDashboardView) => void;

  // Actions
  refresh: () => void;
  searchLogs: (query: string, timeRange: string, maxResults: number) => Promise<void>;
  generateInsights: (query?: string, timeRange?: string, maxLogs?: number) => Promise<void>;
  generateSpl: (prompt: string) => Promise<void>;
  optimizeSpl: (spl: string) => Promise<void>;
  explainSpl: (spl: string) => Promise<void>;
  askSplunk: (question: string) => Promise<void>;
  fetchIndexDetail: (name: string) => Promise<void>;
  fetchIndexMetadata: (name: string, metadataType: string) => Promise<void>;
  fetchKnowledgeObjects: (objectType: string) => Promise<void>;
  loadInsights: () => Promise<void>;
  clearSaiaResults: () => void;
  correlateSearchResults: () => Promise<void>;
  activityFeed: SplunkLog[];
  fetchRecentActivity: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export interface UseSplunkCommandCenterParams {
  logAIQuery?: (
    query: string,
    response: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    metadata?: { durationMs?: number; toolsUsed?: string[]; costUsd?: number },
  ) => void;
  isAISessionActive?: boolean;
}

export function useSplunkCommandCenter(params?: UseSplunkCommandCenterParams): SplunkCommandCenterState {
  const selectedOrg = 'default';

  // UI state owned by orchestrator
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [currentView, setCurrentView] = useState<SplunkDashboardView>('overview');
  const [activityFeed, setActivityFeed] = useState<SplunkLog[]>([]);

  // Sub-hooks
  const env = useSplunkEnvironment();

  const indexes = useSplunkIndexes({
    indexes: env.indexes,
    fetchApi: env.fetchApi,
  });

  const insightsHook = useSplunkInsights({
    initialLoadComplete,
    indexCount: env.indexes.length,
    fetchApi: env.fetchApi,
    setError: env.setError,
  });

  const search = useSplunkSearch({
    fetchApi: env.fetchApi,
    setError: env.setError,
  });

  const saia = useSplunkSAIA({
    fetchApi: env.fetchApi,
    setError: env.setError,
    logAIQuery: params?.logAIQuery,
    isAISessionActive: params?.isAISessionActive,
  });

  const correlation = useSplunkCorrelation({
    searchResults: search.searchResults,
    activityFeed,
    fetchApi: env.fetchApi,
  });

  // Composite loading
  const loading = env.loadingEnvironment || search.loadingSearch || insightsHook.loadingKnowledge || insightsHook.loadingInsights || saia.loadingSaia;

  // Fetch recent activity
  const fetchRecentActivity = useCallback(async () => {
    try {
      const data = await env.fetchApi<any>(`/api/splunk/search?organization=${selectedOrg}`, {
        method: 'POST',
        body: JSON.stringify({
          search: 'search index=* | head 20',
          earliest_time: '-1h',
          latest_time: 'now',
          max_results: 20,
        }),
      });
      if (!data) return;
      const results = data.results || [];
      if (Array.isArray(results)) {
        const parsed = results.map((r: any) => {
          if (typeof r === 'string') { try { return JSON.parse(r); } catch { return { _raw: r, _time: '' }; } }
          if (r.text) { try { return JSON.parse(r.text); } catch { return { _raw: r.text, _time: '' }; } }
          return r;
        });
        const flat = parsed.length === 1 && Array.isArray(parsed[0]) ? parsed[0] : parsed;
        setActivityFeed(flat);
      }
    } catch {
      // Non-critical — activity feed is best-effort
    }
  }, [env.fetchApi, selectedOrg]);

  // Refresh
  const refresh = useCallback(() => {
    env.setError(null);
    env.fetchEnvironment();
    insightsHook.loadInsights();
    env.checkSaiaStatus();
    correlation.fetchNetworkCache();
    fetchRecentActivity();
    insightsHook.fetchKnowledgeObjects('saved_searches');
  }, [env, insightsHook, correlation, fetchRecentActivity]);

  // Initial load
  useEffect(() => {
    if (env.initialFetchDone.current) return;
    env.initialFetchDone.current = true;

    Promise.allSettled([
      env.fetchEnvironment(),
      insightsHook.loadInsights(),
      env.checkSaiaStatus(),
      correlation.fetchNetworkCache(),
      fetchRecentActivity(),
      insightsHook.fetchKnowledgeObjects('saved_searches'),
    ]).then(() => {
      setInitialLoadComplete(true);
    });
  }, [env, insightsHook, correlation, fetchRecentActivity]);

  // Source/host counts — combine metadata API + activity feed + search results
  const { sourceCount, hostCount } = useMemo(() => {
    const metaSources = new Set<string>();
    const metaHosts = new Set<string>();
    for (const m of Object.values(indexes.indexMetadata)) {
      m.sources?.forEach(s => metaSources.add(s));
      m.hosts?.forEach(h => metaHosts.add(h));
    }

    const feedSources = new Set<string>();
    const feedHosts = new Set<string>();
    for (const log of activityFeed) {
      if (log.host) feedHosts.add(log.host);
      if (log.source) feedSources.add(log.source);
    }

    for (const log of search.searchResults) {
      if (log.host) feedHosts.add(log.host);
      if (log.source) feedSources.add(log.source);
    }

    const allSources = new Set([...metaSources, ...feedSources]);
    const allHosts = new Set([...metaHosts, ...feedHosts]);

    return {
      sourceCount: allSources.size,
      hostCount: allHosts.size,
    };
  }, [indexes.indexMetadata, activityFeed, search.searchResults]);

  return {
    serverInfo: env.serverInfo,
    userInfo: env.userInfo,
    indexes: env.indexes,
    indexDetails: indexes.indexDetails,
    indexMetadata: indexes.indexMetadata,
    knowledgeObjects: insightsHook.knowledgeObjects,
    insights: insightsHook.insights,
    searchResults: search.searchResults,
    rawLogs: search.rawLogs,
    saiaAvailable: env.saiaAvailable,
    saiaTools: env.saiaTools,
    generatedSpl: saia.generatedSpl,
    splExplanation: saia.splExplanation,
    optimizedSpl: saia.optimizedSpl,
    saiaAnswer: saia.saiaAnswer,
    correlatedDevices: correlation.correlatedDevices,
    crossPlatformInsights: [],
    merakiDevices: correlation.merakiDevices,
    catalystDevices: correlation.catalystDevices,
    loadingCorrelation: correlation.loadingCorrelation,
    loadingEnvironment: env.loadingEnvironment,
    loadingSearch: search.loadingSearch,
    loadingKnowledge: insightsHook.loadingKnowledge,
    loadingInsights: insightsHook.loadingInsights,
    loadingSaia: saia.loadingSaia,
    loading,
    indexCount: env.indexes.length,
    totalEventCount: env.totalEventCount,
    sourceCount,
    hostCount,
    isConfigured: env.isConfigured,
    error: env.error,
    lastSyncTime: env.lastSyncTime,
    initialLoadComplete,
    currentView,
    setCurrentView,
    refresh,
    searchLogs: search.searchLogs,
    generateInsights: insightsHook.generateInsights,
    generateSpl: saia.generateSpl,
    optimizeSpl: saia.optimizeSpl,
    explainSpl: saia.explainSpl,
    askSplunk: saia.askSplunk,
    fetchIndexDetail: indexes.fetchIndexDetail,
    fetchIndexMetadata: indexes.fetchIndexMetadata,
    fetchKnowledgeObjects: insightsHook.fetchKnowledgeObjects,
    loadInsights: insightsHook.loadInsights,
    clearSaiaResults: saia.clearSaiaResults,
    correlateSearchResults: correlation.correlateSearchResults,
    activityFeed,
    fetchRecentActivity,
  };
}
