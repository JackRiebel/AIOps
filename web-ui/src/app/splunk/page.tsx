'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useSplunkChat } from '@/hooks/useSplunkChat';
import { TopStatsBar, type StatItem } from '@/components/dashboard/TopStatsBar';
import {
  SplunkSearchCard,
  InsightsGrid,
  RawLogsCard,
  InvestigationModal,
  LogDetailModal,
  type SplunkInsight,
  type SplunkLog,
} from '@/components/splunk';

// ============================================================================
// Splunk Page Component
// ============================================================================

export default function SplunkPage() {
  // Use 'default' as org parameter - config comes from system_config
  const selectedOrg = 'default';
  const [isConfigured, setIsConfigured] = useState(true);

  // Data state
  const [insights, setInsights] = useState<SplunkInsight[]>([]);
  const [rawLogs, setRawLogs] = useState<SplunkLog[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Search state
  // Simple default - AI categorization will filter out irrelevant API metadata
  const [searchQuery, setSearchQuery] = useState('search index=* | head 100');
  const [timeRange, setTimeRange] = useState('-24h');
  const [aiPrompt, setAiPrompt] = useState('');
  const [maxLogs, setMaxLogs] = useState(100);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawLogs, setShowRawLogs] = useState(false);

  // Modal state
  const [expandedCard, setExpandedCard] = useState<SplunkInsight | null>(null);
  const [cardInvestigation, setCardInvestigation] = useState<string | null>(null);
  const [investigatingCard, setInvestigatingCard] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<SplunkLog | null>(null);

  // AI chat hook
  const { analyzeInsight, generateSPL } = useSplunkChat();

  // ============================================================================
  // Data Fetching (uses system_config, no organization selection needed)
  // ============================================================================

  const loadInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/splunk/insights?organization=${encodeURIComponent(selectedOrg)}`,
        { credentials: 'include' }
      );

      if (response.status === 503) {
        setIsConfigured(false);
        setError('Splunk is not configured. Add your credentials in Admin > System Config.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setInsights(data.insights || []);
      setIsConfigured(true);

      if (data.insights?.length > 0) {
        const mostRecent = data.insights.reduce((latest: SplunkInsight, curr: SplunkInsight) => {
          if (!latest.created_at) return curr;
          if (!curr.created_at) return latest;
          return new Date(curr.created_at) > new Date(latest.created_at) ? curr : latest;
        });
        if (mostRecent.created_at) {
          setLastUpdated(new Date(mostRecent.created_at));
        }
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : '';
      if (!errMessage.includes('404')) {
        setError(errMessage || 'Failed to load insights');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  const generateInsights = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch(
        `/api/splunk/insights/generate?organization=${encodeURIComponent(selectedOrg)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            search_query: searchQuery,
            time_range: timeRange,
            max_logs: maxLogs,
          }),
          credentials: 'include',
        }
      );

      if (response.status === 503) {
        setIsConfigured(false);
        setError('Splunk is not configured. Add your credentials in Admin > System Config.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setInsights(data.insights || []);
      setLastUpdated(new Date());
      setIsConfigured(true);

      if (data.insights?.length === 0) {
        setError('No logs found for the specified query and time range');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  }, [selectedOrg, searchQuery, timeRange, maxLogs]);

  const searchWithAI = useCallback(async () => {
    if (!aiPrompt.trim()) {
      setError('Please describe what you want to search for');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      setAiProcessing(true);
      setError(null);

      const response = await fetch(
        `/api/splunk/search/ai?organization=${encodeURIComponent(selectedOrg)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: aiPrompt,
            earliest_time: timeRange,
          }),
          signal: controller.signal,
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.spl_query || data.generated_spl) {
        setSearchQuery(data.spl_query || data.generated_spl || searchQuery);
      }

      await generateInsights();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('AI search timed out after 30 seconds');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to search with AI');
      }
    } finally {
      clearTimeout(timeoutId);
      setAiProcessing(false);
    }
  }, [selectedOrg, aiPrompt, timeRange, searchQuery, generateInsights]);

  const fetchRawLogs = useCallback(async () => {
    if (!selectedOrg) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/splunk/search?organization=${encodeURIComponent(selectedOrg)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            search: searchQuery,
            earliest_time: timeRange,
            latest_time: 'now',
            max_results: maxLogs,
          }),
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRawLogs(data.results || []);
      }
    } catch {
      // Fetch failed silently
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, searchQuery, timeRange, maxLogs]);

  // ============================================================================
  // Card Actions
  // ============================================================================

  const investigateCard = useCallback(async (card: SplunkInsight) => {
    setExpandedCard(card);
    setInvestigatingCard(card.title);
    setCardInvestigation(null);

    try {
      const prompt = `You are a senior SRE/DevOps engineer analyzing Splunk logs. Based on this log category summary, provide a detailed investigation:

Category: ${card.title}
Severity: ${card.severity}
Count: ${card.log_count} occurrences
Description: ${card.description}
Source System: ${card.source_system || 'Unknown'}

Example log entries:
${card.examples.map((ex, i) => `${i + 1}. ${ex}`).join('\n')}

Please provide:
1. **Root Cause Analysis**: What are the most likely causes of these events?
2. **Impact Assessment**: What systems or users might be affected?
3. **Recommended Actions**: What immediate steps should be taken?
4. **Prevention**: How can we prevent this in the future?
5. **Related Patterns**: What other log patterns should we look for?

Keep the response concise but actionable.`;

      const result = await analyzeInsight(prompt, selectedOrg);

      if (result.error) {
        throw new Error(result.error);
      }

      setCardInvestigation(result.content || 'No analysis available');
    } catch (err) {
      setCardInvestigation(`Failed to generate analysis: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`);
    } finally {
      setInvestigatingCard(null);
    }
  }, [selectedOrg, analyzeInsight]);

  const getSuggestedQuery = useCallback(async (card: SplunkInsight) => {
    setInvestigatingCard(card.title + '-query');

    try {
      const prompt = `Based on this log category, generate a Splunk SPL query that would help investigate further:

Category: ${card.title}
Severity: ${card.severity}
Examples:
${card.examples.slice(0, 2).join('\n')}

Return ONLY a valid SPL query (no explanation). The query should help find related events and provide useful statistics.`;

      const result = await generateSPL(prompt, selectedOrg);

      if (!result.error && result.content) {
        const query = result.content.trim();
        const splMatch = query.match(/```(?:spl)?\s*([\s\S]*?)```/) || query.match(/^(search\s+.+)$/m);
        if (splMatch) {
          setSearchQuery(splMatch[1].trim());
        } else {
          setSearchQuery(query.split('\n')[0]);
        }
        setShowAdvanced(true);
      }
    } catch {
      // Query suggestion failed silently
    } finally {
      setInvestigatingCard(null);
    }
  }, [selectedOrg, generateSPL]);

  const findSimilarLogs = useCallback((card: SplunkInsight) => {
    const keywords = card.title.toLowerCase().split(' ').filter(w => w.length > 3);
    const searchTerms = keywords.slice(0, 3).join(' OR ');
    setAiPrompt(`Find more logs related to: ${card.title}. Look for patterns involving ${searchTerms}`);
    setExpandedCard(null);
  }, []);

  const handleToggleRawLogs = useCallback(() => {
    setShowRawLogs(!showRawLogs);
    if (!showRawLogs && rawLogs.length === 0) {
      fetchRawLogs();
    }
  }, [showRawLogs, rawLogs.length, fetchRawLogs]);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // ============================================================================
  // Computed Stats
  // ============================================================================

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    insights.forEach(i => {
      if (i.severity in counts) {
        counts[i.severity as keyof typeof counts]++;
      }
    });
    return counts;
  }, [insights]);

  const stats: StatItem[] = useMemo(() => [
    { id: 'total', label: 'Total Insights', value: insights.length, icon: 'activity', tooltip: 'AI-generated insights from Splunk log analysis.' },
    { id: 'critical', label: 'Critical', value: severityCounts.critical, icon: 'alert', status: severityCounts.critical > 0 ? 'critical' : 'normal', tooltip: 'Severe issues requiring immediate attention.' },
    { id: 'high', label: 'High', value: severityCounts.high, icon: 'alert', status: severityCounts.high > 0 ? 'warning' : 'normal', tooltip: 'Important issues that should be addressed soon.' },
    { id: 'medium', label: 'Medium', value: severityCounts.medium, icon: 'alert', tooltip: 'Moderate issues for planned remediation.' },
    { id: 'low', label: 'Low', value: severityCounts.low, icon: 'activity', tooltip: 'Informational findings and minor issues.' },
  ], [insights.length, severityCounts]);

  // ============================================================================
  // Helpers
  // ============================================================================

  const formatLastUpdated = (date: Date): string => {
    const ageMs = Date.now() - date.getTime();
    const minutes = Math.floor(ageMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    return date.toLocaleDateString();
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Splunk Log Analysis</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              AI-powered log analysis and insights
              {lastUpdated && (
                <span className="ml-2">• Last updated {formatLastUpdated(lastUpdated)}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={() => generateInsights()}
              disabled={generating || !isConfigured}
              aria-label={generating ? 'Generating insights...' : 'Generate new insights'}
              className="p-2.5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-500/50 transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Configuration Warning */}
        {!isConfigured && (
          <div role="alert" className="mb-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Configuration Required</h3>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  Splunk is not configured. Please add your Splunk credentials in Admin → System Config.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top Stats Bar */}
        <TopStatsBar stats={stats} loading={loading && !insights.length} className="mb-6" />

        {/* Error Banner */}
        {error && (
          <div role="alert" className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Search Card */}
        <div className="mb-6">
          <SplunkSearchCard
            aiPrompt={aiPrompt}
            onAiPromptChange={setAiPrompt}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            maxLogs={maxLogs}
            onMaxLogsChange={setMaxLogs}
            showAdvanced={showAdvanced}
            onShowAdvancedChange={setShowAdvanced}
            onSearchWithAI={searchWithAI}
            onSearchManual={() => generateInsights()}
            aiProcessing={aiProcessing}
            generating={generating}
            disabled={!isConfigured}
          />
        </div>

        {/* Insights Grid */}
        <InsightsGrid
          insights={insights}
          loading={loading}
          generating={generating}
          showRawLogs={showRawLogs}
          onToggleRawLogs={handleToggleRawLogs}
          onInvestigate={investigateCard}
          onGetSPL={(card) => {
            getSuggestedQuery(card);
            setExpandedCard(null);
            setCardInvestigation(null);
          }}
          onFindSimilar={findSimilarLogs}
          investigatingCard={investigatingCard}
        />

        {/* Raw Logs Card */}
        {showRawLogs && (
          <div className="mt-6">
            <RawLogsCard
              logs={rawLogs}
              maxLogs={maxLogs}
              onSelectLog={setSelectedLog}
            />
          </div>
        )}
      </div>

      {/* Investigation Modal */}
      {expandedCard && (
        <InvestigationModal
          insight={expandedCard}
          investigation={cardInvestigation}
          isInvestigating={investigatingCard === expandedCard.title}
          onClose={() => {
            setExpandedCard(null);
            setCardInvestigation(null);
          }}
          onInvestigate={() => investigateCard(expandedCard)}
          onGetSPL={() => {
            getSuggestedQuery(expandedCard);
            setExpandedCard(null);
            setCardInvestigation(null);
          }}
          onFindSimilar={() => findSimilarLogs(expandedCard)}
        />
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
