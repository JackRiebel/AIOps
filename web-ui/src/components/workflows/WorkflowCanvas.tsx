'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
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
import {
  X, Save, Play, Zap, GitBranch, Brain, Wrench, Bell,
  Hand, ChevronRight, GripVertical, AlertTriangle, Check,
  Settings, Info
} from 'lucide-react';
import {
  ACTION_REGISTRY,
  type ActionDefinition,
  type FlowData,
  type CreateWorkflowRequest,
  type Workflow,
  type RiskLevel
} from './types';

// ============================================================================
// Node Components
// ============================================================================

interface NodeDataBase {
  label: string;
  config?: Record<string, unknown>;
  actionId?: string;
  [key: string]: unknown;
}

// Trigger Node
const TriggerNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  return (
    <div className={`px-4 py-3 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600
                     text-white shadow-lg min-w-[180px] transition-all
                     ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'border-2 border-emerald-400'}`}>
      <Handle type="source" position={Position.Right} className="!bg-emerald-300 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4" />
        <span className="font-semibold text-sm">Trigger</span>
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'When this happens...'}</div>
    </div>
  );
});
TriggerNode.displayName = 'TriggerNode';

// Condition Node
const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  return (
    <div className={`px-4 py-3 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600
                     text-white shadow-lg min-w-[180px] transition-all
                     ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'border-2 border-amber-400'}`}>
      <Handle type="target" position={Position.Left} className="!bg-amber-300 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="true" className="!bg-green-400 !w-3 !h-3 !top-[30%]" />
      <Handle type="source" position={Position.Right} id="false" className="!bg-red-400 !w-3 !h-3 !top-[70%]" />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="w-4 h-4" />
        <span className="font-semibold text-sm">Condition</span>
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'If this is true...'}</div>
      <div className="flex justify-between mt-2 text-[10px] opacity-70">
        <span className="text-green-200">Yes</span>
        <span className="text-red-200">No</span>
      </div>
    </div>
  );
});
ConditionNode.displayName = 'ConditionNode';

// AI Node
const AINode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  return (
    <div className={`px-4 py-3 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600
                     text-white shadow-lg min-w-[180px] transition-all
                     ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'border-2 border-purple-400'}`}>
      <Handle type="target" position={Position.Left} className="!bg-purple-300 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-purple-300 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-4 h-4" />
        <span className="font-semibold text-sm">AI Decision</span>
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'Let AI analyze...'}</div>
    </div>
  );
});
AINode.displayName = 'AINode';

// Action Node
const ActionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  const action = nodeData.actionId ? ACTION_REGISTRY.find(a => a.id === nodeData.actionId) : null;
  const requiresApproval = nodeData.requires_approval as boolean;

  return (
    <div className={`px-4 py-3 rounded-lg shadow-lg min-w-[180px] transition-all
                     ${requiresApproval
                       ? 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                       : 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white'
                     }
                     ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' :
                       requiresApproval ? 'border-2 border-red-400' : 'border-2 border-cyan-400'}`}>
      <Handle type="target" position={Position.Left} className={`!w-3 !h-3 ${requiresApproval ? '!bg-red-300' : '!bg-cyan-300'}`} />
      <Handle type="source" position={Position.Right} className={`!w-3 !h-3 ${requiresApproval ? '!bg-red-300' : '!bg-cyan-300'}`} />
      <div className="flex items-center gap-2 mb-1">
        {action ? <span className="text-lg">{action.icon}</span> : <Wrench className="w-4 h-4" />}
        <span className="font-semibold text-sm">Action</span>
        {requiresApproval && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20">
            <Hand className="w-3 h-3 inline" /> Approval
          </span>
        )}
      </div>
      <div className="text-xs opacity-90">{nodeData.label || action?.name || 'Execute action'}</div>
    </div>
  );
});
ActionNode.displayName = 'ActionNode';

// Notify Node
const NotifyNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  return (
    <div className={`px-4 py-3 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600
                     text-white shadow-lg min-w-[180px] transition-all
                     ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'border-2 border-blue-400'}`}>
      <Handle type="target" position={Position.Left} className="!bg-blue-300 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Bell className="w-4 h-4" />
        <span className="font-semibold text-sm">Notify</span>
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'Send notification'}</div>
    </div>
  );
});
NotifyNode.displayName = 'NotifyNode';

