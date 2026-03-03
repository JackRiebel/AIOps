'use client';

/**
 * Artifact Context for managing AI-generated canvas artifacts.
 *
 * This context manages artifacts generated from tool calls during
 * AI conversations, separate from the main canvas workspace.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

/**
 * Supported artifact types.
 */
export type ArtifactType =
  | 'data_table'
  | 'device_cards'
  | 'chart'
  | 'topology'
  | 'code'
  | 'markdown'
  | 'json'
  | 'network_diagram'
  | 'device_card'
  | 'alert_panel'
  | 'status_card'
  | 'stat_card';

/**
 * Artifact data structure.
 */
export interface Artifact {
  /** Unique identifier */
  id: number;
  /** Artifact type for rendering */
  type: ArtifactType;
  /** Display title */
  title: string;
  /** Structured content for rendering */
  content: Record<string, unknown>;
  /** Optional render configuration */
  renderConfig?: Record<string, unknown>;
  /** Version number for edit tracking */
  version: number;
  /** Creation timestamp */
  createdAt: string;
  /** Optional description */
  description?: string;
  /** Source tool that generated this artifact */
  sourceTool?: string;
}

/**
 * Artifact canvas state.
 */
interface ArtifactCanvasState {
  /** List of artifacts */
  artifacts: Artifact[];
  /** Currently active artifact ID */
  activeArtifactId: number | null;
  /** Whether the canvas is expanded */
  isExpanded: boolean;
  /** Split ratio for chat/canvas panes (0-100, percentage for chat) */
  splitRatio: number;
}

/**
 * Artifact context type.
 */
interface ArtifactContextType {
  /** Current state */
  state: ArtifactCanvasState;
  /** Add a new artifact */
  addArtifact: (artifact: Artifact) => void;
  /** Update an existing artifact */
  updateArtifact: (id: number, updates: Partial<Artifact>) => void;
  /** Remove an artifact */
  removeArtifact: (id: number) => void;
  /** Set the active artifact */
  setActiveArtifact: (id: number | null) => void;
  /** Toggle canvas expansion */
  toggleExpanded: () => void;
  /** Set the split ratio */
  setSplitRatio: (ratio: number) => void;
  /** Clear all artifacts */
  clearArtifacts: () => void;
  /** Get artifact by ID */
  getArtifact: (id: number) => Artifact | undefined;
}

/**
 * Default state values.
 */
const defaultState: ArtifactCanvasState = {
  artifacts: [],
  activeArtifactId: null,
  isExpanded: false,
  splitRatio: 40, // 40% chat, 60% canvas
};

/**
 * Artifact context.
 */
const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined);

/**
 * Artifact provider props.
 */
interface ArtifactProviderProps {
  children: ReactNode;
  /** Initial state override */
  initialState?: Partial<ArtifactCanvasState>;
}

/**
 * Provider component for artifact management.
 *
 * @example
 * <ArtifactProvider>
 *   <ChatContainer />
 * </ArtifactProvider>
 */
export function ArtifactProvider({
  children,
  initialState = {},
}: ArtifactProviderProps) {
  const [state, setState] = useState<ArtifactCanvasState>({
    ...defaultState,
    ...initialState,
  });

  const addArtifact = useCallback((artifact: Artifact) => {
    setState((prev) => ({
      ...prev,
      artifacts: [...prev.artifacts, artifact],
      activeArtifactId: artifact.id,
      isExpanded: true, // Auto-expand when artifact is added
    }));
  }, []);

  const updateArtifact = useCallback(
    (id: number, updates: Partial<Artifact>) => {
      setState((prev) => ({
        ...prev,
        artifacts: prev.artifacts.map((a) =>
          a.id === id
            ? { ...a, ...updates, version: a.version + 1 }
            : a
        ),
      }));
    },
    []
  );

  const removeArtifact = useCallback((id: number) => {
    setState((prev) => {
      const newArtifacts = prev.artifacts.filter((a) => a.id !== id);
      return {
        ...prev,
        artifacts: newArtifacts,
        activeArtifactId:
          prev.activeArtifactId === id
            ? newArtifacts[0]?.id ?? null
            : prev.activeArtifactId,
        isExpanded: newArtifacts.length > 0 ? prev.isExpanded : false,
      };
    });
  }, []);

  const setActiveArtifact = useCallback((id: number | null) => {
    setState((prev) => ({
      ...prev,
      activeArtifactId: id,
    }));
  }, []);

  const toggleExpanded = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isExpanded: !prev.isExpanded,
    }));
  }, []);

  const setSplitRatio = useCallback((ratio: number) => {
    setState((prev) => ({
      ...prev,
      splitRatio: Math.min(80, Math.max(20, ratio)),
    }));
  }, []);

  const clearArtifacts = useCallback(() => {
    setState((prev) => ({
      ...prev,
      artifacts: [],
      activeArtifactId: null,
      isExpanded: false,
    }));
  }, []);

  const getArtifact = useCallback(
    (id: number) => state.artifacts.find((a) => a.id === id),
    [state.artifacts]
  );

  return (
    <ArtifactContext.Provider
      value={{
        state,
        addArtifact,
        updateArtifact,
        removeArtifact,
        setActiveArtifact,
        toggleExpanded,
        setSplitRatio,
        clearArtifacts,
        getArtifact,
      }}
    >
      {children}
    </ArtifactContext.Provider>
  );
}

/**
 * Hook to access the artifact context.
 *
 * @throws Error if used outside of ArtifactProvider
 */
export function useArtifacts() {
  const context = useContext(ArtifactContext);
  if (!context) {
    throw new Error('useArtifacts must be used within ArtifactProvider');
  }
  return context;
}

/**
 * Hook to get the active artifact.
 */
export function useActiveArtifact() {
  const { state, getArtifact } = useArtifacts();
  return state.activeArtifactId ? getArtifact(state.activeArtifactId) : null;
}

export default ArtifactContext;
