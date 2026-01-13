'use client';

import React, { memo, useMemo, useState, useEffect, useRef } from 'react';
import type { CanvasCard as CanvasCardType } from '@/types/session';
import { CanvasCard, CanvasCardProps } from './CanvasCard';
import { useLiveCard, useRelativeTime } from '@/hooks/useLiveCard';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { useCardPolling } from '@/hooks/useCardPolling';
import { getCardPollingConfig } from '@/config/card-polling';
import { CardContent } from './cards';
import { Loader2, AlertCircle, MousePointerClick, Network } from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';

/**
 * LiveCanvasCard - Wrapper that adds live data updates to CanvasCard
 *
 * This component wraps CanvasCard and integrates it with the WebSocket system
 * for real-time data updates. It:
 * - Subscribes to the card's topic when isLive=true
 * - Updates card data when new data arrives via WebSocket
 * - Falls back to polling for template cards without WebSocket subscriptions
 * - Shows live indicator with last update time
 * - Falls back to static data when not connected
 */

export interface LiveCanvasCardProps extends Omit<CanvasCardProps, 'children'> {
  /** Override to force static mode (ignore isLive setting) */
  forceStatic?: boolean;
  /** Context for polling (orgId, networkId, etc.) */
  pollingContext?: {
    orgId?: string;
    networkId?: string;
    deviceSerial?: string;
  };
}

