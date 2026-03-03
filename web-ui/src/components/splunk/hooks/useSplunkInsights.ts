'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SplunkKnowledgeObject,
  SplunkInsight,
} from '../types';

export interface UseSplunkInsightsParams {
  initialLoadComplete: boolean;
  indexCount: number;
  fetchApi: <T>(url: string, options?: RequestInit) => Promise<T | null>;
  setError: (err: string | null) => void;
}

export interface UseSplunkInsightsReturn {
  insights: SplunkInsight[];
  knowledgeObjects: SplunkKnowledgeObject[];
  loadingInsights: boolean;
  loadingKnowledge: boolean;
  loadInsights: () => Promise<void>;
  generateInsights: (query?: string, timeRange?: string, maxLogs?: number) => Promise<void>;
  fetchKnowledgeObjects: (objectType: string) => Promise<void>;
}

export function useSplunkInsights({ initialLoadComplete, indexCount, fetchApi, setError }: UseSplunkInsightsParams): UseSplunkInsightsReturn {
  const selectedOrg = 'default';
  const [insights, setInsights] = useState<SplunkInsight[]>([]);
  const [knowledgeObjects, setKnowledgeObjects] = useState<SplunkKnowledgeObject[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const insightGenerationAttempted = useRef(false);

  const loadInsights = useCallback(async () => {
    try {
      setLoadingInsights(true);
      const data = await fetchApi<any>(`/api/splunk/insights?organization=${selectedOrg}`);
      if (!data) return;
      setInsights(data.insights || []);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoadingInsights(false);
    }
  }, [fetchApi, selectedOrg]);

  const generateInsights = useCallback(async (query?: string, timeRange?: string, maxLogs?: number) => {
    try {
      setLoadingInsights(true);
      setError(null);
      const data = await fetchApi<any>(`/api/splunk/insights/generate?organization=${selectedOrg}`, {
        method: 'POST',
        body: JSON.stringify({
          search_query: query,
          time_range: timeRange || '-24h',
          max_logs: maxLogs || 100,
        }),
      });
      if (!data) return;
      setInsights(data.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoadingInsights(false);
    }
  }, [fetchApi, selectedOrg, setError]);

  const fetchKnowledgeObjects = useCallback(async (objectType: string) => {
    try {
      setLoadingKnowledge(true);
      const data = await fetchApi<any>(
        `/api/splunk/knowledge-objects?object_type=${objectType}&organization=${selectedOrg}`
      );
      if (!data) return;

      let objects: SplunkKnowledgeObject[] = [];
      if (Array.isArray(data.objects)) {
        objects = data.objects;
      } else if (data.objects && typeof data.objects === 'object') {
        objects = Object.entries(data.objects).map(([name, val]) => ({
          name,
          type: objectType,
          ...(typeof val === 'object' && val !== null ? val as Record<string, any> : {}),
        }));
      }
      setKnowledgeObjects(objects);
    } catch (err) {
      console.error('Failed to fetch knowledge objects:', err);
    } finally {
      setLoadingKnowledge(false);
    }
  }, [fetchApi, selectedOrg]);

  // Auto-generate insights when DB returns empty but indexes exist
  useEffect(() => {
    if (
      !initialLoadComplete ||
      indexCount === 0 ||
      insights.length > 0 ||
      loadingInsights ||
      insightGenerationAttempted.current
    ) return;
    insightGenerationAttempted.current = true;
    generateInsights();
  }, [initialLoadComplete, indexCount, insights.length, loadingInsights, generateInsights]);

  return {
    insights,
    knowledgeObjects,
    loadingInsights,
    loadingKnowledge,
    loadInsights,
    generateInsights,
    fetchKnowledgeObjects,
  };
}
