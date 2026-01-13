'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { OrchestratorNodeData, AgentNodeStatus, AgentType } from '@/types/agent-flow';

// ============================================================================
// Status Styles
// ============================================================================

const statusStyles: Record<AgentNodeStatus, string> = {
  idle: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-600',
  active: 'bg-purple-50 dark:bg-purple-900/30 border-purple-400 dark:border-purple-500 border-[3px] shadow-xl ring-1 ring-purple-400/30',
  completed: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-500 shadow-md',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-500 shadow-md',
};

const statusIconStyles: Record<AgentNodeStatus, string> = {
  idle: 'text-slate-400 dark:text-slate-500',
  active: 'text-purple-500 dark:text-purple-400',
  completed: 'text-emerald-500 dark:text-emerald-400',
  error: 'text-red-500 dark:text-red-400',
};

const agentTypeLabels: Record<AgentType, string> = {
  knowledge: 'Knowledge',
  implementation: 'Implementation',
  tool: 'Tool',
  specialist: 'Specialist',
};

// ============================================================================
// OrchestratorNode Component
// ============================================================================

interface OrchestratorNodeProps {
  data: OrchestratorNodeData;
}

export const OrchestratorNode = memo(({ data }: OrchestratorNodeProps) => {
  const { label, status, intent, routedTo } = data;

  return (
    <div
      className={`
        relative px-4 py-3 rounded-xl min-w-[160px] max-w-[240px]
        transition-all duration-300 ease-out
        bg-white dark:bg-slate-800
        before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full
        before:bg-purple-500
        ${statusStyles[status]}
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-white dark:!border-slate-800"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex-shrink-0 ${statusIconStyles[status]}`}>
          {status === 'active' ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          )}
        </div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
          {label}
        </span>
      </div>

      {/* Intent */}
      {intent && (
        <div className="mb-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Intent: </span>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{intent}</span>
        </div>
      )}

      {/* Routed To */}
      {routedTo && routedTo.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {routedTo.map((agent) => (
            <span
              key={agent}
              className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300"
            >
              {agentTypeLabels[agent]}
            </span>
          ))}
        </div>
      )}

      {/* Status Indicator */}
      {status === 'active' && (
        <div className="absolute -top-1 -right-1 w-3 h-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
        </div>
      )}

      {/* Output Handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="top"
        style={{ top: '30%' }}
        className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-white dark:!border-slate-800"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="bottom"
        style={{ top: '70%' }}
        className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-white dark:!border-slate-800"
      />
    </div>
  );
});

OrchestratorNode.displayName = 'OrchestratorNode';

export default OrchestratorNode;
