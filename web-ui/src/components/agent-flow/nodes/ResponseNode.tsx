'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ResponseNodeData, AgentNodeStatus } from '@/types/agent-flow';

// ============================================================================
// Status Styles
// ============================================================================

const statusStyles: Record<AgentNodeStatus, string> = {
  idle: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-600',
  active: 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-500 border-[3px] shadow-xl ring-1 ring-green-400/30',
  completed: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-500 shadow-md',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-500 shadow-md',
};

const statusIconStyles: Record<AgentNodeStatus, string> = {
  idle: 'text-slate-400 dark:text-slate-500',
  active: 'text-green-500 dark:text-green-400 animate-pulse',
  completed: 'text-emerald-500 dark:text-emerald-400',
  error: 'text-red-500 dark:text-red-400',
};

// ============================================================================
// ResponseNode Component
// ============================================================================

interface ResponseNodeProps {
  data: ResponseNodeData;
}

export const ResponseNode = memo(({ data }: ResponseNodeProps) => {
  const { label, status, tokensUsed, toolsUsed } = data;

  return (
    <div
      className={`
        relative px-4 py-3 rounded-xl min-w-[140px] max-w-[220px]
        transition-all duration-300 ease-out
        bg-white dark:bg-slate-800
        before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full
        before:bg-emerald-500
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
          ) : status === 'completed' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}
        </div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
          {label}
        </span>
      </div>

      {/* Token Usage */}
      {tokensUsed && status === 'completed' && (
        <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              {tokensUsed.input.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              {tokensUsed.output.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Tools Used */}
      {toolsUsed && toolsUsed.length > 0 && status === 'completed' && (
        <div className="flex flex-wrap gap-1">
          {toolsUsed.slice(0, 3).map((tool, idx) => (
            <span
              key={idx}
              className="px-1.5 py-0.5 text-[10px] rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              {tool}
            </span>
          ))}
          {toolsUsed.length > 3 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              +{toolsUsed.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Status Indicator */}
      {status === 'active' && (
        <div className="absolute -top-1 -right-1 w-3 h-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </div>
      )}

      {/* Completed Checkmark */}
      {status === 'completed' && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
});

ResponseNode.displayName = 'ResponseNode';

export default ResponseNode;
