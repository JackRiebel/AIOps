/**
 * Workflow Mode Converter
 *
 * Handles conversion between Card, CLI, and Python workflow modes.
 * Each mode has its own representation:
 * - Cards: Visual nodes and edges (ReactFlow)
 * - CLI: Text-based command script
 * - Python: Python code with SDK calls
 */

import { Node, Edge } from '@xyflow/react';
import { CanvasNodeType, ActionNodeData, TriggerNodeData, ConditionNodeData, NotifyNodeData, DelayNodeData, LoopNodeData, AINodeData } from '../types';
import { PYTHON_IMPORTS } from '../python/pythonSDK';

// ============================================================================
// Types
// ============================================================================

export type ConversionDirection =
  | 'cards-to-cli'
  | 'cards-to-python'
  | 'cli-to-cards'
  | 'cli-to-python'
  | 'python-to-cli'
  | 'python-to-cards';

export interface ConversionResult {
  success: boolean;
  lossyConversion: boolean;
  warnings: string[];
  errors: string[];
}

export interface CardsToCliResult extends ConversionResult {
  cli: string;
}

export interface CardsToPythonResult extends ConversionResult {
  python: string;
}

export interface CliToCardsResult extends ConversionResult {
  nodes: Node[];
  edges: Edge[];
}

export interface CliToPythonResult extends ConversionResult {
  python: string;
}

export interface WorkflowContent {
  mode: 'cards' | 'cli' | 'python';
  cards?: {
    nodes: Node[];
    edges: Edge[];
  };
  cli?: string;
  python?: string;
}

// ============================================================================
// Conversion Support Matrix
// ============================================================================

export const CONVERSION_SUPPORT: Record<ConversionDirection, {
  supported: boolean;
  lossy: boolean;
  description: string;
}> = {
  'cards-to-cli': {
    supported: true,
    lossy: false,
    description: 'Convert visual workflow to CLI commands',
  },
  'cards-to-python': {
    supported: true,
    lossy: false,
    description: 'Convert visual workflow to Python code',
  },
  'cli-to-cards': {
    supported: true,
    lossy: true,
    description: 'Convert CLI commands to visual nodes (some constructs may not translate)',
  },
  'cli-to-python': {
    supported: true,
    lossy: false,
    description: 'Wrap CLI commands in Python execution',
  },
  'python-to-cli': {
    supported: false,
    lossy: true,
    description: 'Python code cannot be reliably converted to CLI',
  },
  'python-to-cards': {
    supported: false,
    lossy: true,
    description: 'Python code cannot be reliably converted to visual nodes',
  },
};

// ============================================================================
// Cards to CLI Conversion
// ============================================================================

export function convertCardsToToCli(nodes: Node[], edges: Edge[]): CardsToCliResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const cliLines: string[] = [];

  cliLines.push('# Workflow converted from Cards mode');
  cliLines.push('# Generated automatically - review before running');
  cliLines.push('');

  // Sort nodes by position (left to right, top to bottom) to maintain logical order
  const sortedNodes = [...nodes].sort((a, b) => {
    if (Math.abs(a.position.x - b.position.x) > 50) {
      return a.position.x - b.position.x;
    }
    return a.position.y - b.position.y;
  });

  // Build adjacency map for flow
  const adjacencyMap = new Map<string, string[]>();
  edges.forEach(edge => {
    if (!adjacencyMap.has(edge.source)) {
      adjacencyMap.set(edge.source, []);
    }
    adjacencyMap.get(edge.source)!.push(edge.target);
  });

  // Convert each node
  for (const node of sortedNodes) {
    const cli = convertNodeToCli(node, warnings);
    if (cli) {
      cliLines.push(cli);
      cliLines.push('');
    }
  }

  return {
    success: errors.length === 0,
    lossyConversion: false,
    warnings,
    errors,
    cli: cliLines.join('\n'),
  };
}