export const LiveCanvasCard = memo(({
  card,
  forceStatic = false,
  pollingContext = {},
  ...props
}: LiveCanvasCardProps) => {
  const wsContext = useWebSocketContext();
  const { demoMode } = useDemoMode();

  // Check if this card needs polling (template cards without WebSocket subscriptions)
  const hasSubscription = !!card.metadata.subscription?.topic;
  const isFromTemplate = !!card.metadata.templateSource;
  const shouldUsePoll = (isFromTemplate || card.metadata.isLive) && !hasSubscription;

  // Get context from card config - this takes priority over page-level selection
  // A card created for "Network A" should always poll "Network A"
  const cardConfig = useMemo(() => card.config || {}, [card.config]);

  // Card's embedded context takes priority over page-level pollingContext
  // This ensures cards keep their original context even when user changes selection
  const effectiveContext = useMemo(() => {
    const ctx = {
      orgId: (cardConfig.orgId as string) || pollingContext.orgId || undefined,
      networkId: (cardConfig.networkId as string) || pollingContext.networkId || undefined,
      deviceSerial: (cardConfig.deviceSerial as string) || pollingContext.deviceSerial || undefined,
    };
    // Debug logging for troubleshooting card context
    if (shouldUsePoll) {
      console.log(`[LiveCanvasCard] ${card.type} context resolution:`, {
        cardConfigNetworkId: cardConfig.networkId,
        cardConfigOrgId: cardConfig.orgId,
        pollingContextNetworkId: pollingContext.networkId,
        pollingContextOrgId: pollingContext.orgId,
        effectiveNetworkId: ctx.networkId,
        effectiveOrgId: ctx.orgId,
        templateSource: card.metadata.templateSource,
      });
    }
    return ctx;
  }, [pollingContext, cardConfig, shouldUsePoll, card.type, card.metadata.templateSource]);

  // Use polling for template cards without WebSocket subscriptions
  // When demo mode is OFF, don't use initialData - only show real API data
  // This prevents stale/demo data from persisting when demo mode is toggled off
  const polling = useCardPolling({
    cardType: card.type,
    context: effectiveContext,
    enabled: shouldUsePoll && !forceStatic,
    initialData: demoMode ? card.data : undefined,
  });

  // Use live card hook for WebSocket-based real-time updates
  const {
    liveData,
    lastUpdate: wsLastUpdate,
    isLive: wsIsLive,
    isSubscribed,
    updateCount,
  } = useLiveCard({
    card,
    subscribe: wsContext.subscribe,
    unsubscribe: wsContext.unsubscribe,
    lastTopicUpdate: wsContext.lastTopicUpdate,
    isConnected: wsContext.isConnected,
  });

  // Determine which data source to use and which data to display
  const { displayData, lastUpdate, isLive, dataSource } = useMemo(() => {
    if (forceStatic) {
      // When demo mode is OFF, don't use static card.data (which may be demo data)
      return {
        displayData: demoMode ? card.data : undefined,
        lastUpdate: null,
        isLive: false,
        dataSource: 'static' as const,
      };
    }

    // If we have WebSocket subscription, prefer that
    if (wsIsLive && hasSubscription) {
      return {
        displayData: liveData,
        lastUpdate: wsLastUpdate,
        isLive: true,
        dataSource: 'websocket' as const,
      };
    }

    // If using polling, use polled data
    if (shouldUsePoll) {
      return {
        displayData: polling.data,
        lastUpdate: polling.lastFetch,
        isLive: polling.hasContext && !polling.error,
        dataSource: 'polling' as const,
      };
    }

    // Fall back to card's static data
    // When demo mode is OFF, don't use static card.data (which may be demo data)
    return {
      displayData: demoMode ? card.data : undefined,
      lastUpdate: null,
      isLive: false,
      dataSource: 'static' as const,
    };
  }, [forceStatic, wsIsLive, hasSubscription, liveData, wsLastUpdate, shouldUsePoll, polling, card.data, demoMode]);

  // Format the last update time
  const relativeTime = useRelativeTime(lastUpdate);

  // Check if we have meaningful data (not empty object or null)
  const hasData = useMemo(() => {
    if (!displayData) return false;
    if (Array.isArray(displayData)) return displayData.length > 0;
    if (typeof displayData === 'object') return Object.keys(displayData).length > 0;
    return true;
  }, [displayData]);

  // Create a modified card with live data
  const liveCard = useMemo((): CanvasCardType => {
    return {
      ...card,
      data: displayData || {},
      metadata: {
        ...card.metadata,
        // Update the timestamp to reflect last live update
        lastLiveUpdate: lastUpdate?.toISOString(),
      },
    };
  }, [card, displayData, lastUpdate]);

  // Render content based on state
  const renderContent = () => {
    // Loading state for polling - show when:
    // 1. Currently fetching (isLoading)
    // 2. Waiting for first fetch to complete (isInitializing) and we have context
    const showLoading = shouldUsePoll && !hasData && !demoMode &&
      (polling.isLoading || (polling.isInitializing && polling.hasContext));

    if (showLoading) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading data...</span>
        </div>
      );
    }

    // Context required message - skip if demo mode is on (let cards show mock data)
    if (shouldUsePoll && !polling.hasContext && polling.contextMessage && !demoMode) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 px-4 text-center">
          <MousePointerClick className="w-8 h-8 opacity-50" />
          <span className="text-sm">{polling.contextMessage}</span>
        </div>
      );
    }

    // Error state - skip if demo mode is on (let cards show mock data)
    if (shouldUsePoll && polling.error && !hasData && !demoMode) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-amber-400 gap-3 px-4 text-center">
          <AlertCircle className="w-6 h-6" />
          <span className="text-sm">{polling.error}</span>
        </div>
      );
    }

    // No data - show helpful message about what's missing
    // Only show "no data" if we've finished initializing (not still loading)
    if (!hasData && !demoMode && (!shouldUsePoll || !polling.isInitializing)) {
      // Check what context the card requires
      const cardPollingConfig = getCardPollingConfig(card.type);
      let message = 'No data available';
      let showNetworkIcon = false;

      if (cardPollingConfig) {
        if (cardPollingConfig.requires === 'networkId' && !effectiveContext.networkId) {
          message = cardPollingConfig.contextMessage || 'Select a network to view data';
          showNetworkIcon = true;
        } else if (cardPollingConfig.requires === 'orgId' && !effectiveContext.orgId) {
          message = cardPollingConfig.contextMessage || 'Select an organization to view data';
        } else if (cardPollingConfig.requires === 'both') {
          if (!effectiveContext.networkId && !effectiveContext.orgId) {
            message = 'Select an organization and network';
            showNetworkIcon = true;
          } else if (!effectiveContext.networkId) {
            message = 'Select a network to view data';
            showNetworkIcon = true;
          } else if (!effectiveContext.orgId) {
            message = 'Select an organization to view data';
          }
        }
      }

      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 px-4 text-center">
          {showNetworkIcon && <Network className="w-5 h-5 opacity-50" />}
          <span className="text-sm">{message}</span>
        </div>
      );
    }

    // Render actual content (cards will generate mock data if demoMode is on)
    return <CardContent card={{ ...card, data: displayData }} />;
  };

  return (
    <CanvasCard card={liveCard} {...props}>
      {/* Custom content with live data */}
      <div className="h-full flex flex-col">
        {/* Card content */}
        <div className="flex-1 overflow-auto">
          {renderContent()}
        </div>
        {/* Note: Live indicator is already shown in footer metadata of CanvasCard */}
      </div>
    </CanvasCard>
  );
});

