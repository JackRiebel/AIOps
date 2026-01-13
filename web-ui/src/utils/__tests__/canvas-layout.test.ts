import { describe, it, expect } from 'vitest';
import {
  GRID_COLS,
  DEFAULT_CARD_WIDTH,
  DEFAULT_CARD_HEIGHT,
  buildOccupancyGrid,
  getMaxY,
  canFitAt,
  findNextAvailablePosition,
  cardsOverlap,
  detectCollisions,
  validateLayouts,
  resolveCollisions,
  ensureValidLayout,
  ensureCardContext,
  prepareCardForAddition,
  prepareCardsForAddition,
} from '../canvas-layout';
import type { CanvasCard, CanvasCardLayout } from '@/types/session';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestCard(
  id: string,
  layout?: { x: number; y: number; w?: number; h?: number },
  config?: Record<string, unknown>
): CanvasCard {
  const cardLayout: CanvasCardLayout | undefined = layout ? {
    x: layout.x,
    y: layout.y,
    w: layout.w ?? DEFAULT_CARD_WIDTH,
    h: layout.h ?? DEFAULT_CARD_HEIGHT,
  } : undefined;

  return {
    id,
    type: 'network-health' as const, // Use a valid CanvasCardType
    title: `Test Card ${id}`,
    data: {},
    layout: cardLayout as CanvasCardLayout, // Cast to satisfy type
    config,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      costUsd: 0,
      isLive: false,
    },
  };
}

// ============================================================================
// Tests: buildOccupancyGrid
// ============================================================================

describe('buildOccupancyGrid', () => {
  it('returns empty set for no cards', () => {
    const grid = buildOccupancyGrid([]);
    expect(grid.size).toBe(0);
  });

  it('marks all cells for a single card', () => {
    const cards = [createTestCard('1', { x: 0, y: 0, w: 2, h: 2 })];
    const grid = buildOccupancyGrid(cards);

    expect(grid.has('0,0')).toBe(true);
    expect(grid.has('1,0')).toBe(true);
    expect(grid.has('0,1')).toBe(true);
    expect(grid.has('1,1')).toBe(true);
    expect(grid.has('2,0')).toBe(false);
    expect(grid.size).toBe(4);
  });

  it('combines cells from multiple cards', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 2, h: 1 }),
      createTestCard('2', { x: 4, y: 0, w: 2, h: 1 }),
    ];
    const grid = buildOccupancyGrid(cards);

    expect(grid.has('0,0')).toBe(true);
    expect(grid.has('1,0')).toBe(true);
    expect(grid.has('2,0')).toBe(false);
    expect(grid.has('3,0')).toBe(false);
    expect(grid.has('4,0')).toBe(true);
    expect(grid.has('5,0')).toBe(true);
    expect(grid.size).toBe(4);
  });
});

// ============================================================================
// Tests: getMaxY
// ============================================================================

describe('getMaxY', () => {
  it('returns 0 for no cards', () => {
    expect(getMaxY([])).toBe(0);
  });

  it('returns bottom edge of single card', () => {
    const cards = [createTestCard('1', { x: 0, y: 0, w: 4, h: 3 })];
    expect(getMaxY(cards)).toBe(3);
  });

  it('returns maximum bottom edge across multiple cards', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 4, h: 3 }),
      createTestCard('2', { x: 4, y: 2, w: 4, h: 5 }),
    ];
    expect(getMaxY(cards)).toBe(7); // Card 2 ends at y=2+5=7
  });
});

// ============================================================================
// Tests: canFitAt
// ============================================================================

describe('canFitAt', () => {
  it('returns true for empty grid', () => {
    const occupied = new Set<string>();
    expect(canFitAt(occupied, 0, 0, 4, 3)).toBe(true);
  });

  it('returns false if position would exceed grid width', () => {
    const occupied = new Set<string>();
    expect(canFitAt(occupied, 10, 0, 4, 3)).toBe(false); // 10 + 4 = 14 > 12
    expect(canFitAt(occupied, 9, 0, 4, 3)).toBe(false); // 9 + 4 = 13 > 12
    expect(canFitAt(occupied, 8, 0, 4, 3)).toBe(true);  // 8 + 4 = 12 <= 12
  });

  it('returns false if position overlaps occupied cells', () => {
    const occupied = new Set(['2,0', '3,0']);
    expect(canFitAt(occupied, 0, 0, 4, 1)).toBe(false); // Would overlap at 2,0 and 3,0
    expect(canFitAt(occupied, 4, 0, 4, 1)).toBe(true);  // No overlap
  });

  it('returns false for negative positions', () => {
    const occupied = new Set<string>();
    expect(canFitAt(occupied, -1, 0, 4, 3)).toBe(false);
    expect(canFitAt(occupied, 0, -1, 4, 3)).toBe(false);
  });
});

