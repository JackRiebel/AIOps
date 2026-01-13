'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Clock,
  Zap,
  Brain,
  Search,
  Code,
  Database,
  ArrowRight,
  Wrench,
} from 'lucide-react';
import type { SSEEvent, EnterpriseAgentType } from '@/types/agent-flow';
import { getAgentTypeLabel, getAgentTypeColor, isEnterpriseEvent } from '@/lib/agent-event-bus';

export type StepStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';
export type StepType = 'thinking' | 'search' | 'code' | 'api' | 'decision' | 'output' | 'agent' | 'tool' | 'handoff' | 'workflow';

export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  description?: string;
  status: StepStatus;
  duration?: number; // milliseconds
  timestamp?: string;
  details?: string;
  children?: WorkflowStep[];
  agentType?: EnterpriseAgentType;
}

export interface AgentWorkflowTimelineProps {
  steps: WorkflowStep[];
  isExpanded?: boolean;
  title?: string;
  className?: string;
}

const statusIcons: Record<StepStatus, React.ReactNode> = {
  pending: <Circle className="w-4 h-4 text-slate-400" />,
  running: <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  skipped: <Circle className="w-4 h-4 text-slate-300" strokeDasharray="2 2" />,
};

const typeIcons: Record<StepType, React.ReactNode> = {
  thinking: <Brain className="w-3.5 h-3.5" />,
  search: <Search className="w-3.5 h-3.5" />,
  code: <Code className="w-3.5 h-3.5" />,
  api: <Database className="w-3.5 h-3.5" />,
  decision: <Zap className="w-3.5 h-3.5" />,
  output: <CheckCircle2 className="w-3.5 h-3.5" />,
  agent: <Brain className="w-3.5 h-3.5" />,
  tool: <Wrench className="w-3.5 h-3.5" />,
  handoff: <ArrowRight className="w-3.5 h-3.5" />,
  workflow: <Zap className="w-3.5 h-3.5" />,
};

