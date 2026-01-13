'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import {
  convertWorkflow,
  canConvert,
  isLossyConversion,
  getConversionDescription,
  type ConvertWorkflowResult,
} from '../services/workflowModeConverter';

export type WorkflowMode = 'cards' | 'cli' | 'python';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowModeState {
  nodes: Node[];
  edges: Edge[];
  cli: string;
  python: string;
}

export interface ModeHistoryEntry {
  mode: WorkflowMode;
  state: WorkflowModeState;
  timestamp: number;
}

export interface WorkflowModeContextType {
  // Current mode
  mode: WorkflowMode;
  setMode: (mode: WorkflowMode) => void;

  // Mode switching
  canSwitchMode: boolean;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;

  // Current state
  nodes: Node[];
  edges: Edge[];
  cli: string;
  python: string;

  // State setters
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setCli: (cli: string) => void;
  setPython: (python: string) => void;

  // Conversion
  convertToMode: (targetMode: WorkflowMode) => Promise<ConvertWorkflowResult>;
  canConvertTo: (targetMode: WorkflowMode) => boolean;
  isLossyConversionTo: (targetMode: WorkflowMode) => boolean;
  getConversionDescriptionTo: (targetMode: WorkflowMode) => string;

  // Undo support
  canUndoModeSwitch: boolean;
  undoModeSwitch: () => void;

  // Confirmation
  confirmModeSwitch: (targetMode: WorkflowMode) => Promise<boolean>;
  pendingModeSwitch: WorkflowMode | null;
  confirmPendingSwitch: () => void;
  cancelPendingSwitch: () => void;
}

const WorkflowModeContext = createContext<WorkflowModeContextType | undefined>(undefined);

const STORAGE_KEY = 'lumen-workflow-mode';
const MAX_HISTORY = 10;

// ============================================================================
// Provider Props
// ============================================================================

interface WorkflowModeProviderProps {
  children: ReactNode;
  initialMode?: WorkflowMode;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  initialCli?: string;
  initialPython?: string;
  onModeChange?: (mode: WorkflowMode) => void;
  onStateChange?: (state: WorkflowModeState) => void;
}

// ============================================================================
// Provider
// ============================================================================

