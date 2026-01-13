'use client';

import { memo, useMemo } from 'react';
import type { SessionMetrics } from '@/types/session';

interface SessionMetricsIndicatorProps {
  metrics: SessionMetrics | null | undefined;
  /** Compact mode shows only essential info */
  compact?: boolean;
  className?: string;
}

/**
 * SessionMetricsIndicator - Displays session token counts and cost
 *
 * Shows: tokens in · tokens out · cost
 * Compact, non-intrusive design that fits in the chat header.
 */
export const SessionMetricsIndicator = memo(({
  metrics,
  compact = true,
  className = '',
}: SessionMetricsIndicatorProps) => {
  const { tokensIn, tokensOut, cost, hasData } = useMemo(() => {
    if (!metrics) {
      return { tokensIn: 0, tokensOut: 0, cost: 0, hasData: false };
    }
    return {
      tokensIn: metrics.totalTokensIn || 0,
      tokensOut: metrics.totalTokensOut || 0,
      cost: metrics.totalCostUsd || 0,
      hasData: (metrics.totalTokensIn || 0) > 0 || (metrics.totalTokensOut || 0) > 0 || (metrics.totalCostUsd || 0) > 0,
    };
  }, [metrics]);

  // Don't render if no data yet
  if (!hasData) {
    return null;
  }

  // Format token count (use K for thousands)
  const formatTokens = (count: number): string => {
    if (count >= 10000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Format cost with appropriate precision
  const formatCost = (usd: number): string => {
    if (usd === 0) return '$0';
    if (usd < 0.0001) return `$${usd.toFixed(6)}`;
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    if (usd < 1) return `$${usd.toFixed(3)}`;
    return `$${usd.toFixed(2)}`;
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50 text-[10px] font-medium text-slate-500 dark:text-slate-400 ${className}`}
        title={`Input: ${tokensIn.toLocaleString()} tokens | Output: ${tokensOut.toLocaleString()} tokens | Cost: ${formatCost(cost)}`}
      >
        {/* Tokens In */}
        <span className="flex items-center gap-0.5">
          <svg className="w-3 h-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span>{formatTokens(tokensIn)}</span>
        </span>

        <span className="text-slate-300 dark:text-slate-600">·</span>

        {/* Tokens Out */}
        <span className="flex items-center gap-0.5">
          <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span>{formatTokens(tokensOut)}</span>
        </span>

        <span className="text-slate-300 dark:text-slate-600">·</span>

        {/* Cost */}
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
          {formatCost(cost)}
        </span>
      </div>
    );
  }

  // Full/expanded mode (for use elsewhere if needed)
  return (
    <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 ${className}`}>
      {/* Tokens In */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-cyan-100 dark:bg-cyan-500/20">
          <svg className="w-3 h-3 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{formatTokens(tokensIn)}</p>
          <p className="text-[9px] text-slate-400">in</p>
        </div>
      </div>

      {/* Tokens Out */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-purple-100 dark:bg-purple-500/20">
          <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{formatTokens(tokensOut)}</p>
          <p className="text-[9px] text-slate-400">out</p>
        </div>
      </div>

      {/* Cost */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center justify-center w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-500/20">
          <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{formatCost(cost)}</p>
          <p className="text-[9px] text-slate-400">cost</p>
        </div>
      </div>
    </div>
  );
});

SessionMetricsIndicator.displayName = 'SessionMetricsIndicator';

export default SessionMetricsIndicator;
