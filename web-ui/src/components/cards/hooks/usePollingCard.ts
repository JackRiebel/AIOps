'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UsePollingCardOptions<T> {
  /** API endpoint to poll */
  endpoint: string;
  /** Polling interval in milliseconds */
  interval: number;
  /** Whether polling is enabled */
  enabled?: boolean;
  /** Initial data (optional) */
  initialData?: T;
  /** Transform function for fetched data */
  transform?: (data: unknown) => T;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Success callback */
  onSuccess?: (data: T) => void;
}

export interface UsePollingCardResult<T> {
  /** Current data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Last successful update timestamp */
  lastUpdated: Date | null;
  /** Manually trigger a refresh */
  refresh: () => void;
  /** Pause polling */
  pause: () => void;
  /** Resume polling */
  resume: () => void;
  /** Whether polling is currently paused */
  isPaused: boolean;
}

/**
 * Hook for polling card data at regular intervals.
 *
 * Features:
 * - Automatic polling with configurable interval
 * - Pause/resume functionality
 * - Manual refresh
 * - Error handling with retry
 * - Stale data detection
 *
 * @example
 * ```tsx
 * const { data, loading, error, refresh } = usePollingCard({
 *   endpoint: '/api/cards/network-health/L_123456/data',
 *   interval: 30000,
 * });
 * ```
 */
export function usePollingCard<T>({
  endpoint,
  interval,
  enabled = true,
  initialData,
  transform,
  onError,
  onSuccess,
}: UsePollingCardOptions<T>): UsePollingCardResult<T> {
  const [data, setData] = useState<T | null>(initialData ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    // Don't fetch if paused or disabled
    if (isPaused || !enabled) return;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(endpoint, {
        signal: abortControllerRef.current.signal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      // Only update state if still mounted
      if (!mountedRef.current) return;

      // Extract data from response
      const cardData = json.data ?? json;
      const transformedData = transform ? transform(cardData) : (cardData as T);

      setData(transformedData);
      setError(null);
      setLastUpdated(new Date());
      setLoading(false);

      if (onSuccess) {
        onSuccess(transformedData);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;

      if (!mountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);

      if (onError) {
        onError(error);
      }
    }
  }, [endpoint, enabled, isPaused, transform, onError, onSuccess]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || isPaused || interval <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(fetchData, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isPaused, interval, fetchData]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    pause,
    resume,
    isPaused,
  };
}

/**
 * Hook for multiple card data sources with shared polling.
 */
export interface UseMultiPollingOptions {
  endpoints: string[];
  interval: number;
  enabled?: boolean;
}

export function useMultiPolling<T>({
  endpoints,
  interval,
  enabled = true,
}: UseMultiPollingOptions) {
  const [data, setData] = useState<Record<string, T>>({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, Error>>({});

  const fetchAll = useCallback(async () => {
    if (!enabled) return;

    const results = await Promise.allSettled(
      endpoints.map(async (endpoint) => {
        const response = await fetch(endpoint, { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { endpoint, data: await response.json() };
      })
    );

    const newData: Record<string, T> = {};
    const newErrors: Record<string, Error> = {};

    results.forEach((result, index) => {
      const endpoint = endpoints[index];
      if (result.status === 'fulfilled') {
        newData[endpoint] = result.value.data;
      } else {
        newErrors[endpoint] = result.reason;
      }
    });

    setData(newData);
    setErrors(newErrors);
    setLoading(false);
  }, [endpoints, enabled]);

  useEffect(() => {
    fetchAll();
    const intervalId = setInterval(fetchAll, interval);
    return () => clearInterval(intervalId);
  }, [fetchAll, interval]);

  return { data, loading, errors, refresh: fetchAll };
}

export default usePollingCard;
