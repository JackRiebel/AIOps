'use client';

import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  Wrench,
  Clock,
  Zap,
  Brain,
} from 'lucide-react';
import type { AgentNodeData, AgentNodeStatus, AgentType, SpecialistAgentId } from '@/types/agent-flow';
import { SPECIALIST_AGENTS } from '@/types/agent-flow';

// ============================================================================
// Status Styles
// ============================================================================

const statusStyles: Record<AgentNodeStatus, string> = {
  idle: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-600',
  active: 'border-[3px] shadow-xl ring-2 ring-offset-2 dark:ring-offset-slate-900',
  completed: 'shadow-lg',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-500 shadow-md',
};

// Distinct color palette for agents - each agent gets a unique vibrant color
const agentColorPalette = [
  { // Cyan
    active: 'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-500 dark:border-cyan-400 ring-cyan-500/40',
    completed: 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-400 dark:border-cyan-500',
    leftAccent: 'before:bg-cyan-500',
    textColor: 'text-cyan-600 dark:text-cyan-400',
    pingColor: 'bg-cyan-400',
    dotColor: 'bg-cyan-500',
  },
  { // Orange
    active: 'bg-orange-100 dark:bg-orange-900/40 border-orange-500 dark:border-orange-400 ring-orange-500/40',
    completed: 'bg-orange-50 dark:bg-orange-900/30 border-orange-400 dark:border-orange-500',
    leftAccent: 'before:bg-orange-500',
    textColor: 'text-orange-600 dark:text-orange-400',
    pingColor: 'bg-orange-400',
    dotColor: 'bg-orange-500',
  },
  { // Purple
    active: 'bg-purple-100 dark:bg-purple-900/40 border-purple-500 dark:border-purple-400 ring-purple-500/40',
    completed: 'bg-purple-50 dark:bg-purple-900/30 border-purple-400 dark:border-purple-500',
    leftAccent: 'before:bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    pingColor: 'bg-purple-400',
    dotColor: 'bg-purple-500',
  },
  { // Pink
    active: 'bg-pink-100 dark:bg-pink-900/40 border-pink-500 dark:border-pink-400 ring-pink-500/40',
    completed: 'bg-pink-50 dark:bg-pink-900/30 border-pink-400 dark:border-pink-500',
    leftAccent: 'before:bg-pink-500',
    textColor: 'text-pink-600 dark:text-pink-400',
    pingColor: 'bg-pink-400',
    dotColor: 'bg-pink-500',
  },
  { // Teal
    active: 'bg-teal-100 dark:bg-teal-900/40 border-teal-500 dark:border-teal-400 ring-teal-500/40',
    completed: 'bg-teal-50 dark:bg-teal-900/30 border-teal-400 dark:border-teal-500',
    leftAccent: 'before:bg-teal-500',
    textColor: 'text-teal-600 dark:text-teal-400',
    pingColor: 'bg-teal-400',
    dotColor: 'bg-teal-500',
  },
  { // Rose
    active: 'bg-rose-100 dark:bg-rose-900/40 border-rose-500 dark:border-rose-400 ring-rose-500/40',
    completed: 'bg-rose-50 dark:bg-rose-900/30 border-rose-400 dark:border-rose-500',
    leftAccent: 'before:bg-rose-500',
    textColor: 'text-rose-600 dark:text-rose-400',
    pingColor: 'bg-rose-400',
    dotColor: 'bg-rose-500',
  },
  { // Indigo
    active: 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500 dark:border-indigo-400 ring-indigo-500/40',
    completed: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-500',
    leftAccent: 'before:bg-indigo-500',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    pingColor: 'bg-indigo-400',
    dotColor: 'bg-indigo-500',
  },
  { // Lime
    active: 'bg-lime-100 dark:bg-lime-900/40 border-lime-500 dark:border-lime-400 ring-lime-500/40',
    completed: 'bg-lime-50 dark:bg-lime-900/30 border-lime-400 dark:border-lime-500',
    leftAccent: 'before:bg-lime-500',
    textColor: 'text-lime-600 dark:text-lime-400',
    pingColor: 'bg-lime-400',
    dotColor: 'bg-lime-500',
  },
];

// Get color based on node ID hash for consistent coloring
function getAgentColorIndex(nodeId: string): number {
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    const char = nodeId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % agentColorPalette.length;
}