LiveCanvasCard.displayName = 'LiveCanvasCard';

// ============================================================================
// Live Indicator Component (Enhanced with pulse, quality, and staleness)
// ============================================================================

interface LiveIndicatorProps {
  lastUpdate: string;
  updateCount: number;
  isConnected: boolean;
  lastUpdateTime?: Date | null;
  expectedIntervalMs?: number;  // Expected update interval (default 10s)
}

const LiveIndicator = memo(({
  lastUpdate,
  updateCount,
  isConnected,
  lastUpdateTime,
  expectedIntervalMs = 10000,
}: LiveIndicatorProps) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const prevCountRef = useRef(updateCount);
  const staleCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Pulse animation when data updates
  useEffect(() => {
    if (updateCount > prevCountRef.current) {
      setIsPulsing(true);
      setIsStale(false);  // Reset stale on new update
      prevCountRef.current = updateCount;

      // Remove pulse after animation
      const timeout = setTimeout(() => setIsPulsing(false), 600);
      return () => clearTimeout(timeout);
    }
  }, [updateCount]);

  // Check for stale data (more than 3 expected update cycles without data)
  useEffect(() => {
    if (staleCheckRef.current) {
      clearInterval(staleCheckRef.current);
    }

    if (isConnected && lastUpdateTime) {
      staleCheckRef.current = setInterval(() => {
        const now = Date.now();
        const lastMs = lastUpdateTime.getTime();
        const staleThreshold = expectedIntervalMs * 3;  // 3 missed cycles

        setIsStale(now - lastMs > staleThreshold);
      }, 1000);
    }

    return () => {
      if (staleCheckRef.current) {
        clearInterval(staleCheckRef.current);
      }
    };
  }, [isConnected, lastUpdateTime, expectedIntervalMs]);

  // Disconnected state
  if (!isConnected) {
    return (
      <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-slate-600/90 text-white text-[10px] rounded-full shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span className="font-medium">Offline</span>
      </div>
    );
  }

  // Stale data warning (data is old but still connected)
  if (isStale) {
    return (
      <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-amber-500/90 text-white text-[10px] rounded-full shadow-sm">
        <svg className="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="font-medium">Stale</span>
        {lastUpdate && (
          <>
            <span className="text-amber-200">·</span>
            <span className="text-amber-100">{lastUpdate}</span>
          </>
        )}
      </div>
    );
  }

  // Normal live state with pulse on updates
  return (
    <div
      className={`
        absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1
        text-white text-[10px] rounded-full shadow-sm transition-all duration-300
        ${isPulsing
          ? 'bg-cyan-500/95 scale-105'
          : 'bg-emerald-500/90'
        }
      `}
    >
      {/* Animated dot with pulse effect on update */}
      <span className="relative">
        <span
          className={`
            w-1.5 h-1.5 rounded-full bg-white
            ${isPulsing ? 'animate-ping absolute inset-0' : 'animate-pulse'}
          `}
        />
        <span className="w-1.5 h-1.5 rounded-full bg-white relative" />
      </span>

      <span className="font-medium">Live</span>

      {/* Last update time */}
      {lastUpdate && (
        <>
          <span className={isPulsing ? 'text-cyan-200' : 'text-emerald-200'}>·</span>
          <span className={isPulsing ? 'text-cyan-100' : 'text-emerald-100'}>{lastUpdate}</span>
        </>
      )}

      {/* Update count badge (shows on recent update) */}
      {isPulsing && (
        <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-white text-cyan-600 text-[8px] font-bold rounded-full shadow">
          +1
        </span>
      )}
    </div>
  );
});

LiveIndicator.displayName = 'LiveIndicator';

export default LiveCanvasCard;
