/**
 * Canvas Layout Utilities
 *
 * Pure functions for calculating card layouts on a 12-column grid.
 * These functions are the single source of truth for all layout calculations.
 */

import type { CanvasCard, CanvasCardLayout } from '@/types/session';

// ============================================================================
// Constants
// ============================================================================

export const GRID_COLS = 12;
export const DEFAULT_CARD_WIDTH = 4;
export const DEFAULT_CARD_HEIGHT = 3;
export const DEFAULT_MIN_W = 2;
export const DEFAULT_MIN_H = 2;

/**
 * Default sizes for different card types.
 * Cards that visualize more data get larger default sizes.
 */
export const CARD_TYPE_SIZES: Record<string, { w: number; h: number }> = {
  // Large cards (complex visualizations)
  'topology': { w: 8, h: 5 },
  'datasheet-comparison': { w: 8, h: 5 },
  'alert-timeline': { w: 8, h: 3 },
  'performance-chart': { w: 8, h: 4 },
  'traffic-heatmap': { w: 8, h: 4 },
  'path-analysis': { w: 12, h: 3 },

  // Medium cards (tables, lists)
  'device-table': { w: 6, h: 4 },
  'client-list': { w: 6, h: 4 },
  'knowledge-sources': { w: 6, h: 4 },
  'incident-tracker': { w: 6, h: 4 },
  'security-events': { w: 6, h: 4 },
  'splunk-search-results': { w: 6, h: 4 },
  'switch-ports': { w: 6, h: 4 },

  // Standard cards (dashboards, status)
  'network-health': { w: 4, h: 3 },
  'device-detail': { w: 4, h: 4 },
  'device-status': { w: 4, h: 3 },
  'alert-summary': { w: 4, h: 3 },
  'product-detail': { w: 4, h: 4 },
  'rf-analysis': { w: 4, h: 4 },
  'ai-stats-grid': { w: 4, h: 3 },
  'ai-breakdown': { w: 4, h: 4 },
  'ai-device-summary': { w: 4, h: 4 },

  // Compact cards (single metrics, gauges)
  'ai-metric': { w: 3, h: 2 },
  'ai-gauge': { w: 3, h: 3 },
  'ai-finding': { w: 4, h: 3 },
  'bandwidth-utilization': { w: 3, h: 3 },
  'latency-monitor': { w: 3, h: 3 },
  'packet-loss': { w: 3, h: 2 },
  'cpu-memory-health': { w: 3, h: 3 },
  'uptime-tracker': { w: 3, h: 2 },
  'uplink-status': { w: 3, h: 3 },
};

/**
 * Get the default size for a card type.
 */
export function getCardDefaultSize(cardType: string): { w: number; h: number } {
  return CARD_TYPE_SIZES[cardType] || { w: DEFAULT_CARD_WIDTH, h: DEFAULT_CARD_HEIGHT };
}

// ============================================================================
// Types
// ============================================================================

export interface CardContext {
  networkId?: string;
  orgId?: string;
  deviceSerial?: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

// ============================================================================
// Core Layout Functions
// ============================================================================

/**
 * Build a Set of occupied grid cells from existing cards.
 * Each cell is represented as "x,y" string.
 */
export function buildOccupancyGrid(cards: CanvasCard[]): Set<string> {
  const occupied = new Set<string>();

  for (const card of cards) {
    const layout = card.layout;
    if (!layout) continue;

    const x = layout.x ?? 0;
    const y = layout.y ?? 0;
    const w = layout.w ?? DEFAULT_CARD_WIDTH;
    const h = layout.h ?? DEFAULT_CARD_HEIGHT;

    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        occupied.add(`${x + dx},${y + dy}`);
      }
    }
  }

  return occupied;
}

/**
 * Get the maximum Y coordinate (bottom edge) of all cards.
 */
export function getMaxY(cards: CanvasCard[]): number {
  let maxY = 0;

  for (const card of cards) {
    const layout = card.layout;
    if (!layout) continue;

    const y = layout.y ?? 0;
    const h = layout.h ?? DEFAULT_CARD_HEIGHT;
    maxY = Math.max(maxY, y + h);
  }

  return maxY;
}

/**
 * Check if a card of given size can fit at a specific position.
 */
