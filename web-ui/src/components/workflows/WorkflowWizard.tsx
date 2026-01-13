'use client';

import { memo, useState, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Zap, Calendar, Play, Plus, Trash2, Brain } from 'lucide-react';
import type { Workflow, WorkflowCondition, WorkflowAction, TriggerType, CreateWorkflowRequest } from './types';

interface WorkflowWizardProps {
  onClose: () => void;
  onCreate: (workflow: Workflow) => void;
  initialTemplate?: string;
}

const STEPS = [
  { step: 1, title: 'Trigger', description: 'When to run' },
  { step: 2, title: 'Conditions', description: 'What to check' },
  { step: 3, title: 'Actions', description: 'What to do' },
];

const POLL_INTERVALS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: '>', label: 'greater than' },
  { value: '>=', label: 'greater than or equals' },
  { value: '<', label: 'less than' },
  { value: '<=', label: 'less than or equals' },
  { value: 'contains', label: 'contains' },
];

const COMMON_ACTIONS = [
  { tool: 'slack_notify', label: 'Send Slack Notification', requires_approval: false },
  { tool: 'meraki_get_device', label: 'Get Device Details', requires_approval: false },
  { tool: 'meraki_reboot_device', label: 'Reboot Device', requires_approval: true },
  { tool: 'meraki_get_network_clients', label: 'Get Network Clients', requires_approval: false },
  { tool: 'meraki_list_vlans', label: 'List VLANs', requires_approval: false },
];

