'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Pin, PinOff } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type DrawerPosition = 'left' | 'right' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'auto';

export interface ContextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  position?: DrawerPosition;
  size?: DrawerSize;
  showOverlay?: boolean;
  pinnable?: boolean;
  isPinned?: boolean;
  onPin?: (pinned: boolean) => void;
  contextTrigger?: string; // Keywords that auto-open the drawer
  className?: string;
}

// ============================================================================
// Size Configurations
// ============================================================================

const sizeClasses: Record<DrawerPosition, Record<DrawerSize, string>> = {
  left: {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[480px]',
    auto: 'w-auto min-w-64 max-w-[50vw]',
  },
  right: {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[480px]',
    auto: 'w-auto min-w-64 max-w-[50vw]',
  },
  bottom: {
    sm: 'h-48',
    md: 'h-64',
    lg: 'h-96',
    xl: 'h-[480px]',
    auto: 'h-auto min-h-48 max-h-[50vh]',
  },
};

const positionClasses: Record<DrawerPosition, string> = {
  left: 'left-0 top-0 h-full',
  right: 'right-0 top-0 h-full',
  bottom: 'bottom-0 left-0 w-full',
};

// ============================================================================
// Animation Variants
// ============================================================================

const drawerVariants: Record<DrawerPosition, Variants> = {
  left: {
    hidden: { x: '-100%', opacity: 0 },
    visible: { x: 0, opacity: 1 },
  },
  right: {
    hidden: { x: '100%', opacity: 0 },
    visible: { x: 0, opacity: 1 },
  },
  bottom: {
    hidden: { y: '100%', opacity: 0 },
    visible: { y: 0, opacity: 1 },
  },
};

// ============================================================================
// Context Drawer Component
// ============================================================================

export function ContextDrawer({
  isOpen,
  onClose,
  title,
  icon,
  children,
  position = 'right',
  size = 'md',
  showOverlay = false,
  pinnable = false,
  isPinned = false,
  onPin,
  className = '',
}: ContextDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close (only if not pinned and no overlay)
  useEffect(() => {
    if (!isOpen || isPinned || showOverlay) return;

    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isPinned, showOverlay, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPinned) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPinned, onClose]);

  const handlePin = useCallback(() => {
    onPin?.(!isPinned);
  }, [isPinned, onPin]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          {showOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={isPinned ? undefined : onClose}
              aria-hidden="true"
            />
          )}

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            variants={drawerVariants[position]}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed z-50 bg-white dark:bg-slate-800 shadow-xl border-slate-200 dark:border-slate-700 ${
              position === 'left' ? 'border-r' : position === 'right' ? 'border-l' : 'border-t'
            } ${positionClasses[position]} ${sizeClasses[position][size]} ${className}`}
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Context panel'}
          >
            {/* Header */}
            {(title || pinnable) && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-2">
                  {icon && <span className="text-slate-500 dark:text-slate-400">{icon}</span>}
                  {title && (
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {title}
                    </h3>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {pinnable && (
                    <button
                      onClick={handlePin}
                      className={`p-1.5 rounded transition-colors ${
                        isPinned
                          ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}
                      aria-label={isPinned ? 'Unpin panel' : 'Pin panel'}
                      title={isPinned ? 'Unpin panel' : 'Pin panel'}
                    >
                      {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                    aria-label="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Drawer Toggle Button
// ============================================================================

interface DrawerToggleProps {
  isOpen: boolean;
  onClick: () => void;
  position?: 'left' | 'right';
  className?: string;
}

export function DrawerToggle({
  isOpen,
  onClick,
  position = 'right',
  className = '',
}: DrawerToggleProps) {
  const Icon = position === 'left' ? (isOpen ? ChevronLeft : ChevronRight) : isOpen ? ChevronRight : ChevronLeft;

  return (
    <button
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 z-50 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
        position === 'left' ? '-right-3' : '-left-3'
      } ${className}`}
      aria-label={isOpen ? 'Close panel' : 'Open panel'}
    >
      <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
    </button>
  );
}

// ============================================================================
// useContextDrawer Hook
// ============================================================================

interface UseContextDrawerOptions {
  defaultOpen?: boolean;
  defaultPinned?: boolean;
  contextKeywords?: string[];
  onOpen?: () => void;
  onClose?: () => void;
}

export function useContextDrawer(options: UseContextDrawerOptions = {}) {
  const {
    defaultOpen = false,
    defaultPinned = false,
    contextKeywords = [],
    onOpen,
    onClose: onCloseCallback,
  } = options;

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isPinned, setIsPinned] = useState(defaultPinned);

  const open = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const close = useCallback(() => {
    if (!isPinned) {
      setIsOpen(false);
      onCloseCallback?.();
    }
  }, [isPinned, onCloseCallback]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, close, open]);

  const pin = useCallback((pinned: boolean) => {
    setIsPinned(pinned);
  }, []);

  // Check if content matches context keywords
  const checkContext = useCallback(
    (content: string) => {
      if (contextKeywords.length === 0) return false;
      const lowerContent = content.toLowerCase();
      return contextKeywords.some((keyword) => lowerContent.includes(keyword.toLowerCase()));
    },
    [contextKeywords]
  );

  // Auto-open based on context
  const triggerFromContext = useCallback(
    (content: string) => {
      if (checkContext(content)) {
        open();
      }
    },
    [checkContext, open]
  );

  return {
    isOpen,
    isPinned,
    open,
    close,
    toggle,
    pin,
    checkContext,
    triggerFromContext,
  };
}