function convertNodeToCli(node: Node, warnings: string[]): string | null {
  const data = node.data as Record<string, unknown>;
  const type = node.type as CanvasNodeType;

  switch (type) {
    case 'trigger': {
      const triggerData = data as TriggerNodeData;
      const triggerType = triggerData.triggerType || 'manual';
      const config = triggerData.config || {};

      if (triggerType === 'schedule' && config.cron) {
        return `# Trigger: Scheduled (${config.cron})`;
      } else if (triggerType === 'splunk_query' && config.query) {
        return `# Trigger: Splunk Query\nsplunk search "${config.query}"`;
      } else if (triggerType === 'webhook') {
        return `# Trigger: Webhook (${config.webhookPath || '/webhook'})`;
      }
      return `# Trigger: ${triggerType}`;
    }

    case 'action': {
      const actionData = data as ActionNodeData;
      const actionId = actionData.actionId || 'custom';
      const params = actionData.params || {};

      // Parse action ID to determine platform and command
      const [platform, ...commandParts] = actionId.split('.');
      const command = commandParts.join('-');

      // Build params string
      const paramStrs = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `--${k} ${JSON.stringify(v)}`);

      return `${platform} ${command} ${paramStrs.join(' ')}`.trim();
    }

    case 'condition': {
      const conditionData = data as ConditionNodeData;
      const conditions = conditionData.conditions || [];

      if (conditions.length === 0) {
        warnings.push(`Condition node "${data.label}" has no conditions defined`);
        return `# Condition: ${data.label || 'Check'}\nif true then\n  # True branch\nelse\n  # False branch\nend`;
      }

      const conditionStr = conditions
        .map(c => `\${${c.field}} ${c.operator} ${JSON.stringify(c.value)}`)
        .join(' && ');

      return `if ${conditionStr} then\n  # True branch\nelse\n  # False branch\nend`;
    }

    case 'ai': {
      const aiData = data as AINodeData;
      const prompt = aiData.prompt || 'Analyze the data';
      return `ai analyze --prompt "${prompt.replace(/"/g, '\\"')}"`;
    }

    case 'notify': {
      const notifyData = data as NotifyNodeData;
      const channel = notifyData.channel || 'slack';
      const message = notifyData.message || 'Notification';
      const recipients = notifyData.recipients || '#general';

      return `notify ${channel} --channel "${recipients}" --message "${message.replace(/"/g, '\\"')}"`;
    }

    case 'delay': {
      const delayData = data as DelayNodeData;
      const duration = delayData.duration || 30;
      const unit = delayData.durationUnit || 'seconds';

      const unitMap: Record<string, string> = {
        seconds: 's',
        minutes: 'm',
        hours: 'h',
        days: 'd',
      };

      return `wait ${duration}${unitMap[unit] || 's'}`;
    }

    case 'loop': {
      const loopData = data as LoopNodeData;
      const collection = loopData.collection || 'items';

      return `loop ${collection} as item\n  # Loop body\nend`;
    }

    case 'approval': {
      return `# Approval gate: ${data.label || 'Awaiting approval'}\napproval wait --timeout 24h`;
    }

    case 'subworkflow': {
      const workflowName = data.workflowName as string || 'sub-workflow';
      return `workflow run "${workflowName}"`;
    }

    case 'comment': {
      return `# ${data.label || 'Note'}`;
    }

    default:
      warnings.push(`Unknown node type: ${type}`);
      return null;
  }
}

// ============================================================================
// Cards to Python Conversion
// ============================================================================

export function convertCardsToPython(nodes: Node[], edges: Edge[]): CardsToPythonResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const pythonLines: string[] = [];

  pythonLines.push(PYTHON_IMPORTS);
  pythonLines.push('');
  pythonLines.push('async def workflow(context):');
  pythonLines.push('    """');
  pythonLines.push('    Workflow converted from Cards mode.');
  pythonLines.push('    Generated automatically - review before running.');
  pythonLines.push('    """');
  pythonLines.push('');

  // Sort nodes by position
  const sortedNodes = [...nodes].sort((a, b) => {
    if (Math.abs(a.position.x - b.position.x) > 50) {
      return a.position.x - b.position.x;
    }
    return a.position.y - b.position.y;
  });

  // Track variables for data flow
  let varCounter = 0;
  const nodeVars = new Map<string, string>();

  for (const node of sortedNodes) {
    const varName = `result_${varCounter++}`;
    nodeVars.set(node.id, varName);

    const python = convertNodeToPython(node, varName, warnings);
    if (python) {
      pythonLines.push(...python.split('\n').map(line => `    ${line}`));
      pythonLines.push('');
    }
  }

  pythonLines.push('    return {"status": "success"}');

  return {
    success: errors.length === 0,
    lossyConversion: false,
    warnings,
    errors,
    python: pythonLines.join('\n'),
  };
}

