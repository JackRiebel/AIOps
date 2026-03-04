'use client';

import { memo } from 'react';
import { Sparkles, RefreshCw, ChevronRight, ChevronDown, Loader2, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface AIInsightsCardProps {
  insights: string | null;
  loading: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onGenerate: () => void;
  onAskMore: () => void;
  className?: string;
}

export const AIInsightsCard = memo(({
  insights,
  loading,
  expanded,
  onToggleExpand,
  onGenerate,
  onAskMore,
  className = '',
}: AIInsightsCardProps) => {
  return (
    <div className={`rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden ${className}`}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
        className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-700/40"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">AI Network Analysis</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {loading ? 'Analyzing your network...' : insights ? 'AI-powered health assessment' : 'Generate AI-powered health analysis'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!insights && !loading && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
            >
              Generate
            </button>
          )}
          {loading && (
            <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
          />
        </div>
      </div>

      {/* Expandable Content */}
      {expanded && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-500/20 dark:to-indigo-500/20 flex items-center justify-center mb-3">
                <Loader2 className="w-6 h-6 text-purple-600 dark:text-purple-400 animate-spin" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Analyzing your network...</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This may take a few seconds</p>
            </div>
          ) : insights ? (
            <div>
              <div className="px-5 py-4">
                <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:text-slate-900 dark:prose-headings:text-white prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2 prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-li:text-slate-600 dark:prose-li:text-slate-300 prose-strong:text-slate-800 dark:prose-strong:text-slate-200 prose-ul:my-2 prose-li:my-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights}</ReactMarkdown>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/40">
                <button
                  onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onAskMore(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ask AI for more details
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <div className="w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-500/20 dark:to-indigo-500/20 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">No analysis yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4 max-w-[300px]">
                Generate an AI-powered analysis of your network health, identify issues, and get recommendations
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                Generate Analysis
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

AIInsightsCard.displayName = 'AIInsightsCard';

export default AIInsightsCard;
