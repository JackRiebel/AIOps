'use client';

import React, { memo, useMemo, useCallback } from 'react';
import type { CanvasCard as CanvasCardType } from '@/types/session';
import { CardContent } from './cards';

/**
 * CanvasCard - Draggable visualization card for the canvas workspace
 *
 * Following "Show, Don't Tell" philosophy:
 * - Drag handle at top (no label)
 * - Lock/unlock button to pin cards in place
 * - Remove button (X icon only)
 * - Quiet metadata footer: `Live · 8s ago · $0.004`
 * - Dynamic visualization via CardContent
 */

// ============================================================================
// Types
// ============================================================================

/** Context passed when user wants to ask about this card */
export interface CardQueryContext {
  cardId: string;
  cardType: CanvasCardType['type'];
  cardTitle: string;
  data: unknown;
  summary: string;
  /** Card config containing networkId, deviceSerial, organizationId for AI context */
  config?: Record<string, string>;
}

export interface CanvasCardProps {
  /** Card data */
  card: CanvasCardType;
  /** Handler when remove button is clicked */
  onRemove?: () => void;
  /** Handler when lock button is clicked */
  onLockToggle?: (isLocked: boolean) => void;
  /** Handler when "Ask about this" button is clicked */
  onAskAbout?: (context: CardQueryContext) => void;
  /** Handler when card is clicked (for selection) */
  onClick?: () => void;
  /** Whether the card is selected */
  isSelected?: boolean;
  /** Whether the card is loading/refreshing */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children to render in content area (overrides default CardContent) */
  children?: React.ReactNode;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format relative time (e.g., "8s ago", "2m ago", "1h ago")
 */
function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Format cost as compact string
 */
function formatCost(cost: number): string {
  if (cost === 0) return '';
  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(4)}`;
}

// ============================================================================
// Card Type Icons
// ============================================================================

interface CardTypeIconProps {
  type: CanvasCardType['type'];
  className?: string;
}

const CardTypeIcon = memo(({ type, className = 'w-4 h-4' }: CardTypeIconProps) => {
  const iconClass = `${className} text-slate-400 dark:text-slate-500`;

  switch (type) {
    case 'network-health':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'client-distribution':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      );
    case 'performance-chart':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      );
    case 'device-table':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case 'topology':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      );
    case 'alert-summary':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      );
  }
});

CardTypeIcon.displayName = 'CardTypeIcon';

// ============================================================================
// Loading Indicator
// ============================================================================

const LoadingOverlay = memo(() => (
  <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center z-10">
    <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
  </div>
));

LoadingOverlay.displayName = 'LoadingOverlay';

// ============================================================================
// Main CanvasCard Component
// ============================================================================

/**
 * Generate a brief summary of card data for query context
 */
function generateCardSummary(card: CanvasCardType): string {
  const data = card.data;
  if (!data) return 'No data';

  // Handle array data (most common)
  if (Array.isArray(data)) {
    const count = data.length;
    const itemType = count === 1 ? 'item' : 'items';

    // Try to count items with specific statuses
    const offlineCount = data.filter((d: unknown) =>
      typeof d === 'object' && d !== null && 'status' in d && d.status === 'offline'
    ).length;

    if (offlineCount > 0) {
      return `${count} ${itemType}, ${offlineCount} offline`;
    }

    return `${count} ${itemType}`;
  }

  // Handle object data
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    return `${keys.length} properties`;
  }

  return 'Data available';
}

export const CanvasCard = memo(({
  card,
  onRemove,
  onLockToggle,
  onAskAbout,
  onClick,
  isSelected = false,
  isLoading = false,
  className = '',
  children,
}: CanvasCardProps) => {
  // Check if card is locked
  const isLocked = card.config?.isLocked === true;

  // Handle lock toggle
  const handleLockToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onLockToggle?.(!isLocked);
  }, [isLocked, onLockToggle]);

  // Memoize metadata display
  const metadataDisplay = useMemo(() => {
    const parts: string[] = [];

    if (card.metadata.isLive) {
      parts.push('Live');
    }

    if (isLocked) {
      parts.push('Locked');
    }

    parts.push(formatRelativeTime(card.metadata.updatedAt));

    const cost = formatCost(card.metadata.costUsd);
    if (cost) {
      parts.push(cost);
    }

    return parts;
  }, [card.metadata, isLocked]);

  // Generate accessible summary for screen readers
  const accessibleSummary = useMemo(() => {
    const parts: string[] = [`${card.title} visualization card`];
    if (card.metadata.isLive) parts.push('live updating');
    if (isLocked) parts.push('locked');
    if (isSelected) parts.push('selected');
    const summary = generateCardSummary(card);
    if (summary && summary !== 'No data') parts.push(summary);
    return parts.join(', ');
  }, [card, isLocked, isSelected]);

  return (
    <article
      className={`
        h-full w-full bg-white dark:bg-slate-800 rounded-xl
        shadow-[0_12px_50px_rgba(0,0,0,0.35),0_6px_20px_rgba(0,0,0,0.25),0_2px_6px_rgba(0,0,0,0.12)]
        dark:shadow-[0_12px_50px_rgba(0,0,0,0.7),0_6px_20px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.3)]
        border-2 border-slate-400 dark:border-slate-500
        overflow-hidden flex flex-col relative
        transition-all duration-200
        hover:shadow-[0_18px_60px_rgba(0,0,0,0.45),0_10px_30px_rgba(0,0,0,0.3),0_4px_10px_rgba(0,0,0,0.18)]
        dark:hover:shadow-[0_18px_60px_rgba(0,0,0,0.8),0_10px_30px_rgba(0,0,0,0.6),0_4px_10px_rgba(0,0,0,0.4)]
        ${isSelected ? 'ring-2 ring-cyan-500 ring-offset-2 dark:ring-offset-slate-900 border-cyan-400 shadow-[0_16px_60px_rgba(6,182,212,0.5)]' : ''}
        ${isLocked ? 'ring-1 ring-amber-400/50 border-amber-400 dark:border-amber-500' : ''}
        ${onClick ? 'cursor-pointer hover:border-slate-500 dark:hover:border-slate-400' : ''}
        ${className}
      `}
      onClick={onClick}
      aria-label={accessibleSummary}
      aria-selected={isSelected}
      role="article"
    >
      {/* Loading overlay */}
      {isLoading && <LoadingOverlay />}

      {/* Header with drag handle */}
      <div className={`
        flex items-center justify-between px-3 py-2
        bg-slate-50 dark:bg-slate-800/80
        border-b border-slate-200 dark:border-slate-700/50
        select-none
        ${isLocked ? 'cursor-default' : 'cursor-move drag-handle'}
      `}>
        <div className="flex items-center gap-2 min-w-0">
          <CardTypeIcon type={card.type} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
            {card.title}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Lock/Unlock button */}
          {onLockToggle && (
            <button
              onClick={handleLockToggle}
              className={`
                flex-shrink-0 p-1 rounded transition-colors
                ${isLocked
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }
              `}
              aria-label={isLocked ? 'Unlock card' : 'Lock card'}
              title={isLocked ? 'Unlock card' : 'Lock card in place'}
            >
              {isLocked ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}

          {/* Ask About This button - chat icon */}
          {onAskAbout && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAskAbout({
                  cardId: card.id,
                  cardType: card.type,
                  cardTitle: card.title,
                  data: card.data,
                  summary: generateCardSummary(card),
                  config: card.config,
                });
              }}
              className="flex-shrink-0 p-1 rounded hover:bg-cyan-100 dark:hover:bg-cyan-900/30 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              aria-label="Ask about this data"
              title="Ask AI about this data"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}

          {/* Remove button - X icon only, disabled when locked */}
          {onRemove && !isLocked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="flex-shrink-0 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label="Remove card"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content area - use CardContent if no children provided */}
      <div className="flex-1 overflow-auto">
        {children || (card.data ? (
          <CardContent card={card} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
            <CardTypeIcon type={card.type} className="w-12 h-12" />
          </div>
        ))}
      </div>

      {/* Footer metadata - quiet, no labels */}
      <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700/30 flex flex-col gap-0.5">
        {/* Source query context (if available) */}
        {card.metadata.sourceQuery && (
          <div
            className="text-[10px] text-slate-400 dark:text-slate-500 truncate"
            title={card.metadata.sourceQuery}
          >
            <span className="text-slate-500 dark:text-slate-400">Q:</span> &quot;{card.metadata.sourceQuery.slice(0, 60)}{card.metadata.sourceQuery.length > 60 ? '...' : ''}&quot;
          </div>
        )}
        {/* Live/Locked/Time/Cost indicators */}
        <div className="flex items-center gap-2">
          {metadataDisplay.map((part, index) => (
            <span
              key={index}
              className={`text-[10px] ${
                part === 'Live'
                  ? 'inline-flex items-center text-green-600 dark:text-green-400'
                  : part === 'Locked'
                  ? 'inline-flex items-center text-amber-600 dark:text-amber-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {part === 'Live' && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />
              )}
              {part === 'Locked' && (
                <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
              {part}
              {index < metadataDisplay.length - 1 && (
                <span className="ml-2 text-slate-300 dark:text-slate-600">·</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
});

CanvasCard.displayName = 'CanvasCard';

export default CanvasCard;
