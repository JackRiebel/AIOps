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
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Clock,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Activity,
  Target,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Users,
  Bot,
  Wrench,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface FeedbackSummary {
  total_feedback: number;
  positive_count: number;
  negative_count: number;
  satisfaction_rate: number;
  sessions_with_feedback: number;
  unique_users: number;
  avg_latency_ms: number | null;
  avg_tokens: number | null;
}

interface WeekOverWeek {
  this_week_rate: number;
  last_week_rate: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrendPoint {
  date: string;
  total: number;
  positive: number;
  negative: number;
  satisfaction_rate: number;
}

interface ModelStats {
  model: string;
  total: number;
  positive: number;
  satisfaction_rate: number;
  avg_latency_ms: number | null;
  avg_tokens: number | null;
}

interface ToolSuccess {
  tool: string;
  total: number;
  positive: number;
  success_rate: number;
}

interface LatencyBucket {
  bucket: string;
  total: number;
  positive: number;
  satisfaction_rate: number;
}

interface IssueCategory {
  category: string;
  count: number;
}

interface FeedbackAnalytics {
  period_days: number;
  summary: FeedbackSummary;
  week_over_week: WeekOverWeek;
  trend: TrendPoint[];
  by_model: ModelStats[];
  tool_success_rates: ToolSuccess[];
  by_latency: LatencyBucket[];
  issue_breakdown: IssueCategory[];
}

const ISSUE_LABELS: Record<string, string> = {
  inaccurate: 'Inaccurate Info',
  incomplete: 'Incomplete Answer',
  slow: 'Too Slow',
  irrelevant: 'Not Relevant',
  confusing: 'Confusing',
  wrong_tool: 'Wrong Tool',
};

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6'];

export default function AIFeedbackAnalyticsPage() {
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);
      const days = timePeriod === '7d' ? 7 : timePeriod === '90d' ? 90 : 30;

