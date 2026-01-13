'use client';

import React, { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { GridLayout } from 'react-grid-layout';
import { GridBackground } from './GridBackground';
import { LiveCanvasCard } from './LiveCanvasCard';
import type { CanvasCard as CanvasCardType, CanvasCardLayout } from '@/types/session';

// Import react-grid-layout styles
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Define LayoutItem type explicitly (matches react-grid-layout's internal type)
interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}

// Type for GridLayout props (the @types package is outdated for v2.x)
interface GridLayoutProps {
  className?: string;
  layout?: readonly LayoutItem[];
  cols?: number;
  rowHeight?: number;
  width?: number;
  margin?: [number, number];
  containerPadding?: [number, number];
  onLayoutChange?: (layout: readonly LayoutItem[]) => void;
  isDraggable?: boolean;
  isResizable?: boolean;
  draggableHandle?: string;
  useCSSTransforms?: boolean;
  compactType?: 'vertical' | 'horizontal' | null;
  preventCollision?: boolean;
  resizeHandles?: Array<'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'>;
  children?: React.ReactNode;
}

/**
 * CanvasWorkspace - Drag-and-resize canvas for visualization cards
 *
 * Following "Show, Don't Tell" philosophy:
 * - Empty state shows just the grid (no instructions)
 * - Cards are draggable and resizable
 * - Layout changes are persisted to session
 */

// ============================================================================
// Types
// ============================================================================

/** Context passed when user wants to ask about a card */
export interface CardQueryContext {
  cardId: string;
  cardType: string;
  cardTitle: string;
  data: unknown;
  summary: string;
  /** Card config containing networkId, deviceSerial, organizationId for AI context */
  config?: Record<string, string>;
}

export interface CanvasWorkspaceProps {
  /** Canvas cards to display */
  cards: CanvasCardType[];
  /** Handler when layout changes */
  onLayoutChange?: (cardId: string, layout: CanvasCardLayout) => void;
  /** Handler when a card is removed */
  onCardRemove?: (cardId: string) => void;
  /** Handler when a card's lock state changes */
  onCardLockToggle?: (cardId: string, isLocked: boolean) => void;
  /** Handler when user clicks "Ask about this" on a card */
  onAskAboutCard?: (context: CardQueryContext) => void;
  /** Whether the workspace is disabled/loading */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children (e.g., overlays) */
  children?: React.ReactNode;
  /** Render function for card content (receives card, renders inside CanvasCard) */
  renderCardContent?: (card: CanvasCardType) => React.ReactNode;
  /** Context for card polling (template cards need this to fetch data) */
  pollingContext?: {
    orgId?: string;
    networkId?: string;
    deviceSerial?: string;
  };
  /** Whether edit mode is active - shows visual indicator for drag/resize */
  isEditMode?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// Grid configuration
const GRID_COLS = 12;
const GRID_ROW_HEIGHT = 80;
const GRID_MARGIN: [number, number] = [16, 16];
const GRID_CONTAINER_PADDING: [number, number] = [24, 24];

// Default card size constraints
const DEFAULT_MIN_W = 3;
const DEFAULT_MIN_H = 2;
const DEFAULT_MAX_W = 12;
const DEFAULT_MAX_H = 8;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Hook to measure container width for responsive grid
 * Returns 0 until container is measured to prevent layout jumps
 */
function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);
  const [isMeasured, setIsMeasured] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const updateWidth = () => {
      if (ref.current) {
        const newWidth = ref.current.offsetWidth;
        if (newWidth > 0) {
          setWidth(newWidth);
          setIsMeasured(true);
        }
      }
    };

    // Initial measurement with a small delay to ensure DOM is ready
    requestAnimationFrame(updateWidth);

    // Listen for resize
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref]);

  // Return a reasonable default if not measured yet, otherwise actual width
  return isMeasured ? width : 1200;
}

/**
 * Convert CanvasCard array to react-grid-layout Layout array
 * Locked cards have static=true (non-draggable, non-resizable)
 *
 * IMPORTANT: Template cards come with predefined layouts that must be respected.
 * This function validates layouts and uses grid-aware positioning for fallbacks.
 *
 * Uses a sequential approach: cards with valid layouts are placed first,
 * then cards without layouts get positions calculated to avoid overlaps.
 */