// Approval Node
const ApprovalNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as NodeDataBase;
  return (
    <div className={`px-4 py-3 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600
                     text-white shadow-lg min-w-[180px] transition-all
                     ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'border-2 border-orange-400'}`}>
      <Handle type="target" position={Position.Left} className="!bg-orange-300 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-orange-300 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Hand className="w-4 h-4" />
        <span className="font-semibold text-sm">Wait for Approval</span>
      </div>
      <div className="text-xs opacity-90">{nodeData.label || 'Pause for human review'}</div>
    </div>
  );
});
ApprovalNode.displayName = 'ApprovalNode';

const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  ai: AINode,
  action: ActionNode,
  notify: NotifyNode,
  approval: ApprovalNode,
};

// ============================================================================
// Sidebar Node Palette
// ============================================================================

interface PaletteItem {
  type: keyof typeof nodeTypes;
  label: string;
  icon: typeof Zap;
  color: string;
  description: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'trigger', label: 'Trigger', icon: Zap, color: 'bg-emerald-500', description: 'What starts this workflow' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'bg-amber-500', description: 'Make a decision' },
  { type: 'ai', label: 'AI Decision', icon: Brain, color: 'bg-purple-500', description: 'Let AI analyze' },
  { type: 'action', label: 'Action', icon: Wrench, color: 'bg-cyan-500', description: 'Do something' },
  { type: 'approval', label: 'Approval', icon: Hand, color: 'bg-orange-500', description: 'Wait for approval' },
  { type: 'notify', label: 'Notify', icon: Bell, color: 'bg-blue-500', description: 'Send notification' },
];

// ============================================================================
// Main Canvas Component
// ============================================================================

interface WorkflowCanvasProps {
  onClose: () => void;
  onSave: (workflow: Workflow) => void;
  initialFlow?: FlowData;
  workflowName?: string;
}

