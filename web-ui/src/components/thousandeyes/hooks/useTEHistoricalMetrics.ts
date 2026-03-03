'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  TEMetricPoint,
  TEMetricAggregate,
  TEBottleneck,
  TETrend,
  TEMetricsStatus,
} from '@/types/te-metrics';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — matches collection cadence

export interface UseTEHistoricalMetricsReturn {
  status: TEMetricsStatus | null;
  bottlenecks: TEBottleneck[];
  trends: TETrend[];
  loading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  fetchBottlenecks: (hours?: number) => Promise<void>;
  fetchTrends: () => Promise<void>;
  fetchHistory: (testId: number, hours?: number) => Promise<TEMetricPoint[]>;
  fetchAggregates: (testId: number, hours?: number, bucket?: string) => Promise<TEMetricAggregate[]>;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/te-metrics${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`TE metrics API error: ${res.status}`);
  return res.json();
}

export function useTEHistoricalMetrics(): UseTEHistoricalMetricsReturn {
  const [status, setStatus] = useState<TEMetricsStatus | null>(null);
  const [bottlenecks, setBottlenecks] = useState<TEBottleneck[]>([]);
  const [trends, setTrends] = useState<TETrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch<TEMetricsStatus>('/status');
      setStatus(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const fetchBottlenecks = useCallback(async (hours = 24) => {
    try {
      const data = await apiFetch<TEBottleneck[]>(`/bottlenecks?hours=${hours}`);
      setBottlenecks(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const fetchTrends = useCallback(async () => {
    try {
      const data = await apiFetch<TETrend[]>('/trends');
      setTrends(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const fetchHistory = useCallback(async (testId: number, hours = 24): Promise<TEMetricPoint[]> => {
    const data = await apiFetch<TEMetricPoint[]>(`/history/${testId}?hours=${hours}`);
    return data;
  }, []);

  const fetchAggregates = useCallback(async (testId: number, hours = 24, bucket = '1h'): Promise<TEMetricAggregate[]> => {
    const data = await apiFetch<TEMetricAggregate[]>(`/aggregates/${testId}?hours=${hours}&bucket=${bucket}`);
    return data;
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchStatus(), fetchBottlenecks(), fetchTrends()]);
      } finally {
        setLoading(false);
      }
    };

    loadAll();

    intervalRef.current = setInterval(loadAll, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus, fetchBottlenecks, fetchTrends]);

  return {
    status,
    bottlenecks,
    trends,
    loading,
    error,
    fetchStatus,
    fetchBottlenecks,
    fetchTrends,
    fetchHistory,
    fetchAggregates,
  };
}
