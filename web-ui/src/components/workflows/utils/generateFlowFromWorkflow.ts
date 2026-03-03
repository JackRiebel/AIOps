/**
 * Generate Flow From Workflow
 * Converts a Workflow data model into React Flow nodes and edges for visualization.
 */

import type { Workflow, WorkflowCondition, WorkflowAction } from '../types';
import { getActionDescription, isNotificationAction } from './actionDescriptions';

// ============================================================================
// Types
// ============================================================================

export interface PreviewNode {
  id: string;
  type: 'trigger' | 'condition' | 'ai' | 'action' | 'notify' | 'approval';
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface PreviewEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: { label?: string; status?: string };
}

export interface PreviewFlow {
  nodes: PreviewNode[];
  edges: PreviewEdge[];
}

// ============================================================================
// Layout Constants
// ============================================================================

const LAYOUT = {
  nodeWidth: 180,
  nodeGap: 80,
  startX: 50,
  centerY: 150,
  conditionBranchOffset: 100, // Y offset for condition branches
};

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate a preview flow from a workflow definition
 */
export function generateFlowFromWorkflow(workflow: Workflow): PreviewFlow {
  // If workflow has flow_data with nodes, use those directly
  if (workflow.flow_data?.nodes && workflow.flow_data.nodes.length > 0) {
    return generateFromFlowData(workflow);
  }

  // Otherwise, fall back to generating from basic workflow properties
  return generateFromWorkflowProperties(workflow);
}

/**
 * Generate preview flow from flow_data (canvas-created workflows)
 */
function generateFromFlowData(workflow: Workflow): PreviewFlow {
  const flowData = workflow.flow_data!;
  const nodes: PreviewNode[] = [];
  const edges: PreviewEdge[] = [];

  // Sort nodes by x position for display order
  const sortedNodes = [...flowData.nodes].sort(
    (a, b) => (a.position?.x || 0) - (b.position?.x || 0)
  );

  // Convert flow_data nodes to preview nodes
  sortedNodes.forEach((node, index) => {
    const nodeType = node.type as PreviewNode['type'];
    const nodeData = node.data || {};

    // Map node type to preview type
    let previewType: PreviewNode['type'] = 'action';
    if (nodeType === 'trigger') previewType = 'trigger';
    else if (nodeType === 'condition') previewType = 'condition';
    else if (nodeType === 'ai') previewType = 'ai';
    else if (nodeType === 'notify') previewType = 'notify';
    else if (nodeType === 'approval') previewType = 'approval';
    else if (nodeType === 'action') previewType = 'action';

    // Build preview node data based on type
    let data: Record<string, unknown> = { ...nodeData };

    if (previewType === 'trigger') {
      data = {
        triggerType: nodeData.triggerType || workflow.trigger_type,
        splunkQuery: nodeData.splunkQuery || workflow.splunk_query,
        scheduleCron: nodeData.schedule || workflow.schedule_cron,
        pollInterval: workflow.poll_interval_seconds,
        label: nodeData.label,
      };
    } else if (previewType === 'condition') {
      data = {
        conditions: nodeData.conditions || [],
        conditionCount: (nodeData.conditions as unknown[])?.length || 1,
        expression: nodeData.expression,
        label: nodeData.label,
      };
    } else if (previewType === 'ai') {
      data = {
        enabled: true,
        confidenceThreshold: workflow.ai_confidence_threshold,
        prompt: nodeData.prompt || workflow.ai_prompt,
        label: nodeData.label,
      };
    } else if (previewType === 'action') {
      const actionId = nodeData.actionId || nodeData.tool || 'custom';
      const actionDesc = getActionDescription(String(actionId));
      data = {
        tool: actionId,
        label: nodeData.label || actionDesc.label,
        description: actionDesc.description,
        icon: actionDesc.icon,
        category: actionDesc.category,
        riskLevel: actionDesc.riskLevel,
        requiresApproval: nodeData.requiresApproval,
        params: nodeData.params || nodeData.parameters,
      };
    } else if (previewType === 'approval') {
      data = {
        label: nodeData.label || 'Approval Required',
        description: nodeData.description || 'Manual approval step',
        requiresApproval: true,
        riskLevel: 'high',
      };
    } else if (previewType === 'notify') {
      const tool = nodeData.notifyType || nodeData.tool || 'notification';
      data = {
        tool: tool,
        label: nodeData.label || 'Notification',
        channel: nodeData.channel || getNotificationChannel(String(tool)),
        target: nodeData.target || nodeData.channel || '',
      };
    }

    nodes.push({
      id: node.id || `node-${index}`,
      type: previewType,
      position: { x: LAYOUT.startX + index * (LAYOUT.nodeWidth + LAYOUT.nodeGap), y: LAYOUT.centerY },
      data,
    });
  });

  // Convert edges
  if (flowData.edges) {
    flowData.edges.forEach((edge, index) => {
      edges.push({
        id: edge.id || `edge-${index}`,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      });
    });
  }

  return { nodes, edges };
}

/**
 * Generate preview flow from basic workflow properties (legacy workflows)
 */
