'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  RefreshCw,
  Wifi,
  Zap,
  Server,
  Clock,
  Globe,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { VisualizationHubState } from './useVisualizationHub';
import type { TimeRange } from '@/types/visualization';

// ============================================================================
// Types
// ============================================================================

interface PerformanceViewProps {
  hub: VisualizationHubState;
  networkName: string;
}

type DataSource = 'all' | 'meraki' | 'thousandeyes';

interface MetricCard {
  id: string;
  label: string;
  value: string;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: string;
  sparkline: number[];
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  source: string;
}

// ============================================================================
// Build real time-series from TE test results
// ============================================================================

function buildTimeSeries(hub: VisualizationHubState) {
  const bucketMap = new Map<string, { latency: number; loss: number; jitter: number; responseTime: number; count: number }>();

  Object.values(hub.teTestResults).forEach(results => {
    if (!results || !Array.isArray(results)) return;
    results.forEach(r => {
      if (!r.timestamp) return;
      const ts = new Date(r.timestamp);
      if (isNaN(ts.getTime())) return;
      const bucket = new Date(Math.floor(ts.getTime() / 300000) * 300000).toISOString();

      const existing = bucketMap.get(bucket);
      if (existing) {
        existing.latency += r.latency || 0;
        existing.loss += r.loss || 0;
        existing.jitter += r.jitter || 0;
        existing.responseTime += r.responseTime || 0;
        existing.count += 1;
      } else {
        bucketMap.set(bucket, {
          latency: r.latency || 0,
          loss: r.loss || 0,
          jitter: r.jitter || 0,
          responseTime: r.responseTime || 0,
          count: 1,
        });
      }
    });
  });

  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, data]) => ({
      timestamp,
      latency: data.count > 0 ? data.latency / data.count : 0,
      loss: data.count > 0 ? data.loss / data.count : 0,
      jitter: data.count > 0 ? data.jitter / data.count : 0,
      responseTime: data.count > 0 ? data.responseTime / data.count : 0,
      count: data.count,
    }));
}

// ============================================================================
// Custom Tooltip
// ============================================================================

