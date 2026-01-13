'use client';

import { memo, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { UserNode } from './nodes/UserNode';
import { OrchestratorNode } from './nodes/OrchestratorNode';
import { AgentNode } from './nodes/AgentNode';
import { ResponseNode } from './nodes/ResponseNode';
import PlatformNode from './nodes/PlatformNode';
import { AnimatedEdge } from './edges/AnimatedEdge';
import type { FlowNode, FlowEdge, AgentFlowDiagramProps, AgentNodeData, SpecialistAgentId, PlatformId, PlatformNodeData } from '@/types/agent-flow';
import { SPECIALIST_AGENTS, PLATFORMS } from '@/types/agent-flow';

// ============================================================================
// Node and Edge Type Registry
// ============================================================================

const nodeTypes = {
  user: UserNode,
  orchestrator: OrchestratorNode,
  agent: AgentNode,
  response: ResponseNode,
  platform: PlatformNode,
} as const;

const edgeTypes = {
  animated: AnimatedEdge,
} as const;

// ============================================================================
// MiniMap Node Colors
// ============================================================================

const getNodeColor = (node: Node): string => {
  const data = node.data as { status?: string; agentType?: string; specialistAgentId?: SpecialistAgentId };
  switch (node.type) {
    case 'user':
      return data.status === 'active' ? '#3b82f6' : '#94a3b8';
    case 'orchestrator':
      return data.status === 'active' ? '#a855f7' : '#94a3b8';
    case 'agent': {
      if (data.status === 'completed') {
        return '#10b981';
      }
      if (data.status === 'active') {
        // Use specialist color if available
        if (data.specialistAgentId && SPECIALIST_AGENTS[data.specialistAgentId]) {
          return SPECIALIST_AGENTS[data.specialistAgentId].color;
        }
        // Default to agent type colors
        switch (data.agentType) {
          case 'knowledge': return '#06b6d4';
          case 'implementation': return '#f59e0b';
          case 'tool': return '#8b5cf6';
          case 'specialist': return '#6366f1';
          default: return '#f59e0b';
        }
      }
      return '#94a3b8';
    }
    case 'response':
      return data.status === 'completed' ? '#10b981' : '#94a3b8';
    case 'platform': {
      const platformData = node.data as { platform?: PlatformId; status?: string };
      if (platformData.platform && PLATFORMS[platformData.platform]) {
        return PLATFORMS[platformData.platform].color;
      }
      return '#94a3b8';
    }
    default:
      return '#94a3b8';
  }
};

// ============================================================================
// FitView Controller - Inner component that can use useReactFlow
// ============================================================================

interface FitViewControllerProps {
  nodes: FlowNode[];
  isActive: boolean;
}

const FitViewController = memo(({ nodes, isActive }: FitViewControllerProps) => {
  const { fitView } = useReactFlow();
  const prevNodeCountRef = useRef(0);
  const prevIsActiveRef = useRef(isActive);
  const hasFittedAfterCompletionRef = useRef(false);
  const fitViewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger fitView with consistent options
  const triggerFitView = useCallback((reason: string, delay: number = 150) => {
    // Clear any pending fitView
    if (fitViewTimeoutRef.current) {
      clearTimeout(fitViewTimeoutRef.current);
    }

    fitViewTimeoutRef.current = setTimeout(() => {
      console.log('[AgentFlowDiagram] Triggering fitView - reason:', reason, 'nodes:', nodes.length);
      fitView({
        padding: 0.2,
        minZoom: 0.2,
        maxZoom: 1.0,
        duration: 300,
        includeHiddenNodes: true,
      });
    }, delay);
  }, [fitView, nodes.length]);

  useEffect(() => {
    const currentCount = nodes.length;
    const prevCount = prevNodeCountRef.current;
    const wasActive = prevIsActiveRef.current;

    // Case 1: Initial mount with nodes - always fit
    if (prevCount === 0 && currentCount > 0) {
      triggerFitView('initial-mount', 200);
    }
    // Case 2: Layout expansion (from 3 simple nodes to 4+ with platforms)
    else if (prevCount <= 3 && currentCount > 3) {
      triggerFitView('layout-expansion', 150);
      hasFittedAfterCompletionRef.current = false;
    }
    // Case 3: Flow just completed (isActive went from true to false)
    else if (wasActive && !isActive && !hasFittedAfterCompletionRef.current) {
      triggerFitView('flow-completion', 200);
      hasFittedAfterCompletionRef.current = true;
    }
    // Case 4: Node count changed significantly (platforms added/removed)
    else if (Math.abs(currentCount - prevCount) >= 1 && currentCount > 3) {
      triggerFitView('node-change', 100);
    }

    prevNodeCountRef.current = currentCount;
    prevIsActiveRef.current = isActive;

    return () => {
      if (fitViewTimeoutRef.current) {
        clearTimeout(fitViewTimeoutRef.current);
      }
    };
  }, [nodes.length, isActive, triggerFitView]);

  // Reset completion tracking when flow resets to simple layout
  useEffect(() => {
    if (nodes.length <= 3) {
      hasFittedAfterCompletionRef.current = false;
    }
  }, [nodes.length]);

  return null;
});

FitViewController.displayName = 'FitViewController';

// ============================================================================
// AgentFlowDiagram Component
// ============================================================================

export const AgentFlowDiagram = memo(({
  nodes,
  edges,
  isActive,
  className = '',
  onNodeClick,
}: AgentFlowDiagramProps) => {
  // Memoize default edge options
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'animated',
      animated: false,
    }),
    []
  );

  // Handle node click with proper typing
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  return (
    <div className={`relative w-full h-full min-h-[300px] ${className}`}>
      {/* Activity indicator */}
      {isActive && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Processing
          </span>
        </div>
      )}

      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes as Node[]}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onNodeClick={onNodeClick ? handleNodeClick : undefined}
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.3,
            maxZoom: 1.5,
            includeHiddenNodes: true,
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          className="bg-slate-50 dark:bg-slate-900"
        >
          <FitViewController nodes={nodes} isActive={isActive} />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(148, 163, 184, 0.2)"
          />
          <Controls
            showInteractive={false}
            position="top-right"
            className="agent-flow-controls"
          />
        </ReactFlow>
      </ReactFlowProvider>

      {/* Legends hidden in overlay mode - only shown on standalone pages */}
      <div className="agent-flow-legend hidden absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
        <LegendItem color="bg-blue-500" label="User" />
        <LegendItem color="bg-purple-500" label="Orchestrator" />
        <LegendItem color="bg-cyan-500" label="Knowledge" />
        <LegendItem color="bg-amber-500" label="Implementation" />
        <LegendItem color="bg-emerald-500" label="Complete" />
      </div>

      {/* Specialist Agents Legend (hidden in overlay mode) */}
      <div className="agent-flow-legend hidden absolute bottom-3 right-3 z-10 flex flex-wrap gap-2">
        <LegendItem color="bg-[#00bceb]" label="Meraki" />
        <LegendItem color="bg-[#ff6b35]" label="ThousandEyes" />
        <LegendItem color="bg-[#6abf4b]" label="Catalyst" />
        <LegendItem color="bg-[#65a637]" label="Splunk" />
        <LegendItem color="bg-[#9b59b6]" label="UI" />
      </div>
    </div>
  );
});

AgentFlowDiagram.displayName = 'AgentFlowDiagram';

// ============================================================================
// Legend Item Component
// ============================================================================

interface LegendItemProps {
  color: string;
  label: string;
}

const LegendItem = memo(({ color, label }: LegendItemProps) => (
  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700">
    <span className={`w-2 h-2 rounded-full ${color}`} />
    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
      {label}
    </span>
  </div>
));

LegendItem.displayName = 'LegendItem';

export default AgentFlowDiagram;
