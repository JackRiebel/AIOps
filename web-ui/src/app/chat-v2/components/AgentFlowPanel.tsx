'use client';

/**
 * AgentFlowPanel - Enterprise Agent Activity Visualization
 *
 * A collapsible panel showing AI agent workflow with:
 * - Always-visible header with status indicators
 * - Platform-specific nodes (Meraki, ThousandEyes, Catalyst, Splunk)
 * - Real-time activity tracking
 * - Persists after completion until new query starts
 *
 * Built from scratch with modern patterns, inspired by /network but improved.
 */

import { useState, useCallback, memo, useMemo } from 'react';
import type { StreamingPhase } from '../types';
import type { ToolExecution, AgentTurn } from '../hooks/useStreaming';

// Re-export for convenience
export type { ToolExecution, AgentTurn };

// =============================================================================
// Types
// =============================================================================

interface AgentFlowPanelProps {
  phase: StreamingPhase;
  currentTool?: string;
  currentAgent?: string;
  toolExecutions: ToolExecution[];
  agentTurns: AgentTurn[];
  thinkingDuration?: number;
  className?: string;
}

type NodeStatus = 'idle' | 'active' | 'complete' | 'error';

type PlatformId = 'meraki' | 'catalyst' | 'thousandeyes' | 'splunk' | 'knowledge';

interface PlatformConfig {
  name: string;
  color: string;
  bgColor: string;
}

interface PlatformNode {
  id: PlatformId;
  status: NodeStatus;
  tools: ToolExecution[];
  config: PlatformConfig;
}

// =============================================================================
// Platform Configuration
// =============================================================================

const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  meraki: {
    name: 'Meraki',
    color: '#00bceb',
    bgColor: 'rgba(0, 188, 235, 0.1)',
  },
  catalyst: {
    name: 'Catalyst',
    color: '#049fd9',
    bgColor: 'rgba(4, 159, 217, 0.1)',
  },
  thousandeyes: {
    name: 'ThousandEyes',
    color: '#ff6b35',
    bgColor: 'rgba(255, 107, 53, 0.1)',
  },
  splunk: {
    name: 'Splunk',
    color: '#65a637',
    bgColor: 'rgba(101, 166, 55, 0.1)',
  },
  knowledge: {
    name: 'Knowledge',
    color: '#9333ea',
    bgColor: 'rgba(147, 51, 234, 0.1)',
  },
};

// Helper to extract platform from tool name
function getPlatformFromTool(toolName: string): PlatformId | null {
  const name = toolName.toLowerCase();
  if (name.includes('meraki') || name.startsWith('get_meraki')) return 'meraki';
  if (name.includes('catalyst') || name.startsWith('get_catalyst')) return 'catalyst';
  if (name.includes('thousandeyes') || name.includes('thousand_eyes')) return 'thousandeyes';
  if (name.includes('splunk')) return 'splunk';
  if (name.includes('knowledge') || name.includes('consult_knowledge')) return 'knowledge';
  return null;
}

// =============================================================================
// Icons
// =============================================================================

const ChevronIcon = memo(({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
));
ChevronIcon.displayName = 'ChevronIcon';

const BrainIcon = memo(() => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
));
BrainIcon.displayName = 'BrainIcon';

const ChatIcon = memo(() => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
));
ChatIcon.displayName = 'ChatIcon';

const CheckIcon = memo(() => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
));
CheckIcon.displayName = 'CheckIcon';

const SpinnerIcon = memo(() => (
  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
));
SpinnerIcon.displayName = 'SpinnerIcon';

// Platform Icons - themed SVG icons for each integration
const MerakiIcon = memo(() => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
));
MerakiIcon.displayName = 'MerakiIcon';

const CatalystIcon = memo(() => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
));
CatalystIcon.displayName = 'CatalystIcon';

const ThousandEyesIcon = memo(() => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
));
ThousandEyesIcon.displayName = 'ThousandEyesIcon';

const SplunkIcon = memo(() => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
));
SplunkIcon.displayName = 'SplunkIcon';

const KnowledgeIcon = memo(() => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
));
KnowledgeIcon.displayName = 'KnowledgeIcon';

