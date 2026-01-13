'use client';

import { useEffect } from 'react';
import { useAISession } from '@/contexts/AISessionContext';

/** AI Session data structure for summary display */
export interface AISessionData {
  id?: number;
  name?: string;
  started_at?: string;
  ended_at?: string;
  status?: 'active' | 'completed' | 'abandoned';
  total_cost_usd?: number;
  total_tokens?: number;
  ai_query_count?: number;
  api_call_count?: number;
  navigation_count?: number;
  click_count?: number;
  edit_action_count?: number;
  ai_summary?: {
    outcome?: string;
    narrative?: string;
    milestones?: string[];
    insights?: string[];
    recommendations?: string[];
    metrics?: {
      duration_minutes?: number;
      total_cost_usd?: number;
      total_tokens?: number;
      ai_queries?: number;
      api_calls?: number;
      estimated_manual_time_minutes?: number;
    };
  };
}

interface AISessionSummaryCardProps {
  session?: AISessionData;
  onClose?: () => void;
  embedded?: boolean; // For displaying in the sessions list
}

export default function AISessionSummaryCard({ session: propSession, onClose, embedded = false }: AISessionSummaryCardProps) {
  const { completedSession, clearCompletedSession } = useAISession();
  const session = propSession || completedSession;

  useEffect(() => {
    if (!embedded && session) {
      // Close on Escape
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [session, embedded]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      clearCompletedSession();
    }
  };

  if (!session) return null;

  const summary = session.ai_summary || {};
  const metrics = summary.metrics || {
    duration_minutes: 0,
    total_cost_usd: session.total_cost_usd || 0,
    total_tokens: session.total_tokens || 0,
    ai_queries: session.ai_query_count || 0,
    api_calls: session.api_call_count || 0,
    estimated_manual_time_minutes: 0,
  };

  const timeSaved = metrics.estimated_manual_time_minutes - metrics.duration_minutes;
  const roi = metrics.duration_minutes > 0
    ? ((metrics.estimated_manual_time_minutes / metrics.duration_minutes - 1) * 100).toFixed(0)
    : 0;

  const CardContent = () => (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold theme-text-primary">Session Complete</h2>
            <p className="text-sm theme-text-muted">{session.name || 'AI Session'}</p>
          </div>
        </div>
        {!embedded && (
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-6 h-6 theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Outcome */}
      {summary.outcome && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
          <p className="text-lg font-semibold theme-text-primary">{summary.outcome}</p>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Duration</p>
          <p className="text-2xl font-bold theme-text-primary">{metrics.duration_minutes.toFixed(0)}m</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Cost</p>
          <p className="text-2xl font-bold text-cyan-500">${metrics.total_cost_usd.toFixed(4)}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Time Saved</p>
          <p className="text-2xl font-bold text-green-500">{timeSaved > 0 ? `${timeSaved.toFixed(0)}m` : '-'}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">ROI</p>
          <p className="text-2xl font-bold text-purple-500">{roi}%</p>
        </div>
      </div>

      {/* Activity Breakdown */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold theme-text-primary mb-3">Activity Breakdown</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
            <p className="text-xl font-bold theme-text-primary">{session.ai_query_count}</p>
            <p className="text-[10px] text-slate-500 uppercase">AI Queries</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
            <p className="text-xl font-bold theme-text-primary">{session.api_call_count}</p>
            <p className="text-[10px] text-slate-500 uppercase">API Calls</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
            <p className="text-xl font-bold theme-text-primary">{session.navigation_count}</p>
            <p className="text-[10px] text-slate-500 uppercase">Pages</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
            <p className="text-xl font-bold theme-text-primary">{session.click_count}</p>
            <p className="text-[10px] text-slate-500 uppercase">Clicks</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
            <p className="text-xl font-bold theme-text-primary">{session.edit_action_count}</p>
            <p className="text-[10px] text-slate-500 uppercase">Edits</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
            <p className="text-xl font-bold theme-text-primary">{((session.total_tokens || 0) / 1000).toFixed(1)}K</p>
            <p className="text-[10px] text-slate-500 uppercase">Tokens</p>
          </div>
        </div>
      </div>

      {/* Narrative */}
      {summary.narrative && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold theme-text-primary mb-2">Session Summary</h3>
          <p className="text-sm theme-text-secondary leading-relaxed">{summary.narrative}</p>
        </div>
      )}

      {/* Milestones */}
      {summary.milestones && summary.milestones.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold theme-text-primary mb-3">Key Milestones</h3>
          <div className="space-y-2">
            {summary.milestones.map((milestone: string, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm theme-text-secondary">{milestone}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {summary.insights && summary.insights.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold theme-text-primary mb-3">Insights</h3>
          <div className="space-y-2">
            {summary.insights.map((insight: string, idx: number) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-800 dark:text-amber-200">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {summary.recommendations && summary.recommendations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold theme-text-primary mb-3">Recommendations</h3>
          <div className="space-y-2">
            {summary.recommendations.map((rec: string, idx: number) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/20">
                <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-sm text-green-800 dark:text-green-200">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer with timestamp */}
      <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="text-xs theme-text-muted">
          {session.started_at && (
            <span>
              {new Date(session.started_at).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        {!embedded && (
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </>
  );

  // Full-screen modal for completion
  if (!embedded) {
    return (
      <>
        {/* Backdrop - z-[100] to ensure it's above all other elements including sidebars */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
          onClick={handleClose}
        />

        {/* Modal - z-[101] to be above the backdrop */}
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="w-full max-w-3xl max-h-[90vh] rounded-2xl border shadow-2xl overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <CardContent />
            </div>
          </div>
        </div>
      </>
    );
  }

  // Embedded card for session list - compact enterprise view
  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="p-4">
        {/* Compact Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold theme-text-primary truncate">{session.name || 'AI Session'}</h3>
            <p className="text-xs theme-text-muted">
              {session.started_at && new Date(session.started_at).toLocaleString()}
            </p>
          </div>
          {/* Quick metrics */}
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <p className="font-bold text-cyan-500">{metrics.duration_minutes.toFixed(0)}m</p>
              <p className="text-slate-500">Duration</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-emerald-500">{timeSaved > 0 ? `${timeSaved.toFixed(0)}m` : '-'}</p>
              <p className="text-slate-500">Saved</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-purple-500">{roi}%</p>
              <p className="text-slate-500">ROI</p>
            </div>
            <div className="text-center">
              <p className="font-bold theme-text-primary">${metrics.total_cost_usd.toFixed(4)}</p>
              <p className="text-slate-500">Cost</p>
            </div>
          </div>
        </div>

        {/* Outcome - if exists */}
        {summary.outcome && (
          <div className="mb-3 p-2.5 rounded-lg bg-gradient-to-r from-cyan-500/5 to-purple-500/5 border border-cyan-500/10">
            <p className="text-sm theme-text-primary">{summary.outcome}</p>
          </div>
        )}

        {/* Compact Activity Stats */}
        <div className="grid grid-cols-6 gap-2 mb-3">
          <div className="text-center p-2 rounded bg-slate-50 dark:bg-slate-800/30">
            <p className="text-sm font-bold theme-text-primary">{session.ai_query_count}</p>
            <p className="text-[9px] text-slate-500 uppercase">Queries</p>
          </div>
          <div className="text-center p-2 rounded bg-slate-50 dark:bg-slate-800/30">
            <p className="text-sm font-bold theme-text-primary">{session.api_call_count}</p>
            <p className="text-[9px] text-slate-500 uppercase">API</p>
          </div>
          <div className="text-center p-2 rounded bg-slate-50 dark:bg-slate-800/30">
            <p className="text-sm font-bold theme-text-primary">{session.navigation_count}</p>
            <p className="text-[9px] text-slate-500 uppercase">Pages</p>
          </div>
          <div className="text-center p-2 rounded bg-slate-50 dark:bg-slate-800/30">
            <p className="text-sm font-bold theme-text-primary">{session.click_count}</p>
            <p className="text-[9px] text-slate-500 uppercase">Clicks</p>
          </div>
          <div className="text-center p-2 rounded bg-slate-50 dark:bg-slate-800/30">
            <p className="text-sm font-bold theme-text-primary">{session.edit_action_count}</p>
            <p className="text-[9px] text-slate-500 uppercase">Edits</p>
          </div>
          <div className="text-center p-2 rounded bg-slate-50 dark:bg-slate-800/30">
            <p className="text-sm font-bold theme-text-primary">{((session.total_tokens || 0) / 1000).toFixed(1)}K</p>
            <p className="text-[9px] text-slate-500 uppercase">Tokens</p>
          </div>
        </div>

        {/* Narrative - compact */}
        {summary.narrative && (
          <div className="mb-3">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{summary.narrative}</p>
          </div>
        )}

        {/* Milestones & Insights in columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Milestones */}
          {summary.milestones && summary.milestones.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Milestones</p>
              <div className="space-y-1">
                {summary.milestones.slice(0, 4).map((milestone: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2">
                    <svg className="w-3 h-3 text-cyan-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-xs theme-text-secondary">{milestone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {summary.insights && summary.insights.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Insights</p>
              <div className="space-y-1">
                {summary.insights.slice(0, 3).map((insight: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 p-1.5 rounded bg-amber-50 dark:bg-amber-900/10">
                    <svg className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-800 dark:text-amber-200">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recommendations - compact */}
        {summary.recommendations && summary.recommendations.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Recommendations</p>
            <div className="space-y-1">
              {summary.recommendations.slice(0, 2).map((rec: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2 p-1.5 rounded bg-green-50 dark:bg-green-900/10">
                  <svg className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-xs text-green-800 dark:text-green-200">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
