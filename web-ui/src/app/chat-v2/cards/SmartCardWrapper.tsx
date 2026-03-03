'use client';

/**
 * SmartCardWrapper
 *
 * Wrapper component for rendering Smart Cards with:
 * - Header with title, subtitle, freshness indicator
 * - Visualization content area
 * - Actions toolbar
 * - Error states and loading
 */

import { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartCard, CARD_SIZES, FreshnessStatus } from './types';
import { CARD_REGISTRY } from './registry';
import { VisualizationRenderer } from './visualizations/VisualizationRenderer';
import { useCardData } from './hooks/useCardData';
import { supportsLiveFetch } from './fetchers';
import {
  getFreshnessColor,
  getFreshnessLabel,
} from './hooks/useCardRefresh';

// =============================================================================
// Types
// =============================================================================

interface SmartCardWrapperProps {
  card: SmartCard;
  isPinned?: boolean;
  isHighlighted?: boolean;
  isExpanded?: boolean;
  onPin?: (cardId: string) => void;
  onRemove?: (cardId: string) => void;
  onExpand?: (cardId: string) => void;
  onAction?: (cardId: string, action: string, payload?: unknown) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Fallback polling context when card doesn't have its own scope */
  pollingContext?: {
    credentialOrg?: string;
    organizationId?: string;
    networkId?: string;
  };
}

// =============================================================================
// Main Component
// =============================================================================

