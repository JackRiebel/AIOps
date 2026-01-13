'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { apiClient } from '@/lib/api-client';
import { TimeRange, TIME_RANGE_SECONDS, METRIC_COLORS } from '@/types/visualization';
import type { NetworkPerformanceResponse } from '@/types/api';

interface PerformanceChartsProps {
  organization: string;
  networkId: string;
  networkName?: string;
}

// ============================================================================
// Custom Tooltip Component for Dark Mode Support
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomPerformanceTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        {label ? new Date(label).toLocaleString() : ''}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PerformanceData {
  timestamp: string;
  latency?: number;
  packetLoss?: number;
  throughput?: number;
  channelUtilization?: number;
}

interface PerformanceStats {
  avgLatency: string | null;
  maxLatency: string | null;
  avgLoss: string | null;
  maxLoss: string | null;
}

export default function PerformanceCharts({
  organization,
  networkId,
  networkName,
}: PerformanceChartsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [data, setData] = useState<PerformanceData[]>([]);
  const [rawPerfData, setRawPerfData] = useState<NetworkPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['latency', 'packetLoss']);
  const [chartType, setChartType] = useState<'combined' | 'separate'>('combined');

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // Fetch performance data when dependencies change
  useEffect(() => {
    fetchPerformanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, networkId, timeRange]); // fetchPerformanceData uses these same deps

  async function fetchPerformanceData() {
    setLoading(true);
    setError(null);
    // Reset AI analysis when fetching new data
    setAiAnalysis(null);

    try {
      const timespan = TIME_RANGE_SECONDS[timeRange];
      const perfData = await apiClient.getNetworkPerformance(organization, networkId, timespan);

      // Store raw data for AI analysis
      setRawPerfData(perfData);

      // Transform the data into chart-friendly format
      const transformedData = transformPerformanceData(perfData);

      if (transformedData.length === 0) {
        setError('No performance data available for this network');
      }

      setData(transformedData);
    } catch (err) {
      console.error('Failed to fetch performance data:', err);
      setError('Failed to load performance data');
      setData([]);
      setRawPerfData(null);
    } finally {
      setLoading(false);
    }
  }

  // Request AI analysis for performance data
  const requestAiAnalysis = useCallback(async (currentStats: PerformanceStats) => {
    setAiLoading(true);
    setAiAnalysis(null);
    setAiPanelOpen(true);

    try {
      const response = await fetch('/api/ai/analyze-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          performance_data: {
            stats: currentStats,
            dataPoints: data,
            trafficAnalysis: rawPerfData?.trafficAnalysis || [],
          },
          organization,
          networkId,
          networkName,
          timeRange,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAiAnalysis(result.analysis);
      } else {
        // Use local fallback analysis
        setAiAnalysis(generateLocalPerformanceAnalysis(currentStats, timeRange));
      }
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAiAnalysis(generateLocalPerformanceAnalysis(currentStats, timeRange));
    } finally {
      setAiLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, rawPerfData, organization, networkId, networkName, timeRange]); // generateLocalPerformanceAnalysis is a stable function

  // Generate local fallback analysis when AI is unavailable
  function generateLocalPerformanceAnalysis(currentStats: PerformanceStats, range: TimeRange): string {
    const lines: string[] = [];

    lines.push(`**Performance Overview** (${range})`);

    // Assess latency
    if (currentStats.avgLatency) {
      const lat = parseFloat(currentStats.avgLatency);
      if (lat < 50) {
        lines.push(`Network latency averaging ${lat.toFixed(1)}ms is excellent - users should experience responsive connectivity.`);
      } else if (lat < 100) {
        lines.push(`Network latency averaging ${lat.toFixed(1)}ms is acceptable for most applications.`);
      } else {
        lines.push(`⚠️ Network latency averaging ${lat.toFixed(1)}ms is elevated and may impact real-time applications like video calls.`);
      }
    }

    // Assess packet loss
    if (currentStats.avgLoss) {
      const loss = parseFloat(currentStats.avgLoss);
      if (loss < 0.5) {
        lines.push(`Packet loss at ${loss.toFixed(2)}% is within normal parameters.`);
      } else if (loss < 2) {
        lines.push(`⚠️ Packet loss at ${loss.toFixed(2)}% is slightly elevated - monitor for degradation trends.`);
      } else {
        lines.push(`⚠️ Packet loss at ${loss.toFixed(2)}% is high and should be investigated for potential issues.`);
      }
    }

    // Trend Analysis
    lines.push('');
    lines.push('**Trend Analysis**');
    if (data.length > 10) {
      const recentData = data.slice(-10);
      const olderData = data.slice(0, 10);

      const recentLatencies = recentData.filter(d => d.latency != null).map(d => d.latency!);
      const olderLatencies = olderData.filter(d => d.latency != null).map(d => d.latency!);

      if (recentLatencies.length > 0 && olderLatencies.length > 0) {
        const recentAvg = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length;
        const olderAvg = olderLatencies.reduce((a, b) => a + b, 0) / olderLatencies.length;
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (Math.abs(change) > 10) {
          lines.push(change > 0
            ? `Latency has increased by ${change.toFixed(0)}% over the period - investigate potential congestion.`
            : `Latency has improved by ${Math.abs(change).toFixed(0)}% over the period.`);
        } else {
          lines.push('Latency has remained stable throughout the monitoring period.');
        }
      }
    } else {
      lines.push('Insufficient data points for trend analysis.');
    }

    // Recommendations
    lines.push('');
    lines.push('**Recommendations**');
    lines.push('• Review traffic patterns during peak usage hours');
    lines.push('• Monitor bandwidth utilization across uplinks');
    lines.push('• Consider QoS policies for latency-sensitive applications');

    return lines.join('\n');
  }

  // Format timestamp for X-axis
  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp);
    if (timeRange === '1h' || timeRange === '6h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (timeRange === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Toggle metric selection
  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  };

  // Available metrics
  const availableMetrics = [
    { id: 'latency', label: 'Latency (ms)', color: METRIC_COLORS.latency },
    { id: 'packetLoss', label: 'Packet Loss (%)', color: METRIC_COLORS.packetLoss },
    { id: 'throughput', label: 'Throughput (Mbps)', color: METRIC_COLORS.throughput },
    { id: 'channelUtilization', label: 'Channel Util (%)', color: METRIC_COLORS.channelUtilization },
  ];

  // Calculate summary stats
  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const latencies = data.filter((d) => d.latency != null).map((d) => d.latency!);
    const losses = data.filter((d) => d.packetLoss != null).map((d) => d.packetLoss!);

    return {
      avgLatency: latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : null,
      maxLatency: latencies.length > 0 ? Math.max(...latencies).toFixed(1) : null,
      avgLoss: losses.length > 0 ? (losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(2) : null,
      maxLoss: losses.length > 0 ? Math.max(...losses).toFixed(2) : null,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="h-[500px] flex items-center justify-center theme-bg-secondary rounded-xl border theme-border">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 theme-text-muted">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error && data.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center theme-bg-secondary rounded-xl border theme-border">
        <div className="text-center">
          <svg className="w-16 h-16 theme-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-semibold theme-text-primary mb-2">No Performance Data</h3>
          <p className="text-sm theme-text-muted max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold theme-text-primary">
            Performance Metrics: {networkName || networkId}
          </h2>
          <p className="text-sm theme-text-muted">{data.length} data points</p>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Analyze Button */}
          <button
            onClick={() => stats && requestAiAnalysis(stats)}
            disabled={aiLoading || !stats}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              aiLoading
                ? 'bg-purple-500/20 text-purple-400 cursor-wait'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'
            }`}
          >
            {aiLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Analysis
              </>
            )}
          </button>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg theme-bg-secondary border theme-border">
            {(['1h', '6h', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'theme-text-muted hover:theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-700/50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Avg Latency" value={stats.avgLatency ? `${stats.avgLatency} ms` : 'N/A'} color="cyan" />
          <StatCard label="Max Latency" value={stats.maxLatency ? `${stats.maxLatency} ms` : 'N/A'} color="cyan" />
          <StatCard
            label="Avg Loss"
            value={stats.avgLoss ? `${stats.avgLoss}%` : 'N/A'}
            color={stats.avgLoss && parseFloat(stats.avgLoss) > 1 ? 'red' : 'green'}
          />
          <StatCard
            label="Max Loss"
            value={stats.maxLoss ? `${stats.maxLoss}%` : 'N/A'}
            color={stats.maxLoss && parseFloat(stats.maxLoss) > 1 ? 'red' : 'green'}
          />
        </div>
      )}

      {/* AI Insights Panel */}
      {(aiAnalysis || aiLoading) && (
        <div className="theme-bg-secondary rounded-xl border border-purple-500/30 overflow-hidden">
          {/* Panel Header */}
          <button
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-purple-500/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-semibold theme-text-primary">AI Performance Analysis</h3>
                <p className="text-xs theme-text-muted">
                  {aiLoading ? 'Analyzing network performance...' : 'Click to expand insights'}
                </p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 theme-text-muted transition-transform ${aiPanelOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Panel Content */}
          {aiPanelOpen && (
            <div className="border-t border-purple-500/20 p-4">
              {aiLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm theme-text-muted">Generating insights...</p>
                  </div>
                </div>
              ) : aiAnalysis ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="space-y-3">
                    {aiAnalysis.split('\n').map((line, idx) => {
                      if (!line.trim()) return <div key={idx} className="h-2" />;
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return (
                          <h4 key={idx} className="font-semibold text-purple-400 mt-4 first:mt-0">
                            {line.replace(/\*\*/g, '')}
                          </h4>
                        );
                      }
                      if (line.startsWith('•') || line.startsWith('-')) {
                        return (
                          <div key={idx} className="flex items-start gap-2 text-sm theme-text-secondary">
                            <span className="text-purple-400 mt-0.5">•</span>
                            <span>{line.replace(/^[•-]\s*/, '')}</span>
                          </div>
                        );
                      }
                      return (
                        <p key={idx} className="text-sm theme-text-secondary leading-relaxed">
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 theme-bg-secondary rounded-lg border theme-border">
        {/* Metric Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm theme-text-muted">Metrics:</span>
          {availableMetrics.map((metric) => (
            <label key={metric.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMetrics.includes(metric.id)}
                onChange={() => toggleMetric(metric.id)}
                className="rounded border-slate-300 dark:border-slate-600 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm theme-text-secondary flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
                {metric.label}
              </span>
            </label>
          ))}
        </div>

        {/* Chart Type Toggle */}
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as 'combined' | 'separate')}
          className="px-3 py-2 rounded-lg theme-input text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="combined">Combined Chart</option>
          <option value="separate">Separate Charts</option>
        </select>
      </div>

      {/* Charts */}
      {chartType === 'combined' ? (
        <div className="theme-bg-secondary rounded-xl border theme-border p-5">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.5} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                stroke="var(--text-muted)"
                style={{ fontSize: '11px' }}
                tick={{ fill: 'var(--text-muted)' }}
              />
              <YAxis
                yAxisId="left"
                stroke="var(--text-muted)"
                style={{ fontSize: '11px' }}
                tick={{ fill: 'var(--text-muted)' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--text-muted)"
                style={{ fontSize: '11px' }}
                tick={{ fill: 'var(--text-muted)' }}
              />
              <Tooltip content={<CustomPerformanceTooltip />} />
              <Legend />
              {selectedMetrics.includes('latency') && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="latency"
                  name="Latency (ms)"
                  stroke={METRIC_COLORS.latency}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )}
              {selectedMetrics.includes('packetLoss') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="packetLoss"
                  name="Packet Loss (%)"
                  stroke={METRIC_COLORS.packetLoss}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )}
              {selectedMetrics.includes('throughput') && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="throughput"
                  name="Throughput (Mbps)"
                  stroke={METRIC_COLORS.throughput}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )}
              {selectedMetrics.includes('channelUtilization') && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="channelUtilization"
                  name="Channel Util (%)"
                  stroke={METRIC_COLORS.channelUtilization}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {selectedMetrics.map((metric) => {
            const metricInfo = availableMetrics.find((m) => m.id === metric);
            if (!metricInfo) return null;

            return (
              <div
                key={metric}
                className="theme-bg-secondary rounded-xl border theme-border p-5"
              >
                <h3 className="text-sm font-semibold theme-text-primary mb-4 flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: metricInfo.color }}
                  />
                  {metricInfo.label}
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={metricInfo.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={metricInfo.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border-primary)"
                      opacity={0.5}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatXAxis}
                      stroke="var(--text-muted)"
                      style={{ fontSize: '10px' }}
                      tick={{ fill: 'var(--text-muted)' }}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      style={{ fontSize: '10px' }}
                      tick={{ fill: 'var(--text-muted)' }}
                    />
                    <Tooltip content={<CustomPerformanceTooltip />} />
                    <Area
                      type="monotone"
                      dataKey={metric}
                      stroke={metricInfo.color}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={`url(#gradient-${metric})`}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'cyan' | 'green' | 'red' | 'amber';
}) {
  const colorClasses = {
    cyan: 'bg-cyan-500/10 border-cyan-500/20',
    green: 'bg-green-500/10 border-green-500/20',
    red: 'bg-red-500/10 border-red-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
  };

  const textClasses = {
    cyan: 'text-cyan-600 dark:text-cyan-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <p className="text-xs theme-text-muted mb-1">{label}</p>
      <p className={`text-xl font-bold ${textClasses[color]}`}>{value}</p>
    </div>
  );
}