export function canFitAt(
  occupied: Set<string>,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  // Check bounds
  if (x < 0 || y < 0 || x + w > GRID_COLS) {
    return false;
  }

  // Check each cell
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      if (occupied.has(`${x + dx},${y + dy}`)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Find the next available position for a card of given size.
 * Scans row by row, left to right, looking for a gap that fits.
 */
export function findNextAvailablePosition(
  existingCards: CanvasCard[],
  cardWidth: number = DEFAULT_CARD_WIDTH,
  cardHeight: number = DEFAULT_CARD_HEIGHT
): Position {
  // Empty grid - start at origin
  if (existingCards.length === 0) {
    return { x: 0, y: 0 };
  }

  const occupied = buildOccupancyGrid(existingCards);
  const maxY = getMaxY(existingCards);

  // Scan for first available position
  // Search up to maxY + cardHeight to ensure we can place below existing cards
  for (let y = 0; y <= maxY + cardHeight; y++) {
    for (let x = 0; x <= GRID_COLS - cardWidth; x++) {
      if (canFitAt(occupied, x, y, cardWidth, cardHeight)) {
        return { x, y };
      }
    }
  }

  // Absolute fallback: place below all existing cards
  return { x: 0, y: maxY };
}

/**
 * Check if two cards overlap.
 */
export function cardsOverlap(
  card1: CanvasCard,
  card2: CanvasCard
): boolean {
  const l1 = card1.layout || { x: 0, y: 0, w: DEFAULT_CARD_WIDTH, h: DEFAULT_CARD_HEIGHT };
  const l2 = card2.layout || { x: 0, y: 0, w: DEFAULT_CARD_WIDTH, h: DEFAULT_CARD_HEIGHT };

  const x1 = l1.x ?? 0;
  const y1 = l1.y ?? 0;
  const w1 = l1.w ?? DEFAULT_CARD_WIDTH;
  const h1 = l1.h ?? DEFAULT_CARD_HEIGHT;

  const x2 = l2.x ?? 0;
  const y2 = l2.y ?? 0;
  const w2 = l2.w ?? DEFAULT_CARD_WIDTH;
  const h2 = l2.h ?? DEFAULT_CARD_HEIGHT;

  // Check for overlap using rectangle intersection
  return !(
    x1 + w1 <= x2 ||  // card1 is left of card2
    x2 + w2 <= x1 ||  // card2 is left of card1
    y1 + h1 <= y2 ||  // card1 is above card2
    y2 + h2 <= y1     // card2 is above card1
  );
}

/**
 * Detect all collisions in a set of cards.
 * Returns array of [cardId1, cardId2] pairs that overlap.
 */
export function detectCollisions(cards: CanvasCard[]): [string, string][] {
  const collisions: [string, string][] = [];

  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cardsOverlap(cards[i], cards[j])) {
        collisions.push([cards[i].id, cards[j].id]);
      }
    }
  }

  return collisions;
}

/**
 * Validate that all cards have non-overlapping layouts.
 */
export function validateLayouts(cards: CanvasCard[]): {
  valid: boolean;
  collisions: [string, string][];
} {
  const collisions = detectCollisions(cards);
  return {
    valid: collisions.length === 0,
    collisions,
  };
}

/**
 * Resolve collisions by moving overlapping cards to new positions.
 * Cards that don't overlap with any previously-placed cards keep their positions.
 * Only cards that would overlap get new positions assigned.
 */
export function resolveCollisions(cards: CanvasCard[]): CanvasCard[] {
  if (cards.length === 0) return [];

  const result: CanvasCard[] = [];

  for (const card of cards) {
    const cardWidth = card.layout?.w ?? DEFAULT_CARD_WIDTH;
    const cardHeight = card.layout?.h ?? DEFAULT_CARD_HEIGHT;

    // Check if card has a valid layout
    const hasValidLayout = card.layout &&
      typeof card.layout.x === 'number' &&
      typeof card.layout.y === 'number' &&
      card.layout.x >= 0 &&
      card.layout.y >= 0;

    let x: number;
    let y: number;

    if (hasValidLayout) {
      // Check if this card would overlap with any already-placed card
      const wouldOverlap = result.some(existing => cardsOverlap(card, existing));

      if (!wouldOverlap) {
        // Keep existing position - no collision
        x = card.layout!.x;
        y = card.layout!.y;
      } else {
        // Card overlaps - find new position
        const position = findNextAvailablePosition(result, cardWidth, cardHeight);
        x = position.x;
        y = position.y;
        console.log('[resolveCollisions] Moved overlapping card:', card.id, 'from', card.layout, 'to', { x, y });
      }
    } else {
      // No valid layout - find a position
      const position = findNextAvailablePosition(result, cardWidth, cardHeight);
      x = position.x;
      y = position.y;
    }

    result.push({
      ...card,
      layout: {
        x,
        y,
        w: cardWidth,
        h: cardHeight,
        minW: card.layout?.minW ?? DEFAULT_MIN_W,
        minH: card.layout?.minH ?? DEFAULT_MIN_H,
      },
    });
  }

  return result;
}