// Helper to get platform icon component
const PlatformIcon = memo(({ platformId }: { platformId: PlatformId }) => {
  switch (platformId) {
    case 'meraki': return <MerakiIcon />;
    case 'catalyst': return <CatalystIcon />;
    case 'thousandeyes': return <ThousandEyesIcon />;
    case 'splunk': return <SplunkIcon />;
    case 'knowledge': return <KnowledgeIcon />;
    default: return null;
  }
});
PlatformIcon.displayName = 'PlatformIcon';

// =============================================================================
// Sub-Components
// =============================================================================

// Status badge in header
const StatusBadge = memo(({ phase, isComplete }: { phase: StreamingPhase; isComplete: boolean }) => {
  if (isComplete) {
    return (
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">
        <CheckIcon />
        Complete
      </span>
    );
  }

  const phaseConfig: Record<StreamingPhase, { label: string; color: string }> = {
    idle: { label: 'Idle', color: 'bg-slate-500/10 text-slate-400' },
    thinking: { label: 'Thinking', color: 'bg-cyan-500/10 text-cyan-400' },
    tool_call: { label: 'Using Tools', color: 'bg-amber-500/10 text-amber-400' },
    agent_work: { label: 'Agent Working', color: 'bg-purple-500/10 text-purple-400' },
    synthesizing: { label: 'Synthesizing', color: 'bg-blue-500/10 text-blue-400' },
    streaming: { label: 'Generating', color: 'bg-cyan-500/10 text-cyan-400' },
    error: { label: 'Error', color: 'bg-red-500/10 text-red-400' },
  };

  const config = phaseConfig[phase];

  return (
    <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${config.color} text-[10px] font-medium`}>
      {phase !== 'idle' && phase !== 'error' && <SpinnerIcon />}
      {config.label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// Simple node (Thinking, Response)
const SimpleNode = memo(({
  label,
  status,
  icon
}: {
  label: string;
  status: NodeStatus;
  icon: React.ReactNode;
}) => {
  const isActive = status === 'active';
  const isComplete = status === 'complete';

  return (
    <div className={`
      relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-300
      ${isActive ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30 scale-105' : ''}
      ${isComplete ? 'bg-emerald-500/5' : ''}
    `}>
      <div className={`
        relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
        ${isActive ? 'bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-500/50' : ''}
        ${isComplete ? 'bg-emerald-500/20 text-emerald-400' : ''}
        ${status === 'idle' ? 'bg-slate-700/50 text-slate-500' : ''}
      `}>
        {isActive && <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />}
        {isComplete ? <CheckIcon /> : icon}
      </div>
      <span className={`
        text-[11px] font-medium transition-colors
        ${isActive ? 'text-cyan-400' : ''}
        ${isComplete ? 'text-emerald-400' : ''}
        ${status === 'idle' ? 'text-slate-500' : ''}
      `}>
        {label}
      </span>
    </div>
  );
});
SimpleNode.displayName = 'SimpleNode';

// Platform node with custom color
const PlatformNodeItem = memo(({ platform, isFlowComplete }: { platform: PlatformNode; isFlowComplete: boolean }) => {
  const { id, config, status, tools } = platform;

  // Force complete status if the overall flow is complete
  const effectiveStatus = isFlowComplete ? 'complete' : status;
  const isActive = effectiveStatus === 'active';
  const isComplete = effectiveStatus === 'complete';

  return (
    <div className={`
      relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-300 min-w-[80px]
      ${isActive ? 'scale-105' : ''}
    `}
    style={{
      backgroundColor: isActive || isComplete ? config.bgColor : undefined,
      boxShadow: isActive ? `0 0 0 1px ${config.color}40` : undefined,
    }}
    >
      <div
        className={`
          relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
          ${effectiveStatus === 'idle' ? 'bg-slate-700/50 grayscale opacity-50' : ''}
        `}
        style={{
          backgroundColor: effectiveStatus !== 'idle' ? `${config.color}20` : undefined,
          color: config.color,
        }}
      >
        {isActive && (
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: config.color }}
          />
        )}
        {isComplete ? (
          <CheckIcon />
        ) : (
          <PlatformIcon platformId={id} />
        )}
      </div>

      <span
        className={`text-[11px] font-medium transition-colors ${effectiveStatus === 'idle' ? 'text-slate-500' : ''}`}
        style={{ color: effectiveStatus !== 'idle' ? config.color : undefined }}
      >
        {config.name}
      </span>

      {/* Tool count badge */}
      {tools.length > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
          style={{ backgroundColor: isComplete ? '#10b981' : config.color }}
        >
          {tools.length}
        </span>
      )}
    </div>
  );
});
PlatformNodeItem.displayName = 'PlatformNodeItem';

// Connection arrow
const FlowArrow = memo(({ active, complete }: { active: boolean; complete: boolean }) => (
  <div className="flex items-center px-1">
    <div className={`
      w-6 h-0.5 rounded-full transition-all duration-500
      ${complete ? 'bg-emerald-500' : ''}
      ${active && !complete ? 'bg-cyan-500' : ''}
      ${!active && !complete ? 'bg-slate-700' : ''}
    `} />
    <svg
      className={`w-2 h-2 -ml-0.5 transition-colors ${complete ? 'text-emerald-500' : active ? 'text-cyan-500' : 'text-slate-700'}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  </div>
));
FlowArrow.displayName = 'FlowArrow';

// Expandable chevron for tool detail
const ToolChevron = memo(({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-3 h-3 transition-transform duration-150 text-slate-500 ${expanded ? 'rotate-90' : ''}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
));
ToolChevron.displayName = 'ToolChevron';

// Tool list item — enhanced with summary, count badge, and expandable detail
const ToolItem = memo(({ tool, color, isFlowComplete }: { tool: ToolExecution; color?: string; isFlowComplete?: boolean }) => {
  const [expanded, setExpanded] = useState(false);

  // Force complete if overall flow is complete
  const effectiveStatus = isFlowComplete ? 'complete' : tool.status;
  const isRunning = effectiveStatus === 'running';
  const isComplete = effectiveStatus === 'complete' || effectiveStatus === 'error';
  const isError = tool.status === 'error';
  const duration = tool.completedAt ? tool.completedAt - tool.startedAt : undefined;
  const hasPreview = tool.resultPreview && Object.keys(tool.resultPreview).length > 0;

  // Clean up tool name for display
  const displayName = tool.name
    .replace(/^(get_|meraki_|catalyst_|thousandeyes_|splunk_)/, '')
    .replace(/_/g, ' ');

  return (
    <div className="rounded transition-all"
      style={{
        backgroundColor: isRunning && color ? `${color}20` : isComplete ? 'rgba(16, 185, 129, 0.05)' : undefined,
      }}
    >
      {/* Main row */}
      <div
        className={`
          flex items-center gap-1.5 px-2 py-1 text-[10px] cursor-pointer
          ${isRunning ? 'text-white' : isError ? 'text-red-400' : 'text-slate-400'}
        `}
        onClick={() => hasPreview && setExpanded(prev => !prev)}
      >
        {isRunning ? <SpinnerIcon /> : isComplete ? <CheckIcon /> : null}
        <span className="font-medium truncate max-w-[120px]">{displayName}</span>

        {/* Count badge */}
        {tool.resultCount != null && tool.resultCount > 0 && (
          <span
            className="min-w-[16px] h-[14px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: isError ? '#ef4444' : (color || '#10b981') }}
          >
            {tool.resultCount}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1 shrink-0">
          {duration && (
            <span className="text-slate-500 font-mono">
              {duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`}
            </span>
          )}
          {hasPreview && <ToolChevron expanded={expanded} />}
        </span>
      </div>

      {/* Summary line */}
      {tool.resultSummary && isComplete && (
        <div className={`px-2 pb-1 text-[9px] truncate ${isError ? 'text-red-400/70' : 'text-slate-500'}`}>
          {tool.resultSummary}
        </div>
      )}

      {/* Expandable detail */}
      {expanded && hasPreview && (
        <div className="px-2 pb-1.5 pt-0.5 border-t border-slate-700/30 mx-1">
          {Object.entries(tool.resultPreview!).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-[9px] py-0.5">
              <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="text-slate-300 font-mono truncate max-w-[100px] text-right">
                {typeof value === 'object' ? JSON.stringify(value).slice(0, 30) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
ToolItem.displayName = 'ToolItem';

// Flow stats summary bar
const FlowStatsRow = memo(({ tools, isComplete }: { tools: ToolExecution[]; isComplete: boolean }) => {
  const stats = useMemo(() => {
    if (tools.length === 0) return null;

    const totalTools = tools.length;
    const completed = tools.filter(t => t.status === 'complete' || t.status === 'error');
    const errors = tools.filter(t => t.status === 'error').length;
    const totalFindings = tools.reduce((sum, t) => sum + (t.resultCount || 0), 0);

    // Calculate wall-clock duration (from earliest start to latest completion)
    const starts = tools.map(t => t.startedAt);
    const completions = completed.filter(t => t.completedAt).map(t => t.completedAt!);
    const wallMs = completions.length > 0 ? Math.max(...completions) - Math.min(...starts) : 0;

    // Detect parallel execution: find overlapping tool runs
    let maxConcurrent = 1;
    for (const t of tools) {
      const concurrent = tools.filter(other =>
        other.id !== t.id && other.startedAt < (t.completedAt || Date.now()) && (other.completedAt || Date.now()) > t.startedAt
      ).length + 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
    }

    return { totalTools, errors, totalFindings, wallMs, maxConcurrent };
  }, [tools]);

  if (!stats || !isComplete) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 mt-2 rounded-lg bg-slate-800/40 border border-slate-700/30 text-[10px]">
      <span className="text-slate-400">
        <strong className="text-slate-300">{stats.totalTools}</strong> tools
      </span>
      {stats.wallMs > 0 && (
        <span className="text-slate-400">
          <strong className="text-slate-300">
            {stats.wallMs >= 1000 ? `${(stats.wallMs / 1000).toFixed(1)}s` : `${stats.wallMs}ms`}
          </strong> total
        </span>
      )}
      {stats.totalFindings > 0 && (
        <span className="text-slate-400">
          <strong className="text-cyan-400">{stats.totalFindings}</strong> findings
        </span>
      )}
      {stats.maxConcurrent > 1 && (
        <span className="text-purple-400 font-medium">
          {stats.maxConcurrent}x parallel
        </span>
      )}
      {stats.errors > 0 && (
        <span className="text-red-400 font-medium">
          {stats.errors} {stats.errors === 1 ? 'error' : 'errors'}
        </span>
      )}
    </div>
  );
});
FlowStatsRow.displayName = 'FlowStatsRow';

// =============================================================================
// Main Component
// =============================================================================

export const AgentFlowPanel = memo(({
  phase,
  currentTool: _currentTool,
  currentAgent: _currentAgent,
  toolExecutions,
  agentTurns,
  thinkingDuration: _thinkingDuration,
  className = '',
}: AgentFlowPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine if flow has data and completion status
  const hasFlowData = toolExecutions.length > 0 || agentTurns.length > 0;

  // Check if all tools have completed execution
  const allToolsComplete = toolExecutions.length > 0 &&
    toolExecutions.every(t => t.status === 'complete' || t.status === 'error');

  // Flow is complete when phase is idle with data, OR when all tools are done
  const isComplete = (phase === 'idle' && hasFlowData) ||
    (allToolsComplete && (phase === 'streaming' || phase === 'synthesizing' || phase === 'idle'));

  const isActive = phase !== 'idle' && phase !== 'error' && !isComplete;

  // Use the tools/agents directly
  const effectiveTools = toolExecutions;

  // Toggle handler
  const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);

  // Group tools by platform
  const platformNodes = useMemo((): PlatformNode[] => {
    const platformTools: Record<PlatformId, ToolExecution[]> = {
      meraki: [],
      catalyst: [],
      thousandeyes: [],
      splunk: [],
      knowledge: [],
    };

    for (const tool of effectiveTools) {
      const platform = getPlatformFromTool(tool.name);
      if (platform) {
        platformTools[platform].push(tool);
      }
    }

    // Only return platforms that have tools
    return (Object.entries(platformTools) as [PlatformId, ToolExecution[]][])
      .filter(([, tools]) => tools.length > 0)
      .map(([id, tools]) => {
        const hasRunning = tools.some(t => t.status === 'running');
        const allComplete = tools.every(t => t.status === 'complete' || t.status === 'error');

        return {
          id,
          status: hasRunning ? 'active' : allComplete ? 'complete' : 'idle',
          tools,
          config: PLATFORMS[id],
        };
      });
  }, [effectiveTools]);

  // Compute statuses for thinking and response nodes
  const thinkingStatus: NodeStatus = useMemo(() => {
    if (isComplete) return 'complete';
    if (phase === 'thinking') return 'active';
    if (platformNodes.length > 0 || phase === 'streaming') return 'complete';
    return 'idle';
  }, [phase, platformNodes.length, isComplete]);

  const responseStatus: NodeStatus = useMemo(() => {
    if (isComplete) return 'complete';
    if (phase === 'streaming' || phase === 'synthesizing') return 'active';
    return 'idle';
  }, [phase, isComplete]);

  // Don't render if truly idle with no data
  if (phase === 'idle' && !hasFlowData) {
    return null;
  }

  // Don't render on error
  if (phase === 'error') {
    return null;
  }

  return (
    <div className={`bg-slate-900/95 backdrop-blur-md border-t border-slate-700/50 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] ${className}`}>
      {/* Header - Always Visible */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-cyan-500 animate-pulse' : isComplete ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            <span className="text-xs font-semibold text-slate-300">Agent Flow</span>
          </div>
          <StatusBadge phase={phase} isComplete={isComplete} />

          {/* Platform badges */}
          {platformNodes.length > 0 && (
            <div className="flex items-center gap-1.5">
              {platformNodes.map(p => (
                <span
                  key={p.id}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: `${p.config.color}15`,
                    color: p.config.color,
                  }}
                >
                  <span className="w-3 h-3"><PlatformIcon platformId={p.id} /></span>
                  <span>{p.tools.length}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <ChevronIcon expanded={isExpanded} />
      </button>

      {/* Expandable Content */}
      <div className={`
        overflow-hidden transition-all duration-300 ease-in-out
        ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
      `}>
        <div className="px-4 pb-4">
          {/* Visual Flow Diagram */}
          <div className="flex items-center justify-center py-4 overflow-x-auto gap-1">
            {/* Thinking Node */}
            <SimpleNode
              label="Thinking"
              status={thinkingStatus}
              icon={<BrainIcon />}
            />

            <FlowArrow
              active={thinkingStatus === 'active' || platformNodes.some(p => p.status === 'active')}
              complete={thinkingStatus === 'complete'}
            />

            {/* Platform Nodes */}
            {platformNodes.length > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  {platformNodes.map((platform, idx) => (
                    <div key={platform.id} className="flex items-center">
                      <PlatformNodeItem platform={platform} isFlowComplete={isComplete} />
                      {idx < platformNodes.length - 1 && (
                        <div className="w-2 h-0.5 bg-slate-700 mx-1" />
                      )}
                    </div>
                  ))}
                </div>
                <FlowArrow
                  active={!isComplete && (platformNodes.some(p => p.status === 'active') || responseStatus === 'active')}
                  complete={isComplete || platformNodes.every(p => p.status === 'complete')}
                />
              </>
            ) : (
              // Show placeholder when no platforms yet
              thinkingStatus !== 'idle' && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/30 text-slate-500 text-[10px]">
                    Waiting for tool calls...
                  </div>
                  <FlowArrow active={false} complete={false} />
                </>
              )
            )}

            {/* Response Node */}
            <SimpleNode
              label="Response"
              status={responseStatus}
              icon={<ChatIcon />}
            />
          </div>

          {/* Tool Details by Platform */}
          {platformNodes.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
              {platformNodes.map(platform => (
                <div key={platform.id} className="space-y-1">
                  <div
                    className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-1"
                    style={{ color: platform.config.color }}
                  >
                    <span className="w-3.5 h-3.5"><PlatformIcon platformId={platform.id} /></span>
                    <span>{platform.config.name}</span>
                    <span className="text-slate-500">({platform.tools.length})</span>
                  </div>
                  <div className="space-y-0.5 max-h-[140px] overflow-y-auto">
                    {platform.tools.map((tool, index) => (
                      <ToolItem key={`${tool.id}-${index}`} tool={tool} color={platform.config.color} isFlowComplete={isComplete} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flow Stats Summary */}
          <FlowStatsRow tools={effectiveTools} isComplete={isComplete} />
        </div>
      </div>
    </div>
  );
});

AgentFlowPanel.displayName = 'AgentFlowPanel';

export default AgentFlowPanel;
