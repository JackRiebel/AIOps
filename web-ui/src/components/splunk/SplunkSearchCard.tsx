'use client';

import { memo } from 'react';
import { Sparkles, Search, ChevronRight, Loader2 } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/DashboardCard';

// ============================================================================
// Types
// ============================================================================

export interface SplunkSearchCardProps {
  aiPrompt: string;
  onAiPromptChange: (value: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  maxLogs: number;
  onMaxLogsChange: (value: number) => void;
  showAdvanced: boolean;
  onShowAdvancedChange: (value: boolean) => void;
  onSearchWithAI: () => void;
  onSearchManual: () => void;
  aiProcessing: boolean;
  generating: boolean;
  disabled: boolean;
}

// ============================================================================
// Time Range Options
// ============================================================================

const timeRangeOptions = [
  { value: '-15m', label: 'Last 15 minutes' },
  { value: '-1h', label: 'Last hour' },
  { value: '-4h', label: 'Last 4 hours' },
  { value: '-24h', label: 'Last 24 hours' },
  { value: '-7d', label: 'Last 7 days' },
  { value: '-30d', label: 'Last 30 days' },
];

const maxLogsOptions = [
  { value: 50, label: '50 logs' },
  { value: 100, label: '100 logs' },
  { value: 250, label: '250 logs' },
  { value: 500, label: '500 logs' },
  { value: 1000, label: '1000 logs' },
];

// ============================================================================
// SplunkSearchCard Component
// ============================================================================

export const SplunkSearchCard = memo(({
  aiPrompt,
  onAiPromptChange,
  searchQuery,
  onSearchQueryChange,
  timeRange,
  onTimeRangeChange,
  maxLogs,
  onMaxLogsChange,
  showAdvanced,
  onShowAdvancedChange,
  onSearchWithAI,
  onSearchManual,
  aiProcessing,
  generating,
  disabled,
}: SplunkSearchCardProps) => {
  return (
    <DashboardCard
      title="Search Logs"
      icon={<Sparkles className="w-4 h-4" />}
      accent="purple"
      compact
    >
      <div className="space-y-4">
        {/* AI Prompt */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
            Describe what you want to search for
          </label>
          <textarea
            value={aiPrompt}
            onChange={(e) => onAiPromptChange(e.target.value)}
            placeholder="e.g. Show me all authentication failures in the last 24 hours"
            rows={3}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm resize-none"
          />
        </div>

        {/* Time Range and Max Logs */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-slate-900 dark:text-white text-sm"
            >
              {timeRangeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Max Logs
            </label>
            <select
              value={maxLogs}
              onChange={(e) => onMaxLogsChange(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-slate-900 dark:text-white text-sm"
            >
              {maxLogsOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggle Advanced */}
        <button
          onClick={() => onShowAdvancedChange(!showAdvanced)}
          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-medium transition"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
          Advanced Manual Search (SPL)
        </button>

        {/* Manual SPL Input */}
        {showAdvanced && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700/50">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              SPL Search Query
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="search index=* error | head 100"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono text-sm"
              onKeyDown={(e) => e.key === 'Enter' && onSearchManual()}
            />
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          {!showAdvanced ? (
            <button
              onClick={onSearchWithAI}
              disabled={aiProcessing || disabled || !aiPrompt.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition font-medium shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {aiProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Search with AI
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onSearchManual}
              disabled={generating || disabled}
              className="w-full px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition font-medium shadow-lg hover:shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search & Analyze
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </DashboardCard>
  );
});

SplunkSearchCard.displayName = 'SplunkSearchCard';

export default SplunkSearchCard;
