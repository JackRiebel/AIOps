'use client';

import {
  memo,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  DragEvent,
} from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  Panel,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  Connection,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  X, Zap, GitBranch, Brain, Wrench, Bell, Hand, Clock,
  Repeat, Workflow, MessageSquare, AlertCircle, CheckCircle,
  Loader2, ArrowRight
} from 'lucide-react';

import { CanvasToolbar } from './components/CanvasToolbar';
import { NodePalette } from './components/NodePalette';
import { PropertiesPanel } from './components/PropertiesPanel';
import { CardGuidelines, type WorkflowPattern } from './components/CardGuidelines';
import { TemplateGallery, type UnifiedTemplate } from './components/TemplateGallery';
import { ModeConversionDialog } from './components/ModeConversionDialog';
import { CLIEditor, CLIReference, parseCLI, type CLIValidationError } from './cli';
import { PythonEditor, PythonReference, FULL_PYTHON_TEMPLATE, type PythonValidationError } from './python';
import { useCanvasHistory } from './hooks/useCanvasHistory';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWorkflowMode } from './contexts/WorkflowModeContext';
import { type WorkflowTemplate } from './templates/cardTemplates';
import type {
  CanvasNodeType,
  DragItem,
  ValidationError,
  ValidationWarning,
  ExecutionState,
} from './types';
import {
  ACTION_REGISTRY,
  type ActionDefinition,
  type FlowData,
  type CreateWorkflowRequest,
  type Workflow as WorkflowType,
  type WorkflowAction,
} from '../types';

// ============================================================================
// Custom Node Components
// ============================================================================

interface BaseNodeData {
  label: string;
  description?: string;
  isValid?: boolean;
  isRunning?: boolean;
  hasRun?: boolean;
  runResult?: 'success' | 'error' | 'skipped';
  [key: string]: unknown;
}

const NodeWrapper = memo(({
  children,
  selected,
  color,
  isRunning,
  runResult,
}: {
  children: React.ReactNode;
  selected: boolean;
  color: string;
  isRunning?: boolean;
  runResult?: 'success' | 'error' | 'skipped';
}) => {
  const statusIndicator = isRunning ? (
    <div className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
      <Loader2 className="w-3 h-3 text-white animate-spin" />
    </div>
  ) : runResult === 'success' ? (
    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
      <CheckCircle className="w-3 h-3 text-white" />
    </div>
  ) : runResult === 'error' ? (
    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
      <AlertCircle className="w-3 h-3 text-white" />
    </div>
  ) : null;

  return (
    <div
      className={`relative px-4 py-3 rounded-xl shadow-lg min-w-[200px] transition-all duration-200
                  bg-gradient-to-br ${color}
                  ${selected
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105'
                    : 'border border-white/20'
                  }`}
    >
      {statusIndicator}
      {children}
    </div>
  );
});
NodeWrapper.displayName = 'NodeWrapper';

// Trigger Node
const TriggerNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  return (
    <NodeWrapper selected={selected} color="from-emerald-500 to-emerald-600" isRunning={nodeData.isRunning} runResult={nodeData.runResult}>
      <Handle type="source" position={Position.Right} className="!bg-emerald-300 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-white">Trigger</span>
      </div>
      <div className="text-xs text-white/80">{nodeData.label || 'When this happens...'}</div>
    </NodeWrapper>
  );
});
TriggerNode.displayName = 'TriggerNode';

// Condition Node
const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  return (
    <NodeWrapper selected={selected} color="from-amber-500 to-amber-600" isRunning={nodeData.isRunning} runResult={nodeData.runResult}>
      <Handle type="target" position={Position.Left} className="!bg-amber-300 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} id="true" className="!bg-green-400 !w-3 !h-3 !border-2 !border-white !top-[35%]" />
      <Handle type="source" position={Position.Right} id="false" className="!bg-red-400 !w-3 !h-3 !border-2 !border-white !top-[65%]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <GitBranch className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-white">Condition</span>
      </div>
      <div className="text-xs text-white/80">{nodeData.label || 'If this is true...'}</div>
      <div className="flex justify-end gap-4 mt-2 text-[10px]">
        <span className="px-1.5 py-0.5 rounded bg-green-500/30 text-green-100">Yes</span>
        <span className="px-1.5 py-0.5 rounded bg-red-500/30 text-red-100">No</span>
      </div>
    </NodeWrapper>
  );
});
ConditionNode.displayName = 'ConditionNode';

