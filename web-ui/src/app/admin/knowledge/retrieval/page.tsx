'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  GitBranch,
  Layers,
  TrendingUp,
  Target,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Filter,
  Zap,
  BarChart3,
  Gauge,
  Search,
  ChevronRight,
} from 'lucide-react';

interface RetrievalAnalytics {
  funnel: {
    avg_semantic_candidates: number;
    avg_keyword_candidates: number;
    avg_merged_candidates: number;
    avg_after_mmr: number;
    avg_final: number;
  };
  diversity: {
    avg_score: number;
    trend: Array<{ date: string; avg_diversity: number }>;
  };
  quality: {
    avg_score: number;
    distribution: Record<string, number>;
  };
  intent_distribution: Record<string, number>;
  complexity_distribution: Record<string, number>;
  slow_queries: Array<{
    id: number;
    query: string;
    latency_ms: number;
    created_at: string;
  }>;
  low_diversity_queries: Array<{
    id: number;
    query: string;
    diversity_score: number;
    result_count: number;
    created_at: string;
  }>;
  total_queries: number;
}

interface TrendData {
  date: string;
  query_count: number;
  avg_results: number;
  avg_diversity: number;
  avg_quality: number;
  avg_relevance: number;
  avg_latency_ms: number;
}

const INTENT_COLORS: Record<string, string> = {
  configuration: '#06b6d4',
  troubleshooting: '#ef4444',
  explanation: '#8b5cf6',
  comparison: '#f59e0b',
  validation: '#22c55e',
  optimization: '#3b82f6',
  general: '#64748b',
};

const COMPLEXITY_COLORS: Record<string, string> = {
  simple: '#22c55e',
  moderate: '#f59e0b',
  complex: '#ef4444',
};

const QUALITY_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];

