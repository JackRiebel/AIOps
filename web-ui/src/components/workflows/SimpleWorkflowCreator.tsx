'use client';

import { memo, useState, useCallback, useMemo } from 'react';
import {
  X,
  WifiOff,
  Activity,
  Shield,
  Lock,
  Download,
  Clock,
  Calendar,
  CalendarDays,
  Play,
  MessageSquare,
  Mail,
  Users,
  RefreshCw,
  FileText,
  AlertCircle,
  Power,
  Ban,
  Gauge,
  Sparkles,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Bell,
  Wrench,
  Search,
  Settings,
  Globe,
  RotateCcw,
  ArrowRightLeft,
  ShieldOff,
  Radio,
  Route,
  Database,
  FileJson,
  FileBarChart,
  Save,
  FileCode,
  History,
  Network,
  Plug,
  Zap,
} from 'lucide-react';
import {
  TRIGGER_PRESETS,
  ACTION_PRESETS,
  ACTION_CATEGORIES,
  getTriggerPreset,
  getActionPreset,
  getActionsByCategory,
  buildSplunkQuery,
  type TriggerPreset,
  type ActionPreset,
  type ActionCategory,
  type QuickStartTemplate,
} from './triggerPresets';
import type { CreateWorkflowRequest } from './types';

/**
 * SimpleWorkflowCreator - One-page simplified workflow creation
 *
 * Designed for users who don't know Splunk queries or cron expressions.
 * Maps friendly labels to technical configurations.
 */

export interface SimpleWorkflowCreatorProps {
  onClose: () => void;
  onCreate: (workflow: CreateWorkflowRequest) => Promise<void>;
  initialTemplate?: QuickStartTemplate;
  onSwitchToAdvanced?: () => void;
}

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  WifiOff,
  Activity,
  Shield,
  Lock,
  Download,
  Clock,
  Calendar,
  CalendarDays,
  Play,
  MessageSquare,
  Mail,
  Users,
  RefreshCw,
  FileText,
  AlertCircle,
  Power,
  Ban,
  Gauge,
  Bell,
  Wrench,
  Search,
  Settings,
  Globe,
  RotateCcw,
  ArrowRightLeft,
  ShieldOff,
  Radio,
  Route,
  Database,
  FileJson,
  FileBarChart,
  Save,
  FileCode,
  History,
  Network,
  Plug,
};

interface TriggerSelectorProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  thresholdValue?: number;
  onThresholdChange?: (value: number) => void;
}