const agentStyles: Record<AgentType, { active: string; completed: string; leftAccent: string; icon: React.ReactNode }> = {
  knowledge: {
    active: 'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-500 dark:border-cyan-400 ring-cyan-500/40',
    completed: 'bg-cyan-50 dark:bg-cyan-900/30 border-cyan-400 dark:border-cyan-500',
    leftAccent: 'before:bg-cyan-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  implementation: {
    active: 'bg-amber-100 dark:bg-amber-900/40 border-amber-500 dark:border-amber-400 ring-amber-500/40',
    completed: 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-500',
    leftAccent: 'before:bg-amber-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  tool: {
    active: 'bg-violet-100 dark:bg-violet-900/40 border-violet-500 dark:border-violet-400 ring-violet-500/40',
    completed: 'bg-violet-50 dark:bg-violet-900/30 border-violet-400 dark:border-violet-500',
    leftAccent: 'before:bg-violet-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
  },
  specialist: {
    active: 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500 dark:border-indigo-400 ring-indigo-500/40',
    completed: 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-500',
    leftAccent: 'before:bg-indigo-500',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
  },
};

// Specialist-specific icons
const specialistIcons: Record<SpecialistAgentId, React.ReactNode> = {
  'meraki-agent': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  'thousandeyes-agent': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  ),
  'catalyst-agent': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z"/>
    </svg>
  ),
  'splunk-agent': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
    </svg>
  ),
  'ui-agent': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
    </svg>
  ),
};

// Get styles for a specialist agent
const getSpecialistStyles = (agentId: SpecialistAgentId) => {
  const agent = SPECIALIST_AGENTS[agentId];
  if (!agent) return null;

  // Extract color name from Tailwind class (e.g., 'text-teal-500' -> 'teal')
  const colorMatch = agent.color?.match(/text-(\w+)-/);
  const colorName = colorMatch ? colorMatch[1] : 'indigo';

  return {
    active: `${agent.bgColor} ${agent.darkBgColor} ${agent.borderColor} ${agent.darkBorderColor} ring-${colorName}-400/30`,
    completed: 'bg-emerald-50 dark:bg-emerald-900/30',
    leftAccent: `before:bg-${colorName}-500`,
    icon: specialistIcons[agentId],
    color: agent.color,
  };
};

const agentTypeLabels: Record<AgentType, string> = {
  knowledge: 'Knowledge Agent',
  implementation: 'Impl Agent',
  tool: 'Tool Agent',
  specialist: 'Specialist Agent',
};

// ============================================================================
// AgentNode Component
// ============================================================================

interface AgentNodeProps {
  id: string;
  data: AgentNodeData;
}

// Helper to format duration
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

