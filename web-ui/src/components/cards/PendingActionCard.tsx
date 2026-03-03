'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PendingAction } from '@/services/pendingActionsService';

interface PendingActionCardProps {
  action: PendingAction;
  onApprove?: (actionId: string) => Promise<void>;
  onReject?: (actionId: string, reason?: string) => Promise<void>;
  onComplete?: (actionId: string, success: boolean) => void;
}

const RISK_COLORS = {
  low: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  high: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  },
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  update_ssid: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  update_network: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  apply_traffic_shaping: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  update_firewall: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  default: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

function getToolIcon(toolName: string): React.ReactNode {
  const normalizedName = toolName.toLowerCase();
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (normalizedName.includes(key)) {
      return icon;
    }
  }
  return TOOL_ICONS.default;
}

function formatTimeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function PendingActionCard({
  action,
  onApprove,
  onReject,
  onComplete,
}: PendingActionCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'approve' | 'reject' | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [status, setStatus] = useState(action.status);
  const [error, setError] = useState<string | null>(null);

  const riskColors = RISK_COLORS[action.risk_level] || RISK_COLORS.medium;

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsLoading(true);
    setLoadingAction('approve');
    setError(null);

    try {
      await onApprove(action.id);
      setStatus('approved');
      onComplete?.(action.id, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve action');
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsLoading(true);
    setLoadingAction('reject');
    setError(null);

    try {
      await onReject(action.id);
      setStatus('rejected');
      onComplete?.(action.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject action');
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const isPending = status === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${riskColors.border} ${riskColors.bg} overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${riskColors.badge}`}>
            {getToolIcon(action.tool_name)}
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">
              AI Action Requires Approval
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatTimeAgo(action.created_at)}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${riskColors.badge}`}>
          {action.risk_level.charAt(0).toUpperCase() + action.risk_level.slice(1)} Risk
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className={`text-sm ${riskColors.text} mb-3`}>
          {action.description || `Execute ${action.tool_name} with the parameters below`}
        </p>

        {/* Tool Input Details (Expandable) */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mb-3"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showDetails ? 'Hide' : 'Show'} details
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3 mb-3">
                <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Tool: {action.tool_name}
                </p>
                <pre className="text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                  {JSON.stringify(action.tool_input, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {error && (
          <div className="mb-3 p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        {isPending && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-sm font-medium transition-colors"
            >
              {loadingAction === 'approve' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              Approve
            </button>
            <button
              onClick={handleReject}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:bg-slate-200/50 dark:disabled:bg-slate-700/50 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
            >
              {loadingAction === 'reject' ? (
                <div className="w-4 h-4 border-2 border-slate-500/30 border-t-slate-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              Reject
            </button>
          </div>
        )}

        {/* Status Indicator (when not pending) */}
        {!isPending && (
          <div
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${
              status === 'approved' || status === 'executed'
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : status === 'rejected'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {status === 'approved' || status === 'executed' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium">
                  {status === 'executed' ? 'Executed' : 'Approved'}
                </span>
              </>
            ) : status === 'rejected' ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-sm font-medium">Rejected</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium capitalize">{status}</span>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
