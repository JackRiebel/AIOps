/**
 * Enterprise Workflow Canvas - Type Definitions
 *
 * Comprehensive type system for the visual workflow builder
 */

import { Node, Edge } from '@xyflow/react';

// ============================================================================
// Node Types
// ============================================================================

export type CanvasNodeType =
  | 'trigger'
  | 'condition'
  | 'ai'
  | 'action'
  | 'notify'
  | 'approval'
  | 'loop'
  | 'delay'
  | 'subworkflow'
  | 'comment';

export interface PortDefinition {
  id: string;
  type: 'input' | 'output';
  dataType: 'any' | 'boolean' | 'string' | 'number' | 'object' | 'array';
  label?: string;
  required?: boolean;
  maxConnections?: number;
}

export interface NodeCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
}

export const NODE_CATEGORIES: NodeCategory[] = [
  { id: 'flow', label: 'Flow Control', icon: 'GitBranch', color: 'amber' },
  { id: 'actions', label: 'Actions', icon: 'Wrench', color: 'cyan' },
  { id: 'ai', label: 'AI & Analysis', icon: 'Brain', color: 'purple' },
  { id: 'notifications', label: 'Notifications', icon: 'Bell', color: 'blue' },
  { id: 'advanced', label: 'Advanced', icon: 'Settings', color: 'slate' },
];

// ============================================================================
// Node Data Types
// ============================================================================

export interface BaseNodeData {
  label: string;
  description?: string;
  isValid?: boolean;
  validationErrors?: string[];
  isRunning?: boolean;
  hasRun?: boolean;
  runResult?: 'success' | 'error' | 'skipped';
  [key: string]: unknown;
}

export interface TriggerNodeData extends BaseNodeData {
  triggerType: 'splunk_query' | 'schedule' | 'manual' | 'webhook' | 'event';
  config: {
    query?: string;
    cron?: string;
    webhookPath?: string;
    eventType?: string;
  };
}

export interface ConditionNodeData extends BaseNodeData {
  conditionType: 'simple' | 'expression' | 'ai';
  conditions: Array<{
    field: string;
    operator: string;
    value: string | number | boolean;
    logic?: 'and' | 'or';
  }>;
  expression?: string;
}

export interface ActionNodeData extends BaseNodeData {
  actionId: string;
  actionName: string;
  platform?: string;
  params: Record<string, unknown>;
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  timeout?: number;
  retryCount?: number;
}

export interface AINodeData extends BaseNodeData {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  includeContext: boolean;
  outputFormat: 'text' | 'json' | 'decision';
}

