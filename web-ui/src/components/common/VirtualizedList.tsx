'use client';

import { useRef, useCallback, useState, useEffect, CSSProperties } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface VirtualizedListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode;
  overscanCount?: number;
  className?: string;
  emptyMessage?: string;
  onItemsRendered?: (startIndex: number, stopIndex: number) => void;
}

// ============================================================================
// Virtualized List Component (Custom Implementation)
// ============================================================================

export function VirtualizedList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  overscanCount = 5,
  className = '',
  emptyMessage = 'No items',
  onItemsRendered,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscanCount);
  const visibleCount = Math.ceil(height / itemHeight) + 2 * overscanCount;
  const endIndex = Math.min(items.length - 1, startIndex + visibleCount);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
  }, []);

  // Notify about rendered items
  useEffect(() => {
    const visibleStartIndex = Math.floor(scrollTop / itemHeight);
    const visibleEndIndex = Math.min(items.length - 1, visibleStartIndex + Math.ceil(height / itemHeight));
    onItemsRendered?.(visibleStartIndex, visibleEndIndex);
  }, [scrollTop, itemHeight, height, items.length, onItemsRendered]);

  // Scroll to item function
  const scrollToItem = useCallback((index: number, align: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
    const container = containerRef.current;
    if (!container) return;

    let targetScrollTop = index * itemHeight;

    if (align === 'center') {
      targetScrollTop = index * itemHeight - height / 2 + itemHeight / 2;
    } else if (align === 'end') {
      targetScrollTop = (index + 1) * itemHeight - height;
    } else if (align === 'auto') {
      if (targetScrollTop < scrollTop) {
        // Item is above viewport
      } else if ((index + 1) * itemHeight > scrollTop + height) {
        // Item is below viewport
        targetScrollTop = (index + 1) * itemHeight - height;
      } else {
        // Item is already visible
        return;
      }
    }

    container.scrollTop = Math.max(0, targetScrollTop);
  }, [itemHeight, height, scrollTop]);

  // Empty state
  if (items.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 ${className}`}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const totalHeight = items.length * itemHeight;

  // Render visible items
  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const style: CSSProperties = {
      position: 'absolute',
      top: i * itemHeight,
      left: 0,
      right: 0,
      height: itemHeight,
    };
    visibleItems.push(
      <div key={i} style={style}>
        {renderItem(items[i], i, style)}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
}

// ============================================================================
// Infinite Scroll List Hook
// ============================================================================

interface UseInfiniteScrollOptions {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  threshold?: number; // How many items from the end to trigger fetch
}

export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  threshold = 5,
}: UseInfiniteScrollOptions) {
  const handleItemsRendered = useCallback(
    (startIndex: number, stopIndex: number, totalCount: number) => {
      if (
        hasNextPage &&
        !isFetchingNextPage &&
        stopIndex >= totalCount - threshold
      ) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, threshold]
  );

  return { handleItemsRendered };
}
