'use client';

import { memo, useState } from 'react';
import { Sparkles, Code2, Search, Loader2, FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
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
  compact?: boolean;
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
  compact = false,
}: InsightCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const config = getSeverityConfig(insight.severity);

  return (
    <div className={`group relative bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 ${config.leftBorder} hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all duration-200`}>
      {/* Clickable header area */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 pb-2"
      >
        <div className="flex items-center justify-between mb-2">
          <SeverityBadge severity={insight.severity} />
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-slate-900/40 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">
              <FileText className="w-3 h-3 text-slate-400" />
              {insight.log_count}
            </span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>

        <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition mb-1.5 line-clamp-2">
          {insight.title}
        </h4>

        {/* Description - truncated when collapsed, full when expanded */}
        <p className={`text-xs text-slate-500 dark:text-slate-400 ${expanded ? '' : 'line-clamp-2'}`}>
          {insight.description}
        </p>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Source System */}
          {insight.source_system && insight.source_system !== 'unknown' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Source:</span>
              <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900/40 rounded-lg text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 capitalize">
                {insight.source_system}
              </span>
            </div>
          )}

          {/* Time info */}
          {insight.created_at && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-medium">Generated:</span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400">
                {new Date(insight.created_at).toLocaleString()}
              </span>
            </div>
          )}

          {/* Examples */}
          {insight.examples && insight.examples.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Example logs:</p>
              {insight.examples.slice(0, compact ? 2 : 4).map((example, i) => (
                <div
                  key={i}
                  className="text-[10px] font-mono bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 break-all"
                  style={{ maxHeight: compact ? '40px' : '60px', overflow: 'hidden' }}
                >
                  {example}
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2.5 border-t border-slate-200 dark:border-slate-700/50">
            <button
              onClick={(e) => { e.stopPropagation(); onInvestigate(); }}
              disabled={isInvestigating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-700 rounded-lg transition disabled:opacity-50"
            >
              {isInvestigating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Investigate with AI
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onGetSPL(); }}
              disabled={isGeneratingSPL}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 rounded-lg transition disabled:opacity-50"
            >
              {isGeneratingSPL ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Code2 className="w-3 h-3" />
              )}
              Get SPL
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onFindSimilar(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg transition"
            >
              <Search className="w-3 h-3" />
              Find Similar
            </button>
          </div>
        </div>
      )}

      {/* Compact: show quick action bar even when collapsed */}
      {!expanded && !compact && (
        <div className="px-4 pb-3 flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onInvestigate(); }}
            className="px-2.5 py-1 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition"
          >
            Investigate
          </button>
          <span className="w-px h-3 bg-slate-200 dark:bg-slate-700/50" />
          <button
            onClick={(e) => { e.stopPropagation(); onGetSPL(); }}
            className="px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg transition"
          >
            Get SPL
          </button>
          <span className="w-px h-3 bg-slate-200 dark:bg-slate-700/50" />
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="px-2.5 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg transition flex items-center gap-1"
          >
            Details <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </div>
      )}
    </div>
  );
});

InsightCard.displayName = 'InsightCard';

export default InsightCard;
