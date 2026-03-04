'use client';

import { useCallback, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAISession } from '@/contexts/AISessionContext';
import {
  SplunkCommandHeader,
  SplunkNavigationBar,
  SplunkStatsRow,
  SplunkAIStreamPanel,
  SplunkPlatformSidebar,
  SplunkActivityFeed,
  SplunkCorrelatedDevicesCard,
  SplunkIndexChart,
  SplunkSeverityChart,
  SplunkSecurityOverview,
  SplunkNetworkSecurityPanel,
  SplunkInvestigatePanel,
  SplunkIndexExplorer,
  SplunkKnowledgeBrowser,
  SplunkSecuritySummaryCard,
  InsightsGrid,
  RawLogsCard,
  InvestigationModal,
  LogDetailModal,
  type SplunkInsight,
  type SplunkLog,
} from '@/components/splunk';
import { useSplunkCommandCenter } from '@/components/splunk/useSplunkCommandCenter';
import type { SplunkDashboardView } from '@/components/splunk/types';

// ============================================================================
// Sub-nav pill types
// ============================================================================

type InvestigateSubView = 'search-spl' | 'security' | 'indexes' | 'knowledge' | 'insights';

// ============================================================================
// Loading Skeleton (for Suspense)
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900">
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-3">
        <div className="h-14 bg-slate-200 dark:bg-slate-700/50 rounded-xl animate-pulse" />
        <div className="h-10 w-96 bg-slate-200 dark:bg-slate-700/50 rounded-lg animate-pulse" />
        <div className="h-96 bg-slate-200 dark:bg-slate-700/50 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Nav Pills
// ============================================================================

