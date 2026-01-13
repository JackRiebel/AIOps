'use client';

import { memo, useState, useCallback } from 'react';
import {
  X, ChevronRight, ChevronLeft, Check, Eye, Shield, Bell,
  Calendar, Zap, Bot, AlertTriangle, CheckCircle2, Info,
  Network, Cpu, FileSearch, Settings
} from 'lucide-react';
import {
  ACTION_REGISTRY,
  type ActionDefinition,
  type CreateWorkflowRequest,
  type Workflow,
  type TriggerType,
  type RiskLevel
} from './types';

interface GuidedWizardProps {
  onClose: () => void;
  onCreate: (workflow: Workflow) => void;
}

type GoalType = 'monitor' | 'respond' | 'maintain' | 'report';
type AIMode = 'auto' | 'suggest' | 'none';

interface WizardState {
  step: number;
  goal?: GoalType;
  triggerType?: TriggerType;
  triggerConfig: {
    splunkQuery?: string;
    scheduleCron?: string;
    pollInterval: number;
  };
  selectedActions: string[];
  actionConfigs: Record<string, Record<string, unknown>>;
  aiMode: AIMode;
  aiPrompt: string;
  aiConfidence: number;
  safety: {
    requireApproval: boolean;
    notifyOnTrigger: boolean;
    maxExecutions: number;
  };
  name: string;
  description: string;
}

