'use client';

import { memo } from 'react';
import { GitBranch } from 'lucide-react';
import { formatCondition } from '../utils/generateFlowFromWorkflow';
import type { WorkflowCondition } from '../types';

interface ConditionFlowNodeProps {
  data: {
    conditions: WorkflowCondition[];
    conditionCount: number;
  };
}

/**
 * ConditionFlowNode - Shows workflow conditions with branching visual
 * Amber accent color, displays field/operator/value
 */
export const ConditionFlowNode = memo(({ data }: ConditionFlowNodeProps) => {
  const { conditions, conditionCount } = data;

  return (
    <div className="
      w-[160px] p-3 rounded-lg
      bg-amber-50 dark:bg-amber-900/30
      border-2 border-amber-400 dark:border-amber-600
      shadow-sm hover:shadow-md transition-shadow
    ">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-800/50 text-amber-600 dark:text-amber-400">
          <GitBranch className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
          Condition{conditionCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* Conditions List */}
      <div className="space-y-1.5">
        {conditions.slice(0, 3).map((condition, index) => (
          <div
            key={index}
            className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-800/30 px-1.5 py-1 rounded"
          >
            <span className="text-amber-500 dark:text-amber-500 font-medium">IF </span>
            {formatCondition(condition)}
          </div>
        ))}
        {conditionCount > 3 && (
          <div className="text-[10px] text-amber-500 dark:text-amber-400 italic">
            +{conditionCount - 3} more...
          </div>
        )}
      </div>

      {/* True/False indicators */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200 dark:border-amber-700/50">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[9px] text-green-600 dark:text-green-400">True</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[9px] text-red-600 dark:text-red-400">False</span>
        </div>
      </div>
    </div>
  );
});

ConditionFlowNode.displayName = 'ConditionFlowNode';

export default ConditionFlowNode;