function convertNodeToPython(node: Node, varName: string, warnings: string[]): string | null {
  const data = node.data as Record<string, unknown>;
  const type = node.type as CanvasNodeType;

  switch (type) {
    case 'trigger': {
      const triggerData = data as TriggerNodeData;
      return `# Trigger: ${triggerData.triggerType || 'manual'}\ntrigger_data = context.trigger_data`;
    }

    case 'action': {
      const actionData = data as ActionNodeData;
      const actionId = actionData.actionId || 'custom';
      const params = actionData.params || {};

      const [platform, ...commandParts] = actionId.split('.');
      const method = commandParts.join('_');

      // Build params
      const paramStrs = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`);

      if (platform === 'meraki') {
        return `${varName} = await meraki.${method}(${paramStrs.join(', ')})`;
      } else if (platform === 'splunk') {
        return `${varName} = await splunk.${method}(${paramStrs.join(', ')})`;
      } else if (platform === 'thousandeyes') {
        return `${varName} = await thousandeyes.${method}(${paramStrs.join(', ')})`;
      }

      return `# Action: ${actionId}\n${varName} = None  # Custom action`;
    }

    case 'condition': {
      const conditionData = data as ConditionNodeData;
      const conditions = conditionData.conditions || [];

      if (conditions.length === 0) {
        warnings.push(`Condition node "${data.label}" has no conditions defined`);
        return `# Condition: ${data.label}\nif True:\n    pass  # True branch\nelse:\n    pass  # False branch`;
      }

      const conditionStr = conditions
        .map(c => {
          const op = c.operator === '==' ? '==' : c.operator === '!=' ? '!=' : c.operator;
          return `context.get("${c.field}") ${op} ${JSON.stringify(c.value)}`;
        })
        .join(' and ');

      return `if ${conditionStr}:\n    pass  # True branch\nelse:\n    pass  # False branch`;
    }

    case 'ai': {
      const aiData = data as AINodeData;
      const prompt = aiData.prompt || 'Analyze the data';
      return `${varName} = await ai.analyze("${prompt.replace(/"/g, '\\"')}")`;
    }

    case 'notify': {
      const notifyData = data as NotifyNodeData;
      const channel = notifyData.channel || 'slack';
      const message = notifyData.message || 'Notification';
      const recipients = notifyData.recipients || '#general';

      return `await notify.${channel}("${recipients}", "${message.replace(/"/g, '\\"')}")`;
    }

    case 'delay': {
      const delayData = data as DelayNodeData;
      const duration = delayData.duration || 30;
      const unit = delayData.durationUnit || 'seconds';

      const multipliers: Record<string, number> = {
        seconds: 1,
        minutes: 60,
        hours: 3600,
        days: 86400,
      };

      const seconds = duration * (multipliers[unit] || 1);
      return `import asyncio\nawait asyncio.sleep(${seconds})  # Wait ${duration} ${unit}`;
    }

    case 'loop': {
      const loopData = data as LoopNodeData;
      const collection = loopData.collection || 'items';
      return `for item in context.get("${collection}", []):\n    pass  # Loop body`;
    }

    case 'approval': {
      return `# Approval gate: ${data.label}\n# Approval handling would be implemented by the runtime`;
    }

    case 'subworkflow': {
      const workflowName = data.workflowName as string || 'sub-workflow';
      return `# Run sub-workflow: ${workflowName}\n# Sub-workflow invocation would be handled by the runtime`;
    }

    case 'comment': {
      return `# ${data.label || 'Note'}`;
    }

    default:
      warnings.push(`Unknown node type: ${type}`);
      return null;
  }
}

