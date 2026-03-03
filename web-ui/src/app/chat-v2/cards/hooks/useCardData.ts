/**
 * useCardData - Self-Refreshing Card Data Hook
 *
 * Fetches and maintains card data based on card type and scope.
 * Each card manages its own data lifecycle independently.
 *
 * Features:
 * - Automatic data fetching based on card type
 * - Auto-refresh with configurable intervals
 * - Exponential backoff retry logic for failed requests
 * - Respects Retry-After headers for 429 responses
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AllCardTypes, FreshnessStatus } from '../types';
import { getFetchConfig, type CardScope } from '../fetchers';
import {
  DEFAULT_RETRY_CONFIG,
  shouldRetry,
  getRetryDelay,
  type RetryConfig,
} from '../utils/retry';

// =============================================================================
// Types
// =============================================================================

export interface UseCardDataOptions {
  /** Card type determines the fetch endpoint and transformer */
  type: AllCardTypes;
  /** Scope params (orgId, networkId, etc.) for building the endpoint */
  scope: CardScope;
  /** Initial data to use before first fetch (from AI response) */
  initialData?: unknown;
  /** Override the default refresh interval (0 = no auto-refresh) */
  refreshInterval?: number;
  /** Whether to enable auto-refresh */
  autoRefresh?: boolean;
  /** Called when data is fetched successfully */
  onSuccess?: (data: unknown) => void;
  /** Called when fetch fails */
  onError?: (error: Error) => void;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (default: 500) */
  retryDelayMs?: number;
  /** Maximum retry delay in milliseconds (default: 10000) */
  maxRetryDelayMs?: number;
}

export interface UseCardDataResult {
  /** Current data (transformed) */
  data: unknown;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object if isError */
  error: Error | null;
  /** Data freshness status */
  status: FreshnessStatus;
  /** Timestamp of last successful fetch */
  lastUpdated: Date | null;
  /** Manually trigger a refresh */
  refetch: () => Promise<void>;
  /** Pause auto-refresh */
  pause: () => void;
  /** Resume auto-refresh */
  resume: () => void;
  /** Whether the card has required scope to fetch */
  canFetch: boolean;
  /** The endpoint URL (for debugging) */
  endpoint: string | null;
  /** Current retry count (0 if no retries) */
  retryCount: number;
  /** Whether the hook is currently retrying a failed request */
  isRetrying: boolean;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useCardData({
  type,
  scope,
  initialData,
  refreshInterval: customInterval,
  autoRefresh = true,
  onSuccess,
  onError,
  maxRetries = DEFAULT_RETRY_CONFIG.maxRetries,
  retryDelayMs = DEFAULT_RETRY_CONFIG.initialDelayMs,
  maxRetryDelayMs = DEFAULT_RETRY_CONFIG.maxDelayMs,
}: UseCardDataOptions): UseCardDataResult {
  // Get fetch config for this card type
  const config = getFetchConfig(type);

  // Build endpoint URL
  const endpoint = config?.buildEndpoint(scope) ?? null;

  // Check if we can fetch (have endpoint and required scope)
  const canFetch = endpoint !== null;

  // For cards without endpoints, get the empty state from transformer immediately
  const noEndpointData = !canFetch && config?.transformData
    ? config.transformData(null)
    : undefined;

  // Transform initial data if provided (so it matches the format of fetched data)
  const transformedInitialData = initialData && config?.transformData
    ? config.transformData(initialData)
    : initialData;

  // State - use transformed initial data, or noEndpointData as fallback
  const [data, setData] = useState<unknown>(transformedInitialData ?? noEndpointData);
  const [isLoading, setIsLoading] = useState(!initialData && canFetch);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // For no-endpoint cards, set lastUpdated so they show as 'live' not 'stale'
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    initialData ? new Date() : (!canFetch && noEndpointData ? new Date() : null)
  );
  const [isPaused, setIsPaused] = useState(false);

  // Retry state
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Refs for cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build retry config
  const retryConfig: RetryConfig = {
    maxRetries,
    initialDelayMs: retryDelayMs,
    maxDelayMs: maxRetryDelayMs,
    multiplier: DEFAULT_RETRY_CONFIG.multiplier,
    jitterFactor: DEFAULT_RETRY_CONFIG.jitterFactor,
  };

  // Determine refresh interval
  const refreshMs = customInterval ?? config?.refreshInterval ?? 60000;

  // Calculate freshness status
  const status: FreshnessStatus = (() => {
    if (isLoading && !data) return 'loading';
    if (isError) return 'error';
    // For cards without endpoints that have noEndpointData (empty state), show as 'live'
    if (!canFetch && noEndpointData) return 'live';
    // Static cards (refreshMs === 0) with data are always 'live' — they never auto-refresh
    if (refreshMs === 0 && data) return 'live';
    if (!lastUpdated) return 'stale';

    const elapsed = Date.now() - lastUpdated.getTime();
    if (elapsed < refreshMs * 0.5) return 'live';
    if (elapsed < refreshMs) return 'recent';
    return 'stale';
  })();

