'use client';

import { useEffect, useState } from 'react';
import { History, ThumbsUp, ThumbsDown, Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { QueryHistoryItem } from './types';

interface QueryHistoryProps {
  datasetId: number | null;
}

export function QueryHistory({ datasetId }: QueryHistoryProps) {
  const [queries, setQueries] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!datasetId) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/structured-data/datasets/${datasetId}/queries?limit=50`);
      if (resp.ok) {
        setQueries(await resp.json());
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchHistory(); }, [datasetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitFeedback = async (queryId: number, feedback: string) => {
    try {
      const resp = await fetch(`/api/structured-data/queries/${queryId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      if (resp.ok) {
        setQueries(qs => qs.map(q => q.id === queryId ? { ...q, feedback } : q));
      }
    } catch { /* ignore */ }
  };

  if (!datasetId) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-8 text-center">
        <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Select a dataset to view query history</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (queries.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-8 text-center">
        <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">No queries yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {queries.map((q) => (
        <div key={q.id} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-900 dark:text-white mb-1">{q.natural_language}</p>
              <pre className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 rounded p-2 overflow-x-auto whitespace-pre-wrap mb-2">
                {q.generated_sql}
              </pre>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                {q.was_executed ? (
                  q.error_message ? (
                    <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" /> Error</span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3 h-3" /> {q.row_count} rows, {q.execution_time_ms}ms</span>
                  )
                ) : (
                  <span className="flex items-center gap-1"><Play className="w-3 h-3" /> Not executed</span>
                )}
                {q.llm_provider && <span>{q.llm_provider}/{q.llm_model}</span>}
                <span>{new Date(q.created_at).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => submitFeedback(q.id, 'good')}
                className={`p-1.5 rounded-md transition-colors ${
                  q.feedback === 'good'
                    ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'text-slate-300 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                }`}
                title="Good query"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => submitFeedback(q.id, 'bad')}
                className={`p-1.5 rounded-md transition-colors ${
                  q.feedback === 'bad'
                    ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'text-slate-300 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                }`}
                title="Bad query"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
