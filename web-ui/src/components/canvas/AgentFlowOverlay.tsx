'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { AgentFlowDiagram } from '@/components/agent-flow';
import { TimelineModal } from '@/components/common/TimelineModal';
import type { FlowNode, FlowEdge, FlowPhase, TimelineEvent } from '@/types/agent-flow';

/**
 * AgentFlowOverlay - Collapsible bottom panel for agent flow visualization
 *
 * Design principles:
 * - Positioned at bottom of canvas as a stacked panel (not floating)
 * - Collapses to a thin bar when minimized
 * - Toggle arrow at top to expand/collapse
 * - Does NOT auto-hide - user can review flow after completion
 * - Adequate height for proper node spacing
 */

// ============================================================================
// Types
// ============================================================================

export interface AgentFlowOverlayProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  isActive: boolean;
  currentPhase: FlowPhase;
  /** Timeline events for detailed view */
  timeline?: TimelineEvent[];
  /** Duration counter in ms */
  duration?: number;
  /** Auto-hide delay after completion (ms) - DISABLED: no longer auto-hides */
  autoHideDelay?: number;
  /** Callback when overlay is dismissed */
  onDismiss?: () => void;
  className?: string;
}

// ============================================================================
// Phase Colors (quiet, no labels)
// ============================================================================

const phaseColors: Record<FlowPhase, string> = {
  idle: 'bg-slate-400',
  user_query: 'bg-blue-500',
  orchestrator_routing: 'bg-purple-500',
  agent_processing: 'bg-amber-500',
  response_generation: 'bg-cyan-500',
  complete: 'bg-emerald-500',
};

export const AgentFlowOverlay = memo(({
  nodes,
  edges,
  isActive,
  currentPhase,
  timeline = [],
  duration = 0,
  // autoHideDelay is kept for API compat but no longer used
  autoHideDelay: _autoHideDelay = 3000,
  onDismiss: _onDismiss,
  className = '',
}: AgentFlowOverlayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const hasContent = nodes.length > 0;

  // Debug logging
  console.log('[AgentFlowOverlay] Render - nodes:', nodes.map(n => n.id), 'edges:', edges.map(e => e.id), 'phase:', currentPhase, 'isActive:', isActive);

  // Auto-expand when streaming starts
  useEffect(() => {
    if (isActive) {
      setIsExpanded(true);
    }
  }, [isActive]);

  // Format duration
  const formatDuration = useCallback((ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }, []);

  // Toggle expanded state
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div
      className={`
        w-full relative
        bg-white/95 dark:bg-slate-800/95 backdrop-blur-md
        border-t border-slate-200 dark:border-slate-700
        shadow-lg
        transition-all duration-300 ease-out
        ${className}
      `}
    >
      {/* Toggle Bar - Always visible, clickable to expand/collapse */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-center gap-3 px-4 py-1.5
          hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors
          border-b border-slate-200/50 dark:border-slate-700/50"
      >
        {/* Left side: status indicators */}
        <div className="flex items-center gap-2">
          {/* Phase indicator dot */}
          <span className={`w-2 h-2 rounded-full ${phaseColors[currentPhase]} ${isActive ? 'animate-pulse' : ''}`} />

          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {['user_query', 'orchestrator_routing', 'agent_processing', 'response_generation', 'complete'].map((phase) => (
              <span
                key={phase}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  getPhaseIndex(currentPhase) >= getPhaseIndex(phase as FlowPhase)
                    ? phaseColors[phase as FlowPhase]
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Label */}
          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
            {hasContent ? (isActive ? 'Processing' : 'Agent Flow') : 'Agent Flow'}
          </span>
        </div>

        {/* Center: toggle arrow */}
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>

        {/* Right side: duration */}
        {duration > 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
            {formatDuration(duration)}
          </span>
        )}
      </button>

      {/* Collapsible Flow Diagram */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-out
          ${isExpanded ? 'h-[280px] opacity-100' : 'h-0 opacity-0'}
        `}
      >
        {hasContent ? (
          <div className="h-full">
            <AgentFlowDiagram
              nodes={nodes}
              edges={edges}
              isActive={isActive}
              className="[&_.agent-flow-controls]:hidden [&_.react-flow__controls]:hidden"
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
            Send a message to see agent activity
          </div>
        )}
      </div>

      {/* View Timeline Button - appears after completion */}
      {isExpanded && currentPhase === 'complete' && timeline.length > 0 && (
        <div className="px-4 py-2 flex justify-center border-t border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={() => setShowTimeline(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors font-medium text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            View Full Timeline ({timeline.length} events)
          </button>
        </div>
      )}

      {/* Progress bar at bottom - only show when expanded */}
      {isExpanded && (
        <div className="h-1 bg-slate-200/50 dark:bg-slate-700/50">
          <div
            className={`h-full ${phaseColors[currentPhase]} transition-all duration-500 ease-out`}
            style={{ width: `${getPhaseProgress(currentPhase)}%` }}
          />
        </div>
      )}

      {/* Timeline Modal */}
      {showTimeline && (
        <TimelineModal
          timeline={timeline}
          onClose={() => setShowTimeline(false)}
        />
      )}
    </div>
  );
});

AgentFlowOverlay.displayName = 'AgentFlowOverlay';

// ============================================================================
// Helper Functions
// ============================================================================

function getPhaseIndex(phase: FlowPhase): number {
  const phases: FlowPhase[] = ['idle', 'user_query', 'orchestrator_routing', 'agent_processing', 'response_generation', 'complete'];
  return phases.indexOf(phase);
}

function getPhaseProgress(phase: FlowPhase): number {
  switch (phase) {
    case 'idle': return 0;
    case 'user_query': return 15;
    case 'orchestrator_routing': return 35;
    case 'agent_processing': return 60;
    case 'response_generation': return 85;
    case 'complete': return 100;
    default: return 0;
  }
}

export default AgentFlowOverlay;