/**
 * Ensure a card has a valid, non-overlapping layout.
 * If the card has no layout or its layout overlaps, assign a new position.
 */
export function ensureValidLayout(
  card: CanvasCard,
  existingCards: CanvasCard[]
): CanvasCard {
  const cardWidth = card.layout?.w ?? DEFAULT_CARD_WIDTH;
  const cardHeight = card.layout?.h ?? DEFAULT_CARD_HEIGHT;

  // Check if card has a valid layout
  const hasLayout = card.layout &&
    typeof card.layout.x === 'number' &&
    typeof card.layout.y === 'number' &&
    card.layout.x >= 0 &&
    card.layout.y >= 0;

  if (hasLayout) {
    // Check if it overlaps with any existing card
    const wouldOverlap = existingCards.some(existing => cardsOverlap(card, existing));

    if (!wouldOverlap) {
      // Layout is valid and doesn't overlap - keep it
      return card;
    }
  }

  // Need to assign a new position
  const position = findNextAvailablePosition(existingCards, cardWidth, cardHeight);

  return {
    ...card,
    layout: {
      x: position.x,
      y: position.y,
      w: cardWidth,
      h: cardHeight,
      minW: card.layout?.minW ?? DEFAULT_MIN_W,
      minH: card.layout?.minH ?? DEFAULT_MIN_H,
    },
  };
}

/**
 * Ensure a card has context (networkId, orgId) embedded in its config.
 */
export function ensureCardContext(
  card: CanvasCard,
  context: CardContext
): CanvasCard {
  const needsNetworkId = !card.config?.networkId && context.networkId;
  const needsOrgId = !card.config?.orgId && context.orgId;
  const needsDeviceSerial = !card.config?.deviceSerial && context.deviceSerial;

  if (!needsNetworkId && !needsOrgId && !needsDeviceSerial) {
    return card; // Already has all available context
  }

  return {
    ...card,
    config: {
      ...card.config,
      ...(needsNetworkId && { networkId: context.networkId }),
      ...(needsOrgId && { orgId: context.orgId }),
      ...(needsDeviceSerial && { deviceSerial: context.deviceSerial }),
    },
  };
}

/**
 * Prepare a single card for addition to the canvas.
 * Ensures valid layout and embeds context.
 */
export function prepareCardForAddition(
  card: CanvasCard,
  existingCards: CanvasCard[],
  context: CardContext
): CanvasCard {
  const withLayout = ensureValidLayout(card, existingCards);
  const withContext = ensureCardContext(withLayout, context);
  return withContext;
}

/**
 * Prepare multiple cards for addition to the canvas.
 * Resolves collisions among the new cards and with existing cards.
 */
export function prepareCardsForAddition(
  newCards: CanvasCard[],
  existingCards: CanvasCard[],
  context: CardContext
): CanvasCard[] {
  // Start with existing cards as the base
  let allCards = [...existingCards];
  const preparedCards: CanvasCard[] = [];

  for (const card of newCards) {
    const prepared = prepareCardForAddition(card, allCards, context);
    preparedCards.push(prepared);
    allCards.push(prepared); // Add to "existing" for next iteration
  }

  return preparedCards;
}

// ============================================================================
// Smart Layout Functions
// ============================================================================

/**
 * Find a position for a card near related cards (same network or topic).
 * This creates visual grouping of related cards.
 */