// ============================================================================
// Tests: findNextAvailablePosition
// ============================================================================

describe('findNextAvailablePosition', () => {
  it('places first card at 0,0', () => {
    const position = findNextAvailablePosition([]);
    expect(position).toEqual({ x: 0, y: 0 });
  });

  it('places second card to the right of first (same row)', () => {
    const cards = [createTestCard('1', { x: 0, y: 0, w: 4, h: 3 })];
    const position = findNextAvailablePosition(cards, 4, 3);
    expect(position).toEqual({ x: 4, y: 0 });
  });

  it('wraps to next row when row is full', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 4, h: 3 }),
      createTestCard('2', { x: 4, y: 0, w: 4, h: 3 }),
      createTestCard('3', { x: 8, y: 0, w: 4, h: 3 }),
    ];
    const position = findNextAvailablePosition(cards, 4, 3);
    expect(position).toEqual({ x: 0, y: 3 });
  });

  it('finds gaps between cards', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 4, h: 3 }),
      createTestCard('2', { x: 8, y: 0, w: 4, h: 3 }), // Gap at x=4
    ];
    const position = findNextAvailablePosition(cards, 4, 3);
    expect(position).toEqual({ x: 4, y: 0 }); // Should find the gap
  });

  it('handles cards of different sizes', () => {
    const cards = [createTestCard('1', { x: 0, y: 0, w: 6, h: 4 })];

    // Small card should fit next to wide card
    const smallPos = findNextAvailablePosition(cards, 4, 3);
    expect(smallPos).toEqual({ x: 6, y: 0 });

    // Large card won't fit next to wide card, goes below
    const largePos = findNextAvailablePosition(cards, 8, 3);
    expect(largePos).toEqual({ x: 0, y: 4 });
  });

  it('never returns overlapping positions', () => {
    // Create a complex layout with various gaps
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 3, h: 2 }),
      createTestCard('2', { x: 5, y: 0, w: 3, h: 3 }),
      createTestCard('3', { x: 9, y: 1, w: 3, h: 2 }),
      createTestCard('4', { x: 0, y: 3, w: 6, h: 2 }),
    ];

    // Add 10 more cards and verify none overlap
    let currentCards = [...cards];
    for (let i = 0; i < 10; i++) {
      const pos = findNextAvailablePosition(currentCards, 4, 3);
      const newCard = createTestCard(`new-${i}`, { x: pos.x, y: pos.y, w: 4, h: 3 });

      // Verify no overlap with existing cards
      for (const existing of currentCards) {
        expect(cardsOverlap(newCard, existing)).toBe(false);
      }

      currentCards.push(newCard);
    }
  });
});

// ============================================================================
// Tests: cardsOverlap
// ============================================================================

describe('cardsOverlap', () => {
  it('returns false for non-overlapping cards', () => {
    const card1 = createTestCard('1', { x: 0, y: 0, w: 4, h: 3 });
    const card2 = createTestCard('2', { x: 4, y: 0, w: 4, h: 3 });
    expect(cardsOverlap(card1, card2)).toBe(false);
  });

  it('returns true for overlapping cards', () => {
    const card1 = createTestCard('1', { x: 0, y: 0, w: 4, h: 3 });
    const card2 = createTestCard('2', { x: 2, y: 1, w: 4, h: 3 }); // Overlaps
    expect(cardsOverlap(card1, card2)).toBe(true);
  });

  it('returns true for identical positions', () => {
    const card1 = createTestCard('1', { x: 0, y: 0, w: 4, h: 3 });
    const card2 = createTestCard('2', { x: 0, y: 0, w: 4, h: 3 });
    expect(cardsOverlap(card1, card2)).toBe(true);
  });

  it('returns false for adjacent cards (sharing edge)', () => {
    const card1 = createTestCard('1', { x: 0, y: 0, w: 4, h: 3 });
    const card2 = createTestCard('2', { x: 4, y: 0, w: 4, h: 3 }); // Right edge
    const card3 = createTestCard('3', { x: 0, y: 3, w: 4, h: 3 }); // Bottom edge

    expect(cardsOverlap(card1, card2)).toBe(false);
    expect(cardsOverlap(card1, card3)).toBe(false);
  });
});

// ============================================================================
// Tests: detectCollisions
// ============================================================================

