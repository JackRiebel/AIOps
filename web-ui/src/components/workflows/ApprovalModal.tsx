'use client';

import { memo, useState, useCallback } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Brain, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import type { WorkflowExecution, WorkflowAction } from './types';

interface ApprovalModalProps {
  execution: WorkflowExecution;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  onClose: () => void;
}

const RISK_COLORS = {
  low: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  medium: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
  high: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
};

export const ApprovalModal = memo(({
  execution,
  onApprove,
  onReject,
  onClose,
}: ApprovalModalProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onApprove();
    } finally {
      setIsSubmitting(false);
    }
  }, [onApprove]);

  const handleReject = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onReject(rejectReason || undefined);
    } finally {
      setIsSubmitting(false);
    }
  }, [onReject, rejectReason]);

  const confidencePercent = execution.ai_confidence !== null
    ? Math.round((execution.ai_confidence || 0) * 100)
    : null;

  const confidenceColor = confidencePercent !== null
    ? confidencePercent >= 80
      ? 'text-green-600 dark:text-green-400'
      : confidencePercent >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'
    : 'text-slate-500';

  const riskColor = execution.ai_risk_level
    ? RISK_COLORS[execution.ai_risk_level]
    : RISK_COLORS.medium;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Approval Required
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {execution.workflow?.name || `Workflow #${execution.workflow_id}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Trigger Info */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Trigger
              </span>
            </div>
            <p className="text-slate-900 dark:text-white">
              {execution.trigger_event_count} event{execution.trigger_event_count !== 1 ? 's' : ''} matched
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              <Clock className="w-3 h-3 inline mr-1" />
              {new Date(execution.created_at).toLocaleString()}
            </p>
          </div>

          {/* AI Analysis */}
          {execution.ai_analysis && (
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-purple-700 dark:text-purple-300">
                    AI Analysis
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {confidencePercent !== null && (
                    <span className={`text-sm font-medium ${confidenceColor}`}>
                      {confidencePercent}% confidence
                    </span>
                  )}
                  {execution.ai_risk_level && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${riskColor}`}>
                      {execution.ai_risk_level.toUpperCase()} RISK
                    </span>
                  )}
                </div>
              </div>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {execution.ai_analysis}
              </p>
              {execution.ai_cost_usd > 0 && (
                <p className="text-xs text-purple-500 dark:text-purple-400 mt-2">
                  AI cost: ${execution.ai_cost_usd.toFixed(4)}
                </p>
              )}
            </div>
          )}

          {/* Recommended Actions */}
          {execution.recommended_actions && execution.recommended_actions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
                Recommended Actions
              </h3>
              <div className="space-y-2">
                {execution.recommended_actions.map((action: WorkflowAction, index: number) => (
                  <div
                    key={index}
                    className={`
                      p-3 rounded-lg border
                      ${action.requires_approval
                        ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {index + 1}. {action.tool.replace(/_/g, ' ')}
                        </span>
                        {action.requires_approval && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300">
                            Requires Approval
                          </span>
                        )}
                      </div>
                    </div>
                    {action.reason && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {action.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trigger Details (Collapsible) */}
          {execution.trigger_data && execution.trigger_data.length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                View trigger events ({execution.trigger_data.length})
              </button>
              {showDetails && (
                <div className="mt-3 p-3 rounded-lg bg-slate-900 dark:bg-slate-950 overflow-x-auto">
                  <pre className="text-xs text-slate-300 font-mono">
                    {JSON.stringify(execution.trigger_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm && (
            <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                Rejection Reason (optional)
              </h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why are you rejecting this action?"
                className="w-full px-3 py-2 rounded-lg border border-red-200 dark:border-red-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                rows={2}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {showRejectForm ? (
              <>
                <button
                  onClick={() => setShowRejectForm(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isSubmitting ? 'Approving...' : 'Approve & Execute'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ApprovalModal.displayName = 'ApprovalModal';