export function WorkflowModeProvider({
  children,
  initialMode,
  initialNodes = [],
  initialEdges = [],
  initialCli = '',
  initialPython = '',
  onModeChange,
  onStateChange,
}: WorkflowModeProviderProps) {
  // Mode state
  const [mode, setModeState] = useState<WorkflowMode>(() => {
    if (initialMode) return initialMode;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ['cards', 'cli', 'python'].includes(stored)) {
        return stored as WorkflowMode;
      }
    }
    return 'cards';
  });

  // Content state
  const [nodes, setNodesState] = useState<Node[]>(initialNodes);
  const [edges, setEdgesState] = useState<Edge[]>(initialEdges);
  const [cli, setCliState] = useState<string>(initialCli);
  const [python, setPythonState] = useState<string>(initialPython);

  // Change tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // History for undo
  const [modeHistory, setModeHistory] = useState<ModeHistoryEntry[]>([]);

  // Pending mode switch (for confirmation dialog)
  const [pendingModeSwitch, setPendingModeSwitch] = useState<WorkflowMode | null>(null);
  const pendingResolve = useRef<((value: boolean) => void) | null>(null);

  // Persist mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({ nodes, edges, cli, python });
  }, [nodes, edges, cli, python, onStateChange]);

  // State setters with change tracking
  const setNodes = useCallback((newNodes: Node[]) => {
    setNodesState(newNodes);
    setHasUnsavedChanges(true);
  }, []);

  const setEdges = useCallback((newEdges: Edge[]) => {
    setEdgesState(newEdges);
    setHasUnsavedChanges(true);
  }, []);

  const setCli = useCallback((newCli: string) => {
    setCliState(newCli);
    setHasUnsavedChanges(true);
  }, []);

  const setPython = useCallback((newPython: string) => {
    setPythonState(newPython);
    setHasUnsavedChanges(true);
  }, []);

  // Conversion helpers
  const canConvertTo = useCallback((targetMode: WorkflowMode): boolean => {
    return canConvert(mode, targetMode);
  }, [mode]);

  const isLossyConversionTo = useCallback((targetMode: WorkflowMode): boolean => {
    return isLossyConversion(mode, targetMode);
  }, [mode]);

  const getConversionDescriptionTo = useCallback((targetMode: WorkflowMode): string => {
    return getConversionDescription(mode, targetMode);
  }, [mode]);

  // Convert to target mode
  const convertToMode = useCallback(async (targetMode: WorkflowMode): Promise<ConvertWorkflowResult> => {
    if (mode === targetMode) {
      return {
        success: true,
        lossyConversion: false,
        warnings: [],
        errors: [],
        nodes,
        edges,
        cli,
        python,
      };
    }

    const result = convertWorkflow({
      sourceMode: mode,
      targetMode,
      nodes,
      edges,
      cli,
      python,
    });

    if (result.success) {
      // Save current state to history
      const historyEntry: ModeHistoryEntry = {
        mode,
        state: { nodes, edges, cli, python },
        timestamp: Date.now(),
      };
      setModeHistory(prev => [...prev.slice(-MAX_HISTORY + 1), historyEntry]);

      // Apply converted content
      if (result.nodes) setNodesState(result.nodes);
      if (result.edges) setEdgesState(result.edges);
      if (result.cli) setCliState(result.cli);
      if (result.python) setPythonState(result.python);

      // Switch mode
      setModeState(targetMode);
      onModeChange?.(targetMode);
    }

    return result;
  }, [mode, nodes, edges, cli, python, onModeChange]);

  // Undo mode switch
  const canUndoModeSwitch = modeHistory.length > 0;

  const undoModeSwitch = useCallback(() => {
    if (modeHistory.length === 0) return;

    const lastEntry = modeHistory[modeHistory.length - 1];
    setNodesState(lastEntry.state.nodes);
    setEdgesState(lastEntry.state.edges);
    setCliState(lastEntry.state.cli);
    setPythonState(lastEntry.state.python);
    setModeState(lastEntry.mode);
    setModeHistory(prev => prev.slice(0, -1));
    onModeChange?.(lastEntry.mode);
  }, [modeHistory, onModeChange]);

  // Confirmation dialog control
  const confirmModeSwitch = useCallback(async (targetMode: WorkflowMode): Promise<boolean> => {
    if (mode === targetMode) return true;

    // If no unsaved changes and conversion is not lossy, auto-confirm
    if (!hasUnsavedChanges && !isLossyConversion(mode, targetMode)) {
      return true;
    }

    // Show confirmation dialog
    return new Promise<boolean>((resolve) => {
      pendingResolve.current = resolve;
      setPendingModeSwitch(targetMode);
    });
  }, [mode, hasUnsavedChanges]);

  const confirmPendingSwitch = useCallback(() => {
    if (pendingResolve.current) {
      pendingResolve.current(true);
      pendingResolve.current = null;
    }
    setPendingModeSwitch(null);
  }, []);

  const cancelPendingSwitch = useCallback(() => {
    if (pendingResolve.current) {
      pendingResolve.current(false);
      pendingResolve.current = null;
    }
    setPendingModeSwitch(null);
  }, []);

  // Set mode with confirmation
  const setMode = useCallback(async (newMode: WorkflowMode) => {
    if (newMode === mode) return;

    const confirmed = await confirmModeSwitch(newMode);
    if (!confirmed) return;

    const result = await convertToMode(newMode);
    if (!result.success) {
      console.error('Mode conversion failed:', result.errors);
    }
  }, [mode, confirmModeSwitch, convertToMode]);

  const canSwitchMode = !hasUnsavedChanges || pendingModeSwitch !== null;

  return (
    <WorkflowModeContext.Provider
      value={{
        mode,
        setMode,
        canSwitchMode,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        nodes,
        edges,
        cli,
        python,
        setNodes,
        setEdges,
        setCli,
        setPython,
        convertToMode,
        canConvertTo,
        isLossyConversionTo,
        getConversionDescriptionTo,
        canUndoModeSwitch,
        undoModeSwitch,
        confirmModeSwitch,
        pendingModeSwitch,
        confirmPendingSwitch,
        cancelPendingSwitch,
      }}
    >
      {children}
    </WorkflowModeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useWorkflowMode() {
  const context = useContext(WorkflowModeContext);
  if (context === undefined) {
    throw new Error('useWorkflowMode must be used within a WorkflowModeProvider');
  }
  return context;
}

export default WorkflowModeContext;
