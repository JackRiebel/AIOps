'use client';

import { memo, useMemo } from 'react';
import {
  HelpCircle, Lightbulb, Zap, GitBranch, Brain, Wrench,
  Bell, Clock, Repeat, ArrowRight, ExternalLink, Copy,
  Shield, Activity, AlertTriangle
} from 'lucide-react';
import type { CanvasNodeType } from '../types';

interface CardGuidelinesProps {
  selectedNodeType?: CanvasNodeType | null;
  onInsertPattern: (pattern: WorkflowPattern) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export interface WorkflowPattern {
  id: string;
  name: string;
  description: string;
  nodes: Array<{
    type: CanvasNodeType;
    data: Record<string, unknown>;
    offsetX: number;
    offsetY: number;
  }>;
  edges: Array<{
    sourceIndex: number;
    targetIndex: number;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
}

// Node type specific guidelines
const NODE_GUIDELINES: Record<CanvasNodeType, {
  icon: React.ReactNode;
  title: string;
  description: string;
  tips: string[];
  bestPractices: string[];
}> = {
  trigger: {
    icon: <Zap className="w-5 h-5 text-emerald-400" />,
    title: 'Trigger Node',
    description: 'Triggers are the starting point of your workflow. They define when the workflow should execute.',
    tips: [
      'Every workflow needs at least one trigger',
      'Use schedule triggers for regular checks',
      'Webhook triggers are best for event-driven workflows',
      'Manual triggers are useful for testing',
    ],
    bestPractices: [
      'Name triggers descriptively to indicate when they fire',
      'Consider rate limiting for high-frequency triggers',
      'Use filters to reduce unnecessary executions',
    ],
  },
  condition: {
    icon: <GitBranch className="w-5 h-5 text-amber-400" />,
    title: 'Condition Node',
    description: 'Conditions branch your workflow based on data values or expressions.',
    tips: [
      'Conditions have two outputs: true (green) and false (red)',
      'Use expressions for complex logic',
      'AI conditions can make smart decisions',
    ],
    bestPractices: [
      'Keep conditions simple and focused',
      'Document what each branch represents',
      'Consider all edge cases in your conditions',
    ],
  },
  ai: {
    icon: <Brain className="w-5 h-5 text-purple-400" />,
    title: 'AI Analysis Node',
    description: 'AI nodes use Claude to analyze data, make decisions, or generate responses.',
    tips: [
      'Provide clear, specific prompts',
      'Use context from previous nodes',
      'AI can output decisions, text, or structured data',
    ],
    bestPractices: [
      'Be specific about expected output format',
      'Include relevant context in prompts',
      'Consider costs for frequent AI calls',
    ],
  },
  action: {
    icon: <Wrench className="w-5 h-5 text-cyan-400" />,
    title: 'Action Node',
    description: 'Actions execute operations on your network infrastructure or external systems.',
    tips: [
      'High-risk actions require approval by default',
      'Use parameters to customize behavior',
      'Actions can return data for subsequent nodes',
    ],
    bestPractices: [
      'Test actions in non-production first',
      'Enable approval for destructive operations',
      'Use appropriate timeouts for long operations',
    ],
  },
  notify: {
    icon: <Bell className="w-5 h-5 text-blue-400" />,
    title: 'Notify Node',
    description: 'Send notifications via Slack, email, Teams, or webhooks.',
    tips: [
      'Use variables like {{device.name}} in messages',
      'Set appropriate priority levels',
      'Include actionable information in alerts',
    ],
    bestPractices: [
      'Avoid notification fatigue with smart filtering',
      'Include context for quick understanding',
      'Use different channels for different severities',
    ],
  },
  approval: {
    icon: <Shield className="w-5 h-5 text-orange-400" />,
    title: 'Approval Gate',
    description: 'Pause workflow execution until manual approval is granted.',
    tips: [
      'Has approved (green) and rejected (red) outputs',
      'Configure who can approve',
      'Set expiration times for pending approvals',
    ],
    bestPractices: [
      'Use for high-risk or irreversible actions',
      'Provide clear context in approval requests',
      'Set reasonable timeout periods',
    ],
  },
  delay: {
    icon: <Clock className="w-5 h-5 text-slate-400" />,
    title: 'Delay Node',
    description: 'Pause workflow execution for a specified duration.',
    tips: [
      'Use fixed delays for waiting periods',
      'Schedule until specific times',
      'Combine with loops for polling',
    ],
    bestPractices: [
      'Use delays to prevent API rate limiting',
      'Consider time zones for scheduled delays',
      'Keep delays reasonable to avoid stuck workflows',
    ],
  },
  loop: {
    icon: <Repeat className="w-5 h-5 text-orange-400" />,
    title: 'Loop Node',
    description: 'Iterate over collections or repeat actions until a condition is met.',
    tips: [
      'Loop output connects to actions inside loop',
      'Done output continues after all iterations',
      'Access current item via loop variable',
    ],
    bestPractices: [
      'Set max iterations to prevent infinite loops',
      'Use parallel execution when possible',
      'Handle errors within loop iterations',
    ],
  },
  subworkflow: {
    icon: <Activity className="w-5 h-5 text-indigo-400" />,
    title: 'Sub-workflow Node',
    description: 'Execute another workflow as part of this one.',
    tips: [
      'Pass data to sub-workflow via parameters',
      'Choose to wait or run async',
      'Sub-workflow results are available after',
    ],
    bestPractices: [
      'Break complex workflows into sub-workflows',
      'Reuse common patterns as sub-workflows',
      'Document data flow between workflows',
    ],
  },
  comment: {
    icon: <HelpCircle className="w-5 h-5 text-slate-400" />,
    title: 'Comment Node',
    description: 'Add documentation and notes to your workflow.',
    tips: [
      'Comments don\'t affect execution',
      'Use to explain complex logic',
      'Group related nodes with comments',
    ],
    bestPractices: [
      'Document why, not just what',
      'Update comments when logic changes',
      'Use for onboarding new team members',
    ],
  },
};

// Pre-built workflow patterns
const WORKFLOW_PATTERNS: WorkflowPattern[] = [
  {
    id: 'alert-notify',
    name: 'Alert → Notify',
    description: 'Check a condition and send notification if true',
    nodes: [
      { type: 'condition', data: { label: 'Check Alert' }, offsetX: 0, offsetY: 0 },
      { type: 'notify', data: { label: 'Send Alert' }, offsetX: 250, offsetY: -50 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, sourceHandle: 'true' },
    ],
  },
  {
    id: 'ai-decision',
    name: 'AI Decision Flow',
    description: 'Use AI to analyze and branch based on result',
    nodes: [
      { type: 'ai', data: { label: 'AI Analysis' }, offsetX: 0, offsetY: 0 },
      { type: 'condition', data: { label: 'Check Result' }, offsetX: 250, offsetY: 0 },
      { type: 'action', data: { label: 'Take Action' }, offsetX: 500, offsetY: -50 },
      { type: 'notify', data: { label: 'Notify' }, offsetX: 500, offsetY: 50 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1 },
      { sourceIndex: 1, targetIndex: 2, sourceHandle: 'true' },
      { sourceIndex: 1, targetIndex: 3, sourceHandle: 'false' },
    ],
  },
  {
    id: 'retry-loop',
    name: 'Retry with Delay',
    description: 'Retry an action with delay between attempts',
    nodes: [
      { type: 'loop', data: { label: 'Retry Loop', maxIterations: 3 }, offsetX: 0, offsetY: 0 },
      { type: 'action', data: { label: 'Try Action' }, offsetX: 250, offsetY: -50 },
      { type: 'delay', data: { label: 'Wait 30s', duration: 30 }, offsetX: 500, offsetY: -50 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, sourceHandle: 'loop' },
      { sourceIndex: 1, targetIndex: 2 },
      { sourceIndex: 2, targetIndex: 0 },
    ],
  },
  {
    id: 'approval-gate',
    name: 'Approval Gate',
    description: 'Require approval before high-risk action',
    nodes: [
      { type: 'approval', data: { label: 'Request Approval' }, offsetX: 0, offsetY: 0 },
      { type: 'action', data: { label: 'Execute', requiresApproval: false }, offsetX: 250, offsetY: -50 },
      { type: 'notify', data: { label: 'Notify Rejected' }, offsetX: 250, offsetY: 50 },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, sourceHandle: 'approved' },
      { sourceIndex: 0, targetIndex: 2, sourceHandle: 'rejected' },
    ],
  },
];

export const CardGuidelines = memo(({
  selectedNodeType,
  onInsertPattern,
  isCollapsed = false,
  onToggleCollapse,
}: CardGuidelinesProps) => {
  const guidelines = selectedNodeType ? NODE_GUIDELINES[selectedNodeType] : null;

  const contextualPatterns = useMemo(() => {
    if (!selectedNodeType) return WORKFLOW_PATTERNS;
    // Filter patterns relevant to selected node type
    return WORKFLOW_PATTERNS.filter(p =>
      p.nodes.some(n => n.type === selectedNodeType)
    );
  }, [selectedNodeType]);

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="fixed right-4 bottom-4 p-3 bg-slate-800 rounded-xl border border-slate-700 hover:bg-slate-700 transition-colors shadow-lg z-10"
        title="Show Guidelines"
      >
        <Lightbulb className="w-5 h-5 text-amber-400" />
      </button>
    );
  }

