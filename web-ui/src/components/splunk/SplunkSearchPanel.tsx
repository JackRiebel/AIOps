'use client';

import { memo, useState, useCallback } from 'react';
import {
  Search,
  Sparkles,
  Play,
  Copy,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wand2,
  FileText,
  Zap,
  Clock,
  Network,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface SplunkSearchPanelProps {
  saiaAvailable: boolean;
  loadingSaia: boolean;
  loadingSearch: boolean;
  generatedSpl: string | null;
  splExplanation: string | null;
  optimizedSpl: string | null;
  onGenerateSpl: (prompt: string) => Promise<void>;
  onExplainSpl: (spl: string) => Promise<void>;
  onOptimizeSpl: (spl: string) => Promise<void>;
  onSearch: (query: string, timeRange: string, maxResults: number) => Promise<void>;
  onCorrelate?: () => Promise<void>;
  loadingCorrelation?: boolean;
}

// ============================================================================
// Time range options
// ============================================================================

const TIME_RANGES = [
  { value: '-15m', label: 'Last 15 min' },
  { value: '-1h', label: 'Last hour' },
  { value: '-4h', label: 'Last 4 hours' },
  { value: '-24h', label: 'Last 24 hours' },
  { value: '-7d', label: 'Last 7 days' },
  { value: '-30d', label: 'Last 30 days' },
];

// ============================================================================
// Component
// ============================================================================

export const SplunkSearchPanel = memo(({
  saiaAvailable,
  loadingSaia,
  loadingSearch,
  generatedSpl,
  splExplanation,
  optimizedSpl,
  onGenerateSpl,
  onExplainSpl,
  onOptimizeSpl,
  onSearch,
  onCorrelate,
  loadingCorrelation,
}: SplunkSearchPanelProps) => {
  const [nlPrompt, setNlPrompt] = useState('');
  const [spl, setSpl] = useState('search index=* | head 100');
  const [timeRange, setTimeRange] = useState('-24h');
  const [maxResults, setMaxResults] = useState(1000);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);

  // Apply generated SPL to the editor
  const applyGeneratedSpl = useCallback(() => {
    if (generatedSpl) {
      setSpl(generatedSpl);
    }
  }, [generatedSpl]);

  // Apply optimized SPL to the editor
  const applyOptimizedSpl = useCallback(() => {
    if (optimizedSpl) {
      setSpl(optimizedSpl);
    }
  }, [optimizedSpl]);

  const handleGenerateSpl = useCallback(async () => {
    if (!nlPrompt.trim()) return;
    await onGenerateSpl(nlPrompt.trim());
  }, [nlPrompt, onGenerateSpl]);

  const handleSearch = useCallback(async () => {
    if (!spl.trim()) return;
    await onSearch(spl.trim(), timeRange, maxResults);
  }, [spl, timeRange, maxResults, onSearch]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(spl);
  }, [spl]);

  return (
    <div className="space-y-4">
      {/* Natural Language Input */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Natural Language Search
        </h3>

        <div className="flex gap-2">
          <textarea
            value={nlPrompt}
            onChange={e => setNlPrompt(e.target.value)}
            placeholder={saiaAvailable
              ? "Describe what you're looking for... (e.g., 'Show me failed login attempts in the last hour')"
              : "Splunk AI Assistant not available — use manual SPL below"
            }
            disabled={!saiaAvailable || loadingSaia}
            rows={2}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none transition disabled:opacity-50"
          />
          <button
            onClick={handleGenerateSpl}
            disabled={!saiaAvailable || loadingSaia || !nlPrompt.trim()}
            title={!saiaAvailable ? 'Requires Splunk AI Assistant' : 'Generate SPL'}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:hover:bg-purple-500 flex items-center gap-2 self-end"
          >
            {loadingSaia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Generate
          </button>
        </div>

        {/* Generated SPL result */}
        {generatedSpl && (
          <div className="p-3 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-green-700 dark:text-green-400">Generated SPL</span>
              <button
                onClick={applyGeneratedSpl}
                className="text-xs text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium"
              >
                Apply to editor
              </button>
            </div>
            <pre className="text-sm text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap bg-white/50 dark:bg-slate-900/30 rounded p-2">
              {generatedSpl}
            </pre>
          </div>
        )}
      </div>

      {/* SPL Editor */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Search className="w-4 h-4 text-green-500" />
          SPL Query
        </h3>

        <textarea
          value={spl}
          onChange={e => setSpl(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 bg-slate-900 dark:bg-slate-950 text-green-400 font-mono text-sm rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-y"
          spellCheck={false}
        />

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time range */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={timeRange}
              onChange={e => setTimeRange(e.target.value)}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            >
              {TIME_RANGES.map(tr => (
                <option key={tr.value} value={tr.value}>{tr.label}</option>
              ))}
            </select>
          </div>

          {/* Max results */}
          <select
            value={maxResults}
            onChange={e => setMaxResults(Number(e.target.value))}
            className="px-2 py-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          >
            <option value={100}>100 results</option>
            <option value={500}>500 results</option>
            <option value={1000}>1,000 results</option>
            <option value={5000}>5,000 results</option>
          </select>

          <div className="flex-1" />

          {/* Action buttons */}
          <button
            onClick={() => {
              onExplainSpl(spl);
              setShowExplanation(true);
            }}
            disabled={!saiaAvailable || loadingSaia || !spl.trim()}
            title={!saiaAvailable ? 'Requires Splunk AI Assistant' : 'Explain this SPL'}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-40"
          >
            <FileText className="w-3.5 h-3.5 inline mr-1" />
            Explain
          </button>
          <button
            onClick={() => {
              onOptimizeSpl(spl);
              setShowOptimized(true);
            }}
            disabled={!saiaAvailable || loadingSaia || !spl.trim()}
            title={!saiaAvailable ? 'Requires Splunk AI Assistant' : 'Optimize this SPL'}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-40"
          >
            <Zap className="w-3.5 h-3.5 inline mr-1" />
            Optimize
          </button>
          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <Copy className="w-3.5 h-3.5 inline mr-1" />
            Copy
          </button>
          {onCorrelate && (
            <button
              onClick={onCorrelate}
              disabled={loadingCorrelation}
              title="Correlate search results with network devices"
              className="px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-500/10 hover:bg-green-200 dark:hover:bg-green-500/20 rounded-lg transition disabled:opacity-40 flex items-center gap-1"
            >
              {loadingCorrelation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Network className="w-3.5 h-3.5" />}
              Correlate
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={loadingSearch || !spl.trim()}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {loadingSearch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run
          </button>
        </div>

        {/* Explanation panel */}
        {showExplanation && splExplanation && (
          <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 space-y-2">
            <button
              onClick={() => setShowExplanation(false)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              Explanation
            </button>
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20">
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{splExplanation}</p>
            </div>
          </div>
        )}

        {/* Optimized panel */}
        {showOptimized && optimizedSpl && (
          <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowOptimized(false)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                Optimized SPL
              </button>
              <button
                onClick={applyOptimizedSpl}
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
              >
                Apply
              </button>
            </div>
            <pre className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/20 text-sm text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap">
              {optimizedSpl}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
});

SplunkSearchPanel.displayName = 'SplunkSearchPanel';
export default SplunkSearchPanel;
