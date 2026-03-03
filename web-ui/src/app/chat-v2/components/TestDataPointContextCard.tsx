'use client';

/**
 * TestDataPointContextCard - Test Data Point Display for Chat
 *
 * Displays ThousandEyes test data point context when the user clicks
 * "Ask AI" on a chart data point from the Tests & Alerts page.
 */

import { memo } from 'react';
import Image from 'next/image';
import {
  Activity,
  Clock,
  Gauge,
  ChevronRight,
  Zap,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface TestDataPointContextData {
  testName: string;
  testId: number;
  testType: string;
  organization: string;
  timestamp: string;
  metrics: {
    responseTime?: number;
    latency?: number;
    loss?: number;
    jitter?: number;
    availability?: number;
    throughput?: number;
  };
  userQuestion: string;
}

interface TestDataPointContextCardProps {
  data: TestDataPointContextData;
  isAnalyzing?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export const TestDataPointContextCard = memo(({ data, isAnalyzing = true }: TestDataPointContextCardProps) => {
  const m = data.metrics;
  const hasIssue = (m.loss && m.loss > 1) || (m.latency && m.latency > 100) || (m.responseTime && m.responseTime > 2000);
  const borderColor = hasIssue ? 'border-amber-500/40' : 'border-cyan-500/40';
  const gradient = hasIssue ? 'from-amber-500/20 via-amber-500/10 to-transparent' : 'from-cyan-500/20 via-cyan-500/10 to-transparent';
  const ring = hasIssue ? 'ring-amber-500/20' : 'ring-cyan-500/20';

  const formattedTime = (() => {
    try {
      const d = new Date(data.timestamp);
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return data.timestamp; }
  })();

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${borderColor} bg-white dark:bg-slate-800/95 shadow-xl ${ring} ring-1 max-w-md`}>
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${gradient} pointer-events-none`} />

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex-shrink-0 shadow-sm">
            <Image src="/te-logo.png" alt="ThousandEyes" width={22} height={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-500 text-white shadow-sm">
                {data.testType}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                ID: {data.testId}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5 leading-snug">
              {data.testName}
            </h3>
          </div>
        </div>

        {/* Timestamp */}
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium">{formattedTime}</span>
        </div>

        {/* Metrics grid */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {m.responseTime != null && (
            <MetricPill icon={Zap} label="Response" value={`${m.responseTime}ms`} warn={m.responseTime > 2000} />
          )}
          {m.latency != null && (
            <MetricPill icon={Activity} label="Latency" value={`${m.latency}ms`} warn={m.latency > 100} />
          )}
          {m.loss != null && (
            <MetricPill icon={Gauge} label="Loss" value={`${m.loss}%`} warn={m.loss > 1} />
          )}
          {m.jitter != null && (
            <MetricPill icon={Activity} label="Jitter" value={`${m.jitter.toFixed(2)}ms`} warn={m.jitter > 10} />
          )}
          {m.availability != null && (
            <MetricPill icon={Gauge} label="Avail" value={`${m.availability}%`} warn={m.availability < 99} />
          )}
          {m.throughput != null && (
            <MetricPill icon={Zap} label="Throughput" value={String(m.throughput)} warn={false} />
          )}
        </div>

        {/* User question */}
        {data.userQuestion && (
          <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
              &ldquo;{data.userQuestion}&rdquo;
            </p>
          </div>
        )}

        {/* Footer */}
        {isAnalyzing && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </div>
                <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                  Analyzing with AI
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <span>Generating insights</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

TestDataPointContextCard.displayName = 'TestDataPointContextCard';

function MetricPill({ icon: Icon, label, value, warn }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warn: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${warn ? 'border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/60'}`}>
      <Icon className={`w-3 h-3 ${warn ? 'text-amber-500' : 'text-slate-400'}`} />
      <div className="min-w-0">
        <div className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</div>
        <div className={`text-[11px] font-bold tabular-nums ${warn ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>{value}</div>
      </div>
    </div>
  );
}

/**
 * Type guard for test data point context
 */
export function hasTestDataPointContext(
  metadata: unknown
): metadata is { testDataPointContext: { type: 'test_data_point'; data: TestDataPointContextData } } {
  if (!metadata || typeof metadata !== 'object') return false;
  const m = metadata as Record<string, unknown>;
  if (!m.testDataPointContext || typeof m.testDataPointContext !== 'object') return false;
  const ctx = m.testDataPointContext as Record<string, unknown>;
  return ctx.type === 'test_data_point' && ctx.data !== null && typeof ctx.data === 'object';
}

export default TestDataPointContextCard;
