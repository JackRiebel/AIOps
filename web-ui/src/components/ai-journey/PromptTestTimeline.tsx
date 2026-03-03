'use client';

import { memo, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { AIQualityResult } from '@/types/ai-quality';

// ============================================================================
// Types
// ============================================================================

export interface PromptTestTimelineProps {
  results: AIQualityResult[];
}

interface TimelinePoint {
  time: string;
  response_time_ms: number;
  color: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

function responseColor(ms: number): string {
  if (ms < 500) return '#10b981';   // green / emerald
  if (ms <= 2000) return '#f59e0b'; // amber
  return '#ef4444';                  // red
}

// ============================================================================
// Component
// ============================================================================

export const PromptTestTimeline = memo(({ results }: PromptTestTimelineProps) => {
  const data = useMemo<TimelinePoint[]>(() => {
    return results.map((r) => ({
      time: formatTime(r.timestamp),
      response_time_ms: r.response_time_ms,
      color: responseColor(r.response_time_ms),
    }));
  }, [results]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
        <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Response Timeline
        </h3>
        <div className="flex items-center justify-center h-[200px] text-[12px] text-slate-400 dark:text-slate-500">
          No timeline data available
        </div>
      </div>
    );
  }

  // Determine the dominant color for the area fill
  const avgMs = data.reduce((s, d) => s + d.response_time_ms, 0) / data.length;
  const fillColor = responseColor(avgMs);

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
      <h3 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
        Response Timeline
      </h3>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <defs>
              <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={fillColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={fillColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.2} vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#334155', strokeWidth: 0.5 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}ms`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Response Time']}
            />
            <ReferenceLine
              y={1000}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              strokeOpacity={0.5}
              label={{ value: '1s', position: 'right', fontSize: 9, fill: '#f59e0b' }}
            />
            <Area
              type="monotone"
              dataKey="response_time_ms"
              stroke={fillColor}
              strokeWidth={2}
              fill="url(#timelineGrad)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: '#1e293b' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

PromptTestTimeline.displayName = 'PromptTestTimeline';
export default PromptTestTimeline;
