'use client';

import { memo, useMemo } from 'react';
import {
  Play,
  Activity,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
} from 'lucide-react';
import { QuickActionsMenu } from './QuickActionsMenu';
import type { Workflow } from './types';

/**
 * WorkflowCard - Enhanced card view for a workflow
 *
 * Features:
 * - Visual status indicator (active/paused)
 * - Trigger type badge
 * - AI enabled indicator
 * - Stats bar (triggers, success rate)
 * - Quick run button
 * - Actions dropdown menu
 */

export interface WorkflowCardProps {
  workflow: Workflow;
  isSelected?: boolean;
  onClick: () => void;
  onRun: () => void;
  onTest?: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onViewHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  canExecute?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

// Trigger type display info
const TRIGGER_TYPE_INFO: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  splunk_query: { icon: Activity, label: 'Event', color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30' },
  schedule: { icon: Clock, label: 'Scheduled', color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
  manual: { icon: Play, label: 'Manual', color: 'text-slate-500 bg-slate-100 dark:bg-slate-700' },
};

export const WorkflowCard = memo(({
  workflow,
  isSelected = false,
  onClick,
  onRun,
  onTest,
  onDuplicate,
  onExport,
  onViewHistory,
  onEdit,
  onDelete,
  onToggle,
  canExecute = true,
  canEdit = true,
  canDelete = true,
}: WorkflowCardProps) => {
  const isActive = workflow.status === 'active';
  const triggerInfo = TRIGGER_TYPE_INFO[workflow.trigger_type] || TRIGGER_TYPE_INFO.manual;
  const TriggerIcon = triggerInfo.icon;

  // Calculate success rate
  const successRate = useMemo(() => {
    const total = workflow.success_count + workflow.failure_count;
    if (total === 0) return null;
    return Math.round((workflow.success_count / total) * 100);
  }, [workflow.success_count, workflow.failure_count]);

  // Format last triggered time
  const lastTriggered = useMemo(() => {
    if (!workflow.last_triggered_at) return 'Never';
    const date = new Date(workflow.last_triggered_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }, [workflow.last_triggered_at]);

  return (
    <div
      onClick={onClick}
      className={`
        group relative bg-white dark:bg-slate-800 rounded-xl border transition-all cursor-pointer
        ${isSelected
          ? 'border-cyan-500 dark:border-cyan-400 ring-2 ring-cyan-500/20'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
        }
      `}
    >
      {/* Status indicator line */}
      <div className={`
        absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-colors
        ${isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}
      `} />

      <div className="p-4 pl-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                {workflow.name}
              </h3>
              {!isActive && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                  Paused
                </span>
              )}
            </div>
            {workflow.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {workflow.description}
              </p>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Run button */}
            {isActive && canExecute && (
              <button
                onClick={onRun}
                className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                title="Run Now"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            <QuickActionsMenu
              workflowId={workflow.id}
              isActive={isActive}
              onRun={onRun}
              onTest={onTest}
              onDuplicate={onDuplicate}
              onExport={onExport}
              onViewHistory={onViewHistory}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
              canExecute={canExecute}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-3">
          {/* Trigger type */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${triggerInfo.color}`}>
            <TriggerIcon className="w-3.5 h-3.5" />
            {triggerInfo.label}
          </div>

          {/* AI enabled */}
          {workflow.ai_enabled && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30">
              <Sparkles className="w-3.5 h-3.5" />
              AI
            </div>
          )}

          {/* Actions requiring approval */}
          {workflow.actions?.some(a => a.requires_approval) && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              Approval
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            {/* Trigger count */}
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              <span>{workflow.trigger_count}</span>
            </div>

            {/* Success rate */}
            {successRate !== null && (
              <div className="flex items-center gap-1.5">
                {successRate >= 90 ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : successRate >= 70 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={
                  successRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                  successRate >= 70 ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                }>
                  {successRate}%
                </span>
              </div>
            )}
          </div>

          {/* Last triggered */}
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Last: {lastTriggered}
          </span>
        </div>

        {/* Success rate bar (visual) */}
        {successRate !== null && workflow.trigger_count > 0 && (
          <div className="mt-2 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                successRate >= 90 ? 'bg-emerald-500' :
                successRate >= 70 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${successRate}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

WorkflowCard.displayName = 'WorkflowCard';

export default WorkflowCard;
