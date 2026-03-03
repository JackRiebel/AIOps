/**
 * useCardRefresh - React Query Hook for Card Data Refresh
 *
 * Provides polling-based data refresh for Smart Cards.
 * Uses React Query for caching and automatic refetching.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { SmartCard, FreshnessStatus } from '../types';

// =============================================================================
// Types
// =============================================================================

interface UseCardRefreshOptions {
  card: SmartCard;
  enabled?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

interface CardRefreshResult {
  data: unknown;
  status: FreshnessStatus;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  pause: () => void;
  resume: () => void;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useCardRefresh({
  card,
  enabled = true,
  onSuccess,
  onError,
}: UseCardRefreshOptions): CardRefreshResult {
  const queryClient = useQueryClient();

  // Determine if refresh is possible
  const canRefresh = useMemo(() =>
    card.refresh.enabled &&
    card.refresh.endpoint &&
    card.refresh.interval > 0,
    [card.refresh.enabled, card.refresh.endpoint, card.refresh.interval]
  );

  // Build query key
  const queryKey = useMemo(() =>
    ['card-data', card.id, card.type, card.refresh.endpoint],
    [card.id, card.type, card.refresh.endpoint]
  );

  // Fetch function
  const fetchCardData = useCallback(async () => {
    if (!card.refresh.endpoint) {
      throw new Error('No refresh endpoint configured');
    }

    const response = await fetch(card.refresh.endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Refresh failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.data ?? result;
  }, [card.refresh.endpoint]);

  // Use React Query with polling
  const isEnabled = Boolean(enabled && canRefresh);

  const query = useQuery({
    queryKey,
    queryFn: fetchCardData,
    enabled: isEnabled,
    refetchInterval: isEnabled ? card.refresh.interval : false,
    refetchIntervalInBackground: false, // Don't refresh when tab is hidden
    staleTime: card.refresh.interval * 0.8, // Consider stale slightly before next refresh
    gcTime: card.refresh.interval * 2, // Keep in cache for 2x refresh interval
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Handle success/error callbacks
  if (query.isSuccess && onSuccess) {
    onSuccess(query.data);
  }

  if (query.isError && onError) {
    onError(query.error as Error);
  }

  // Calculate freshness status
  const status = useMemo((): FreshnessStatus => {
    if (query.isLoading && !query.data) return 'loading';
    if (query.isError) return 'error';
    if (query.isStale) return 'stale';
    if (query.isRefetching) return 'loading';
    return 'live';
  }, [query.isLoading, query.isError, query.isStale, query.isRefetching, query.data]);

  // Pause/resume functions
  const pause = useCallback(() => {
    queryClient.cancelQueries({ queryKey });
  }, [queryClient, queryKey]);

  const resume = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  // Manual refetch
  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    data: query.data ?? card.data.current,
    status,
    isLoading: query.isLoading && !query.data,
    isError: query.isError,
    error: query.error as Error | null,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
    refetch,
    pause,
    resume,
  };
}

// =============================================================================
// Batch Refresh Hook
// =============================================================================

interface UseBatchRefreshOptions {
  cards: SmartCard[];
  enabled?: boolean;
}

/**
 * Hook for managing refresh of multiple cards efficiently
 */
export function useBatchCardRefresh({
  cards,
  enabled = true,
}: UseBatchRefreshOptions) {
  const queryClient = useQueryClient();

  // Get all refreshable cards
  const refreshableCards = useMemo(() =>
    cards.filter(c =>
      c.refresh.enabled &&
      c.refresh.endpoint &&
      c.refresh.interval > 0
    ),
    [cards]
  );

  // Pause all refreshes
  const pauseAll = useCallback(() => {
    for (const card of refreshableCards) {
      queryClient.cancelQueries({
        queryKey: ['card-data', card.id],
      });
    }
  }, [queryClient, refreshableCards]);

  // Resume all refreshes
  const resumeAll = useCallback(() => {
    for (const card of refreshableCards) {
      queryClient.invalidateQueries({
        queryKey: ['card-data', card.id],
      });
    }
  }, [queryClient, refreshableCards]);

  // Refresh specific card
  const refreshCard = useCallback((cardId: string) => {
    queryClient.invalidateQueries({
      queryKey: ['card-data', cardId],
    });
  }, [queryClient]);

  // Clear all card caches
  const clearCache = useCallback(() => {
    queryClient.removeQueries({
      queryKey: ['card-data'],
    });
  }, [queryClient]);

  return {
    refreshableCount: refreshableCards.length,
    pauseAll,
    resumeAll,
    refreshCard,
    clearCache,
    enabled,
  };
}

// =============================================================================
// Freshness Calculation
// =============================================================================

/**
 * Calculate freshness percentage based on time since last update
 */
export function calculateFreshness(
  lastUpdated: Date | null,
  refreshInterval: number
): number {
  if (!lastUpdated || refreshInterval <= 0) return 100;

  const elapsed = Date.now() - lastUpdated.getTime();
  const freshness = Math.max(0, 100 - (elapsed / refreshInterval) * 100);

  return Math.round(freshness);
}

/**
 * Get a human-readable freshness label
 */
export function getFreshnessLabel(status: FreshnessStatus): string {
  switch (status) {
    case 'live':
      return 'Live';
    case 'recent':
      return 'Recent';
    case 'stale':
      return 'Stale';
    case 'loading':
      return 'Refreshing...';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}

/**
 * Get freshness color for UI
 */
export function getFreshnessColor(status: FreshnessStatus): string {
  switch (status) {
    case 'live':
      return '#10b981'; // emerald
    case 'recent':
      return '#3b82f6'; // blue
    case 'stale':
      return '#f59e0b'; // amber
    case 'loading':
      return '#6b7280'; // gray
    case 'error':
      return '#ef4444'; // red
    default:
      return '#6b7280';
  }
}