// ============================================================================
// CLI to Cards Conversion
// ============================================================================

export function convertCliToCards(cli: string): CliToCardsResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const lines = cli.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

  let nodeIndex = 0;
  let lastNodeId: string | null = null;
  const baseX = 100;
  const baseY = 100;
  const nodeSpacing = 250;

  // Always start with a trigger
  const triggerId = `trigger-${Date.now()}`;
  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: baseX, y: baseY },
    data: { label: 'Start', triggerType: 'manual' },
  });
  lastNodeId = triggerId;
  nodeIndex++;

  for (const line of lines) {
    const trimmed = line.trim();
    const nodeId = `node-${Date.now()}-${nodeIndex}`;
    let node: Node | null = null;

    // Parse CLI command
    if (trimmed.startsWith('meraki ') || trimmed.startsWith('splunk ') ||
        trimmed.startsWith('thousandeyes ') || trimmed.startsWith('catalyst ')) {
      const parts = trimmed.split(' ');
      const platform = parts[0];
      const command = parts[1] || '';

      node = {
        id: nodeId,
        type: 'action',
        position: { x: baseX + nodeIndex * nodeSpacing, y: baseY },
        data: {
          label: `${platform}.${command}`,
          actionId: `${platform}.${command.replace(/-/g, '.')}`,
          actionName: command,
          platform,
          params: {},
          requiresApproval: false,
          riskLevel: 'low',
        },
      };
    } else if (trimmed.startsWith('notify ')) {
      const parts = trimmed.split(' ');
      const channel = parts[1] || 'slack';

      node = {
        id: nodeId,
        type: 'notify',
        position: { x: baseX + nodeIndex * nodeSpacing, y: baseY },
        data: {
          label: `Notify ${channel}`,
          channel,
          message: 'Notification',
        },
      };
    } else if (trimmed.startsWith('ai ')) {
      node = {
        id: nodeId,
        type: 'ai',
        position: { x: baseX + nodeIndex * nodeSpacing, y: baseY },
        data: {
          label: 'AI Analysis',
          prompt: 'Analyze',
        },
      };
    } else if (trimmed.startsWith('wait ')) {
      const match = trimmed.match(/wait\s+(\d+)([smhd])?/);
      const duration = match ? parseInt(match[1], 10) : 30;
      const unitChar = match ? match[2] : 's';

      const unitMap: Record<string, string> = {
        s: 'seconds',
        m: 'minutes',
        h: 'hours',
        d: 'days',
      };

      node = {
        id: nodeId,
        type: 'delay',
        position: { x: baseX + nodeIndex * nodeSpacing, y: baseY },
        data: {
          label: `Wait ${duration}${unitChar}`,
          duration,
          durationUnit: unitMap[unitChar] || 'seconds',
        },
      };
    } else if (trimmed.startsWith('if ')) {
      node = {
        id: nodeId,
        type: 'condition',
        position: { x: baseX + nodeIndex * nodeSpacing, y: baseY },
        data: {
          label: 'Condition',
          conditions: [],
        },
      };
      warnings.push('Condition node created but conditions not fully parsed');
    } else if (trimmed.startsWith('loop ')) {
      const match = trimmed.match(/loop\s+(\w+)/);
      const collection = match ? match[1] : 'items';

      node = {
        id: nodeId,
        type: 'loop',
        position: { x: baseX + nodeIndex * nodeSpacing, y: baseY },
        data: {
          label: `Loop ${collection}`,
          collection,
        },
      };
    }

    if (node) {
      nodes.push(node);

      // Connect to previous node
      if (lastNodeId) {
        edges.push({
          id: `e-${lastNodeId}-${nodeId}`,
          source: lastNodeId,
          target: nodeId,
        });
      }

      lastNodeId = nodeId;
      nodeIndex++;
    }
  }

  return {
    success: errors.length === 0,
    lossyConversion: true,
    warnings: warnings.concat([
      'CLI to Cards conversion is lossy - some details may be lost',
      'Review and adjust the converted nodes as needed',
    ]),
    errors,
    nodes,
    edges,
  };
}