export const WorkflowWizard = memo(({
  onClose,
  onCreate,
  initialTemplate,
}: WorkflowWizardProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('splunk_query');
  const [splunkQuery, setSplunkQuery] = useState('');
  const [scheduleCron, setScheduleCron] = useState('');
  const [pollInterval, setPollInterval] = useState(300);
  const [conditions, setConditions] = useState<WorkflowCondition[]>([]);
  const [actions, setActions] = useState<WorkflowAction[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState(0.7);

  // Condition helpers
  const addCondition = useCallback(() => {
    setConditions(prev => [...prev, { field: '', operator: 'equals', value: '' }]);
  }, []);

  const updateCondition = useCallback((index: number, updates: Partial<WorkflowCondition>) => {
    setConditions(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  }, []);

  const removeCondition = useCallback((index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Action helpers
  const addAction = useCallback((action: typeof COMMON_ACTIONS[0]) => {
    setActions(prev => [...prev, { tool: action.tool, params: {}, requires_approval: action.requires_approval }]);
  }, []);

  const removeAction = useCallback((index: number) => {
    setActions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const toggleActionApproval = useCallback((index: number) => {
    setActions(prev => prev.map((a, i) => i === index ? { ...a, requires_approval: !a.requires_approval } : a));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

    try {
      const payload: CreateWorkflowRequest = {
        name,
        description,
        trigger_type: triggerType,
        splunk_query: triggerType === 'splunk_query' ? splunkQuery : undefined,
        schedule_cron: triggerType === 'schedule' ? scheduleCron : undefined,
        poll_interval_seconds: pollInterval,
        conditions: conditions.filter(c => c.field && c.value),
        actions,
        ai_enabled: aiEnabled,
        ai_prompt: aiPrompt || undefined,
        ai_confidence_threshold: aiConfidenceThreshold,
      };

      const res = await fetch('/api/workflows', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const workflow = await res.json();
        onCreate(workflow);
      } else {
        throw new Error('Failed to create workflow');
      }
    } catch (error) {
      console.error('Failed to create workflow:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [name, description, triggerType, splunkQuery, scheduleCron, pollInterval, conditions, actions, aiEnabled, aiPrompt, aiConfidenceThreshold, onCreate]);

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        if (!name.trim()) return false;
        if (triggerType === 'splunk_query' && !splunkQuery.trim()) return false;
        if (triggerType === 'schedule' && !scheduleCron.trim()) return false;
        return true;
      case 2:
        return true; // Conditions are optional
      case 3:
        return actions.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Create Workflow
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Step {currentStep} of 3: {STEPS[currentStep - 1].title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          {STEPS.map((step, index) => (
            <div key={step.step} className="flex items-center">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${currentStep >= step.step
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }
              `}>
                {step.step}
              </div>
              <span className={`
                ml-2 text-sm
                ${currentStep >= step.step ? 'text-slate-900 dark:text-white' : 'text-slate-400'}
              `}>
                {step.title}
              </span>
              {index < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 mx-3 text-slate-300 dark:text-slate-600" />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Trigger */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Workflow Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="e.g., Device Offline Alert"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  rows={2}
                  placeholder="What does this workflow do?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Trigger Type *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { type: 'splunk_query' as const, icon: Zap, label: 'Splunk Query', desc: 'Poll Splunk for events' },
                    { type: 'schedule' as const, icon: Calendar, label: 'Schedule', desc: 'Run on a schedule' },
                    { type: 'manual' as const, icon: Play, label: 'Manual', desc: 'Trigger manually' },
                  ].map(({ type, icon: Icon, label, desc }) => (
                    <button
                      key={type}
                      onClick={() => setTriggerType(type)}
                      className={`
                        p-4 rounded-lg border-2 text-left transition-all
                        ${triggerType === type
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 mb-2 ${triggerType === type ? 'text-cyan-600' : 'text-slate-400'}`} />
                      <div className={`font-medium ${triggerType === type ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {triggerType === 'splunk_query' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Splunk Query *
                    </label>
                    <textarea
                      value={splunkQuery}
                      onChange={(e) => setSplunkQuery(e.target.value)}
                      className="w-full px-3 py-2 font-mono text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      rows={3}
                      placeholder='index=meraki sourcetype=syslog "device offline"'
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Poll Every
                    </label>
                    <select
                      value={pollInterval}
                      onChange={(e) => setPollInterval(parseInt(e.target.value))}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      {POLL_INTERVALS.map(interval => (
                        <option key={interval.value} value={interval.value}>
                          {interval.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {triggerType === 'schedule' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Schedule (Cron Expression) *
                  </label>
                  <input
                    type="text"
                    value={scheduleCron}
                    onChange={(e) => setScheduleCron(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="0 6 * * * (daily at 6 AM)"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Format: minute hour day-of-month month day-of-week
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Conditions */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">
                    Conditions
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Define when the workflow should trigger (optional)
                  </p>
                </div>
                <button
                  onClick={addCondition}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Condition
                </button>
              </div>

              {conditions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                  <p>No conditions defined</p>
                  <p className="text-sm">Workflow will trigger on any matching events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <span className="text-sm text-slate-500">IF</span>
                      <input
                        type="text"
                        value={condition.field}
                        onChange={(e) => updateCondition(index, { field: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="field name"
                      />
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, { operator: e.target.value })}
                        className="px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        {CONDITION_OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={String(condition.value)}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="value"
                      />
                      <button
                        onClick={() => removeCondition(index)}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Configuration */}
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-3 mb-4">
                  <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div className="flex-1">
                    <h4 className="font-medium text-purple-700 dark:text-purple-300">
                      AI-Powered Analysis
                    </h4>
                    <p className="text-sm text-purple-600 dark:text-purple-400">
                      Let AI analyze events and recommend actions
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {aiEnabled && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-purple-600 dark:text-purple-400 mb-1">
                        Confidence Threshold: {(aiConfidenceThreshold * 100).toFixed(0)}%
                      </label>
                      <input
                        type="range"
                        min="0.4"
                        max="1"
                        step="0.05"
                        value={aiConfidenceThreshold}
                        onChange={(e) => setAiConfidenceThreshold(parseFloat(e.target.value))}
                        className="w-full accent-purple-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-purple-600 dark:text-purple-400 mb-1">
                        AI Instructions (optional)
                      </label>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        rows={2}
                        placeholder="Custom instructions for AI analysis..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Actions */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-1">
                  Actions
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Select what happens when the workflow triggers
                </p>
              </div>

              {/* Available Actions */}
              <div>
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Available Actions
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {COMMON_ACTIONS.map((action) => (
                    <button
                      key={action.tool}
                      onClick={() => addAction(action)}
                      disabled={actions.some(a => a.tool === action.tool)}
                      className={`
                        p-3 rounded-lg border text-left transition-all
                        ${actions.some(a => a.tool === action.tool)
                          ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed'
                          : 'border-slate-200 dark:border-slate-600 hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20'
                        }
                      `}
                    >
                      <div className="font-medium text-sm text-slate-700 dark:text-slate-300">
                        {action.label}
                      </div>
                      {action.requires_approval && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          Requires approval
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Actions */}
              {actions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Selected Actions (in order)
                  </h4>
                  <div className="space-y-2">
                    {actions.map((action, index) => {
                      const actionInfo = COMMON_ACTIONS.find(a => a.tool === action.tool);
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-500">
                              {index + 1}.
                            </span>
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {actionInfo?.label || action.tool}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={action.requires_approval}
                                onChange={() => toggleActionApproval(index)}
                                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span className="text-slate-500 dark:text-slate-400">
                                Requires approval
                              </span>
                            </label>
                            <button
                              onClick={() => removeAction(index)}
                              className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => currentStep > 1 ? setCurrentStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep > 1 ? 'Back' : 'Cancel'}
          </button>

          {currentStep < 3 ? (
            <button
              onClick={() => setCurrentStep(s => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

WorkflowWizard.displayName = 'WorkflowWizard';
