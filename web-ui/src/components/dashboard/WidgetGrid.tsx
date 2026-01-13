'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import { GripVertical, X, Plus, RotateCcw, Settings2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface WidgetConfig {
  id: string;
  title: string;
  component: React.ReactNode;
  defaultLayout: {
    w: number; // 1-4 columns
    h: number; // Row span
    minW?: number;
    minH?: number;
  };
  removable?: boolean;
}

export interface WidgetGridProps {
  widgets: WidgetConfig[];
  storageKey?: string;
  onLayoutChange?: (visibleWidgets: string[]) => void;
  className?: string;
}

// ============================================================================
// Storage Helpers
// ============================================================================

const STORAGE_KEY_PREFIX = 'lumen-dashboard-';

function saveHiddenWidgets(key: string, hidden: string[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}-hidden`, JSON.stringify(hidden));
  } catch (e) {
    console.warn('Failed to save hidden widgets:', e);
  }
}

function loadHiddenWidgets(key: string): string[] {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}-hidden`);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.warn('Failed to load hidden widgets:', e);
    return [];
  }
}

// ============================================================================
// WidgetCard Component
// ============================================================================

function WidgetCard({
  widget,
  onRemove,
  isEditing,
}: {
  widget: WidgetConfig;
  onRemove?: () => void;
  isEditing: boolean;
}) {
  // Calculate column span class
  const colSpanClass = {
    1: 'col-span-1',
    2: 'col-span-1 md:col-span-2',
    3: 'col-span-1 md:col-span-2 lg:col-span-3',
    4: 'col-span-1 md:col-span-2 lg:col-span-4',
  }[widget.defaultLayout.w] || 'col-span-1';

  return (
    <div className={`${colSpanClass} relative group`}>
      {/* Edit Overlay */}
      {isEditing && (
        <div className="absolute inset-0 z-10 bg-slate-900/5 dark:bg-slate-100/5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
            <GripVertical className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {widget.title}
            </span>
            {widget.removable && onRemove && (
              <button
                onClick={onRemove}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                title="Remove widget"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Widget Content */}
      <div className={`h-full ${isEditing ? 'pointer-events-none opacity-75' : ''}`}>
        {widget.component}
      </div>
    </div>
  );
}

// ============================================================================
// WidgetGrid Component
// ============================================================================

export const WidgetGrid = memo(({
  widgets,
  storageKey = 'default',
  onLayoutChange,
  className = '',
}: WidgetGridProps) => {
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  // Load hidden widgets from storage
  useEffect(() => {
    const saved = loadHiddenWidgets(storageKey);
    setHiddenWidgets(saved);
  }, [storageKey]);

  // Remove widget
  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      const newHidden = [...hiddenWidgets, widgetId];
      setHiddenWidgets(newHidden);
      saveHiddenWidgets(storageKey, newHidden);
      onLayoutChange?.(widgets.filter((w) => !newHidden.includes(w.id)).map((w) => w.id));
    },
    [hiddenWidgets, storageKey, onLayoutChange, widgets]
  );

  // Restore widget
  const handleRestoreWidget = useCallback(
    (widgetId: string) => {
      const newHidden = hiddenWidgets.filter((id) => id !== widgetId);
      setHiddenWidgets(newHidden);
      saveHiddenWidgets(storageKey, newHidden);
      onLayoutChange?.(widgets.filter((w) => !newHidden.includes(w.id)).map((w) => w.id));
    },
    [hiddenWidgets, storageKey, onLayoutChange, widgets]
  );

  // Reset layout
  const handleResetLayout = useCallback(() => {
    setHiddenWidgets([]);
    saveHiddenWidgets(storageKey, []);
    onLayoutChange?.(widgets.map((w) => w.id));
  }, [storageKey, onLayoutChange, widgets]);

  // Filter visible widgets
  const visibleWidgets = widgets.filter((w) => !hiddenWidgets.includes(w.id));

  return (
    <div className={className}>
      {/* Edit Controls */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {hiddenWidgets.length > 0 && (
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-xs text-slate-500 dark:text-slate-400">Hidden:</span>
            {hiddenWidgets.map((id) => {
              const widget = widgets.find((w) => w.id === id);
              return widget ? (
                <button
                  key={id}
                  onClick={() => handleRestoreWidget(id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {widget.title}
                </button>
              ) : null;
            })}
          </div>
        )}

        <button
          onClick={handleResetLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title="Reset to default layout"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            isEditing
              ? 'bg-cyan-500 text-white hover:bg-cyan-600'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          {isEditing ? 'Done' : 'Customize'}
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {visibleWidgets.map((widget) => (
          <WidgetCard
            key={widget.id}
            widget={widget}
            isEditing={isEditing}
            onRemove={widget.removable ? () => handleRemoveWidget(widget.id) : undefined}
          />
        ))}
      </div>

      {/* Empty State */}
      {visibleWidgets.length === 0 && (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
            <Settings2 className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No widgets visible</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Click "Reset" to restore default layout</p>
        </div>
      )}
    </div>
  );
});

WidgetGrid.displayName = 'WidgetGrid';

export default WidgetGrid;
