'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { UserNodeData, AgentNodeStatus } from '@/types/agent-flow';

// ============================================================================
// Status Styles
// ============================================================================

const statusStyles: Record<AgentNodeStatus, string> = {
  idle: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-600',
  active: 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500 border-[3px] shadow-xl ring-1 ring-blue-400/30',
  completed: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-500 shadow-md',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-500 shadow-md',
};

const statusIconStyles: Record<AgentNodeStatus, string> = {
  idle: 'text-slate-400 dark:text-slate-500',
  active: 'text-blue-500 dark:text-blue-400 animate-pulse',
  completed: 'text-emerald-500 dark:text-emerald-400',
  error: 'text-red-500 dark:text-red-400',
};

// ============================================================================
// UserNode Component
// ============================================================================

interface UserNodeProps {
  data: UserNodeData;
}

export const UserNode = memo(({ data }: UserNodeProps) => {
  const { label, status, query } = data;

  return (
    <div
      className={`
        relative px-4 py-3 rounded-xl min-w-[140px] max-w-[220px]
        transition-all duration-300 ease-out
        bg-white dark:bg-slate-800
        before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full
        before:bg-blue-500
        ${statusStyles[status]}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex-shrink-0 ${statusIconStyles[status]}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
          {label}
        </span>
      </div>

      {/* Query Preview */}
      {query && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 break-words">
          "{query}"
        </p>
      )}

      {/* Status Indicator */}
      {status === 'active' && (
        <div className="absolute -top-1 -right-1 w-3 h-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-white dark:!border-slate-800"
      />
    </div>
  );
});

UserNode.displayName = 'UserNode';

export default UserNode;