  return (
    <div className="w-72 bg-slate-800/95 border-l border-slate-700 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-white text-sm">Guidelines</h3>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Node-specific guidelines */}
        {guidelines ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {guidelines.icon}
              <div>
                <h4 className="font-semibold text-white">{guidelines.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{guidelines.description}</p>
              </div>
            </div>

            {/* Tips */}
            <div>
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Tips
              </h5>
              <ul className="space-y-1.5">
                {guidelines.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-cyan-400 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Best Practices */}
            <div>
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Best Practices
              </h5>
              <ul className="space-y-1.5">
                {guidelines.bestPractices.map((practice, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                    {practice}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              Select a node to see specific guidelines
            </p>
          </div>
        )}

        {/* Common Patterns */}
        <div>
          <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            {selectedNodeType ? 'Related Patterns' : 'Common Patterns'}
          </h5>
          <div className="space-y-2">
            {contextualPatterns.map((pattern) => (
              <button
                key={pattern.id}
                onClick={() => onInsertPattern(pattern)}
                className="w-full text-left p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-white">{pattern.name}</span>
                  <Copy className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-slate-400">{pattern.description}</p>
                <div className="flex items-center gap-1 mt-2">
                  {pattern.nodes.map((node, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded bg-slate-600/50 text-[10px] text-slate-300"
                    >
                      {node.type}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Documentation Link */}
        <a
          href="/docs#workflows"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          View Full Documentation
        </a>
      </div>
    </div>
  );
});

CardGuidelines.displayName = 'CardGuidelines';

export default CardGuidelines;
