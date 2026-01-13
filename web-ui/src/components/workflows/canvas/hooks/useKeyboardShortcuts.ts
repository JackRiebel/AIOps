/**
 * Keyboard Shortcuts Hook - WCAG 2.1 Compliant
 *
 * Implements keyboard navigation and shortcuts for the workflow canvas.
 * Follows WCAG SC 2.1.4 guidelines for character key shortcuts.
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html
 */

import { useCallback, useEffect, useRef } from 'react';
import { KEYBOARD_SHORTCUTS, KeyboardShortcut } from '../types';

export interface KeyboardShortcutHandlers {
  // Editing
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onCut?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onDeselect?: () => void;

  // Navigation
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onFocusNext?: () => void;
  onFocusPrev?: () => void;

  // View
  onResetZoom?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onToggleMinimap?: () => void;
  onToggleGrid?: () => void;

  // Workflow
  onSave?: () => void;
  onRun?: () => void;
  onSearch?: () => void;
  onAutoLayout?: () => void;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefaultOnMatch?: boolean;
}

export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  options: UseKeyboardShortcutsOptions = {}
): {
  shortcuts: KeyboardShortcut[];
  isEnabled: boolean;
} {
  const { enabled = true, preventDefaultOnMatch = true } = options;
  const handlersRef = useRef(handlers);

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Allow Escape in inputs
      if (event.key !== 'Escape') return;
    }

    const currentHandlers = handlersRef.current;

    // Check each shortcut
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                       event.key === shortcut.key;

      if (!keyMatch) continue;

      // Check modifiers
      const ctrlMatch = shortcut.modifiers.includes('ctrl') === (event.ctrlKey || event.metaKey);
      const shiftMatch = shortcut.modifiers.includes('shift') === event.shiftKey;
      const altMatch = shortcut.modifiers.includes('alt') === event.altKey;

      if (!ctrlMatch || !shiftMatch || !altMatch) continue;

      // Found a match - get the handler
      const handlerName = `on${shortcut.action.charAt(0).toUpperCase()}${shortcut.action.slice(1)}` as keyof KeyboardShortcutHandlers;
      const handler = currentHandlers[handlerName];

      if (handler) {
        if (preventDefaultOnMatch) {
          event.preventDefault();
          event.stopPropagation();
        }
        handler();
        return;
      }
    }
  }, [enabled, preventDefaultOnMatch]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    shortcuts: KEYBOARD_SHORTCUTS,
    isEnabled: enabled,
  };
}

/**
 * Format a keyboard shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.modifiers.includes('ctrl')) {
    parts.push(navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl');
  }
  if (shortcut.modifiers.includes('shift')) {
    parts.push(navigator.platform.includes('Mac') ? '\u21E7' : 'Shift');
  }
  if (shortcut.modifiers.includes('alt')) {
    parts.push(navigator.platform.includes('Mac') ? '\u2325' : 'Alt');
  }

  // Format special keys
  let keyDisplay = shortcut.key;
  switch (shortcut.key) {
    case 'ArrowUp': keyDisplay = '\u2191'; break;
    case 'ArrowDown': keyDisplay = '\u2193'; break;
    case 'ArrowLeft': keyDisplay = '\u2190'; break;
    case 'ArrowRight': keyDisplay = '\u2192'; break;
    case 'Delete': keyDisplay = 'Del'; break;
    case 'Backspace': keyDisplay = '\u232B'; break;
    case 'Escape': keyDisplay = 'Esc'; break;
    case 'Tab': keyDisplay = '\u21E5'; break;
    case 'Enter': keyDisplay = '\u21B5'; break;
    default: keyDisplay = shortcut.key.toUpperCase();
  }

  parts.push(keyDisplay);

  return parts.join(navigator.platform.includes('Mac') ? '' : '+');
}

/**
 * Group shortcuts by category
 */
export function groupShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
  const groups: Record<string, KeyboardShortcut[]> = {};

  for (const shortcut of KEYBOARD_SHORTCUTS) {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = [];
    }
    groups[shortcut.category].push(shortcut);
  }

  return groups;
}

export default useKeyboardShortcuts;