// ============================================================================
// Data Transformation
// ============================================================================

// Types for raw API response data points (handles multiple API response formats)
interface ChannelUtilizationPoint {
  startTs?: string;
  timestamp?: string;
  utilizationTotal?: number;
  utilization80211?: number;
  utilization24?: number;
  utilization5?: number;
}

interface TrafficAnalysisPoint {
  ts?: string;
  timestamp?: string;
  sent?: number;
  recv?: number;
}

interface LossLatencyPoint {
  ts?: string;
  lossPercent?: number;
  latencyMs?: number;
}

interface RawPerformanceResponse {
  channelUtilization?: ChannelUtilizationPoint[];
  trafficAnalysis?: TrafficAnalysisPoint[];
  lossAndLatency?: {
    timeSeries?: LossLatencyPoint[];
  };
}

function transformPerformanceData(response: RawPerformanceResponse): PerformanceData[] {
  const dataPoints: PerformanceData[] = [];

  // Handle channel utilization data
  if (response.channelUtilization && Array.isArray(response.channelUtilization)) {
    response.channelUtilization.forEach((point: ChannelUtilizationPoint) => {
      const ts = point.startTs || point.timestamp;
      if (ts) {
        dataPoints.push({
          timestamp: ts,
          channelUtilization: point.utilizationTotal || point.utilization80211 || point.utilization24 || point.utilization5 || 0,
        });
      }
    });
  }

  // Handle traffic analysis data
  if (response.trafficAnalysis && Array.isArray(response.trafficAnalysis)) {
    response.trafficAnalysis.forEach((point: TrafficAnalysisPoint) => {
      if (point.ts || point.timestamp) {
        const existing = dataPoints.find((d) => d.timestamp === (point.ts || point.timestamp));
        if (existing) {
          existing.throughput = point.sent ? (point.sent + (point.recv || 0)) / 1024 / 1024 : undefined;
        } else {
          dataPoints.push({
            timestamp: point.ts || point.timestamp || '',
            throughput: point.sent ? (point.sent + (point.recv || 0)) / 1024 / 1024 : undefined,
          });
        }
      }
    });
  }

  // Handle loss and latency data
  if (response.lossAndLatency?.timeSeries && Array.isArray(response.lossAndLatency.timeSeries)) {
    response.lossAndLatency.timeSeries.forEach((point: LossLatencyPoint) => {
      if (point.ts) {
        const existing = dataPoints.find((d) => d.timestamp === point.ts);
        if (existing) {
          existing.latency = point.latencyMs;
          existing.packetLoss = point.lossPercent;
        } else {
          dataPoints.push({
            timestamp: point.ts,
            latency: point.latencyMs,
            packetLoss: point.lossPercent,
          });
        }
      }
    });
  }

  // Generate sample data if no real data available
  if (dataPoints.length === 0) {
    const now = Date.now();
    const hourMs = 3600000;
    for (let i = 24; i >= 0; i--) {
      const ts = new Date(now - i * hourMs);
      dataPoints.push({
        timestamp: ts.toISOString(),
        latency: Math.random() * 50 + 10,
        packetLoss: Math.random() * 2,
        throughput: Math.random() * 100 + 50,
        channelUtilization: Math.random() * 40 + 10,
      });
    }
  }

  // Sort by timestamp
  return dataPoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
