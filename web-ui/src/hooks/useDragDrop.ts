'use client';

import { useState, useCallback, useRef, useMemo } from 'react';

export interface DragItem<T = unknown> {
  type: string;
  data: T;
  source: string;
}

interface UseDragDropOptions<T> {
  type: string;
  source: string;
  onDrop?: (items: DragItem<T>[]) => void;
  onDragStart?: (item: DragItem<T>) => void;
  onDragEnd?: (item: DragItem<T>, success: boolean) => void;
}

interface UseDragDropReturn<T> {
  isDragging: boolean;
  isOver: boolean;
  draggedItems: DragItem<T>[];
  getDragProps: (data: T) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    'data-dragging': boolean;
  };
  getDropProps: () => {
    onDragOver: (e: React.DragEvent) => void;
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    'data-over': boolean;
  };
  startDrag: (data: T) => void;
  endDrag: (success?: boolean) => void;
}

// Global drag state for coordination between drag sources and drop targets
let globalDragItem: DragItem | null = null;
let globalDragItems: DragItem[] = [];

export function setGlobalDragItems(items: DragItem[]) {
  globalDragItems = items;
}

export function getGlobalDragItems(): DragItem[] {
  return globalDragItems;
}

export function useDragDrop<T>({
  type,
  source,
  onDrop,
  onDragStart,
  onDragEnd,
}: UseDragDropOptions<T>): UseDragDropReturn<T> {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [draggedItems, setDraggedItems] = useState<DragItem<T>[]>([]);
  const dragCountRef = useRef(0);

  // Create a drag item
  const createDragItem = useCallback(
    (data: T): DragItem<T> => ({
      type,
      data,
      source,
    }),
    [type, source]
  );

  // Start dragging
  const startDrag = useCallback(
    (data: T) => {
      const item = createDragItem(data);
      globalDragItem = item;
      setDraggedItems([item]);
      setIsDragging(true);
      onDragStart?.(item);
    },
    [createDragItem, onDragStart]
  );

  // End dragging
  const endDrag = useCallback(
    (success = false) => {
      if (draggedItems.length > 0) {
        draggedItems.forEach((item) => {
          onDragEnd?.(item, success);
        });
      }
      globalDragItem = null;
      globalDragItems = [];
      setDraggedItems([]);
      setIsDragging(false);
    },
    [draggedItems, onDragEnd]
  );

  // Get props for draggable elements
  const getDragProps = useCallback(
    (data: T) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        const item = createDragItem(data);

        // Use global drag items if they were set (for multi-select drag)
        const items = globalDragItems.length > 0 ? globalDragItems : [item];

        // Set drag data
        e.dataTransfer.setData('application/json', JSON.stringify(items));
        e.dataTransfer.effectAllowed = 'move';

        setDraggedItems(items as DragItem<T>[]);
        setIsDragging(true);
        onDragStart?.(item);
      },
      onDragEnd: (e: React.DragEvent) => {
        const success = e.dataTransfer.dropEffect !== 'none';
        endDrag(success);
      },
      'data-dragging': isDragging,
    }),
    [createDragItem, isDragging, onDragStart, endDrag]
  );

  // Get props for drop targets
  const getDropProps = useCallback(
    () => ({
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      },
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault();
        dragCountRef.current++;
        setIsOver(true);
      },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
        dragCountRef.current--;
        if (dragCountRef.current === 0) {
          setIsOver(false);
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        dragCountRef.current = 0;
        setIsOver(false);

        try {
          const jsonData = e.dataTransfer.getData('application/json');
          if (jsonData) {
            const items = JSON.parse(jsonData) as DragItem<T>[];
            // Only accept items of matching type
            const validItems = items.filter((item) => item.type === type);
            if (validItems.length > 0) {
              onDrop?.(validItems);
            }
          }
        } catch (error) {
          console.error('Failed to parse drag data:', error);
        }
      },
      'data-over': isOver,
    }),
    [type, isOver, onDrop]
  );

  return {
    isDragging,
    isOver,
    draggedItems,
    getDragProps,
    getDropProps,
    startDrag,
    endDrag,
  };
}

// Hook for using drag and drop with multi-select
export function useMultiSelectDragDrop<T>(
  dragDrop: UseDragDropReturn<T>,
  selectedItems: T[],
  createDragItem: (data: T) => DragItem<T>
) {
  const { getDragProps: originalGetDragProps, ...rest } = dragDrop;

  const getDragProps = useCallback(
    (data: T) => {
      const props = originalGetDragProps(data);

      return {
        ...props,
        onDragStart: (e: React.DragEvent) => {
          // If dragging a selected item, drag all selected items
          const itemsToSet = selectedItems.length > 1
            ? selectedItems.map(createDragItem)
            : [createDragItem(data)];

          setGlobalDragItems(itemsToSet);
          props.onDragStart(e);
        },
      };
    },
    [originalGetDragProps, selectedItems, createDragItem]
  );

  return {
    ...rest,
    getDragProps,
  };
}