export const SmartCardWrapper = memo(({
  card,
  isPinned = false,
  isHighlighted = false,
  isExpanded = false,
  onPin,
  onRemove,
  onExpand,
  onAction,
  onMouseEnter,
  onMouseLeave,
  pollingContext,
}: SmartCardWrapperProps) => {
  const [showActions, setShowActions] = useState(false);

  // Get card definition from registry
  const definition = useMemo(
    () => CARD_REGISTRY[card.type],
    [card.type]
  );

  // Build scope from card, using pollingContext as fallback
  // Card's own scope takes priority over page-level pollingContext
  const scope = useMemo(() => ({
    credentialOrg: card.scope?.credentialOrg || pollingContext?.credentialOrg,
    organizationId: card.scope?.organizationId || pollingContext?.organizationId,
    networkId: card.scope?.networkId || pollingContext?.networkId,
    deviceSerial: card.scope?.deviceSerial,
    siteId: card.scope?.siteId,
    testId: card.scope?.testId,
  }), [card.scope, pollingContext]);

  // Check if this card type supports live fetching
  const canLiveFetch = useMemo(() => supportsLiveFetch(card.type), [card.type]);

  // Respect card-level refresh override (0 = static card with pre-loaded data)
  const cardRefreshInterval = card.refresh?.interval;
  const isStaticCard = cardRefreshInterval === 0 || card.refresh?.enabled === false;

  // Use self-refreshing data hook for live data
  const {
    data,
    status,
    isLoading,
    isError,
    error,
    lastUpdated,
    refetch,
  } = useCardData({
    type: card.type,
    scope,
    initialData: card.data?.current ?? card.initialData?.payload,
    refreshInterval: isStaticCard ? 0 : undefined,
    autoRefresh: isStaticCard ? false : (!isExpanded && canLiveFetch),
  });

  // Report data status changes to parent (for test page tracking)
  const hasReportedRef = useRef(false);
  useEffect(() => {
    if (hasReportedRef.current) return;

    if (status === 'live' && data !== undefined) {
      hasReportedRef.current = true;
      onAction?.(card.id, 'data-loaded', { data });
    } else if (isError && error) {
      hasReportedRef.current = true;
      onAction?.(card.id, 'data-error', { error });
    }
  }, [status, data, isError, error, card.id, onAction]);

  // Get size config with fallback
  const sizeConfig = CARD_SIZES[card.size] || CARD_SIZES.md;

  // Handle visualization action
  const handleVisualizationAction = useCallback(
    (action: string, payload?: unknown) => {
      onAction?.(card.id, action, payload);
    },
    [card.id, onAction]
  );

  // Handle card expand
  const handleExpand = useCallback(() => {
    onExpand?.(card.id);
  }, [card.id, onExpand]);

  // Handle pin
  const handlePin = useCallback(() => {
    onPin?.(card.id);
  }, [card.id, onPin]);

  // Handle remove
  const handleRemove = useCallback(() => {
    onRemove?.(card.id);
  }, [card.id, onRemove]);

  // Debug: log size config (uncomment to debug card sizing)
  // console.log(`[Card ${card.type}] size=${card.size}, colSpan=${sizeConfig.colSpan}, rowSpan=${sizeConfig.rowSpan}`);

  return (
    <div
      style={{
        gridColumn: `span ${sizeConfig.colSpan}`,
        gridRow: `span ${sizeConfig.rowSpan}`,
        minHeight: sizeConfig.minHeight,
      }}
    >
      <motion.div
        layout="position"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: 1,
          scale: 1,
          boxShadow: isHighlighted
            ? '0 0 0 2px rgba(6, 182, 212, 0.5), 0 0 20px rgba(6, 182, 212, 0.2)'
            : 'none',
        }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onMouseEnter={() => {
          setShowActions(true);
          onMouseEnter?.();
        }}
        onMouseLeave={() => {
          setShowActions(false);
          onMouseLeave?.();
        }}
        className="relative flex flex-col bg-white/90 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden transition-all hover:border-cyan-300 dark:hover:border-cyan-500/30 hover:shadow-md h-full"
      >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Platform icon */}
          {definition?.icon && (
            <PlatformIcon platform={card.type.split('_')[0]} />
          )}

          {/* Title */}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {card.title}
            </h3>
            {card.subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {card.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Freshness indicator */}
        <FreshnessIndicator
          status={status}
          lastUpdated={lastUpdated}
          onRefresh={refetch}
        />
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
        {/* Error state */}
        {isError ? (
          <ErrorState
            error={error}
            onRetry={refetch}
          />
        ) : isLoading && !data ? (
          /* Compact loading state for initial load */
          <div className="flex items-center justify-center h-full min-h-[60px] py-4">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Loading overlay for refresh */}
            <AnimatePresence>
              {isLoading && data !== undefined && data !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10"
                >
                  <LoadingSpinner />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Visualization */}
            <VisualizationRenderer
              data={data}
              config={card.visualization}
              onAction={handleVisualizationAction}
            />
          </>
        )}
      </div>

      {/* Actions toolbar (appears on hover) - positioned top-right to avoid pagination */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-2 right-2 flex items-center gap-0.5 bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/50 rounded-lg px-1 py-0.5 shadow-lg backdrop-blur-sm z-20"
          >
            {/* Pin button */}
            <button
              onClick={handlePin}
              className={`p-1.5 rounded transition-colors ${
                isPinned
                  ? 'text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={isPinned ? 'Unpin card' : 'Pin card'}
            >
              <PinIcon filled={isPinned} />
            </button>

            {/* Expand button */}
            <button
              onClick={handleExpand}
              className="p-1.5 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ExpandIcon expanded={isExpanded} />
            </button>

            {/* Remove button */}
            <button
              onClick={handleRemove}
              className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Remove card"
            >
              <RemoveIcon />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pin indicator - only show when not hovering (actions toolbar shows pin state) */}
      {isPinned && !showActions && (
        <div className="absolute top-2 right-2 z-10">
          <span className="text-cyan-600 dark:text-cyan-400">
            <PinIcon filled size="sm" />
          </span>
        </div>
      )}
      </motion.div>
    </div>
  );
});

SmartCardWrapper.displayName = 'SmartCardWrapper';

// =============================================================================
// Freshness Indicator
// =============================================================================

interface FreshnessIndicatorProps {
  status: FreshnessStatus;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

const FreshnessIndicator = memo(({
  status,
  lastUpdated,
  onRefresh,
}: FreshnessIndicatorProps) => {
  const color = getFreshnessColor(status);
  const label = getFreshnessLabel(status);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRefresh();
      }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group"
      title={`${label}${lastUpdated ? ` - Updated ${formatTimeAgo(lastUpdated)}` : ''}\nClick to refresh`}
    >
      {/* Status dot */}
      <span className="relative flex h-2 w-2">
        {status === 'live' && (
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
            style={{ backgroundColor: color }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: color }}
        />
      </span>

      {/* Label */}
      <span
        className="text-xs font-medium group-hover:underline"
        style={{ color }}
      >
        {status === 'loading' ? (
          <span className="flex items-center gap-1">
            <LoadingDots />
          </span>
        ) : (
          label
        )}
      </span>
    </button>
  );
});

FreshnessIndicator.displayName = 'FreshnessIndicator';

// =============================================================================
// Error State
// =============================================================================

interface ErrorStateProps {
  error: Error | null;
  onRetry: () => void;
}

const ErrorState = memo(({ error, onRetry }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
      <ErrorIcon />
    </div>
    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
      {error?.message ?? 'Failed to load data'}
    </p>
    <button
      onClick={onRetry}
      className="px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors"
    >
      Retry
    </button>
  </div>
));

ErrorState.displayName = 'ErrorState';

// =============================================================================
// Loading Components
// =============================================================================

const LoadingSpinner = () => (
  <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
);

const LoadingDots = () => (
  <span className="flex gap-0.5">
    {[0, 1, 2].map(i => (
      <motion.span
        key={i}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        className="w-1 h-1 rounded-full bg-current"
      />
    ))}
  </span>
);

// =============================================================================
// Platform Icon
// =============================================================================

const PlatformIcon = memo(({ platform }: { platform: string }) => {
  const iconClass = "w-4 h-4 text-slate-500";

  switch (platform) {
    case 'meraki':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'te':
    case 'thousandeyes':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'splunk':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M4 4h16v16H4z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 16l4-8 4 8" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'catalyst':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="18" cy="18" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 9v6M9 15l-3 3M15 15l3 3" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
  }
});

PlatformIcon.displayName = 'PlatformIcon';

// =============================================================================
// Icons
// =============================================================================

const PinIcon = ({ filled = false, size = 'md' }: { filled?: boolean; size?: 'sm' | 'md' }) => (
  <svg className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

const ExpandIcon = ({ expanded = false }: { expanded?: boolean }) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {expanded ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    )}
  </svg>
);

const RemoveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ErrorIcon = () => (
  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// =============================================================================
// Helpers
// =============================================================================

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// =============================================================================
// Exports
// =============================================================================

export default SmartCardWrapper;
