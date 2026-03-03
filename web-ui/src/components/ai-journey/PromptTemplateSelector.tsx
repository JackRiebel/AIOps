'use client';

import { memo, useState, useCallback } from 'react';
import { Star, Plus, ChevronDown, Loader2, X } from 'lucide-react';
import { usePromptTemplates } from './hooks/usePromptTemplates';
import type { PromptTemplate, AssertionRule } from '@/types/ai-quality';

// ============================================================================
// Types
// ============================================================================

export interface PromptTemplateSelectorProps {
  provider: string;
  onSelect: (template: PromptTemplate) => void;
}

// ============================================================================
// Constants
// ============================================================================

const ASSERTION_TYPES = [
  { value: 'status_code', label: 'Status Code' },
  { value: 'response_contains', label: 'Response Contains' },
  { value: 'response_time_lt', label: 'Response Time <' },
  { value: 'json_path', label: 'JSON Path' },
];

const ASSERTION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'matches_regex', label: 'Matches Regex' },
];

// ============================================================================
// Component
// ============================================================================

export const PromptTemplateSelector = memo(({ provider, onSelect }: PromptTemplateSelectorProps) => {
  const { templates, loading, createTemplate } = usePromptTemplates();

  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [modelId, setModelId] = useState('');
  const [assertions, setAssertions] = useState<AssertionRule[]>([]);

  // New assertion state
  const [newType, setNewType] = useState('status_code');
  const [newOperator, setNewOperator] = useState('equals');
  const [newTarget, setNewTarget] = useState('');
  const [newExpected, setNewExpected] = useState('');

  const filteredTemplates = templates.filter(
    (t) => t.provider === provider || t.provider === '*'
  );

  const handleAddAssertion = useCallback(() => {
    if (!newExpected.trim()) return;
    setAssertions((prev) => [
      ...prev,
      {
        type: newType,
        target: newTarget || newType,
        operator: newOperator,
        expected: newExpected.trim(),
      },
    ]);
    setNewExpected('');
    setNewTarget('');
  }, [newType, newOperator, newTarget, newExpected]);

  const handleRemoveAssertion = useCallback((idx: number) => {
    setAssertions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !promptText.trim()) return;
    setCreating(true);
    const success = await createTemplate({
      name: name.trim(),
      provider,
      prompt_text: promptText.trim(),
      model_id: modelId.trim() || undefined,
      assertions,
    });
    setCreating(false);
    if (success) {
      setName('');
      setPromptText('');
      setModelId('');
      setAssertions([]);
      setShowForm(false);
    }
  }, [name, promptText, modelId, assertions, provider, createTemplate]);

  const handleSelect = useCallback(
    (template: PromptTemplate) => {
      onSelect(template);
      setIsOpen(false);
    },
    [onSelect]
  );

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
      <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Prompt Templates
      </h3>

      {/* Dropdown trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/40 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
      >
        <span>{loading ? 'Loading templates...' : `${filteredTemplates.length} template${filteredTemplates.length !== 1 ? 's' : ''} available`}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown list */}
      {isOpen && (
        <div className="mt-2 max-h-[240px] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/60 divide-y divide-slate-100 dark:divide-slate-700/30">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
              No templates for this provider
            </div>
          ) : (
            filteredTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors"
              >
                {t.is_builtin && (
                  <Star className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium text-slate-800 dark:text-slate-200 truncate">
                      {t.name}
                    </span>
                    {t.model_id && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-mono">
                        {t.model_id}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {t.prompt_text.slice(0, 80)}{t.prompt_text.length > 80 ? '...' : ''}
                  </p>
                  {t.assertions.length > 0 && (
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {t.assertions.length} assertion{t.assertions.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* New Template toggle */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
      >
        <Plus className="w-3 h-3" />
        {showForm ? 'Cancel' : 'New Template'}
      </button>

      {/* Create form */}
      {showForm && (
        <div className="mt-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GPT-4 latency check"
              className="w-full px-3 py-1.5 text-[12px] bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>

          {/* Prompt text */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Prompt Text
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter the prompt to test..."
              rows={3}
              className="w-full px-3 py-1.5 text-[12px] bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
            />
          </div>

          {/* Model ID (optional) */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Model ID <span className="font-normal normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. gpt-4, claude-3-opus"
              className="w-full px-3 py-1.5 text-[12px] bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>

          {/* Assertions */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              Assertions
            </label>

            {/* Existing assertions */}
            {assertions.length > 0 && (
              <div className="space-y-1 mb-2">
                {assertions.map((a, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2 py-1 rounded bg-white dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/30 text-[10px]"
                  >
                    <span className="text-slate-500 dark:text-slate-400">{a.type}</span>
                    <span className="text-slate-300 dark:text-slate-600">{a.operator}</span>
                    <span className="text-slate-700 dark:text-slate-300 font-mono">{a.expected}</span>
                    <button
                      onClick={() => handleRemoveAssertion(idx)}
                      className="ml-auto p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add assertion row */}
            <div className="flex items-end gap-1.5">
              <div className="flex-1">
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-2 py-1.5 text-[11px] bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                >
                  {ASSERTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <select
                  value={newOperator}
                  onChange={(e) => setNewOperator(e.target.value)}
                  className="w-full px-2 py-1.5 text-[11px] bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                >
                  {ASSERTION_OPERATORS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={newExpected}
                  onChange={(e) => setNewExpected(e.target.value)}
                  placeholder="Expected"
                  className="w-full px-2 py-1.5 text-[11px] bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAssertion();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleAddAssertion}
                disabled={!newExpected.trim()}
                className="px-2 py-1.5 text-[11px] bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !promptText.trim()}
            className="w-full px-4 py-2 text-[12px] font-medium rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Template'
            )}
          </button>
        </div>
      )}
    </div>
  );
});

PromptTemplateSelector.displayName = 'PromptTemplateSelector';
export default PromptTemplateSelector;
