/**
 * Canvas History Hook - Undo/Redo functionality
 *
 * Based on React Flow's snapshot-based approach with optimizations
 * for large workflows (debouncing, history limits).
 *
 * @see https://reactflow.dev/examples/interaction/undo-redo
 */

import { useCallback, useRef, useState } from 'react';
import { Node, Edge } from '@xyflow/react';

interface HistoryEntry {
  id: string;
  nodes: Node[];
  edges: Edge[];
  timestamp: number;
  action: string;
}

export interface UseCanvasHistoryOptions {
  maxHistory?: number;
  debounceMs?: number;
}

export interface UseCanvasHistoryReturn {
  // State
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentIndex: number;

  // Actions
  takeSnapshot: (action: string) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  clear: () => void;

  // Utils
  getHistory: () => HistoryEntry[];
  getCurrentState: () => HistoryEntry | null;
}

export function useCanvasHistory(
  nodes: Node[],
  edges: Edge[],
  options: UseCanvasHistoryOptions = {}
): UseCanvasHistoryReturn {
  const { maxHistory = 50, debounceMs = 300 } = options;

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const lastSnapshotTime = useRef<number>(0);
  const pendingSnapshot = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const takeSnapshot = useCallback((action: string) => {
    const now = Date.now();

    // Clear any pending snapshot
    if (pendingSnapshot.current) {
      clearTimeout(pendingSnapshot.current);
      pendingSnapshot.current = null;
    }

    // Debounce rapid changes
    if (now - lastSnapshotTime.current < debounceMs) {
      pendingSnapshot.current = setTimeout(() => {
        takeSnapshot(action);
      }, debounceMs);
      return;
    }

    lastSnapshotTime.current = now;

    const newEntry: HistoryEntry = {
      id: generateId(),
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: now,
      action,
    };

    setHistory((prev) => {
      // Remove any "future" entries when taking a new snapshot
      const newHistory = prev.slice(0, currentIndex + 1);

      // Add new entry
      newHistory.push(newEntry);

      // Trim to max history
      if (newHistory.length > maxHistory) {
        newHistory.shift();
      }

      return newHistory;
    });

    setCurrentIndex((prev) => Math.min(prev + 1, maxHistory - 1));
  }, [nodes, edges, currentIndex, maxHistory, debounceMs, generateId]);

  const undo = useCallback((): HistoryEntry | null => {
    if (currentIndex <= 0) return null;

    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);

    return history[newIndex] || null;
  }, [currentIndex, history]);

  const redo = useCallback((): HistoryEntry | null => {
    if (currentIndex >= history.length - 1) return null;

    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);

    return history[newIndex] || null;
  }, [currentIndex, history]);

  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    lastSnapshotTime.current = 0;
    if (pendingSnapshot.current) {
      clearTimeout(pendingSnapshot.current);
      pendingSnapshot.current = null;
    }
  }, []);

  const getHistory = useCallback(() => history, [history]);

  const getCurrentState = useCallback((): HistoryEntry | null => {
    return history[currentIndex] || null;
  }, [history, currentIndex]);

  return {
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    historyLength: history.length,
    currentIndex,
    takeSnapshot,
    undo,
    redo,
    clear,
    getHistory,
    getCurrentState,
  };
}

export default useCanvasHistory;
