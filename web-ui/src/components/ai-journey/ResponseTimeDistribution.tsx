'use client';

import { memo, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { AIQualityResult } from '@/types/ai-quality';

// ============================================================================
// Types
// ============================================================================

export interface ResponseTimeDistributionProps {
  results: AIQualityResult[];
}

interface Bucket {
  label: string;
  count: number;
  color: string;
}

// ============================================================================
// Constants
// ============================================================================

const BUCKET_DEFS: { label: string; min: number; max: number; color: string }[] = [
  { label: '0-200ms', min: 0, max: 200, color: '#10b981' },
  { label: '200-500ms', min: 200, max: 500, color: '#22c55e' },
  { label: '500-1000ms', min: 500, max: 1000, color: '#f59e0b' },
  { label: '1-2s', min: 1000, max: 2000, color: '#f97316' },
  { label: '2s+', min: 2000, max: Infinity, color: '#ef4444' },
];

// ============================================================================
// Helpers
// ============================================================================

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ============================================================================
// Component
// ============================================================================

export const ResponseTimeDistribution = memo(({ results }: ResponseTimeDistributionProps) => {
  const { buckets, p50, p95, p99 } = useMemo(() => {
    const times = results.map((r) => r.response_time_ms);
    const sorted = [...times].sort((a, b) => a - b);

    const bkts: Bucket[] = BUCKET_DEFS.map((def) => ({
      label: def.label,
      count: times.filter((t) => t >= def.min && t < def.max).length,
      color: def.color,
    }));

    return {
      buckets: bkts,
      p50: computePercentile(sorted, 50),
      p95: computePercentile(sorted, 95),
      p99: computePercentile(sorted, 99),
    };
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
        <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Response Time Distribution
        </h3>
        <div className="flex items-center justify-center h-[180px] text-[12px] text-slate-400 dark:text-slate-500">
          No distribution data available
        </div>
      </div>
    );
  }

  // Find the max response time to scale reference lines properly
  const maxTime = Math.max(...results.map((r) => r.response_time_ms), 1);

  // Map percentiles to bucket positions for reference lines
  function percentileToBucketIndex(val: number): number {
    for (let i = 0; i < BUCKET_DEFS.length; i++) {
      if (val < BUCKET_DEFS[i].max) {
        const range = BUCKET_DEFS[i].max - BUCKET_DEFS[i].min;
        const offset = (val - BUCKET_DEFS[i].min) / (range === Infinity ? maxTime : range);
        return i + Math.min(offset, 1);
      }
    }
    return BUCKET_DEFS.length - 1;
  }

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Response Time Distribution
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
          <span>p50: <span className="text-slate-600 dark:text-slate-300 font-medium tabular-nums">{p50.toFixed(0)}ms</span></span>
          <span>p95: <span className="text-amber-600 dark:text-amber-400 font-medium tabular-nums">{p95.toFixed(0)}ms</span></span>
          <span>p99: <span className="text-red-600 dark:text-red-400 font-medium tabular-nums">{p99.toFixed(0)}ms</span></span>
        </div>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.2} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#334155', strokeWidth: 0.5 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(value: number) => [`${value}`, 'Count']}
            />
            {/* Percentile reference lines as x-axis based lines */}
            <ReferenceLine
              x={BUCKET_DEFS[Math.floor(percentileToBucketIndex(p50))]?.label}
              stroke="#3b82f6"
              strokeDasharray="4 2"
              strokeOpacity={0.6}
              label={{ value: 'p50', position: 'top', fontSize: 9, fill: '#3b82f6' }}
            />
            <ReferenceLine
              x={BUCKET_DEFS[Math.floor(percentileToBucketIndex(p95))]?.label}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              strokeOpacity={0.6}
              label={{ value: 'p95', position: 'top', fontSize: 9, fill: '#f59e0b' }}
            />
            <ReferenceLine
              x={BUCKET_DEFS[Math.floor(percentileToBucketIndex(p99))]?.label}
              stroke="#ef4444"
              strokeDasharray="4 2"
              strokeOpacity={0.6}
              label={{ value: 'p99', position: 'top', fontSize: 9, fill: '#ef4444' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {buckets.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

ResponseTimeDistribution.displayName = 'ResponseTimeDistribution';
export default ResponseTimeDistribution;
