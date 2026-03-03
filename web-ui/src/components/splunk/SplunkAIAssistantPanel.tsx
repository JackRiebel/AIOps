'use client';

import { memo, useState, useCallback } from 'react';
import {
  Bot,
  Send,
  Wand2,
  FileText,
  Zap,
  Loader2,
  AlertCircle,
  Copy,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface SplunkAIAssistantPanelProps {
  saiaAvailable: boolean;
  loading: boolean;
  answer: string | null;
  generatedSpl: string | null;
  splExplanation: string | null;
  optimizedSpl: string | null;
  onAsk: (question: string) => Promise<void>;
  onGenerateSpl: (prompt: string) => Promise<void>;
  onExplainSpl: (spl: string) => Promise<void>;
  onOptimizeSpl: (spl: string) => Promise<void>;
}

// ============================================================================
// Section Component
// ============================================================================

function AISection({
  icon: Icon,
  title,
  placeholder,
  buttonLabel,
  onSubmit,
  result,
  loading,
  disabled,
  isCode,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  placeholder: string;
  buttonLabel: string;
  onSubmit: (value: string) => Promise<void>;
  result: string | null;
  loading: boolean;
  disabled: boolean;
  isCode?: boolean;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || loading) return;
    await onSubmit(value.trim());
  }, [value, loading, onSubmit]);

  const copyResult = useCallback(() => {
    if (result) navigator.clipboard.writeText(result);
  }, [result]);

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Icon className="w-4 h-4 text-purple-500" />
        {title}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || loading}
          rows={isCode ? 4 : 2}
          className={`w-full px-3 py-2 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none transition disabled:opacity-50 ${
            isCode
              ? 'bg-slate-900 dark:bg-slate-950 text-green-400 font-mono'
              : 'bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white'
          }`}
        />
        <button
          type="submit"
          disabled={disabled || loading || !value.trim()}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:hover:bg-purple-500 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {buttonLabel}
        </button>
      </form>

      {result && (
        <div className="relative">
          <button
            onClick={copyResult}
            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Copy"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {isCode ? (
            <pre className="p-3 bg-slate-900 dark:bg-slate-950 rounded-lg text-sm text-green-400 font-mono whitespace-pre-wrap border border-slate-700 pr-8">
              {result}
            </pre>
          ) : (
            <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-200 dark:border-purple-500/20 pr-8">
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{result}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const SplunkAIAssistantPanel = memo(({
  saiaAvailable,
  loading,
  answer,
  generatedSpl,
  splExplanation,
  optimizedSpl,
  onAsk,
  onGenerateSpl,
  onExplainSpl,
  onOptimizeSpl,
}: SplunkAIAssistantPanelProps) => {
  if (!saiaAvailable) {
    return (
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Splunk AI Assistant Not Available</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 max-w-md mx-auto">
          Install the Splunk AI Assistant from Splunkbase to enable AI-powered SPL generation, optimization, explanation, and question answering.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AISection
        icon={Bot}
        title="Ask Splunk"
        placeholder="Ask a question about your Splunk environment..."
        buttonLabel="Ask"
        onSubmit={onAsk}
        result={answer}
        loading={loading}
        disabled={false}
      />
      <AISection
        icon={Wand2}
        title="Generate SPL"
        placeholder="Describe what you want to search for..."
        buttonLabel="Generate"
        onSubmit={onGenerateSpl}
        result={generatedSpl}
        loading={loading}
        disabled={false}
        isCode
      />
      <AISection
        icon={FileText}
        title="Explain SPL"
        placeholder="Paste an SPL query to explain..."
        buttonLabel="Explain"
        onSubmit={onExplainSpl}
        result={splExplanation}
        loading={loading}
        disabled={false}
        isCode
      />
      <AISection
        icon={Zap}
        title="Optimize SPL"
        placeholder="Paste an SPL query to optimize..."
        buttonLabel="Optimize"
        onSubmit={onOptimizeSpl}
        result={optimizedSpl}
        loading={loading}
        disabled={false}
        isCode
      />
    </div>
  );
});

SplunkAIAssistantPanel.displayName = 'SplunkAIAssistantPanel';
export default SplunkAIAssistantPanel;
