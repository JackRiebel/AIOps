'use client';

import { memo, useState, useCallback } from 'react';
import {
  X,
  CheckCircle,
  AlertTriangle,
  CircleDashed,
  Clock,
  MessageSquare,
  Tag,
  Target,
  Users,
  Server,
  Lightbulb,
  Shield,
  Save,
  Loader2,
} from 'lucide-react';
import type { WorkflowExecution } from './types';

/**
 * OutcomeRecorder - Record the outcome of a completed workflow execution
 *
 * Part of Phase 4: Learning System - tracks whether actions resolved issues
 * for continuous improvement of workflow recommendations.
 */

export interface WorkflowOutcome {
  id?: number;
  execution_id: number;
  outcome: 'resolved' | 'partial' | 'failed' | 'unknown';
  resolution_time_minutes?: number;
  notes?: string;
  tags?: string[];
  affected_devices_count?: number;
  affected_users_count?: number;
  root_cause?: string;
  prevention_notes?: string;
  recorded_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface OutcomeRecorderProps {
  execution: WorkflowExecution;
  existingOutcome?: WorkflowOutcome | null;
  onSave: (outcome: Omit<WorkflowOutcome, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onClose: () => void;
}

const OUTCOME_OPTIONS = [
  {
    value: 'resolved' as const,
    label: 'Fully Resolved',
    description: 'Issue completely fixed by the workflow',
    icon: CheckCircle,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    selectedBg: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  {
    value: 'partial' as const,
    label: 'Partially Resolved',
    description: 'Issue improved but not fully fixed',
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    selectedBg: 'bg-amber-100 dark:bg-amber-900/40',
  },
  {
    value: 'failed' as const,
    label: 'Not Resolved',
    description: 'Action did not resolve the issue',
    icon: X,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    selectedBg: 'bg-red-100 dark:bg-red-900/40',
  },
  {
    value: 'unknown' as const,
    label: 'Unknown',
    description: 'Outcome cannot be determined',
    icon: CircleDashed,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-900/20',
    borderColor: 'border-slate-200 dark:border-slate-700',
    selectedBg: 'bg-slate-100 dark:bg-slate-800/40',
  },
];

const COMMON_TAGS = [
  'hardware-failure',
  'network-issue',
  'configuration-error',
  'user-error',
  'capacity-limit',
  'external-factor',
  'intermittent',
  'recurring',
];

export const OutcomeRecorder = memo(({
  execution,
  existingOutcome,
  onSave,
  onClose,
}: OutcomeRecorderProps) => {
  const [outcome, setOutcome] = useState<WorkflowOutcome['outcome']>(
    existingOutcome?.outcome || 'unknown'
  );
  const [resolutionTime, setResolutionTime] = useState<string>(
    existingOutcome?.resolution_time_minutes?.toString() || ''
  );
  const [notes, setNotes] = useState(existingOutcome?.notes || '');
  const [tags, setTags] = useState<string[]>(existingOutcome?.tags || []);
  const [affectedDevices, setAffectedDevices] = useState<string>(
    existingOutcome?.affected_devices_count?.toString() || ''
  );
  const [affectedUsers, setAffectedUsers] = useState<string>(
    existingOutcome?.affected_users_count?.toString() || ''
  );
  const [rootCause, setRootCause] = useState(existingOutcome?.root_cause || '');
  const [preventionNotes, setPreventionNotes] = useState(existingOutcome?.prevention_notes || '');
  const [customTag, setCustomTag] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = useCallback((tag: string) => {
    const normalizedTag = tag.toLowerCase().trim().replace(/\s+/g, '-');
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags(prev => [...prev, normalizedTag]);
    }
    setCustomTag('');
  }, [tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      const outcomeData: Omit<WorkflowOutcome, 'id' | 'created_at' | 'updated_at'> = {
        execution_id: execution.id,
        outcome,
        resolution_time_minutes: resolutionTime ? parseInt(resolutionTime) : undefined,
        notes: notes || undefined,
        tags: tags.length > 0 ? tags : undefined,
        affected_devices_count: affectedDevices ? parseInt(affectedDevices) : undefined,
        affected_users_count: affectedUsers ? parseInt(affectedUsers) : undefined,
        root_cause: rootCause || undefined,
        prevention_notes: preventionNotes || undefined,
      };

      await onSave(outcomeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save outcome');
    } finally {
      setIsSaving(false);
    }
  }, [
    execution.id,
    outcome,
    resolutionTime,
    notes,
    tags,
    affectedDevices,
    affectedUsers,
    rootCause,
    preventionNotes,
    onSave,
  ]);

  const selectedOption = OUTCOME_OPTIONS.find(o => o.value === outcome);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-cyan-50 dark:from-purple-900/20 dark:to-cyan-900/20">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
                <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Record Outcome
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  {execution.workflow?.name || `Execution #${execution.id}`}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-1 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Executed {execution.executed_at
                    ? new Date(execution.executed_at).toLocaleString()
                    : 'recently'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Outcome Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              How did this workflow execution perform?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {OUTCOME_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                const isSelected = outcome === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setOutcome(option.value)}
                    className={`
                      p-4 rounded-xl border-2 text-left transition-all
                      ${isSelected
                        ? `${option.selectedBg} ${option.borderColor} ring-2 ring-offset-2 ring-${option.value === 'resolved' ? 'emerald' : option.value === 'partial' ? 'amber' : option.value === 'failed' ? 'red' : 'slate'}-500/30`
                        : `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600`
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? option.bgColor : 'bg-slate-100 dark:bg-slate-700'}`}>
                        <IconComponent className={`w-5 h-5 ${isSelected ? option.color : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <div className={`font-medium ${isSelected ? option.color : 'text-slate-900 dark:text-white'}`}>
                          {option.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resolution Time */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Clock className="w-4 h-4" />
              Resolution Time (minutes)
            </label>
            <input
              type="number"
              value={resolutionTime}
              onChange={(e) => setResolutionTime(e.target.value)}
              placeholder="e.g., 15"
              min="0"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              How long after execution until the issue was resolved?
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Tag className="w-4 h-4" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="p-0.5 hover:bg-purple-200 dark:hover:bg-purple-800/50 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag(customTag)}
                placeholder="Add custom tag..."
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
              />
              <button
                onClick={() => handleAddTag(customTag)}
                disabled={!customTag.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMMON_TAGS.filter(t => !tags.includes(t)).map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <MessageSquare className="w-4 h-4" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any observations about this execution..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
          </div>

          {/* Advanced Section */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Lightbulb className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Fields (for learning)
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                {/* Impact Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Server className="w-4 h-4" />
                      Affected Devices
                    </label>
                    <input
                      type="number"
                      value={affectedDevices}
                      onChange={(e) => setAffectedDevices(e.target.value)}
                      placeholder="e.g., 5"
                      min="0"
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      <Users className="w-4 h-4" />
                      Affected Users
                    </label>
                    <input
                      type="number"
                      value={affectedUsers}
                      onChange={(e) => setAffectedUsers(e.target.value)}
                      placeholder="e.g., 50"
                      min="0"
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
                    />
                  </div>
                </div>

                {/* Root Cause */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    <Target className="w-4 h-4" />
                    Root Cause
                  </label>
                  <textarea
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    placeholder="What was the underlying cause of this issue?"
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none text-sm"
                  />
                </div>

                {/* Prevention Notes */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    <Shield className="w-4 h-4" />
                    Prevention Notes
                  </label>
                  <textarea
                    value={preventionNotes}
                    onChange={(e) => setPreventionNotes(e.target.value)}
                    placeholder="How can this issue be prevented in the future?"
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {/* Preview of selected outcome */}
              {selectedOption && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${selectedOption.bgColor}`}>
                  <selectedOption.icon className={`w-4 h-4 ${selectedOption.color}`} />
                  <span className={`text-sm font-medium ${selectedOption.color}`}>
                    {selectedOption.label}
                  </span>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? 'Saving...' : existingOutcome ? 'Update Outcome' : 'Save Outcome'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

OutcomeRecorder.displayName = 'OutcomeRecorder';

export default OutcomeRecorder;
