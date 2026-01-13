'use client';

import { memo, useState, useCallback } from 'react';
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Grid3X3,
  Map, Save, Play, Pause, Square, Download, Upload,
  LayoutGrid, Search, Keyboard, HelpCircle, Settings,
  ChevronDown, Check, Copy, Trash2, AlignCenter, Layers,
  FileCode, Terminal, Code2
} from 'lucide-react';
import { formatShortcut, groupShortcutsByCategory } from '../hooks/useKeyboardShortcuts';
import { ModeSelector } from './ModeSelector';

interface CanvasToolbarProps {
  // Mode selector (new)
  showModeSelector?: boolean;

  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // Zoom
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onResetZoom: () => void;

  // View toggles
  showGrid: boolean;
  onToggleGrid: () => void;

  // Actions
  onSave: () => void;
  onRun: () => void;
  onExport: () => void;
  onImport: () => void;
  onAutoLayout: () => void;

  // Selection
  hasSelection: boolean;
  selectionCount: number;
  onCopy: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGroup: () => void;

  // State
  isSaving: boolean;
  isRunning: boolean;
  isValid: boolean;
  validationErrors: string[];

  // Search
  onSearchOpen: () => void;
}

export const CanvasToolbar = memo(({
  showModeSelector = true,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetZoom,
  showGrid,
  onToggleGrid,
  onSave,
  onRun,
  onExport,
  onImport,
  onAutoLayout,
  hasSelection,
  selectionCount,
  onCopy,
  onDelete,
  onDuplicate,
  onGroup,
  isSaving,
  isRunning,
  isValid,
  validationErrors,
  onSearchOpen,
}: CanvasToolbarProps) => {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);

  const zoomPercentage = Math.round(zoom * 100);

  const handleZoomPreset = useCallback((value: number) => {
    // This would need to be passed from parent
    setShowZoomMenu(false);
  }, []);

  return (
    <>
      <div className="h-12 bg-slate-800/95 backdrop-blur border-b border-slate-700 flex items-center px-2 gap-1">
        {/* Mode Selector - Primary position on left */}
        {showModeSelector && (
          <>
            <ModeSelector compact={false} showHelp={true} />
            <ToolbarDivider />
          </>
        )}

        {/* History Controls */}
        <div className="flex items-center gap-0.5 px-1">
          <ToolbarButton
            icon={Undo2}
            onClick={onUndo}
            disabled={!canUndo}
            tooltip="Undo (Ctrl+Z)"
          />
          <ToolbarButton
            icon={Redo2}
            onClick={onRedo}
            disabled={!canRedo}
            tooltip="Redo (Ctrl+Y)"
          />
        </div>

        <ToolbarDivider />

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5 px-1">
          <ToolbarButton icon={ZoomOut} onClick={onZoomOut} tooltip="Zoom Out (Ctrl+-)" />

          <div className="relative">
            <button
              onClick={() => setShowZoomMenu(!showZoomMenu)}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-mono
                       text-slate-300 hover:bg-slate-700 transition-colors min-w-[60px] justify-center"
            >
              {zoomPercentage}%
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>

            {showZoomMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700
                            rounded-lg shadow-xl py-1 min-w-[100px] z-50">
                {[25, 50, 75, 100, 125, 150, 200].map((value) => (
                  <button
                    key={value}
                    onClick={() => {
                      onResetZoom();
                      setShowZoomMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300
                             hover:bg-slate-700 flex items-center justify-between"
                  >
                    {value}%
                    {zoomPercentage === value && <Check className="w-3 h-3 text-cyan-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ToolbarButton icon={ZoomIn} onClick={onZoomIn} tooltip="Zoom In (Ctrl+=)" />
          <ToolbarButton icon={Maximize2} onClick={onFitView} tooltip="Fit to View (Ctrl+1)" />
        </div>

        <ToolbarDivider />

        {/* View Toggles */}
        <div className="flex items-center gap-0.5 px-1">
          <ToolbarToggle
            icon={Grid3X3}
            isActive={showGrid}
            onClick={onToggleGrid}
            tooltip="Toggle Grid (Ctrl+G)"
          />
          <ToolbarButton
            icon={LayoutGrid}
            onClick={onAutoLayout}
            tooltip="Auto Layout (Ctrl+Shift+L)"
          />
        </div>

        <ToolbarDivider />

        {/* Selection Actions */}
        {hasSelection && (
          <>
            <div className="flex items-center gap-0.5 px-1">
              <span className="text-xs text-slate-500 mr-1">{selectionCount} selected</span>
              <ToolbarButton icon={Copy} onClick={onCopy} tooltip="Copy (Ctrl+C)" />
              <ToolbarButton icon={Layers} onClick={onDuplicate} tooltip="Duplicate (Ctrl+D)" />
              <ToolbarButton icon={AlignCenter} onClick={onGroup} tooltip="Group" />
              <ToolbarButton icon={Trash2} onClick={onDelete} variant="danger" tooltip="Delete (Del)" />
            </div>
            <ToolbarDivider />
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <ToolbarButton
          icon={Search}
          onClick={onSearchOpen}
          tooltip="Search Nodes (Ctrl+F)"
        />

        <ToolbarDivider />

        {/* Import/Export */}
        <div className="flex items-center gap-0.5 px-1">
          <ToolbarButton icon={Upload} onClick={onImport} tooltip="Import Workflow" />
          <ToolbarButton icon={Download} onClick={onExport} tooltip="Export Workflow" />
        </div>

        <ToolbarDivider />

        {/* Shortcuts Help */}
        <ToolbarButton
          icon={Keyboard}
          onClick={() => setShowShortcuts(true)}
          tooltip="Keyboard Shortcuts"
        />

        <ToolbarDivider />

        {/* Validation Status */}
        {!isValid && validationErrors.length > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 rounded text-amber-400 text-xs">
            <HelpCircle className="w-3 h-3" />
            {validationErrors.length} {validationErrors.length === 1 ? 'issue' : 'issues'}
          </div>
        )}

        {/* Run/Save Actions */}
        <div className="flex items-center gap-2 pl-2">
          <button
            onClick={onRun}
            disabled={isRunning || !isValid}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                      transition-colors ${
                        isRunning
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Test Run
              </>
            )}
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium
                     bg-cyan-600 text-white hover:bg-cyan-500 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </>
  );
});

CanvasToolbar.displayName = 'CanvasToolbar';

// ============================================================================
// Helper Components
// ============================================================================

interface ToolbarButtonProps {
  icon: typeof Save;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
  variant?: 'default' | 'danger';
}

const ToolbarButton = memo(({ icon: Icon, onClick, disabled, tooltip, variant = 'default' }: ToolbarButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={tooltip}
    className={`p-1.5 rounded transition-colors ${
      variant === 'danger'
        ? 'text-red-400 hover:bg-red-500/20 disabled:opacity-50'
        : 'text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-50'
    } disabled:cursor-not-allowed`}
  >
    <Icon className="w-4 h-4" />
  </button>
));
ToolbarButton.displayName = 'ToolbarButton';

interface ToolbarToggleProps {
  icon: typeof Grid3X3;
  isActive: boolean;
  onClick: () => void;
  tooltip?: string;
}

const ToolbarToggle = memo(({ icon: Icon, isActive, onClick, tooltip }: ToolbarToggleProps) => (
  <button
    onClick={onClick}
    title={tooltip}
    className={`p-1.5 rounded transition-colors ${
      isActive
        ? 'bg-cyan-500/20 text-cyan-400'
        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
    }`}
  >
    <Icon className="w-4 h-4" />
  </button>
));
ToolbarToggle.displayName = 'ToolbarToggle';

const ToolbarDivider = memo(() => (
  <div className="w-px h-6 bg-slate-700 mx-1" />
));
ToolbarDivider.displayName = 'ToolbarDivider';

// ============================================================================
// Shortcuts Modal
// ============================================================================

const ShortcutsModal = memo(({ onClose }: { onClose: () => void }) => {
  const groupedShortcuts = groupShortcutsByCategory();

  const categoryLabels: Record<string, string> = {
    editing: 'Editing',
    navigation: 'Navigation',
    view: 'View',
    workflow: 'Workflow',
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-cyan-400" />
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <Square className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-6">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-slate-400 mb-3">
                  {categoryLabels[category] || category}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={`${shortcut.key}-${shortcut.modifiers.join('-')}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-300">{shortcut.description}</span>
                      <kbd className="px-2 py-0.5 rounded bg-slate-700 text-slate-400 text-xs font-mono">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/50">
          <p className="text-xs text-slate-500 text-center">
            Press <kbd className="px-1 py-0.5 rounded bg-slate-700 text-slate-400">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
});
ShortcutsModal.displayName = 'ShortcutsModal';

export default CanvasToolbar;