function generateFromWorkflowProperties(workflow: Workflow): PreviewFlow {
  const nodes: PreviewNode[] = [];
  const edges: PreviewEdge[] = [];

  let currentX = LAYOUT.startX;
  let lastNodeId: string | null = null;

  // 1. Create Trigger Node
  const triggerId = 'trigger';
  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: currentX, y: LAYOUT.centerY },
    data: {
      triggerType: workflow.trigger_type,
      splunkQuery: workflow.splunk_query,
      scheduleCron: workflow.schedule_cron,
      pollInterval: workflow.poll_interval_seconds,
    },
  });
  lastNodeId = triggerId;
  currentX += LAYOUT.nodeWidth + LAYOUT.nodeGap;

  // 2. Create Condition Nodes
  const conditions = workflow.conditions || [];
  if (conditions.length > 0) {
    // Group all conditions into a single visual node for simplicity
    const conditionId = 'conditions';
    nodes.push({
      id: conditionId,
      type: 'condition',
      position: { x: currentX, y: LAYOUT.centerY },
      data: {
        conditions: conditions,
        conditionCount: conditions.length,
      },
    });

    edges.push({
      id: `${lastNodeId}-${conditionId}`,
      source: lastNodeId!,
      target: conditionId,
    });

    lastNodeId = conditionId;
    currentX += LAYOUT.nodeWidth + LAYOUT.nodeGap;
  }

  // 3. Create AI Analysis Node (if enabled)
  if (workflow.ai_enabled) {
    const aiId = 'ai-analysis';
    nodes.push({
      id: aiId,
      type: 'ai',
      position: { x: currentX, y: LAYOUT.centerY },
      data: {
        enabled: true,
        confidenceThreshold: workflow.ai_confidence_threshold,
        prompt: workflow.ai_prompt,
        autoExecuteEnabled: workflow.auto_execute_enabled,
        autoExecuteMinConfidence: workflow.auto_execute_min_confidence,
        autoExecuteMaxRisk: workflow.auto_execute_max_risk,
      },
    });

    edges.push({
      id: `${lastNodeId}-${aiId}`,
      source: lastNodeId!,
      target: aiId,
    });

    lastNodeId = aiId;
    currentX += LAYOUT.nodeWidth + LAYOUT.nodeGap;
  }

  // 4. Create Action Nodes
  const actions = workflow.actions || [];
  const regularActions = actions.filter(a => !isNotificationAction(a.tool));
  const notifyActions = actions.filter(a => isNotificationAction(a.tool));

  // Regular actions
  regularActions.forEach((action, index) => {
    const actionId = `action-${index}`;
    const actionDesc = getActionDescription(action.tool);

    nodes.push({
      id: actionId,
      type: 'action',
      position: { x: currentX, y: LAYOUT.centerY },
      data: {
        tool: action.tool,
        label: actionDesc.label,
        description: actionDesc.description,
        icon: actionDesc.icon,
        category: actionDesc.category,
        riskLevel: actionDesc.riskLevel,
        requiresApproval: action.requires_approval,
        params: action.params,
        reason: action.reason,
      },
    });

    edges.push({
      id: `${lastNodeId}-${actionId}`,
      source: lastNodeId!,
      target: actionId,
    });

    lastNodeId = actionId;
    currentX += LAYOUT.nodeWidth + LAYOUT.nodeGap;
  });

  // Notification actions (as separate notify nodes)
  notifyActions.forEach((action, index) => {
    const notifyId = `notify-${index}`;
    const actionDesc = getActionDescription(action.tool);

    nodes.push({
      id: notifyId,
      type: 'notify',
      position: { x: currentX, y: LAYOUT.centerY },
      data: {
        tool: action.tool,
        label: actionDesc.label,
        description: actionDesc.description,
        icon: actionDesc.icon,
        channel: getNotificationChannel(action.tool),
        target: getNotificationTarget(action),
      },
    });

    edges.push({
      id: `${lastNodeId}-${notifyId}`,
      source: lastNodeId!,
      target: notifyId,
    });

    lastNodeId = notifyId;
    currentX += LAYOUT.nodeWidth + LAYOUT.nodeGap;
  });

  // If no actions, add a placeholder end node indicator
  if (actions.length === 0) {
    // The last node will just be trigger, conditions, or AI
  }

  return { nodes, edges };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract notification channel from tool name
 */
function getNotificationChannel(tool: string): string {
  if (tool.includes('slack')) return 'Slack';
  if (tool.includes('email')) return 'Email';
  if (tool.includes('teams')) return 'Teams';
  if (tool.includes('pagerduty')) return 'PagerDuty';
  if (tool.includes('webhook')) return 'Webhook';
  return 'Alert';
}

/**
 * Extract notification target from action params
 */
function getNotificationTarget(action: WorkflowAction): string {
  const params = action.params || {};

  // Common param names for targets
  if (params.channel) return String(params.channel);
  if (params.email) return String(params.email);
  if (params.to) return String(params.to);
  if (params.webhook_url) return 'Custom URL';
  if (params.url) return 'Custom URL';

  return '';
}

/**
 * Format condition for display
 */
export function formatCondition(condition: WorkflowCondition): string {
  const { field, operator, value } = condition;

  // Map operators to readable format
  const operatorMap: Record<string, string> = {
    'equals': '=',
    'not_equals': '≠',
    '>': '>',
    '>=': '≥',
    '<': '<',
    '<=': '≤',
    'contains': 'contains',
    'not_contains': 'not contains',
    'starts_with': 'starts with',
    'ends_with': 'ends with',
    'matches': 'matches',
  };

  const opDisplay = operatorMap[operator] || operator;
  return `${field} ${opDisplay} ${value}`;
}

/**
 * Format poll interval for display
 */
export function formatPollInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