      const res = await fetch(`/api/ai/feedback/analytics/detailed?days=${days}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error('Failed to fetch feedback analytics');
      }

      const data = await res.json();
      setAnalytics(data);
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

  const getHealthStatus = () => {
    if (!analytics) return { status: 'Unknown', color: 'slate', gradient: 'from-slate-500 to-slate-600' };

    const rate = analytics.summary.satisfaction_rate;
    if (rate >= 80) return { status: 'Excellent', color: 'emerald', gradient: 'from-emerald-500 to-green-600', icon: CheckCircle2 };
    if (rate >= 60) return { status: 'Good', color: 'cyan', gradient: 'from-cyan-500 to-blue-600', icon: Target };
    if (rate >= 40) return { status: 'Fair', color: 'amber', gradient: 'from-yellow-500 to-amber-600', icon: AlertTriangle };
    return { status: 'Needs Work', color: 'red', gradient: 'from-red-600 to-rose-700', icon: XCircle };
  };

  const getTrendIcon = () => {
    if (!analytics) return Minus;
    const { trend } = analytics.week_over_week;
    if (trend === 'up') return ArrowUpRight;
    if (trend === 'down') return ArrowDownRight;
    return Minus;
  };

  const getTrendColor = () => {
    if (!analytics) return 'text-slate-500';
    const { trend } = analytics.week_over_week;
    if (trend === 'up') return 'text-green-500';
    if (trend === 'down') return 'text-red-500';
    return 'text-slate-500';
  };

  // Format chart data
  const trendChartData = analytics?.trend.map((point) => ({
    date: point.date.slice(5), // MM-DD format
    satisfaction: point.satisfaction_rate,
    total: point.total,
    positive: point.positive,
    negative: point.negative,
  })) || [];

  const modelChartData = analytics?.by_model.map((m) => ({
    name: m.model === 'unknown' ? 'Unknown' : m.model.split('/').pop() || m.model,
    satisfaction: m.satisfaction_rate,
    total: m.total,
  })) || [];

  const latencyChartData = analytics?.by_latency || [];

  const issueChartData = analytics?.issue_breakdown.map((issue) => ({
    name: ISSUE_LABELS[issue.category] || issue.category,
    value: issue.count,
    category: issue.category,
  })) || [];

  if (loading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-cyan-100 dark:bg-cyan-500/10 rounded-full flex items-center justify-center" aria-hidden="true">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Loading Analytics</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Fetching AI feedback metrics...</p>
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
  const HealthIcon = health.icon || Target;
  const TrendIcon = getTrendIcon();

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-4 py-4 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/network"
            className="group inline-flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 mb-3 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to Lumen AI
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  AI Feedback Analytics
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Track AI response quality and user satisfaction
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Health Badge */}
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${health.gradient} text-white text-[10px] font-bold shadow-sm uppercase tracking-wide`} role="status" aria-label={`AI satisfaction status: ${health.status}`}>
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
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors shadow-sm hover:shadow-md disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                aria-label={refreshing ? 'Refreshing feedback analytics' : 'Refresh feedback analytics'}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {analytics && (
          <>
            {/* Top Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
              {/* Total Feedback */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-cyan-300 dark:hover:border-cyan-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-500/10">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Total</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{analytics.summary.total_feedback.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  feedback entries
                </p>
              </div>

              {/* Positive */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-green-300 dark:hover:border-green-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-500/10">
                    <ThumbsUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Positive</span>
                </div>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{analytics.summary.positive_count.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  helpful responses
                </p>
              </div>

              {/* Negative */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-red-300 dark:hover:border-red-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-500/10">
                    <ThumbsDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Negative</span>
                </div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{analytics.summary.negative_count.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  needs improvement
                </p>
              </div>

              {/* Satisfaction Rate */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-purple-300 dark:hover:border-purple-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-500/10">
                    <Target className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Satisfaction</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{analytics.summary.satisfaction_rate.toFixed(1)}%</p>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full ${
                      analytics.summary.satisfaction_rate >= 80 ? 'bg-green-500' :
                      analytics.summary.satisfaction_rate >= 60 ? 'bg-cyan-500' :
                      analytics.summary.satisfaction_rate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${analytics.summary.satisfaction_rate}%` }}
                  />
                </div>
              </div>

              {/* Unique Users */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/10">
                    <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Users</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{analytics.summary.unique_users.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  provided feedback
                </p>
              </div>

              {/* Week over Week */}
              <div className="px-4 py-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${
                    analytics.week_over_week.trend === 'up' ? 'bg-green-100 dark:bg-green-500/10' :
                    analytics.week_over_week.trend === 'down' ? 'bg-red-100 dark:bg-red-500/10' :
                    'bg-slate-100 dark:bg-slate-500/10'
                  }`}>
                    <TrendIcon className={`w-3.5 h-3.5 ${getTrendColor()}`} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">WoW</span>
                </div>
                <p className={`text-lg font-bold ${getTrendColor()}`}>
                  {analytics.week_over_week.change >= 0 ? '+' : ''}{analytics.week_over_week.change.toFixed(1)}%
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  vs last week
                </p>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Satisfaction Trend */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Satisfaction Trend</h3>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase">{timePeriod}</span>
                </div>
                <div className="h-[200px]">
                  {trendChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="satisfactionGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
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
                          formatter={(value: number, name: string) => [
                            name === 'satisfaction' ? `${value.toFixed(1)}%` : value,
                            name === 'satisfaction' ? 'Satisfaction' : name
                          ]}
                        />
                        <Area type="monotone" dataKey="satisfaction" stroke="#8b5cf6" strokeWidth={2} fill="url(#satisfactionGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No trend data available
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback Volume */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-green-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Feedback Volume</h3>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase">{timePeriod}</span>
                </div>
                <div className="h-[200px]">
                  {trendChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                        <Bar dataKey="positive" stackId="a" fill="#22c55e" name="Positive" />
                        <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negative" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No volume data available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* By Model */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">By Model</h3>
                </div>
                <div className="h-[180px]">
                  {modelChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modelChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" width={70} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, 'Satisfaction']}
                        />
                        <Bar dataKey="satisfaction" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No model data
                    </div>
                  )}
                </div>
              </div>

              {/* By Latency */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">By Response Time</h3>
                </div>
                <div className="h-[180px]">
                  {latencyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={latencyChartData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis type="category" dataKey="bucket" tick={{ fontSize: 9 }} stroke="#64748b" width={80} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, 'Satisfaction']}
                        />
                        <Bar dataKey="satisfaction_rate" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      No latency data
                    </div>
                  )}
                </div>
              </div>

              {/* Issue Breakdown */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Issue Categories</h3>
                </div>
                <div className="h-[180px]">
                  {issueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={issueChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {issueChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" aria-hidden="true" />
                        <p className="text-sm text-slate-500">No issues reported</p>
                      </div>
                    </div>
                  )}
                </div>
                {/* Issue Legend */}
                {issueChartData.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 justify-center">
                    {issueChartData.slice(0, 4).map((issue, idx) => (
                      <div key={issue.category} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
                        <span className="text-[9px] text-slate-500">{issue.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tool Success Table */}
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-cyan-500" />
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tool Success Rates</h3>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">{analytics.tool_success_rates.length} tools</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[300px] overflow-y-auto">
                {analytics.tool_success_rates.length > 0 ? (
                  analytics.tool_success_rates.map((tool, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate font-mono">
                          {tool.tool}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0 ml-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">{tool.total} uses</span>
                        </div>
                        <div className="w-20">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  tool.success_rate >= 80 ? 'bg-green-500' :
                                  tool.success_rate >= 60 ? 'bg-cyan-500' :
                                  tool.success_rate >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${tool.success_rate}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white w-10 text-right">
                              {tool.success_rate.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <Wrench className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-slate-500">No tool data recorded</p>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <ThumbsUp className="w-4 h-4 opacity-80" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">This Week</span>
                </div>
                <p className="text-2xl font-bold">{analytics.week_over_week.this_week_rate.toFixed(1)}%</p>
                <p className="text-[10px] opacity-80 mt-1">satisfaction rate</p>
              </div>
              <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-4 text-white shadow-lg shadow-slate-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 opacity-80" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Last Week</span>
                </div>
                <p className="text-2xl font-bold">{analytics.week_over_week.last_week_rate.toFixed(1)}%</p>
                <p className="text-[10px] opacity-80 mt-1">satisfaction rate</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl p-4 text-white shadow-lg shadow-cyan-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 opacity-80" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Avg Latency</span>
                </div>
                <p className="text-2xl font-bold">
                  {analytics.summary.avg_latency_ms
                    ? analytics.summary.avg_latency_ms < 1000
                      ? `${analytics.summary.avg_latency_ms}ms`
                      : `${(analytics.summary.avg_latency_ms / 1000).toFixed(1)}s`
                    : 'N/A'
                  }
                </p>
                <p className="text-[10px] opacity-80 mt-1">response time</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-4 text-white shadow-lg shadow-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 opacity-80" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Avg Tokens</span>
                </div>
                <p className="text-2xl font-bold">
                  {analytics.summary.avg_tokens ? analytics.summary.avg_tokens.toLocaleString() : 'N/A'}
                </p>
                <p className="text-[10px] opacity-80 mt-1">per response</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
