'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Brain,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Server,
  Shield,
  Activity,
  Edit3,
  RefreshCw,
  FileText,
} from 'lucide-react';
import type { WorkflowExecution, WorkflowAction } from './types';
import { SuccessCheckmark } from '@/components/common';

/**
 * ApprovalPanel - Enhanced approval experience for workflow executions
 *
 * Features:
 * - Clearer risk visualization with color coding
 * - Device-centric view showing affected devices
 * - Action checkboxes to modify before approving
 * - Collapsible sections for details
 */

export interface ApprovalPanelProps {
  execution: WorkflowExecution;
  onApprove: (selectedActions?: WorkflowAction[]) => void;
  onReject: (reason?: string) => void;
  onClose: () => void;
}

const RISK_CONFIG = {
  low: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: 'text-emerald-500',
    badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    icon: 'text-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
  high: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    icon: 'text-red-500',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  },
};

// Map tool names to display info
const TOOL_DISPLAY: Record<string, { icon: typeof Server; label: string }> = {
  meraki_reboot_device: { icon: RefreshCw, label: 'Reboot Device' },
  meraki_get_device_diagnostics: { icon: FileText, label: 'Collect Diagnostics' },
  meraki_disable_switch_port: { icon: Shield, label: 'Disable Switch Port' },
  meraki_block_client: { icon: Shield, label: 'Block Client' },
  slack_notify: { icon: Activity, label: 'Send Slack Notification' },
  email_notify: { icon: Activity, label: 'Send Email Alert' },
  create_incident: { icon: FileText, label: 'Create Incident Ticket' },
};

