'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import {
  X, Play, Check, AlertTriangle, Loader2, Clock, RefreshCw,
  ChevronDown, ChevronUp, Terminal, Zap, StopCircle, RotateCcw,
  AlertCircle, CheckCircle, Circle, Timer, Edit3
} from 'lucide-react';
import { WorkflowExecution, ExecutionStep, RiskLevel } from './types';

// ============================================================================
// Types
// ============================================================================

interface ExecutionMonitorProps {
  executionId: number;
  onClose: () => void;
  onRetry?: () => void;
  onEdit?: (workflowId: number) => void;
  initialExecution?: WorkflowExecution;
}

interface ExecutionUpdate {
  execution_id: number;
  status: string;
  step_id?: string;
  step_status?: string;
  step_output?: unknown;
  error?: string;
  timestamp: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function getStepStatusIcon(status: ExecutionStep['status']) {
  switch (status) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
    case 'skipped':
      return <Circle className="w-4 h-4 text-slate-500" />;
    case 'pending':
    default:
      return <Circle className="w-4 h-4 text-slate-600" />;
  }
}

function getRiskBadge(risk: RiskLevel) {
  const colors = {
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[risk]}`}>
      {risk.toUpperCase()} RISK
    </span>
  );
}

// ============================================================================
// Step Detail Component
// ============================================================================

const StepDetail = memo(({ step, isExpanded, onToggle }: {
  step: ExecutionStep;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const hasOutput = step.output !== undefined || step.error;

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      {/* Step Header */}
      <button
        onClick={onToggle}
        disabled={!hasOutput}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          hasOutput ? 'hover:bg-slate-700/50 cursor-pointer' : 'cursor-default'
        } ${step.status === 'running' ? 'bg-cyan-500/10' : 'bg-slate-800'}`}
      >
        <div className="flex items-center gap-3">
          {getStepStatusIcon(step.status)}
          <span className="font-medium text-slate-200">{step.name}</span>
          {step.duration_ms !== undefined && step.status !== 'pending' && step.status !== 'running' && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {formatDuration(step.duration_ms)}
            </span>
          )}
        </div>
        {hasOutput && (
          isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Step Output */}
      {isExpanded && hasOutput && (
        <div className="border-t border-slate-700 bg-slate-900/50 p-4">
          {step.error && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
                <AlertCircle className="w-4 h-4" />
                Error
              </div>
              <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono">
                {step.error}
              </pre>
            </div>
          )}
          {step.output !== undefined && step.output !== null && (
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-400 font-medium mb-2">
                <Terminal className="w-4 h-4" />
                Output
              </div>
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono overflow-x-auto">
                {typeof step.output === 'string'
                  ? step.output
                  : JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

StepDetail.displayName = 'StepDetail';

// ============================================================================
// Main Component
// ============================================================================

export const ExecutionMonitor = memo(({
  executionId,
  onClose,
  onRetry,
  onEdit,
  initialExecution
}: ExecutionMonitorProps) => {
  const [execution, setExecution] = useState<WorkflowExecution | null>(initialExecution || null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(!initialExecution);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Fetch execution data
  const fetchExecution = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflows/executions/${executionId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch execution');
      const data = await response.json();
      setExecution(data);

      // Build steps from workflow flow_data (canvas nodes) or fall back to actions
      const flowData = data.workflow_flow_data;
      const executedActions = data.result?.actions || data.executed_actions || [];

      if (flowData?.nodes) {
        // Extract all nodes from flow_data sorted by x position
        const nodes = [...flowData.nodes].sort(
          (a: { position?: { x: number } }, b: { position?: { x: number } }) =>
            (a.position?.x || 0) - (b.position?.x || 0)
        );

        // Create a map of action results by tool name for matching
        const actionResultMap = new Map<string, { success: boolean; error?: string; data?: unknown; duration_ms?: number }>();
        executedActions.forEach((action: { action: string; success: boolean; error?: string; data?: unknown; duration_ms?: number }) => {
          actionResultMap.set(action.action, action);
        });

        // Convert nodes to execution steps
        const flowSteps: ExecutionStep[] = nodes.map((node: { id: string; type: string; data?: { label?: string; actionId?: string; tool?: string } }, idx: number) => {
          const nodeType = node.type;
          const nodeData = node.data || {};
          const label = nodeData.label || nodeType;

          // For action nodes, find the matching execution result
          if (nodeType === 'action') {
            const actionId = nodeData.actionId || nodeData.tool || 'unknown';
            const result = actionResultMap.get(actionId);

            if (result) {
              return {
                id: node.id || `step-${idx}`,
                name: actionId,
                status: result.success ? 'success' as const : 'failed' as const,
                error: result.error,
                output: result.data,
                duration_ms: result.duration_ms,
              };
            } else {
              // Action not yet executed
              return {
                id: node.id || `step-${idx}`,
                name: actionId,
                status: data.status === 'executing' ? 'pending' as const :
                       data.status === 'completed' ? 'success' as const :
                       data.status === 'failed' ? 'failed' as const : 'pending' as const,
              };
            }
          }

          // For non-action nodes (trigger, condition, ai, notify, approval)
          // Mark as completed if workflow reached completion
          const isCompleted = data.status === 'completed' || data.status === 'failed';
          const isExecuting = data.status === 'executing';

          return {
            id: node.id || `step-${idx}`,
            name: label,
            status: isCompleted ? 'success' as const :
                   isExecuting ? 'running' as const : 'pending' as const,
          };
        });

        setSteps(flowSteps);
      } else if (executedActions.length > 0) {
        // Fall back to showing executed actions
        const executedSteps: ExecutionStep[] = executedActions.map((action: { action: string; success?: boolean; error?: string; data?: unknown; duration_ms?: number }, idx: number) => ({
          id: `step-${idx}`,
          name: action.action,
          status: action.success ? 'success' as const : 'failed' as const,
          error: action.error,
          output: action.data,
          duration_ms: action.duration_ms,
        }));
        setSteps(executedSteps);
      } else if (data.recommended_actions) {
        // Show pending actions from AI recommendations
        const pendingSteps: ExecutionStep[] = data.recommended_actions.map((action: { tool: string }, idx: number) => ({
          id: `step-${idx}`,
          name: action.tool,
          status: 'pending' as const,
        }));
        setSteps(pendingSteps);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch execution');
    } finally {
      setIsLoading(false);
    }
  }, [executionId]);

  // Initial fetch
  useEffect(() => {
    if (!initialExecution) {
      fetchExecution();
    }
  }, [fetchExecution, initialExecution]);

  // Poll for updates while executing
  useEffect(() => {
    if (execution?.status === 'executing') {
      const interval = setInterval(fetchExecution, 2000);
      return () => clearInterval(interval);
    }
  }, [execution?.status, fetchExecution]);

  // Timer for elapsed time
  useEffect(() => {
    if (execution?.status === 'executing') {
      const startTime = execution.executed_at
        ? new Date(execution.executed_at).getTime()
        : Date.now();

      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);

      return () => clearInterval(interval);
    }
  }, [execution?.status, execution?.executed_at]);

  // Toggle step expansion
  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  // Get overall status
  const getStatusDisplay = () => {
    if (!execution) return null;

    switch (execution.status) {
      case 'pending_approval':
        return (
          <div className="flex items-center gap-2 text-orange-400">
            <Clock className="w-5 h-5" />
            <span className="font-medium">Awaiting Approval</span>
          </div>
        );
      case 'approved':
        return (
          <div className="flex items-center gap-2 text-blue-400">
            <Check className="w-5 h-5" />
            <span className="font-medium">Approved - Starting</span>
          </div>
        );
      case 'executing':
        return (
          <div className="flex items-center gap-2 text-cyan-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">Executing...</span>
            <span className="text-sm text-slate-400">({formatDuration(elapsedTime)})</span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Completed Successfully</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Execution Failed</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-2 text-slate-400">
            <StopCircle className="w-5 h-5" />
            <span className="font-medium">Rejected</span>
          </div>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-slate-800 rounded-xl p-8">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <p className="text-slate-300 mt-4">Loading execution...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-lg font-medium text-slate-200 text-center mt-4">Error</h3>
          <p className="text-slate-400 text-center mt-2">{error}</p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={fetchExecution}
              className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!execution) return null;

  // Calculate completed steps
  const completedSteps = steps.filter(s => s.status === 'success').length;
  const failedSteps = steps.filter(s => s.status === 'failed').length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Execution Monitor
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {execution.workflow?.name || `Execution #${executionId}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Progress */}
        <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            {getStatusDisplay()}
            {execution.ai_risk_level && getRiskBadge(execution.ai_risk_level)}
          </div>

          {/* Progress Bar */}
          {totalSteps > 0 && (
            <div className="space-y-2">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    failedSteps > 0 ? 'bg-red-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>{completedSteps} of {totalSteps} steps completed</span>
                {failedSteps > 0 && (
                  <span className="text-red-400">{failedSteps} failed</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* AI Analysis */}
        {execution.ai_analysis && (
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="text-sm font-medium text-slate-400 mb-2">AI Analysis</h3>
            <p className="text-sm text-slate-300">{execution.ai_analysis}</p>
            {execution.ai_confidence !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500">Confidence:</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden max-w-[100px]">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: `${execution.ai_confidence}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{execution.ai_confidence}%</span>
              </div>
            )}
          </div>
        )}

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Execution Steps</h3>
          {steps.length > 0 ? (
            <div className="space-y-2">
              {steps.map((step) => (
                <StepDetail
                  key={step.id}
                  step={step}
                  isExpanded={expandedSteps.has(step.id)}
                  onToggle={() => toggleStep(step.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Terminal className="w-8 h-8 mx-auto mb-2" />
              <p>No execution steps yet</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {execution.error && (
          <div className="px-6 py-4 bg-red-500/10 border-t border-red-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Execution Error</p>
                <p className="text-sm text-red-300 mt-1">{execution.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-900/30">
          <div className="text-xs text-slate-500">
            {execution.created_at && (
              <span>Started: {new Date(execution.created_at.endsWith('Z') ? execution.created_at : execution.created_at + 'Z').toLocaleString()}</span>
            )}
            {execution.completed_at && (
              <span className="ml-3">
                Completed: {new Date(execution.completed_at.endsWith('Z') ? execution.completed_at : execution.completed_at + 'Z').toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {onEdit && execution.workflow_id && (
              <button
                onClick={() => {
                  console.log('[ExecutionMonitor] Edit button clicked, workflow_id:', execution.workflow_id);
                  onEdit(execution.workflow_id);
                }}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )}
            {execution.status === 'failed' && onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Cost Info */}
        {(execution.ai_cost_usd > 0 || execution.ai_input_tokens > 0) && (
          <div className="px-6 py-2 bg-slate-900/50 border-t border-slate-700 text-xs text-slate-500 flex items-center gap-4">
            <span>AI Cost: ${execution.ai_cost_usd.toFixed(4)}</span>
            <span>Input: {execution.ai_input_tokens.toLocaleString()} tokens</span>
            <span>Output: {execution.ai_output_tokens.toLocaleString()} tokens</span>
          </div>
        )}
      </div>
    </div>
  );
});

ExecutionMonitor.displayName = 'ExecutionMonitor';
