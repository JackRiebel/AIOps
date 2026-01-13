'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';

interface UseMultiSelectOptions<T> {
  items: T[];
  getItemId: (item: T) => string;
  maxSelection?: number;
  onSelectionChange?: (selectedItems: T[]) => void;
}

interface UseMultiSelectReturn<T> {
  selectedIds: Set<string>;
  selectedItems: T[];
  isSelected: (id: string) => boolean;
  select: (id: string) => void;
  deselect: (id: string) => void;
  toggle: (id: string, event?: React.MouseEvent) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectRange: (fromId: string, toId: string) => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  selectionCount: number;
}

export function useMultiSelect<T>({
  items,
  getItemId,
  maxSelection,
  onSelectionChange,
}: UseMultiSelectOptions<T>): UseMultiSelectReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Get selected items
  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(getItemId(item)));
  }, [items, selectedIds, getItemId]);

  // Notify on selection change
  useEffect(() => {
    onSelectionChange?.(selectedItems);
  }, [selectedItems, onSelectionChange]);

  // Check if an item is selected
  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  // Select a single item
  const select = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        if (maxSelection && prev.size >= maxSelection) {
          return prev;
        }
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setLastSelectedId(id);
    },
    [maxSelection]
  );

  // Deselect a single item
  const deselect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Toggle selection (with Shift+Click support for range selection)
  const toggle = useCallback(
    (id: string, event?: React.MouseEvent) => {
      // Shift+Click for range selection
      if (event?.shiftKey && lastSelectedId) {
        const itemIds = items.map(getItemId);
        const lastIndex = itemIds.indexOf(lastSelectedId);
        const currentIndex = itemIds.indexOf(id);

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeIds = itemIds.slice(start, end + 1);

          setSelectedIds((prev) => {
            const next = new Set(prev);
            rangeIds.forEach((rangeId) => {
              if (maxSelection && next.size >= maxSelection) return;
              next.add(rangeId);
            });
            return next;
          });
          return;
        }
      }

      // Ctrl/Cmd+Click or regular click
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (maxSelection && next.size >= maxSelection) {
            return prev;
          }
          next.add(id);
        }
        return next;
      });
      setLastSelectedId(id);
    },
    [items, getItemId, lastSelectedId, maxSelection]
  );

  // Select all items
  const selectAll = useCallback(() => {
    const allIds = items.map(getItemId);
    const idsToSelect = maxSelection ? allIds.slice(0, maxSelection) : allIds;
    setSelectedIds(new Set(idsToSelect));
  }, [items, getItemId, maxSelection]);

  // Deselect all items
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  // Select a range of items
  const selectRange = useCallback(
    (fromId: string, toId: string) => {
      const itemIds = items.map(getItemId);
      const fromIndex = itemIds.indexOf(fromId);
      const toIndex = itemIds.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1) return;

      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const rangeIds = itemIds.slice(start, end + 1);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((id) => {
          if (maxSelection && next.size >= maxSelection) return;
          next.add(id);
        });
        return next;
      });
    },
    [items, getItemId, maxSelection]
  );

  // Check if all items are selected
  const isAllSelected = useMemo(() => {
    if (items.length === 0) return false;
    const effectiveMax = maxSelection ? Math.min(maxSelection, items.length) : items.length;
    return selectedIds.size === effectiveMax;
  }, [items.length, selectedIds.size, maxSelection]);

  // Check if some (but not all) items are selected
  const isSomeSelected = useMemo(() => {
    return selectedIds.size > 0 && !isAllSelected;
  }, [selectedIds.size, isAllSelected]);

  return {
    selectedIds,
    selectedItems,
    isSelected,
    select,
    deselect,
    toggle,
    selectAll,
    deselectAll,
    selectRange,
    isAllSelected,
    isSomeSelected,
    selectionCount: selectedIds.size,
  };
}
