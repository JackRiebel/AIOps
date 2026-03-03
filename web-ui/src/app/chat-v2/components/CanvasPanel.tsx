'use client';

/**
 * CanvasPanel - Self-Contained Canvas Workspace
 *
 * A draggable/resizable grid for visualization cards using react-grid-layout.
 * Key features:
 * - Stable layouts (cards don't move on session switch)
 * - Grid-aware positioning for new cards
 * - ResizeObserver for responsive width
 * - Debounced layout persistence
 */

import React, { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { GridLayout } from 'react-grid-layout';
import type { CanvasCard, CardLayout } from '../types';

// Import react-grid-layout styles
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// =============================================================================
// Types
// =============================================================================

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
}

// GridLayout props type (the @types package is outdated for v2.x)
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

interface CanvasPanelProps {
  cards: CanvasCard[];
  onLayoutChange?: (cardId: string, layout: CardLayout) => void;
  onCardRemove?: (cardId: string) => void;
  renderCard?: (card: CanvasCard) => React.ReactNode;
  disabled?: boolean;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const COLS = 12;
const ROW_HEIGHT = 80;
const MARGIN: [number, number] = [16, 16];
const PADDING: [number, number] = [24, 24];
const MIN_CONTAINER_WIDTH = 400;

// Default size constraints
const MIN_W = 3;
const MIN_H = 2;
const MAX_W = 12;
const MAX_H = 8;

// =============================================================================
// Hooks
// =============================================================================

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    if (!ref.current) return;

    const updateWidth = () => {
      if (ref.current) {
        const newWidth = ref.current.offsetWidth;
        // Only update if we have a valid width
        if (newWidth >= MIN_CONTAINER_WIDTH) {
          setWidth(newWidth);
        }
      }
    };

    // Initial measurement
    requestAnimationFrame(updateWidth);

    // Listen for resize
    const observer = new ResizeObserver(updateWidth);
    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref]);

  // Return width directly - initial value of 1200 serves as fallback
  return width;
}

// =============================================================================
// Helper Functions
// =============================================================================

function cardsToLayout(cards: CanvasCard[]): LayoutItem[] {
  const occupied = new Set<string>();
  const results: LayoutItem[] = [];

  const canFitAt = (x: number, y: number, w: number, h: number): boolean => {
    if (x < 0 || y < 0 || x + w > COLS) return false;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        if (occupied.has(`${x + dx},${y + dy}`)) return false;
      }
    }
    return true;
  };

  const markOccupied = (x: number, y: number, w: number, h: number) => {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        occupied.add(`${x + dx},${y + dy}`);
      }
    }
  };

  const findPosition = (w: number, h: number): { x: number; y: number } => {
    let maxY = 0;
    occupied.forEach(key => {
      const [, yStr] = key.split(',');
      maxY = Math.max(maxY, parseInt(yStr, 10) + 1);
    });

    for (let y = 0; y <= maxY + h; y++) {
      for (let x = 0; x <= COLS - w; x++) {
        if (canFitAt(x, y, w, h)) {
          return { x, y };
        }
      }
    }
    return { x: 0, y: maxY };
  };

  for (const card of cards) {
    const layout = card.layout || {};
    const w = typeof layout.w === 'number' && layout.w > 0 ? layout.w : 4;
    const h = typeof layout.h === 'number' && layout.h > 0 ? layout.h : 3;

    const hasPosition =
      typeof layout.x === 'number' && layout.x >= 0 &&
      typeof layout.y === 'number' && layout.y >= 0;

    let x: number;
    let y: number;

    if (hasPosition) {
      x = layout.x!;
      y = layout.y!;
    } else {
      const pos = findPosition(w, h);
      x = pos.x;
      y = pos.y;
    }

    markOccupied(x, y, w, h);

    results.push({
      i: card.id,
      x,
      y,
      w,
      h,
      minW: MIN_W,
      minH: MIN_H,
      maxW: MAX_W,
      maxH: MAX_H,
    });
  }

  return results;
}

// =============================================================================
// Default Card Renderer
// =============================================================================

