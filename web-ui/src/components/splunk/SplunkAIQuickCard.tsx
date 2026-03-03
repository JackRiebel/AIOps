'use client';

import { memo, useState, useCallback } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface SplunkAIQuickCardProps {
  saiaAvailable: boolean;
  loading: boolean;
  answer: string | null;
  onAsk: (question: string) => Promise<void>;
}

// ============================================================================
// Component
// ============================================================================

export const SplunkAIQuickCard = memo(({
  saiaAvailable,
  loading,
  answer,
  onAsk,
}: SplunkAIQuickCardProps) => {
  const [question, setQuestion] = useState('');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    await onAsk(question.trim());
  }, [question, loading, onAsk]);

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Bot className="w-4 h-4 text-purple-500" />
        Quick Ask
      </h3>

      {!saiaAvailable ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Install Splunk AI Assistant from Splunkbase to enable AI-powered questions.
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask a Splunk question..."
              disabled={loading}
              className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="p-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition disabled:opacity-50 disabled:hover:bg-purple-500"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>

          {answer && (
            <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-100 dark:border-purple-500/20">
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{answer}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
});

SplunkAIQuickCard.displayName = 'SplunkAIQuickCard';
export default SplunkAIQuickCard;
