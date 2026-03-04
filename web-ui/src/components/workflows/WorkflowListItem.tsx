'use client';

import { memo, useMemo } from 'react';
import { Play, Pause, Trash2, Clock, Zap, Calendar, Activity, Sparkles, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { Workflow } from './types';

interface WorkflowListItemProps {
  workflow: Workflow;
  isSelected: boolean;
  onClick: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  paused: 'bg-amber-500',
  draft: 'bg-slate-400',
};

const TRIGGER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  splunk_query: Activity,
  schedule: Calendar,
  manual: Play,
};

const TRIGGER_LABELS: Record<string, string> = {
  splunk_query: 'Event',
  schedule: 'Scheduled',
  manual: 'Manual',
};

export const WorkflowListItem = memo(({
  workflow,
  isSelected,
  onClick,
  onToggle,
  onDelete,
}: WorkflowListItemProps) => {
  const TriggerIcon = TRIGGER_ICONS[workflow.trigger_type] || Zap;
  const triggerLabel = TRIGGER_LABELS[workflow.trigger_type] || workflow.trigger_type;

  const successRate = useMemo(() => {
    const total = workflow.success_count + workflow.failure_count;
    if (total === 0) return null;
    return Math.round((workflow.success_count / total) * 100);
  }, [workflow.success_count, workflow.failure_count]);

  const lastTriggered = useMemo(() => {
    if (!workflow.last_triggered_at) return null;
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

  return (
    <div
      onClick={onClick}
      className={`group px-4 py-3.5 cursor-pointer transition-all duration-150 ${
        isSelected
          ? 'bg-cyan-50/60 dark:bg-cyan-900/10 border-l-2 border-l-cyan-500'
          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title + status */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[workflow.status] || 'bg-slate-400'}`} />
            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
              {workflow.name}
            </h3>
          </div>

          {/* Description */}
          {workflow.description && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-1 ml-4 leading-relaxed">
              {workflow.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2.5 mt-2 ml-4">
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <TriggerIcon className="w-3 h-3" />
              {triggerLabel}
            </span>
            {workflow.ai_enabled && (
              <span className="inline-flex items-center gap-1 text-[11px] text-purple-500 dark:text-purple-400">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              <Zap className="w-3 h-3" />
              {workflow.trigger_count}
            </span>
            {successRate !== null && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                successRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                successRate >= 70 ? 'text-amber-600 dark:text-amber-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {successRate >= 90 ? <CheckCircle className="w-3 h-3" /> : successRate >= 70 ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {successRate}%
              </span>
            )}
            {lastTriggered && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 ml-auto">
                <Clock className="w-3 h-3" />
                {lastTriggered}
              </span>
            )}
          </div>
        </div>

        {/* Hover actions */}
        {(onToggle || onDelete) && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {onToggle && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className={`p-1.5 rounded-lg transition-colors ${
                  workflow.status === 'active'
                    ? 'hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-500'
                    : 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-500'
                }`}
                title={workflow.status === 'active' ? 'Pause' : 'Activate'}
              >
                {workflow.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

WorkflowListItem.displayName = 'WorkflowListItem';
