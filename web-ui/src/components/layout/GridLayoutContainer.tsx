'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { GripVertical, Maximize2, Minimize2, X, RotateCcw, Settings2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface GridPanelConfig {
  id: string;
  title: string;
  icon?: React.ReactNode;
  component: React.ReactNode;
  defaultSize?: { cols: number; rows: number };
  closable?: boolean;
  collapsible?: boolean;
}

export interface GridLayoutConfig {
  panels: string[];
  columns: number;
}

interface GridLayoutContainerProps {
  panels: GridPanelConfig[];
  storageKey?: string;
  className?: string;
  columns?: number;
}

// ============================================================================
// Panel Header Component
// ============================================================================

interface PanelHeaderProps {
  title: string;
  icon?: React.ReactNode;
  isCollapsed: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  closable?: boolean;
  collapsible?: boolean;
}

function PanelHeader({
  title,
  icon,
  isCollapsed,
  onToggleCollapse,
  onClose,
  closable = true,
  collapsible = true,
}: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-slate-400 cursor-grab active:cursor-grabbing" />
        {icon && <span className="text-slate-500 dark:text-slate-400">{icon}</span>}
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {collapsible && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {closable && onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Grid Layout Container
// ============================================================================

export function GridLayoutContainer({
  panels,
  storageKey = 'grid-layout',
  className = '',
  columns = 2,
}: GridLayoutContainerProps) {
  // Panel visibility state
  const [visiblePanels, setVisiblePanels] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`${storageKey}-visible`);
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          // Invalid stored data
        }
      }
    }
    return new Set(panels.map((p) => p.id));
  });

  // Collapsed panels state
  const [collapsedPanels, setCollapsedPanels] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`${storageKey}-collapsed`);
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          // Invalid stored data
        }
      }
    }
    return new Set();
  });

  // Persist visibility changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${storageKey}-visible`, JSON.stringify([...visiblePanels]));
    }
  }, [storageKey, visiblePanels]);

  // Persist collapsed changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${storageKey}-collapsed`, JSON.stringify([...collapsedPanels]));
    }
  }, [storageKey, collapsedPanels]);

  // Toggle panel visibility
  const togglePanelVisibility = useCallback((panelId: string) => {
    setVisiblePanels((prev) => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  }, []);

  // Toggle panel collapse
  const togglePanelCollapse = useCallback((panelId: string) => {
    setCollapsedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  }, []);

  // Reset layout to defaults
  const resetLayout = useCallback(() => {
    setVisiblePanels(new Set(panels.map((p) => p.id)));
    setCollapsedPanels(new Set());
  }, [panels]);

  // Filter visible panels
  const visiblePanelConfigs = useMemo(
    () => panels.filter((p) => visiblePanels.has(p.id)),
    [panels, visiblePanels]
  );

  return (
    <div className={`relative ${className}`}>
      {/* Layout Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Layout ({visiblePanelConfigs.length} panels)
          </span>
        </div>
        <button
          onClick={resetLayout}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label="Reset layout"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Grid Layout */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {visiblePanelConfigs.map((panel) => {
          const isCollapsed = collapsedPanels.has(panel.id);
          const colSpan = panel.defaultSize?.cols || 1;

          return (
            <div
              key={panel.id}
              className="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden flex flex-col"
              style={{
                gridColumn: `span ${Math.min(colSpan, columns)}`,
              }}
            >
              <PanelHeader
                title={panel.title}
                icon={panel.icon}
                isCollapsed={isCollapsed}
                onToggleCollapse={
                  panel.collapsible !== false ? () => togglePanelCollapse(panel.id) : undefined
                }
                onClose={
                  panel.closable !== false ? () => togglePanelVisibility(panel.id) : undefined
                }
                closable={panel.closable}
                collapsible={panel.collapsible}
              />
              {!isCollapsed && (
                <div className="flex-1 overflow-auto p-3 min-h-[200px]">{panel.component}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hidden Panels Restore Menu */}
      {panels.length > visiblePanels.size && (
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Hidden Panels
          </p>
          <div className="flex flex-wrap gap-2">
            {panels
              .filter((p) => !visiblePanels.has(p.id))
              .map((panel) => (
                <button
                  key={panel.id}
                  onClick={() => togglePanelVisibility(panel.id)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-colors"
                >
                  {panel.icon}
                  {panel.title}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Hook for Managing Grid Layout State
// ============================================================================

export function useGridLayout(storageKey: string) {
  const [visiblePanels, setVisiblePanels] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`${storageKey}-visible`);
      if (saved) {
        try {
          setVisiblePanels(JSON.parse(saved));
        } catch {
          // Invalid stored data
        }
      }
    }
  }, [storageKey]);

  const saveLayout = useCallback(
    (panels: string[]) => {
      setVisiblePanels(panels);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${storageKey}-visible`, JSON.stringify(panels));
      }
    },
    [storageKey]
  );

  const clearLayout = useCallback(() => {
    setVisiblePanels([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${storageKey}-visible`);
      localStorage.removeItem(`${storageKey}-collapsed`);
    }
  }, [storageKey]);

  return { visiblePanels, saveLayout, clearLayout };
}
