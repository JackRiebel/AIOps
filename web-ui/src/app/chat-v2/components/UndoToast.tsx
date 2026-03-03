'use client';

/**
 * UndoToast - Soft Delete with Undo
 *
 * Shows a toast notification when items are deleted,
 * allowing the user to undo within a grace period.
 */

import { memo, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface UndoAction {
  id: string;
  message: string;
  onUndo: () => void;
  duration?: number; // Grace period in ms (default 5000)
}

interface UndoToastProps {
  action: UndoAction | null;
  onComplete: () => void;
}

export const UndoToast = memo(({ action, onComplete }: UndoToastProps) => {
  const [progress, setProgress] = useState(100);
  const duration = action?.duration ?? 5000;

  useEffect(() => {
    if (!action) {
      setProgress(100);
      return;
    }

    // Start progress animation
    setProgress(100);
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [action, duration, onComplete]);

  const handleUndo = useCallback(() => {
    if (action) {
      action.onUndo();
      onComplete();
    }
  }, [action, onComplete]);

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-4 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl">
            {/* Message */}
            <span className="text-sm text-slate-300">{action.message}</span>

            {/* Undo button */}
            <button
              onClick={handleUndo}
              className="px-3 py-1.5 text-sm font-medium text-cyan-400 hover:text-cyan-300
                bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-colors"
            >
              Undo
            </button>

            {/* Progress bar */}
            <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-cyan-500"
                initial={{ width: '100%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.05, ease: 'linear' }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={onComplete}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

UndoToast.displayName = 'UndoToast';

export default UndoToast;