// ============================================================================
// CLI to Python Conversion
// ============================================================================

export function convertCliToPython(cli: string): CliToPythonResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const pythonLines: string[] = [];

  pythonLines.push(PYTHON_IMPORTS);
  pythonLines.push('');
  pythonLines.push('async def workflow(context):');
  pythonLines.push('    """');
  pythonLines.push('    Workflow converted from CLI mode.');
  pythonLines.push('    Original CLI commands preserved as comments.');
  pythonLines.push('    """');
  pythonLines.push('');

  const lines = cli.split('\n');
  let varCounter = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      pythonLines.push('');
      continue;
    }

    if (trimmed.startsWith('#')) {
      pythonLines.push(`    ${trimmed}`);
      continue;
    }

    // Convert CLI to Python
    const varName = `result_${varCounter++}`;
    const pythonLine = convertCliLineToPython(trimmed, varName, warnings);
    if (pythonLine) {
      pythonLines.push(`    # CLI: ${trimmed}`);
      pythonLines.push(...pythonLine.split('\n').map(l => `    ${l}`));
    }
  }

  pythonLines.push('');
  pythonLines.push('    return {"status": "success"}');

  return {
    success: errors.length === 0,
    lossyConversion: false,
    warnings,
    errors,
    python: pythonLines.join('\n'),
  };
}

function convertCliLineToPython(line: string, varName: string, warnings: string[]): string | null {
  const parts = line.split(' ').filter(p => p);

  if (parts[0] === 'meraki') {
    const method = (parts[1] || 'operation').replace(/-/g, '_');
    return `${varName} = await meraki.${method}()`;
  }

  if (parts[0] === 'splunk') {
    if (parts[1] === 'search') {
      const query = line.match(/"([^"]+)"/)?.[1] || 'index=main';
      return `${varName} = await splunk.search("${query}")`;
    }
    return `${varName} = await splunk.${parts[1] || 'search'}()`;
  }

  if (parts[0] === 'thousandeyes') {
    const method = (parts[1] || 'get_tests').replace(/-/g, '_');
    return `${varName} = await thousandeyes.${method}()`;
  }

  if (parts[0] === 'notify') {
    const channel = parts[1] || 'slack';
    const message = line.match(/--message\s+"([^"]+)"/)?.[1] || 'Notification';
    const recipient = line.match(/--channel\s+"([^"]+)"/)?.[1] || '#general';
    return `await notify.${channel}("${recipient}", "${message}")`;
  }

  if (parts[0] === 'ai') {
    const prompt = line.match(/--prompt\s+"([^"]+)"/)?.[1] || 'Analyze';
    return `${varName} = await ai.analyze("${prompt}")`;
  }

  if (parts[0] === 'wait') {
    const match = line.match(/wait\s+(\d+)([smhd])?/);
    const duration = match ? parseInt(match[1], 10) : 30;
    const unitChar = match ? match[2] : 's';

    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    const seconds = duration * (multipliers[unitChar] || 1);

    return `import asyncio\nawait asyncio.sleep(${seconds})`;
  }

  if (parts[0] === 'if') {
    warnings.push('Conditional statements require manual adjustment');
    return `# TODO: Convert conditional\n# ${line}`;
  }

  if (parts[0] === 'loop') {
    warnings.push('Loop statements require manual adjustment');
    return `# TODO: Convert loop\n# ${line}`;
  }

  warnings.push(`Unknown command: ${parts[0]}`);
  return `# Unknown: ${line}`;
}

// ============================================================================
// Conversion Not Supported
// ============================================================================

export function convertPythonToCli(): CardsToCliResult {
  return {
    success: false,
    lossyConversion: true,
    warnings: [],
    errors: ['Python to CLI conversion is not supported. Python code contains constructs that cannot be reliably converted to CLI commands.'],
    cli: '# Conversion not supported\n# Please manually rewrite in CLI mode or use Cards mode instead',
  };
}

