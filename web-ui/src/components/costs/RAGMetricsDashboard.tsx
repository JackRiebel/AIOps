'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  RefreshCw,
  Clock,
  Zap,
  FileText,
  Brain,
  Search,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Activity,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface RAGMetricsSummary {
  period_hours: number;
  total_queries: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  avg_citations: number;
  total_tokens_used: number;
  estimated_cost_usd: number;
  quality_distribution: Record<string, number>;
  strategy_distribution: Record<string, number>;
  web_search_rate: number;
  avg_iterations: number;
}

interface RAGAgentPerformance {
  agent_name: string;
  avg_duration_ms: number;
  p95_duration_ms: number;
  call_count: number;
  error_rate: number;
}

interface RAGHealthStatus {
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  message: string;
  metrics: {
    queries_last_hour?: number;
    avg_latency_ms?: number;
    zero_result_rate?: number;
  };
}

interface SlowQuery {
  id: number;
  query: string;
  strategy: string;
  latency_ms: number;
  citations: number;
  timestamp: string;
}

const AGENT_COLORS: Record<string, string> = {
  QueryAnalysisAgent: 'cyan',
  RetrievalRouterAgent: 'blue',
  DocumentGraderAgent: 'purple',
  CorrectiveRAGAgent: 'amber',
  SynthesisAgent: 'green',
  ReflectionAgent: 'pink',
};

const AGENT_ICONS: Record<string, React.ElementType> = {
  QueryAnalysisAgent: Search,
  RetrievalRouterAgent: Zap,
  DocumentGraderAgent: FileText,
  CorrectiveRAGAgent: RefreshCw,
  SynthesisAgent: Sparkles,
  ReflectionAgent: Brain,
};

export function RAGMetricsDashboard() {
  const [summary, setSummary] = useState<RAGMetricsSummary | null>(null);
  const [agents, setAgents] = useState<RAGAgentPerformance[]>([]);
  const [health, setHealth] = useState<RAGHealthStatus | null>(null);
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodHours, setPeriodHours] = useState(24);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, agentsRes, healthRes, slowRes] = await Promise.all([
        apiClient.get<RAGMetricsSummary>(`/api/rag-metrics/summary?hours=${periodHours}`),
        apiClient.get<RAGAgentPerformance[]>(`/api/rag-metrics/agents?hours=${periodHours}`),
        apiClient.get<RAGHealthStatus>('/api/rag-metrics/health'),
        apiClient.get<SlowQuery[]>('/api/rag-metrics/slow-queries?limit=5'),
      ]);

      setSummary(summaryRes);
      setAgents(agentsRes);
      setHealth(healthRes);
      setSlowQueries(slowRes);
    } catch (err) {
      console.error('Failed to fetch RAG metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodHours]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Loading RAG metrics...
          </p>
        </div>
      </div>
    );
  }

  if (!summary || summary.total_queries === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 dark:bg-purple-500/20 rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-purple-500" />
        </div>
        <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          No Agentic RAG data yet
        </p>
        <p className="text-sm text-slate-500">
          Metrics will appear once Agentic RAG is enabled and queries are processed
        </p>
      </div>
    );
  }

  const statusColors = {
    healthy: 'text-green-500',
    degraded: 'text-amber-500',
    error: 'text-red-500',
    unknown: 'text-slate-400',
  };

  const statusBg = {
    healthy: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20',
    degraded: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    error: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    unknown: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Agentic RAG Pipeline Metrics
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Performance analytics for the multi-agent RAG system
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={periodHours}
            onChange={(e) => setPeriodHours(Number(e.target.value))}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300"
          >
            <option value={1}>Last hour</option>
            <option value={24}>Last 24 hours</option>
            <option value={168}>Last 7 days</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Health Status Banner */}
      {health && (
        <div className={`p-4 rounded-lg border ${statusBg[health.status]}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {health.status === 'healthy' ? (
                <CheckCircle2 className={`w-5 h-5 ${statusColors[health.status]}`} />
              ) : health.status === 'degraded' ? (
                <AlertCircle className={`w-5 h-5 ${statusColors[health.status]}`} />
              ) : (
                <Activity className={`w-5 h-5 ${statusColors[health.status]}`} />
              )}
              <div>
                <p className={`font-medium ${statusColors[health.status]}`}>
                  Pipeline {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{health.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                {health.metrics.queries_last_hour || 0} queries/hr
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {health.metrics.avg_latency_ms?.toFixed(0) || 0}ms avg
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-cyan-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-cyan-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Queries
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.total_queries.toLocaleString()}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-purple-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Avg Latency
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.avg_latency_ms.toFixed(0)}
            <span className="text-sm font-normal text-slate-400 ml-1">ms</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">P95: {summary.p95_latency_ms.toFixed(0)}ms</p>
        </div>

        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-emerald-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Avg Citations
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {summary.avg_citations.toFixed(1)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-amber-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Est. Cost
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            ${summary.estimated_cost_usd.toFixed(4)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {summary.total_tokens_used.toLocaleString()} tokens
          </p>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
        <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          Agent Performance
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {agents.map((agent) => {
            const color = AGENT_COLORS[agent.agent_name] || 'slate';
            const Icon = AGENT_ICONS[agent.agent_name] || Brain;
            const displayName = agent.agent_name.replace('Agent', '');

            return (
              <div
                key={agent.agent_name}
                className={`p-3 rounded-lg bg-${color}-50 dark:bg-${color}-500/10 border border-${color}-200 dark:border-${color}-500/20`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 text-${color}-500`} />
                  <span className={`text-xs font-medium text-${color}-700 dark:text-${color}-400 truncate`}>
                    {displayName}
                  </span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {agent.avg_duration_ms.toFixed(0)}
                  <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
                </p>
                <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                  <span>P95: {agent.p95_duration_ms.toFixed(0)}ms</span>
                  <span>{(agent.error_rate * 100).toFixed(1)}% err</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strategy Distribution & Slow Queries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strategy Distribution */}
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
          <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            Retrieval Strategy Distribution
          </h3>
          <div className="space-y-3">
            {Object.entries(summary.strategy_distribution).map(([strategy, count]) => {
              const percentage = summary.total_queries > 0
                ? (count / summary.total_queries) * 100
                : 0;
              return (
                <div key={strategy}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {strategy}
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 dark:bg-cyan-400 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(summary.strategy_distribution).length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No strategy data available
              </p>
            )}
          </div>
        </div>

        {/* Slow Queries */}
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
          <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            Slow Queries ({'>'}10s)
          </h3>
          {slowQueries.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
              {slowQueries.map((query) => (
                <div
                  key={query.id}
                  className="px-3 py-3"
                >
                  <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1">
                    {query.query}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="text-red-500 font-medium">
                      {(query.latency_ms / 1000).toFixed(1)}s
                    </span>
                    <span>{query.strategy}</span>
                    <span>{query.citations} citations</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">
              No slow queries in this period
            </p>
          )}
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-blue-500 p-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Avg Iterations</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {summary.avg_iterations.toFixed(1)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-purple-500 p-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Web Search Rate</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {(summary.web_search_rate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-emerald-500 p-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Quality: Good</p>
          <p className="text-xl font-bold text-green-500">
            {summary.quality_distribution.GOOD || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-cyan-500 p-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Quality: Excellent</p>
          <p className="text-xl font-bold text-emerald-500">
            {summary.quality_distribution.EXCELLENT || 0}
          </p>
        </div>
      </div>
    </div>
  );
}

export default RAGMetricsDashboard;
