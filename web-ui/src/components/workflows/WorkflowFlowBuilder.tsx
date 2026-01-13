'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  MarkerType,
  Panel,
  NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Zap, GitBranch, Brain, Wrench, Bell, Plus, Trash2 } from 'lucide-react';
import type { FlowNode, FlowEdge, FlowData } from './types';

// ============================================================================
// Node Components
// ============================================================================

interface NodeDataBase {
  label: string;
  [key: string]: unknown;
}

// Trigger Node (Splunk Query, Schedule, Manual)
const TriggerNode = memo(({ data }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  return (
    <div className="px-4 py-3 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg border-2 border-emerald-400 min-w-[180px]">
      <Handle type="source" position={Position.Right} className="!bg-emerald-300" />
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4" />
        <span className="font-semibold text-sm">Trigger</span>
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'Splunk Query'}</div>
    </div>
  );
});
TriggerNode.displayName = 'TriggerNode';

// Condition Node
const ConditionNode = memo(({ data }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  return (
    <div className="px-4 py-3 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg border-2 border-amber-400 min-w-[180px]">
      <Handle type="target" position={Position.Left} className="!bg-amber-300" />
      <Handle type="source" position={Position.Right} id="true" className="!bg-green-400 !top-1/3" />
      <Handle type="source" position={Position.Right} id="false" className="!bg-red-400 !top-2/3" />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-4 h-4" />
        <span className="font-semibold text-sm">Condition</span>
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'If condition'}</div>
    </div>
  );
});
ConditionNode.displayName = 'ConditionNode';

// AI Analysis Node
const AINode = memo(({ data }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  return (
    <div className="px-4 py-3 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg border-2 border-purple-400 min-w-[180px]">
      <Handle type="target" position={Position.Left} className="!bg-purple-300" />
      <Handle type="source" position={Position.Right} className="!bg-purple-300" />
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-4 h-4" />
        <span className="font-semibold text-sm">AI Analysis</span>
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'Analyze & Recommend'}</div>
    </div>
  );
});
AINode.displayName = 'AINode';

// Action Node
const ActionNode = memo(({ data }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  const requiresApproval = nodeData.requires_approval as boolean;
  return (
    <div className={`
      px-4 py-3 rounded-lg shadow-lg min-w-[180px]
      ${requiresApproval
        ? 'bg-gradient-to-br from-red-500 to-red-600 text-white border-2 border-red-400'
        : 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-2 border-cyan-400'
      }
    `}>
      <Handle type="target" position={Position.Left} className={requiresApproval ? '!bg-red-300' : '!bg-cyan-300'} />
      <Handle type="source" position={Position.Right} className={requiresApproval ? '!bg-red-300' : '!bg-cyan-300'} />
      <div className="flex items-center gap-2 mb-1">
        <Wrench className="w-4 h-4" />
        <span className="font-semibold text-sm">Action</span>
        {requiresApproval && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/50">APPROVAL</span>
        )}
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'Execute tool'}</div>
    </div>
  );
});
ActionNode.displayName = 'ActionNode';

// Notify Node
const NotifyNode = memo(({ data }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  return (
    <div className="px-4 py-3 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg border-2 border-blue-400 min-w-[180px]">
      <Handle type="target" position={Position.Left} className="!bg-blue-300" />
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4" />
        <span className="font-semibold text-sm">Notify</span>
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'Send notification'}</div>
    </div>
  );
});
NotifyNode.displayName = 'NotifyNode';

const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  ai: AINode,
  action: ActionNode,
  notify: NotifyNode,
};

// ============================================================================
// Node Palette
// ============================================================================

interface NodePaletteItem {
  type: 'trigger' | 'condition' | 'ai' | 'action' | 'notify';
  label: string;
  icon: typeof Zap;
  color: string;
}

const PALETTE_ITEMS: NodePaletteItem[] = [
  { type: 'trigger', label: 'Trigger', icon: Zap, color: 'bg-emerald-500' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'bg-amber-500' },
  { type: 'ai', label: 'AI Analysis', icon: Brain, color: 'bg-purple-500' },
  { type: 'action', label: 'Action', icon: Wrench, color: 'bg-cyan-500' },
  { type: 'notify', label: 'Notify', icon: Bell, color: 'bg-blue-500' },
];

// ============================================================================
// Main Component
// ============================================================================

interface WorkflowFlowBuilderProps {
  initialData?: FlowData;
  onChange?: (data: FlowData) => void;
  readOnly?: boolean;
}

const initialNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 50, y: 150 },
    data: { label: 'Splunk Query' },
  },
];

const initialEdges: Edge[] = [];

export const WorkflowFlowBuilder = memo(({
  initialData,
  onChange,
  readOnly = false,
}: WorkflowFlowBuilderProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialData?.nodes?.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })) || initialNodes
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialData?.edges?.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      markerEnd: { type: MarkerType.ArrowClosed },
    })) || initialEdges
  );

  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Connection handler
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: true,
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Add node from palette
  const addNode = useCallback((type: NodePaletteItem['type']) => {
    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 250 + Math.random() * 100, y: 150 + Math.random() * 100 },
      data: { label: type.charAt(0).toUpperCase() + type.slice(1) },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  // Delete selected node
  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode));
    setSelectedNode(null);
  }, [selectedNode, setNodes, setEdges]);

  // Export flow data
  const flowData = useMemo((): FlowData => {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type as FlowNode['type'],
        position: n.position,
        data: n.data as Record<string, unknown>,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
      })),
    };
  }, [nodes, edges]);

  // Notify parent of changes
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
    if (onChange) {
      setTimeout(() => onChange(flowData), 0);
    }
  }, [onNodesChange, onChange, flowData]);

  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    onEdgesChange(changes);
    if (onChange) {
      setTimeout(() => onChange(flowData), 0);
    }
  }, [onEdgesChange, onChange, flowData]);

  return (
    <div className="h-full w-full bg-slate-900 rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : handleNodesChange}
        onEdgesChange={readOnly ? undefined : handleEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onPaneClick={() => setSelectedNode(null)}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-slate-900"
      >
        <Background color="#374151" gap={20} />
        <Controls className="!bg-slate-800 !border-slate-700 [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button:hover]:!bg-slate-600" />

        {/* Node Palette */}
        {!readOnly && (
          <Panel position="top-left" className="!m-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-3">
              <div className="text-xs text-slate-400 mb-2 font-medium">Add Node</div>
              <div className="flex flex-col gap-2">
                {PALETTE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      onClick={() => addNode(item.type)}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm
                        ${item.color} hover:opacity-90 transition-opacity
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Panel>
        )}

        {/* Delete Button */}
        {!readOnly && selectedNode && (
          <Panel position="top-right" className="!m-4">
            <button
              onClick={deleteSelectedNode}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Node
            </button>
          </Panel>
        )}

        {/* Instructions */}
        {!readOnly && (
          <Panel position="bottom-center" className="!mb-4">
            <div className="bg-slate-800/80 backdrop-blur rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400">
              Click nodes to select • Drag to move • Connect handles to create edges
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
});

WorkflowFlowBuilder.displayName = 'WorkflowFlowBuilder';

export default WorkflowFlowBuilder;