export function findPositionNearRelated(
  existingCards: CanvasCard[],
  newCard: CanvasCard,
  cardWidth: number = DEFAULT_CARD_WIDTH,
  cardHeight: number = DEFAULT_CARD_HEIGHT
): Position {
  // Find cards with matching context
  const relatedCards = existingCards.filter(card => {
    if (newCard.config?.networkId && card.config?.networkId === newCard.config.networkId) {
      return true;
    }
    if (newCard.config?.orgId && card.config?.orgId === newCard.config.orgId) {
      return true;
    }
    return false;
  });

  if (relatedCards.length === 0) {
    // No related cards - use standard placement
    return findNextAvailablePosition(existingCards, cardWidth, cardHeight);
  }

  // Find the bounding box of related cards
  let minX = GRID_COLS;
  let maxX = 0;
  let maxY = 0;

  for (const card of relatedCards) {
    const layout = card.layout;
    if (!layout) continue;

    const x = layout.x ?? 0;
    const y = layout.y ?? 0;
    const w = layout.w ?? DEFAULT_CARD_WIDTH;
    const h = layout.h ?? DEFAULT_CARD_HEIGHT;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  // Try to place next to or below the related cards
  const occupied = buildOccupancyGrid(existingCards);

  // Try to place to the right of related cards first
  if (maxX + cardWidth <= GRID_COLS) {
    for (let y = 0; y <= maxY + cardHeight; y++) {
      if (canFitAt(occupied, maxX, y, cardWidth, cardHeight)) {
        return { x: maxX, y };
      }
    }
  }

  // Try to place below related cards
  for (let x = minX; x <= GRID_COLS - cardWidth; x++) {
    if (canFitAt(occupied, x, maxY, cardWidth, cardHeight)) {
      return { x, y: maxY };
    }
  }

  // Fallback to standard placement
  return findNextAvailablePosition(existingCards, cardWidth, cardHeight);
}

/**
 * Get the default size for a card based on its type.
 * Used when preparing cards for addition.
 */
export function getSmartCardSize(card: CanvasCard): { w: number; h: number } {
  // Use explicit layout if provided
  if (card.layout?.w && card.layout?.h) {
    return { w: card.layout.w, h: card.layout.h };
  }

  // Get default size for card type
  return getCardDefaultSize(card.type);
}

/**
 * Organize canvas cards by grouping related cards together.
 * Groups cards by network/org context and arranges them in rows.
 */
export function organizeCanvas(cards: CanvasCard[]): CanvasCard[] {
  if (cards.length === 0) return [];

  // Group cards by context
  const groups: Map<string, CanvasCard[]> = new Map();
  const ungrouped: CanvasCard[] = [];

  for (const card of cards) {
    const networkId = card.config?.networkId;
    const orgId = card.config?.orgId;

    if (networkId) {
      const key = `network:${networkId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(card);
    } else if (orgId) {
      const key = `org:${orgId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(card);
    } else {
      ungrouped.push(card);
    }
  }

  // Arrange cards in order: grouped cards first, then ungrouped
  const result: CanvasCard[] = [];
  let currentY = 0;

  // Process each group
  for (const [groupKey, groupCards] of groups) {
    // Sort cards within group by type priority (larger first for better layout)
    const sorted = [...groupCards].sort((a, b) => {
      const sizeA = getCardDefaultSize(a.type);
      const sizeB = getCardDefaultSize(b.type);
      return (sizeB.w * sizeB.h) - (sizeA.w * sizeA.h);
    });

    // Place cards in this group
    let currentX = 0;
    let rowMaxH = 0;

    for (const card of sorted) {
      const size = getSmartCardSize(card);

      // Check if card fits on current row
      if (currentX + size.w > GRID_COLS) {
        // Move to next row
        currentY += rowMaxH;
        currentX = 0;
        rowMaxH = 0;
      }

      result.push({
        ...card,
        layout: {
          x: currentX,
          y: currentY,
          w: size.w,
          h: size.h,
          minW: card.layout?.minW ?? DEFAULT_MIN_W,
          minH: card.layout?.minH ?? DEFAULT_MIN_H,
        },
      });

      currentX += size.w;
      rowMaxH = Math.max(rowMaxH, size.h);
    }

    // Move to next row after each group
    currentY += rowMaxH;
  }

  // Add ungrouped cards at the end
  if (ungrouped.length > 0) {
    let currentX = 0;
    let rowMaxH = 0;

    for (const card of ungrouped) {
      const size = getSmartCardSize(card);

      if (currentX + size.w > GRID_COLS) {
        currentY += rowMaxH;
        currentX = 0;
        rowMaxH = 0;
      }

      result.push({
        ...card,
        layout: {
          x: currentX,
          y: currentY,
          w: size.w,
          h: size.h,
          minW: card.layout?.minW ?? DEFAULT_MIN_W,
          minH: card.layout?.minH ?? DEFAULT_MIN_H,
        },
      });

      currentX += size.w;
      rowMaxH = Math.max(rowMaxH, size.h);
    }
  }

  return result;
}

/**
 * Prepare a card for addition with smart sizing based on card type.
 */
export function prepareCardWithSmartSize(
  card: CanvasCard,
  existingCards: CanvasCard[],
  context: CardContext
): CanvasCard {
  // Get smart size for this card type
  const size = getSmartCardSize(card);

  // Find position considering related cards
  const position = findPositionNearRelated(existingCards, card, size.w, size.h);

  // Build card with layout and context
  return {
    ...card,
    layout: {
      x: position.x,
      y: position.y,
      w: size.w,
      h: size.h,
      minW: card.layout?.minW ?? DEFAULT_MIN_W,
      minH: card.layout?.minH ?? DEFAULT_MIN_H,
    },
    config: {
      ...card.config,
      ...(context.networkId && !card.config?.networkId && { networkId: context.networkId }),
      ...(context.orgId && !card.config?.orgId && { orgId: context.orgId }),
      ...(context.deviceSerial && !card.config?.deviceSerial && { deviceSerial: context.deviceSerial }),
    },
  };
}
