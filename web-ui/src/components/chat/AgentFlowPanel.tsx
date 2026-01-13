'use client';

import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AgentFlowDiagram } from '@/components/agent-flow';
import { TimelineModal } from '@/components/common/TimelineModal';
import type { FlowNode, FlowEdge, FlowPhase, TimelineEvent } from '@/types/agent-flow';

// ============================================================================
// Constants
// ============================================================================

const MIN_HEIGHT = 150;
const MAX_HEIGHT = 800;
const DEFAULT_HEIGHT = 300;

// ============================================================================
// Types
// ============================================================================

export interface AgentFlowPanelProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  isActive: boolean;
  currentPhase: FlowPhase;
  timeline?: TimelineEvent[];
  className?: string;
  defaultExpanded?: boolean;
  onNodeClick?: (nodeId: string) => void;
}

// ============================================================================
// Phase Configuration
// ============================================================================

const phaseConfig: Record<FlowPhase, { label: string; color: string; bgColor: string; step: number }> = {
  idle: { label: 'Ready', color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-700', step: 0 },
  user_query: { label: 'Query', color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/50', step: 1 },
  orchestrator_routing: { label: 'Routing', color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/50', step: 2 },
  agent_processing: { label: 'Processing', color: 'text-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-900/50', step: 3 },
  response_generation: { label: 'Generating', color: 'text-cyan-500', bgColor: 'bg-cyan-100 dark:bg-cyan-900/50', step: 4 },
  complete: { label: 'Complete', color: 'text-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-900/50', step: 5 },
};

// Phase icons
function PhaseIcon({ phase, className = '' }: { phase: FlowPhase; className?: string }) {
  switch (phase) {
    case 'user_query':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'orchestrator_routing':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'agent_processing':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'response_generation':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'complete':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

// ============================================================================
// AgentFlowPanel Component
// ============================================================================

export const AgentFlowPanel = memo(({
  nodes,
  edges,
  isActive,
  currentPhase,
  timeline = [],
  className = '',
  defaultExpanded = true,
  onNodeClick,
}: AgentFlowPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!isExpanded) {
      // If collapsed, just toggle on click
      return;
    }
    e.preventDefault();
    setIsResizing(true);
    hasDraggedRef.current = false;
    startYRef.current = e.clientY;
    startHeightRef.current = panelHeight;
  }, [panelHeight, isExpanded]);

  // Handle header click (only toggle if not dragging)
  const handleHeaderClick = useCallback(() => {
    if (!hasDraggedRef.current) {
      toggleExpanded();
    }
    hasDraggedRef.current = false;
  }, [toggleExpanded]);

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startYRef.current;
      // Only consider it a drag if moved more than 3px
      if (Math.abs(deltaY) > 3) {
        hasDraggedRef.current = true;
      }
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + deltaY));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Get current phase config
  const phase = phaseConfig[currentPhase];

  // Don't show panel if there's no activity and we're in idle state
  const hasActivity = nodes.length > 0 && currentPhase !== 'idle';

  if (!hasActivity && !isActive) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className={`border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${isResizing ? 'select-none' : ''} ${className}`}
    >
      {/* Header - drag to resize when expanded, click to toggle */}
      <div
        className={`
          w-full flex items-center justify-between px-4 py-3
          hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors select-none
          ${isExpanded ? 'cursor-ns-resize' : 'cursor-pointer'}
          ${isResizing ? 'bg-slate-100 dark:bg-slate-700' : ''}
        `}
        onMouseDown={handleResizeStart}
        onClick={handleHeaderClick}
      >
        <div className="flex items-center gap-3">
          {/* Flow Icon with Activity Indicator */}
          <div className={`relative p-2 rounded-lg ${isActive ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
            <svg
              className={`w-5 h-5 ${isActive ? 'text-blue-500' : 'text-slate-500'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {/* Active pulse indicator */}
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Agent Flow
            </span>

            {/* Phase Badge with Icon */}
            <span className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${phase.bgColor} ${phase.color}`}>
              <PhaseIcon phase={currentPhase} className="w-4 h-4" />
              {phase.label}
            </span>

            {/* Step Indicator */}
            {isActive && (
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Step {phase.step}/5
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Node Count */}
          {nodes.length > 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
              {nodes.filter(n => n.type === 'agent').length} agent{nodes.filter(n => n.type === 'agent').length !== 1 ? 's' : ''}
            </span>
          )}

          {/* Expand/Collapse Icon */}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Collapsible Content */}
      <div
        className={`overflow-hidden transition-all ease-in-out ${
          isExpanded ? 'opacity-100' : 'max-h-0 opacity-0'
        } ${isResizing ? 'transition-none' : 'duration-300'}`}
        style={{ maxHeight: isExpanded ? `${panelHeight + 100}px` : 0 }}
      >
        <div
          className="border-t border-slate-200 dark:border-slate-700"
          style={{ height: `${panelHeight}px` }}
        >
          <AgentFlowDiagram
            nodes={nodes}
            edges={edges}
            isActive={isActive}
            onNodeClick={onNodeClick}
          />
        </div>

        {/* View Timeline Button - appears after completion */}
        {currentPhase === 'complete' && timeline.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-center">
            <button
              onClick={() => setShowTimeline(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View Full Timeline ({timeline.length} events)
            </button>
          </div>
        )}
      </div>

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

AgentFlowPanel.displayName = 'AgentFlowPanel';

export default AgentFlowPanel;
