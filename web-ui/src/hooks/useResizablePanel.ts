'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * useResizablePanel - Hook for creating resizable panels
 *
 * Allows users to drag a handle to resize a panel.
 * Persists the width to localStorage.
 */

export interface UseResizablePanelOptions {
  /** Storage key for persisting width */
  storageKey: string;
  /** Default width in pixels */
  defaultWidth: number;
  /** Minimum width in pixels */
  minWidth: number;
  /** Maximum width in pixels */
  maxWidth: number;
  /** Side of the panel (affects drag direction) */
  side: 'left' | 'right';
}

export interface UseResizablePanelReturn {
  /** Current width in pixels */
  width: number;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Start drag handler (attach to resize handle's onMouseDown) */
  startDrag: (e: React.MouseEvent) => void;
  /** Reset to default width */
  resetWidth: () => void;
  /** Props to spread on the resize handle element */
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    className: string;
  };
}

export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  side,
}: UseResizablePanelOptions): UseResizablePanelReturn {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Load saved width on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        setWidth(parsed);
      }
    }
  }, [storageKey, minWidth, maxWidth]);

  // Save width when it changes (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timeout = setTimeout(() => {
      localStorage.setItem(storageKey, width.toString());
    }, 100);
    return () => clearTimeout(timeout);
  }, [storageKey, width]);

  // Start dragging
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  }, [width]);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      // For left sidebar, dragging right increases width
      // For right sidebar, dragging left increases width
      const newWidth = side === 'left'
        ? startWidthRef.current + deltaX
        : startWidthRef.current - deltaX;

      setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Add cursor style to body while dragging
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minWidth, maxWidth, side]);

  // Reset to default
  const resetWidth = useCallback(() => {
    setWidth(defaultWidth);
  }, [defaultWidth]);

  // Handle props
  const handleProps = {
    onMouseDown: startDrag,
    style: {
      cursor: 'col-resize',
    } as React.CSSProperties,
    className: `
      absolute ${side === 'left' ? 'right-0' : 'left-0'} top-0 bottom-0
      w-1 hover:w-1.5 z-10
      bg-transparent hover:bg-cyan-500/30
      transition-all duration-150
      ${isDragging ? 'bg-cyan-500/50 w-1.5' : ''}
    `.trim(),
  };

  return {
    width,
    isDragging,
    startDrag,
    resetWidth,
    handleProps,
  };
}

export default useResizablePanel;