const TriggerSelector = memo(({
  selectedId,
  onSelect,
  thresholdValue,
  onThresholdChange,
}: TriggerSelectorProps) => {
  const selectedPreset = selectedId ? getTriggerPreset(selectedId) : null;

  return (
    <div className="space-y-2">
      {TRIGGER_PRESETS.map((preset) => {
        const IconComponent = ICON_MAP[preset.icon] || Activity;
        const isSelected = selectedId === preset.id;

        return (
          <div key={preset.id}>
            <button
              type="button"
              onClick={() => onSelect(preset.id)}
              className={`
                w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left
                ${isSelected
                  ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }
              `}
            >
              <div className={`
                w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center
                ${isSelected
                  ? 'border-cyan-500 bg-cyan-500'
                  : 'border-slate-300 dark:border-slate-500'
                }
              `}>
                {isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <IconComponent className={`w-4 h-4 ${isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    {preset.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  {preset.description}
                </p>
              </div>
            </button>

            {/* Threshold configuration for selected preset */}
            {isSelected && selectedPreset?.configurable && onThresholdChange && (
              <div className="ml-7 mt-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {selectedPreset.configurable.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={thresholdValue ?? selectedPreset.configurable.default}
                    onChange={(e) => onThresholdChange(Number(e.target.value))}
                    min={selectedPreset.configurable.min}
                    max={selectedPreset.configurable.max}
                    className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedPreset.configurable.unit}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

TriggerSelector.displayName = 'TriggerSelector';

// Collapsible Action Section Component
interface CollapsibleActionSectionProps {
  categoryId: ActionCategory;
  label: string;
  icon: string;
  description: string;
  defaultExpanded: boolean;
  selectedIds: string[];
  onToggle: (id: string) => void;
}

const CollapsibleActionSection = memo(({
  categoryId,
  label,
  icon,
  description,
  defaultExpanded,
  selectedIds,
  onToggle,
}: CollapsibleActionSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const actions = getActionsByCategory(categoryId);
  const selectedCount = actions.filter(a => selectedIds.includes(a.id)).length;
  const IconComponent = ICON_MAP[icon] || Settings;

  return (
    <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <IconComponent className="w-4 h-4 text-slate-500" />
          <div className="text-left">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {label}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
              ({actions.length})
            </span>
          </div>
          {selectedCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded-full">
              {selectedCount} selected
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="p-3 space-y-2">
          {actions.map((preset) => {
            const ActionIcon = ICON_MAP[preset.icon] || AlertCircle;
            const isSelected = selectedIds.includes(preset.id);

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onToggle(preset.id)}
                className={`
                  w-full flex items-start gap-3 p-2.5 rounded-lg border transition-all text-left
                  ${isSelected
                    ? preset.requiresApproval
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                  }
                `}
              >
                <div className={`
                  w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center
                  ${isSelected
                    ? preset.requiresApproval
                      ? 'border-amber-500 bg-amber-500'
                      : 'border-emerald-500 bg-emerald-500'
                    : 'border-slate-300 dark:border-slate-500'
                  }
                `}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActionIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`} />
                    <span className={`text-sm ${isSelected ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                      {preset.label}
                    </span>
                    {preset.requiresApproval && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                        Approval
                      </span>
                    )}
                  </div>
                  {isSelected && preset.warning && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      {preset.warning}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

CollapsibleActionSection.displayName = 'CollapsibleActionSection';

export const SimpleWorkflowCreator = memo(({
  onClose,
  onCreate,
  initialTemplate,
  onSwitchToAdvanced,
}: SimpleWorkflowCreatorProps) => {
  // Form state
  const [name, setName] = useState(initialTemplate?.name || '');
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(
    initialTemplate?.triggerId || null
  );
  const [thresholdValue, setThresholdValue] = useState<number | undefined>(undefined);
  const [selectedActions, setSelectedActions] = useState<string[]>(
    initialTemplate?.actionIds || []
  );
  const [aiEnabled, setAiEnabled] = useState(initialTemplate?.aiEnabled ?? true);
  const [aiConfidence, setAiConfidence] = useState(70);
  const [autoExecuteEnabled, setAutoExecuteEnabled] = useState(false);
  const [autoExecuteMinConfidence, setAutoExecuteMinConfidence] = useState(90);
  const [autoExecuteMaxRisk, setAutoExecuteMaxRisk] = useState<'low' | 'medium'>('low');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle action selection
  const handleActionToggle = useCallback((actionId: string) => {
    setSelectedActions((prev) =>
      prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [...prev, actionId]
    );
  }, []);

  // Check if any selected actions require approval
  const hasApprovalRequired = useMemo(() => {
    return selectedActions.some((id) => {
      const preset = getActionPreset(id);
      return preset?.requiresApproval;
    });
  }, [selectedActions]);

  // Build workflow request from form state
  const buildWorkflowRequest = useCallback((): CreateWorkflowRequest | null => {
    if (!name.trim()) {
      setError('Please enter a workflow name');
      return null;
    }
    if (!selectedTrigger) {
      setError('Please select a trigger');
      return null;
    }
    if (selectedActions.length === 0) {
      setError('Please select at least one action');
      return null;
    }

    const triggerPreset = getTriggerPreset(selectedTrigger);
    if (!triggerPreset) return null;

    // Build actions array
    const actions = selectedActions
      .map((id) => getActionPreset(id))
      .filter((a): a is ActionPreset => a !== null)
      .map((preset) => ({
        tool: preset.tool,
        params: preset.params || {},
        requires_approval: preset.requiresApproval,
      }));

    const request: CreateWorkflowRequest = {
      name: name.trim(),
      trigger_type: triggerPreset.type,
      ai_enabled: aiEnabled,
      ai_confidence_threshold: aiConfidence / 100,
      actions,
      auto_execute_enabled: autoExecuteEnabled,
      auto_execute_min_confidence: autoExecuteMinConfidence / 100,
      auto_execute_max_risk: autoExecuteMaxRisk,
    };

    // Add trigger-specific fields
    if (triggerPreset.type === 'splunk_query' && triggerPreset.query) {
      request.splunk_query = buildSplunkQuery(triggerPreset, thresholdValue);
    }
    if (triggerPreset.type === 'schedule' && triggerPreset.cron) {
      request.schedule_cron = triggerPreset.cron;
    }

    return request;
  }, [name, selectedTrigger, selectedActions, aiEnabled, aiConfidence, thresholdValue, autoExecuteEnabled, autoExecuteMinConfidence, autoExecuteMaxRisk]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    setError(null);
    const request = buildWorkflowRequest();
    if (!request) return;

    setIsSubmitting(true);
    try {
      await onCreate(request);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setIsSubmitting(false);
    }
  }, [buildWorkflowRequest, onCreate, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Create a Workflow
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Simple mode - no technical knowledge required
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onSwitchToAdvanced && (
              <button
                onClick={onSwitchToAdvanced}
                className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                Advanced Mode
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Workflow Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Workflow Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Device Offline Alert"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Trigger Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              When this happens
            </h3>
            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg p-3">
              <TriggerSelector
                selectedId={selectedTrigger}
                onSelect={setSelectedTrigger}
                thresholdValue={thresholdValue}
                onThresholdChange={setThresholdValue}
              />
            </div>
          </div>

          {/* Actions Section - Collapsible Categories */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Do this
            </h3>
            <div className="space-y-2">
              {ACTION_CATEGORIES.map((category) => (
                <CollapsibleActionSection
                  key={category.id}
                  categoryId={category.id}
                  label={category.label}
                  icon={category.icon}
                  description={category.description}
                  defaultExpanded={category.defaultExpanded}
                  selectedIds={selectedActions}
                  onToggle={handleActionToggle}
                />
              ))}
            </div>
          </div>

          {/* AI Settings */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              AI Settings
            </h3>
            <div className="space-y-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
              {/* AI Enable toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Let AI analyze events before acting
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiEnabled(!aiEnabled)}
                  className={`
                    relative w-11 h-6 rounded-full transition-colors
                    ${aiEnabled ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                      ${aiEnabled ? 'translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>

              {/* Confidence slider */}
              {aiEnabled && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Confidence threshold
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {aiConfidence}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={aiConfidence}
                    onChange={(e) => setAiConfidence(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-purple-500"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    AI must be at least {aiConfidence}% confident to recommend actions
                  </p>
                </div>
              )}

              {/* Auto-Execute Section */}
              {aiEnabled && (
                <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <div>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Auto-Execute Actions
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Allow AI to automatically execute without approval
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoExecuteEnabled(!autoExecuteEnabled)}
                      className={`
                        relative w-11 h-6 rounded-full transition-colors
                        ${autoExecuteEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}
                      `}
                    >
                      <span
                        className={`
                          absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                          ${autoExecuteEnabled ? 'translate-x-5' : 'translate-x-0'}
                        `}
                      />
                    </button>
                  </div>

                  {autoExecuteEnabled && (
                    <div className="mt-4 space-y-4">
                      {/* Auto-execute confidence threshold */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Minimum confidence for auto-execute
                          </span>
                          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                            {autoExecuteMinConfidence}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={70}
                          max={100}
                          value={autoExecuteMinConfidence}
                          onChange={(e) => setAutoExecuteMinConfidence(Number(e.target.value))}
                          className="w-full h-2 bg-purple-100 dark:bg-purple-900/50 rounded-full appearance-none cursor-pointer accent-purple-600"
                        />
                      </div>

                      {/* Maximum risk level */}
                      <div>
                        <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">
                          Maximum risk level for auto-execute
                        </label>
                        <select
                          value={autoExecuteMaxRisk}
                          onChange={(e) => setAutoExecuteMaxRisk(e.target.value as 'low' | 'medium')}
                          className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                        >
                          <option value="low">Low risk only</option>
                          <option value="medium">Low and Medium risk</option>
                        </select>
                      </div>

                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        High-risk actions always require manual approval
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Approval Warning */}
          {hasApprovalRequired && !autoExecuteEnabled && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-300">
                    Approval Required
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    Some selected actions require manual approval before execution.
                    You&apos;ll be notified when the workflow triggers and can review
                    the AI&apos;s analysis before approving.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim() || !selectedTrigger || selectedActions.length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-600 text-white font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Workflow
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

SimpleWorkflowCreator.displayName = 'SimpleWorkflowCreator';

export default SimpleWorkflowCreator;
