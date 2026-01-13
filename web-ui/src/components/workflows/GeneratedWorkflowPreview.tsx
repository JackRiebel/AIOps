'use client';

import { memo } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Clock,
  Shield,
  Activity,
  WifiOff,
  MessageSquare,
  Mail,
  RefreshCw,
  FileText,
  AlertCircle,
} from 'lucide-react';
import type { CreateWorkflowRequest, TriggerType, WorkflowAction } from './types';

/**
 * GeneratedWorkflowPreview - Shows a preview of an AI-generated workflow
 *
 * Displays the parsed workflow configuration in a user-friendly format
 * before the user confirms creation.
 */

export interface GeneratedWorkflowPreviewProps {
  workflow: CreateWorkflowRequest;
  confidence: number;
  explanation?: string;
  onEdit: () => void;
  onSaveAsTemplate?: () => void;
  onCreate: () => void;
  isCreating?: boolean;
}

// Map trigger types to display info
const TRIGGER_DISPLAY: Record<TriggerType, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  splunk_query: { icon: Activity, label: 'Event-Based', color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30' },
  schedule: { icon: Clock, label: 'Scheduled', color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
  manual: { icon: Shield, label: 'Manual', color: 'text-slate-500 bg-slate-100 dark:bg-slate-700' },
};

// Map tool names to display info
const TOOL_DISPLAY: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  slack_notify: { icon: MessageSquare, label: 'Send Slack notification' },
  email_notify: { icon: Mail, label: 'Send email alert' },
  teams_notify: { icon: MessageSquare, label: 'Send Teams message' },
  meraki_reboot_device: { icon: RefreshCw, label: 'Reboot device' },
  meraki_get_device_diagnostics: { icon: FileText, label: 'Collect diagnostics' },
  create_incident: { icon: AlertCircle, label: 'Create incident ticket' },
  meraki_disable_switch_port: { icon: WifiOff, label: 'Disable switch port' },
  meraki_block_client: { icon: Shield, label: 'Block network client' },
};

const ActionItem = memo(({ action, index }: { action: WorkflowAction; index: number }) => {
  const display = TOOL_DISPLAY[action.tool] || { icon: Activity, label: action.tool };
  const IconComponent = display.icon;

  return (
    <div className={`
      flex items-center gap-3 p-3 rounded-lg
      ${action.requires_approval
        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50'
        : 'bg-slate-50 dark:bg-slate-700/50'
      }
    `}>
      <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-500 shadow-sm">
        {index + 1}
      </div>
      <IconComponent className="w-4 h-4 text-slate-500 dark:text-slate-400" />
      <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
        {display.label}
      </span>
      {action.requires_approval && (
        <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded">
          Approval Required
        </span>
      )}
    </div>
  );
});

ActionItem.displayName = 'ActionItem';

export const GeneratedWorkflowPreview = memo(({
  workflow,
  confidence,
  explanation,
  onEdit,
  onSaveAsTemplate,
  onCreate,
  isCreating = false,
}: GeneratedWorkflowPreviewProps) => {
  const triggerDisplay = TRIGGER_DISPLAY[workflow.trigger_type];
  const TriggerIcon = triggerDisplay?.icon || Activity;
  const confidenceColor = confidence >= 0.8 ? 'text-emerald-500' : confidence >= 0.6 ? 'text-amber-500' : 'text-red-500';
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="space-y-4">
      {/* Header with confidence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Generated Workflow</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Confidence:</span>
          <span className={`font-semibold ${confidenceColor}`}>{confidencePercent}%</span>
        </div>
      </div>

      {/* AI Explanation */}
      {explanation && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg">
          <p className="text-sm text-purple-700 dark:text-purple-300 italic">
            &quot;{explanation}&quot;
          </p>
        </div>
      )}

      {/* Workflow Name */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Workflow Name
        </label>
        <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
          {workflow.name}
        </p>
        {workflow.description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {workflow.description}
          </p>
        )}
      </div>

      {/* Trigger */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Trigger
        </label>
        <div className="mt-2 flex items-center gap-3">
          <div className={`p-2 rounded-lg ${triggerDisplay?.color || 'bg-slate-100'}`}>
            <TriggerIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {triggerDisplay?.label || workflow.trigger_type}
            </p>
            {workflow.splunk_query && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 truncate max-w-md">
                {workflow.splunk_query}
              </p>
            )}
            {workflow.schedule_cron && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                Cron: {workflow.schedule_cron}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Actions ({workflow.actions?.length || 0})
        </label>
        <div className="mt-3 space-y-2">
          {workflow.actions?.map((action, index) => (
            <ActionItem key={index} action={action} index={index} />
          ))}
        </div>
      </div>

      {/* AI Settings */}
      {workflow.ai_enabled && (
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              AI Analysis Enabled
            </label>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            AI will analyze events and must be at least{' '}
            <span className="font-medium text-slate-900 dark:text-white">
              {Math.round((workflow.ai_confidence_threshold || 0.7) * 100)}%
            </span>{' '}
            confident before recommending actions.
          </p>
        </div>
      )}

      {/* Warning for actions requiring approval */}
      {workflow.actions?.some(a => a.requires_approval) && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Approval Required
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              Some actions in this workflow require manual approval before execution.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Edit Details
        </button>
        <div className="flex items-center gap-3">
          {onSaveAsTemplate && (
            <button
              onClick={onSaveAsTemplate}
              className="px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
            >
              Save as Template
            </button>
          )}
          <button
            onClick={onCreate}
            disabled={isCreating}
            className="flex items-center gap-2 px-5 py-2 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Workflow
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

GeneratedWorkflowPreview.displayName = 'GeneratedWorkflowPreview';

export default GeneratedWorkflowPreview;