const typeColors: Record<StepType, string> = {
  thinking: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  search: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  code: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  api: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
  decision: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  output: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
  agent: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  tool: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  handoff: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  workflow: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function AgentWorkflowTimeline({
  steps,
  isExpanded: defaultExpanded = false,
  title = 'Workflow',
  className = '',
}: AgentWorkflowTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completed = steps.filter((s) => s.status === 'completed').length;
    const totalDuration = steps.reduce((acc, s) => acc + (s.duration || 0), 0);
    const hasErrors = steps.some((s) => s.status === 'error');
    const isRunning = steps.some((s) => s.status === 'running');

    return { completed, total: steps.length, totalDuration, hasErrors, isRunning };
  }, [steps]);

  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-md ${stats.hasErrors ? 'bg-red-100 dark:bg-red-500/20' : stats.isRunning ? 'bg-cyan-100 dark:bg-cyan-500/20' : 'bg-green-100 dark:bg-green-500/20'}`}>
            {stats.hasErrors ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : stats.isRunning ? (
              <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {stats.completed}/{stats.total} steps
              {stats.totalDuration > 0 && ` • ${formatDuration(stats.totalDuration)}`}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Timeline */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 bg-white dark:bg-slate-800/30">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />

                {/* Steps */}
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <TimelineStep key={step.id} step={step} isLast={index === steps.length - 1} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TimelineStep({ step, isLast }: { step: WorkflowStep; isLast: boolean }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="relative pl-6">
      {/* Status indicator */}
      <div className="absolute left-0 top-0.5 bg-white dark:bg-slate-800">
        {statusIcons[step.status]}
      </div>

      {/* Step content */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${typeColors[step.type]}`}>
            {typeIcons[step.type]}
            {step.type}
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {step.name}
          </span>
          {step.duration && (
            <span className="flex items-center gap-0.5 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {formatDuration(step.duration)}
            </span>
          )}
        </div>

        {step.description && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {step.description}
          </p>
        )}

        {step.details && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="mt-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
        )}

        <AnimatePresence>
          {showDetails && step.details && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 p-2 bg-slate-50 dark:bg-slate-700/30 rounded text-xs font-mono text-slate-600 dark:text-slate-400 overflow-x-auto"
            >
              {step.details}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nested steps */}
        {step.children && step.children.length > 0 && (
          <div className="mt-2 ml-2 pl-3 border-l border-slate-200 dark:border-slate-700 space-y-2">
            {step.children.map((child, index) => (
              <TimelineStep key={child.id} step={child} isLast={index === step.children!.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Convert SSE events to workflow steps for the timeline
 */
export function eventsToWorkflowSteps(events: SSEEvent[]): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  const agentSteps = new Map<string, WorkflowStep>();

  for (const event of events) {
    const timestamp = 'timestamp' in event
      ? (event as { timestamp: string }).timestamp
      : new Date().toISOString();

    switch (event.type) {
      case 'workflow_start': {
        const e = event as Extract<SSEEvent, { type: 'workflow_start' }>;
        steps.push({
          id: `workflow-start-${e.workflow_id}`,
          type: 'workflow',
          name: 'Workflow Started',
          description: e.metadata.query,
          status: 'running',
          timestamp,
        });
        break;
      }

      case 'agent_spawn': {
        const e = event as Extract<SSEEvent, { type: 'agent_spawn' }>;
        const step: WorkflowStep = {
          id: e.agent_id,
          type: 'agent',
          name: `${getAgentTypeLabel(e.agent_type)} Spawned`,
          description: e.metadata.purpose,
          status: 'running',
          timestamp,
          agentType: e.agent_type,
          children: [],
        };
        agentSteps.set(e.agent_id, step);
        steps.push(step);
        break;
      }

      case 'agent_thinking': {
        const e = event as Extract<SSEEvent, { type: 'agent_thinking' }>;
        const parentStep = agentSteps.get(e.agent_id);
        const step: WorkflowStep = {
          id: `thinking-${Date.now()}-${Math.random()}`,
          type: 'thinking',
          name: 'Agent Thinking',
          description: e.metadata.thought,
          status: 'completed',
          timestamp,
        };
        if (parentStep?.children) {
          parentStep.children.push(step);
        } else {
          steps.push(step);
        }
        break;
      }

      case 'tool_call_start': {
        const e = event as Extract<SSEEvent, { type: 'tool_call_start' }>;
        const parentStep = agentSteps.get(e.agent_id);
        const step: WorkflowStep = {
          id: `tool-${e.metadata.tool_name}-${Date.now()}`,
          type: 'tool',
          name: e.metadata.tool_name,
          description: e.metadata.reason || undefined,
          status: 'running',
          timestamp,
          details: JSON.stringify(e.metadata.parameters, null, 2),
        };
        if (parentStep?.children) {
          parentStep.children.push(step);
        } else {
          steps.push(step);
        }
        break;
      }

      case 'tool_call_complete':
      case 'tool_call_error': {
        // Check if this is an enterprise event with agent_id
        const enterpriseEvent = event as { agent_id?: string; metadata?: { success: boolean; result_summary?: string | null; tool_name: string }; duration_ms?: number };
        if (enterpriseEvent.agent_id && enterpriseEvent.metadata) {
          const parentStep = agentSteps.get(enterpriseEvent.agent_id);
          if (parentStep?.children) {
            const toolStep = parentStep.children.find(
              (s) => s.type === 'tool' && s.status === 'running'
            );
            if (toolStep) {
              toolStep.status = enterpriseEvent.metadata.success ? 'completed' : 'error';
              toolStep.duration = enterpriseEvent.duration_ms;
              if (enterpriseEvent.metadata.result_summary) {
                toolStep.description = enterpriseEvent.metadata.result_summary;
              }
            }
          }
        }
        break;
      }

      case 'agent_handoff': {
        const e = event as Extract<SSEEvent, { type: 'agent_handoff' }>;
        steps.push({
          id: `handoff-${Date.now()}-${Math.random()}`,
          type: 'handoff',
          name: `Handoff to ${getAgentTypeLabel(e.metadata.to_type)}`,
          description: e.metadata.context_summary,
          status: 'completed',
          timestamp,
          agentType: e.metadata.to_type,
        });
        break;
      }

      case 'agent_response': {
        const e = event as Extract<SSEEvent, { type: 'agent_response' }>;
        const parentStep = agentSteps.get(e.agent_id);
        if (parentStep) {
          parentStep.status = 'completed';
        }
        break;
      }

      case 'workflow_complete': {
        const e = event as Extract<SSEEvent, { type: 'workflow_complete' }>;
        steps.push({
          id: `workflow-complete-${e.workflow_id}`,
          type: 'workflow',
          name: 'Workflow Complete',
          status: e.status === 'completed' ? 'completed' : 'error',
          timestamp,
          duration: e.duration_ms,
          details: `Agents: ${e.metadata.agents_used.join(', ')}\nTools: ${e.metadata.tools_called.join(', ')}`,
        });
        break;
      }

      // Legacy event handling
      case 'agent_activity_start': {
        steps.push({
          id: `agent-${event.agent}-${Date.now()}`,
          type: 'agent',
          name: event.agent === 'knowledge' ? 'Knowledge Agent' : 'Implementation Agent',
          description: event.query,
          status: 'running',
          timestamp,
        });
        break;
      }

      case 'agent_activity_complete': {
        steps.push({
          id: `agent-complete-${event.agent}-${Date.now()}`,
          type: 'output',
          name: 'Agent Complete',
          description: event.response_summary,
          status: event.success ? 'completed' : 'error',
          timestamp,
        });
        break;
      }

      case 'tool_use_start': {
        steps.push({
          id: `tool-${event.tool}-${Date.now()}`,
          type: 'tool',
          name: event.tool,
          status: 'running',
          timestamp,
        });
        break;
      }

      case 'tool_use_complete': {
        const lastToolStep = [...steps].reverse().find((s) => s.type === 'tool' && s.status === 'running');
        if (lastToolStep) {
          lastToolStep.status = event.success ? 'completed' : 'error';
        }
        break;
      }

      case 'done': {
        steps.push({
          id: `done-${Date.now()}`,
          type: 'workflow',
          name: 'Complete',
          status: 'completed',
          timestamp,
          details: event.usage
            ? `Tokens: ${event.usage.input_tokens} in / ${event.usage.output_tokens} out`
            : undefined,
        });
        break;
      }

      case 'error': {
        steps.push({
          id: `error-${Date.now()}`,
          type: 'workflow',
          name: 'Error',
          description: event.error,
          status: 'error',
          timestamp,
        });
        break;
      }
    }
  }

  return steps;
}
