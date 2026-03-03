'use client';

import { memo, useCallback } from 'react';
import { ExternalLink, Search, Server, ArrowRight } from 'lucide-react';
import type { TESplunkCorrelation } from './types';

// ============================================================================
// Types
// ============================================================================

export interface TESplunkCorrelationCardProps {
  correlation: TESplunkCorrelation | null;
  loading: boolean;
  onViewInSplunk?: () => void;
}

// ============================================================================
// Splunk Icon
// ============================================================================

const SplunkIcon = memo(() => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M4 8l4 2.5v5L4 18V8z" fill="#F58220" />
    <path d="M20 8l-4 2.5v5L20 18V8z" fill="#F58220" />
    <path d="M8 6l4-2 4 2v4l-4 2.5L8 10V6z" fill="#F58220" opacity="0.8" />
    <path d="M8 14l4 2.5 4-2.5v4l-4 2-4-2v-4z" fill="#F58220" opacity="0.6" />
  </svg>
));
SplunkIcon.displayName = 'SplunkIcon';

// ============================================================================
// Skeleton
// ============================================================================

const CardSkeleton = memo(() => (
  <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 space-y-3">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-orange-100 dark:bg-orange-500/15 rounded-lg animate-pulse" />
      <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
    </div>
    <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse ml-auto" />
        </div>
      ))}
    </div>
    <div className="flex gap-2">
      <div className="h-8 flex-1 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
      <div className="h-8 flex-1 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
    </div>
  </div>
));
CardSkeleton.displayName = 'CardSkeleton';

// ============================================================================
// Main Component
// ============================================================================

export const TESplunkCorrelationCard = memo(({
  correlation,
  loading,
  onViewInSplunk,
}: TESplunkCorrelationCardProps) => {
  const handleDeepDive = useCallback(() => {
    const hosts = correlation?.splunkMatches?.map(m => m.host).join(', ') || '';
    const deviceCount = correlation?.correlatedDevices?.length || 0;
    const query = encodeURIComponent(
      `Analyze the correlation between ThousandEyes monitoring and Splunk logs. Matching hosts: ${hosts}. ${deviceCount} correlated devices found. Show me the root cause analysis and timeline.`
    );
    window.location.href = `/chat-v2?q=${query}`;
  }, [correlation]);

  if (loading) {
    return <CardSkeleton />;
  }

  // Not configured or null state
  if (!correlation) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
            <SplunkIcon />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Splunk Correlation</h3>
        </div>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
            <Server className="w-5 h-5 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Splunk not configured</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Configure Splunk in Settings to correlate logs with TE data.
          </p>
        </div>
      </div>
    );
  }

  const hasMatches = correlation.splunkMatches && correlation.splunkMatches.length > 0;
  const totalMatchingIPs = correlation.correlatedDevices?.length || 0;
  const topHosts = (correlation.splunkMatches || []).slice(0, 3);

  // Empty matches state
  if (!hasMatches && totalMatchingIPs === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
            <SplunkIcon />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Splunk Correlation</h3>
        </div>
        <div className="flex flex-col items-center py-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">No matches found</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            No ThousandEyes IPs were found in recent Splunk logs.
          </p>
        </div>
        {onViewInSplunk && (
          <button
            onClick={onViewInSplunk}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 mt-2 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 border border-orange-200 dark:border-orange-500/25 rounded-lg text-xs font-medium text-orange-700 dark:text-orange-400 transition"
          >
            <ExternalLink className="w-3 h-3" />
            View in Splunk
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-orange-300 dark:hover:border-orange-500/30 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
            <SplunkIcon />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Splunk Correlation</h3>
        </div>
        {totalMatchingIPs > 0 && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400">
            {totalMatchingIPs} IP{totalMatchingIPs !== 1 ? 's' : ''} matched
          </span>
        )}
      </div>

      {/* Top matching hosts */}
      {topHosts.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Top Splunk Hosts
          </p>
          {topHosts.map((match, idx) => {
            const count = typeof match.count === 'string' ? parseInt(match.count, 10) : match.count;
            return (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/30"
              >
                <div className="w-6 h-6 rounded-md bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Server className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate flex-1">
                  {match.host}
                </span>
                <span className="text-[10px] font-bold tabular-nums text-orange-600 dark:text-orange-400 flex-shrink-0">
                  {count != null && !isNaN(count) ? count.toLocaleString() : match.count} events
                </span>
              </div>
            );
          })}
          {correlation.splunkMatches.length > 3 && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
              +{correlation.splunkMatches.length - 3} more host{correlation.splunkMatches.length - 3 !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Correlated devices summary */}
      {correlation.correlatedDevices && correlation.correlatedDevices.length > 0 && (
        <div className="mb-3 p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/5 border border-cyan-100 dark:border-cyan-500/15">
          <div className="flex items-center gap-1.5 text-[11px] text-cyan-700 dark:text-cyan-400">
            <Search className="w-3 h-3" />
            <span className="font-medium">{correlation.correlatedDevices.length} device{correlation.correlatedDevices.length !== 1 ? 's' : ''}</span>
            <span className="text-cyan-600 dark:text-cyan-500">correlated across platforms</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {onViewInSplunk && (
          <button
            onClick={onViewInSplunk}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 border border-orange-200 dark:border-orange-500/25 rounded-lg text-xs font-medium text-orange-700 dark:text-orange-400 transition"
          >
            <ExternalLink className="w-3 h-3" />
            View in Splunk
          </button>
        )}
        <button
          onClick={handleDeepDive}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/25 rounded-lg text-xs font-medium text-cyan-700 dark:text-cyan-400 transition"
        >
          <ArrowRight className="w-3 h-3" />
          Deep Dive
        </button>
      </div>
    </div>
  );
});

TESplunkCorrelationCard.displayName = 'TESplunkCorrelationCard';
export default TESplunkCorrelationCard;
