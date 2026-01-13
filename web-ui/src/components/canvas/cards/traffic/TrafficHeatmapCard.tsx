'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, type ActionState } from '@/services/cardActions';

interface TrafficDataPoint {
  hour: number;
  day: number;
  bytes: number;
  // Drill-down details
  applications?: Array<{ name: string; bytes: number }>;
  topClients?: Array<{ id: string; bytes: number }>;
}

interface TrafficHeatmapCardData {
  data?: TrafficDataPoint[];
  matrix?: number[][];
  networkId?: string;
  timeRange?: string;
  previousWeekData?: TrafficDataPoint[];
}

interface TrafficHeatmapCardProps {
  data: TrafficHeatmapCardData;
  config?: {
    colorScale?: 'blue' | 'green' | 'cyan' | 'purple';
  };
}

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const COLOR_SCALES = {
  cyan: {
    empty: '#1e293b',
    low: '#0e7490',
    mid: '#06b6d4',
    high: '#22d3ee',
    peak: '#a5f3fc',
  },
  blue: {
    empty: '#1e293b',
    low: '#1d4ed8',
    mid: '#3b82f6',
    high: '#60a5fa',
    peak: '#93c5fd',
  },
  green: {
    empty: '#1e293b',
    low: '#15803d',
    mid: '#22c55e',
    high: '#4ade80',
    peak: '#86efac',
  },
  purple: {
    empty: '#1e293b',
    low: '#7c3aed',
    mid: '#8b5cf6',
    high: '#a78bfa',
    peak: '#c4b5fd',
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getColorForValue(value: number, maxValue: number, colors: typeof COLOR_SCALES.cyan): string {
  if (value === 0) return colors.empty;
  const ratio = value / maxValue;
  if (ratio < 0.25) return colors.low;
  if (ratio < 0.5) return colors.mid;
  if (ratio < 0.75) return colors.high;
  return colors.peak;
}

function getPercentChange(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'same' } {
  if (previous === 0) return { value: 0, direction: 'same' };
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(change)),
    direction: change > 5 ? 'up' : change < -5 ? 'down' : 'same',
  };
}

/**
 * TrafficHeatmapCard - Interactive time-of-day traffic patterns
 *
 * Features:
 * - Click cell to zoom into time slot details
 * - Drill-down showing top applications and clients
 * - Week-over-week comparison toggle
 * - Peak hour highlighting
 * - "Schedule Policy" action for high-traffic periods
 */