export interface NotifyNodeData extends BaseNodeData {
  channel: 'slack' | 'email' | 'teams' | 'webex' | 'pagerduty' | 'webhook';
  recipients?: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export interface DelayNodeData extends BaseNodeData {
  delayType: 'fixed' | 'until' | 'cron';
  duration?: number;
  durationUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  untilTime?: string;
  cronExpression?: string;
}

export interface LoopNodeData extends BaseNodeData {
  loopType: 'forEach' | 'while' | 'count';
  collection?: string;
  condition?: string;
  maxIterations?: number;
}

export interface CommentNodeData extends BaseNodeData {
  text: string;
  backgroundColor?: string;
  width?: number;
  height?: number;
}

// ============================================================================
// Canvas State
// ============================================================================

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNodes: string[];
  selectedEdges: string[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  state: CanvasState;
}

export interface CanvasHistory {
  past: HistoryEntry[];
  present: HistoryEntry;
  future: HistoryEntry[];
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export interface KeyboardShortcut {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  action: string;
  description: string;
  category: 'editing' | 'navigation' | 'view' | 'workflow';
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Editing
  { key: 'z', modifiers: ['ctrl'], action: 'undo', description: 'Undo', category: 'editing' },
  { key: 'z', modifiers: ['ctrl', 'shift'], action: 'redo', description: 'Redo', category: 'editing' },
  { key: 'y', modifiers: ['ctrl'], action: 'redo', description: 'Redo', category: 'editing' },
  { key: 'c', modifiers: ['ctrl'], action: 'copy', description: 'Copy nodes', category: 'editing' },
  { key: 'v', modifiers: ['ctrl'], action: 'paste', description: 'Paste nodes', category: 'editing' },
  { key: 'x', modifiers: ['ctrl'], action: 'cut', description: 'Cut nodes', category: 'editing' },
  { key: 'd', modifiers: ['ctrl'], action: 'duplicate', description: 'Duplicate nodes', category: 'editing' },
  { key: 'Delete', modifiers: [], action: 'delete', description: 'Delete selected', category: 'editing' },
  { key: 'Backspace', modifiers: [], action: 'delete', description: 'Delete selected', category: 'editing' },
  { key: 'a', modifiers: ['ctrl'], action: 'selectAll', description: 'Select all', category: 'editing' },
  { key: 'Escape', modifiers: [], action: 'deselect', description: 'Deselect all', category: 'editing' },

  // Navigation
  { key: 'ArrowUp', modifiers: [], action: 'moveUp', description: 'Move selection up', category: 'navigation' },
  { key: 'ArrowDown', modifiers: [], action: 'moveDown', description: 'Move selection down', category: 'navigation' },
  { key: 'ArrowLeft', modifiers: [], action: 'moveLeft', description: 'Move selection left', category: 'navigation' },
  { key: 'ArrowRight', modifiers: [], action: 'moveRight', description: 'Move selection right', category: 'navigation' },
  { key: 'Tab', modifiers: [], action: 'focusNext', description: 'Focus next node', category: 'navigation' },
  { key: 'Tab', modifiers: ['shift'], action: 'focusPrev', description: 'Focus previous node', category: 'navigation' },

  // View
  { key: '0', modifiers: ['ctrl'], action: 'resetZoom', description: 'Reset zoom', category: 'view' },
  { key: '=', modifiers: ['ctrl'], action: 'zoomIn', description: 'Zoom in', category: 'view' },
  { key: '-', modifiers: ['ctrl'], action: 'zoomOut', description: 'Zoom out', category: 'view' },
  { key: '1', modifiers: ['ctrl'], action: 'fitView', description: 'Fit to view', category: 'view' },
  { key: 'm', modifiers: ['ctrl'], action: 'toggleMinimap', description: 'Toggle minimap', category: 'view' },
  { key: 'g', modifiers: ['ctrl'], action: 'toggleGrid', description: 'Toggle grid', category: 'view' },

  // Workflow
  { key: 's', modifiers: ['ctrl'], action: 'save', description: 'Save workflow', category: 'workflow' },
  { key: 'Enter', modifiers: ['ctrl'], action: 'run', description: 'Run workflow', category: 'workflow' },
  { key: 'f', modifiers: ['ctrl'], action: 'search', description: 'Search nodes', category: 'workflow' },
  { key: 'l', modifiers: ['ctrl', 'shift'], action: 'autoLayout', description: 'Auto layout', category: 'workflow' },
];

// ============================================================================
// Validation
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  nodeId?: string;
  edgeId?: string;
  type: 'missing_connection' | 'invalid_config' | 'cycle_detected' | 'orphan_node' | 'incompatible_types';
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  nodeId?: string;
  type: 'unverified_action' | 'high_risk' | 'deprecated' | 'performance';
  message: string;
  severity: 'warning';
}

// ============================================================================
// Drag and Drop
// ============================================================================

export interface DragItem {
  type: 'node' | 'action';
  nodeType?: CanvasNodeType;
  actionId?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Execution State
// ============================================================================

export interface ExecutionState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentNodeId?: string;
  completedNodes: string[];
  failedNodes: string[];
  skippedNodes: string[];
  startTime?: number;
  endTime?: number;
}

// ============================================================================
// Auto Layout
// ============================================================================

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface LayoutOptions {
  direction: LayoutDirection;
  nodeSpacing: number;
  rankSpacing: number;
  align: 'UL' | 'UR' | 'DL' | 'DR' | 'center';
}