  // Fetch function with retry logic
  const fetchData = useCallback(async (showLoading = true) => {
    if (!endpoint) return;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    // Reset retry state for new fetch
    setRetryCount(0);
    setIsRetrying(false);

    try {
      if (showLoading && !data) {
        setIsLoading(true);
      }

      let lastResponse: Response | null = null;
      let attempt = 0;
      let totalRetries = 0;

      // Retry loop
      while (attempt <= retryConfig.maxRetries) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            signal: abortControllerRef.current.signal,
          });

          lastResponse = response;

          if (response.ok) {
            // Success - process the response
            const result = await response.json();

            // Extract data from response (handle various response formats)
            let rawData = result;
            if (result && typeof result === 'object') {
              rawData = result.data ?? result.results ?? result;
            }

            // Apply transformer if configured
            const transformedData = config?.transformData
              ? config.transformData(rawData)
              : rawData;

            // Don't replace valid inline data with empty state from auto-refresh
            const isEmptyState = transformedData && typeof transformedData === 'object' && !Array.isArray(transformedData) && (transformedData as Record<string, unknown>)._emptyState === true;
            const hasValidData = data !== undefined && data !== null && !(typeof data === 'object' && data !== null && !Array.isArray(data) && (data as Record<string, unknown>)._emptyState === true);
            if (isEmptyState && hasValidData) {
              // Keep existing inline data, just update freshness
              setLastUpdated(new Date());
              setIsLoading(false);
              setRetryCount(totalRetries);
              setIsRetrying(false);
              return;
            }

            setData(transformedData);
            setLastUpdated(new Date());
            setIsError(false);
            setError(null);
            setIsLoading(false);
            setRetryCount(totalRetries);
            setIsRetrying(false);

            onSuccess?.(transformedData);
            return;
          }

          // Check if we should retry
          if (shouldRetry(response.status, attempt, retryConfig.maxRetries)) {
            totalRetries++;
            setRetryCount(totalRetries);
            setIsRetrying(true);

            const delay = getRetryDelay(
              attempt,
              retryConfig,
              response.headers.get('Retry-After')
            );

            console.log(
              `[useCardData] Retrying ${type} (attempt ${attempt + 1}/${retryConfig.maxRetries}, delay: ${delay}ms, status: ${response.status})`
            );

            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue;
          }

          // Non-retryable error
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (fetchErr) {
          // Abort errors should not be retried
          if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
            throw fetchErr;
          }

          // Network errors - retry if we have attempts left
          if (attempt < retryConfig.maxRetries) {
            totalRetries++;
            setRetryCount(totalRetries);
            setIsRetrying(true);

            const delay = getRetryDelay(attempt, retryConfig);

            console.log(
              `[useCardData] Network error for ${type}, retrying (attempt ${attempt + 1}/${retryConfig.maxRetries}, delay: ${delay}ms)`
            );

            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue;
          }

          // No more retries
          throw fetchErr;
        }
      }

      // Exhausted all retries
      const statusText = lastResponse ? `${lastResponse.status}: ${lastResponse.statusText}` : 'Unknown error';
      throw new Error(`Max retries exceeded. Last error: HTTP ${statusText}`);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setIsError(true);
      setError(error);
      setIsLoading(false);
      setIsRetrying(false);

      onError?.(error);
    }
  }, [endpoint, config, data, onSuccess, onError, retryConfig, type]);

  // Manual refetch
  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Pause/resume
  const pause = useCallback(() => {
    setIsPaused(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    if (canFetch && !initialData) {
      fetchData(true);
    }

    return () => {
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [canFetch]); // Only run on mount, not on every fetchData change

  // Auto-refresh interval
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Set up new interval if conditions are met
    if (canFetch && autoRefresh && !isPaused && refreshMs > 0) {
      intervalRef.current = setInterval(() => {
        fetchData(false); // Don't show loading for background refresh
      }, refreshMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [canFetch, autoRefresh, isPaused, refreshMs, fetchData]);

  // Refetch when scope changes significantly (skip on first mount when initialData is present)
  const hasInitialDataRef = useRef(!!initialData);
  useEffect(() => {
    if (hasInitialDataRef.current) {
      hasInitialDataRef.current = false;
      return;
    }
    if (canFetch && data !== undefined) {
      fetchData(false);
    }
  }, [endpoint]); // Refetch when endpoint changes (scope changed)

  return {
    data,
    isLoading,
    isError,
    error,
    status,
    lastUpdated,
    refetch,
    pause,
    resume,
    canFetch,
    endpoint,
    retryCount,
    isRetrying,
  };
}

// =============================================================================
// Batch Hook for Multiple Cards
// =============================================================================

export interface UseBatchCardDataOptions {
  cards: Array<{
    id: string;
    type: AllCardTypes;
    scope: CardScope;
    initialData?: unknown;
  }>;
  autoRefresh?: boolean;
}

/**
 * Hook for managing data for multiple cards
 * Useful for coordinated refresh or pause/resume all
 */
export function useBatchCardData({ cards, autoRefresh = true }: UseBatchCardDataOptions) {
  const [isPaused, setIsPaused] = useState(false);

  const pauseAll = useCallback(() => setIsPaused(true), []);
  const resumeAll = useCallback(() => setIsPaused(false), []);

  return {
    isPaused,
    pauseAll,
    resumeAll,
    autoRefresh: autoRefresh && !isPaused,
  };
}