export const WorkflowCanvas = memo(({ onClose, onSave, initialFlow, workflowName }: WorkflowCanvasProps) => {
  const [name, setName] = useState(workflowName || '');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    initialFlow?.nodes?.map(n => ({
      id: n.id,
      type: n.type as string,
      position: n.position,
      data: n.data,
    })) || [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 100, y: 200 },
        data: { label: 'Splunk Query' },
      },
    ]
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialFlow?.edges?.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: true,
    })) || []
  );

  const selectedNode = useMemo(() =>
    nodes.find(n => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const onConnect = useCallback((connection: Connection) => {
    const newEdge: Edge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
      animated: true,
    };
    setEdges((eds) => [...eds, newEdge]);
  }, [setEdges]);

  const addNode = useCallback((type: keyof typeof nodeTypes) => {
    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position: { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: { label: PALETTE_ITEMS.find(p => p.type === type)?.label || type },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
  }, [setNodes]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [setNodes, setEdges, selectedNodeId]);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<NodeDataBase>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
      )
    );
  }, [setNodes]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Please enter a workflow name');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build flow data
      const flowData: FlowData = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type as 'trigger' | 'condition' | 'ai' | 'action' | 'notify',
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

      // Extract actions from action nodes
      const actionNodes = nodes.filter(n => n.type === 'action');
      const actions = actionNodes.map(n => ({
        tool: (n.data as NodeDataBase).actionId || 'custom.webhook',
        params: (n.data as NodeDataBase).config || {},
        requires_approval: (n.data as NodeDataBase).requires_approval as boolean || false,
      }));

      const payload: CreateWorkflowRequest = {
        name,
        description,
        trigger_type: 'manual',
        actions,
        ai_enabled: nodes.some(n => n.type === 'ai'),
        flow_data: flowData,
      };

      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to save workflow');
      }

      const workflow = await response.json();
      onSave(workflow);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  }, [name, description, nodes, edges, onSave, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workflow name..."
              className="bg-transparent text-lg font-medium text-white placeholder-slate-500
                       border-none outline-none focus:ring-0"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg
                     hover:bg-cyan-500 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Node Palette */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Add Nodes</h3>
          <div className="space-y-2">
            {PALETTE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => addNode(item.type)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-700/50
                           hover:bg-slate-700 transition-colors text-left group"
                >
                  <div className={`p-2 rounded-lg ${item.color}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-xs text-slate-400 truncate">{item.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>

          {/* Actions Library */}
          <h3 className="text-sm font-medium text-slate-400 mt-6 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {ACTION_REGISTRY.filter(a => a.verified).slice(0, 5).map((action) => (
              <button
                key={action.id}
                onClick={() => {
                  const id = `action-${Date.now()}`;
                  const newNode: Node = {
                    id,
                    type: 'action',
                    position: { x: 300, y: 200 },
                    data: {
                      label: action.name,
                      actionId: action.id,
                      requires_approval: action.riskLevel === 'high',
                    },
                  };
                  setNodes((nds) => [...nds, newNode]);
                  setSelectedNodeId(id);
                }}
                className="w-full flex items-center gap-2 p-2 rounded-lg bg-slate-700/30
                         hover:bg-slate-700/50 transition-colors text-left text-sm"
              >
                <span className="text-lg">{action.icon}</span>
                <span className="text-slate-300 truncate">{action.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            className="bg-slate-900"
          >
            <Background color="#374151" gap={20} />
            <Controls className="!bg-slate-800 !border-slate-700 [&>button]:!bg-slate-700 [&>button]:!border-slate-600" />
            <MiniMap
              nodeColor={(n) => {
                switch (n.type) {
                  case 'trigger': return '#10b981';
                  case 'condition': return '#f59e0b';
                  case 'ai': return '#a855f7';
                  case 'action': return '#06b6d4';
                  case 'approval': return '#f97316';
                  case 'notify': return '#3b82f6';
                  default: return '#64748b';
                }
              }}
              className="!bg-slate-800 !border-slate-700"
            />

            {/* Instructions */}
            <Panel position="bottom-center" className="!mb-4">
              <div className="bg-slate-800/80 backdrop-blur rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400">
                <GripVertical className="w-3 h-3 inline mr-1" />
                Drag nodes to position
                <span className="mx-2">•</span>
                Connect handles to create edges
                <span className="mx-2">•</span>
                Click a node to configure
              </div>
            </Panel>
          </ReactFlow>

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/90 text-white rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Right Sidebar - Properties Panel */}
        {selectedNode && (
          <div className="w-80 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white">Node Properties</h3>
              <button
                onClick={() => deleteNode(selectedNode.id)}
                className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                title="Delete node"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Label</label>
                <input
                  type="text"
                  value={(selectedNode.data as NodeDataBase).label || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600
                           text-white text-sm focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {selectedNode.type === 'action' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Action Type</label>
                    <select
                      value={(selectedNode.data as NodeDataBase).actionId || ''}
                      onChange={(e) => {
                        const action = ACTION_REGISTRY.find(a => a.id === e.target.value);
                        updateNodeData(selectedNode.id, {
                          actionId: e.target.value,
                          label: action?.name || e.target.value,
                          requires_approval: action?.riskLevel === 'high',
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600
                               text-white text-sm focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">Select action...</option>
                      {ACTION_REGISTRY.map(action => (
                        <option key={action.id} value={action.id}>
                          {action.icon} {action.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(selectedNode.data as NodeDataBase).requires_approval as boolean || false}
                      onChange={(e) => updateNodeData(selectedNode.id, { requires_approval: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-slate-300">Requires approval</span>
                  </label>
                </>
              )}

              {selectedNode.type === 'trigger' && (
                <div className="p-3 rounded-lg bg-slate-700/50 text-xs text-slate-400">
                  <Info className="w-4 h-4 inline mr-1" />
                  Configure trigger settings when saving the workflow.
                </div>
              )}

              {selectedNode.type === 'ai' && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300">
                  <Brain className="w-4 h-4 inline mr-1" />
                  AI will analyze the data and recommend actions.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

WorkflowCanvas.displayName = 'WorkflowCanvas';

export default WorkflowCanvas;
