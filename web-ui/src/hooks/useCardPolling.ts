'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCardPollingConfig,
  buildCardDataUrl,
  hasRequiredContext,
  type CardPollingConfig,
} from '@/config/card-polling';
import { useDemoMode } from '@/contexts/DemoModeContext';

// ============================================================================
// Types
// ============================================================================

export interface CardContext {
  orgId?: string;
  networkId?: string;
  deviceSerial?: string;
}

export interface UseCardPollingOptions {
  /** Card type (e.g., 'network-health', 'incident-tracker') */
  cardType: string;
  /** Context for building API URLs */
  context: CardContext;
  /** Whether polling is enabled */
  enabled?: boolean;
  /** Override polling interval (ms) */
  pollingInterval?: number;
  /** Initial data (if any) */
  initialData?: any;
}

export interface UseCardPollingReturn {
  /** Current data */
  data: any;
  /** Whether currently loading */
  isLoading: boolean;
  /** Whether waiting for the first fetch to complete (show loading, not "no data") */
  isInitializing: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Last successful fetch time */
  lastFetch: Date | null;
  /** Whether the card has required context */
  hasContext: boolean;
  /** Message to show when context is missing */
  contextMessage: string | null;
  /** Manually trigger a refresh */
  refresh: () => void;
  /** Polling config for this card type */
  config: CardPollingConfig | null;
}

// ============================================================================
// Hook
// ============================================================================

export function useCardPolling({
  cardType,
  context,
  enabled = true,
  pollingInterval,
  initialData,
}: UseCardPollingOptions): UseCardPollingReturn {
  const [data, setData] = useState<any>(initialData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // True until first fetch completes
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Get demo mode setting to pass to backend
  const { demoMode } = useDemoMode();

  // Reset data when initialData changes (e.g., when demo mode is toggled)
  // This ensures we don't show stale/demo data when initialData becomes undefined
  useEffect(() => {
    setData(initialData || null);
  }, [initialData]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Get polling config for this card type
  const config = getCardPollingConfig(cardType);

  // Check if we have required context
  const hasContext = hasRequiredContext(cardType, context);
  const contextMessage = config?.contextMessage || null;

  // Calculate effective polling interval
  const effectiveInterval = pollingInterval ?? config?.pollingInterval ?? 0;

  // Fetch data from API
  const fetchData = useCallback(async () => {
    if (!config || !hasContext || !enabled) {
      // Debug logging for troubleshooting
      if (enabled && config && !hasContext) {
        console.warn(`[useCardPolling] ${cardType}: Missing required context`, {
          requires: config.requires,
          context,
          contextMessage: config.contextMessage,
        });
      }
      return;
    }

    // Pass demo mode to backend so it knows whether to generate fallback data
    const url = buildCardDataUrl(cardType, context, { demoMode });
    if (!url) {
      console.warn(`[useCardPolling] ${cardType}: Could not build URL - missing context`, { context, config });
      return;
    }

    console.log(`[useCardPolling] ${cardType}: Fetching from ${url}`);

    // Cancel any in-progress request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(url, {
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[useCardPolling] ${cardType}: HTTP ${response.status} - ${errorText}`);
        if (response.status === 401) {
          throw new Error('Not authenticated');
        }
        if (response.status === 403) {
          throw new Error('Not authorized');
        }
        if (response.status === 404) {
          // Log the full URL for debugging
          console.error(`[useCardPolling] ${cardType}: 404 Not Found - URL: ${url}`);
          throw new Error('Endpoint not found - try restarting the server');
        }
        if (response.status === 502) {
          throw new Error('Backend connection failed');
        }
        throw new Error(`Failed to fetch: ${response.status} - ${errorText.slice(0, 200)}`);
      }

      const result = await response.json();

      if (mountedRef.current) {
        // Check if response is an error object (has type/message or detail keys)
        if (result.type === 'error' || result.detail) {
          throw new Error(result.message || result.detail || 'Unknown error');
        }

        // Handle different response formats
        const cardData = result.data ?? result;

        // Additional safety: don't set data if it looks like an error
        if (cardData && typeof cardData === 'object' && (cardData.type === 'error' || cardData.detail)) {
          throw new Error(cardData.message || cardData.detail || 'Unknown error');
        }

        console.log(`[useCardPolling] ${cardType}: Got data:`, cardData);
        setData(cardData);
        setLastFetch(new Date());
        setError(null);
      }
    } catch (err) {
      // Silently ignore abort errors - these are expected during cleanup
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error(`[useCardPolling] ${cardType}: Error fetching`, err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsInitializing(false); // First fetch attempt complete
      }
    }
  }, [cardType, config, context, hasContext, enabled, demoMode]);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Initial fetch and polling setup
  useEffect(() => {
    mountedRef.current = true;

    console.log(`[useCardPolling] ${cardType}: Effect triggered`, {
      enabled,
      hasContext,
      hasConfig: !!config,
      context,
    });

    if (!enabled || !hasContext || !config) {
      console.log(`[useCardPolling] ${cardType}: Skipping fetch - enabled:${enabled} hasContext:${hasContext} hasConfig:${!!config}`);
      return;
    }

    // Initial fetch
    fetchData();

    // Set up polling if interval > 0
    if (effectiveInterval > 0) {
      const poll = () => {
        pollingTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            fetchData();
            poll(); // Schedule next poll
          }
        }, effectiveInterval);
      };
      poll();
    }

    return () => {
      mountedRef.current = false;

      // Cancel any in-progress request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear polling timeout
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, [cardType, enabled, hasContext, effectiveInterval, fetchData, config]);

  // NOTE: We removed the separate context change effect because it was redundant.
  // The main polling effect already re-runs when context changes because fetchData
  // is recreated when context changes. Having both effects caused double-fetches
  // and race conditions.

  return {
    data,
    isLoading,
    isInitializing,
    error,
    lastFetch,
    hasContext,
    contextMessage,
    refresh,
    config,
  };
}

export default useCardPolling;