function CustomTooltip({ active, payload, label, formatLabel }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-lg shadow-2xl p-3 min-w-[160px]">
      <div className="text-[11px] text-slate-400 mb-1.5 font-medium">{formatLabel ? formatLabel(label) : label}</div>
      <div className="space-y-1">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-[11px] text-slate-300">{entry.name}</span>
            </div>
            <span className="text-[11px] font-semibold text-white tabular-nums">
              {typeof entry.value === 'number' ? entry.value.toFixed(entry.name?.includes('%') || entry.name?.includes('Loss') ? 2 : 1) : entry.value}
              {entry.name?.includes('Loss') || entry.name?.includes('%') ? '%' : entry.name?.includes('KB') ? '' : ' ms'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Metric Summary Card
// ============================================================================

function MetricSummaryCard({ metric }: { metric: MetricCard }) {
  const Icon = metric.icon;
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor = metric.id === 'latency' || metric.id === 'loss' || metric.id === 'jitter'
    ? metric.trend === 'up' ? 'text-red-500' : metric.trend === 'down' ? 'text-emerald-500' : 'text-slate-400'
    : metric.trend === 'up' ? 'text-emerald-500' : metric.trend === 'down' ? 'text-red-500' : 'text-slate-400';

  // Sparkline with area fill
  const maxVal = Math.max(...metric.sparkline, 1);
  const points = metric.sparkline.map((v, i) => {
    const x = (i / Math.max(metric.sparkline.length - 1, 1)) * 90;
    const y = 28 - (v / maxVal) * 22;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,28 ${points} 90,28`;

  return (
    <div className="group relative bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/40 p-4 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600/60 transition-all duration-200 overflow-hidden">
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, ${metric.color}, transparent)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${metric.color}12` }}>
            <span style={{ color: metric.color }}><Icon className="w-4 h-4" /></span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{metric.label}</span>
        </div>
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${
          metric.trend === 'stable' ? 'bg-slate-100 dark:bg-slate-700/30' : trendColor.includes('red') ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'
        }`}>
          <TrendIcon className={`w-3 h-3 ${trendColor}`} />
          <span className={`text-[10px] font-semibold ${trendColor}`}>{metric.trendValue}</span>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{metric.value}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1 font-medium">{metric.unit}</span>
        </div>
        <svg width="90" height="28" className="opacity-50 group-hover:opacity-80 transition-opacity">
          <polygon fill={`${metric.color}15`} points={areaPoints} />
          <polyline fill="none" stroke={metric.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
        </svg>
      </div>

      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">{metric.source}</div>
    </div>
  );
}

// ============================================================================
// Chart Panel
// ============================================================================

function ChartPanel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/40 overflow-hidden hover:shadow-lg transition-shadow duration-200 ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/30">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// Segmented Control
// ============================================================================

function SegmentedControl<T extends string>({ options, value, onChange, className = '' }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex gap-0.5 p-0.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-lg border border-slate-200/50 dark:border-slate-700/30 ${className}`}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
            value === opt.value
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Performance View
// ============================================================================

export function PerformanceView({ hub, networkName }: PerformanceViewProps) {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [dataSource, setDataSource] = useState<DataSource>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (hub.selectedOrg && hub.selectedNetwork) {
      hub.fetchPerformance(timeRange);
    }
  }, [hub.selectedOrg, hub.selectedNetwork, timeRange]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      hub.fetchPerformance(timeRange);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, hub, timeRange]);

  const teTimeSeries = useMemo(() => buildTimeSeries(hub), [hub.teTestResults]);

  const metrics = useMemo((): MetricCard[] => {
    const teHealth = hub.teTestHealth;
    const ts = teTimeSeries;

    let avgLatency = 0;
    let latencySource = 'No data';
    let latencySparkline: number[] = [];
    if (ts.length > 0) {
      avgLatency = ts.reduce((s, p) => s + p.latency, 0) / ts.length;
      latencySparkline = ts.slice(-20).map(p => p.latency);
      latencySource = `${ts.length} data points`;
    } else if (teHealth.length > 0) {
      avgLatency = teHealth.reduce((s, t) => s + (t.latestMetrics?.latency || 0), 0) / teHealth.length;
      latencySparkline = teHealth.map(t => t.latestMetrics?.latency || 0);
      latencySource = `${teHealth.length} tests (latest)`;
    }

    let avgLoss = 0;
    let lossSparkline: number[] = [];
    let lossSource = 'No data';
    if (ts.length > 0) {
      avgLoss = ts.reduce((s, p) => s + p.loss, 0) / ts.length;
      lossSparkline = ts.slice(-20).map(p => p.loss);
      lossSource = `${ts.length} data points`;
    } else if (teHealth.length > 0) {
      avgLoss = teHealth.reduce((s, t) => s + (t.latestMetrics?.loss || 0), 0) / teHealth.length;
      lossSparkline = teHealth.map(t => t.latestMetrics?.loss || 0);
      lossSource = `${teHealth.length} tests (latest)`;
    }

    let avgJitter = 0;
    let jitterSparkline: number[] = [];
    let jitterSource = 'No data';
    if (ts.length > 0) {
      const jitterPoints = ts.filter(p => p.jitter > 0);
      if (jitterPoints.length > 0) {
        avgJitter = jitterPoints.reduce((s, p) => s + p.jitter, 0) / jitterPoints.length;
        jitterSparkline = ts.slice(-20).map(p => p.jitter);
        jitterSource = `${jitterPoints.length} data points`;
      }
    }
    if (avgJitter === 0) {
      let totalJitter = 0;
      let jitterCount = 0;
      Object.values(hub.teTestResults).forEach(results => {
        if (!results) return;
        results.forEach(r => {
          if (r.jitter && r.jitter > 0) {
            totalJitter += r.jitter;
            jitterCount++;
          }
        });
      });
      if (jitterCount > 0) {
        avgJitter = totalJitter / jitterCount;
        jitterSource = `${jitterCount} results`;
      }
    }

    let avgResponseTime = 0;
    let responseTimeSparkline: number[] = [];
    let responseTimeSource = 'No data';
    if (ts.length > 0) {
      const rtPoints = ts.filter(p => p.responseTime > 0);
      if (rtPoints.length > 0) {
        avgResponseTime = rtPoints.reduce((s, p) => s + p.responseTime, 0) / rtPoints.length;
        responseTimeSparkline = ts.slice(-20).map(p => p.responseTime);
        responseTimeSource = `${rtPoints.length} data points`;
      }
    }
    if (avgResponseTime === 0) {
      let totalRT = 0;
      let rtCount = 0;
      Object.values(hub.teTestResults).forEach(results => {
        if (!results) return;
        results.forEach(r => {
          if (r.responseTime && r.responseTime > 0) {
            totalRT += r.responseTime;
            rtCount++;
          }
        });
      });
      if (rtCount > 0) {
        avgResponseTime = totalRT / rtCount;
        responseTimeSource = `${rtCount} results`;
      }
    }

    const throughput = hub.performanceData.reduce((s, p) => s + (p.throughputSent || 0) + (p.throughputRecv || 0), 0);
    const avgThroughput = hub.performanceData.length > 0 ? throughput / hub.performanceData.length : 0;

    let avgAvail = 100;
    let availSparkline: number[] = [];
    let availSource = 'No data';
    if (teHealth.length > 0) {
      avgAvail = teHealth.reduce((s, t) => s + (t.latestMetrics?.availability || 100), 0) / teHealth.length;
      availSparkline = teHealth.map(t => t.latestMetrics?.availability || 100);
      availSource = `${teHealth.length} tests`;
    }

    const ensureSparkline = (data: number[]) => data.length > 0 ? data.slice(-20) : [0, 0, 0, 0, 0];

    return [
      {
        id: 'latency', label: 'Avg Latency', value: avgLatency.toFixed(1), unit: 'ms',
        trend: avgLatency > 50 ? 'up' : avgLatency > 0 ? 'stable' : 'stable',
        trendValue: avgLatency > 100 ? 'High' : avgLatency > 50 ? 'Moderate' : avgLatency > 0 ? 'Normal' : '--',
        sparkline: ensureSparkline(latencySparkline), color: '#06b6d4', icon: Activity, source: latencySource,
      },
      {
        id: 'loss', label: 'Packet Loss', value: avgLoss.toFixed(2), unit: '%',
        trend: avgLoss > 1 ? 'up' : 'stable',
        trendValue: avgLoss > 5 ? 'Critical' : avgLoss > 1 ? 'Elevated' : avgLoss > 0 ? 'Normal' : '--',
        sparkline: ensureSparkline(lossSparkline), color: '#ef4444', icon: Zap, source: lossSource,
      },
      {
        id: 'jitter', label: 'Jitter', value: avgJitter > 0 ? avgJitter.toFixed(1) : '0.0', unit: 'ms',
        trend: avgJitter > 10 ? 'up' : 'stable',
        trendValue: avgJitter > 30 ? 'High' : avgJitter > 10 ? 'Moderate' : avgJitter > 0 ? 'Normal' : '--',
        sparkline: ensureSparkline(jitterSparkline), color: '#f59e0b', icon: Wifi, source: jitterSource,
      },
      {
        id: 'responseTime', label: 'Response Time', value: avgResponseTime > 0 ? avgResponseTime.toFixed(0) : '0', unit: 'ms',
        trend: avgResponseTime > 500 ? 'up' : 'stable',
        trendValue: avgResponseTime > 1000 ? 'Slow' : avgResponseTime > 500 ? 'Moderate' : avgResponseTime > 0 ? 'Normal' : '--',
        sparkline: ensureSparkline(responseTimeSparkline), color: '#3b82f6', icon: Globe, source: responseTimeSource,
      },
      {
        id: 'throughput', label: 'Throughput',
        value: avgThroughput > 1000000 ? (avgThroughput / 1000000).toFixed(1) : avgThroughput > 1000 ? (avgThroughput / 1000).toFixed(1) : avgThroughput.toFixed(0),
        unit: avgThroughput > 1000000 ? 'Mbps' : avgThroughput > 1000 ? 'Kbps' : 'bps',
        trend: 'stable',
        trendValue: hub.performanceData.length > 0 ? 'Normal' : '--',
        sparkline: ensureSparkline(hub.performanceData.map(p => (p.throughputSent || 0) + (p.throughputRecv || 0))),
        color: '#22c55e', icon: TrendingUp, source: hub.performanceData.length > 0 ? `Meraki (${hub.performanceData.length} pts)` : 'No data',
      },
      {
        id: 'availability', label: 'Availability', value: avgAvail.toFixed(1), unit: '%',
        trend: avgAvail >= 99 ? 'stable' : avgAvail >= 95 ? 'down' : 'down',
        trendValue: avgAvail >= 99.9 ? 'Excellent' : avgAvail >= 99 ? 'Good' : avgAvail >= 95 ? 'Degraded' : avgAvail > 0 ? 'Poor' : '--',
        sparkline: ensureSparkline(availSparkline), color: '#a855f7', icon: Server, source: availSource,
      },
    ];
  }, [hub.teTestHealth, hub.performanceData, teTimeSeries, hub.teTestResults]);

  const trafficData = useMemo(() => {
    return hub.performanceData.map(p => ({
      timestamp: p.timestamp,
      sent: (p.throughputSent || 0) / 1000,
      recv: (p.throughputRecv || 0) / 1000,
    }));
  }, [hub.performanceData]);

  const heatmapData = useMemo(() => {
    return hub.teTestHealth.slice(0, 20).map(cell => {
      const results = hub.teTestResults[cell.testId] || [];
      const recentResults = results.slice(-12);
      return {
        testId: cell.testId,
        testName: cell.testName,
        testType: cell.type,
        health: cell.health,
        latency: cell.latestMetrics?.latency || 0,
        loss: cell.latestMetrics?.loss || 0,
        availability: cell.latestMetrics?.availability || 100,
        resultCount: results.length,
        miniCells: recentResults.map(r => ({
          latency: r.latency || 0,
          loss: r.loss || 0,
          health: (r.loss && r.loss > 5) ? 'critical' : (r.latency && r.latency > 100) ? 'degraded' : 'healthy',
        })),
      };
    });
  }, [hub.teTestHealth, hub.teTestResults]);

  const testLatencyBreakdown = useMemo(() => {
    return hub.teTestHealth
      .filter(cell => cell.latestMetrics?.latency && cell.latestMetrics.latency > 0)
      .sort((a, b) => (b.latestMetrics?.latency || 0) - (a.latestMetrics?.latency || 0))
      .slice(0, 10)
      .map(cell => ({
        testName: cell.testName.length > 25 ? cell.testName.substring(0, 22) + '...' : cell.testName,
        latency: cell.latestMetrics?.latency || 0,
        loss: cell.latestMetrics?.loss || 0,
        health: cell.health,
      }));
  }, [hub.teTestHealth]);

  const activeAlertCount = useMemo(() => {
    return hub.teAlerts.filter(a => a.active).length;
  }, [hub.teAlerts]);

  const analyzePerformance = useCallback(() => {
    const avgLatency = metrics.find(m => m.id === 'latency')?.value || '0';
    const avgLoss = metrics.find(m => m.id === 'loss')?.value || '0';
    const availability = metrics.find(m => m.id === 'availability')?.value || '100';
    const jitter = metrics.find(m => m.id === 'jitter')?.value || '0';
    const responseTime = metrics.find(m => m.id === 'responseTime')?.value || '0';
    const alertList = hub.teAlerts.filter(a => a.active).map(a => `${a.testName}: ${a.ruleExpression}`).join('; ');
    const prompt = `Analyze performance trends for network "${networkName}". Avg latency: ${avgLatency}ms, packet loss: ${avgLoss}%, jitter: ${jitter}ms, response time: ${responseTime}ms, availability: ${availability}%. ${hub.teTestHealth.length} TE tests monitored, ${activeAlertCount} active alerts${alertList ? ': ' + alertList : ''}. Time range: ${timeRange}. ${teTimeSeries.length} historical data points analyzed. Identify anomalies, bottlenecks, and recommend optimizations.`;
    router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
  }, [metrics, networkName, hub, timeRange, router, activeAlertCount, teTimeSeries]);

  // Empty state
  if (!hub.selectedOrg || !hub.selectedNetwork) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/40">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-4">
          <Activity className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-1">Select a Network</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Choose an organization and network to view performance metrics</p>
      </div>
    );
  }

  const formatTimestamp = (v: string) => {
    try {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const chartAxisStyle = { fontSize: 10, fill: '#94a3b8', fontFamily: 'inherit' };
  const chartGridStyle = { strokeDasharray: '3 3', stroke: '#e2e8f0', opacity: 0.4 };
  const chartGridStyleDark = { strokeDasharray: '3 3', stroke: '#334155', opacity: 0.4 };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SegmentedControl
            options={[
              { value: '1h' as TimeRange, label: '1h' },
              { value: '6h' as TimeRange, label: '6h' },
              { value: '24h' as TimeRange, label: '24h' },
              { value: '7d' as TimeRange, label: '7d' },
              { value: '30d' as TimeRange, label: '30d' },
            ]}
            value={timeRange}
            onChange={setTimeRange}
          />

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

          <SegmentedControl
            options={[
              { value: 'all' as DataSource, label: 'All' },
              { value: 'meraki' as DataSource, label: 'Meraki' },
              { value: 'thousandeyes' as DataSource, label: 'TE' },
            ]}
            value={dataSource}
            onChange={setDataSource}
          />

          {/* Data summary */}
          <div className="flex items-center gap-2 ml-2 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            <span className="tabular-nums">{teTimeSeries.length} TE</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="tabular-nums">{hub.performanceData.length} Meraki</span>
            {activeAlertCount > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {activeAlertCount}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
              autoRefresh
                ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto
          </button>

          <button
            onClick={analyzePerformance}
            className="flex items-center gap-2 px-3.5 py-1.5 text-[11px] font-semibold text-purple-500 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg hover:bg-purple-500/15 hover:shadow-md transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analyze Trends
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map(m => (
          <MetricSummaryCard key={m.id} metric={m} />
        ))}
      </div>

      {/* Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Latency & Response Time */}
        <ChartPanel
          title="Latency & Response Time"
          subtitle={teTimeSeries.length > 0 ? `${teTimeSeries.length} data points from TE test results` : 'Awaiting ThousandEyes data'}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={teTimeSeries.length > 0 ? teTimeSeries : [{ timestamp: '', latency: 0, responseTime: 0 }]}>
              <defs>
                <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="responseTimeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="timestamp" tick={chartAxisStyle} tickFormatter={formatTimestamp} axisLine={false} tickLine={false} />
              <YAxis tick={chartAxisStyle} width={40} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip formatLabel={formatTimestamp} />} />
              <Area type="monotone" dataKey="latency" stroke="#06b6d4" strokeWidth={2} fill="url(#latencyGrad)" name="Latency" />
              <Area type="monotone" dataKey="responseTime" stroke="#3b82f6" strokeWidth={1.5} fill="url(#responseTimeGrad)" name="Response Time" />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Packet Loss & Jitter */}
        <ChartPanel
          title="Packet Loss & Jitter"
          subtitle={teTimeSeries.length > 0 ? 'Real ThousandEyes test result data' : 'Awaiting data'}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={teTimeSeries.length > 0 ? teTimeSeries : [{ timestamp: '', loss: 0, jitter: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="timestamp" tick={chartAxisStyle} tickFormatter={formatTimestamp} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={chartAxisStyle} width={35} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={chartAxisStyle} width={35} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip formatLabel={formatTimestamp} />} />
              <Line yAxisId="left" type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2} dot={false} name="Loss (%)" />
              <Line yAxisId="right" type="monotone" dataKey="jitter" stroke="#f59e0b" strokeWidth={2} dot={false} name="Jitter (ms)" />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Throughput */}
        <ChartPanel
          title="Throughput"
          subtitle={trafficData.length > 0 ? `Meraki traffic analysis (${trafficData.length} points)` : 'Awaiting Meraki data'}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trafficData.length > 0 ? trafficData : [{ timestamp: '', sent: 0, recv: 0 }]}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="recvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="timestamp" tick={chartAxisStyle} tickFormatter={formatTimestamp} axisLine={false} tickLine={false} />
              <YAxis tick={chartAxisStyle} width={45} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip formatLabel={formatTimestamp} />} />
              <Area type="monotone" dataKey="sent" stroke="#22c55e" strokeWidth={2} fill="url(#sentGrad)" name="Sent (KB)" />
              <Area type="monotone" dataKey="recv" stroke="#3b82f6" strokeWidth={2} fill="url(#recvGrad)" name="Recv (KB)" />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Test Latency Breakdown */}
        <ChartPanel
          title="Test Latency Breakdown"
          subtitle={testLatencyBreakdown.length > 0 ? `Top ${testLatencyBreakdown.length} tests by latency` : 'No ThousandEyes tests'}
        >
          {testLatencyBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={testLatencyBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                <XAxis type="number" tick={chartAxisStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="testName" tick={{ fontSize: 9, fill: '#94a3b8' }} width={130} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="latency" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Latency" />
                <Bar dataKey="loss" fill="#ef4444" radius={[0, 4, 4, 0]} name="Loss %" />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px]">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/30 flex items-center justify-center mb-3">
                <BarChart3 className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {hub.teConfigured ? 'No test latency data available' : 'ThousandEyes not configured'}
              </p>
            </div>
          )}
        </ChartPanel>

        {/* Test Health Heatmap */}
        <ChartPanel
          title="Test Health Overview"
          subtitle={heatmapData.length > 0 ? `${heatmapData.length} tests with ${heatmapData.reduce((s, t) => s + t.resultCount, 0)} total results` : 'No tests'}
        >
          {heatmapData.length > 0 ? (
            <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
              {heatmapData.map((test, i) => {
                const healthColor = test.health === 'healthy' ? 'bg-emerald-500'
                  : test.health === 'degraded' ? 'bg-amber-500'
                  : test.health === 'failing' ? 'bg-red-500'
                  : 'bg-slate-500';

                return (
                  <div key={i} className="flex items-center gap-2.5 py-1.5 px-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group/row">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${healthColor}`} />
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate w-[130px] flex-shrink-0 group-hover/row:text-slate-900 dark:group-hover/row:text-white transition-colors">
                      {test.testName}
                    </span>
                    {/* Mini heatmap */}
                    <div className="flex gap-[2px] flex-1">
                      {test.miniCells.length > 0 ? (
                        test.miniCells.map((cell, j) => (
                          <div
                            key={j}
                            className={`h-4 flex-1 rounded-sm transition-transform hover:scale-y-125 ${
                              cell.health === 'critical' ? 'bg-red-500'
                                : cell.health === 'degraded' ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ opacity: 0.5 + (j / test.miniCells.length) * 0.5 }}
                            title={`Latency: ${cell.latency.toFixed(0)}ms, Loss: ${cell.loss.toFixed(1)}%`}
                          />
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400">No results</span>
                      )}
                    </div>
                    <span className="text-[11px] tabular-nums font-medium text-slate-500 dark:text-slate-400 flex-shrink-0 w-[55px] text-right">
                      {test.latency.toFixed(0)}ms
                    </span>
                    {test.loss > 0 && (
                      <span className="text-[11px] tabular-nums font-medium text-red-500 flex-shrink-0 w-[40px] text-right">
                        {test.loss.toFixed(1)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px]">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/30 flex items-center justify-center mb-3">
                <Activity className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {hub.teConfigured ? 'No test health data available' : 'ThousandEyes not configured'}
              </p>
            </div>
          )}
        </ChartPanel>

        {/* Availability */}
        <ChartPanel
          title="Availability by Test"
          subtitle={hub.teTestHealth.length > 0 ? `${hub.teTestHealth.length} monitored tests` : 'No tests'}
        >
          {hub.teTestHealth.length > 0 ? (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
              {hub.teTestHealth.slice(0, 15).map((cell, i) => {
                const avail = cell.latestMetrics?.availability ?? 100;
                const barWidth = Math.max(avail, 0);
                const barColor = avail >= 99.9 ? 'bg-emerald-500' : avail >= 99 ? 'bg-emerald-400' : avail >= 95 ? 'bg-amber-500' : 'bg-red-500';
                const textColor = avail >= 99 ? 'text-emerald-500' : avail >= 95 ? 'text-amber-500' : 'text-red-500';

                return (
                  <div key={i} className="flex items-center gap-2.5 group/avail">
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate w-[130px] flex-shrink-0 group-hover/avail:text-slate-900 dark:group-hover/avail:text-white transition-colors">
                      {cell.testName}
                    </span>
                    <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700/40 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className={`text-[11px] tabular-nums font-semibold w-[50px] text-right flex-shrink-0 ${textColor}`}>
                      {avail.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px]">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/30 flex items-center justify-center mb-3">
                <Server className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {hub.teConfigured ? 'No availability data' : 'ThousandEyes not configured'}
              </p>
            </div>
          )}
        </ChartPanel>
      </div>

      {/* Loading overlay */}
      {hub.performanceLoading && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2.5 px-4 py-2.5 bg-slate-900/95 backdrop-blur-md rounded-lg shadow-2xl border border-slate-700/50 z-50">
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-slate-300 font-medium">Loading performance data...</span>
        </div>
      )}
    </div>
  );
}

export default PerformanceView;
