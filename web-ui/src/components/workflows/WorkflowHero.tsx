'use client';

import { memo } from 'react';
import { Plus } from 'lucide-react';
import type { WorkflowStats } from './types';

/**
 * WorkflowHero - Header section for the workflows page
 *
 * Simplified to have a single "Create Workflow" button that opens
 * the CreateWorkflowModal with all creation options.
 */

export interface WorkflowHeroProps {
  stats?: WorkflowStats | null;
  onCreateWorkflow: () => void;
  canCreate?: boolean;
}

export const WorkflowHero = memo(({
  stats,
  onCreateWorkflow,
  canCreate = true,
}: WorkflowHeroProps) => {
  return (
    <header className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          AI Workflows
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Automate network operations with AI assistance
          {stats && stats.workflows.active > 0 && (
            <span className="ml-2 text-slate-400 dark:text-slate-500">
              · {stats.workflows.active} active
              {stats.pending_approvals > 0 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  · {stats.pending_approvals} pending approval
                </span>
              )}
            </span>
          )}
        </p>
      </div>

      {canCreate && (
        <button
          onClick={onCreateWorkflow}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm text-white font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Workflow
        </button>
      )}
    </header>
  );
});

WorkflowHero.displayName = 'WorkflowHero';

export default WorkflowHero;