export const AgentNode = memo(({ id, data }: AgentNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    label,
    status,
    agentType,
    query,
    confidence,
    sourcesCount,
    stepsCount,
    duration,
    thought,
    currentTool,
    toolsUsed,
    tokensUsed,
    error,
    // Specialist agent fields
    specialistAgentId,
    artifactsCount,
    entitiesExtracted,
    turnNumber,
  } = data;

  // Get unique color for this agent based on node ID
  const colorIndex = getAgentColorIndex(id);
  const uniqueColor = agentColorPalette[colorIndex];

  // Get specialist-specific styles if this is a specialist agent
  const specialistStyles = specialistAgentId ? getSpecialistStyles(specialistAgentId) : null;
  // Use unique color palette for dynamic coloring per agent instance
  const agentStyle = {
    ...agentStyles[agentType],
    active: uniqueColor.active,
    completed: uniqueColor.completed,
    leftAccent: uniqueColor.leftAccent,
  };

  // Get label from specialist agent if available
  const displayLabel = specialistAgentId && SPECIALIST_AGENTS[specialistAgentId]
    ? SPECIALIST_AGENTS[specialistAgentId].shortName
    : label || agentTypeLabels[agentType];

  const getStatusClass = () => {
    if (status === 'idle') return statusStyles.idle;
    if (status === 'active') return agentStyle.active;
    if (status === 'completed') return `${agentStyle.completed} ${statusStyles.completed}`;
    return statusStyles.error;
  };

  // Get icon color based on unique color palette
  const getIconColor = () => {
    if (status === 'completed') return 'text-emerald-500';
    if (status === 'error') return 'text-red-500';
    if (status !== 'active') return 'text-slate-400 dark:text-slate-500';

    // Use unique color from palette
    return uniqueColor.textColor;
  };

  const iconColor = getIconColor();

  const hasExpandableContent = thought || currentTool || (toolsUsed && toolsUsed.length > 0) || tokensUsed || error || (entitiesExtracted && entitiesExtracted.length > 0);

  // Get left accent class for visual categorization
  const getLeftAccent = () => {
    if (status === 'idle') return '';
    return agentStyle.leftAccent || '';
  };

  return (
    <div
      className={`
        relative px-4 py-3 rounded-xl min-w-[180px] max-w-[320px]
        transition-all duration-300 ease-out cursor-pointer
        bg-white dark:bg-slate-800
        shadow-[0_6px_24px_rgba(0,0,0,0.2),0_3px_8px_rgba(0,0,0,0.12)]
        dark:shadow-[0_6px_24px_rgba(0,0,0,0.5),0_3px_8px_rgba(0,0,0,0.35)]
        hover:shadow-[0_10px_36px_rgba(0,0,0,0.28),0_5px_14px_rgba(0,0,0,0.18)]
        dark:hover:shadow-[0_10px_36px_rgba(0,0,0,0.6),0_5px_14px_rgba(0,0,0,0.45)]
        border border-slate-300 dark:border-slate-600
        before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full
        ${getLeftAccent()}
        ${getStatusClass()}
      `}
      onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-white dark:!border-slate-800"
      />

      {/* Turn Number Badge */}
      {turnNumber !== undefined && (
        <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-slate-600 dark:bg-slate-500 flex items-center justify-center z-10">
          <span className="text-[10px] font-bold text-white">{turnNumber}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex-shrink-0 ${iconColor} ${status === 'active' ? 'animate-pulse' : ''}`}>
          {agentStyle.icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 block truncate">
            {displayLabel}
          </span>
        </div>
        {hasExpandableContent && (
          <button
            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
        )}
      </div>

      {/* Current Tool Indicator */}
      {currentTool && status === 'active' && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50">
          <Wrench className="w-3 h-3 text-cyan-500 animate-spin" />
          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
            {currentTool}
          </span>
        </div>
      )}

      {/* Thinking Indicator */}
      {thought && status === 'active' && !currentTool && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md bg-purple-50 dark:bg-purple-900/30">
          <Brain className="w-3 h-3 text-purple-500 animate-pulse" />
          <span className="text-xs text-purple-600 dark:text-purple-300 truncate">
            Thinking...
          </span>
        </div>
      )}

      {/* Query Preview */}
      {query && status === 'active' && !isExpanded && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2 break-words">
          {query}
        </p>
      )}

      {/* Error State */}
      {status === 'error' && error && (
        <div className="mb-2 p-2 rounded-md bg-red-100 dark:bg-red-900/30">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-700 dark:text-red-300">Error</span>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2">
            {error}
          </p>
          <button
            className="mt-1.5 flex items-center gap-1 px-2 py-0.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 rounded"
            onClick={(e) => {
              e.stopPropagation();
              // Retry logic would go here
            }}
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* Results (when completed) */}
      {status === 'completed' && (
        <div className="space-y-1.5">
          {/* Confidence Meter */}
          {confidence !== undefined && (
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-amber-500" />
              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    confidence >= 0.8 ? 'bg-emerald-500' : confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-8 text-right">
                {(confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {/* Stats Row */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            {sourcesCount !== undefined && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                {sourcesCount} sources
              </span>
            )}
            {stepsCount !== undefined && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                {stepsCount} steps
              </span>
            )}
            {artifactsCount !== undefined && artifactsCount > 0 && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded">
                {artifactsCount} artifacts
              </span>
            )}
            {duration !== undefined && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
                <Clock className="w-3 h-3" />
                {formatDuration(duration)}
              </span>
            )}
          </div>

          {/* Entities Extracted (collapsed view) */}
          {entitiesExtracted && entitiesExtracted.length > 0 && !isExpanded && (
            <div className="flex flex-wrap gap-1 mt-1">
              {entitiesExtracted.slice(0, 3).map((entity, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
                >
                  {entity}
                </span>
              ))}
              {entitiesExtracted.length > 3 && (
                <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                  +{entitiesExtracted.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && hasExpandableContent && (
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600 space-y-2">
          {/* Full Query */}
          {query && (
            <div>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase">Query</span>
              <p className="text-xs text-slate-600 dark:text-slate-300 break-words">
                {query}
              </p>
            </div>
          )}

          {/* Thought Process */}
          {thought && (
            <div>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase">Thinking</span>
              <p className="text-xs text-slate-600 dark:text-slate-300 break-words">
                {thought}
              </p>
            </div>
          )}

          {/* Tools Used */}
          {toolsUsed && toolsUsed.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase">Tools</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {toolsUsed.map((tool, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Token Usage */}
          {tokensUsed && (
            <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
              <span>↓ {tokensUsed.input.toLocaleString()}</span>
              <span>↑ {tokensUsed.output.toLocaleString()}</span>
            </div>
          )}

          {/* Entities Extracted (expanded view) */}
          {entitiesExtracted && entitiesExtracted.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase">Entities Found</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {entitiesExtracted.map((entity, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
                  >
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Indicator - uses unique color from palette */}
      {status === 'active' && (
        <div className="absolute -top-1 -right-1 w-3 h-3">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${uniqueColor.pingColor}`} />
          <span className={`relative inline-flex rounded-full h-3 w-3 ${uniqueColor.dotColor}`} />
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

      {/* Error Indicator */}
      {status === 'error' && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <AlertTriangle className="w-3 h-3 text-white" />
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

AgentNode.displayName = 'AgentNode';

export default AgentNode;
