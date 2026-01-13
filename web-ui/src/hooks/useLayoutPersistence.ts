'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface LayoutState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  showAgentFlow: boolean;
  autoRemediate: boolean;
  selectedOrg: string | null;
}

const DEFAULT_LAYOUT: LayoutState = {
  leftPanelOpen: true,
  rightPanelOpen: false,
  showAgentFlow: true,
  autoRemediate: false,
  selectedOrg: null,
};

const STORAGE_KEY = 'lumen-dashboard-layout';

// ============================================================================
// Hook
// ============================================================================

export function useLayoutPersistence(initialOrg?: string) {
  const [layout, setLayout] = useState<LayoutState>(() => {
    // Initial state - will be overridden by localStorage on client
    return {
      ...DEFAULT_LAYOUT,
      selectedOrg: initialOrg || null,
    };
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<LayoutState>;
        setLayout((prev) => ({
          ...prev,
          ...parsed,
          // Keep initialOrg if provided and no stored org
          selectedOrg: parsed.selectedOrg || initialOrg || null,
        }));
      }
    } catch (e) {
      console.warn('Failed to load layout from localStorage:', e);
    }
    setIsHydrated(true);
  }, [initialOrg]);

  // Save to localStorage when layout changes
  useEffect(() => {
    if (!isHydrated) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch (e) {
      console.warn('Failed to save layout to localStorage:', e);
    }
  }, [layout, isHydrated]);

  // Individual setters for convenience
  const setLeftPanelOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    setLayout((prev) => ({
      ...prev,
      leftPanelOpen: typeof open === 'function' ? open(prev.leftPanelOpen) : open,
    }));
  }, []);

  const setRightPanelOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    setLayout((prev) => ({
      ...prev,
      rightPanelOpen: typeof open === 'function' ? open(prev.rightPanelOpen) : open,
    }));
  }, []);

  const setShowAgentFlow = useCallback((show: boolean | ((prev: boolean) => boolean)) => {
    setLayout((prev) => ({
      ...prev,
      showAgentFlow: typeof show === 'function' ? show(prev.showAgentFlow) : show,
    }));
  }, []);

  const setAutoRemediate = useCallback((auto: boolean | ((prev: boolean) => boolean)) => {
    setLayout((prev) => ({
      ...prev,
      autoRemediate: typeof auto === 'function' ? auto(prev.autoRemediate) : auto,
    }));
  }, []);

  const setSelectedOrg = useCallback((org: string | null | ((prev: string | null) => string | null)) => {
    setLayout((prev) => ({
      ...prev,
      selectedOrg: typeof org === 'function' ? org(prev.selectedOrg) : org,
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout({ ...DEFAULT_LAYOUT, selectedOrg: initialOrg || null });
  }, [initialOrg]);

  return {
    ...layout,
    isHydrated,
    setLeftPanelOpen,
    setRightPanelOpen,
    setShowAgentFlow,
    setAutoRemediate,
    setSelectedOrg,
    resetLayout,
  };
}
