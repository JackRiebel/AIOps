'use client';

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, BarChart3, Globe } from 'lucide-react';
import { ExportButton, ROIReportExport } from '@/components/reports';
import {
  CostsTabBar,
  DailySpendChart,
  UsageSummaryCard,
  ModelBreakdownTable,
  AIInsightsPanel,
  SessionsTable,
  ROIComparisonCard,
  MTTRDashboard,
  WeeklyROIReport,
  RAGMetricsDashboard,
  type CostSummary,
  type DailyCost,
  type AISessionData,
  type CostsTabType,
  type MTTRData,
  type WeeklyReportData,
} from '@/components/costs';
import { NetworkCostImpactCard } from '@/components/costs/NetworkCostImpactCard';

// ============================================================================
// StatItem type (inlined from TopStatsBar)
// ============================================================================

interface StatItem {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  status?: 'normal' | 'success' | 'warning' | 'critical';
  href?: string;
  icon?: 'activity' | 'alert' | 'server' | 'cost';
  tooltip?: string;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function CostsLoadingSkeleton() {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-3">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-3 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Tab bar skeleton */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-fit">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-28 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-slate-200 dark:border-l-slate-700 p-3"
            >
              <div className="h-2.5 w-20 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mb-2" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
              <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Content area skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 h-64 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 animate-pulse" />
          <div className="h-64 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Border color helper for stat cards
// ============================================================================

function getStatBorderColor(stat: StatItem): string {
  switch (stat.id) {
    case 'spend':
      return 'border-l-cyan-500';
    case 'queries':
      return 'border-l-violet-500';
    case 'trend':
      return stat.status === 'warning' ? 'border-l-amber-500' : 'border-l-emerald-500';
    case 'monthly':
      return 'border-l-indigo-500';
    case 'time_saved':
      return 'border-l-emerald-500';
    case 'cost':
      return 'border-l-cyan-500';
    case 'roi':
      return stat.status === 'success'
        ? 'border-l-emerald-500'
        : stat.status === 'critical'
          ? 'border-l-red-500'
          : 'border-l-amber-500';
    case 'savings':
      return 'border-l-emerald-500';
    default:
      return 'border-l-cyan-500';
  }
}

// ============================================================================
// CostsDashboardContent (inner component with useSearchParams)
// ============================================================================

function CostsDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get('tab') as CostsTabType) || 'costs';

  // Cost data state
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [daily, setDaily] = useState<DailyCost[]>([]);
  const [loading, setLoading] = useState(true);

  // AI Insights state
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<AISessionData[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionFilter, setSessionFilter] = useState<'all' | 'completed' | 'active'>('all');

  // ROI Dashboard state
  interface ROIDashboard {
    total_sessions: number;
    completed_sessions: number;
    total_cost_usd: number;
    total_time_saved_minutes: number;
    total_manual_cost_estimate_usd: number;
    avg_roi_percentage: number;
    avg_efficiency_score: number;
    sessions_with_roi: number;
    mttr_improvement_pct?: number;
    week_over_week?: {
      sessions_change: number;
      cost_change: number;
      roi_change: number;
      time_saved_change: number;
    };
  }
  const [roiDashboard, setROIDashboard] = useState<ROIDashboard | null>(null);

  // Analytics state
  const [mttrData, setMTTRData] = useState<MTTRData | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // ============================================================================
  // Tab Navigation (URL-persisted)
  // ============================================================================

