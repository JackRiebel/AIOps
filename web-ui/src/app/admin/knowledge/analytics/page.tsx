'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  FileText,
  Search,
  ThumbsUp,
  Clock,
  Database,
  Zap,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Activity,
  Target,
  CheckCircle2,
  XCircle,
  Info,
  ChevronRight,
  Layers,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface AnalyticsSummary {
  queries: {
    total_30d: number;
    today: number;
    zero_result_rate: number;
  };
  quality: {
    avg_rating: number | null;
    positive_rate: number;
    avg_latency_ms: number;
    needs_attention: number;
  };
  content: {
    documents: number;
    chunks: number;
    recently_added: number;
    stale: number;
  };
  cache: {
    hit_rate: number;
    size: number;
    redis_available: boolean;
  };
}

interface UsageTrend {
  period: string;
  count: number;
}

interface QualityTrend {
  date: string;
  avg_rating: number | null;
  positive_rate: number;
}

interface TopQuery {
  query: string;
  count: number;
}

interface CoverageGap {
  query: string;
  count: number;
}

export default function KnowledgeAnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [usageTrend, setUsageTrend] = useState<UsageTrend[]>([]);
  const [qualityTrend, setQualityTrend] = useState<QualityTrend[]>([]);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);

      const days = timePeriod === '7d' ? 7 : timePeriod === '90d' ? 90 : 30;

      const summaryRes = await fetch('/api/knowledge/analytics/summary', {
        credentials: 'include',
      });
      if (!summaryRes.ok) throw new Error('Failed to fetch summary');
      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      const trendRes = await fetch(`/api/knowledge/analytics/usage/trend?days=${days}&granularity=day`, {
        credentials: 'include',
      });
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        setUsageTrend(trendData.trend || []);
      }

      const qualityRes = await fetch(`/api/knowledge/analytics/quality/trend?days=${days}`, {
        credentials: 'include',
      });
      if (qualityRes.ok) {
        const qualityData = await qualityRes.json();
        setQualityTrend(qualityData.trend || []);
      }

      const fullRes = await fetch(`/api/knowledge/analytics?days=${days}`, {
        credentials: 'include',
      });
      if (fullRes.ok) {
        const fullData = await fullRes.json();
        setTopQueries(fullData.usage?.top_queries || []);
        setCoverageGaps(fullData.content?.coverage_gaps || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const handleInvalidateCache = async () => {
    try {
      const res = await fetch('/api/knowledge/analytics/cache/invalidate', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Cache invalidated: ${data.invalidated} entries cleared`);
        fetchAnalytics();
      }
    } catch {
      alert('Failed to invalidate cache');
    }
  };

  const getHealthStatus = () => {
    if (!summary) return { status: 'Unknown', color: 'slate', gradient: 'from-slate-500 to-slate-600' };

    const issues = [];
    if (summary.queries.zero_result_rate > 10) issues.push('high_zero_results');
    if (summary.quality.avg_latency_ms > 2000) issues.push('high_latency');
    if (summary.quality.positive_rate < 60) issues.push('low_satisfaction');
    if (summary.content.stale > summary.content.documents * 0.2) issues.push('stale_content');

    if (issues.length === 0) return { status: 'Healthy', color: 'emerald', gradient: 'from-emerald-500 to-green-600', icon: CheckCircle2 };
    if (issues.length <= 2) return { status: 'Attention', color: 'amber', gradient: 'from-yellow-500 to-amber-600', icon: AlertTriangle };
    return { status: 'Critical', color: 'red', gradient: 'from-red-600 to-rose-700', icon: XCircle };
  };

  // Format chart data
  const chartData = usageTrend.map((point) => ({
    date: point.period.split('T')[0].slice(5), // MM-DD format
    queries: point.count,
  }));

  const qualityChartData = qualityTrend.map((point) => ({
    date: point.date.split('T')[0].slice(5),
    satisfaction: point.positive_rate,
    rating: point.avg_rating || 0,
  }));

  if (loading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-cyan-100 dark:bg-cyan-500/10 rounded-full flex items-center justify-center" aria-hidden="true">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Loading Analytics</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Fetching knowledge base metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center" aria-hidden="true">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2" role="alert">Failed to Load</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const health = getHealthStatus();
  const HealthIcon = health.icon || Info;

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-4 py-4 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin/knowledge"
            className="group inline-flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 mb-3 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to Knowledge Base
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 shadow-lg shadow-cyan-500/20">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Knowledge Analytics
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Performance metrics and content health
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Health Badge */}
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${health.gradient} text-white text-[10px] font-bold shadow-sm uppercase tracking-wide`} role="status" aria-label={`System health: ${health.status}`}>
                <HealthIcon className="w-3 h-3" aria-hidden="true" />
                {health.status}
              </div>

              {/* Time Period Selector */}
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg" role="group" aria-label="Time period selector">
                {(['7d', '30d', '90d'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimePeriod(period)}
                    aria-pressed={timePeriod === period}
                    aria-label={`${period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}`}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all uppercase focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                      timePeriod === period
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>

              <button
                onClick={handleInvalidateCache}
                className="p-2 text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-cyan-300 dark:hover:border-cyan-500/50 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                aria-label="Clear cache"
              >
                <Database className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors shadow-sm hover:shadow-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                aria-label={refreshing ? 'Refreshing analytics' : 'Refresh analytics'}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {summary && (
          <>
            {/* Top Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
              {/* Queries */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-500/10">
                    <Search className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Queries</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.queries.total_30d.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="text-cyan-600 dark:text-cyan-400 font-medium">{summary.queries.today}</span> today
                </p>
              </div>

              {/* Satisfaction */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${summary.quality.positive_rate >= 70 ? 'bg-green-100 dark:bg-green-500/10' : 'bg-amber-100 dark:bg-amber-500/10'}`}>
                    <ThumbsUp className={`w-3.5 h-3.5 ${summary.quality.positive_rate >= 70 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Satisfaction</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.quality.positive_rate.toFixed(0)}%</p>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full ${summary.quality.positive_rate >= 70 ? 'bg-green-500' : summary.quality.positive_rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${summary.quality.positive_rate}%` }}
                  />
                </div>
              </div>

              {/* Latency */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${summary.quality.avg_latency_ms < 1000 ? 'bg-green-100 dark:bg-green-500/10' : 'bg-amber-100 dark:bg-amber-500/10'}`}>
                    <Clock className={`w-3.5 h-3.5 ${summary.quality.avg_latency_ms < 1000 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Avg Latency</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {summary.quality.avg_latency_ms < 1000
                    ? `${summary.quality.avg_latency_ms.toFixed(0)}ms`
                    : `${(summary.quality.avg_latency_ms / 1000).toFixed(1)}s`
                  }
                </p>
                <p className={`text-[10px] font-medium mt-0.5 ${summary.quality.avg_latency_ms < 500 ? 'text-green-600' : summary.quality.avg_latency_ms < 1000 ? 'text-green-500' : summary.quality.avg_latency_ms < 2000 ? 'text-amber-600' : 'text-red-600'}`}>
                  {summary.quality.avg_latency_ms < 500 ? 'Excellent' : summary.quality.avg_latency_ms < 1000 ? 'Good' : summary.quality.avg_latency_ms < 2000 ? 'Fair' : 'Slow'}
                </p>
              </div>

              {/* Cache */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-500/10">
                    <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Cache Hit</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.cache.hit_rate.toFixed(0)}%</p>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-purple-500" style={{ width: `${summary.cache.hit_rate}%` }} />
                </div>
              </div>

              {/* Documents */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/10">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Documents</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{summary.content.documents.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">{summary.content.chunks.toLocaleString()}</span> chunks
                </p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Query Volume Chart */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Query Volume</h3>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase">{timePeriod}</span>
                </div>
                <div className="h-[200px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="queryGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Area type="monotone" dataKey="queries" stroke="#06b6d4" strokeWidth={2} fill="url(#queryGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Satisfaction Trend */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-green-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Satisfaction Trend</h3>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase">{timePeriod}</span>
                </div>
                <div className="h-[200px]">
                  {qualityChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={qualityChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, 'Satisfaction']}
                        />
                        <Line type="monotone" dataKey="satisfaction" stroke="#22c55e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No feedback data
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-4 text-white shadow-lg shadow-cyan-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 opacity-80" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Documents</span>
                </div>
                <p className="text-2xl font-bold">{summary.content.documents.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg shadow-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 opacity-80" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Chunks</span>
                </div>
                <p className="text-2xl font-bold">{summary.content.chunks.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 opacity-80" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Added (7d)</span>
                </div>
                <p className="text-2xl font-bold">{summary.content.recently_added}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-lg shadow-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 opacity-80" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Stale</span>
                </div>
                <p className="text-2xl font-bold">{summary.content.stale}</p>
              </div>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Queries Table */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-cyan-500" />
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Top Queries</h3>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">{topQueries.length} queries</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                  {topQueries.length > 0 ? (
                    topQueries.slice(0, 8).map((q, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                            {q.query}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {q.count}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" aria-hidden="true" />
                      <p className="text-sm text-slate-500">No queries recorded</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Coverage Gaps Table */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Coverage Gaps</h3>
                    </div>
                    {coverageGaps.length > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/40">
                        {coverageGaps.length} issues
                      </span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                  {coverageGaps.length > 0 ? (
                    coverageGaps.slice(0, 8).map((gap, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-1 h-4 rounded-full bg-amber-500 flex-shrink-0" />
                          <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                            {gap.query}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-amber-600 dark:text-amber-400 flex-shrink-0 ml-2">
                          {gap.count}×
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center" aria-hidden="true">
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">All Clear</p>
                      <p className="text-xs text-slate-500">No coverage gaps detected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cache & System Info */}
            <div className="mt-4 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">System Status</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${summary.cache.redis_available ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cache Backend</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{summary.cache.redis_available ? 'Redis' : 'In-Memory'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cache Entries</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{summary.cache.size.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${summary.queries.zero_result_rate < 5 ? 'bg-green-500' : summary.queries.zero_result_rate < 10 ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Zero Result Rate</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{summary.queries.zero_result_rate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${summary.quality.needs_attention === 0 ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Needs Attention</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{summary.quality.needs_attention} queries</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
