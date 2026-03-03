'use client';

import { memo, useEffect } from 'react';
import { X, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { TestPerformanceChart } from './TestPerformanceChart';
import type { Test, TestResult, TimelineItem } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TEDetailPanelProps {
  selectedTest: Test | null;
  selectedTimelineItem: TimelineItem | null;
  testResults: Record<number, TestResult[]>;
  loadingResults: Record<number, boolean>;
  tests: Test[];
  onClose: () => void;
  onFetchTestResults: (testId: number, testType: string) => void;
  onAskAI: (context: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

// ============================================================================
// Component
// ============================================================================

export const TEDetailPanel = memo(({
  selectedTest,
  selectedTimelineItem,
  testResults,
  loadingResults,
  tests,
  onClose,
  onFetchTestResults,
  onAskAI,
}: TEDetailPanelProps) => {
  // Fetch test results when a test is selected
  useEffect(() => {
    if (selectedTest && !testResults[selectedTest.testId] && !loadingResults[selectedTest.testId]) {
      onFetchTestResults(selectedTest.testId, selectedTest.type);
    }
  }, [selectedTest, testResults, loadingResults, onFetchTestResults]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="overflow-hidden"
    >
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-700/50 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Test detail */}
        {selectedTest && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedTest.testName}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedTest.type} test — ID: {selectedTest.testId}
                </p>
              </div>
            </div>

            <TestPerformanceChart
              testId={selectedTest.testId}
              testName={selectedTest.testName}
              testType={selectedTest.type}
              results={testResults[selectedTest.testId] || []}
              loading={loadingResults[selectedTest.testId] || false}
              selectedOrg="default"
              onAskAI={onAskAI}
            />
          </div>
        )}

        {/* Timeline item detail */}
        {selectedTimelineItem && !selectedTest && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedTimelineItem.severity === 'critical'
                  ? 'bg-red-100 dark:bg-red-500/20'
                  : selectedTimelineItem.severity === 'major'
                    ? 'bg-orange-100 dark:bg-orange-500/20'
                    : 'bg-amber-100 dark:bg-amber-500/20'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${
                  selectedTimelineItem.severity === 'critical'
                    ? 'text-red-600 dark:text-red-400'
                    : selectedTimelineItem.severity === 'major'
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-amber-600 dark:text-amber-400'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedTimelineItem.title}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="capitalize">{selectedTimelineItem.type}</span>
                  <span>—</span>
                  <span className={`capitalize font-medium ${
                    selectedTimelineItem.severity === 'critical' ? 'text-red-600 dark:text-red-400' :
                    selectedTimelineItem.severity === 'major' ? 'text-orange-600 dark:text-orange-400' :
                    'text-amber-600 dark:text-amber-400'
                  }`}>{selectedTimelineItem.severity}</span>
                  {selectedTimelineItem.isActive && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4">
                <p className="text-sm text-slate-700 dark:text-slate-300">{selectedTimelineItem.description}</p>
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Started: {formatDate(selectedTimelineItem.timestamp)}</span>
                </div>
                {selectedTimelineItem.endTimestamp && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Ended: {formatDate(selectedTimelineItem.endTimestamp)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => onAskAI(`Analyze this ${selectedTimelineItem.type}: ${selectedTimelineItem.title}. ${selectedTimelineItem.description}. Severity: ${selectedTimelineItem.severity}. What might be causing this and what should I do?`)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition font-medium"
              >
                <Sparkles className="w-4 h-4" />
                Ask AI about this issue
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

TEDetailPanel.displayName = 'TEDetailPanel';
export default TEDetailPanel;
