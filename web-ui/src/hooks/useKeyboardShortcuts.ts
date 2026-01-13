'use client';

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'meta' | 'alt' | 'shift')[];
  handler: (event: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  scope?: 'global' | 'local';
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
  scope = 'global',
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs (unless it's Escape)
      const target = event.target as HTMLElement;
      const isInInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        // Check if the key matches
        const keyMatches =
          event.key.toLowerCase() === shortcut.key.toLowerCase() ||
          event.code.toLowerCase() === shortcut.key.toLowerCase();

        if (!keyMatches) continue;

        // Check modifiers
        const modifiers = shortcut.modifiers || [];
        const ctrlRequired = modifiers.includes('ctrl');
        const metaRequired = modifiers.includes('meta');
        const altRequired = modifiers.includes('alt');
        const shiftRequired = modifiers.includes('shift');

        const ctrlPressed = event.ctrlKey;
        const metaPressed = event.metaKey;
        const altPressed = event.altKey;
        const shiftPressed = event.shiftKey;

        // Treat Ctrl and Meta as equivalent for cross-platform compatibility
        const cmdOrCtrlRequired = ctrlRequired || metaRequired;
        const cmdOrCtrlPressed = ctrlPressed || metaPressed;

        const modifiersMatch =
          (!cmdOrCtrlRequired || cmdOrCtrlPressed) &&
          (cmdOrCtrlRequired || (!ctrlPressed && !metaPressed)) &&
          (!altRequired || altPressed) &&
          (altRequired || !altPressed) &&
          (!shiftRequired || shiftPressed) &&
          (shiftRequired || !shiftPressed);

        if (!modifiersMatch) continue;

        // Skip if in input unless it's a navigation key or specifically allowed
        if (isInInput && event.key !== 'Escape' && shortcut.key !== 'Escape') {
          // Allow Ctrl/Cmd shortcuts in inputs
          if (!cmdOrCtrlPressed) continue;
        }

        // Execute handler
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.handler(event);
        return;
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    const target = scope === 'global' ? window : document;
    target.addEventListener('keydown', handleKeyDown as EventListener);
    return () => {
      target.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [handleKeyDown, scope]);
}

// Pre-defined common shortcuts
export const commonShortcuts = {
  commandPalette: (handler: () => void): KeyboardShortcut => ({
    key: 'k',
    modifiers: ['meta'],
    handler,
    description: 'Open command palette',
  }),
  search: (handler: () => void): KeyboardShortcut => ({
    key: '/',
    handler,
    description: 'Focus search',
  }),
  escape: (handler: () => void): KeyboardShortcut => ({
    key: 'Escape',
    handler,
    description: 'Close/Cancel',
    preventDefault: false,
  }),
  newChat: (handler: () => void): KeyboardShortcut => ({
    key: 'n',
    modifiers: ['meta'],
    handler,
    description: 'New chat',
  }),
  clearChat: (handler: () => void): KeyboardShortcut => ({
    key: 'l',
    modifiers: ['meta', 'shift'],
    handler,
    description: 'Clear chat',
  }),
  toggleSidebar: (handler: () => void): KeyboardShortcut => ({
    key: 'b',
    modifiers: ['meta'],
    handler,
    description: 'Toggle sidebar',
  }),
  toggleAgentFlow: (handler: () => void): KeyboardShortcut => ({
    key: 'f',
    modifiers: ['meta'],
    handler,
    description: 'Toggle agent flow',
  }),
  editLastMessage: (handler: () => void): KeyboardShortcut => ({
    key: 'ArrowUp',
    handler,
    description: 'Edit last message',
  }),
};

// Hook to show keyboard shortcuts help
export function useShortcutsHelp(shortcuts: KeyboardShortcut[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const getShortcutsList = useCallback(() => {
    return shortcutsRef.current
      .filter((s) => s.description)
      .map((s) => ({
        key: formatShortcut(s.key, s.modifiers),
        description: s.description!,
      }));
  }, []);

  return { getShortcutsList };
}

function formatShortcut(key: string, modifiers?: string[]): string {
  const parts: string[] = [];

  if (modifiers?.includes('meta') || modifiers?.includes('ctrl')) {
    parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
  }
  if (modifiers?.includes('alt')) {
    parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
  }
  if (modifiers?.includes('shift')) {
    parts.push('⇧');
  }

  // Format key
  let formattedKey = key;
  switch (key.toLowerCase()) {
    case 'arrowup':
      formattedKey = '↑';
      break;
    case 'arrowdown':
      formattedKey = '↓';
      break;
    case 'arrowleft':
      formattedKey = '←';
      break;
    case 'arrowright':
      formattedKey = '→';
      break;
    case 'escape':
      formattedKey = 'Esc';
      break;
    case 'enter':
      formattedKey = '↵';
      break;
    default:
      formattedKey = key.toUpperCase();
  }

  parts.push(formattedKey);
  return parts.join('');
}
