'use client';

import { memo } from 'react';
import { Play, Pause, Trash2, Clock, Zap, Calendar, AlertCircle } from 'lucide-react';
import type { Workflow } from './types';

interface WorkflowListItemProps {
  workflow: Workflow;
  isSelected: boolean;
  onClick: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
}

const STATUS_STYLES = {
  active: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
  },
  paused: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  draft: {
    bg: 'bg-slate-100 dark:bg-slate-700',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
};

const TRIGGER_ICONS = {
  splunk_query: Zap,
  schedule: Calendar,
  manual: Play,
};

export const WorkflowListItem = memo(({
  workflow,
  isSelected,
  onClick,
  onToggle,
  onDelete,
}: WorkflowListItemProps) => {
  const statusStyle = STATUS_STYLES[workflow.status];
  const TriggerIcon = TRIGGER_ICONS[workflow.trigger_type] || Zap;

  return (
    <div
      onClick={onClick}
      className={`
        p-4 cursor-pointer transition-colors group
        hover:bg-slate-50 dark:hover:bg-slate-700/50
        ${isSelected ? 'bg-cyan-50 dark:bg-cyan-900/20 border-l-2 border-l-cyan-500' : ''}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-slate-900 dark:text-white truncate">
              {workflow.name}
            </h3>
            <span className={`
              inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
              ${statusStyle.bg} ${statusStyle.text}
            `}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
              {workflow.status}
            </span>
          </div>

          {workflow.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {workflow.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <TriggerIcon className="w-3 h-3" />
              {workflow.trigger_type.replace('_', ' ')}
            </span>
            {workflow.ai_enabled && (
              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
                AI
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {workflow.trigger_count} triggers
            </span>
          </div>
        </div>

        {(onToggle || onDelete) && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
            {onToggle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className={`
                  p-1.5 rounded transition-colors
                  ${workflow.status === 'active'
                    ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400'
                  }
                `}
                title={workflow.status === 'active' ? 'Pause workflow' : 'Activate workflow'}
              >
                {workflow.status === 'active' ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            )}

            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                title="Delete workflow"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {workflow.trigger_count > 0 && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-green-600 dark:text-green-400">{workflow.success_count}</span>
            <span className="text-slate-400">success</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-red-600 dark:text-red-400">{workflow.failure_count}</span>
            <span className="text-slate-400">failed</span>
          </div>
          {workflow.last_triggered_at && (
            <div className="text-xs text-slate-400 ml-auto">
              Last: {new Date(workflow.last_triggered_at).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

WorkflowListItem.displayName = 'WorkflowListItem';
