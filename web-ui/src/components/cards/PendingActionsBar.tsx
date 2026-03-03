'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PendingActionCard from './PendingActionCard';
import {
  fetchPendingActions,
  approvePendingAction,
  rejectPendingAction,
  type PendingAction,
} from '@/services/pendingActionsService';

interface PendingActionsBarProps {
  sessionId?: string;
  onActionComplete?: (actionId: string, approved: boolean) => void;
  className?: string;
}

export default function PendingActionsBar({
  sessionId,
  onActionComplete,
  className = '',
}: PendingActionsBarProps) {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Fetch pending actions
  const loadActions = useCallback(async () => {
    try {
      const response = await fetchPendingActions(sessionId, 'pending');
      setActions(response.actions);
      setError(null);
    } catch (err) {
      console.error('Failed to load pending actions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending actions');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Initial load and polling
  useEffect(() => {
    loadActions();
    const interval = setInterval(loadActions, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [loadActions]);

  const handleApprove = useCallback(async (actionId: string) => {
    await approvePendingAction(actionId);
    // Remove from local state immediately
    setActions((prev) => prev.filter((a) => a.id !== actionId));
    onActionComplete?.(actionId, true);
  }, [onActionComplete]);

  const handleReject = useCallback(async (actionId: string, reason?: string) => {
    await rejectPendingAction(actionId, reason);
    // Remove from local state immediately
    setActions((prev) => prev.filter((a) => a.id !== actionId));
    onActionComplete?.(actionId, false);
  }, [onActionComplete]);

  const handleComplete = useCallback((actionId: string) => {
    // Remove the action from the list after completion animation
    setTimeout(() => {
      setActions((prev) => prev.filter((a) => a.id !== actionId));
    }, 500);
  }, []);

  // Don't render if no pending actions
  if (isLoading || actions.length === 0) {
    return null;
  }

  return (
    <div className={`border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50 ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="w-4 h-4 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {actions.length} Action{actions.length !== 1 ? 's' : ''} Pending Approval
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Actions List */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {actions.map((action) => (
                <PendingActionCard
                  key={action.id}
                  action={action}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onComplete={handleComplete}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
