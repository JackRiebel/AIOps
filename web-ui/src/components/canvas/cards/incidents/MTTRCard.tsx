'use client';

import { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface MTTRMetric {
  period: string;  // e.g., "Last 7 days", "This month"
  mttr: number;    // Mean Time to Resolution in minutes
  mttrTarget?: number;  // Target MTTR
  incidentCount: number;
  resolvedCount: number;
  avgResponseTime?: number;  // Time to first response in minutes
}

interface MTTRTrend {
  date: string;
  mttr: number;
  count: number;
}

interface MTTRCardData {
  current: MTTRMetric;
  previous?: MTTRMetric;  // For comparison
  trend?: MTTRTrend[];
  byPriority?: {
    critical: { mttr: number; count: number };
    high: { mttr: number; count: number };
    medium: { mttr: number; count: number };
    low: { mttr: number; count: number };
  };
  networkId?: string;
  organizationId?: string;
}

interface MTTRCardProps {
  data: MTTRCardData;
  config?: {
    showTrend?: boolean;
    showByPriority?: boolean;
  };
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatDurationShort(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function getChangeIndicator(current: number, previous: number): { text: string; color: string; icon: string } {
  if (previous === 0) return { text: 'N/A', color: 'text-slate-500', icon: '•' };

  const change = ((current - previous) / previous) * 100;
  const absChange = Math.abs(change).toFixed(0);

  if (change < -5) {
    return { text: `${absChange}% faster`, color: 'text-emerald-600 dark:text-emerald-400', icon: '↓' };
  }
  if (change > 5) {
    return { text: `${absChange}% slower`, color: 'text-red-600 dark:text-red-400', icon: '↑' };
  }
  return { text: 'No change', color: 'text-slate-500 dark:text-slate-400', icon: '→' };
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-400',
};

/**
 * MTTRCard - Mean Time to Resolution metrics
 *
 * Shows:
 * - Current MTTR vs target
 * - Trend over time
 * - Breakdown by priority
 * - Comparison with previous period
 */
export const MTTRCard = memo(({ data, config }: MTTRCardProps) => {
  const showTrend = config?.showTrend ?? true;
  const showByPriority = config?.showByPriority ?? true;
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Generate mock data if no real data available and demo mode is enabled
    const mockData: MTTRCardData = (demoMode && !data?.current) ? {
      current: {
        period: 'Last 7 days',
        mttr: 127, // 2h 7m
        mttrTarget: 180, // 3h target
        incidentCount: 23,
        resolvedCount: 21,
        avgResponseTime: 8, // 8 minutes
      },
      previous: {
        period: 'Previous 7 days',
        mttr: 145, // 2h 25m
        mttrTarget: 180,
        incidentCount: 28,
        resolvedCount: 26,
        avgResponseTime: 12,
      },
      trend: [
        { date: '2024-01-01', mttr: 165, count: 4 },
        { date: '2024-01-02', mttr: 152, count: 3 },
        { date: '2024-01-03', mttr: 140, count: 5 },
        { date: '2024-01-04', mttr: 135, count: 4 },
        { date: '2024-01-05', mttr: 128, count: 3 },
        { date: '2024-01-06', mttr: 125, count: 2 },
        { date: '2024-01-07', mttr: 127, count: 2 },
      ],
      byPriority: {
        critical: { mttr: 45, count: 3 },
        high: { mttr: 95, count: 8 },
        medium: { mttr: 180, count: 9 },
        low: { mttr: 360, count: 3 },
      },
    } : data;

    if (!mockData?.current) return null;

    const targetMet = mockData.current.mttrTarget
      ? mockData.current.mttr <= mockData.current.mttrTarget
      : undefined;

    const changeIndicator = mockData.previous
      ? getChangeIndicator(mockData.current.mttr, mockData.previous.mttr)
      : null;

    // Calculate resolution rate
    const resolutionRate = mockData.current.incidentCount > 0
      ? Math.round((mockData.current.resolvedCount / mockData.current.incidentCount) * 100)
      : 100;

    // Process trend for sparkline
    let trendPoints: { x: number; y: number }[] = [];
    let trendMax = 0;
    let trendMin = Infinity;
    if (mockData.trend && mockData.trend.length > 0) {
      trendMax = Math.max(...mockData.trend.map(t => t.mttr));
      trendMin = Math.min(...mockData.trend.map(t => t.mttr));
      const range = trendMax - trendMin || 1;

      trendPoints = mockData.trend.map((t, idx) => ({
        x: (idx / (mockData.trend!.length - 1)) * 100,
        y: 100 - ((t.mttr - trendMin) / range) * 80 - 10,
      }));
    }

    return {
      ...mockData,
      targetMet,
      changeIndicator,
      resolutionRate,
      trendPoints,
      trendMax,
      trendMin,
    };
  }, [data, demoMode]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No MTTR data available
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            MTTR Metrics
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {processedData.current.period}
          </span>
        </div>
      </div>

      {/* Main MTTR gauge */}
      <div className="flex-shrink-0 px-3 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          {/* MTTR value */}
          <div className="flex-1">
            <div className={`text-3xl font-bold tabular-nums ${
              processedData.targetMet === true
                ? 'text-emerald-600 dark:text-emerald-400'
                : processedData.targetMet === false
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-700 dark:text-slate-300'
            }`}>
              {formatDuration(processedData.current.mttr)}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Mean Time to Resolution
            </div>

            {/* Target indicator */}
            {processedData.current.mttrTarget && (
              <div className={`text-[10px] mt-1 ${
                processedData.targetMet
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {processedData.targetMet ? '✓' : '✗'} Target: {formatDuration(processedData.current.mttrTarget)}
              </div>
            )}

            {/* Change from previous */}
            {processedData.changeIndicator && (
              <div className={`text-[10px] mt-1 ${processedData.changeIndicator.color}`}>
                {processedData.changeIndicator.icon} {processedData.changeIndicator.text}
              </div>
            )}
          </div>

          {/* Stats column */}
          <div className="flex-shrink-0 space-y-2">
            <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {processedData.current.incidentCount}
              </div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Incidents</div>
            </div>
            <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className={`text-lg font-bold tabular-nums ${
                processedData.resolutionRate >= 90
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : processedData.resolutionRate >= 70
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {processedData.resolutionRate}%
              </div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Resolved</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trend sparkline */}
      {showTrend && processedData.trendPoints.length > 1 && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">
            MTTR Trend
          </div>
          <div className="h-12 relative">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              {/* Grid lines */}
              <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-700" />

              {/* Trend line */}
              <polyline
                points={processedData.trendPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-purple-500"
              />

              {/* Dots */}
              {processedData.trendPoints.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r="2"
                  fill="currentColor"
                  className="text-purple-500"
                />
              ))}
            </svg>

            {/* Min/Max labels */}
            <div className="absolute top-0 right-0 text-[8px] text-slate-400">
              {formatDurationShort(processedData.trendMax)}
            </div>
            <div className="absolute bottom-0 right-0 text-[8px] text-slate-400">
              {formatDurationShort(processedData.trendMin)}
            </div>
          </div>
        </div>
      )}

      {/* By priority breakdown */}
      {showByPriority && processedData.byPriority && (
        <div className="flex-1 overflow-auto p-3">
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-2">
            MTTR by Priority
          </div>
          <div className="space-y-2">
            {Object.entries(processedData.byPriority).map(([priority, metrics]) => (
              <div key={priority} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[priority]}`} />
                <div className="w-16 text-[10px] font-medium text-slate-700 dark:text-slate-300 capitalize">
                  {priority}
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${PRIORITY_COLORS[priority]}`}
                      style={{
                        width: `${Math.min((metrics.mttr / processedData.current.mttr) * 50, 100)}%`
                      }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right text-[10px] text-slate-600 dark:text-slate-400 tabular-nums">
                  {formatDurationShort(metrics.mttr)}
                </div>
                <div className="w-8 text-right text-[9px] text-slate-500 dark:text-slate-400 tabular-nums">
                  ({metrics.count})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response time */}
      {processedData.current.avgResponseTime !== undefined && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500 dark:text-slate-400">Avg Response Time</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatDuration(processedData.current.avgResponseTime)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

MTTRCard.displayName = 'MTTRCard';

export default MTTRCard;