describe('detectCollisions', () => {
  it('returns empty array for no cards', () => {
    expect(detectCollisions([])).toEqual([]);
  });

  it('returns empty array for non-overlapping cards', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 4, h: 3 }),
      createTestCard('2', { x: 4, y: 0, w: 4, h: 3 }),
      createTestCard('3', { x: 8, y: 0, w: 4, h: 3 }),
    ];
    expect(detectCollisions(cards)).toEqual([]);
  });

  it('detects single collision', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 4, h: 3 }),
      createTestCard('2', { x: 2, y: 1, w: 4, h: 3 }), // Overlaps with 1
    ];
    const collisions = detectCollisions(cards);
    expect(collisions).toEqual([['1', '2']]);
  });

  it('detects multiple collisions', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 6, h: 3 }),
      createTestCard('2', { x: 2, y: 0, w: 6, h: 3 }), // Overlaps with 1
      createTestCard('3', { x: 4, y: 0, w: 6, h: 3 }), // Overlaps with 1 and 2
    ];
    const collisions = detectCollisions(cards);
    expect(collisions).toHaveLength(3);
    expect(collisions).toContainEqual(['1', '2']);
    expect(collisions).toContainEqual(['1', '3']);
    expect(collisions).toContainEqual(['2', '3']);
  });
});

// ============================================================================
// Tests: validateLayouts
// ============================================================================

describe('validateLayouts', () => {
  it('returns valid=true for non-overlapping cards', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 4, h: 3 }),
      createTestCard('2', { x: 4, y: 0, w: 4, h: 3 }),
    ];
    const result = validateLayouts(cards);
    expect(result.valid).toBe(true);
    expect(result.collisions).toEqual([]);
  });

  it('returns valid=false for overlapping cards', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 4, h: 3 }),
      createTestCard('2', { x: 0, y: 0, w: 4, h: 3 }), // Same position
    ];
    const result = validateLayouts(cards);
    expect(result.valid).toBe(false);
    expect(result.collisions).toEqual([['1', '2']]);
  });
});

// ============================================================================
// Tests: resolveCollisions
// ============================================================================

describe('resolveCollisions', () => {
  it('returns empty array for no cards', () => {
    expect(resolveCollisions([])).toEqual([]);
  });

  it('preserves layout for single card', () => {
    const cards = [createTestCard('1', { x: 4, y: 2, w: 4, h: 3 })];
    const result = resolveCollisions(cards);

    // Single card with valid layout should keep its position (no collisions to resolve)
    expect(result[0].layout?.x).toBe(4);
    expect(result[0].layout?.y).toBe(2);
    expect(result[0].layout?.w).toBe(4);
    expect(result[0].layout?.h).toBe(3);
  });

  it('moves overlapping cards to new positions', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 4, h: 3 }),
      createTestCard('2', { x: 0, y: 0, w: 4, h: 3 }), // Same position
      createTestCard('3', { x: 0, y: 0, w: 4, h: 3 }), // Same position
    ];
    const result = resolveCollisions(cards);

    // All cards should have non-overlapping positions
    const validation = validateLayouts(result);
    expect(validation.valid).toBe(true);

    // Verify they're placed correctly
    expect(result[0].layout?.x).toBe(0);
    expect(result[0].layout?.y).toBe(0);
    expect(result[1].layout?.x).toBe(4);
    expect(result[1].layout?.y).toBe(0);
    expect(result[2].layout?.x).toBe(8);
    expect(result[2].layout?.y).toBe(0);
  });

  it('preserves card sizes', () => {
    const cards = [
      createTestCard('1', { x: 0, y: 0, w: 6, h: 4 }),
      createTestCard('2', { x: 0, y: 0, w: 3, h: 2 }),
    ];
    const result = resolveCollisions(cards);

    expect(result[0].layout?.w).toBe(6);
    expect(result[0].layout?.h).toBe(4);
    expect(result[1].layout?.w).toBe(3);
    expect(result[1].layout?.h).toBe(2);
  });
});

// ============================================================================
// Tests: ensureValidLayout
// ============================================================================

describe('ensureValidLayout', () => {
  it('preserves valid non-overlapping layout', () => {
    const existingCards = [createTestCard('1', { x: 0, y: 0, w: 4, h: 3 })];
    const newCard = createTestCard('2', { x: 4, y: 0, w: 4, h: 3 });

    const result = ensureValidLayout(newCard, existingCards);
    expect(result.layout?.x).toBe(4);
    expect(result.layout?.y).toBe(0);
  });

  it('assigns new position for card with no layout', () => {
    const existingCards = [createTestCard('1', { x: 0, y: 0, w: 4, h: 3 })];
    const newCard = createTestCard('2'); // No layout

    const result = ensureValidLayout(newCard, existingCards);
    expect(result.layout?.x).toBe(4);
    expect(result.layout?.y).toBe(0);
  });

  it('assigns new position for overlapping card', () => {
    const existingCards = [createTestCard('1', { x: 0, y: 0, w: 4, h: 3 })];
    const newCard = createTestCard('2', { x: 0, y: 0, w: 4, h: 3 }); // Same position

    const result = ensureValidLayout(newCard, existingCards);
    expect(result.layout?.x).toBe(4); // Moved to non-overlapping position
    expect(result.layout?.y).toBe(0);
  });
});

// ============================================================================
// Tests: ensureCardContext
// ============================================================================

