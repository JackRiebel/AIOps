'use client';

import { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface SeverityLevel {
  level: 'critical' | 'error' | 'warning' | 'info' | 'debug' | 'trace';
  count: number;
  percentage?: number;
  trend?: 'up' | 'down' | 'stable';
  delta?: number;  // Change from previous period
}

interface LogSeverityCardData {
  levels?: SeverityLevel[];
  severity?: SeverityLevel[];
  totalLogs?: number;
  timeRange?: string;
  index?: string;
  previousPeriod?: {
    totalLogs: number;
    levels: SeverityLevel[];
  };
}

interface LogSeverityCardProps {
  data: LogSeverityCardData;
  config?: {
    showTrends?: boolean;
  };
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; barColor: string }> = {
  critical: { label: 'Critical', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40', barColor: 'bg-red-500' },
  error: { label: 'Error', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-900/40', barColor: 'bg-orange-500' },
  warning: { label: 'Warning', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/40', barColor: 'bg-amber-500' },
  info: { label: 'Info', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/40', barColor: 'bg-blue-500' },
  debug: { label: 'Debug', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700', barColor: 'bg-slate-400' },
  trace: { label: 'Trace', color: 'text-slate-500 dark:text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800', barColor: 'bg-slate-300' },
};

const SEVERITY_ORDER = ['critical', 'error', 'warning', 'info', 'debug', 'trace'];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * LogSeverityCard - Logs by severity level
 *
 * Shows:
 * - Stacked bar of severity distribution
 * - Count per severity level
 * - Trend indicators vs previous period
 */
export const LogSeverityCard = memo(({ data, config }: LogSeverityCardProps) => {
  const showTrends = config?.showTrends ?? true;
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Generate mock data if no real data and demo mode is enabled
    if ((!data || (!data.levels?.length && !data.severity?.length)) && demoMode) {
      const mockLevels: SeverityLevel[] = [
        { level: 'critical', count: 45, trend: 'up', delta: 12 },
        { level: 'error', count: 234, trend: 'down', delta: -8 },
        { level: 'warning', count: 890, trend: 'stable', delta: 2 },
        { level: 'info', count: 12500, trend: 'up', delta: 5 },
        { level: 'debug', count: 8900, trend: 'stable', delta: 0 },
      ];
      const totalLogs = mockLevels.reduce((sum, l) => sum + l.count, 0);
      const maxCount = Math.max(...mockLevels.map(l => l.count));
      const criticalErrorCount = mockLevels.filter(l => l.level === 'critical' || l.level === 'error').reduce((sum, l) => sum + l.count, 0);
      return {
        levels: mockLevels.map(l => ({
          ...l,
          percentage: (l.count / totalLogs) * 100,
          config: SEVERITY_CONFIG[l.level] || SEVERITY_CONFIG.info,
        })),
        totalLogs,
        maxCount,
        criticalRatio: (criticalErrorCount / totalLogs) * 100,
        criticalErrorCount,
      };
    }

    if (!data) return null;

    const levels = data.levels || data.severity || [];
    if (levels.length === 0) return null;

    const totalLogs = data.totalLogs ?? levels.reduce((sum, l) => sum + l.count, 0);

    // Sort by severity order and calculate percentages
    const sorted = SEVERITY_ORDER
      .map(level => {
        const found = levels.find(l => l.level === level);
        return found ? {
          ...found,
          percentage: found.percentage ?? (totalLogs > 0 ? (found.count / totalLogs) * 100 : 0),
          config: SEVERITY_CONFIG[level] || SEVERITY_CONFIG.info,
        } : null;
      })
      .filter((l): l is NonNullable<typeof l> => l !== null && l.count > 0);

    const maxCount = Math.max(...sorted.map(l => l.count), 1);

    // Calculate critical ratio (critical + error / total)
    const criticalErrorCount = sorted
      .filter(l => l.level === 'critical' || l.level === 'error')
      .reduce((sum, l) => sum + l.count, 0);
    const criticalRatio = totalLogs > 0 ? (criticalErrorCount / totalLogs) * 100 : 0;

    return {
      levels: sorted,
      totalLogs,
      maxCount,
      criticalRatio,
      criticalErrorCount,
    };
  }, [data]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No severity data
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Log Severity
          </span>
          {data.index && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
              {data.index}
            </span>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex-shrink-0 px-3 py-2 grid grid-cols-2 gap-2 border-b border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="text-xl font-bold text-slate-700 dark:text-slate-300 tabular-nums">
            {formatNumber(processedData.totalLogs)}
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Total Logs</div>
        </div>
        <div className="text-center">
          <div className={`text-xl font-bold tabular-nums ${
            processedData.criticalRatio > 10
              ? 'text-red-600 dark:text-red-400'
              : processedData.criticalRatio > 5
              ? 'text-orange-600 dark:text-orange-400'
              : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {processedData.criticalRatio.toFixed(1)}%
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Error Rate</div>
        </div>
      </div>

      {/* Stacked bar visualization */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="h-4 flex rounded overflow-hidden">
          {processedData.levels.map((level) => (
            <div
              key={level.level}
              className={`${level.config.barColor} transition-all duration-300`}
              style={{ width: `${level.percentage}%` }}
              title={`${level.config.label}: ${level.percentage.toFixed(1)}%`}
            />
          ))}
        </div>
      </div>

      {/* Severity breakdown */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-2">
          {processedData.levels.map((level) => (
            <div key={level.level} className="flex items-center gap-2">
              {/* Color indicator */}
              <div className={`w-3 h-3 rounded-sm ${level.config.barColor} flex-shrink-0`} />

              {/* Label */}
              <div className="w-16 flex-shrink-0">
                <span className={`text-[11px] font-medium ${level.config.color}`}>
                  {level.config.label}
                </span>
              </div>

              {/* Bar */}
              <div className="flex-1">
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${level.config.barColor}`}
                    style={{ width: `${(level.count / processedData.maxCount) * 100}%` }}
                  />
                </div>
              </div>

              {/* Count */}
              <div className="w-14 text-right">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                  {formatNumber(level.count)}
                </span>
              </div>

              {/* Percentage */}
              <div className="w-12 text-right">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {level.percentage.toFixed(1)}%
                </span>
              </div>

              {/* Trend */}
              {showTrends && level.trend && (
                <div className="w-4 text-center">
                  <span className={`text-[10px] ${
                    level.trend === 'up' && (level.level === 'critical' || level.level === 'error')
                      ? 'text-red-500'
                      : level.trend === 'up'
                      ? 'text-amber-500'
                      : level.trend === 'down' && (level.level === 'critical' || level.level === 'error')
                      ? 'text-emerald-500'
                      : level.trend === 'down'
                      ? 'text-blue-500'
                      : 'text-slate-400'
                  }`}>
                    {level.trend === 'up' ? '↑' : level.trend === 'down' ? '↓' : '→'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Time range */}
      {data.timeRange && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
            {data.timeRange}
          </div>
        </div>
      )}
    </div>
  );
});

LogSeverityCard.displayName = 'LogSeverityCard';

export default LogSeverityCard;
