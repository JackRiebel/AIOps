'use client';

import { memo, useMemo } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { Workflow } from './types';
import { generateFlowFromWorkflow, type PreviewNode, type PreviewEdge } from './utils/generateFlowFromWorkflow';
import {
  TriggerFlowNode,
  ConditionFlowNode,
  AIAnalysisFlowNode,
  ActionFlowNode,
  NotifyFlowNode,
} from './flow-nodes';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowFlowPreviewProps {
  workflow: Workflow;
  className?: string;
}

// ============================================================================
// Node Renderer
// ============================================================================

interface FlowNodeRendererProps {
  node: PreviewNode;
}

const FlowNodeRenderer = memo(({ node }: FlowNodeRendererProps) => {
  switch (node.type) {
    case 'trigger':
      return <TriggerFlowNode data={node.data as any} />;
    case 'condition':
      return <ConditionFlowNode data={node.data as any} />;
    case 'ai':
      return <AIAnalysisFlowNode data={node.data as any} />;
    case 'action':
      return <ActionFlowNode data={node.data as any} />;
    case 'approval':
      // Render approval as action with requiresApproval badge
      return <ActionFlowNode data={{ ...node.data, requiresApproval: true, label: node.data.label || 'Approval Required' } as any} />;
    case 'notify':
      return <NotifyFlowNode data={node.data as any} />;
    default:
      return null;
  }
});

FlowNodeRenderer.displayName = 'FlowNodeRenderer';

// ============================================================================
// Edge Arrow Component
// ============================================================================

const FlowEdgeArrow = memo(() => (
  <div className="flex items-center justify-center w-8 flex-shrink-0">
    <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
  </div>
));

FlowEdgeArrow.displayName = 'FlowEdgeArrow';

// ============================================================================
// Main WorkflowFlowPreview Component
// ============================================================================

/**
 * WorkflowFlowPreview - Visual flow diagram for workflow preview
 *
 * Displays workflow as a left-to-right flow:
 * [TRIGGER] → [CONDITIONS] → [AI ANALYSIS] → [ACTIONS] → [NOTIFICATIONS]
 *
 * Features:
 * - Auto-generates nodes from workflow data
 * - Color-coded by node type
 * - Human-readable descriptions
 * - Approval badges on actions
 * - Risk level indicators
 */
export const WorkflowFlowPreview = memo(({ workflow, className = '' }: WorkflowFlowPreviewProps) => {
  // Generate flow from workflow data
  const { nodes, edges } = useMemo(
    () => generateFlowFromWorkflow(workflow),
    [workflow]
  );

  // Empty state
  if (nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No workflow steps configured
        </p>
      </div>
    );
  }

  return (
    <div className={`
      relative overflow-x-auto overflow-y-hidden
      bg-slate-50 dark:bg-slate-800/50
      rounded-lg border border-slate-200 dark:border-slate-700
      ${className}
    `}>
      {/* Flow Container */}
      <div className="flex items-center gap-0 p-6 min-w-max">
        {nodes.map((node, index) => (
          <div key={node.id} className="flex items-center">
            {/* Node */}
            <FlowNodeRenderer node={node} />

            {/* Arrow between nodes (except for last) */}
            {index < nodes.length - 1 && <FlowEdgeArrow />}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="
        flex items-center justify-center gap-4 px-4 py-2
        border-t border-slate-200 dark:border-slate-700
        bg-slate-100/50 dark:bg-slate-800/80
      ">
        <LegendItem color="emerald" label="Trigger" />
        <LegendItem color="amber" label="Condition" />
        <LegendItem color="purple" label="AI" />
        <LegendItem color="cyan" label="Action" />
        <LegendItem color="blue" label="Notify" />
        <LegendItem color="red" label="Approval" />
      </div>
    </div>
  );
});

WorkflowFlowPreview.displayName = 'WorkflowFlowPreview';

// ============================================================================
// Legend Component
// ============================================================================

interface LegendItemProps {
  color: 'emerald' | 'amber' | 'purple' | 'cyan' | 'blue' | 'red';
  label: string;
}

const colorClasses: Record<string, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  purple: 'bg-purple-400',
  cyan: 'bg-cyan-400',
  blue: 'bg-blue-400',
  red: 'bg-red-400',
};

const LegendItem = memo(({ color, label }: LegendItemProps) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-2 h-2 rounded-full ${colorClasses[color]}`} />
    <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
  </div>
));

LegendItem.displayName = 'LegendItem';

export default WorkflowFlowPreview;
