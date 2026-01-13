'use client';

import { memo } from 'react';
import { X, Sparkles, Code2, Search, RefreshCw, Loader2 } from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import type { SplunkInsight } from './types';

// ============================================================================
// Types
// ============================================================================

export interface InvestigationModalProps {
  insight: SplunkInsight;
  investigation: string | null;
  isInvestigating: boolean;
  onClose: () => void;
  onInvestigate: () => void;
  onGetSPL: () => void;
  onFindSimilar: () => void;
}

// ============================================================================
// InvestigationModal Component
// ============================================================================

export const InvestigationModal = memo(({
  insight,
  investigation,
  isInvestigating,
  onClose,
  onInvestigate,
  onGetSPL,
  onFindSimilar,
}: InvestigationModalProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-4xl w-full max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={insight.severity} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">
              {insight.title}
            </h3>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded text-xs text-slate-600 dark:text-slate-400">
              {insight.log_count} events
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)] space-y-6">
          {/* Card Details */}
          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{insight.description}</p>
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Example Log Entries:</p>
              <div className="space-y-2">
                {insight.examples.map((example, i) => (
                  <div
                    key={i}
                    className="text-xs font-mono bg-white dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 break-all"
                  >
                    {example}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AI Analysis Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                AI Investigation
              </h4>
              {investigation && (
                <button
                  onClick={onInvestigate}
                  disabled={isInvestigating}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isInvestigating ? 'animate-spin' : ''}`} />
                  Re-analyze
                </button>
              )}
            </div>

            {isInvestigating ? (
              <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-8 border border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                <p className="text-sm text-slate-500 dark:text-slate-400">AI is analyzing this log category...</p>
              </div>
            ) : investigation ? (
              <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                  {investigation}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-8 border border-slate-200 dark:border-slate-700/50 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Click the button below to get AI-powered analysis</p>
                <button
                  onClick={onInvestigate}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 mx-auto shadow-lg hover:shadow-purple-500/30"
                >
                  <Sparkles className="w-4 h-4" />
                  Start Investigation
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/50">
          <button
            onClick={onGetSPL}
            className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600/50 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <Code2 className="w-4 h-4" />
            Generate SPL Query
          </button>
          <button
            onClick={onFindSimilar}
            className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600/50 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            Find Similar Events
          </button>
        </div>
      </div>
    </div>
  );
});

InvestigationModal.displayName = 'InvestigationModal';

export default InvestigationModal;
