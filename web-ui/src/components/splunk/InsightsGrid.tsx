'use client';

import { memo } from 'react';
import { Lightbulb, FileText, Loader2 } from 'lucide-react';
import { InsightCard } from './InsightCard';
import type { SplunkInsight } from './types';

// ============================================================================
// Types
// ============================================================================

export interface InsightsGridProps {
  insights: SplunkInsight[];
  loading: boolean;
  generating: boolean;
  showRawLogs: boolean;
  onToggleRawLogs: () => void;
  onInvestigate: (insight: SplunkInsight) => void;
  onGetSPL: (insight: SplunkInsight) => void;
  onFindSimilar: (insight: SplunkInsight) => void;
  investigatingCard: string | null;
}

// ============================================================================
// InsightsGrid Component
// ============================================================================

export const InsightsGrid = memo(({
  insights,
  loading,
  generating,
  showRawLogs,
  onToggleRawLogs,
  onInvestigate,
  onGetSPL,
  onFindSimilar,
  investigatingCard,
}: InsightsGridProps) => {
  const totalEvents = insights.reduce((sum, i) => sum + i.log_count, 0);

  // Loading state
  if (loading || generating) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-12">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {generating ? 'AI is analyzing logs...' : 'Loading insights...'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            This may take a few moments
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (insights.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="w-14 h-14 mb-4 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
            <FileText className="w-7 h-7 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No log insights yet</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Use the search above or click Refresh to analyze logs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Log Insights
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            ({totalEvents.toLocaleString()} events in {insights.length} categories)
          </span>
        </div>
        <button
          onClick={onToggleRawLogs}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition text-xs font-medium"
        >
          {showRawLogs ? 'Hide' : 'Show'} Raw Logs
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onInvestigate={() => onInvestigate(insight)}
            onGetSPL={() => onGetSPL(insight)}
            onFindSimilar={() => onFindSimilar(insight)}
            isInvestigating={investigatingCard === insight.title}
            isGeneratingSPL={investigatingCard === insight.title + '-query'}
          />
        ))}
      </div>
    </div>
  );
});

InsightsGrid.displayName = 'InsightsGrid';

export default InsightsGrid;
