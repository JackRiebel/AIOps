'use client';

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Wrench, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { PlatformNodeData, PlatformId, AgentNodeStatus } from '@/types/agent-flow';
import { PLATFORMS } from '@/types/agent-flow';

// ============================================================================
// Status Styles
// ============================================================================

const statusStyles: Record<AgentNodeStatus, string> = {
  idle: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-600',
  active: 'border-[3px] shadow-xl ring-2 ring-offset-2 dark:ring-offset-slate-900',
  completed: 'shadow-lg border-2',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-500 shadow-md border-2',
};

// Platform-specific color overrides for active/completed states
const platformStatusStyles: Record<PlatformId, { active: string; completed: string }> = {
  meraki: {
    active: 'bg-[#00bceb]/10 border-[#00bceb] ring-[#00bceb]/40',
    completed: 'bg-[#00bceb]/5 border-[#00bceb]/60',
  },
  catalyst: {
    active: 'bg-[#049fd9]/10 border-[#049fd9] ring-[#049fd9]/40',
    completed: 'bg-[#049fd9]/5 border-[#049fd9]/60',
  },
  thousandeyes: {
    active: 'bg-[#ff6b35]/10 border-[#ff6b35] ring-[#ff6b35]/40',
    completed: 'bg-[#ff6b35]/5 border-[#ff6b35]/60',
  },
  splunk: {
    active: 'bg-[#65a637]/10 border-[#65a637] ring-[#65a637]/40',
    completed: 'bg-[#65a637]/5 border-[#65a637]/60',
  },
  knowledge: {
    active: 'bg-[#9333ea]/10 border-[#9333ea] ring-[#9333ea]/40',
    completed: 'bg-[#9333ea]/5 border-[#9333ea]/60',
  },
};

// ============================================================================
// Component Props
// ============================================================================

interface PlatformNodeProps {
  id: string;
  data: PlatformNodeData;
}

// ============================================================================
// Platform Node Component
// ============================================================================

const PlatformNode = memo<PlatformNodeProps>(({ id, data }) => {
  const { platform, status, currentTool, toolsExecuted, duration } = data;
  const platformConfig = PLATFORMS[platform];
  const platformStyles = platformStatusStyles[platform];

  // Get status-specific styling
  const getNodeStyles = (): string => {
    const base = 'rounded-xl border transition-all duration-300';

    switch (status) {
      case 'active':
        return `${base} ${platformStyles.active}`;
      case 'completed':
        return `${base} ${platformStyles.completed}`;
      case 'error':
        return `${base} ${statusStyles.error}`;
      default:
        return `${base} ${statusStyles.idle}`;
    }
  };

  // Format tool name for display (remove platform prefix)
  const formatToolName = (toolName: string): string => {
    const prefixes = ['meraki_', 'catalyst_', 'thousandeyes_', 'splunk_', 'knowledge_'];
    for (const prefix of prefixes) {
      if (toolName.startsWith(prefix)) {
        return toolName.slice(prefix.length).replace(/_/g, ' ');
      }
    }
    return toolName.replace(/_/g, ' ');
  };

  // Status icon
  const StatusIcon = () => {
    switch (status) {
      case 'active':
        return <Loader2 className="w-4 h-4 animate-spin" style={{ color: platformConfig.color }} />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" style={{ color: platformConfig.color }} />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`${getNodeStyles()} p-4 min-w-[180px] max-w-[220px] relative`}>
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-slate-400 !bg-slate-200 dark:!bg-slate-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-slate-400 !bg-slate-200 dark:!bg-slate-600"
      />

      {/* Header with icon and platform name */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{platformConfig.icon}</span>
        <span
          className="font-semibold text-sm"
          style={{ color: platformConfig.color }}
        >
          {platformConfig.name}
        </span>
        <div className="ml-auto">
          <StatusIcon />
        </div>
      </div>

      {/* Current tool being executed */}
      {status === 'active' && currentTool && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 rounded px-2 py-1 mb-2">
          <Wrench className="w-3 h-3 flex-shrink-0" style={{ color: platformConfig.color }} />
          <span className="truncate">{formatToolName(currentTool)}</span>
        </div>
      )}

      {/* Tools executed count and duration */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          {toolsExecuted.length} tool{toolsExecuted.length !== 1 ? 's' : ''}
          {status === 'completed' ? ' used' : ' called'}
        </span>
        {status === 'completed' && duration && (
          <span>{(duration / 1000).toFixed(1)}s</span>
        )}
      </div>

      {/* Active pulsing indicator */}
      {status === 'active' && (
        <div className="absolute -top-1 -right-1">
          <span className="relative flex h-3 w-3">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: platformConfig.color }}
            />
            <span
              className="relative inline-flex rounded-full h-3 w-3"
              style={{ backgroundColor: platformConfig.color }}
            />
          </span>
        </div>
      )}
    </div>
  );
});

PlatformNode.displayName = 'PlatformNode';

export default PlatformNode;