function SubNavPills<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="bg-slate-100 dark:bg-slate-800/40 rounded-lg p-1 inline-flex gap-1">
      {items.map(pill => (
        <button
          key={pill.id}
          onClick={() => onChange(pill.id)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
            value === pill.id
              ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Valid tab IDs for URL persistence
// ============================================================================

const VALID_TABS = new Set<string>(['overview', 'investigate']);

// ============================================================================
// Constants
// ============================================================================

const INVESTIGATE_PILLS: { id: InvestigateSubView; label: string }[] = [
  { id: 'search-spl', label: 'Search & SPL' },
  { id: 'security', label: 'Security' },
  { id: 'indexes', label: 'Indexes' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'insights', label: 'Insights' },
];

// ============================================================================
// Wrapper — Suspense for useSearchParams
// ============================================================================

export default function SplunkPageWrapper() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SplunkPage />
    </Suspense>
  );
}

// ============================================================================
// Splunk Intelligence Center — AI-First Redesign
// ============================================================================

function SplunkPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { logAIQuery, isActive: isAISessionActive } = useAISession();
  const cc = useSplunkCommandCenter({ logAIQuery, isAISessionActive });

  // Persist active tab in URL
  const tabParam = searchParams.get('tab') || '';
  const view: SplunkDashboardView = VALID_TABS.has(tabParam)
    ? (tabParam as SplunkDashboardView)
    : 'overview';

  // Modal state
  const [expandedCard, setExpandedCard] = useState<SplunkInsight | null>(null);
  const [cardInvestigation, setCardInvestigation] = useState<string | null>(null);
  const [investigatingCard, setInvestigatingCard] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<SplunkLog | null>(null);
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [commandQuery, setCommandQuery] = useState<string | null>(null);

  // Investigate sub-view
  const [investigateSubView, setInvestigateSubView] = useState<InvestigateSubView>('search-spl');

  // ============================================================================
  // View change handler (URL + hook sync)
  // ============================================================================

  const handleViewChange = useCallback((newView: SplunkDashboardView) => {
    router.replace(`/splunk?tab=${newView}`, { scroll: false });
    cc.setCurrentView(newView);
  }, [router, cc]);

  // ============================================================================
  // Stats
  // ============================================================================

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    cc.insights.forEach(i => {
      if (i.severity in counts) counts[i.severity as keyof typeof counts]++;
    });
    return counts;
  }, [cc.insights]);

  const activeAlerts = severityCounts.critical + severityCounts.high;
  const healthScore = useMemo(() => {
    if (cc.indexCount === 0) return 0;
    const base = 100;
    const penalty = severityCounts.critical * 15 + severityCounts.high * 8 + severityCounts.medium * 3;
    return Math.max(0, Math.min(100, base - penalty));
  }, [cc.indexCount, severityCounts]);

  // ============================================================================
  // Card actions
  // ============================================================================

  const investigateCard = useCallback((card: SplunkInsight) => {
    const prompt = `Investigate Splunk log category: ${card.title} (${card.severity} severity, ${card.log_count} occurrences). Examples: ${card.examples.slice(0, 3).join('; ')}. Provide root cause analysis, impact, and recommendations.`;
    router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
  }, [router]);

  const getSuggestedQuery = useCallback((card: SplunkInsight) => {
    const prompt = `Generate a Splunk SPL query to investigate: ${card.title} (${card.severity} severity, ${card.log_count} occurrences). Return ONLY a valid SPL query.`;
    router.push(`/chat-v2?q=${encodeURIComponent(prompt)}`);
  }, [router]);

  const findSimilarLogs = useCallback((_card: SplunkInsight) => {
    setExpandedCard(null);
  }, []);

  const handleToggleRawLogs = useCallback(() => {
    setShowRawLogs(prev => !prev);
    if (!showRawLogs && cc.rawLogs.length === 0) {
      cc.searchLogs('search index=* | head 100', '-24h', 100);
    }
  }, [showRawLogs, cc]);

  const handleRunSavedSearch = useCallback((search: string) => {
    router.replace('/splunk?tab=investigate', { scroll: false });
    cc.setCurrentView('investigate');
    setInvestigateSubView('search-spl');
    cc.searchLogs(search, '-24h', 1000);
  }, [router, cc]);

  const handleCommandSubmit = useCallback((q: string) => {
    setCommandQuery(q);
    router.replace('/splunk?tab=investigate', { scroll: false });
    cc.setCurrentView('investigate');
    setInvestigateSubView('search-spl');
  }, [router, cc]);

  const handleAskAI = useCallback((query: string) => {
    router.push(`/chat-v2?q=${encodeURIComponent(query)}`);
  }, [router]);

  const handleSecuritySearch = useCallback((query: string) => {
    router.replace('/splunk?tab=investigate', { scroll: false });
    cc.setCurrentView('investigate');
    setInvestigateSubView('search-spl');
    setCommandQuery(query);
  }, [router, cc]);

  const handleViewSecurityDetails = useCallback(() => {
    router.replace('/splunk?tab=investigate', { scroll: false });
    cc.setCurrentView('investigate');
    setInvestigateSubView('security');
  }, [router, cc]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-3">
        {/* Header */}
        <SplunkCommandHeader
          serverName={cc.serverInfo?.serverName || null}
          lastSyncTime={cc.lastSyncTime}
          loading={cc.loading}
          isConfigured={cc.isConfigured}
          healthScore={healthScore}
          onRefresh={cc.refresh}
          onCommandSubmit={handleCommandSubmit}
        />

        {/* Navigation — 2 tabs */}
        <SplunkNavigationBar
          currentView={view}
          onViewChange={handleViewChange}
        />

        {/* Config warning */}
        {!cc.isConfigured && (
          <div role="alert" className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Configuration Required</h3>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  Splunk is not configured. Please add your Splunk credentials in Admin &rarr; System Config.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error banner */}
        {cc.error && (
          <div role="alert" className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm text-red-700 dark:text-red-400">{cc.error}</p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* Overview Tab — AI Command Center */}
        {/* Always mounted to preserve AI analysis state across tab switches */}
        {/* ============================================================ */}
        <div className={view === 'overview' ? 'space-y-3' : 'hidden'}>
          {/* Stats Row */}
          <SplunkStatsRow
            indexCount={cc.indexCount}
            totalEventCount={cc.totalEventCount}
            sourceCount={cc.sourceCount}
            hostCount={cc.hostCount}
            activeAlerts={activeAlerts}
            healthScore={healthScore}
            loading={cc.loadingEnvironment && !cc.initialLoadComplete}
          />

          {/* Two-column layout — columns flow independently to eliminate empty space */}
          <div className="grid grid-cols-12 gap-4">
            {/* Left column */}
            <div className="col-span-12 lg:col-span-8 space-y-3">
              <SplunkAIStreamPanel
                indexCount={cc.indexCount}
                totalEventCount={cc.totalEventCount}
                sourceCount={cc.sourceCount}
                hostCount={cc.hostCount}
                saiaAvailable={cc.saiaAvailable}
                insightCount={cc.insights.length}
                dataReady={cc.initialLoadComplete}
                logAIQuery={logAIQuery}
                isAISessionActive={isAISessionActive}
              />
              <SplunkActivityFeed
                logs={cc.activityFeed}
                loading={!cc.initialLoadComplete}
                onViewAll={() => {
                  router.replace('/splunk?tab=investigate', { scroll: false });
                  cc.setCurrentView('investigate');
                  setInvestigateSubView('search-spl');
                }}
              />
              <SplunkSecuritySummaryCard
                insights={cc.insights}
                loading={cc.loadingInsights && !cc.initialLoadComplete}
                onViewDetails={handleViewSecurityDetails}
              />
            </div>

            {/* Right column */}
            <div className="col-span-12 lg:col-span-4 space-y-3">
              <SplunkPlatformSidebar
                serverInfo={cc.serverInfo}
                userInfo={cc.userInfo}
                merakiCount={cc.merakiDevices.length}
                catalystCount={cc.catalystDevices.length}
                teAgentCount={0}
                isConfigured={cc.isConfigured}
                onNavigate={(v) => {
                  if (v === 'explore') {
                    router.replace('/splunk?tab=investigate', { scroll: false });
                    cc.setCurrentView('investigate');
                    setInvestigateSubView('indexes');
                  } else {
                    handleViewChange(v as SplunkDashboardView);
                  }
                }}
              />
              <SplunkCorrelatedDevicesCard
                devices={cc.correlatedDevices}
                loading={cc.loadingCorrelation}
                merakiDevices={cc.merakiDevices}
                catalystDevices={cc.catalystDevices}
              />
              <SplunkSeverityChart
                insights={cc.insights}
                loading={cc.loadingInsights && !cc.initialLoadComplete}
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* Investigate Tab — Search, Security, Indexes, Knowledge, Insights */}
        {/* ============================================================ */}
        <AnimatePresence>
          {view === 'investigate' && (
            <div className="space-y-4">
              <SubNavPills
                items={INVESTIGATE_PILLS}
                value={investigateSubView}
                onChange={setInvestigateSubView}
              />

              {/* Search & SPL */}
              {investigateSubView === 'search-spl' && (
                <SplunkInvestigatePanel
                  saiaAvailable={cc.saiaAvailable}
                  loadingSaia={cc.loadingSaia}
                  generatedSpl={cc.generatedSpl}
                  splExplanation={cc.splExplanation}
                  optimizedSpl={cc.optimizedSpl}
                  onGenerateSpl={cc.generateSpl}
                  onExplainSpl={cc.explainSpl}
                  onOptimizeSpl={cc.optimizeSpl}
                  loadingSearch={cc.loadingSearch}
                  searchResults={cc.searchResults}
                  onSearch={cc.searchLogs}
                  correlatedDevices={cc.correlatedDevices}
                  loadingCorrelation={cc.loadingCorrelation}
                  onCorrelate={cc.correlateSearchResults}
                  saiaAnswer={cc.saiaAnswer}
                  onAskSplunk={cc.askSplunk}
                  initialQuery={commandQuery}
                />
              )}

              {/* Security */}
              {investigateSubView === 'security' && (
                <div className="space-y-4">
                  <SplunkSecurityOverview
                    insights={cc.insights}
                    correlatedDevices={cc.correlatedDevices}
                    merakiDevices={cc.merakiDevices}
                    catalystDevices={cc.catalystDevices}
                    totalEventCount={cc.totalEventCount}
                    hostCount={cc.hostCount}
                    loading={cc.loadingInsights && !cc.initialLoadComplete}
                  />
                  <SplunkNetworkSecurityPanel
                    correlatedDevices={cc.correlatedDevices}
                    merakiDevices={cc.merakiDevices}
                    catalystDevices={cc.catalystDevices}
                    insights={cc.insights}
                    totalEventCount={cc.totalEventCount}
                    loadingCorrelation={cc.loadingCorrelation}
                    onAskAI={handleAskAI}
                    onSearch={handleSecuritySearch}
                  />
                </div>
              )}

              {/* Indexes */}
              {investigateSubView === 'indexes' && (
                <div className="space-y-4">
                  <SplunkIndexExplorer
                    indexes={cc.indexes}
                    indexDetails={cc.indexDetails}
                    indexMetadata={cc.indexMetadata}
                    loading={cc.loadingEnvironment}
                    onFetchDetail={cc.fetchIndexDetail}
                    onFetchMetadata={cc.fetchIndexMetadata}
                  />
                  <SplunkIndexChart
                    indexes={cc.indexes}
                    loading={cc.loadingEnvironment && !cc.initialLoadComplete}
                    onIndexClick={() => {}}
                  />
                </div>
              )}

              {/* Knowledge */}
              {investigateSubView === 'knowledge' && (
                <SplunkKnowledgeBrowser
                  objects={cc.knowledgeObjects}
                  loading={cc.loadingKnowledge}
                  onFetchObjects={cc.fetchKnowledgeObjects}
                  onRunSearch={handleRunSavedSearch}
                />
              )}

              {/* Insights */}
              {investigateSubView === 'insights' && (
                <div className="space-y-4">
                  <InsightsGrid
                    insights={cc.insights}
                    loading={cc.loadingInsights}
                    generating={false}
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
                  {showRawLogs && (
                    <RawLogsCard
                      logs={cc.rawLogs}
                      maxLogs={100}
                      onSelectLog={setSelectedLog}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
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

      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