function cardsToLayout(cards: CanvasCardType[]): LayoutItem[] {
  // Track occupied cells for grid-aware positioning
  const occupied = new Set<string>();
  const results: LayoutItem[] = [];

  // Helper to check if position is available
  const canFitAt = (x: number, y: number, w: number, h: number): boolean => {
    if (x < 0 || y < 0 || x + w > GRID_COLS) return false;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        if (occupied.has(`${x + dx},${y + dy}`)) return false;
      }
    }
    return true;
  };

  // Helper to mark cells as occupied
  const markOccupied = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        occupied.add(`${x + dx},${y + dy}`);
      }
    }
  };

  // Helper to find next available position (grid-aware)
  const findPosition = (w: number, h: number): { x: number; y: number } => {
    let maxY = 0;
    occupied.forEach(key => {
      const [, yStr] = key.split(',');
      maxY = Math.max(maxY, parseInt(yStr, 10) + 1);
    });

    // Scan row by row for available position
    for (let y = 0; y <= maxY + h; y++) {
      for (let x = 0; x <= GRID_COLS - w; x++) {
        if (canFitAt(x, y, w, h)) {
          return { x, y };
        }
      }
    }
    return { x: 0, y: maxY };
  };

  // Process each card sequentially
  for (const card of cards) {
    const isLocked = card.config?.isLocked === true;
    const rawLayout = card.layout || {};

    // Get dimensions (with defaults)
    const w = typeof rawLayout.w === 'number' && !isNaN(rawLayout.w) && rawLayout.w > 0
      ? rawLayout.w
      : 4;
    const h = typeof rawLayout.h === 'number' && !isNaN(rawLayout.h) && rawLayout.h > 0
      ? rawLayout.h
      : 3;

    // Check if card has valid x,y position
    const hasValidPosition =
      typeof rawLayout.x === 'number' && !isNaN(rawLayout.x) && rawLayout.x >= 0 &&
      typeof rawLayout.y === 'number' && !isNaN(rawLayout.y) && rawLayout.y >= 0;

    let x: number;
    let y: number;

    if (hasValidPosition) {
      // Use the card's existing position
      x = rawLayout.x!;
      y = rawLayout.y!;
    } else {
      // Card needs a position - find one using grid-aware algorithm
      const position = findPosition(w, h);
      x = position.x;
      y = position.y;
      console.warn('[CanvasWorkspace] Card missing layout, assigned grid-aware position:', {
        cardId: card.id,
        cardType: card.type,
        assignedLayout: { x, y, w, h },
      });
    }

    // Mark this card's cells as occupied for subsequent cards
    markOccupied(x, y, w, h);

    results.push({
      i: card.id,
      x,
      y,
      w,
      h,
      minW: rawLayout.minW ?? DEFAULT_MIN_W,
      minH: rawLayout.minH ?? DEFAULT_MIN_H,
      maxW: rawLayout.maxW ?? DEFAULT_MAX_W,
      maxH: rawLayout.maxH ?? DEFAULT_MAX_H,
      static: isLocked,
      isDraggable: !isLocked,
      isResizable: !isLocked,
    });
  }

  return results;
}


// ============================================================================
// Main CanvasWorkspace Component
// ============================================================================