interface ActionItemProps {
  action: WorkflowAction;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const ActionItem = memo(({ action, index, isSelected, onToggle, disabled }: ActionItemProps) => {
  const display = TOOL_DISPLAY[action.tool] || { icon: Activity, label: action.tool.replace(/_/g, ' ') };
  const IconComponent = display.icon;

  return (
    <div
      className={`
        p-4 rounded-xl border transition-all cursor-pointer
        ${isSelected
          ? action.requires_approval
            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500/20'
            : 'border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20 ring-2 ring-cyan-500/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={disabled ? undefined : onToggle}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className={`
          w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5
          ${isSelected
            ? 'bg-cyan-600 border-cyan-600 dark:bg-cyan-500 dark:border-cyan-500'
            : 'border-slate-300 dark:border-slate-600'
          }
        `}>
          {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
        </div>

        {/* Action content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              action.requires_approval
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-slate-100 dark:bg-slate-700'
            }`}>
              <IconComponent className={`w-4 h-4 ${
                action.requires_approval
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-white">
                  {display.label}
                </span>
                {action.requires_approval && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded">
                    Critical
                  </span>
                )}
              </div>
              {action.reason && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {action.reason}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ActionItem.displayName = 'ActionItem';

// Extract device info from trigger data
function extractAffectedDevices(triggerData: any[]): { name: string; ip?: string; status?: string }[] {
  const devices: { name: string; ip?: string; status?: string }[] = [];

  if (!triggerData || !Array.isArray(triggerData)) return devices;

  for (const event of triggerData.slice(0, 5)) {
    if (event.device_name || event.deviceName || event.name) {
      devices.push({
        name: event.device_name || event.deviceName || event.name,
        ip: event.ip || event.ip_address || event.deviceIp,
        status: event.status || event.state,
      });
    }
  }

  return devices;
}

export const ApprovalPanel = memo(({
  execution,
  onApprove,
  onReject,
  onClose,
}: ApprovalPanelProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showDevices, setShowDevices] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState<'approved' | 'rejected' | null>(null);

  // Track selected actions
  const [selectedActions, setSelectedActions] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    execution.recommended_actions?.forEach((_, index) => initial.add(index));
    return initial;
  });

  const handleToggleAction = useCallback((index: number) => {
    setSelectedActions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleApprove = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Filter to only selected actions
      const selected = execution.recommended_actions?.filter((_, index) => selectedActions.has(index));
      await onApprove(selected);
      setShowSuccess('approved');
      // Close after brief delay to show success
      setTimeout(() => onClose(), 800);
    } catch {
      setIsSubmitting(false);
    }
  }, [onApprove, execution.recommended_actions, selectedActions, onClose]);

  const handleReject = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onReject(rejectReason || undefined);
      setShowSuccess('rejected');
      // Close after brief delay to show success
      setTimeout(() => onClose(), 800);
    } catch {
      setIsSubmitting(false);
    }
  }, [onReject, rejectReason, onClose]);

  const confidencePercent = execution.ai_confidence !== null
    ? Math.round((execution.ai_confidence || 0) * 100)
    : null;

  const riskLevel = execution.ai_risk_level || 'medium';
  const riskConfig = RISK_CONFIG[riskLevel as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;

  const affectedDevices = useMemo(() =>
    extractAffectedDevices(execution.trigger_data as any[]),
    [execution.trigger_data]
  );

  const selectedCount = selectedActions.size;
  const totalActions = execution.recommended_actions?.length || 0;

  // Time since triggered
  const timeSince = useMemo(() => {
    const now = new Date();
    const created = new Date(execution.created_at);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }, [execution.created_at]);

  // Show success overlay when action is complete
  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-12 text-center">
          <SuccessCheckmark show={true} size="lg" variant="filled" />
          <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            {showSuccess === 'approved' ? 'Workflow Approved' : 'Workflow Rejected'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`p-6 ${riskConfig.bg} border-b ${riskConfig.border}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm`}>
                <AlertTriangle className={`w-6 h-6 ${riskConfig.icon}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    Approval Required
                  </h2>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${riskConfig.badge}`}>
                    {riskLevel.toUpperCase()} RISK
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  {execution.workflow?.name || `Workflow #${execution.workflow_id}`}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-1 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Triggered {timeSince} ({execution.trigger_event_count} events)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Analysis Card */}
          {execution.ai_analysis && (
            <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="font-semibold text-purple-700 dark:text-purple-300">
                    AI Analysis
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {confidencePercent !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-purple-600 dark:text-purple-400">
                        Confidence:
                      </span>
                      <span className={`text-sm font-bold ${
                        confidencePercent >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                        confidencePercent >= 60 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {confidencePercent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-slate-700 dark:text-slate-300 italic">
                "{execution.ai_analysis}"
              </p>
            </div>
          )}

          {/* Affected Devices */}
          {affectedDevices.length > 0 && (
            <div>
              <button
                onClick={() => setShowDevices(!showDevices)}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 hover:text-slate-900 dark:hover:text-white"
              >
                {showDevices ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Server className="w-4 h-4" />
                Affected Devices ({affectedDevices.length})
              </button>
              {showDevices && (
                <div className="grid gap-2">
                  {affectedDevices.map((device, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <div className="flex-1">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {device.name}
                        </span>
                        {device.ip && (
                          <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                            ({device.ip})
                          </span>
                        )}
                      </div>
                      {device.status && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                          {device.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Proposed Actions */}
          {execution.recommended_actions && execution.recommended_actions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Proposed Actions
                  </h3>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedCount} of {totalActions} selected
                </span>
              </div>
              <div className="space-y-2">
                {execution.recommended_actions.map((action: WorkflowAction, index: number) => (
                  <ActionItem
                    key={index}
                    action={action}
                    index={index}
                    isSelected={selectedActions.has(index)}
                    onToggle={() => handleToggleAction(index)}
                    disabled={isSubmitting}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Click to select/deselect actions. Only selected actions will be executed.
              </p>
            </div>
          )}

          {/* Trigger Details (Collapsible) */}
          {execution.trigger_data && (execution.trigger_data as any[]).length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                View raw trigger events ({(execution.trigger_data as any[]).length})
              </button>
              {showDetails && (
                <div className="mt-3 p-4 rounded-xl bg-slate-900 dark:bg-slate-950 overflow-x-auto">
                  <pre className="text-xs text-slate-300 font-mono">
                    {JSON.stringify(execution.trigger_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                Rejection Reason (optional)
              </h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why are you rejecting this action?"
                className="w-full px-4 py-3 rounded-xl border border-red-200 dark:border-red-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
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
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
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
                    className="flex items-center gap-2 px-4 py-2.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={isSubmitting || selectedCount === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isSubmitting ? 'Approving...' : `Approve ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ApprovalPanel.displayName = 'ApprovalPanel';

export default ApprovalPanel;