export function convertPythonToCards(): CliToCardsResult {
  return {
    success: false,
    lossyConversion: true,
    warnings: [],
    errors: ['Python to Cards conversion is not supported. Python code contains constructs that cannot be reliably converted to visual nodes.'],
    nodes: [],
    edges: [],
  };
}

// ============================================================================
// Main Conversion Function
// ============================================================================

export interface ConvertWorkflowOptions {
  nodes?: Node[];
  edges?: Edge[];
  cli?: string;
  python?: string;
  sourceMode: 'cards' | 'cli' | 'python';
  targetMode: 'cards' | 'cli' | 'python';
}

export interface ConvertWorkflowResult {
  success: boolean;
  lossyConversion: boolean;
  warnings: string[];
  errors: string[];
  nodes?: Node[];
  edges?: Edge[];
  cli?: string;
  python?: string;
}

export function convertWorkflow(options: ConvertWorkflowOptions): ConvertWorkflowResult {
  const { sourceMode, targetMode, nodes, edges, cli, python } = options;

  // Same mode - no conversion needed
  if (sourceMode === targetMode) {
    return {
      success: true,
      lossyConversion: false,
      warnings: [],
      errors: [],
      nodes,
      edges,
      cli,
      python,
    };
  }

  const direction = `${sourceMode}-to-${targetMode}` as ConversionDirection;
  const support = CONVERSION_SUPPORT[direction];

  if (!support?.supported) {
    // For unsupported conversions, allow switching but clear the content
    // This lets users switch out of Python mode without being stuck
    const emptyResult: ConvertWorkflowResult = {
      success: true,
      lossyConversion: true,
      warnings: [`Content was discarded: ${support?.description || 'Conversion not supported'}`],
      errors: [],
    };

    // Provide empty/default content for the target mode
    if (targetMode === 'cards') {
      emptyResult.nodes = [];
      emptyResult.edges = [];
    } else if (targetMode === 'cli') {
      emptyResult.cli = '# New CLI workflow\n# Add your commands here\n';
    } else if (targetMode === 'python') {
      emptyResult.python = '# New Python workflow\n# Add your code here\n\nasync def workflow(context):\n    pass\n';
    }

    return emptyResult;
  }

  // Perform conversion
  switch (direction) {
    case 'cards-to-cli': {
      const result = convertCardsToToCli(nodes || [], edges || []);
      return { ...result, cli: result.cli };
    }

    case 'cards-to-python': {
      const result = convertCardsToPython(nodes || [], edges || []);
      return { ...result, python: result.python };
    }

    case 'cli-to-cards': {
      const result = convertCliToCards(cli || '');
      return { ...result, nodes: result.nodes, edges: result.edges };
    }

    case 'cli-to-python': {
      const result = convertCliToPython(cli || '');
      return { ...result, python: result.python };
    }

    case 'python-to-cli': {
      const result = convertPythonToCli();
      return { ...result };
    }

    case 'python-to-cards': {
      const result = convertPythonToCards();
      return { ...result };
    }

    default:
      return {
        success: false,
        lossyConversion: true,
        warnings: [],
        errors: [`Unknown conversion direction: ${direction}`],
      };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function canConvert(sourceMode: 'cards' | 'cli' | 'python', targetMode: 'cards' | 'cli' | 'python'): boolean {
  if (sourceMode === targetMode) return true;
  const direction = `${sourceMode}-to-${targetMode}` as ConversionDirection;
  return CONVERSION_SUPPORT[direction]?.supported || false;
}

export function isLossyConversion(sourceMode: 'cards' | 'cli' | 'python', targetMode: 'cards' | 'cli' | 'python'): boolean {
  if (sourceMode === targetMode) return false;
  const direction = `${sourceMode}-to-${targetMode}` as ConversionDirection;
  return CONVERSION_SUPPORT[direction]?.lossy || false;
}

export function getConversionDescription(sourceMode: 'cards' | 'cli' | 'python', targetMode: 'cards' | 'cli' | 'python'): string {
  if (sourceMode === targetMode) return 'No conversion needed';
  const direction = `${sourceMode}-to-${targetMode}` as ConversionDirection;
  return CONVERSION_SUPPORT[direction]?.description || 'Unknown conversion';
}
