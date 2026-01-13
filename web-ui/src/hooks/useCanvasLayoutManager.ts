'use client';

/**
 * useCanvasLayoutManager - Centralized hook for managing canvas card layouts
 *
 * This hook is the SINGLE SOURCE OF TRUTH for all card layout operations.
 * All card additions (from templates, AI, manual picker) should go through this hook
 * to ensure:
 * 1. Non-overlapping positions
 * 2. Proper context (networkId, orgId) embedded in card.config
 * 3. Consistent layout format
 */

import { useCallback, useMemo } from 'react';
import type { CanvasCard, CanvasCardLayout } from '@/types/session';
import {
  CardContext,
  findNextAvailablePosition,
  validateLayouts,
  resolveCollisions,
  ensureValidLayout,
  ensureCardContext,
  prepareCardForAddition,
  prepareCardsForAddition,
  GRID_COLS,
  DEFAULT_CARD_WIDTH,
  DEFAULT_CARD_HEIGHT,
} from '@/utils/canvas-layout';

// ============================================================================
// Types
// ============================================================================

export interface LayoutManagerReturn {
  /**
   * Prepare a single card for addition to the canvas.
   * Ensures valid layout and embeds context.
   */
  prepareCard: (card: CanvasCard) => CanvasCard;

  /**
   * Prepare multiple cards (e.g., from templates) for addition.
   * Resolves collisions among the new cards and with existing cards.
   */
  prepareCards: (cards: CanvasCard[]) => CanvasCard[];

  /**
   * Find the next available position for a card of given size.
   */
  findPosition: (width?: number, height?: number) => { x: number; y: number };

  /**
   * Validate that all cards have non-overlapping layouts.
   */
  validate: () => { valid: boolean; collisions: [string, string][] };

  /**
   * Resolve any collisions in current cards (returns new array, doesn't mutate).
   */
  fixCollisions: () => CanvasCard[];

  /**
   * Check if a card would overlap with existing cards at its current layout.
   */
  wouldOverlap: (card: CanvasCard) => boolean;
}

export interface UseCanvasLayoutManagerOptions {
  /** Current cards on the canvas */
  existingCards: CanvasCard[];
  /** Current context to embed in new cards */
  context: CardContext;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCanvasLayoutManager({
  existingCards,
  context,
}: UseCanvasLayoutManagerOptions): LayoutManagerReturn {
  /**
   * Prepare a single card for addition.
   */
  const prepareCard = useCallback(
    (card: CanvasCard): CanvasCard => {
      return prepareCardForAddition(card, existingCards, context);
    },
    [existingCards, context]
  );

  /**
   * Prepare multiple cards for addition.
   */
  const prepareCards = useCallback(
    (cards: CanvasCard[]): CanvasCard[] => {
      return prepareCardsForAddition(cards, existingCards, context);
    },
    [existingCards, context]
  );

  /**
   * Find next available position.
   */
  const findPosition = useCallback(
    (width: number = DEFAULT_CARD_WIDTH, height: number = DEFAULT_CARD_HEIGHT) => {
      return findNextAvailablePosition(existingCards, width, height);
    },
    [existingCards]
  );

  /**
   * Validate current layouts.
   */
  const validate = useCallback(() => {
    return validateLayouts(existingCards);
  }, [existingCards]);

  /**
   * Fix any collisions in current cards.
   */
  const fixCollisions = useCallback(() => {
    return resolveCollisions(existingCards);
  }, [existingCards]);

  /**
   * Check if a card would overlap with existing cards.
   */
  const wouldOverlap = useCallback(
    (card: CanvasCard): boolean => {
      const prepared = ensureValidLayout(card, existingCards);
      // If the layout changed, it means the original would have overlapped
      return (
        prepared.layout?.x !== card.layout?.x ||
        prepared.layout?.y !== card.layout?.y
      );
    },
    [existingCards]
  );

  return useMemo(
    () => ({
      prepareCard,
      prepareCards,
      findPosition,
      validate,
      fixCollisions,
      wouldOverlap,
    }),
    [prepareCard, prepareCards, findPosition, validate, fixCollisions, wouldOverlap]
  );
}

// Re-export types and constants for convenience
export { GRID_COLS, DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT };
export type { CardContext };

export default useCanvasLayoutManager;
