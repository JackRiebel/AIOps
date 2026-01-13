'use client';

import { memo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type WorkflowStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface WorkflowProgressProps {
  currentStatus: WorkflowStatus;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const WORKFLOW_STEPS: WorkflowStatus[] = ['open', 'investigating', 'resolved', 'closed'];

const STEP_LABELS: Record<WorkflowStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
  closed: 'Closed',
};

// ============================================================================
// WorkflowProgress Component
// ============================================================================

export const WorkflowProgress = memo(({
  currentStatus,
  className = '',
}: WorkflowProgressProps) => {
  const currentIndex = WORKFLOW_STEPS.indexOf(currentStatus);

  return (
    <div className={`flex items-center justify-between px-1 ${className}`}>
      {WORKFLOW_STEPS.map((step, index) => {
        const isActive = currentStatus === step;
        const isPast = index < currentIndex;
        const isLast = index === WORKFLOW_STEPS.length - 1;

        return (
          <div key={step} className="flex items-center flex-1">
            <div className={`flex flex-col items-center ${!isLast ? 'flex-1' : ''}`}>
              {/* Step Dot */}
              <div
                className={`w-3 h-3 rounded-full border-2 transition-all ${
                  isActive
                    ? 'bg-cyan-500 border-cyan-400 shadow-lg shadow-cyan-500/50'
                    : isPast
                    ? 'bg-emerald-500 border-emerald-400'
                    : 'bg-slate-300 dark:bg-slate-700 border-slate-400 dark:border-slate-600'
                }`}
              />

              {/* Step Label */}
              <span
                className={`text-[10px] mt-1.5 font-medium ${
                  isActive
                    ? 'text-cyan-600 dark:text-cyan-400'
                    : isPast
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-500'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>

            {/* Connector Line */}
            {!isLast && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-5 transition-colors ${
                  index < currentIndex
                    ? 'bg-emerald-500'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

WorkflowProgress.displayName = 'WorkflowProgress';

export default WorkflowProgress;