export const TrafficHeatmapCard = memo(({ data, config }: TrafficHeatmapCardProps) => {
  const colorScale = config?.colorScale ?? 'cyan';
  const colors = COLOR_SCALES[colorScale];
  const { demoMode } = useDemoMode();

  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    // Initialize matrix with zeros
    const matrix: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    const dataMap = new Map<string, TrafficDataPoint>();
    let peakValue = 0;
    let peakHour = 0;
    let peakDay = 0;
    let totalBytes = 0;

    // Process data into matrix if available
    if (data?.data && data.data.length > 0) {
      for (const d of data.data) {
        matrix[d.day][d.hour] = d.bytes;
        dataMap.set(`${d.day}-${d.hour}`, d);
        if (d.bytes > peakValue) {
          peakValue = d.bytes;
          peakHour = d.hour;
          peakDay = d.day;
        }
        totalBytes += d.bytes;
      }
    } else if (data?.matrix && data.matrix.length > 0) {
      for (let day = 0; day < data.matrix.length && day < 7; day++) {
        for (let hour = 0; hour < (data.matrix[day]?.length || 0) && hour < 24; hour++) {
          const value = data.matrix[day][hour];
          matrix[day][hour] = value;
          if (value > peakValue) {
            peakValue = value;
            peakHour = hour;
            peakDay = day;
          }
          totalBytes += value;
        }
      }
    }

    // Generate mock data if no real data available and demo mode is enabled
    if (demoMode && peakValue === 0) {
      // Business hours pattern with weekend variance
      const baseTraffic = 500000000; // 500MB base
      for (let day = 0; day < 7; day++) {
        const isWeekend = day === 0 || day === 6;
        const dayMultiplier = isWeekend ? 0.3 : 1.0;
        for (let hour = 0; hour < 24; hour++) {
          // Business hours 9-17 have peak traffic
          let hourMultiplier = 0.1;
          if (hour >= 9 && hour <= 17) {
            hourMultiplier = 0.8 + Math.random() * 0.4; // 80-120% of base
          } else if (hour >= 6 && hour <= 21) {
            hourMultiplier = 0.3 + Math.random() * 0.2; // 30-50% of base
          } else {
            hourMultiplier = 0.05 + Math.random() * 0.1; // 5-15% of base
          }
          const value = Math.floor(baseTraffic * dayMultiplier * hourMultiplier * (0.8 + Math.random() * 0.4));
          matrix[day][hour] = value;
          totalBytes += value;
          if (value > peakValue) {
            peakValue = value;
            peakHour = hour;
            peakDay = day;
          }
        }
      }
    }

    // Return null if still no data after demo mode check
    if (peakValue === 0) return null;

    // Process previous week for comparison
    let prevMatrix: number[][] | null = null;
    let prevTotalBytes = 0;
    if (data?.previousWeekData) {
      prevMatrix = Array(7).fill(null).map(() => Array(24).fill(0));
      for (const d of data.previousWeekData) {
        prevMatrix[d.day][d.hour] = d.bytes;
        prevTotalBytes += d.bytes;
      }
    }

    // Calculate hourly and daily totals
    const hourlyTotals = Array(24).fill(0);
    const dailyTotals = Array(7).fill(0);
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        hourlyTotals[hour] += matrix[day][hour];
        dailyTotals[day] += matrix[day][hour];
      }
    }

    // Find peak hour and day
    const peakHourlyIdx = hourlyTotals.indexOf(Math.max(...hourlyTotals));
    const peakDailyIdx = dailyTotals.indexOf(Math.max(...dailyTotals));

    return {
      matrix,
      dataMap,
      prevMatrix,
      peakHour,
      peakDay,
      peakValue,
      totalBytes,
      prevTotalBytes,
      hourlyTotals,
      dailyTotals,
      peakHourlyIdx,
      peakDailyIdx,
    };
  }, [data, demoMode]);

  const handleCellClick = useCallback((day: number, hour: number) => {
    setSelectedCell(prev =>
      prev?.day === day && prev?.hour === hour ? null : { day, hour }
    );
  }, []);

  const handleAction = useCallback(async (action: string) => {
    if (!selectedCell) return;

    setActionState({ status: 'loading', message: `Executing ${action}...` });

    if (action === 'schedule') {
      const result = await executeCardAction('schedule-policy', {
        day: DAYS_FULL[selectedCell.day],
        hour: selectedCell.hour,
        networkId: data?.networkId,
      });

      if (result.success) {
        setActionState({ status: 'success', message: `Policy scheduled for ${DAYS_FULL[selectedCell.day]} ${HOURS[selectedCell.hour]}` });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } else if (action === 'alert') {
      const result = await executeCardAction('create-alert', {
        day: selectedCell.day,
        hour: selectedCell.hour,
        threshold: processedData?.matrix[selectedCell.day][selectedCell.hour],
        networkId: data?.networkId,
      });

      if (result.success) {
        setActionState({ status: 'success', message: 'Traffic alert configured' });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [selectedCell, data?.networkId, processedData?.matrix]);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <svg className="w-12 h-12 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9M15 21V9" />
        </svg>
        <span className="text-sm">No traffic pattern data</span>
      </div>
    );
  }

  const selectedData = selectedCell
    ? processedData.dataMap.get(`${selectedCell.day}-${selectedCell.hour}`)
    : null;
  const selectedValue = selectedCell
    ? processedData.matrix[selectedCell.day][selectedCell.hour]
    : 0;
  const prevSelectedValue = selectedCell && processedData.prevMatrix
    ? processedData.prevMatrix[selectedCell.day][selectedCell.hour]
    : 0;

  const weekChange = processedData.prevTotalBytes > 0
    ? getPercentChange(processedData.totalBytes, processedData.prevTotalBytes)
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Traffic Heatmap
          </span>
          <div className="flex items-center gap-2">
            {processedData.prevMatrix && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                  showComparison
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Compare
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="flex-shrink-0 px-3 py-2 grid grid-cols-3 gap-2 border-b border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {formatBytes(processedData.totalBytes)}
          </div>
          <div className="flex items-center justify-center gap-1">
            <span className="text-[8px] text-slate-500 dark:text-slate-400 uppercase">Total</span>
            {weekChange && weekChange.direction !== 'same' && (
              <span className={`text-[8px] ${weekChange.direction === 'up' ? 'text-red-500' : 'text-emerald-500'}`}>
                {weekChange.direction === 'up' ? '+' : '-'}{weekChange.value}%
              </span>
            )}
          </div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-bold ${colorScale === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {DAYS[processedData.peakDay]} {HOURS[processedData.peakHour]}
          </div>
          <div className="text-[8px] text-slate-500 dark:text-slate-400 uppercase">Peak Time</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {formatBytes(processedData.peakValue)}
          </div>
          <div className="text-[8px] text-slate-500 dark:text-slate-400 uppercase">Peak Traffic</div>
        </div>
      </div>

      {/* Heatmap visualization */}
      <div className="flex-1 overflow-auto p-2">
        <div className="flex">
          {/* Day labels */}
          <div className="flex flex-col justify-center mr-1 pt-4">
            {DAYS.map((day, idx) => (
              <div
                key={day}
                className={`h-4 flex items-center text-[8px] leading-none ${
                  idx === processedData.peakDailyIdx
                    ? `font-bold ${colorScale === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-blue-600 dark:text-blue-400'}`
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1">
            {/* Hour labels */}
            <div className="flex mb-1">
              {HOURS.filter((_, i) => i % 4 === 0).map((hour, idx) => (
                <div
                  key={hour}
                  className={`flex-1 text-[7px] text-center ${
                    idx * 4 === processedData.peakHourlyIdx
                      ? `font-bold ${colorScale === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-blue-600 dark:text-blue-400'}`
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                  style={{ width: `${100 / 6}%` }}
                >
                  {hour}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="space-y-0.5">
              {processedData.matrix.map((row, dayIdx) => (
                <div key={dayIdx} className="flex gap-0.5">
                  {row.map((value, hourIdx) => {
                    const isSelected = selectedCell?.day === dayIdx && selectedCell?.hour === hourIdx;
                    const isHovered = hoveredCell?.day === dayIdx && hoveredCell?.hour === hourIdx;
                    const isPeak = dayIdx === processedData.peakDay && hourIdx === processedData.peakHour;
                    const prevValue = processedData.prevMatrix?.[dayIdx]?.[hourIdx] ?? 0;
                    const change = showComparison && prevValue > 0
                      ? getPercentChange(value, prevValue)
                      : null;

                    return (
                      <div
                        key={hourIdx}
                        onClick={() => handleCellClick(dayIdx, hourIdx)}
                        onMouseEnter={() => setHoveredCell({ day: dayIdx, hour: hourIdx })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`flex-1 h-4 rounded-sm cursor-pointer transition-all duration-150 relative
                          ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110 z-10' : ''}
                          ${isHovered && !isSelected ? 'scale-105 z-5' : ''}`}
                        style={{
                          backgroundColor: getColorForValue(value, processedData.peakValue, colors),
                        }}
                        title={`${DAYS_FULL[dayIdx]} ${HOURS[hourIdx]}: ${formatBytes(value)}`}
                      >
                        {isPeak && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                        )}
                        {showComparison && change && change.direction !== 'same' && (
                          <div className={`absolute inset-0 flex items-center justify-center text-[6px] font-bold
                            ${change.direction === 'up' ? 'text-red-300' : 'text-emerald-300'}`}>
                            {change.direction === 'up' ? '!' : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Color legend */}
        <div className="mt-2 flex items-center justify-center gap-1">
          <span className="text-[8px] text-slate-400">Low</span>
          <div className="flex gap-0.5">
            {[colors.low, colors.mid, colors.high, colors.peak].map((color, idx) => (
              <div key={idx} className="w-4 h-2 rounded-sm" style={{ backgroundColor: color }} />
            ))}
          </div>
          <span className="text-[8px] text-slate-400">High</span>
        </div>
      </div>

      {/* Drill-down panel */}
      {selectedCell && (
        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {DAYS_FULL[selectedCell.day]} {HOURS[selectedCell.hour]}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${colorScale === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {formatBytes(selectedValue)}
                </span>
                {showComparison && prevSelectedValue > 0 && (
                  <span className={`text-[9px] ${
                    selectedValue > prevSelectedValue ? 'text-red-500' : 'text-emerald-500'
                  }`}>
                    ({selectedValue > prevSelectedValue ? '+' : ''}{Math.round((selectedValue - prevSelectedValue) / prevSelectedValue * 100)}%)
                  </span>
                )}
              </div>
            </div>

            {/* Applications breakdown */}
            {selectedData?.applications && selectedData.applications.length > 0 && (
              <div className="mb-2">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">Top Applications</div>
                <div className="space-y-1">
                  {selectedData.applications.slice(0, 3).map((app, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-600 dark:text-slate-400">{app.name}</span>
                      <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
                        {formatBytes(app.bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top clients */}
            {selectedData?.topClients && selectedData.topClients.length > 0 && (
              <div className="mb-2">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">Top Clients</div>
                <div className="flex gap-1">
                  {selectedData.topClients.slice(0, 3).map((client, idx) => (
                    <div key={idx} className="flex-1 p-1 bg-white dark:bg-slate-700 rounded text-center">
                      <div className="text-[8px] text-slate-500 truncate">{client.id.slice(-6)}</div>
                      <div className="text-[9px] font-medium text-slate-700 dark:text-slate-300">
                        {formatBytes(client.bytes)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Feedback */}
            {actionState.status !== 'idle' && (
              <div className={`mt-2 px-2 py-1.5 rounded text-[10px] flex items-center gap-2 ${
                actionState.status === 'loading' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                actionState.status === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
              }`}>
                {actionState.status === 'loading' && (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                <span>{actionState.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleAction('schedule')}
                className="flex-1 px-2 py-1 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
              >
                Schedule Policy
              </button>
              <button
                onClick={() => handleAction('alert')}
                className="px-2 py-1 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Set Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredCell && !selectedCell && (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-600 dark:text-slate-400">
              {DAYS_FULL[hoveredCell.day]} {HOURS[hoveredCell.hour]}
            </span>
            <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
              {formatBytes(processedData.matrix[hoveredCell.day][hoveredCell.hour])}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

TrafficHeatmapCard.displayName = 'TrafficHeatmapCard';

export default TrafficHeatmapCard;
