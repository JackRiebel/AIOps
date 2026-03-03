'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRecentTraces } from '@/components/ai-trace/useAITrace';
import type { SpanStatus } from '@/types/ai-trace';
import {
  Wrench,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Timer,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<SpanStatus, { dot: string; label: string; icon: React.ComponentType<{ className?: string }>; text: string }> = {
  running: { dot: 'bg-amber-400', label: 'Running', icon: Loader2, text: 'text-amber-600 dark:text-amber-400' },
  success: { dot: 'bg-emerald-500', label: 'Success', icon: CheckCircle2, text: 'text-emerald-600 dark:text-emerald-400' },
  error: { dot: 'bg-red-500', label: 'Error', icon: AlertCircle, text: 'text-red-600 dark:text-red-400' },
  timeout: { dot: 'bg-orange-500', label: 'Timeout', icon: Timer, text: 'text-orange-600 dark:text-orange-400' },
};

const COLLAPSED_COUNT = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PROVIDER_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  anthropic: { label: 'Claude', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  openai: { label: 'GPT', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  cisco: { label: 'Circuit', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400' },
  google: { label: 'Gemini', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
};

interface RecentAITracesProps {
  provider?: string | null;
}

export function RecentAITraces({ provider }: RecentAITracesProps = {}) {
  const { traces, loading, error, refresh } = useRecentTraces(15, provider);
  const [expanded, setExpanded] = useState(false);

  const visibleTraces = expanded ? traces : traces.slice(0, COLLAPSED_COUNT);
  const hasMore = traces.length > COLLAPSED_COUNT;

  if (loading && traces.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-500" />
          <span className="text-[13px] font-semibold text-slate-900 dark:text-white">Recent AI Queries</span>
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200/60 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/20 px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          Failed to load traces: {error}
        </div>
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200/60 dark:border-slate-700/40 bg-white/40 dark:bg-slate-800/30 px-5 py-8 text-center">
        <Activity className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-[13px] text-slate-400 dark:text-slate-500">
          No traced queries yet. Send a message in chat to see AI query traces here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-200/50 dark:border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-500" />
          <span className="text-[13px] font-semibold text-slate-900 dark:text-white">Recent AI Queries</span>
          <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-medium">
            {traces.length}
          </span>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 rounded-md text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_70px_90px_70px_80px_80px_28px] gap-2 px-5 py-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/30 bg-slate-50/50 dark:bg-slate-800/80">
        <span>Query</span>
        <span>Provider</span>
        <span>Status</span>
        <span className="text-right">Duration</span>
        <span className="text-right">Tools</span>
        <span className="text-right">Latency</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
        {visibleTraces.map((trace) => {
          const cfg = STATUS_CONFIG[trace.status];
          const StatusIcon = cfg.icon;

          return (
            <Link
              key={trace.trace_id}
              href={`/ai-journey/${trace.trace_id}`}
              className="grid grid-cols-[1fr_70px_90px_70px_80px_80px_28px] gap-2 items-center px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group"
            >
              {/* Query + timestamp */}
              <div className="min-w-0">
                <p className="text-[13px] text-slate-700 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white leading-tight">
                  {trace.query || 'AI Query'}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {formatRelativeTime(trace.start_time)}
                </p>
              </div>

              {/* Provider */}
              <div>
                {trace.provider ? (() => {
                  const badge = PROVIDER_BADGE[trace.provider];
                  return badge ? (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">{trace.provider}</span>
                  );
                })() : (
                  <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5">
                <StatusIcon className={`w-3 h-3 ${cfg.text} ${trace.status === 'running' ? 'animate-spin' : ''}`} />
                <span className={`text-[11px] font-medium ${cfg.text}`}>{cfg.label}</span>
              </div>

              {/* Duration */}
              <div className="text-right">
                <span className="text-[12px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                  {trace.duration_ms != null ? formatDuration(trace.duration_ms) : '—'}
                </span>
              </div>

              {/* Tools */}
              <div className="text-right">
                {trace.tool_count > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                    <Wrench className="w-3 h-3" />
                    {trace.tool_count}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>

              {/* Latency */}
              <div className="text-right">
                {trace.network_latency_ms != null ? (
                  <span className={`text-[11px] font-mono tabular-nums ${
                    trace.network_latency_ms > 200 ? 'text-red-500' : trace.network_latency_ms > 50 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {trace.network_latency_ms.toFixed(0)}ms
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-cyan-500 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <div className="border-t border-slate-100 dark:border-slate-700/30">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1.5 px-5 py-2 text-[12px] font-medium text-slate-400 hover:text-cyan-500 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Show all {traces.length} queries
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}
