'use client';

import { memo } from 'react';
import { Plus } from 'lucide-react';
import type { WorkflowStats } from './types';

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
    <header className="flex items-center justify-between mb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
          Workflow Automation
        </h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 font-light">
          AI-powered network operations with approval workflows and execution tracking
        </p>
      </div>
      {canCreate && (
        <button
          onClick={onCreateWorkflow}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-sm text-white font-medium transition-all shadow-sm hover:shadow-md"
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
