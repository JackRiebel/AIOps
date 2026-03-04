'use client';

import { memo } from 'react';
import { Plus, Inbox, Sparkles } from 'lucide-react';
import { WorkflowCard } from './WorkflowCard';
import type { Workflow } from './types';

export interface WorkflowCardGridProps {
  workflows: Workflow[];
  selectedWorkflowId?: number | null;
  onSelect: (workflow: Workflow) => void;
  onRun: (workflow: Workflow) => void;
  onTest?: (workflow: Workflow) => void;
  onDuplicate: (workflow: Workflow) => void;
  onExport: (workflow: Workflow) => void;
  onViewHistory: (workflow: Workflow) => void;
  onEdit: (workflow: Workflow) => void;
  onDelete: (workflow: Workflow) => void;
  onToggle: (workflow: Workflow) => void;
  onCreateNew?: () => void;
  canExecute?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canCreate?: boolean;
}

export const WorkflowCardGrid = memo(({
  workflows,
  selectedWorkflowId,
  onSelect,
  onRun,
  onTest,
  onDuplicate,
  onExport,
  onViewHistory,
  onEdit,
  onDelete,
  onToggle,
  onCreateNew,
  canExecute = true,
  canEdit = true,
  canDelete = true,
  canCreate = true,
}: WorkflowCardGridProps) => {
  if (workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5">
          <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1.5">
          No workflows found
        </h3>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-6 max-w-sm leading-relaxed">
          Create your first workflow to automate network operations with AI assistance.
        </p>
        {canCreate && onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 p-5">
      {workflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          isSelected={workflow.id === selectedWorkflowId}
          onClick={() => onSelect(workflow)}
          onRun={() => onRun(workflow)}
          onTest={onTest ? () => onTest(workflow) : undefined}
          onDuplicate={() => onDuplicate(workflow)}
          onExport={() => onExport(workflow)}
          onViewHistory={() => onViewHistory(workflow)}
          onEdit={() => onEdit(workflow)}
          onDelete={() => onDelete(workflow)}
          onToggle={() => onToggle(workflow)}
          canExecute={canExecute}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ))}

      {/* Create new card */}
      {canCreate && onCreateNew && (
        <button
          onClick={onCreateNew}
          className="group flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 dark:text-slate-500 hover:border-cyan-400 dark:hover:border-cyan-500/50 hover:text-cyan-500 dark:hover:text-cyan-400 transition-all duration-200 min-h-[200px] hover:bg-cyan-50/30 dark:hover:bg-cyan-900/5"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/10 transition-colors">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-[13px] font-medium">Create Workflow</span>
        </button>
      )}
    </div>
  );
});

WorkflowCardGrid.displayName = 'WorkflowCardGrid';

export default WorkflowCardGrid;