const GOAL_OPTIONS = [
  {
    id: 'monitor' as GoalType,
    icon: Eye,
    label: 'Monitor for problems',
    description: 'Watch for issues and alert me',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  {
    id: 'respond' as GoalType,
    icon: AlertTriangle,
    label: 'Respond to incidents',
    description: 'Take action when something happens',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  {
    id: 'maintain' as GoalType,
    icon: Settings,
    label: 'Scheduled tasks',
    description: 'Run tasks on a schedule',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  {
    id: 'report' as GoalType,
    icon: FileSearch,
    label: 'Generate reports',
    description: 'Collect and summarize data',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
];

const TRIGGER_OPTIONS: Record<GoalType, { id: TriggerType; icon: typeof Zap; label: string; description: string }[]> = {
  monitor: [
    { id: 'splunk_query', icon: FileSearch, label: 'When Splunk detects something', description: 'Run a Splunk query and trigger on results' },
    { id: 'schedule', icon: Calendar, label: 'Check on a schedule', description: 'Run periodic health checks' },
  ],
  respond: [
    { id: 'splunk_query', icon: FileSearch, label: 'When an alert fires', description: 'Triggered by Splunk notable events' },
    { id: 'manual', icon: Zap, label: 'Manual trigger', description: 'Run only when I start it' },
  ],
  maintain: [
    { id: 'schedule', icon: Calendar, label: 'On a schedule', description: 'Run at specific times' },
    { id: 'manual', icon: Zap, label: 'When I trigger it', description: 'Run only when I start it manually' },
  ],
  report: [
    { id: 'schedule', icon: Calendar, label: 'On a schedule', description: 'Generate reports periodically' },
    { id: 'manual', icon: Zap, label: 'When I trigger it', description: 'Run only when I request it' },
  ],
};

const AI_MODE_OPTIONS = [
  {
    id: 'suggest' as AIMode,
    label: 'AI suggests, I approve',
    description: 'Safest option - AI provides recommendations but waits for your approval',
    icon: Bot,
    recommended: true,
  },
  {
    id: 'auto' as AIMode,
    label: 'Let AI decide and act',
    description: 'For low-risk actions only - AI can execute without approval',
    icon: Zap,
  },
  {
    id: 'none' as AIMode,
    label: 'No AI, just follow rules',
    description: 'Predictable but less flexible - only runs predefined actions',
    icon: Settings,
  },
];

const STEPS = [
  { id: 'goal', title: 'Goal', question: 'What do you want to automate?' },
  { id: 'trigger', title: 'Trigger', question: 'When should this run?' },
  { id: 'actions', title: 'Actions', question: 'What should happen?' },
  { id: 'ai', title: 'AI Settings', question: 'Should AI help make decisions?' },
  { id: 'safety', title: 'Safety', question: 'Safety settings' },
  { id: 'review', title: 'Review', question: 'Review your workflow' },
];

export const GuidedWizard = memo(({ onClose, onCreate }: GuidedWizardProps) => {
  const [state, setState] = useState<WizardState>({
    step: 0,
    triggerConfig: {
      pollInterval: 300,
    },
    selectedActions: [],
    actionConfigs: {},
    aiMode: 'suggest',
    aiPrompt: '',
    aiConfidence: 0.7,
    safety: {
      requireApproval: true,
      notifyOnTrigger: true,
      maxExecutions: 10,
    },
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStepConfig = STEPS[state.step];

  const canProceed = useCallback(() => {
    switch (state.step) {
      case 0: return !!state.goal;
      case 1: return !!state.triggerType;
      case 2: return state.selectedActions.length > 0;
      case 3: return true; // AI settings have defaults
      case 4: return true; // Safety settings have defaults
      case 5: return state.name.trim().length > 0;
      default: return false;
    }
  }, [state]);

  const handleNext = useCallback(() => {
    if (state.step < STEPS.length - 1 && canProceed()) {
      setState(prev => ({ ...prev, step: prev.step + 1 }));
    }
  }, [state.step, canProceed]);

  const handleBack = useCallback(() => {
    if (state.step > 0) {
      setState(prev => ({ ...prev, step: prev.step - 1 }));
    }
  }, [state.step]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Build the workflow payload
      const actions = state.selectedActions.map(actionId => {
        const action = ACTION_REGISTRY.find(a => a.id === actionId);
        const params = state.actionConfigs[actionId] || {};
        return {
          tool: actionId,
          params,
          requires_approval: action?.riskLevel === 'high' || state.safety.requireApproval,
        };
      });

      const payload: CreateWorkflowRequest = {
        name: state.name,
        description: state.description,
        trigger_type: state.triggerType!,
        splunk_query: state.triggerConfig.splunkQuery,
        schedule_cron: state.triggerConfig.scheduleCron,
        poll_interval_seconds: state.triggerConfig.pollInterval,
        actions,
        ai_enabled: state.aiMode !== 'none',
        ai_prompt: state.aiPrompt || `Analyze the trigger data and determine if action should be taken. Goal: ${state.goal}`,
        ai_confidence_threshold: state.aiConfidence,
        auto_execute_enabled: state.aiMode === 'auto',
        auto_execute_min_confidence: 0.9,
        auto_execute_max_risk: 'low' as RiskLevel,
      };

      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create workflow');
      }

      const workflow = await response.json();
      onCreate(workflow);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }, [state, onCreate, onClose]);

  const toggleAction = useCallback((actionId: string) => {
    setState(prev => ({
      ...prev,
      selectedActions: prev.selectedActions.includes(actionId)
        ? prev.selectedActions.filter(id => id !== actionId)
        : [...prev.selectedActions, actionId],
    }));
  }, []);

  // Render step content
  const renderStepContent = () => {
    switch (state.step) {
      case 0: // Goal
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {GOAL_OPTIONS.map(option => (
              <button
                key={option.id}
                onClick={() => setState(prev => ({ ...prev, goal: option.id }))}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  state.goal === option.id
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${option.bgColor}`}>
                    <option.icon className={`w-5 h-5 ${option.color}`} />
                  </div>
                  <span className="font-medium text-white">{option.label}</span>
                </div>
                <p className="text-sm text-slate-400">{option.description}</p>
              </button>
            ))}
          </div>
        );

      case 1: // Trigger
        return state.goal ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TRIGGER_OPTIONS[state.goal].map(option => (
                <button
                  key={option.id}
                  onClick={() => setState(prev => ({ ...prev, triggerType: option.id }))}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    state.triggerType === option.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <option.icon className="w-5 h-5 text-slate-400" />
                    <span className="font-medium text-white">{option.label}</span>
                  </div>
                  <p className="text-sm text-slate-400">{option.description}</p>
                </button>
              ))}
            </div>

            {state.triggerType === 'splunk_query' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">
                  Splunk Query (SPL)
                </label>
                <textarea
                  value={state.triggerConfig.splunkQuery || ''}
                  onChange={e => setState(prev => ({
                    ...prev,
                    triggerConfig: { ...prev.triggerConfig, splunkQuery: e.target.value }
                  }))}
                  placeholder="index=meraki sourcetype=events | ..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600
                           text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500
                           focus:border-transparent min-h-[80px]"
                />
                <p className="text-xs text-slate-500">
                  Enter a Splunk search query. The workflow will trigger when this query returns results.
                </p>
              </div>
            )}

            {state.triggerType === 'schedule' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">
                  Schedule (Cron Expression)
                </label>
                <input
                  type="text"
                  value={state.triggerConfig.scheduleCron || ''}
                  onChange={e => setState(prev => ({
                    ...prev,
                    triggerConfig: { ...prev.triggerConfig, scheduleCron: e.target.value }
                  }))}
                  placeholder="0 */6 * * *"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600
                           text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-xs text-slate-500">
                  Examples: <code>0 9 * * 1-5</code> (9am weekdays), <code>0 */6 * * *</code> (every 6 hours)
                </p>
              </div>
            )}
          </div>
        ) : null;

      case 2: // Actions
        return (
          <div className="space-y-6">
            <div className="grid gap-3">
              {ACTION_REGISTRY.map(action => (
                <button
                  key={action.id}
                  onClick={() => toggleAction(action.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    state.selectedActions.includes(action.id)
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{action.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{action.name}</span>
                          {!action.verified && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-500/20 text-amber-400">
                              Not Configured
                            </span>
                          )}
                          {action.riskLevel === 'high' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400">
                              High Risk
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">{action.description}</p>
                      </div>
                    </div>
                    {state.selectedActions.includes(action.id) && (
                      <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {state.selectedActions.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Info className="w-4 h-4" />
                  <span>{state.selectedActions.length} action(s) selected</span>
                </div>
              </div>
            )}
          </div>
        );

      case 3: // AI Settings
        return (
          <div className="space-y-6">
            <div className="grid gap-4">
              {AI_MODE_OPTIONS.map(option => (
                <button
                  key={option.id}
                  onClick={() => setState(prev => ({ ...prev, aiMode: option.id }))}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    state.aiMode === option.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <option.icon className="w-5 h-5 text-slate-400" />
                    <span className="font-medium text-white">{option.label}</span>
                    {option.recommended && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-500/20 text-emerald-400">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{option.description}</p>
                </button>
              ))}
            </div>

            {state.aiMode !== 'none' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-300">
                  AI Instructions (optional)
                </label>
                <textarea
                  value={state.aiPrompt}
                  onChange={e => setState(prev => ({ ...prev, aiPrompt: e.target.value }))}
                  placeholder="Analyze the network events and determine if intervention is needed..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600
                           text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500
                           focus:border-transparent min-h-[80px]"
                />
              </div>
            )}
          </div>
        );

      case 4: // Safety
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.safety.requireApproval}
                  onChange={e => setState(prev => ({
                    ...prev,
                    safety: { ...prev.safety, requireApproval: e.target.checked }
                  }))}
                  className="w-5 h-5 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-medium text-white">Require approval before acting</div>
                  <div className="text-sm text-slate-400">Actions will wait for your approval before executing</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.safety.notifyOnTrigger}
                  onChange={e => setState(prev => ({
                    ...prev,
                    safety: { ...prev.safety, notifyOnTrigger: e.target.checked }
                  }))}
                  className="w-5 h-5 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-medium text-white">Notify me when triggered</div>
                  <div className="text-sm text-slate-400">Get a notification each time this workflow triggers</div>
                </div>
              </label>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-200">
                  <strong>Safety Tip:</strong> For workflows with high-risk actions (like device reboots),
                  we recommend keeping approval enabled until you've verified the workflow works correctly.
                </div>
              </div>
            </div>
          </div>
        );

      case 5: // Review
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Workflow Name *
                </label>
                <input
                  type="text"
                  value={state.name}
                  onChange={e => setState(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., AP Flapping Detection"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600
                           text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={state.description}
                  onChange={e => setState(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What does this workflow do?"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600
                           text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 min-h-[60px]"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
              <h4 className="font-medium text-white">Summary</h4>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-slate-400">Goal:</div>
                <div className="text-white">{GOAL_OPTIONS.find(g => g.id === state.goal)?.label}</div>

                <div className="text-slate-400">Trigger:</div>
                <div className="text-white">
                  {state.triggerType === 'splunk_query' && 'Splunk Query'}
                  {state.triggerType === 'schedule' && 'Scheduled'}
                  {state.triggerType === 'manual' && 'Manual'}
                </div>

                <div className="text-slate-400">Actions:</div>
                <div className="text-white">{state.selectedActions.length} selected</div>

                <div className="text-slate-400">AI Mode:</div>
                <div className="text-white">{AI_MODE_OPTIONS.find(m => m.id === state.aiMode)?.label}</div>

                <div className="text-slate-400">Approval:</div>
                <div className="text-white">{state.safety.requireApproval ? 'Required' : 'Not required'}</div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Create Workflow</h2>
            <p className="text-sm text-slate-400">Step {state.step + 1} of {STEPS.length}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-slate-700">
          <div className="flex items-center gap-1">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div
                  className={`w-full h-1.5 rounded-full transition-colors ${
                    index < state.step
                      ? 'bg-cyan-500'
                      : index === state.step
                        ? 'bg-cyan-500/50'
                        : 'bg-slate-700'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="text-xl font-medium text-white mb-6">
            {currentStepConfig.question}
          </h3>
          <div className="max-h-[400px] overflow-y-auto pr-2">
            {renderStepContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={state.step === 0 ? onClose : handleBack}
            className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300
                     hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {state.step === 0 ? 'Cancel' : 'Back'}
          </button>

          {state.step < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500
                       transition-colors flex items-center gap-2 disabled:opacity-50
                       disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500
                       transition-colors flex items-center gap-2 disabled:opacity-50
                       disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Workflow'}
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

GuidedWizard.displayName = 'GuidedWizard';

export default GuidedWizard;
