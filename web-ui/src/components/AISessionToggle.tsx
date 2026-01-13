'use client';

import { useState, useMemo } from 'react';
import { useAISession } from '@/contexts/AISessionContext';

interface AISessionToggleProps {
  onSessionComplete?: () => void;
}

// Format duration as MM:SS or HH:MM:SS
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format cost with appropriate precision
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
}

// Get cost tier color based on amount
function getCostTierColor(cost: number): { bg: string; text: string; border: string } {
  if (cost < 0.50) {
    return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' };
  } else if (cost < 2.00) {
    return { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30' };
  } else if (cost < 5.00) {
    return { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30' };
  } else {
    return { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' };
  }
}

export default function AISessionToggle({ onSessionComplete }: AISessionToggleProps) {
  const { session, isActive, isLoading, realTimeMetrics, startSession, stopSession } = useAISession();
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startSession();
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      const completed = await stopSession();
      if (completed && onSessionComplete) {
        onSessionComplete();
      }
    } finally {
      setStopping(false);
    }
  };

  // Memoize cost tier colors
  const costColors = useMemo(() => {
    return getCostTierColor(realTimeMetrics?.cost ?? 0);
  }, [realTimeMetrics?.cost]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Active session - show recording indicator with live metrics
  if (isActive && session) {
    const duration = realTimeMetrics?.duration ?? 0;
    const cost = realTimeMetrics?.cost ?? 0;
    const queryCount = realTimeMetrics?.queryCount ?? 0;

    return (
      <div className="relative">
        <button
          onClick={handleStop}
          disabled={stopping}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg ${costColors.bg} hover:opacity-90 border ${costColors.border} transition-all`}
        >
          {stopping ? (
            <>
              <div className={`w-4 h-4 border-2 ${costColors.text} border-t-transparent rounded-full animate-spin`} />
              <span className={`text-xs font-medium ${costColors.text}`}>Stopping...</span>
            </>
          ) : (
            <>
              {/* Recording dot with pulse */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>

              {/* Duration */}
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                {formatDuration(duration)}
              </span>

              {/* Cost with color indicator */}
              <span className={`text-xs font-medium ${costColors.text}`}>
                {formatCost(cost)}
              </span>

              {/* Hover state - show stop text */}
              <span className="text-xs font-medium text-red-500 hidden group-hover:inline ml-1">
                Stop
              </span>
            </>
          )}
        </button>

        {/* Tooltip with detailed metrics */}
        {showTooltip && !stopping && realTimeMetrics && (
          <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50">
            <div className="text-xs space-y-2">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Session Duration</span>
                <span className="font-mono">{formatDuration(duration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">Total Cost</span>
                <span className={`font-medium ${costColors.text}`}>{formatCost(cost)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>AI Queries</span>
                <span className="font-mono">{queryCount}</span>
              </div>
              {queryCount > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Avg Query Cost</span>
                  <span className="font-mono">{formatCost(realTimeMetrics.avgQueryCost)}</span>
                </div>
              )}
              {realTimeMetrics.avgResponseTimeMs > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Avg Response</span>
                  <span className="font-mono">{(realTimeMetrics.avgResponseTimeMs / 1000).toFixed(1)}s</span>
                </div>
              )}
              {realTimeMetrics.costPerMinute > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Rate</span>
                  <span className="font-mono">{formatCost(realTimeMetrics.costPerMinute)}/min</span>
                </div>
              )}

              {/* Cost breakdown */}
              {cost > 0 && (
                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-slate-500 dark:text-slate-400 mb-1">Cost Breakdown</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-300">AI Queries</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300">
                        {formatCost(realTimeMetrics.costByType.aiQueries)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 text-slate-400">
                Click to stop session
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default state - show start button
  return (
    <button
      onClick={handleStart}
      disabled={starting}
      title="Start tracking AI session (Ctrl+Shift+S)"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all disabled:opacity-50"
    >
      {starting ? (
        <>
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-cyan-500">Starting...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium text-cyan-500">Start Session</span>
        </>
      )}
    </button>
  );
}
