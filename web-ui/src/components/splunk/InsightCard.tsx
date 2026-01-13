'use client';

import { memo } from 'react';
import { Sparkles, Code2, Search, Loader2, FileText } from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import { getSeverityConfig, type SplunkInsight } from './types';

// ============================================================================
// Types
// ============================================================================

export interface InsightCardProps {
  insight: SplunkInsight;
  onInvestigate: () => void;
  onGetSPL: () => void;
  onFindSimilar: () => void;
  isInvestigating: boolean;
  isGeneratingSPL: boolean;
}

// ============================================================================
// InsightCard Component
// ============================================================================

export const InsightCard = memo(({
  insight,
  onInvestigate,
  onGetSPL,
  onFindSimilar,
  isInvestigating,
  isGeneratingSPL,
}: InsightCardProps) => {
  const config = getSeverityConfig(insight.severity);

  return (
    <div className={`group relative bg-white dark:bg-slate-800/60 rounded-xl p-4 border border-l-4 ${config.leftBorder} border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all duration-200 shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <SeverityBadge severity={insight.severity} />
        <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-900/50 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">
          <FileText className="w-3 h-3 text-slate-400" />
          {insight.log_count}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition mb-2 line-clamp-2">
        {insight.title}
      </h4>

      {/* Description */}
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
        {insight.description}
      </p>

      {/* Source System */}
      {insight.source_system && insight.source_system !== 'unknown' && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Source:</span>
          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900/50 rounded text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 capitalize">
            {insight.source_system}
          </span>
        </div>
      )}

      {/* Examples */}
      {insight.examples && insight.examples.length > 0 && (
        <div className="space-y-1.5 mb-4">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Example logs:</p>
          {insight.examples.slice(0, 2).map((example, i) => (
            <div
              key={i}
              className="text-[10px] font-mono bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 truncate"
              title={example}
            >
              {example}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50">
        <button
          onClick={onInvestigate}
          disabled={isInvestigating}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 border border-purple-200 dark:border-purple-500/30 rounded-lg text-xs font-medium text-purple-700 dark:text-purple-300 transition disabled:opacity-50"
        >
          {isInvestigating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          Investigate
        </button>
        <button
          onClick={onGetSPL}
          disabled={isGeneratingSPL}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-100 dark:bg-cyan-500/20 hover:bg-cyan-200 dark:hover:bg-cyan-500/30 border border-cyan-200 dark:border-cyan-500/30 rounded-lg text-xs font-medium text-cyan-700 dark:text-cyan-300 transition disabled:opacity-50"
        >
          {isGeneratingSPL ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Code2 className="w-3 h-3" />
          )}
          Get SPL
        </button>
        <button
          onClick={onFindSimilar}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 transition"
        >
          <Search className="w-3 h-3" />
          Find Similar
        </button>
      </div>
    </div>
  );
});

InsightCard.displayName = 'InsightCard';

export default InsightCard;
