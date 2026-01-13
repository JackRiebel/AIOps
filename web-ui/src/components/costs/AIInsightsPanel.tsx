'use client';

import { memo } from 'react';
import { Sparkles, ChevronDown, RefreshCw, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============================================================================
// Types
// ============================================================================

export interface AIInsightsPanelProps {
  insights: string | null;
  loading: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onAnalyze: () => void;
  className?: string;
}

// ============================================================================
// AIInsightsPanel Component
// ============================================================================

export const AIInsightsPanel = memo(({
  insights,
  loading,
  expanded,
  onToggleExpand,
  onAnalyze,
  className = '',
}: AIInsightsPanelProps) => {
  return (
    <div
      className={`bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 rounded-xl border border-emerald-200 dark:border-emerald-500/30 overflow-hidden shadow-sm ${className}`}
    >
      {/* Header */}
      <div
        onClick={onToggleExpand}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggleExpand();
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              AI Cost Optimization Insights
            </h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              AI-powered analysis and recommendations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!insights && !loading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAnalyze();
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Analyze Costs
            </button>
          )}
          <ChevronDown
            className={`w-5 h-5 text-emerald-500 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
                  Analyzing your AI spending...
                </p>
              </div>
            </div>
          ) : insights ? (
            <div className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-emerald-100 dark:border-emerald-500/20">
              <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:text-emerald-900 dark:prose-headings:text-emerald-100 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2 prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-strong:text-emerald-800 dark:prose-strong:text-emerald-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights}</ReactMarkdown>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-500/20 flex items-center justify-between">
                <button
                  onClick={onAnalyze}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Analysis
                </button>
                <span className="text-xs text-emerald-500 dark:text-emerald-400/70">
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  AI-generated recommendations
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-emerald-600 dark:text-emerald-400 text-sm">
              <p>Click &quot;Analyze Costs&quot; to get AI-powered cost optimization insights.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

AIInsightsPanel.displayName = 'AIInsightsPanel';

export default AIInsightsPanel;