  const handleTabChange = useCallback((tab: CostsTabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
    setSelectedSessionId(null);
  }, [searchParams, router]);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const statusParam = sessionFilter === 'all' ? '' : `?status=${sessionFilter}`;
      const [sessionsRes, roiRes] = await Promise.all([
        fetch(`/api/ai-sessions/list${statusParam}`, { credentials: 'include' }),
        fetch('/api/ai-sessions/roi/dashboard?days=30', { credentials: 'include' }),
      ]);

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions(data.sessions || []);
      }

      if (roiRes.ok) {
        const roiData = await roiRes.json();
        setROIDashboard(roiData);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, [sessionFilter]);

  const fetchAIInsights = useCallback(async () => {
    if (!summary) return;

    setAiInsightsLoading(true);
    try {
      const response = await fetch('/api/costs/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          summary: summary,
          daily_trend: daily,
          model_breakdown: summary.model_breakdown,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiInsights(data.analysis);
      } else {
        setAiInsights('Unable to generate insights. Please try again.');
      }
    } catch (err) {
      console.error('AI insights error:', err);
      setAiInsights('Unable to generate insights. Please try again.');
    } finally {
      setAiInsightsLoading(false);
    }
  }, [summary, daily]);

  // Initial data fetch + polling
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, dailyRes] = await Promise.all([
          fetch('/api/costs/summary?days=30', { credentials: 'include' }),
          fetch('/api/costs/daily?days=30', { credentials: 'include' }),
        ]);

        // Handle authentication, connection, and server errors gracefully
        // Show empty state instead of crashing the page
        if (!sumRes.ok || !dailyRes.ok) {
          console.log('Costs API unavailable:', sumRes.status, dailyRes.status);
          setLoading(false);
          return;
        }

        const sumData: CostSummary = await sumRes.json();
        const raw = await dailyRes.json();

        const sorted = raw.sort(
          (a: DailyCost, b: DailyCost) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const dailyData: DailyCost[] = sorted.map((item: DailyCost) => {
          const dateObj = new Date(item.date);
          const label = dateObj.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });
          return { date: item.date, cost_usd: Number(item.cost_usd.toFixed(4)), label };
        });

        setSummary(sumData);
        setDaily(dailyData);
      } catch (err) {
        console.error('Failed to load costs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, []);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const mttrRes = await fetch('/api/ai-sessions/mttr/dashboard', { credentials: 'include' });

      if (mttrRes.ok) {
        const mttr = await mttrRes.json();
        // Backend returns data nested in 'summary' object
        const summary = mttr.summary || {};
        setMTTRData({
          baselineMinutes: summary.baseline_mttr_minutes || 60,
          aiAssistedMinutes: summary.ai_assisted_mttr_minutes || 0,
          improvementPercentage: summary.improvement_percentage || 0,
          incidentsResolved: summary.incidents_resolved || 0,
          avgTimeSavedPerIncident: summary.incidents_resolved > 0
            ? (summary.total_time_saved_minutes || 0) / summary.incidents_resolved
            : 0,
          recentIncidents: (mttr.recent_resolved || []).map((inc: {
            session_id: number;
            session_name: string;
            incident_id: number;
            incident_title: string;
            resolution_time_minutes: number;
            baseline_minutes: number;
            improvement_percentage: number;
            resolved_at?: string;
          }) => ({
            id: inc.session_id,
            sessionName: inc.session_name,
            incidentId: inc.incident_id,
            incidentType: inc.incident_title || 'general',
            resolved: true,
            resolutionTimeMinutes: inc.resolution_time_minutes,
            baselineMinutes: inc.baseline_minutes,
            startedAt: inc.resolved_at || '',
            endedAt: inc.resolved_at,
          })),
        });
      }

      // Generate weekly report from ROI data
      if (roiDashboard) {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);

        // Filter sessions to only include those from the past week
        const weeklySessions = sessions.filter(s => {
          const sessionDate = new Date(s.started_at);
          return sessionDate >= weekStart && sessionDate <= now;
        });

        // Calculate weekly metrics from filtered sessions (not 30-day aggregate)
        const weeklyCompletedSessions = weeklySessions.filter(s => s.status === 'completed');
        const weeklyTimeSaved = weeklyCompletedSessions.reduce(
          (sum, s) => sum + (s.time_saved_minutes || 0), 0
        );

        const weeklyAiCost = weeklyCompletedSessions.reduce(
          (sum, s) => sum + (s.total_cost_usd || 0), 0
        );
        // Calculate labor cost: time_saved (hours) * $85/hr (default hourly rate)
        const weeklyLaborSaved = (weeklyTimeSaved / 60) * 85;

        setWeeklyReport({
          weekStart: weekStart.toISOString(),
          weekEnd: now.toISOString(),
          summary: {
            sessionsCompleted: weeklyCompletedSessions.length,
            totalTimeSavedMinutes: weeklyTimeSaved,
            laborCostSaved: weeklyLaborSaved,
            aiCostTotal: weeklyAiCost,
            netROI: weeklyLaborSaved - weeklyAiCost,
            roiMultiplier: weeklyAiCost > 0
              ? (weeklyLaborSaved - weeklyAiCost) / weeklyAiCost
              : 0,
          },
          topWins: weeklyCompletedSessions
            .filter(s => s.roi_percentage && s.roi_percentage > 0)
            .sort((a, b) => (b.roi_percentage || 0) - (a.roi_percentage || 0))
            .slice(0, 3)
            .map(s => ({
              sessionId: s.id,
              sessionName: s.name || 'Untitled Session',
              description: s.ai_summary?.outcome || 'Completed successfully',
              impact: s.time_saved_minutes ? `${Math.round(s.time_saved_minutes)}m saved` : 'High efficiency',
              roiPercentage: s.roi_percentage,
              timeSavedMinutes: s.time_saved_minutes,
            })),
          optimizations: weeklyCompletedSessions
            .filter(s => !s.roi_percentage || s.roi_percentage < 100)
            .slice(0, 3)
            .map(s => ({
              category: 'efficiency',
              issue: `Session "${s.name || 'Untitled'}" had ${s.roi_percentage?.toFixed(0) || 'low'}% ROI`,
              recommendation: 'Consider using more targeted queries to reduce token usage',
              priority: (s.roi_percentage || 0) < 50 ? 'high' as const : 'medium' as const,
            })),
          weekOverWeekChange: roiDashboard.week_over_week ? {
            sessions: roiDashboard.week_over_week.sessions_change,
            timeSaved: roiDashboard.week_over_week.time_saved_change,
            cost: roiDashboard.week_over_week.cost_change,
            roi: roiDashboard.week_over_week.roi_change,
          } : undefined,
        });
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [roiDashboard, sessions]);

  // Fetch sessions when tab changes or filter changes
  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab, sessionFilter, fetchSessions]);

  // Fetch analytics when tab changes
  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const { costTrendPct, trendUp, monthlyProjection } = useMemo(() => {
    if (!summary) return { costTrendPct: '0', trendUp: false, monthlyProjection: 0 };

    const cost7dDaily = summary.last_7_days.cost_usd / 7;
    const cost30dDaily = summary.total_cost_usd / 30;
    const pct = cost30dDaily > 0 ? ((cost7dDaily - cost30dDaily) / cost30dDaily) * 100 : 0;
    const dailyAvgCost = summary.total_cost_usd / summary.period_days;

    return {
      costTrendPct: pct.toFixed(1),
      trendUp: pct > 0,
      monthlyProjection: dailyAvgCost * 30,
    };
  }, [summary]);

  // Format time helper
  const formatTimeSaved = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Format ROI helper - cap at 99999% for readability
  const formatROIValue = (roi: number): string => {
    if (roi > 99999) return '>99,999%';
    return `${Math.round(roi).toLocaleString()}%`;
  };

  // Format cost helper - consistent formatting
  const formatCostValue = (cost: number): string => {
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    if (cost >= 0.01) return `$${cost.toFixed(2)}`;
    return `$${cost.toFixed(4)}`;
  };

  // Cost stats for inline metric cards
  const costStats: StatItem[] = useMemo(() => {
    if (!summary) return [];
    return [
      {
        id: 'spend',
        label: 'Total Spend',
        value: `$${summary.total_cost_usd.toFixed(2)}`,
        icon: 'cost',
        changeLabel: `${summary.period_days}-day period`,
        tooltip: 'Total API cost for all AI queries, calculated from token usage across all models',
      },
      {
        id: 'queries',
        label: 'Total Queries',
        value: summary.queries.toLocaleString(),
        icon: 'activity',
        changeLabel: `${(summary.queries / summary.period_days).toFixed(1)} per day avg`,
        tooltip: 'Number of AI queries processed. Each query can use multiple API calls for tool use.',
      },
      {
        id: 'trend',
        label: '7-Day Trend',
        value: `${trendUp ? '+' : ''}${costTrendPct}%`,
        status: trendUp ? 'warning' : 'success',
        changeLabel: `$${summary.last_7_days.cost_usd.toFixed(2)} last week`,
        tooltip: 'Cost change compared to previous 7-day period. Green = costs decreasing.',
      },
      {
        id: 'monthly',
        label: 'Monthly Est.',
        value: `$${monthlyProjection.toFixed(2)}`,
        icon: 'cost',
        changeLabel: 'Based on current usage',
        tooltip: 'Projected monthly cost based on average daily spend over the period.',
      },
    ];
  }, [summary, costTrendPct, trendUp, monthlyProjection]);

  // Session stats for inline metric cards - calculated from actual sessions
  const sessionStats: StatItem[] = useMemo(() => {
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const timeSaved = completedSessions.reduce((sum, s) => sum + (s.time_saved_minutes || 0), 0);
    const avgROI = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.roi_percentage || 0), 0) / completedSessions.length
      : 0;
    const totalCost = sessions.reduce((sum, s) => sum + (s.total_cost_usd || 0), 0);
    // Calculate labor cost: time_saved (hours) * $85/hr (default hourly rate)
    const laborSaved = (timeSaved / 60) * 85;
    const netSavings = laborSaved - totalCost;

    const weekChange = roiDashboard?.week_over_week;

    return [
      {
        id: 'time_saved',
        label: 'Time Saved',
        value: formatTimeSaved(timeSaved),
        status: 'success',
        changeLabel: weekChange?.time_saved_change != null
          ? `${weekChange.time_saved_change >= 0 ? '+' : ''}${weekChange.time_saved_change.toFixed(0)}% vs last week`
          : 'vs manual work',
        tooltip: 'Estimated time saved vs manual work, based on industry benchmarks for each unique task type performed.',
      },
      {
        id: 'cost',
        label: 'AI Cost',
        value: formatCostValue(totalCost),
        icon: 'cost',
        changeLabel: weekChange?.cost_change != null
          ? `${weekChange.cost_change >= 0 ? '+' : ''}${weekChange.cost_change.toFixed(0)}% vs last week`
          : `${sessions.length} sessions`,
        tooltip: 'Total API costs for AI-assisted sessions including all model usage.',
      },
      {
        id: 'roi',
        label: 'Avg ROI',
        value: formatROIValue(avgROI),
        status: avgROI >= 200 ? 'success' : avgROI >= 100 ? 'warning' : 'critical',
        changeLabel: weekChange?.roi_change != null
          ? `${weekChange.roi_change >= 0 ? '+' : ''}${weekChange.roi_change.toFixed(0)}pts vs last week`
          : 'efficiency gain',
        tooltip: 'Estimated ROI: (Est. labor saved - AI cost) / AI cost. Based on industry time benchmarks × $85/hr engineer rate.',
      },
      {
        id: 'savings',
        label: 'Net Savings',
        value: netSavings > 0 ? formatCostValue(netSavings) : '-',
        status: netSavings > 0 ? 'success' : undefined,
        changeLabel: roiDashboard?.mttr_improvement_pct != null
          ? `${roiDashboard.mttr_improvement_pct.toFixed(0)}% MTTR improvement`
          : 'labor cost avoided',
        tooltip: 'Estimated labor cost avoided minus actual AI API cost. Labor estimate uses industry benchmarks.',
      },
    ];
  }, [sessions, roiDashboard]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSelectSession = useCallback((session: AISessionData | null) => {
    setSelectedSessionId(session?.id ?? null);
  }, []);

  const handleFilterChange = useCallback((filter: 'all' | 'completed' | 'active') => {
    setSessionFilter(filter);
    setSelectedSessionId(null);
  }, []);

  const handleToggleInsights = useCallback(() => {
    setAiInsightsExpanded((prev) => !prev);
  }, []);

  const handleLinkIncident = useCallback(async (sessionId: number, incidentId: number, resolved: boolean) => {
    const response = await fetch(`/api/ai-sessions/${sessionId}/link-incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ incident_id: incidentId, resolved }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to link incident' }));
      throw new Error(error.detail || 'Failed to link incident');
    }

    // Refresh sessions to update the UI
    await fetchSessions();
  }, [fetchSessions]);

  // ============================================================================
  // Dynamic subtitle
  // ============================================================================

  const getSubtitle = (): string => {
    switch (activeTab) {
      case 'costs':
        return summary
          ? `Track AI usage and spending over the last ${summary.period_days} days`
          : 'Track AI usage and spending';
      case 'sessions':
        return 'Review your AI-assisted work sessions';
      case 'analytics':
        return 'ROI analytics, MTTR metrics, and weekly reports';
      case 'rag':
        return 'Agentic RAG pipeline performance and metrics';
      case 'network':
        return 'Network cost impact and optimization insights';
      default:
        return 'Track AI usage and spending';
    }
  };

  // ============================================================================
  // Determine which stats to show
  // ============================================================================

  const currentStats = activeTab === 'costs' ? costStats : sessionStats;
  const statsLoading = activeTab === 'sessions' && sessionsLoading && sessions.length === 0;

  // ============================================================================
  // Loading State
  // ============================================================================

  if (loading) {
    return <CostsLoadingSkeleton />;
  }

  // ============================================================================
  // Empty State
  // ============================================================================

  if (!summary || summary.queries === 0) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
        <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-3">
          {/* Enterprise Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">AI Cost & ROI Center</h1>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">Track AI usage and spending</p>
            </div>
          </div>

          {/* Empty State Card */}
          <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No AI usage data yet
            </p>
            <p className="text-sm text-slate-500">
              Cost tracking begins when AI queries are made
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-3">
        {/* Enterprise Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Title with gradient icon */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">AI Cost & ROI Center</h1>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">{getSubtitle()}</p>
            </div>
          </div>

          {/* Export buttons on right */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <ExportButton
              data={activeTab === 'sessions'
                ? sessions.map(s => ({
                    session_id: s.id,
                    name: s.name || 'Untitled Session',
                    started_at: new Date(s.started_at).toLocaleString(),
                    status: s.status,
                    total_events: s.total_events,
                    ai_queries: s.ai_query_count,
                    total_cost_usd: s.total_cost_usd,
                    total_tokens: s.total_tokens,
                    time_saved_minutes: s.time_saved_minutes ?? 0,
                    roi_percentage: s.roi_percentage ?? 0,
                  }))
                : daily.map(d => ({
                    date: d.date,
                    cost_usd: d.cost_usd,
                    label: d.label,
                  }))
              }
              filename={activeTab === 'sessions' ? 'ai_sessions' : 'ai_costs'}
              formats={['csv', 'json']}
              columns={activeTab === 'sessions'
                ? [
                    { key: 'session_id', label: 'Session ID' },
                    { key: 'name', label: 'Name' },
                    { key: 'started_at', label: 'Started' },
                    { key: 'status', label: 'Status' },
                    { key: 'total_events', label: 'Events' },
                    { key: 'ai_queries', label: 'AI Queries' },
                    { key: 'total_cost_usd', label: 'Cost ($)' },
                    { key: 'total_tokens', label: 'Tokens' },
                    { key: 'time_saved_minutes', label: 'Time Saved (min)' },
                    { key: 'roi_percentage', label: 'ROI (%)' },
                  ]
                : [
                    { key: 'date', label: 'Date' },
                    { key: 'cost_usd', label: 'Cost ($)' },
                    { key: 'label', label: 'Label' },
                  ]
              }
              formatValue={(key, value) => {
                if (key === 'total_cost_usd' || key === 'cost_usd') {
                  return typeof value === 'number' ? value.toFixed(4) : String(value);
                }
                if (key === 'roi_percentage') {
                  return typeof value === 'number' ? `${value.toFixed(0)}%` : String(value);
                }
                return String(value ?? '');
              }}
              variant="secondary"
              size="md"
            />
            <ROIReportExport
              data={{
                summary,
                sessions,
                dailyCosts: daily,
                roiMetrics: {
                  totalTimeSaved: roiDashboard?.total_time_saved_minutes ?? 0,
                  averageROI: roiDashboard?.avg_roi_percentage ?? 0,
                  totalManualCostSaved: roiDashboard?.total_manual_cost_estimate_usd ?? 0,
                },
              }}
              variant="primary"
              size="md"
            />
          </div>
        </div>

        {/* Tab Bar */}
        <CostsTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          sessionCount={sessions.length}
        />

        {/* Inline border-l-4 metric cards */}
        {(activeTab === 'costs' || activeTab === 'sessions') && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {statsLoading
              ? [1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 border-l-slate-200 dark:border-l-slate-700 p-3"
                  >
                    <div className="h-2.5 w-20 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mb-2" />
                    <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
                    <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  </div>
                ))
              : currentStats.map((stat) => (
                  <div
                    key={stat.id}
                    className={`bg-white dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/50 border-l-4 ${getStatBorderColor(stat)} p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40`}
                  >
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      {stat.label}
                    </p>
                    <div className="flex items-baseline gap-1.5 mb-1.5">
                      <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums leading-none">
                        {stat.value}
                      </span>
                    </div>
                    {stat.changeLabel && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{stat.changeLabel}</p>
                    )}
                  </div>
                ))
            }
          </div>
        )}

        {/* Tab Content with AnimatePresence */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {/* Cost Overview Tab Content */}
            {activeTab === 'costs' && (
              <div className="space-y-3">
                {/* AI Insights Panel */}
                <AIInsightsPanel
                  insights={aiInsights}
                  loading={aiInsightsLoading}
                  expanded={aiInsightsExpanded}
                  onToggleExpand={handleToggleInsights}
                  onAnalyze={fetchAIInsights}
                />

                {/* Chart and Summary Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <DailySpendChart data={daily} className="lg:col-span-2" />
                  <UsageSummaryCard summary={summary} />
                </div>

                {/* Model Breakdown Table */}
                {summary.model_breakdown.length > 0 && (
                  <ModelBreakdownTable
                    models={summary.model_breakdown}
                    totalCost={summary.total_cost_usd}
                  />
                )}
              </div>
            )}

            {/* Sessions Tab Content */}
            {activeTab === 'sessions' && (
              <div className="space-y-3">
                {/* ROI Comparison Card - only show if we have sessions */}
                {sessions.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                    <ROIComparisonCard
                      data={(() => {
                        const completedSessions = sessions.filter(s => s.status === 'completed');
                        const timeSavedMinutes = completedSessions.reduce((sum, s) => sum + (s.time_saved_minutes || 0), 0);
                        const totalCost = sessions.reduce((sum, s) => sum + (s.total_cost_usd || 0), 0);
                        const laborSaved = (timeSavedMinutes / 60) * 85;
                        const avgROI = completedSessions.length > 0
                          ? completedSessions.reduce((sum, s) => sum + (s.roi_percentage || 0), 0) / completedSessions.length
                          : 0;
                        // Calculate real average session duration from actual session data
                        const avgDuration = completedSessions.length > 0
                          ? completedSessions.reduce((sum, s) => {
                              if (s.started_at && s.ended_at) {
                                return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
                              }
                              return sum + (s.ai_summary?.metrics?.duration_minutes || 0);
                            }, 0) / completedSessions.length
                          : 0;
                        return {
                          timeSavedMinutes,
                          manualCostEstimate: laborSaved,
                          aiCostTotal: totalCost,
                          roiPercentage: avgROI,
                          sessionsCount: completedSessions.length,
                          avgSessionDuration: avgDuration,
                        };
                      })()}
                      className="lg:col-span-2"
                    />
                    <div className="lg:col-span-2 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-5">
                      <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                        Session Efficiency Breakdown
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                          <p className="text-3xl font-bold text-slate-900 dark:text-white">
                            {sessions.filter(s => s.status === 'completed').length}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Completed</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                          <p className="text-3xl font-bold text-slate-900 dark:text-white">
                            {sessions.filter(s => s.roi_percentage && s.roi_percentage > 0).length}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">With ROI Data</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                          <p className="text-3xl font-bold text-emerald-500">
                            {roiDashboard?.avg_efficiency_score?.toFixed(0) || '-'}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Avg Efficiency</p>
                        </div>
                        <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                          <p className="text-3xl font-bold text-cyan-500">
                            {roiDashboard?.mttr_improvement_pct != null
                              ? `${roiDashboard.mttr_improvement_pct.toFixed(0)}%`
                              : '-'}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">MTTR Improvement</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sessions Table */}
                <SessionsTable
                  sessions={sessions}
                  loading={sessionsLoading}
                  selectedSessionId={selectedSessionId}
                  filter={sessionFilter}
                  onSelectSession={handleSelectSession}
                  onFilterChange={handleFilterChange}
                  onRefresh={fetchSessions}
                  onLinkIncident={handleLinkIncident}
                />
              </div>
            )}

            {/* Analytics Tab Content */}
            {activeTab === 'analytics' && (
              <div className="space-y-3">
                {analyticsLoading && !weeklyReport && !mttrData ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        Loading analytics...
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Weekly ROI Report */}
                    {weeklyReport && (
                      <WeeklyROIReport
                        data={weeklyReport}
                        onDownload={() => {
                          const reportData = JSON.stringify(weeklyReport, null, 2);
                          const blob = new Blob([reportData], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `roi-report-${new Date().toISOString().split('T')[0]}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      />
                    )}

                    {/* MTTR Dashboard */}
                    {mttrData && (
                      <MTTRDashboard data={mttrData} />
                    )}

                    {/* Empty state if no data */}
                    {!weeklyReport && !mttrData && (
                      <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/50 p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center">
                          <BarChart3 className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                          No analytics data yet
                        </p>
                        <p className="text-sm text-slate-500">
                          Complete a few AI sessions to see ROI analytics and MTTR metrics
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Agentic RAG Tab Content */}
            {activeTab === 'rag' && (
              <RAGMetricsDashboard />
            )}

            {/* Network Tab Content */}
            {activeTab === 'network' && (
              <NetworkCostImpactCard />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================================
// AICostDashboard - Default Export with Suspense Boundary
// ============================================================================

export default function AICostDashboard() {
  return (
    <Suspense fallback={<CostsLoadingSkeleton />}>
      <CostsDashboardContent />
    </Suspense>
  );
}
