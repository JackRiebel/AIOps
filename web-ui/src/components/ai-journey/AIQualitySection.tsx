'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIQuality } from './hooks/useAIQuality';
import { AIQualitySummaryCards } from './AIQualitySummaryCards';
import { PromptTestTimeline } from './PromptTestTimeline';
import { AssertionResultsPanel } from './AssertionResultsPanel';
import { ResponseTimeDistribution } from './ResponseTimeDistribution';
import { RegionalComparisonGrid } from './RegionalComparisonGrid';
import { PromptTestHistory } from './PromptTestHistory';

// ============================================================================
// Types
// ============================================================================

export interface AIQualitySectionProps {
  provider: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'ai-journey-ai-quality';

// ============================================================================
// Component
// ============================================================================

export function AIQualitySection({ provider }: AIQualitySectionProps) {
  const { results, summary, regional, assertions, assertionHistory, loading } = useAIQuality(provider);

  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Show nothing if there is no data at all and not loading
  if (!loading && results.length === 0 && !summary) {
    return null;
  }

  const passRateBadge = summary
    ? `${summary.assertion_pass_rate.toFixed(1)}%`
    : null;

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full px-5 py-3 flex items-center gap-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-700/20 transition-colors"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400" />
          : <ChevronRight className="w-4 h-4 text-slate-400" />
        }
        <Brain className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
          AI Response Quality
        </span>
        {passRateBadge != null && (
          <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            summary && summary.assertion_pass_rate >= 95
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
              : summary && summary.assertion_pass_rate >= 80
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50'
          }`}>
            {passRateBadge}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Summary cards */}
              <AIQualitySummaryCards summary={summary} />

              {/* Row 1: Timeline + Assertions */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-7">
                  <PromptTestTimeline results={results} />
                </div>
                <div className="col-span-12 lg:col-span-5">
                  <AssertionResultsPanel
                    history={assertionHistory}
                    assertions={assertions}
                  />
                </div>
              </div>

              {/* Row 2: Distribution + Regional */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-7">
                  <ResponseTimeDistribution results={results} />
                </div>
                <div className="col-span-12 lg:col-span-5">
                  <RegionalComparisonGrid regional={regional} />
                </div>
              </div>

              {/* Row 3: History table */}
              <PromptTestHistory results={results} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AIQualitySection;
