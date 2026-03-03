'use client';

/**
 * SplitPane component for resizable dual-pane layouts.
 *
 * Used for the chat/canvas split view where users can resize
 * the panes by dragging the divider.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface SplitPaneProps {
  /** Left/top pane content */
  leftPane: React.ReactNode;
  /** Right/bottom pane content */
  rightPane: React.ReactNode;
  /** Initial split ratio (0-100, percentage for left pane) */
  splitRatio?: number;
  /** Callback when split ratio changes */
  onSplitChange?: (ratio: number) => void;
  /** Minimum size for left pane (percentage) */
  minLeftSize?: number;
  /** Maximum size for left pane (percentage) */
  maxLeftSize?: number;
  /** Direction of the split */
  direction?: 'horizontal' | 'vertical';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Resizable split pane layout component.
 *
 * @example
 * <SplitPane
 *   leftPane={<ChatPane />}
 *   rightPane={<Canvas />}
 *   splitRatio={40}
 *   onSplitChange={setSplitRatio}
 * />
 */
export function SplitPane({
  leftPane,
  rightPane,
  splitRatio = 50,
  onSplitChange,
  minLeftSize = 20,
  maxLeftSize = 80,
  direction = 'horizontal',
  className,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localRatio, setLocalRatio] = useState(splitRatio);

  // Sync local ratio with prop
  useEffect(() => {
    setLocalRatio(splitRatio);
  }, [splitRatio]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let newRatio: number;

      if (direction === 'horizontal') {
        const x = e.clientX - rect.left;
        newRatio = (x / rect.width) * 100;
      } else {
        const y = e.clientY - rect.top;
        newRatio = (y / rect.height) * 100;
      }

      // Clamp to min/max
      newRatio = Math.max(minLeftSize, Math.min(maxLeftSize, newRatio));

      setLocalRatio(newRatio);
      onSplitChange?.(newRatio);
    },
    [isDragging, direction, minLeftSize, maxLeftSize, onSplitChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, direction]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full overflow-hidden',
        isHorizontal ? 'flex-row' : 'flex-col',
        className
      )}
    >
      {/* Left/Top Pane */}
      <div
        className="overflow-hidden"
        style={{
          [isHorizontal ? 'width' : 'height']: `${localRatio}%`,
          flexShrink: 0,
        }}
      >
        {leftPane}
      </div>

      {/* Divider */}
      <div
        className={cn(
          'flex-shrink-0 bg-slate-200 dark:bg-slate-700 hover:bg-cyan-400 dark:hover:bg-cyan-500 transition-colors relative',
          isHorizontal
            ? 'w-1 cursor-col-resize'
            : 'h-1 cursor-row-resize',
          isDragging && 'bg-cyan-500 dark:bg-cyan-400'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Drag handle indicator */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            isHorizontal ? 'w-4 -ml-1.5' : 'h-4 -mt-1.5'
          )}
        >
          <div
            className={cn(
              'bg-slate-300 dark:bg-slate-600 rounded-full',
              isHorizontal ? 'w-1 h-8' : 'h-1 w-8',
              isDragging && 'bg-cyan-400 dark:bg-cyan-400'
            )}
          />
        </div>
      </div>

      {/* Right/Bottom Pane */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          [isHorizontal ? 'width' : 'height']: `${100 - localRatio}%`,
        }}
      >
        {rightPane}
      </div>
    </div>
  );
}

export default SplitPane;
