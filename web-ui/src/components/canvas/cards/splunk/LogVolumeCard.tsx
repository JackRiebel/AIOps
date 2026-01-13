'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface VolumeDataPoint {
  timestamp: string;
  count: number;
  bytes?: number;
  source?: string;
  isAnomaly?: boolean;
  anomalyType?: 'spike' | 'drop' | 'pattern';
  expectedCount?: number;
}

interface LogSource {
  name: string;
  count: number;
  percentage: number;
  color: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface Anomaly {
  id: string;
  timestamp: string;
  type: 'spike' | 'drop' | 'pattern';
  severity: 'critical' | 'warning' | 'info';
  actualCount: number;
  expectedCount: number;
  deviation: number;
  description: string;
  source?: string;
}

interface LogVolumeCardData {
  timeseries?: VolumeDataPoint[];
  data?: VolumeDataPoint[];
  sources?: LogSource[];
  anomalies?: Anomaly[];
  totalEvents?: number;
  totalBytes?: number;
  avgEventsPerHour?: number;
  peakEventsPerHour?: number;
  timeRange?: string;
  index?: string;
  sourcetype?: string;
  baselineAvg?: number;
  standardDeviation?: number;
}

interface LogVolumeCardProps {
  data: LogVolumeCardData;
  config?: {
    showBytes?: boolean;
    showAnomalies?: boolean;
  };
  onAction?: (action: string, payload?: Record<string, unknown>) => void;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const SOURCE_COLORS = [
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

/**
 * LogVolumeCard - Interactive log volume analysis with anomaly detection
 *
 * Features:
 * - Time-series area chart with anomaly highlighting
 * - Source breakdown with filtering
 * - Anomaly detection with severity levels
 * - Trend analysis and baseline comparison
 * - Interactive tooltips and drill-down
 */
export const LogVolumeCard = memo(({ data, config, onAction }: LogVolumeCardProps) => {
  const { demoMode } = useDemoMode();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'sources' | 'anomalies'>('chart');
  const [showBaseline, setShowBaseline] = useState(true);

  // Generate mock data if not provided and demo mode is enabled
  const processedData = useMemo(() => {
    const timeseries = data?.timeseries || data?.data || [];

    // Return null if no data and demo mode is off
    if (timeseries.length === 0 && !demoMode) return null;

    // Generate mock timeseries if none provided and demo mode is on
    const mockTimeseries: VolumeDataPoint[] = timeseries.length > 0 ? timeseries :
      Array.from({ length: 24 }, (_, i) => {
        const baseCount = 1000 + Math.random() * 500;
        const hour = new Date();
        hour.setHours(hour.getHours() - (23 - i));
        const isAnomaly = i === 8 || i === 15; // Add some anomalies
        return {
          timestamp: hour.toISOString(),
          count: isAnomaly ? (i === 8 ? baseCount * 3 : baseCount * 0.3) : baseCount,
          isAnomaly,
          anomalyType: isAnomaly ? (i === 8 ? 'spike' : 'drop') : undefined,
          expectedCount: baseCount,
        };
      });

    // Generate mock sources if none provided
    const sources: LogSource[] = data?.sources || [
      { name: 'syslog', count: 45230, percentage: 35, color: SOURCE_COLORS[0], trend: 'up', trendValue: 12 },
      { name: 'application', count: 32100, percentage: 25, color: SOURCE_COLORS[1], trend: 'stable', trendValue: 2 },
      { name: 'security', count: 25800, percentage: 20, color: SOURCE_COLORS[2], trend: 'up', trendValue: 8 },
      { name: 'network', count: 15480, percentage: 12, color: SOURCE_COLORS[3], trend: 'down', trendValue: -5 },
      { name: 'database', count: 10320, percentage: 8, color: SOURCE_COLORS[4], trend: 'stable', trendValue: 1 },
    ];

    // Generate mock anomalies if none provided
    const anomalies: Anomaly[] = data?.anomalies || [
      {
        id: 'a1',
        timestamp: mockTimeseries[8]?.timestamp || new Date().toISOString(),
        type: 'spike',
        severity: 'critical',
        actualCount: 3500,
        expectedCount: 1200,
        deviation: 192,
        description: 'Log volume spike - 3x normal rate',
        source: 'syslog',
      },
      {
        id: 'a2',
        timestamp: mockTimeseries[15]?.timestamp || new Date().toISOString(),
        type: 'drop',
        severity: 'warning',
        actualCount: 380,
        expectedCount: 1150,
        deviation: -67,
        description: 'Log volume drop - potential logging failure',
        source: 'application',
      },
      {
        id: 'a3',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'pattern',
        severity: 'info',
        actualCount: 1800,
        expectedCount: 1500,
        deviation: 20,
        description: 'Unusual pattern detected in log frequency',
        source: 'network',
      },
    ];

    // Calculate stats
    const counts = mockTimeseries.map(p => p.count);
    const totalEvents = data?.totalEvents ?? counts.reduce((sum, c) => sum + c, 0);
    const avgCount = data?.avgEventsPerHour ?? (counts.length > 0 ? totalEvents / counts.length : 0);
    const peakCount = data?.peakEventsPerHour ?? Math.max(...counts);
    const maxCount = Math.max(...counts, 1);

    // Calculate baseline (average without anomalies)
    const normalCounts = mockTimeseries.filter(p => !p.isAnomaly).map(p => p.count);
    const baselineAvg = data?.baselineAvg ?? (normalCounts.length > 0 ?
      normalCounts.reduce((a, b) => a + b, 0) / normalCounts.length : avgCount);

    // Calculate standard deviation
    const variance = normalCounts.reduce((sum, c) => sum + Math.pow(c - baselineAvg, 2), 0) / normalCounts.length;
    const stdDev = data?.standardDeviation ?? Math.sqrt(variance);

    // Process points for chart
    const points = mockTimeseries.map((p, idx) => ({
      x: (idx / (mockTimeseries.length - 1 || 1)) * 100,
      y: 100 - (p.count / maxCount) * 75 - 10,
      count: p.count,
      timestamp: p.timestamp,
      isAnomaly: p.isAnomaly || (p.count > baselineAvg + 2 * stdDev) || (p.count < baselineAvg - 2 * stdDev),
      anomalyType: p.anomalyType || (p.count > baselineAvg + 2 * stdDev ? 'spike' :
                   p.count < baselineAvg - 2 * stdDev ? 'drop' : undefined),
      source: p.source,
    }));

    // Create paths
    let linePath = '';
    let areaPath = '';
    if (points.length > 1) {
      linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      areaPath = `${linePath} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;
    }

    // Baseline Y position
    const baselineY = 100 - (baselineAvg / maxCount) * 75 - 10;

    return {
      timeseries: mockTimeseries,
      sources,
      anomalies,
      points,
      linePath,
      areaPath,
      totalEvents,
      avgCount,
      peakCount,
      maxCount,
      baselineAvg,
      baselineY,
      stdDev,
      criticalCount: anomalies.filter(a => a.severity === 'critical').length,
      warningCount: anomalies.filter(a => a.severity === 'warning').length,
    };
  }, [data, demoMode]);

  // Filter points by selected source
  const filteredPoints = useMemo(() => {
    if (!processedData) return [];
    if (!selectedSource) return processedData.points;
    return processedData.points.filter(p => !p.source || p.source === selectedSource);
  }, [processedData, selectedSource]);

  // Handlers
  const handleSourceClick = useCallback((sourceName: string) => {
    setSelectedSource(prev => prev === sourceName ? null : sourceName);
  }, []);

  const handleAnomalyClick = useCallback((anomaly: Anomaly) => {
    setSelectedAnomaly(prev => prev?.id === anomaly.id ? null : anomaly);
  }, []);

  const handleAction = useCallback((action: string, payload?: Record<string, unknown>) => {
    onAction?.(action, payload);
  }, [onAction]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-100 dark:bg-red-900/40';
      case 'warning': return 'text-amber-500 bg-amber-100 dark:bg-amber-900/40';
      default: return 'text-blue-500 bg-blue-100 dark:bg-blue-900/40';
    }
  };

  const getAnomalyIcon = (type: string) => {
    switch (type) {
      case 'spike': return '↑';
      case 'drop': return '↓';
      default: return '~';
    }
  };

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No volume data
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Log Volume
            </span>
            {processedData.criticalCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                {processedData.criticalCount} Critical
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {['chart', 'sources', 'anomalies'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as typeof viewMode)}
                className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
                  viewMode === mode
                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex-shrink-0 px-3 py-2 grid grid-cols-4 gap-2 border-b border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400 tabular-nums">
            {formatNumber(processedData.totalEvents)}
          </div>
          <div className="text-[8px] text-slate-500 dark:text-slate-400 uppercase">Total</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">
            {formatNumber(Math.round(processedData.avgCount))}
          </div>
          <div className="text-[8px] text-slate-500 dark:text-slate-400 uppercase">Avg/Hour</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatNumber(processedData.peakCount)}
          </div>
          <div className="text-[8px] text-slate-500 dark:text-slate-400 uppercase">Peak</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-500 tabular-nums">
            {processedData.anomalies.length}
          </div>
          <div className="text-[8px] text-slate-500 dark:text-slate-400 uppercase">Anomalies</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'chart' && (
          <div className="h-full flex flex-col">
            {/* Chart Controls */}
            <div className="flex-shrink-0 px-3 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBaseline}
                    onChange={(e) => setShowBaseline(e.target.checked)}
                    className="w-3 h-3 rounded text-purple-600"
                  />
                  Show Baseline
                </label>
              </div>
              {selectedSource && (
                <button
                  onClick={() => setSelectedSource(null)}
                  className="text-[9px] text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Clear Filter
                </button>
              )}
            </div>

            {/* Chart Area */}
            <div className="flex-1 min-h-0 p-3 relative">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                {/* Grid lines */}
                {[25, 50, 75].map(y => (
                  <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="currentColor" strokeWidth="0.2"
                        className="text-slate-200 dark:text-slate-700" />
                ))}

                {/* Gradient definition */}
                <defs>
                  <linearGradient id="logVolumeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0.05" />
                  </linearGradient>
                  <linearGradient id="anomalyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgb(239, 68, 68)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(239, 68, 68)" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Baseline area (±1 std dev) */}
                {showBaseline && processedData.baselineY && (
                  <>
                    <rect
                      x="0"
                      y={Math.max(0, processedData.baselineY - 10)}
                      width="100"
                      height="20"
                      fill="rgb(34, 197, 94)"
                      fillOpacity="0.1"
                    />
                    <line
                      x1="0" y1={processedData.baselineY}
                      x2="100" y2={processedData.baselineY}
                      stroke="rgb(34, 197, 94)"
                      strokeWidth="0.5"
                      strokeDasharray="2,2"
                    />
                  </>
                )}

                {/* Area fill */}
                {processedData.areaPath && (
                  <path d={processedData.areaPath} fill="url(#logVolumeGradient)" />
                )}

                {/* Main line */}
                {processedData.linePath && (
                  <path
                    d={processedData.linePath}
                    fill="none"
                    stroke="rgb(139, 92, 246)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data points */}
                {filteredPoints.map((p, idx) => (
                  <g key={idx}>
                    {/* Anomaly highlight */}
                    {p.isAnomaly && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill={p.anomalyType === 'spike' ? 'rgb(239, 68, 68)' : 'rgb(245, 158, 11)'}
                        fillOpacity="0.3"
                        className=""
                        style={{ }}
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={hoveredPoint === idx ? 3 : p.isAnomaly ? 2.5 : 1.5}
                      fill={p.isAnomaly ? (p.anomalyType === 'spike' ? 'rgb(239, 68, 68)' : 'rgb(245, 158, 11)') : 'rgb(139, 92, 246)'}
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredPoint(idx)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  </g>
                ))}
              </svg>

              {/* Hover tooltip */}
              {hoveredPoint !== null && filteredPoints[hoveredPoint] && (
                <div
                  className="absolute z-10 bg-slate-800 text-white px-2 py-1 rounded shadow-lg text-[10px] pointer-events-none"
                  style={{
                    left: `${filteredPoints[hoveredPoint].x}%`,
                    top: `${filteredPoints[hoveredPoint].y}%`,
                    transform: 'translate(-50%, -120%)',
                  }}
                >
                  <div className="font-medium">{formatNumber(filteredPoints[hoveredPoint].count)} events</div>
                  <div className="text-slate-300">{formatTimestamp(filteredPoints[hoveredPoint].timestamp)}</div>
                  {filteredPoints[hoveredPoint].isAnomaly && (
                    <div className="text-red-400 flex items-center gap-1">
                      <span>{getAnomalyIcon(filteredPoints[hoveredPoint].anomalyType || 'pattern')}</span>
                      <span>Anomaly detected</span>
                    </div>
                  )}
                </div>
              )}

              {/* Y-axis labels */}
              <div className="absolute top-0 left-1 text-[8px] text-slate-400 dark:text-slate-500">
                {formatNumber(processedData.maxCount)}
              </div>
              <div className="absolute bottom-0 left-1 text-[8px] text-slate-400 dark:text-slate-500">
                0
              </div>
            </div>

            {/* Legend */}
            <div className="flex-shrink-0 px-3 py-1.5 flex items-center justify-center gap-4 border-t border-slate-100 dark:border-slate-800 text-[9px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-slate-500 dark:text-slate-400">Normal</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-slate-500 dark:text-slate-400">Spike</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-500 dark:text-slate-400">Drop</span>
              </div>
              {showBaseline && (
                <div className="flex items-center gap-1">
                  <div className="w-4 h-0.5 bg-green-500 opacity-50" style={{ borderTop: '1px dashed' }} />
                  <span className="text-slate-500 dark:text-slate-400">Baseline</span>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'sources' && (
          <div className="h-full flex flex-col">
            {/* Source Breakdown */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {processedData.sources.map((source, idx) => (
                <button
                  key={source.name}
                  onClick={() => handleSourceClick(source.name)}
                  className={`w-full p-2 rounded-lg border transition-all text-left ${
                    selectedSource === source.name
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: source.color }} />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {source.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] ${
                        source.trend === 'up' ? 'text-green-500' :
                        source.trend === 'down' ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {source.trend === 'up' ? '↑' : source.trend === 'down' ? '↓' : '→'}
                        {Math.abs(source.trendValue)}%
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                        {formatNumber(source.count)}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${source.percentage}%`, backgroundColor: source.color }}
                    />
                  </div>
                  <div className="mt-1 text-[9px] text-slate-500 dark:text-slate-400 text-right">
                    {source.percentage}% of total
                  </div>
                </button>
              ))}
            </div>

            {/* Source Summary */}
            <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 dark:text-slate-400">
                  {processedData.sources.length} log sources
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Click to filter chart view
                </span>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'anomalies' && (
          <div className="h-full flex flex-col">
            {/* Anomaly List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {processedData.anomalies.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                  <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs">No anomalies detected</div>
                </div>
              ) : (
                processedData.anomalies.map(anomaly => (
                  <button
                    key={anomaly.id}
                    onClick={() => handleAnomalyClick(anomaly)}
                    className={`w-full p-2 rounded-lg border transition-all text-left ${
                      selectedAnomaly?.id === anomaly.id
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${getSeverityColor(anomaly.severity)}`}>
                        {getAnomalyIcon(anomaly.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getSeverityColor(anomaly.severity)}`}>
                            {anomaly.severity.toUpperCase()}
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400">
                            {formatTimestamp(anomaly.timestamp)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
                          {anomaly.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500 dark:text-slate-400">
                          <span>Actual: <span className="font-medium text-slate-700 dark:text-slate-300">{formatNumber(anomaly.actualCount)}</span></span>
                          <span>Expected: <span className="font-medium">{formatNumber(anomaly.expectedCount)}</span></span>
                          <span className={anomaly.deviation > 0 ? 'text-red-500' : 'text-amber-500'}>
                            {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Anomaly Detail */}
            {selectedAnomaly && (
              <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Anomaly Details
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Type:</span>
                    <span className="ml-1 font-medium text-slate-700 dark:text-slate-300 capitalize">{selectedAnomaly.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Source:</span>
                    <span className="ml-1 font-medium text-slate-700 dark:text-slate-300">{selectedAnomaly.source || 'All'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Deviation:</span>
                    <span className={`ml-1 font-medium ${selectedAnomaly.deviation > 0 ? 'text-red-500' : 'text-amber-500'}`}>
                      {selectedAnomaly.deviation > 0 ? '+' : ''}{selectedAnomaly.deviation}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Std Dev:</span>
                    <span className="ml-1 font-medium text-slate-700 dark:text-slate-300">
                      {Math.abs(selectedAnomaly.deviation / 50).toFixed(1)}σ
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleAction('investigate', { anomalyId: selectedAnomaly.id })}
                    className="flex-1 px-2 py-1 text-[9px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                  >
                    Investigate
                  </button>
                  <button
                    onClick={() => handleAction('dismiss', { anomalyId: selectedAnomaly.id })}
                    className="px-2 py-1 text-[9px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAction('set-alert')}
              className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
              title="Set Volume Alert"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <button
              onClick={() => handleAction('configure-baseline')}
              className="p-1.5 text-slate-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
              title="Configure Baseline"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => handleAction('run-search')}
              className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
              title="Run Splunk Search"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAction('refresh')}
              className="px-2 py-1 text-[9px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => handleAction('export')}
              className="px-2 py-1 text-[9px] font-medium bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
            >
              Export
            </button>
          </div>
        </div>
        {data?.timeRange && (
          <div className="text-[9px] text-slate-400 dark:text-slate-500 text-center mt-1">
            {data.timeRange}
          </div>
        )}
      </div>
    </div>
  );
});

LogVolumeCard.displayName = 'LogVolumeCard';

export default LogVolumeCard;