describe('ensureCardContext', () => {
  it('adds missing networkId', () => {
    const card = createTestCard('1', { x: 0, y: 0 });
    const result = ensureCardContext(card, { networkId: 'net-123' });

    expect(result.config?.networkId).toBe('net-123');
  });

  it('adds missing orgId', () => {
    const card = createTestCard('1', { x: 0, y: 0 });
    const result = ensureCardContext(card, { orgId: 'org-456' });

    expect(result.config?.orgId).toBe('org-456');
  });

  it('preserves existing context', () => {
    const card = createTestCard('1', { x: 0, y: 0 }, { networkId: 'original' });
    const result = ensureCardContext(card, { networkId: 'new' });

    expect(result.config?.networkId).toBe('original'); // Not overwritten
  });

  it('adds multiple context fields', () => {
    const card = createTestCard('1', { x: 0, y: 0 });
    const result = ensureCardContext(card, {
      networkId: 'net-123',
      orgId: 'org-456',
      deviceSerial: 'dev-789',
    });

    expect(result.config?.networkId).toBe('net-123');
    expect(result.config?.orgId).toBe('org-456');
    expect(result.config?.deviceSerial).toBe('dev-789');
  });

  it('returns same card if no context to add', () => {
    const card = createTestCard('1', { x: 0, y: 0 }, { networkId: 'existing' });
    const result = ensureCardContext(card, {}); // Empty context

    expect(result).toBe(card); // Same reference
  });
});

// ============================================================================
// Tests: prepareCardForAddition
// ============================================================================

describe('prepareCardForAddition', () => {
  it('assigns layout and context', () => {
    const existingCards = [createTestCard('1', { x: 0, y: 0, w: 4, h: 3 })];
    const newCard = createTestCard('2'); // No layout, no context

    const result = prepareCardForAddition(newCard, existingCards, {
      networkId: 'net-123',
      orgId: 'org-456',
    });

    expect(result.layout?.x).toBe(4);
    expect(result.layout?.y).toBe(0);
    expect(result.config?.networkId).toBe('net-123');
    expect(result.config?.orgId).toBe('org-456');
  });
});

// ============================================================================
// Tests: prepareCardsForAddition
// ============================================================================

describe('prepareCardsForAddition', () => {
  it('assigns non-overlapping layouts to all new cards', () => {
    const existingCards = [createTestCard('1', { x: 0, y: 0, w: 4, h: 3 })];
    const newCards = [
      createTestCard('2'), // No layout
      createTestCard('3'), // No layout
      createTestCard('4'), // No layout
    ];

    const result = prepareCardsForAddition(newCards, existingCards, {
      networkId: 'net-123',
    });

    // All cards should have valid, non-overlapping layouts
    const allCards = [...existingCards, ...result];
    const validation = validateLayouts(allCards);
    expect(validation.valid).toBe(true);

    // All should have context
    for (const card of result) {
      expect(card.config?.networkId).toBe('net-123');
    }
  });

  it('resolves collisions among template cards', () => {
    const existingCards: CanvasCard[] = [];
    const templateCards = [
      createTestCard('1', { x: 0, y: 0, w: 6, h: 4 }),
      createTestCard('2', { x: 6, y: 0, w: 6, h: 4 }),
      createTestCard('3', { x: 0, y: 4, w: 6, h: 4 }),
      createTestCard('4', { x: 6, y: 4, w: 6, h: 4 }),
    ];

    const result = prepareCardsForAddition(templateCards, existingCards, {});

    // All cards should be non-overlapping
    const validation = validateLayouts(result);
    expect(validation.valid).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('handles cards with undefined layout properties', () => {
    const card: CanvasCard = {
      id: 'test',
      type: 'network-health' as const,
      title: 'Test',
      data: {},
      layout: { x: undefined as unknown as number, y: 0, w: 4, h: 3 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        costUsd: 0,
        isLive: false,
      },
    };

    const result = ensureValidLayout(card, []);
    expect(result.layout?.x).toBe(0);
    expect(result.layout?.y).toBe(0);
  });

  it('handles large number of cards', () => {
    const cards: CanvasCard[] = [];

    // Add 50 cards
    for (let i = 0; i < 50; i++) {
      const pos = findNextAvailablePosition(cards, 4, 3);
      cards.push(createTestCard(`${i}`, { x: pos.x, y: pos.y, w: 4, h: 3 }));
    }

    // Verify no overlaps
    const validation = validateLayouts(cards);
    expect(validation.valid).toBe(true);
  });

  it('handles wide cards that span entire row', () => {
    const existingCards = [createTestCard('1', { x: 0, y: 0, w: 12, h: 3 })];
    const pos = findNextAvailablePosition(existingCards, 4, 3);

    expect(pos.y).toBe(3); // Should be placed below the full-width card
  });
});
