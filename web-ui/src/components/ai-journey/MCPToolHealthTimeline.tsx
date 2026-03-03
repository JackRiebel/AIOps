'use client';

import { memo, useMemo } from 'react';
import { Activity } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MCPToolHealth } from '@/types/mcp-monitor';

// ============================================================================
// Types
// ============================================================================

export interface MCPToolHealthTimelineProps {
  data: MCPToolHealth[];
}

// ============================================================================
// Helpers
// ============================================================================

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getAvgPct(data: MCPToolHealth[]): number {
  if (data.length === 0) return 100;
  const sum = data.reduce((acc, d) => acc + d.availability_pct, 0);
  return sum / data.length;
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface TooltipPayloadItem {
  value: number;
  dataKey: string;
  payload: MCPToolHealth;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0].payload;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
        {formatTime(item.timestamp)}
      </p>
      <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
        {item.availability_pct.toFixed(1)}% available
      </p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {item.available_tools} / {item.total_tools} tools
      </p>
    </div>
  );
}

// ============================================================================
// MCPToolHealthTimeline Component
// ============================================================================

export const MCPToolHealthTimeline = memo(({ data }: MCPToolHealthTimelineProps) => {
  // Determine fill color based on average availability
  const { gradientId, strokeColor, fillColor } = useMemo(() => {
    const avg = getAvgPct(data);
    const id = 'mcpToolHealthGradient';
    if (avg >= 95) {
      return { gradientId: id, strokeColor: '#10b981', fillColor: '#10b981' }; // green
    }
    if (avg >= 80) {
      return { gradientId: id, strokeColor: '#f59e0b', fillColor: '#f59e0b' }; // amber
    }
    return { gradientId: id, strokeColor: '#ef4444', fillColor: '#ef4444' }; // red
  }, [data]);

  // Transform data for chart display
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: formatTime(d.timestamp),
      })),
    [data],
  );

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
        <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Tool Availability
        </h4>
        <div className="flex flex-col items-center justify-center py-6">
          <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-[13px] text-slate-500 dark:text-slate-400">No health data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/60 p-4">
      <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Tool Availability
      </h4>
      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={fillColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={fillColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-slate-200 dark:stroke-slate-700"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              style={{ fontSize: '10px' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#64748b"
              tickFormatter={(v: number) => `${v}%`}
              style={{ fontSize: '10px' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="availability_pct"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

MCPToolHealthTimeline.displayName = 'MCPToolHealthTimeline';

export default MCPToolHealthTimeline;
