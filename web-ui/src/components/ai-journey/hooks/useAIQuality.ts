'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AIQualityResult,
  AIQualitySummary,
  RegionalMetric,
  AssertionResult,
} from '@/types/ai-quality';

// ============================================================================
// Types
// ============================================================================

interface AssertionHistoryPoint {
  timestamp: string;
  pass_rate: number;
}

export interface UseAIQualityReturn {
  results: AIQualityResult[];
  summary: AIQualitySummary | null;
  regional: RegionalMetric[];
  assertions: AssertionResult[];
  assertionHistory: AssertionHistoryPoint[];
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: UseAIQualityReturn = {
  results: [],
  summary: null,
  regional: [],
  assertions: [],
  assertionHistory: [],
  loading: false,
  error: null,
};

const REFRESH_INTERVAL = 60_000;

// ============================================================================
// Hook
// ============================================================================

export function useAIQuality(provider: string | null): UseAIQualityReturn {
  const [results, setResults] = useState<AIQualityResult[]>([]);
  const [summary, setSummary] = useState<AIQualitySummary | null>(null);
  const [regional, setRegional] = useState<RegionalMetric[]>([]);
  const [assertions, setAssertions] = useState<AssertionResult[]>([]);
  const [assertionHistory, setAssertionHistory] = useState<AssertionHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (providerName: string, signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const [qualityRes, assertionRes] = await Promise.all([
        fetch(`/api/thousandeyes/ai-assurance/tests/${encodeURIComponent(providerName)}/ai-quality`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal,
        }),
        fetch(`/api/thousandeyes/ai-assurance/tests/${encodeURIComponent(providerName)}/assertions`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal,
        }),
      ]);

      if (!qualityRes.ok) {
        throw new Error(`Quality API returned ${qualityRes.status}`);
      }

      const qualityData = await qualityRes.json();
      setResults(qualityData.results ?? []);
      setSummary(qualityData.summary ?? null);
      setRegional(qualityData.regional ?? []);

      if (assertionRes.ok) {
        const assertionData = await assertionRes.json();
        setAssertions(assertionData.assertions ?? []);
        setAssertionHistory(assertionData.history ?? []);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to fetch AI quality data';
      setError(message);
      console.error('useAIQuality fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!provider) {
      setResults([]);
      setSummary(null);
      setRegional([]);
      setAssertions([]);
      setAssertionHistory([]);
      setError(null);
      return;
    }

    // Abort any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Initial fetch
    fetchData(provider, controller.signal);

    // Auto-refresh interval
    const interval = setInterval(() => {
      if (!controller.signal.aborted) {
        fetchData(provider, controller.signal);
      }
    }, REFRESH_INTERVAL);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [provider, fetchData]);

  if (!provider) return EMPTY_STATE;

  return { results, summary, regional, assertions, assertionHistory, loading, error };
}