export const CanvasWorkspace = memo(({
  cards,
  onLayoutChange,
  onCardRemove,
  onCardLockToggle,
  onAskAboutCard,
  disabled = false,
  className = '',
  children,
  renderCardContent,
  pollingContext,
  isEditMode = false,
}: CanvasWorkspaceProps) => {
  // Ref for measuring container width
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  // Guard against layout change cascades during card removal
  const isRemovingCardRef = useRef(false);
  const layoutChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // NOTE: We removed isInitialRenderRef that was blocking layout saves.
  // The root cause of stacking was that layout changes were blocked for 500ms
  // on every card addition, which prevented react-grid-layout from saving its
  // computed positions. Now that we use useCanvasLayoutManager to ensure all
  // cards have valid layouts BEFORE they reach this component, we don't need
  // to block layout changes at all. Trust the layout prop completely.

  // Track previously seen card IDs for entrance animations
  const previousCardIdsRef = useRef<Set<string>>(new Set());
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());

  // Detect newly added cards and trigger entrance animation
  useEffect(() => {
    const currentIds = new Set(cards.map(c => c.id));
    const previousIds = previousCardIdsRef.current;

    // Find cards that are new (not in previous set)
    const newIds = new Set<string>();
    currentIds.forEach(id => {
      if (!previousIds.has(id)) {
        newIds.add(id);
      }
    });

    // If there are new cards, animate them
    if (newIds.size > 0) {
      setNewCardIds(newIds);

      // Clear the animation class after animation completes
      const timer = setTimeout(() => {
        setNewCardIds(new Set());
      }, 600); // Match animation duration

      // Update the ref
      previousCardIdsRef.current = currentIds;

      return () => clearTimeout(timer);
    }

    // Update ref even if no new cards
    previousCardIdsRef.current = currentIds;
  }, [cards]);

  // Keyboard navigation state
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(-1);
  const focusedCardId = focusedCardIndex >= 0 && focusedCardIndex < cards.length
    ? cards[focusedCardIndex].id
    : null;

  // Track the card being removed to detect when removal is complete
  const removingCardIdRef = useRef<string | null>(null);

  // Wrapped onCardRemove that sets the guard flag to prevent layout change cascades
  const handleCardRemove = useCallback((cardId: string) => {
    if (!onCardRemove) return;

    // Set flag to prevent layout changes during removal
    isRemovingCardRef.current = true;
    removingCardIdRef.current = cardId;

    // Clear any pending layout changes
    if (layoutChangeTimeoutRef.current) {
      clearTimeout(layoutChangeTimeoutRef.current);
      layoutChangeTimeoutRef.current = null;
    }

    // Call the actual remove function
    onCardRemove(cardId);

    // Don't reset immediately - let the effect detect when the card is gone
  }, [onCardRemove]);

  // Reset the removal guard when the card is actually removed from the cards array
  useEffect(() => {
    if (removingCardIdRef.current) {
      const cardStillExists = cards.some(c => c.id === removingCardIdRef.current);
      if (!cardStillExists) {
        // Card has been removed from the array, safe to allow layout changes
        // Add a small delay to allow React to finish any pending updates
        const timer = setTimeout(() => {
          isRemovingCardRef.current = false;
          removingCardIdRef.current = null;
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [cards]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (cards.length === 0 || disabled) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setFocusedCardIndex((prev) => {
          const next = prev + 1;
          return next >= cards.length ? 0 : next;
        });
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedCardIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? cards.length - 1 : next;
        });
        break;

      case 'Delete':
      case 'Backspace':
        if (focusedCardId && onCardRemove) {
          e.preventDefault();
          const card = cards.find(c => c.id === focusedCardId);
          // Only delete if not locked
          if (card && !card.config?.isLocked) {
            handleCardRemove(focusedCardId);
            setFocusedCardIndex((prev) => Math.max(0, prev - 1));
          }
        }
        break;

      case 'Enter':
        if (focusedCardId && onAskAboutCard) {
          e.preventDefault();
          const card = cards.find(c => c.id === focusedCardId);
          if (card) {
            onAskAboutCard({
              cardId: card.id,
              cardType: card.type,
              cardTitle: card.title,
              data: card.data,
              summary: `${Array.isArray(card.data) ? card.data.length : 0} items`,
              config: card.config,
            });
          }
        }
        break;

      case 'l':
      case 'L':
        // Toggle lock with L key
        if (focusedCardId && onCardLockToggle) {
          e.preventDefault();
          const card = cards.find(c => c.id === focusedCardId);
          if (card) {
            onCardLockToggle(focusedCardId, !card.config?.isLocked);
          }
        }
        break;

      case 'Escape':
        setFocusedCardIndex(-1);
        break;
    }
  }, [cards, disabled, focusedCardId, onCardRemove, handleCardRemove, onAskAboutCard, onCardLockToggle]);

  // Reset focus when cards change
  useEffect(() => {
    if (focusedCardIndex >= cards.length) {
      setFocusedCardIndex(cards.length > 0 ? cards.length - 1 : -1);
    }
  }, [cards.length, focusedCardIndex]);

  // Convert cards to layout format
  const layout = useMemo(() => {
    const computed = cardsToLayout(cards);
    // Debug: Log computed layouts
    if (cards.length > 0) {
      console.log('[CanvasWorkspace] Computing layout:', {
        cardCount: cards.length,
        containerWidth: containerWidth,
        layouts: computed.map(l => ({
          id: l.i,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          static: l.static,
          isDraggable: l.isDraggable,
        })),
        disabled: disabled,
      });
    }
    return computed;
  }, [cards, disabled, containerWidth]);

  // Use a truly stable key for GridLayout
  // Previously, we changed the key on every card add/remove, which caused
  // the grid to remount and lose its internal state. React-grid-layout can
  // handle card additions/removals internally via the layout prop without
  // needing to remount. This is critical for preventing layout resets.
  const gridLayoutKey = 'canvas-grid-stable';

  // Handle layout changes from react-grid-layout with debouncing
  // This prevents cascading updates when cards are removed
  const handleLayoutChange = useCallback((newLayout: readonly LayoutItem[]) => {
    if (!onLayoutChange) return;

    // Skip layout updates during card removal to prevent cascading state updates
    if (isRemovingCardRef.current) return;

    // Debounce layout changes to batch multiple updates
    if (layoutChangeTimeoutRef.current) {
      clearTimeout(layoutChangeTimeoutRef.current);
    }

    layoutChangeTimeoutRef.current = setTimeout(() => {
      // Find changed items and notify
      newLayout.forEach((item: LayoutItem) => {
        const card = cards.find((c) => c.id === item.i);
        if (!card) return;

        // Get existing layout or use defaults
        const existingLayout = card.layout || { x: 0, y: 0, w: 4, h: 3 };

        // Check if layout actually changed
        const changed =
          existingLayout.x !== item.x ||
          existingLayout.y !== item.y ||
          existingLayout.w !== item.w ||
          existingLayout.h !== item.h;

        if (changed) {
          // Debug: Log layout changes being saved
          console.log('[CanvasWorkspace] Layout change detected:', {
            cardId: item.i,
            oldLayout: existingLayout,
            newLayout: { x: item.x, y: item.y, w: item.w, h: item.h },
          });
          onLayoutChange(item.i, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          });
        }
      });
    }, 100); // 100ms debounce
  }, [cards, onLayoutChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (layoutChangeTimeoutRef.current) {
        clearTimeout(layoutChangeTimeoutRef.current);
      }
    };
  }, []);

  // Create card elements using LiveCanvasCard component (supports live updates)
  // NOTE: We use ONLY the layout prop on GridLayout, NOT data-grid on children
  // In react-grid-layout v2, data-grid is legacy and conflicts with the layout prop
  const cardElements = useMemo(() => {
    return cards.map((card, index) => {
      const isNewCard = newCardIds.has(card.id);

      return (
        <div
          key={card.id}
          className={`canvas-card-wrapper ${isNewCard ? 'canvas-card-entrance' : ''}`}
          onClick={() => setFocusedCardIndex(index)}
        >
          <LiveCanvasCard
            card={card}
            onRemove={onCardRemove ? () => handleCardRemove(card.id) : undefined}
            onLockToggle={onCardLockToggle ? (isLocked) => onCardLockToggle(card.id, isLocked) : undefined}
            onAskAbout={onAskAboutCard}
            isSelected={focusedCardId === card.id}
            pollingContext={pollingContext}
          />
        </div>
      );
    });
  }, [cards, handleCardRemove, onCardRemove, onCardLockToggle, onAskAboutCard, focusedCardId, pollingContext, newCardIds]);

  return (
    <GridBackground className={`h-full w-full ${className}`}>
      {/* Edit mode indicator */}
      {isEditMode && (
        <div className="absolute top-2 right-2 z-50 flex items-center gap-2 px-3 py-1.5 bg-amber-500/90 text-amber-950 text-xs font-semibold rounded-full shadow-lg backdrop-blur-sm animate-pulse">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          EDIT MODE
        </div>
      )}

      {/* Canvas content layer with keyboard navigation */}
      <div
        ref={containerRef}
        className={`h-full w-full overflow-auto focus:outline-none transition-all duration-200 ${
          isEditMode ? 'ring-2 ring-amber-400 ring-dashed ring-offset-2 ring-offset-transparent rounded-lg' : ''
        }`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="region"
        aria-label={`Canvas workspace with ${cards.length} visualization card${cards.length !== 1 ? 's' : ''}. ${isEditMode ? 'Edit mode active. ' : ''}Use arrow keys to navigate, Enter to ask about card, Delete to remove, L to lock/unlock.`}
      >
        {cards.length === 0 ? (
          // Empty state - just the grid, no text (Show, Don't Tell)
          <div className="h-full w-full" />
        ) : containerWidth <= 0 ? (
          // Wait for container to be measured before rendering grid
          <div className="h-full w-full" />
        ) : (
          // Use standard JSX syntax with proper layout prop
          // The layout array controls all card positions
          React.createElement(
            GridLayout as React.ComponentType<GridLayoutProps>,
            {
              key: gridLayoutKey,
              className: "layout",
              layout: layout,
              cols: GRID_COLS,
              rowHeight: GRID_ROW_HEIGHT,
              margin: GRID_MARGIN,
              containerPadding: GRID_CONTAINER_PADDING,
              onLayoutChange: handleLayoutChange,
              isDraggable: !disabled,
              isResizable: !disabled,
              draggableHandle: ".drag-handle",
              useCSSTransforms: true,
              compactType: null,
              preventCollision: false,
              resizeHandles: ['se', 'sw', 'ne', 'nw', 's', 'e', 'w', 'n'],
              width: containerWidth,
              // Children are passed as a single array, not spread
              children: cardElements,
            }
          )
        )}
      </div>

      {/* Overlay layer (for agent flow, etc.) */}
      {children}
    </GridBackground>
  );
});

CanvasWorkspace.displayName = 'CanvasWorkspace';

export default CanvasWorkspace;