const DefaultCardContent = memo(({ card }: { card: CanvasCard }) => (
  <div className="h-full flex flex-col">
    <div className="drag-handle px-4 py-3 border-b border-slate-700/50 cursor-move">
      <h3 className="text-sm font-medium text-white truncate">{card.title}</h3>
      <p className="text-xs text-slate-500 mt-0.5">{card.type}</p>
    </div>
    <div className="flex-1 p-4 overflow-auto">
      <p className="text-slate-400 text-sm">Card content for {card.type}</p>
    </div>
  </div>
));
DefaultCardContent.displayName = 'DefaultCardContent';

// =============================================================================
// Card Wrapper Component
// =============================================================================

const CardWrapper = memo(({
  card,
  onRemove,
  renderCard,
}: {
  card: CanvasCard;
  onRemove?: () => void;
  renderCard?: (card: CanvasCard) => React.ReactNode;
}) => (
  <div className="h-full w-full bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg relative group max-w-full">
    {/* Remove button */}
    {onRemove && (
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-slate-700/80 text-slate-400
          opacity-0 group-hover:opacity-100 hover:bg-red-600/20 hover:text-red-400 transition-all"
        title="Remove card"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}

    {/* Card content */}
    {renderCard ? renderCard(card) : <DefaultCardContent card={card} />}
  </div>
));
CardWrapper.displayName = 'CardWrapper';

// =============================================================================
// Grid Background
// =============================================================================

const GridBackground = memo(({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`relative ${className}`}
    style={{
      backgroundImage: `
        linear-gradient(rgba(100, 116, 139, 0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(100, 116, 139, 0.08) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
    }}
  >
    {children}
  </div>
));
GridBackground.displayName = 'GridBackground';

// =============================================================================
// Main Component
// =============================================================================

export const CanvasPanel = memo(({
  cards,
  onLayoutChange,
  onCardRemove,
  renderCard,
  disabled = false,
  className = '',
}: CanvasPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const layoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Convert cards to layout
  const layout = useMemo(() => cardsToLayout(cards), [cards]);

  // Handle layout changes with debounce
  const handleLayoutChange = useCallback((newLayout: readonly LayoutItem[]) => {
    if (!onLayoutChange) return;

    if (layoutTimeoutRef.current) {
      clearTimeout(layoutTimeoutRef.current);
    }

    layoutTimeoutRef.current = setTimeout(() => {
      newLayout.forEach((item) => {
        const card = cards.find((c) => c.id === item.i);
        if (!card) return;

        const existing = card.layout || { x: 0, y: 0, w: 4, h: 3 };
        const changed =
          existing.x !== item.x ||
          existing.y !== item.y ||
          existing.w !== item.w ||
          existing.h !== item.h;

        if (changed) {
          onLayoutChange(item.i, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          });
        }
      });
    }, 100);
  }, [cards, onLayoutChange]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (layoutTimeoutRef.current) {
        clearTimeout(layoutTimeoutRef.current);
      }
    };
  }, []);

  // Create card elements
  const cardElements = useMemo(() => {
    return cards.map((card) => (
      <div key={card.id}>
        <CardWrapper
          card={card}
          onRemove={onCardRemove ? () => onCardRemove(card.id) : undefined}
          renderCard={renderCard}
        />
      </div>
    ));
  }, [cards, onCardRemove, renderCard]);

  return (
    <GridBackground className={`h-full w-full bg-slate-950 ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full overflow-auto"
      >
        {cards.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">
                Cards will appear here
              </p>
            </div>
          </div>
        ) : containerWidth > 0 && (
          React.createElement(
            GridLayout as React.ComponentType<GridLayoutProps>,
            {
              className: 'layout',
              layout: layout,
              cols: COLS,
              rowHeight: ROW_HEIGHT,
              margin: MARGIN,
              containerPadding: PADDING,
              onLayoutChange: handleLayoutChange,
              isDraggable: !disabled,
              isResizable: !disabled,
              draggableHandle: '.drag-handle',
              useCSSTransforms: true,
              compactType: null,
              preventCollision: false,
              resizeHandles: ['se', 'sw', 'ne', 'nw', 's', 'e', 'w', 'n'],
              width: containerWidth,
            },
            ...cardElements
          )
        )}
      </div>
    </GridBackground>
  );
});

CanvasPanel.displayName = 'CanvasPanel';

export default CanvasPanel;
