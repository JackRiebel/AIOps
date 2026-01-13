'use client';

import { memo } from 'react';
import { Plus, Inbox } from 'lucide-react';
import { WorkflowCard } from './WorkflowCard';
import type { Workflow } from './types';

/**
 * WorkflowCardGrid - Grid layout for workflow cards
 */

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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          No workflows found
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
          Create your first workflow to automate network operations with AI assistance.
        </p>
        {canCreate && onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
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
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:border-cyan-500 dark:hover:border-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors min-h-[200px]"
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/30">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-medium">Create New Workflow</span>
        </button>
      )}
    </div>
  );
});

WorkflowCardGrid.displayName = 'WorkflowCardGrid';

export default WorkflowCardGrid;