export default function RetrievalObservabilityPage() {
  const [analytics, setAnalytics] = useState<RetrievalAnalytics | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState<number>(7);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const [analyticsRes, trendsRes] = await Promise.all([
        fetch(`/api/knowledge/analytics/retrieval?days=${days}`, {
          credentials: 'include',
        }),
        fetch(`/api/knowledge/analytics/retrieval/trends?days=${days}`, {
          credentials: 'include',
        }),
      ]);

      if (!analyticsRes.ok) {
        throw new Error('Failed to fetch retrieval analytics');
      }

      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);

      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setTrends(trendsData.trends || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Prepare funnel data
  const funnelData = analytics
    ? [
        { name: 'Semantic', value: analytics.funnel.avg_semantic_candidates, color: '#06b6d4' },
        { name: 'Keyword', value: analytics.funnel.avg_keyword_candidates, color: '#8b5cf6' },
        { name: 'Merged', value: analytics.funnel.avg_merged_candidates, color: '#3b82f6' },
        { name: 'After MMR', value: analytics.funnel.avg_after_mmr, color: '#f59e0b' },
        { name: 'Final', value: analytics.funnel.avg_final, color: '#22c55e' },
      ]
    : [];

  // Prepare intent pie data
  const intentData = analytics
    ? Object.entries(analytics.intent_distribution).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: INTENT_COLORS[name] || '#64748b',
      }))
    : [];

  // Prepare complexity pie data
  const complexityData = analytics
    ? Object.entries(analytics.complexity_distribution).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: COMPLEXITY_COLORS[name] || '#64748b',
      }))
    : [];

  // Prepare quality distribution data
  const qualityData = analytics
    ? Object.entries(analytics.quality.distribution).map(([range, count], idx) => ({
        range,
        count,
        color: QUALITY_COLORS[idx] || '#64748b',
      }))
    : [];

  if (loading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 dark:bg-purple-500/10 rounded-full flex items-center justify-center" aria-hidden="true">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Loading Analytics</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Fetching retrieval metrics...</p>
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
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-4 py-4 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin/knowledge/analytics"
            className="group inline-flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 mb-3 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to Analytics
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20">
                <GitBranch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Retrieval Observability
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pipeline metrics, diversity analysis, and query insights
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Days Selector */}
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg" role="group" aria-label="Time period selector">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    aria-pressed={days === d}
                    aria-label={`${d} days`}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all uppercase focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                      days === d
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                aria-label={refreshing ? 'Refreshing data' : 'Refresh data'}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {analytics && (
          <>
            {/* Top Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-500/10">
                    <Search className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Total Queries</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{analytics.total_queries.toLocaleString()}</p>
              </div>

              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-500/10">
                    <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Avg Results</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{analytics.funnel.avg_final.toFixed(1)}</p>
              </div>

              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${analytics.diversity.avg_score >= 0.5 ? 'bg-green-100 dark:bg-green-500/10' : 'bg-amber-100 dark:bg-amber-500/10'}`}>
                    <Target className={`w-3.5 h-3.5 ${analytics.diversity.avg_score >= 0.5 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Avg Diversity</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{(analytics.diversity.avg_score * 100).toFixed(0)}%</p>
              </div>

              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/10">
                    <Gauge className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Avg Quality</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{(analytics.quality.avg_score * 100).toFixed(0)}%</p>
              </div>

              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${analytics.slow_queries.length === 0 ? 'bg-green-100 dark:bg-green-500/10' : 'bg-red-100 dark:bg-red-500/10'}`}>
                    <Clock className={`w-3.5 h-3.5 ${analytics.slow_queries.length === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Slow Queries</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{analytics.slow_queries.length}</p>
              </div>
            </div>

            {/* Charts Row 1: Funnel + Diversity Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Pipeline Funnel */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Retrieval Pipeline Funnel</h3>
                </div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis type="number" tick={{ fontSize: 10 }} stroke="#64748b" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [value.toFixed(1), 'Avg Candidates']}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {funnelData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Diversity Trend */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-cyan-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Diversity Trend</h3>
                </div>
                <div className="h-[200px]">
                  {trends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="diversityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v) => v?.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Diversity']}
                        />
                        <Area type="monotone" dataKey="avg_diversity" stroke="#06b6d4" strokeWidth={2} fill="url(#diversityGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No trend data available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Charts Row 2: Intent + Complexity + Quality */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Intent Distribution */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Query Intent</h3>
                </div>
                <div className="h-[180px]">
                  {intentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={intentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {intentData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No data
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {intentData.slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-slate-500">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Complexity Distribution */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Complexity</h3>
                </div>
                <div className="h-[180px]">
                  {complexityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={complexityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {complexityData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No data
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {complexityData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-slate-500">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Distribution */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Gauge className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Quality Distribution</h3>
                </div>
                <div className="h-[180px]">
                  {qualityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={qualityData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis dataKey="range" tick={{ fontSize: 9 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {qualityData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No data
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Problem Queries Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Slow Queries */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-red-500" />
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Slow Queries (&gt;2s)</h3>
                    </div>
                    {analytics.slow_queries.length > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                        {analytics.slow_queries.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[300px] overflow-auto">
                  {analytics.slow_queries.length > 0 ? (
                    analytics.slow_queries.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{q.query}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{q.created_at?.slice(0, 16)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                            {(q.latency_ms / 1000).toFixed(1)}s
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center" aria-hidden="true">
                        <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">All Fast</p>
                      <p className="text-xs text-slate-500">No slow queries detected</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Low Diversity Queries */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-500" />
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Low Diversity (&lt;30%)</h3>
                    </div>
                    {analytics.low_diversity_queries.length > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                        {analytics.low_diversity_queries.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[300px] overflow-auto">
                  {analytics.low_diversity_queries.length > 0 ? (
                    analytics.low_diversity_queries.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{q.query}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{q.result_count} results</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                            {(q.diversity_score * 100).toFixed(0)}%
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center" aria-hidden="true">
                        <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">Good Diversity</p>
                      <p className="text-xs text-slate-500">All queries have adequate diversity</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
