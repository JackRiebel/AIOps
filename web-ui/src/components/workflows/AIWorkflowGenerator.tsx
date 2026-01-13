'use client';

import { memo, useState, useCallback } from 'react';
import {
  X,
  Sparkles,
  Wand2,
  Send,
  Loader2,
  AlertCircle,
  Lightbulb,
  ArrowLeft,
} from 'lucide-react';
import { GeneratedWorkflowPreview } from './GeneratedWorkflowPreview';
import type { CreateWorkflowRequest } from './types';

/**
 * AIWorkflowGenerator - Generate workflows from natural language descriptions
 *
 * Uses Claude to parse user intent and generate a structured workflow configuration.
 * Shows a preview before creation and allows editing.
 */

export interface AIWorkflowGeneratorProps {
  onClose: () => void;
  onCreate: (workflow: CreateWorkflowRequest) => Promise<void>;
  isCreating?: boolean;
}

interface GenerationResult {
  workflow: CreateWorkflowRequest;
  confidence: number;
  explanation: string;
}

// Example prompts to help users get started
const EXAMPLE_PROMPTS = [
  "Notify me on Slack when any device goes offline for more than 5 minutes",
  "Send a daily report of network health to my email every morning at 8 AM",
  "Alert me about security events and automatically collect diagnostics",
  "Monitor high latency and create an incident ticket if it persists",
];

export const AIWorkflowGenerator = memo(({
  onClose,
  onCreate,
  isCreating = false,
}: AIWorkflowGeneratorProps) => {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/workflows/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to generate workflow');
      }

      const result: GenerationResult = await response.json();
      setGenerationResult(result);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate workflow');
    } finally {
      setIsGenerating(false);
    }
  }, [description]);

  const handleExampleClick = useCallback((example: string) => {
    setDescription(example);
    setError(null);
    setGenerationResult(null);
    setShowPreview(false);
  }, []);

  const handleEdit = useCallback(() => {
    setShowPreview(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!generationResult) return;
    await onCreate(generationResult.workflow);
  }, [generationResult, onCreate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating && description.trim()) {
      handleGenerate();
    }
  }, [handleGenerate, isGenerating, description]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {showPreview && (
                <button
                  onClick={handleEdit}
                  className="p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
              )}
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {showPreview ? 'Review Generated Workflow' : 'AI Workflow Generator'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {showPreview ? 'Review and confirm the generated workflow' : 'Describe what you want to automate in plain English'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {showPreview && generationResult ? (
            <GeneratedWorkflowPreview
              workflow={generationResult.workflow}
              confidence={generationResult.confidence}
              explanation={generationResult.explanation}
              onEdit={handleEdit}
              onCreate={handleCreate}
              isCreating={isCreating}
            />
          ) : (
            <div className="space-y-6">
              {/* Text area */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  What would you like to automate?
                </label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., Send me a Slack notification whenever a device goes offline, and if it stays offline for more than 10 minutes, automatically create an incident ticket..."
                    className="w-full h-40 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent text-slate-900 dark:text-white placeholder:text-slate-400"
                    autoFocus
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-slate-400">
                    {description.length > 0 && (
                      <span>⌘ + Enter to generate</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-300">
                      Generation Failed
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {/* Example prompts */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Try an example
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {EXAMPLE_PROMPTS.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleClick(example)}
                      className="text-left p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-400 transition-colors"
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    How it works
                  </span>
                </div>
                <ul className="text-sm text-purple-600 dark:text-purple-400 space-y-1 ml-6 list-disc">
                  <li>Describe your automation goal in plain English</li>
                  <li>AI will parse your intent and suggest a workflow configuration</li>
                  <li>Review and customize the generated workflow</li>
                  <li>Create with one click</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer (only in input mode) */}
        {!showPreview && (
          <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!description.trim() || isGenerating}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/25"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Workflow
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

AIWorkflowGenerator.displayName = 'AIWorkflowGenerator';

export default AIWorkflowGenerator;
