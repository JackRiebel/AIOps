'use client';

import { memo, useState, useCallback, useEffect } from 'react';
import { X, Play, Pause, Edit2, Save, Clock, Zap, Calendar, Settings, Code, Brain, GitBranch } from 'lucide-react';
import type { Workflow, WorkflowCondition, WorkflowAction, POLL_INTERVALS, CONDITION_OPERATORS } from './types';
import { WorkflowFlowPreview } from './WorkflowFlowPreview';

interface WorkflowDetailPanelProps {
  workflow: Workflow;
  onUpdate: (workflow: Workflow) => void;
  onClose: () => void;
}

const POLL_INTERVALS_LIST = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '24 hours' },
];

interface TestResult {
  success: boolean;
  would_trigger?: boolean;
  event_count?: number;
  matching_events?: number;
  sample_events?: Record<string, unknown>[];
  ai_analysis?: {
    reasoning?: string;
    confidence?: number;
    should_act?: boolean;
  };
  actions_to_execute?: Record<string, unknown>[];
  error?: string;
}

export const WorkflowDetailPanel = memo(({
  workflow,
  onUpdate,
  onClose,
}: WorkflowDetailPanelProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedWorkflow, setEditedWorkflow] = useState(workflow);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Clear test results when switching workflows
  useEffect(() => {
    setTestResult(null);
    setTestError(null);
    setIsEditing(false);
    setEditedWorkflow(workflow);
  }, [workflow.id]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedWorkflow),
      });

      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setIsSaving(false);
    }
  }, [workflow.id, editedWorkflow, onUpdate]);

  const handleTest = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const res = await fetch(`/api/workflows/${workflow.id}/test`, {
        method: 'POST',
        credentials: 'include',
      });

      const result = await res.json();

      if (res.ok) {
        setTestResult(result);
      } else {
        setTestError(result.detail || result.error || 'Test failed');
      }
    } catch (error) {
      console.error('Failed to test workflow:', error);
      setTestError(error instanceof Error ? error.message : 'Failed to test workflow');
    } finally {
      setIsTesting(false);
    }
  }, [workflow.id]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-3">
          <div className={`
            p-2 rounded-lg
            ${workflow.status === 'active'
              ? 'bg-green-100 dark:bg-green-900/30'
              : workflow.status === 'paused'
              ? 'bg-amber-100 dark:bg-amber-900/30'
              : 'bg-slate-100 dark:bg-slate-700'
            }
          `}>
            {workflow.trigger_type === 'splunk_query' ? (
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            ) : workflow.trigger_type === 'schedule' ? (
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <Play className="w-5 h-5 text-green-600 dark:text-green-400" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {workflow.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {workflow.trigger_type.replace('_', ' ')} trigger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setEditedWorkflow(workflow);
                  setIsEditing(false);
                }}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Run'
                )}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Test Results */}
      {(testResult || testError) && (
        <div className="mx-4 mt-4">
          <div className={`rounded-lg border p-4 ${
            testError
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : testResult?.would_trigger
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className={`font-medium ${
                testError
                  ? 'text-red-700 dark:text-red-400'
                  : testResult?.would_trigger
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}>
                {testError ? 'Test Failed' : testResult?.would_trigger ? 'Would Trigger' : 'Would Not Trigger'}
              </h4>
              <button
                onClick={() => { setTestResult(null); setTestError(null); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {testError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{testError}</p>
            ) : testResult && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Events Found:</span>
                    <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">{testResult.event_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Matching:</span>
                    <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">{testResult.matching_events || 0}</span>
                  </div>
                </div>

                {testResult.ai_analysis && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400 mb-1">AI Analysis:</p>
                    <p className="text-slate-700 dark:text-slate-300">{testResult.ai_analysis.reasoning}</p>
                    {testResult.ai_analysis.confidence !== undefined && (
                      <p className="mt-1 text-xs text-slate-500">
                        Confidence: {Math.round(testResult.ai_analysis.confidence * 100)}%
                      </p>
                    )}
                  </div>
                )}

                {testResult.sample_events && testResult.sample_events.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400 mb-1">Sample Events:</p>
                    <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded overflow-auto max-h-32">
                      {JSON.stringify(testResult.sample_events.slice(0, 2), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Workflow Flow Preview */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Workflow Flow
            </h3>
          </div>
          <WorkflowFlowPreview workflow={isEditing ? editedWorkflow : workflow} />
        </section>

        {/* Description */}
        <section>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Description
          </h3>
          {isEditing ? (
            <textarea
              value={editedWorkflow.description || ''}
              onChange={(e) => setEditedWorkflow({ ...editedWorkflow, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              rows={3}
              placeholder="Describe what this workflow does..."
            />
          ) : (
            <p className="text-slate-600 dark:text-slate-400">
              {workflow.description || 'No description'}
            </p>
          )}
        </section>

        {/* Trigger Configuration */}
        <section className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Trigger Configuration
            </h3>
          </div>

          {workflow.trigger_type === 'splunk_query' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Splunk Query
                </label>
                {isEditing ? (
                  <textarea
                    value={editedWorkflow.splunk_query || ''}
                    onChange={(e) => setEditedWorkflow({ ...editedWorkflow, splunk_query: e.target.value })}
                    className="w-full px-3 py-2 font-mono text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    rows={3}
                  />
                ) : (
                  <code className="block p-3 rounded-lg bg-slate-900 text-green-400 text-sm font-mono overflow-x-auto">
                    {workflow.splunk_query}
                  </code>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Poll Interval
                </label>
                {isEditing ? (
                  <select
                    value={editedWorkflow.poll_interval_seconds}
                    onChange={(e) => setEditedWorkflow({ ...editedWorkflow, poll_interval_seconds: parseInt(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {POLL_INTERVALS_LIST.map(interval => (
                      <option key={interval.value} value={interval.value}>
                        {interval.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-600 dark:text-slate-400">
                    Every {POLL_INTERVALS_LIST.find(i => i.value === workflow.poll_interval_seconds)?.label || `${workflow.poll_interval_seconds}s`}
                  </span>
                )}
              </div>
            </div>
          )}

          {workflow.trigger_type === 'schedule' && (
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Schedule (Cron)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedWorkflow.schedule_cron || ''}
                  onChange={(e) => setEditedWorkflow({ ...editedWorkflow, schedule_cron: e.target.value })}
                  className="w-full px-3 py-2 font-mono text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="0 6 * * *"
                />
              ) : (
                <code className="text-slate-600 dark:text-slate-400 font-mono">
                  {workflow.schedule_cron}
                </code>
              )}
            </div>
          )}
        </section>

        {/* Conditions */}
        {workflow.conditions && workflow.conditions.length > 0 && (
          <section className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Conditions
              </h3>
            </div>

            <div className="space-y-2">
              {workflow.conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-400">IF</span>
                  <code className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200">
                    {condition.field}
                  </code>
                  <span className="text-slate-500">{condition.operator}</span>
                  <code className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-700 dark:text-blue-400">
                    {String(condition.value)}
                  </code>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Configuration */}
        {workflow.ai_enabled && (
          <section className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300">
                AI Analysis
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-purple-600 dark:text-purple-400 mb-1">
                  Confidence Threshold
                </label>
                {isEditing ? (
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={editedWorkflow.ai_confidence_threshold}
                    onChange={(e) => setEditedWorkflow({ ...editedWorkflow, ai_confidence_threshold: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                ) : (
                  <span className="text-purple-700 dark:text-purple-300 font-medium">
                    {(workflow.ai_confidence_threshold * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Auto-Execute Status */}
              {workflow.auto_execute_enabled && (
                <div className="flex items-center gap-2 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Auto-Execute Enabled
                    </span>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Confidence ≥ {((workflow.auto_execute_min_confidence || 0.9) * 100).toFixed(0)}% •
                      {workflow.auto_execute_max_risk === 'low' ? ' Low risk only' : ' Low & Medium risk'}
                    </p>
                  </div>
                </div>
              )}

              {workflow.ai_prompt && (
                <div>
                  <label className="block text-xs text-purple-600 dark:text-purple-400 mb-1">
                    AI Instructions
                  </label>
                  {isEditing ? (
                    <textarea
                      value={editedWorkflow.ai_prompt || ''}
                      onChange={(e) => setEditedWorkflow({ ...editedWorkflow, ai_prompt: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      {workflow.ai_prompt}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Actions */}
        {workflow.actions && workflow.actions.length > 0 && (
          <section className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Actions
              </h3>
            </div>

            <div className="space-y-2">
              {workflow.actions.map((action, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                      {action.tool}
                    </span>
                  </div>
                  {action.requires_approval && (
                    <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                      Requires Approval
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stats */}
        <section className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {workflow.trigger_count}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Total Triggers
            </div>
          </div>
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {workflow.success_count}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">
              Successful
            </div>
          </div>
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {workflow.failure_count}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400">
              Failed
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

WorkflowDetailPanel.displayName = 'WorkflowDetailPanel';
