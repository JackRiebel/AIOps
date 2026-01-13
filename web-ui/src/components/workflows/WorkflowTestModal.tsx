'use client';

import { useState, useCallback } from 'react';
import { X, Play, Clock, AlertTriangle, CheckCircle, Loader2, Calendar, Info } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowTestModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Workflow ID to test */
  workflowId: number;
  /** Workflow name for display */
  workflowName: string;
}

interface TimeRange {
  label: string;
  value: string;
  hours: number;
  description: string;
}

interface TestResult {
  success: boolean;
  workflow_id: number;
  workflow_name: string;
  trigger_result?: {
    would_trigger: boolean;
    condition_met: boolean;
    data_summary?: string;
  };
  ai_analysis?: {
    recommendation: string;
    confidence: number;
  };
  actions_preview?: Array<{
    action: string;
    target: string;
    would_execute: boolean;
  }>;
  error?: string;
  simulation_time_range?: {
    start: string;
    end: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const TIME_RANGES: TimeRange[] = [
  {
    label: 'Real-time',
    value: 'realtime',
    hours: 0,
    description: 'Test with current live data',
  },
  {
    label: 'Last 24 Hours',
    value: '24h',
    hours: 24,
    description: 'Simulate using data from the past day',
  },
  {
    label: 'Last 7 Days',
    value: '7d',
    hours: 168,
    description: 'Test against a weeks worth of historical data',
  },
  {
    label: 'Last 30 Days',
    value: '30d',
    hours: 720,
    description: 'Full month historical simulation',
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function WorkflowTestModal({
  isOpen,
  onClose,
  workflowId,
  workflowName,
}: WorkflowTestModalProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(TIME_RANGES[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = useCallback(async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      // Calculate time range for simulation
      const endTime = new Date();
      const startTime = selectedTimeRange.hours > 0
        ? new Date(endTime.getTime() - selectedTimeRange.hours * 60 * 60 * 1000)
        : undefined;

      const params = new URLSearchParams();
      if (startTime) {
        params.set('simulation_start_time', startTime.toISOString());
        params.set('simulation_end_time', endTime.toISOString());
      }

      const url = `/api/workflows/${workflowId}/test${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Test failed');
      }

      const data: TestResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsRunning(false);
    }
  }, [workflowId, selectedTimeRange]);

  const handleClose = useCallback(() => {
    setResult(null);
    setError(null);
    setSelectedTimeRange(TIME_RANGES[0]);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Play className="w-5 h-5 text-cyan-500" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Test Workflow
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {workflowName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Time Range Selector */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              <Clock className="w-4 h-4" />
              Simulation Time Range
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setSelectedTimeRange(range)}
                  disabled={isRunning}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedTimeRange.value === range.value
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`text-sm font-medium ${
                    selectedTimeRange.value === range.value
                      ? 'text-cyan-700 dark:text-cyan-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {range.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {range.description}
                  </div>
                </button>
              ))}
            </div>

            {/* Time range warning for API-based triggers */}
            {selectedTimeRange.hours > 0 && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/30">
                <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-medium">Note:</span> Real-time API calls (Meraki, ThousandEyes)
                  cannot be time-simulated. The test will use current API data for these triggers,
                  but Splunk/Database queries will respect the time window.
                </div>
              </div>
            )}
          </div>

          {/* Test Button */}
          <button
            onClick={runTest}
            disabled={isRunning}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running Test...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run Test
              </>
            )}
          </button>

          {/* Results */}
          {(result || error) && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Test Results
              </h3>

              {error ? (
                <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/30">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Test Failed</span>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {/* Trigger Result */}
                  {result.trigger_result && (
                    <div className={`p-4 rounded-lg border ${
                      result.trigger_result.would_trigger
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        {result.trigger_result.would_trigger ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-slate-400" />
                        )}
                        <span className={`font-medium ${
                          result.trigger_result.would_trigger
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {result.trigger_result.would_trigger
                            ? 'Workflow Would Trigger'
                            : 'Workflow Would Not Trigger'}
                        </span>
                      </div>
                      {result.trigger_result.data_summary && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          {result.trigger_result.data_summary}
                        </p>
                      )}
                    </div>
                  )}

                  {/* AI Analysis */}
                  {result.ai_analysis && (
                    <div className="p-4 bg-cyan-50 dark:bg-cyan-500/10 rounded-lg border border-cyan-200 dark:border-cyan-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-cyan-700 dark:text-cyan-400">
                          AI Recommendation
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-cyan-200 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400">
                          {result.ai_analysis.confidence}% confidence
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {result.ai_analysis.recommendation}
                      </p>
                    </div>
                  )}

                  {/* Actions Preview */}
                  {result.actions_preview && result.actions_preview.length > 0 && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Actions That Would Execute
                      </div>
                      <div className="space-y-2">
                        {result.actions_preview.map((action, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm"
                          >
                            {action.would_execute ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <X className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="text-slate-600 dark:text-slate-400">
                              {action.action}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500">→</span>
                            <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">
                              {action.target}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Time Range Info */}
                  {result.simulation_time_range && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      Simulated: {new Date(result.simulation_time_range.start).toLocaleString()}
                      {' '}-{' '}
                      {new Date(result.simulation_time_range.end).toLocaleString()}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkflowTestModal;
