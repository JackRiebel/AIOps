'use client';

import { memo, useMemo } from 'react';
import {
  Play,
  Pause,
  Activity,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Calendar,
  MoreHorizontal,
} from 'lucide-react';
import { QuickActionsMenu } from './QuickActionsMenu';
import type { Workflow } from './types';

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

const TRIGGER_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; bg: string; text: string }> = {
  splunk_query: { icon: Activity, label: 'Event-driven', bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
  schedule: { icon: Calendar, label: 'Scheduled', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  manual: { icon: Play, label: 'Manual', bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-400' },
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
  const trigger = TRIGGER_CONFIG[workflow.trigger_type] || TRIGGER_CONFIG.manual;
  const TriggerIcon = trigger.icon;

  const successRate = useMemo(() => {
    const total = workflow.success_count + workflow.failure_count;
    if (total === 0) return null;
    return Math.round((workflow.success_count / total) * 100);
  }, [workflow.success_count, workflow.failure_count]);

  const lastTriggered = useMemo(() => {
    if (!workflow.last_triggered_at) return 'Never run';
    const diffMs = Date.now() - new Date(workflow.last_triggered_at).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(workflow.last_triggered_at).toLocaleDateString();
  }, [workflow.last_triggered_at]);

  const statusAccent = isActive ? 'from-emerald-500 to-emerald-400' : workflow.status === 'draft' ? 'from-slate-400 to-slate-300' : 'from-amber-500 to-amber-400';

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden bg-white dark:bg-slate-800/80 ${
        isSelected
          ? 'border-cyan-400 dark:border-cyan-500/60 ring-2 ring-cyan-500/15 shadow-sm shadow-cyan-500/10'
          : 'border-slate-200/80 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50'
      }`}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${statusAccent}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[14px] font-semibold text-slate-900 dark:text-white truncate leading-tight">
                {workflow.name}
              </h3>
              {!isActive && (
                <span className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded ${
                  workflow.status === 'draft'
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}>
                  {workflow.status}
                </span>
              )}
            </div>
            {workflow.description && (
              <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {workflow.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            {isActive && canExecute && (
              <button
                onClick={onRun}
                className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors border border-emerald-200/60 dark:border-emerald-500/20"
                title="Run Now"
              >
                <Play className="w-3.5 h-3.5" />
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
        <div className="flex items-center gap-1.5 mb-3.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium ${trigger.bg} ${trigger.text}`}>
            <TriggerIcon className="w-3 h-3" />
            {trigger.label}
          </span>
          {workflow.ai_enabled && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-3 h-3" />
              AI Analysis
            </span>
          )}
          {workflow.actions?.some(a => a.requires_approval) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Approval
            </span>
          )}
          {workflow.auto_execute_enabled && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Zap className="w-3 h-3" />
              Auto
            </span>
          )}
        </div>

        {/* Stats footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Runs */}
              <div className="flex items-center gap-1.5 text-[12px]">
                <Zap className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">{workflow.trigger_count}</span>
                <span className="text-slate-400 dark:text-slate-500">runs</span>
              </div>

              {/* Success rate */}
              {successRate !== null && (
                <div className="flex items-center gap-1.5 text-[12px]">
                  {successRate >= 90 ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  ) : successRate >= 70 ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <span className={`font-semibold ${
                    successRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                    successRate >= 70 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {successRate}%
                  </span>
                </div>
              )}
            </div>

            {/* Last run */}
            <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              <Clock className="w-3 h-3" />
              {lastTriggered}
            </span>
          </div>

          {/* Success rate bar */}
          {successRate !== null && workflow.trigger_count > 0 && (
            <div className="mt-2.5 h-1 bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
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
    </div>
  );
});

WorkflowCard.displayName = 'WorkflowCard';

export default WorkflowCard;