// AI Node
const AINode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  return (
    <NodeWrapper selected={selected} color="from-purple-500 to-purple-600" isRunning={nodeData.isRunning} runResult={nodeData.runResult}>
      <Handle type="target" position={Position.Left} className="!bg-purple-300 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!bg-purple-300 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-white">AI Decision</span>
      </div>
      <div className="text-xs text-white/80">{nodeData.label || 'Let AI analyze...'}</div>
    </NodeWrapper>
  );
});
AINode.displayName = 'AINode';

// Action Node
const ActionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  const action = nodeData.actionId ? ACTION_REGISTRY.find(a => a.id === nodeData.actionId) : null;
  const requiresApproval = nodeData.requiresApproval as boolean;
  const color = requiresApproval ? 'from-red-500 to-red-600' : 'from-cyan-500 to-cyan-600';

  return (
    <NodeWrapper selected={selected} color={color} isRunning={nodeData.isRunning} runResult={nodeData.runResult}>
      <Handle type="target" position={Position.Left} className="!bg-white/50 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!bg-white/50 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        {action ? (
          <span className="text-xl">{action.icon}</span>
        ) : (
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Wrench className="w-4 h-4 text-white" />
          </div>
        )}
        <span className="font-semibold text-sm text-white">Action</span>
        {requiresApproval && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 flex items-center gap-1">
            <Hand className="w-2.5 h-2.5" /> Approval
          </span>
        )}
      </div>
      <div className="text-xs text-white/80">{nodeData.label || action?.name || 'Execute action'}</div>
      {action && (
        <div className="mt-2 flex items-center gap-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            action.riskLevel === 'high' ? 'bg-red-600/50' :
            action.riskLevel === 'medium' ? 'bg-amber-600/50' : 'bg-green-600/50'
          } text-white`}>
            {action.riskLevel}
          </span>
          {action.platform && (
            <span className="text-[10px] text-white/60">{action.platform}</span>
          )}
        </div>
      )}
    </NodeWrapper>
  );
});
ActionNode.displayName = 'ActionNode';

// Notify Node
const NotifyNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  return (
    <NodeWrapper selected={selected} color="from-blue-500 to-blue-600" isRunning={nodeData.isRunning} runResult={nodeData.runResult}>
      <Handle type="target" position={Position.Left} className="!bg-blue-300 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!bg-blue-300 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Bell className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-white">Notify</span>
      </div>
      <div className="text-xs text-white/80">{nodeData.label || 'Send notification'}</div>
    </NodeWrapper>
  );
});
NotifyNode.displayName = 'NotifyNode';

// Approval Node
const ApprovalNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  return (
    <NodeWrapper selected={selected} color="from-orange-500 to-orange-600" isRunning={nodeData.isRunning} runResult={nodeData.runResult}>
      <Handle type="target" position={Position.Left} className="!bg-orange-300 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} id="approved" className="!bg-green-400 !w-3 !h-3 !border-2 !border-white !top-[35%]" />
      <Handle type="source" position={Position.Right} id="rejected" className="!bg-red-400 !w-3 !h-3 !border-2 !border-white !top-[65%]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Hand className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-white">Approval Gate</span>
      </div>
      <div className="text-xs text-white/80">{nodeData.label || 'Wait for approval'}</div>
    </NodeWrapper>
  );
});
ApprovalNode.displayName = 'ApprovalNode';

// Delay Node
const DelayNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  return (
    <NodeWrapper selected={selected} color="from-slate-500 to-slate-600" isRunning={nodeData.isRunning} runResult={nodeData.runResult}>
      <Handle type="target" position={Position.Left} className="!bg-slate-300 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!bg-slate-300 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Clock className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-white">Delay</span>
      </div>
      <div className="text-xs text-white/80">{nodeData.label || 'Wait before continuing'}</div>
    </NodeWrapper>
  );
});
DelayNode.displayName = 'DelayNode';

// Loop Node
const LoopNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  return (
    <NodeWrapper selected={selected} color="from-orange-400 to-orange-500" isRunning={nodeData.isRunning} runResult={nodeData.runResult}>
      <Handle type="target" position={Position.Left} className="!bg-orange-300 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} id="loop" className="!bg-orange-300 !w-3 !h-3 !border-2 !border-white !top-[35%]" />
      <Handle type="source" position={Position.Right} id="done" className="!bg-green-400 !w-3 !h-3 !border-2 !border-white !top-[65%]" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Repeat className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-white">Loop</span>
      </div>
      <div className="text-xs text-white/80">{nodeData.label || 'For each item...'}</div>
    </NodeWrapper>
  );
});
LoopNode.displayName = 'LoopNode';

// Comment Node
const CommentNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  return (
    <div
      className={`px-4 py-3 rounded-lg bg-slate-800/80 border-2 border-dashed min-w-[200px]
                  ${selected ? 'border-cyan-400' : 'border-slate-600'}`}
    >
      <div className="flex items-center gap-2 mb-1 text-slate-400">
        <MessageSquare className="w-4 h-4" />
        <span className="text-xs font-medium">Note</span>
      </div>
      <div className="text-sm text-slate-300">{nodeData.label || 'Add a comment...'}</div>
    </div>
  );
});
CommentNode.displayName = 'CommentNode';

// Subworkflow Node
const SubworkflowNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as BaseNodeData;
  const workflowName = nodeData.workflowName as string | undefined;
  const waitForCompletion = nodeData.waitForCompletion as boolean | undefined;
  return (
    <NodeWrapper selected={selected} color="from-indigo-500 to-indigo-600" isRunning={nodeData.isRunning} runResult={nodeData.runResult}>
      <Handle type="target" position={Position.Left} className="!bg-indigo-300 !w-3 !h-3 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="!bg-indigo-300 !w-3 !h-3 !border-2 !border-white" />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-white/20 rounded-lg">
          <Workflow className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-white">Sub-workflow</span>
      </div>
      <div className="text-xs text-white/80">{nodeData.label || workflowName || 'Run another workflow'}</div>
      {workflowName && (
        <div className="mt-2 text-[10px] text-white/60">
          {waitForCompletion !== false ? 'Waits for completion' : 'Runs async'}
        </div>
      )}
    </NodeWrapper>
  );
});
SubworkflowNode.displayName = 'SubworkflowNode';

const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  ai: AINode,
  action: ActionNode,
  notify: NotifyNode,
  approval: ApprovalNode,
  delay: DelayNode,
  loop: LoopNode,
  comment: CommentNode,
  subworkflow: SubworkflowNode,
};

// ============================================================================
// Main Canvas Component
// ============================================================================

export interface EnterpriseCanvasProps {
  onClose: () => void;
  onSave: (workflow: WorkflowType) => void;
  initialFlow?: FlowData;
  workflowId?: number;
  workflowName?: string;
}

const EnterpriseCanvasInner = memo(({
  onClose,
  onSave,
  initialFlow,
  workflowId,
  workflowName: initialName,
}: EnterpriseCanvasProps) => {
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Mode context
  const { mode, setMode, setCli, setPython, pendingModeSwitch, cancelPendingSwitch } = useWorkflowMode();

  // State
  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showCLIReference, setShowCLIReference] = useState(true);
  const [showPythonReference, setShowPythonReference] = useState(true);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [cliValidationErrors, setCLIValidationErrors] = useState<CLIValidationError[]>([]);
  const [pythonValidationErrors, setPythonValidationErrors] = useState<PythonValidationError[]>([]);
  const [error, setError] = useState<string | null>(null);

  // CLI Mode state
  const [cliCode, setCLICode] = useState<string>(`# Welcome to CLI Workflow Mode
# Write your workflow commands here

# Example: Check network health
meraki get-health --network \${network.id}

if health_score < 80 then
  notify slack --channel "#alerts" --message "Network health degraded"
end
`);

  // Python Mode state
  const [pythonCode, setPythonCode] = useState<string>(FULL_PYTHON_TEMPLATE);

  // Nodes and Edges
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
        data: { label: 'Start Here' },
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
      markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' },
      style: { stroke: '#06b6d4', strokeWidth: 2 },
      animated: true,
    })) || []
  );

  // History
  const {
    canUndo,
    canRedo,
    takeSnapshot,
    undo: undoHistory,
    redo: redoHistory,
  } = useCanvasHistory(nodes, edges);

  // Selection
  const selectedNodes = useMemo(
    () => nodes.filter(n => n.selected).map(n => n.id),
    [nodes]
  );

  const selectedNode = useMemo(
    () => nodes.find(n => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  // Validation
  const isValid = useMemo(() => {
    const errors: ValidationError[] = [];

    // Check for trigger
    const hasTrigger = nodes.some(n => n.type === 'trigger');
    if (!hasTrigger) {
      errors.push({
        type: 'missing_connection',
        message: 'Workflow must have at least one trigger node',
        severity: 'error',
      });
    }

    // Check for orphan nodes (no connections)
    const connectedNodes = new Set<string>();
    edges.forEach(e => {
      connectedNodes.add(e.source);
      connectedNodes.add(e.target);
    });
    nodes.forEach(n => {
      if (n.type !== 'trigger' && n.type !== 'comment' && !connectedNodes.has(n.id)) {
        errors.push({
          nodeId: n.id,
          type: 'orphan_node',
          message: `Node "${(n.data as BaseNodeData).label}" is not connected`,
          severity: 'error',
        });
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  }, [nodes, edges]);

  // Handlers
  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    onNodesChange(changes);
    // Take snapshot for significant changes
    const significantChange = changes.some(c => c.type !== 'position');
    if (significantChange) {
      takeSnapshot('Node change');
    }
  }, [onNodesChange, takeSnapshot]);

  const handleEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    onEdgesChange(changes);
    takeSnapshot('Edge change');
  }, [onEdgesChange, takeSnapshot]);

  const onConnect = useCallback((connection: Connection) => {
    const newEdge: Edge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' },
      style: { stroke: '#06b6d4', strokeWidth: 2 },
      animated: true,
    };
    setEdges(eds => [...eds, newEdge]);
    takeSnapshot('Connect nodes');
  }, [setEdges, takeSnapshot]);

  const addNode = useCallback((type: CanvasNodeType, data?: Record<string, unknown>) => {
    const id = `${type}-${Date.now()}`;
    const position = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    // For subworkflow nodes, include the current workflow ID so they can filter themselves out
    const nodeData: Record<string, unknown> = {
      label: getDefaultLabel(type),
      ...data,
    };
    if (type === 'subworkflow' && workflowId) {
      nodeData.currentWorkflowId = workflowId;
    }

    const newNode: Node = {
      id,
      type,
      position,
      data: nodeData,
    };

    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(id);
    takeSnapshot(`Add ${type} node`);
  }, [setNodes, reactFlowInstance, takeSnapshot, workflowId]);

  const addAction = useCallback((action: ActionDefinition) => {
    addNode('action', {
      label: action.name,
      actionId: action.id,
      actionName: action.name,
      riskLevel: action.riskLevel,
      requiresApproval: action.riskLevel === 'high',
    });
  }, [addNode]);

  const updateNode = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes(nds =>
      nds.map(n => (n.id === nodeId ? { ...n, data } : n))
    );
  }, [setNodes]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    takeSnapshot('Delete node');
  }, [setNodes, setEdges, selectedNodeId, takeSnapshot]);

  const duplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const newNode: Node = {
      ...node,
      id: `${node.type}-${Date.now()}`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
      selected: false,
    };

    setNodes(nds => [...nds, newNode]);
    takeSnapshot('Duplicate node');
  }, [nodes, setNodes, takeSnapshot]);

  // Load template into canvas
  const loadTemplate = useCallback((template: UnifiedTemplate) => {
    const timestamp = Date.now();

    // Set common fields
    setName(template.name);
    setDescription(template.description);

    // Handle different template modes
    if (template.mode === 'cards') {
      // Cards mode: load nodes and edges from original WorkflowTemplate
      const cardTemplate = template.original as WorkflowTemplate;

      // Create nodes from template with unique IDs
      const newNodes: Node[] = cardTemplate.nodes.map((tn, idx) => ({
        id: `${tn.type}-${timestamp}-${idx}`,
        type: tn.type,
        position: tn.position,
        data: tn.data as Record<string, unknown>,
      }));

      // Create ID mapping for edges
      const idMapping = new Map<string, string>();
      cardTemplate.nodes.forEach((tn, idx) => {
        idMapping.set(tn.id, `${tn.type}-${timestamp}-${idx}`);
      });

      // Create edges with mapped IDs
      const newEdges: Edge[] = cardTemplate.edges.map((te, idx) => ({
        id: `e-${timestamp}-${idx}`,
        source: idMapping.get(te.source) || te.source,
        target: idMapping.get(te.target) || te.target,
        sourceHandle: te.sourceHandle,
        targetHandle: te.targetHandle,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' },
        style: { stroke: '#06b6d4', strokeWidth: 2 },
        animated: true,
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      setMode('cards');
      takeSnapshot(`Load template: ${template.name}`);

      // Fit view after loading
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2 });
      }, 100);
    } else if (template.mode === 'cli') {
      // CLI mode: load CLI code from original CLITemplate
      const cliTemplate = template.original as { code: string };
      setCli(cliTemplate.code);
      setMode('cli');
      takeSnapshot(`Load CLI template: ${template.name}`);
    } else if (template.mode === 'python') {
      // Python mode: load Python code from original PythonTemplate
      const pythonTemplate = template.original as { code: string };
      setPython(pythonTemplate.code);
      setMode('python');
      takeSnapshot(`Load Python template: ${template.name}`);
    }
  }, [setNodes, setEdges, takeSnapshot, reactFlowInstance, setMode, setCli, setPython]);

  // Insert workflow pattern at current position
  const insertPattern = useCallback((pattern: WorkflowPattern) => {
    const timestamp = Date.now();
    const centerPosition = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    // Create nodes from pattern
    const newNodes: Node[] = pattern.nodes.map((pn, idx) => ({
      id: `${pn.type}-${timestamp}-${idx}`,
      type: pn.type,
      position: {
        x: centerPosition.x + pn.offsetX,
        y: centerPosition.y + pn.offsetY,
      },
      data: pn.data as Record<string, unknown>,
    }));

    // Create edges
    const newEdges: Edge[] = pattern.edges.map((pe, idx) => ({
      id: `e-pattern-${timestamp}-${idx}`,
      source: newNodes[pe.sourceIndex].id,
      target: newNodes[pe.targetIndex].id,
      sourceHandle: pe.sourceHandle,
      targetHandle: pe.targetHandle,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' },
      style: { stroke: '#06b6d4', strokeWidth: 2 },
      animated: true,
    }));

    setNodes(nds => [...nds, ...newNodes]);
    setEdges(eds => [...eds, ...newEdges]);
    takeSnapshot(`Insert pattern: ${pattern.name}`);
  }, [setNodes, setEdges, takeSnapshot, reactFlowInstance]);

  const deleteSelected = useCallback(() => {
    setNodes(nds => nds.filter(n => !n.selected));
    setEdges(eds => {
      const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
      return eds.filter(e => !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target));
    });
    setSelectedNodeId(null);
    takeSnapshot('Delete selected');
  }, [nodes, setNodes, setEdges, takeSnapshot]);

  // Drag and Drop
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault();

    const data = event.dataTransfer.getData('application/reactflow');
    if (!data) return;

    const item: DragItem = JSON.parse(data);
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    if (item.type === 'node' && item.nodeType) {
      const nodeData: Record<string, unknown> = {
        label: getDefaultLabel(item.nodeType),
        ...item.data,
      };
      // For subworkflow nodes, include current workflow ID
      if (item.nodeType === 'subworkflow' && workflowId) {
        nodeData.currentWorkflowId = workflowId;
      }
      const newNode: Node = {
        id: `${item.nodeType}-${Date.now()}`,
        type: item.nodeType,
        position,
        data: nodeData,
      };
      setNodes(nds => [...nds, newNode]);
      takeSnapshot(`Drop ${item.nodeType} node`);
    } else if (item.type === 'action' && item.actionId) {
      const action = ACTION_REGISTRY.find(a => a.id === item.actionId);
      if (action) {
        const newNode: Node = {
          id: `action-${Date.now()}`,
          type: 'action',
          position,
          data: {
            label: action.name,
            actionId: action.id,
            actionName: action.name,
            riskLevel: action.riskLevel,
            requiresApproval: action.riskLevel === 'high',
          },
        };
        setNodes(nds => [...nds, newNode]);
        takeSnapshot(`Drop ${action.name} action`);
      }
    }
  }, [reactFlowInstance, setNodes, takeSnapshot, workflowId]);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    const state = undoHistory();
    if (state) {
      setNodes(state.nodes);
      setEdges(state.edges);
    }
  }, [undoHistory, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const state = redoHistory();
    if (state) {
      setNodes(state.nodes);
      setEdges(state.edges);
    }
  }, [redoHistory, setNodes, setEdges]);

  // Save
  const handleSave = useCallback(async () => {
    // Validate workflow name
    if (!name.trim()) {
      setError('Please enter a workflow name');
      return;
    }

    // Validate workflow has a trigger
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      setError('Workflow must have a trigger node. Drag a Trigger from the palette.');
      return;
    }

    // Get trigger configuration
    const triggerData = triggerNode.data as BaseNodeData | undefined;
    const rawTriggerType = (triggerData?.triggerType as string) || 'manual';
    const scheduleCron = (triggerData?.cron as string) || undefined;
    const splunkQuery = (triggerData?.splunkQuery as string) || undefined;

    // Validate trigger type is supported
    const supportedTriggers = ['manual', 'schedule', 'splunk_query'];
    if (!supportedTriggers.includes(rawTriggerType)) {
      setError(`Trigger type "${rawTriggerType}" is not yet supported. Please use Manual, Schedule, or Splunk Alert.`);
      return;
    }
    const triggerType = rawTriggerType as 'manual' | 'schedule' | 'splunk_query';

    // Validate trigger-specific requirements
    if (triggerType === 'schedule' && !scheduleCron) {
      setError('Schedule trigger requires a cron expression. Click the trigger node and enter a cron expression (e.g., "*/5 * * * *" for every 5 minutes).');
      return;
    }

    if (triggerType === 'splunk_query' && !splunkQuery) {
      setError('Splunk Alert trigger requires a Splunk query. Click the trigger node and enter your search query.');
      return;
    }

    // Validate workflow has at least one action
    const actionNodes = nodes.filter(n => n.type === 'action');
    if (actionNodes.length === 0) {
      setError('Workflow must have at least one action node. Drag an action from the palette (e.g., from Meraki, Splunk, or Notifications).');
      return;
    }

    // Validate actions are configured
    for (const actionNode of actionNodes) {
      const actionData = actionNode.data as BaseNodeData;
      if (!actionData.actionId) {
        setError(`Action node "${actionData.label || 'Unnamed'}" is not configured. Click it and select an action type.`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const flowData: FlowData = {
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type as 'trigger' | 'condition' | 'ai' | 'action' | 'notify',
          position: n.position,
          data: n.data as Record<string, unknown>,
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
        })),
      };

      const actions: WorkflowAction[] = actionNodes.map(n => ({
        tool: String((n.data as BaseNodeData).actionId || 'custom.webhook'),
        params: ((n.data as BaseNodeData).params as Record<string, unknown>) || {},
        requires_approval: Boolean((n.data as BaseNodeData).requiresApproval),
      }));

      const payload: CreateWorkflowRequest = {
        name,
        description,
        trigger_type: triggerType,
        schedule_cron: triggerType === 'schedule' ? scheduleCron : undefined,
        splunk_query: triggerType === 'splunk_query' ? splunkQuery : undefined,
        actions,
        ai_enabled: nodes.some(n => n.type === 'ai'),
        flow_data: flowData,
      };

      const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows';
      const method = workflowId ? 'PUT' : 'POST';

      // Debug: log the payload being sent
      console.log('[Workflow Save] Sending payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Failed to save workflow (HTTP ${response.status})`;
        console.error('[Workflow Save] Response not OK:', response.status, response.statusText);
        try {
          const text = await response.text();
          console.error('[Workflow Save] Response body:', text);

          if (text) {
            const data = JSON.parse(text);
            // Handle validation errors from backend
            if (data.errors && Array.isArray(data.errors)) {
              errorMessage = data.errors.join('. ');
            } else if (data.detail) {
              // FastAPI validation errors have detail as array
              if (Array.isArray(data.detail)) {
                errorMessage = data.detail.map((err: { loc?: string[]; msg?: string }) => {
                  const field = err.loc?.slice(-1)[0] || 'field';
                  return `${field}: ${err.msg || 'invalid'}`;
                }).join('. ');
              } else {
                errorMessage = String(data.detail);
              }
            } else if (Object.keys(data).length === 0) {
              errorMessage = `Server returned empty response (HTTP ${response.status})`;
            }
          } else {
            errorMessage = `Server returned no content (HTTP ${response.status})`;
          }
        } catch (parseErr) {
          console.error('[Workflow Save] Could not parse error response:', parseErr);
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const workflow = await response.json();
      onSave(workflow);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  }, [name, description, nodes, edges, workflowId, onSave, onClose]);

  // Test Run
  const handleRun = useCallback(async () => {
    if (!isValid) return;
    setIsRunning(true);

    // Simulate execution visualization
    const orderedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x);

    for (const node of orderedNodes) {
      setNodes(nds =>
        nds.map(n => ({
          ...n,
          data: {
            ...n.data,
            isRunning: n.id === node.id,
            hasRun: orderedNodes.indexOf(n) < orderedNodes.indexOf(node),
            runResult: orderedNodes.indexOf(n) < orderedNodes.indexOf(node) ? 'success' : undefined,
          },
        }))
      );
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Mark all as complete
    setNodes(nds =>
      nds.map(n => ({
        ...n,
        data: { ...n.data, isRunning: false, hasRun: true, runResult: 'success' as const },
      }))
    );

    setIsRunning(false);
  }, [nodes, isValid, setNodes]);

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onSave: handleSave,
    onDelete: deleteSelected,
    onZoomIn: () => reactFlowInstance.zoomIn(),
    onZoomOut: () => reactFlowInstance.zoomOut(),
    onFitView: () => reactFlowInstance.fitView(),
    onToggleGrid: () => setShowGrid(v => !v),
    onSearch: () => setShowSearch(true),
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-slate-800 border-b border-slate-700">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled Workflow"
            className="bg-transparent text-lg font-semibold text-white placeholder-slate-500
                     border-none outline-none focus:ring-0 w-full max-w-md"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            className="bg-transparent text-sm text-slate-400 placeholder-slate-600
                     border-none outline-none focus:ring-0 w-full max-w-md mt-0.5"
          />
        </div>
      </div>

      {/* Toolbar */}
      <CanvasToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={reactFlowInstance.getZoom()}
        onZoomIn={() => reactFlowInstance.zoomIn()}
        onZoomOut={() => reactFlowInstance.zoomOut()}
        onFitView={() => reactFlowInstance.fitView()}
        onResetZoom={() => reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 })}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(v => !v)}
        onSave={handleSave}
        onRun={handleRun}
        onExport={() => {}}
        onImport={() => {}}
        onAutoLayout={() => {}}
        hasSelection={selectedNodes.length > 0}
        selectionCount={selectedNodes.length}
        onCopy={() => {}}
        onDelete={deleteSelected}
        onDuplicate={() => selectedNodes.forEach(duplicateNode)}
        onGroup={() => {}}
        isSaving={isSaving}
        isRunning={isRunning}
        isValid={isValid}
        validationErrors={validationErrors.map(e => e.message)}
        onSearchOpen={() => setShowSearch(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node Palette - Cards mode only */}
        {mode === 'cards' && (
          <NodePalette
            onNodeAdd={addNode}
            onActionAdd={addAction}
            onOpenTemplates={() => setShowTemplateGallery(true)}
          />
        )}

        {/* CLI Mode - Full editor takes over canvas area */}
        {mode === 'cli' && (
          <CLIReference
            onInsertCommand={(cmd) => setCLICode(prev => prev + '\n' + cmd)}
            isCollapsed={!showCLIReference}
            onToggleCollapse={() => setShowCLIReference(!showCLIReference)}
          />
        )}

        {/* Python Mode - SDK Reference Panel */}
        {mode === 'python' && showPythonReference && (
          <div className="w-80 border-r border-slate-700 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
              <span className="text-sm font-medium text-slate-200">SDK Reference</span>
              <button
                onClick={() => setShowPythonReference(false)}
                className="p-1 hover:bg-slate-700 rounded text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PythonReference
                onInsert={(code) => setPythonCode(prev => prev + '\n    ' + code)}
                compact
              />
            </div>
          </div>
        )}

        {/* Canvas - Shows ReactFlow for cards mode, CLI Editor for CLI mode */}
        <div
          ref={reactFlowWrapper}
          className="flex-1 relative"
          onDragOver={mode === 'cards' ? onDragOver : undefined}
          onDrop={mode === 'cards' ? onDrop : undefined}
        >
          {mode === 'cards' ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              nodeTypes={nodeTypes}
              fitView
              snapToGrid={showGrid}
              snapGrid={[20, 20]}
              colorMode="dark"
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{
                markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' },
                style: { stroke: '#06b6d4', strokeWidth: 2 },
                animated: true,
              }}
            >
              {/* Background - matches slate color scheme */}
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color={showGrid ? '#475569' : 'transparent'}
                style={{ backgroundColor: '#1e293b' }}
              />
              <Controls
                className="!bg-slate-800 !border-slate-700 !rounded-lg !shadow-xl [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600"
              />

              {/* Error Toast */}
              {error && (
                <Panel position="top-center">
                  <div className="px-4 py-3 bg-red-500/95 text-white rounded-lg text-sm shadow-xl max-w-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 font-medium">{error}</div>
                      <button onClick={() => setError(null)} className="hover:bg-white/20 rounded p-1 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Panel>
              )}

              {/* Cards mode Instructions */}
              <Panel position="bottom-center" className="!mb-4">
                <div className="bg-slate-800/90 backdrop-blur rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-400 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />
                    Drag nodes from palette or use templates
                  </span>
                  <span className="text-slate-600">|</span>
                  <button
                    onClick={() => setShowTemplateGallery(true)}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Browse Templates
                  </button>
                  <span className="text-slate-600">|</span>
                  <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-700 text-slate-300">?</kbd> for shortcuts</span>
                </div>
              </Panel>
            </ReactFlow>
          ) : mode === 'cli' ? (
            <div className="h-full flex flex-col">
              <CLIEditor
                value={cliCode}
                onChange={setCLICode}
                onValidate={setCLIValidationErrors}
                onRun={handleRun}
                height="100%"
              />
            </div>
          ) : (
            /* Python mode - Full Python editor */
            <div className="h-full flex flex-col">
              <PythonEditor
                value={pythonCode}
                onChange={setPythonCode}
                onValidate={setPythonValidationErrors}
                onRun={handleRun}
                height="100%"
              />
            </div>
          )}
        </div>

        {/* Properties Panel - visible when node selected */}
        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            onUpdate={updateNode}
            onDelete={deleteNode}
            onDuplicate={duplicateNode}
            onClose={() => setSelectedNodeId(null)}
            validationErrors={validationErrors}
          />
        )}

        {/* Card Guidelines Panel - Cards mode */}
        {mode === 'cards' && showGuidelines && !selectedNode && (
          <CardGuidelines
            selectedNodeType={null}
            onInsertPattern={insertPattern}
            isCollapsed={false}
            onToggleCollapse={() => setShowGuidelines(false)}
          />
        )}
      </div>

      {/* Template Gallery Modal */}
      <TemplateGallery
        isOpen={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
        onSelectTemplate={loadTemplate}
      />

      {/* Mode Conversion Dialog */}
      <ModeConversionDialog
        isOpen={pendingModeSwitch !== null}
        onClose={() => cancelPendingSwitch()}
      />
    </div>
  );
});

EnterpriseCanvasInner.displayName = 'EnterpriseCanvasInner';

// Helper function
function getDefaultLabel(type: CanvasNodeType): string {
  const labels: Record<CanvasNodeType, string> = {
    trigger: 'Start',
    condition: 'Check condition',
    ai: 'AI Analysis',
    action: 'Execute action',
    notify: 'Send notification',
    approval: 'Wait for approval',
    delay: 'Wait',
    loop: 'For each item',
    subworkflow: 'Run sub-workflow',
    comment: 'Note',
  };
  return labels[type] || 'Node';
}

// Wrapped with ReactFlowProvider
export const EnterpriseCanvas = memo((props: EnterpriseCanvasProps) => (
  <ReactFlowProvider>
    <EnterpriseCanvasInner {...props} />
  </ReactFlowProvider>
));

EnterpriseCanvas.displayName = 'EnterpriseCanvas';

export default EnterpriseCanvas;
