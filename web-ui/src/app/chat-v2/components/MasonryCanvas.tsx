'use client';

/**
 * MasonryCanvas - Auto-Arrange Card Workspace
 *
 * Features:
 * - CSS Grid auto-layout with variable-size cards
 * - Click-to-expand cards with Framer Motion
 * - Bidirectional message-card highlighting
 * - Minimal toolbar (pin, clear)
 * - Session-scoped with delete + undo
 * - Smart Card support with live data refresh
 */

import { memo, useCallback, useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SmartCard } from '../cards/types';
import { useHighlight } from '../contexts/HighlightContext';
import { SmartCardWrapper } from '../cards/SmartCardWrapper';

// =============================================================================
// Types
// =============================================================================

interface MasonryCanvasProps {
  cards: SmartCard[];
  onCardRemove: (cardId: string) => void;
  onCardPin?: (cardId: string) => void;
  onClearUnpinned?: () => void;
  onCardAction?: (cardId: string, action: string, payload?: unknown) => void;
  className?: string;
  /** Fallback polling context when cards don't have their own scope */
  pollingContext?: {
    credentialOrg?: string;
    organizationId?: string;
    networkId?: string;
  };
}

// =============================================================================
// Expanded SmartCard Modal
// =============================================================================

const ExpandedSmartCardModal = memo(({
  card,
  onClose,
  onRemove,
  onPin,
  onAction,
  pollingContext,
}: {
  card: SmartCard;
  onClose: () => void;
  onRemove: () => void;
  onPin?: () => void;
  onAction?: (cardId: string, action: string, payload?: unknown) => void;
  pollingContext?: {
    credentialOrg?: string;
    organizationId?: string;
    networkId?: string;
  };
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-8"
    onClick={onClose}
  >
    {/* Backdrop */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-sm"
    />

    {/* Expanded card */}
    <motion.div
      layoutId={`card-${card.id}`}
      className="relative w-full max-w-5xl max-h-[85vh] bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50">
        <div>
          <h2 className="text-lg font-medium text-slate-900 dark:text-white">{card.title}</h2>
          {card.subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{card.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Suggested actions */}
          {card.aiContext?.suggestedActions && card.aiContext.suggestedActions.length > 0 && (
            <div className="flex gap-2 mr-4">
              {card.aiContext.suggestedActions.slice(0, 2).map((action, i) => (
                <button
                  key={i}
                  onClick={() => onAction?.(card.id, 'follow_up', action)}
                  className="px-3 py-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          )}
          {/* Pin button */}
          {onPin && (
            <button
              onClick={onPin}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                card.pinned
                  ? 'text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 bg-cyan-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
            >
              {card.pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          <button
            onClick={onRemove}
            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Remove
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content - render the full SmartCardWrapper in expanded mode */}
      <div className="flex-1 overflow-auto p-4 min-h-[400px]">
        <SmartCardWrapper
          card={card}
          isPinned={card.pinned}
          isHighlighted={false}
          isExpanded={true}
          onPin={onPin}
          onRemove={onRemove}
          onExpand={onClose}
          onAction={onAction}
          pollingContext={pollingContext}
        />
      </div>
    </motion.div>
  </motion.div>
));
ExpandedSmartCardModal.displayName = 'ExpandedSmartCardModal';

// =============================================================================
// Floating Toolbar
// =============================================================================

const FloatingToolbar = memo(({
  cardCount,
  pinnedCount,
  onClearUnpinned,
}: {
  cardCount: number;
  pinnedCount: number;
  onClearUnpinned?: () => void;
}) => {
  const unpinnedCount = cardCount - pinnedCount;

  if (cardCount === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50 rounded-full shadow-xl backdrop-blur-sm">
        {/* Card count */}
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {cardCount} card{cardCount !== 1 ? 's' : ''}
          {pinnedCount > 0 && (
            <span className="text-amber-600 dark:text-amber-400 ml-1">({pinnedCount} pinned)</span>
          )}
        </span>

        {/* Clear unpinned button */}
        {onClearUnpinned && unpinnedCount > 0 && (
          <>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={onClearUnpinned}
              className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white
                hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Clear unpinned cards"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
});
FloatingToolbar.displayName = 'FloatingToolbar';

// =============================================================================
// Empty State
// =============================================================================

const EmptyState = memo(() => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-sm">
        Cards will appear here as you chat
      </p>
    </div>
  </div>
));
EmptyState.displayName = 'EmptyState';

// =============================================================================
// Main Component
// =============================================================================

export const MasonryCanvas = memo(({
  cards,
  onCardRemove,
  onCardPin,
  onClearUnpinned,
  onCardAction,
  className = '',
  pollingContext,
}: MasonryCanvasProps) => {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const { isCardHighlighted, highlightFromCard, clearHighlight } = useHighlight();

  // Get expanded card
  const expandedCard = useMemo((): SmartCard | null => {
    if (!expandedCardId) return null;
    return cards.find(c => c.id === expandedCardId) || null;
  }, [expandedCardId, cards]);

  // Count pinned cards
  const pinnedCount = useMemo(() => {
    return cards.filter(c => c.pinned === true).length;
  }, [cards]);

  // Sort cards: pinned first (maintaining their order), then unpinned
  const sortedCards = useMemo(() => {
    const pinned = cards.filter(c => c.pinned === true);
    const unpinned = cards.filter(c => !c.pinned);
    return [...pinned, ...unpinned];
  }, [cards]);

  // Handle card expansion
  const handleExpand = useCallback((cardId: string) => {
    setExpandedCardId(cardId);
  }, []);

  const handleCloseExpanded = useCallback(() => {
    setExpandedCardId(null);
  }, []);

  // Handle card highlight
  const handleCardMouseEnter = useCallback((card: SmartCard) => {
    const sourceMessageId = card.aiContext?.sourceMessageId;
    highlightFromCard(card.id, sourceMessageId ?? null);
  }, [highlightFromCard]);

  // Close expanded on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedCardId) {
        setExpandedCardId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedCardId]);

  return (
    <div className={`relative h-full w-full bg-slate-50 dark:bg-slate-900 ${className}`}>
      {/* Grid background with pulse */}
      <div
        className="absolute inset-0 animate-grid-pulse"
        style={{
          backgroundImage: `
            linear-gradient(rgba(100, 116, 139, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100, 116, 139, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content - pb-20 gives space for floating AgentFlowPanel */}
      <div className="relative h-full overflow-auto p-6 pb-20">
        {cards.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridAutoRows: 'minmax(120px, auto)',
              gridAutoFlow: 'dense',
            }}
          >
            <AnimatePresence mode="popLayout">
              {sortedCards.map((card) => (
                <SmartCardWrapper
                  key={card.id}
                  card={card}
                  isPinned={card.pinned}
                  isHighlighted={isCardHighlighted(card.id)}
                  isExpanded={expandedCardId === card.id}
                  onPin={onCardPin ? () => onCardPin(card.id) : undefined}
                  onRemove={() => onCardRemove(card.id)}
                  onExpand={() => handleExpand(card.id)}
                  onAction={onCardAction}
                  onMouseEnter={() => handleCardMouseEnter(card)}
                  onMouseLeave={clearHighlight}
                  pollingContext={pollingContext}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Floating toolbar */}
      <FloatingToolbar
        cardCount={cards.length}
        pinnedCount={pinnedCount}
        onClearUnpinned={onClearUnpinned}
      />

      {/* Expanded card modal */}
      <AnimatePresence>
        {expandedCard && (
          <ExpandedSmartCardModal
            card={expandedCard}
            onClose={handleCloseExpanded}
            onRemove={() => {
              onCardRemove(expandedCard.id);
              handleCloseExpanded();
            }}
            onPin={onCardPin ? () => onCardPin(expandedCard.id) : undefined}
            onAction={onCardAction}
            pollingContext={pollingContext}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

MasonryCanvas.displayName = 'MasonryCanvas';

export default MasonryCanvas;
