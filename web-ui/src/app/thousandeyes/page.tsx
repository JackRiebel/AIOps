'use client';

import { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAISession } from '@/contexts/AISessionContext';
import { useTECommandCenter } from '@/components/thousandeyes/useTECommandCenter';
import { TECommandHeader } from '@/components/thousandeyes/TECommandHeader';
import { TENavigationBar } from '@/components/thousandeyes/TENavigationBar';
import { TEAIIntelligencePanel } from '@/components/thousandeyes/TEAIIntelligencePanel';
import { TEPlatformSidebar } from '@/components/thousandeyes/TEPlatformSidebar';
import { TETestHealthGrid } from '@/components/thousandeyes/TETestHealthGrid';
import { TEAgentStatusGrid } from '@/components/thousandeyes/TEAgentStatusGrid';
import { TEDetailPanel } from '@/components/thousandeyes/TEDetailPanel';
import { AIPathJourneyView } from '@/components/visualizations/AIPathJourneyView';
import { PathIntelligenceView } from '@/components/visualizations/PathIntelligenceView';
import {
  TestsTable,
  AlertsTable,
  AgentsTable,
  EventsPanel,
  OutagesPanel,
  CreateTestModal,
  InternetInsightsPanel,
  TEAICostImpactCard,
  type TEDashboardView,
  type TimelineItem,
} from '@/components/thousandeyes';
import { MCPSection } from '@/components/ai-journey/MCPSection';

// ============================================================================
// Sub-nav pill types
// ============================================================================

type InvestigateSubView = 'tests-alerts' | 'agents' | 'path-analysis' | 'internet';
type PlatformSubView = 'ai-journey' | 'mcp-servers';

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

const VALID_TABS = new Set<string>(['overview', 'investigate', 'platform']);

// ============================================================================
// Wrapper — Suspense for useSearchParams
// ============================================================================

export default function ThousandEyesPageWrapper() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ThousandEyesPage />
    </Suspense>
  );
}

// ============================================================================
// ThousandEyes — Network Intelligence Center (AI-First Redesign)
// ============================================================================

const INVESTIGATE_PILLS: { id: InvestigateSubView; label: string }[] = [
  { id: 'tests-alerts', label: 'Tests & Alerts' },
  { id: 'path-analysis', label: 'Path Analysis' },
  { id: 'internet', label: 'Internet' },
  { id: 'agents', label: 'Agents' },
];

const PLATFORM_PILLS: { id: PlatformSubView; label: string }[] = [
  { id: 'ai-journey', label: 'AI Journey' },
  { id: 'mcp-servers', label: 'MCP Servers' },
];

function ThousandEyesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { logAIQuery, isActive: isAISessionActive } = useAISession();
  const state = useTECommandCenter();

  // Persist active tab in URL
  const tabParam = searchParams.get('tab') || '';
  const view: TEDashboardView = VALID_TABS.has(tabParam)
    ? (tabParam as TEDashboardView)
    : 'overview';

  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<TimelineItem | null>(null);
  const [aiQuery, setAiQuery] = useState<string | null>(null);
  const [investigateSubView, setInvestigateSubView] = useState<InvestigateSubView>('tests-alerts');
  const [platformSubView, setPlatformSubView] = useState<PlatformSubView>('ai-journey');

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleTestClick = useCallback((testId: number) => {
    setSelectedTimelineItem(null);
    setSelectedTestId(prev => prev === testId ? null : testId);
  }, []);

  const handleTimelineItemClick = useCallback((item: TimelineItem) => {
    setSelectedTestId(null);
    setSelectedTimelineItem(prev => prev?.id === item.id ? null : item);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedTestId(null);
    setSelectedTimelineItem(null);
  }, []);

  const handleCommandSubmit = useCallback((query: string) => {
    setAiQuery(query);
  }, []);

  const handleExternalQueryConsumed = useCallback(() => {
    setAiQuery(null);
  }, []);

  const handleAskAI = useCallback((context: string) => {
    setAiQuery(context);
  }, []);

  const handleViewChange = useCallback((newView: TEDashboardView) => {
    router.replace(`/thousandeyes?tab=${newView}`, { scroll: false });
    if (newView !== 'overview') {
      setSelectedTestId(null);
      setSelectedTimelineItem(null);
    }
  }, [router]);

  const handleIssueClick = useCallback((_item: TimelineItem) => {
    router.replace('/thousandeyes?tab=investigate', { scroll: false });
  }, [router]);

  const handleNavigate = useCallback((target: string) => {
    if (target === 'operations' || target === 'monitoring') {
      router.replace('/thousandeyes?tab=investigate', { scroll: false });
    } else if (target === 'infrastructure') {
      router.replace('/thousandeyes?tab=investigate', { scroll: false });
      setInvestigateSubView('agents');
    }
  }, [router]);

  const selectedTest = selectedTestId
    ? state.tests.find(t => t.testId === selectedTestId) || null
    : null;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-auto">
      <div className="px-6 py-5 max-w-[1600px] mx-auto space-y-3">
        {/* Command Header */}
        <TECommandHeader
          healthScore={state.healthScore}
          lastSyncTime={state.lastSyncTime}
          loading={state.loading}
          onRefresh={state.refresh}
          onCommandSubmit={handleCommandSubmit}
        />

        {/* Navigation — 3 tabs */}
        <TENavigationBar
          currentView={view}
          onViewChange={handleViewChange}
          onCreateTest={() => state.setShowCreateModal(true)}
        />

        {/* Configuration Warning */}
        {!state.isConfigured && (
          <div role="alert" className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3.5">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-500/20 rounded-md">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">Configuration Required</h3>
                <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">
                  Add your THOUSANDEYES_OAUTH_TOKEN to your environment configuration to enable monitoring.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <div role="alert" className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3.5">
            <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>
          </div>
        )}

        {/* ============================================================ */}
        {/* Overview Tab — AI-Driven Network Health */}
        {/* Always mounted to preserve AI analysis state across tab switches */}
        {/* ============================================================ */}
        <div className={view === 'overview' ? 'space-y-3' : 'hidden'}>
          {/* Hero: AI Panel + Platform Sidebar */}
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-8">
              <TEAIIntelligencePanel
                testCount={state.tests.length}
                activeAlerts={state.activeAlertCount}
                agentsOnline={state.enabledAgentsCount}
                agentsTotal={state.agents.length}
                eventCount={state.events.length}
                outageCount={state.activeOutageCount}
                healthScore={state.healthScore}
                crossPlatformInsights={state.crossPlatformInsights}
                testHealthData={state.testHealthMap}
                externalQuery={aiQuery}
                onExternalQueryConsumed={handleExternalQueryConsumed}
                dataReady={state.initialLoadComplete}
                splunkCorrelation={state.splunkCorrelation}
                logAIQuery={logAIQuery}
                isAISessionActive={isAISessionActive}
              />
            </div>
            <div className="col-span-12 lg:col-span-4 space-y-3">
              <TEPlatformSidebar
                platformHealth={state.platformHealth}
                issueTimeline={state.issueTimeline}
                splunkCorrelation={state.splunkCorrelation}
                onNavigate={handleNavigate}
                onIssueClick={handleIssueClick}
              />
              <TEAICostImpactCard loading={state.loading} />
            </div>
          </div>

          {/* Test Health Grid */}
          <TETestHealthGrid
            tests={state.testHealthMap}
            loading={state.loadingTests && state.tests.length === 0}
            onTestClick={handleTestClick}
            selectedTestId={selectedTestId}
          />

          {/* Detail Panel (animated expand) */}
          <AnimatePresence>
            {(selectedTest || selectedTimelineItem) && (
              <TEDetailPanel
                selectedTest={selectedTest}
                selectedTimelineItem={selectedTimelineItem}
                testResults={state.testResults}
                loadingResults={state.loadingResults}
                tests={state.tests}
                onClose={handleCloseDetail}
                onFetchTestResults={state.fetchTestResults}
                onAskAI={handleAskAI}
              />
            )}
          </AnimatePresence>
        </div>

        {/* ============================================================ */}
        {/* Investigate Tab — Tests, Alerts, Agents, Path, Internet */}
        {/* ============================================================ */}
        {view === 'investigate' && (
          <div className="space-y-3">
            <SubNavPills
              items={INVESTIGATE_PILLS}
              value={investigateSubView}
              onChange={setInvestigateSubView}
            />

            {investigateSubView === 'tests-alerts' && (
              <div className="space-y-3">
                <TestsTable
                  tests={state.tests}
                  testResults={state.testResults}
                  loadingResults={state.loadingResults}
                  loading={state.loadingTests}
                  selectedOrg="default"
                  isConfigured={state.isConfigured}
                  onCreateTest={() => state.setShowCreateModal(true)}
                  onToggleResults={state.fetchTestResults}
                  onAskAI={handleAskAI}
                />
                <AlertsTable alerts={state.alerts} loading={state.loadingAlerts} />
                <EventsPanel events={state.events} loading={state.loadingEvents} onAskAI={handleAskAI} />
                <OutagesPanel outages={state.outages} loading={state.loadingOutages} onAskAI={handleAskAI} />
              </div>
            )}

            {investigateSubView === 'agents' && (
              <div className="space-y-3">
                <TEAgentStatusGrid
                  agentsByRegion={state.agentsByRegion}
                  platformHealth={state.platformHealth}
                  loading={state.loadingAgents && state.agents.length === 0}
                  onAgentGroupClick={() => {}}
                />
                <AgentsTable agents={state.agents} loading={state.loadingAgents} onAskAI={handleAskAI} />
              </div>
            )}

            {investigateSubView === 'path-analysis' && (
              <PathIntelligenceView
                tests={state.tests}
                testResults={state.testResults}
                fetchTestResults={state.fetchTestResults}
                isConfigured={state.isConfigured}
              />
            )}

            {investigateSubView === 'internet' && (
              <InternetInsightsPanel onAskAI={handleAskAI} />
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* Platform Tab — AI Journey + MCP Servers */}
        {/* ============================================================ */}
        {view === 'platform' && (
          <div className="space-y-3">
            <SubNavPills
              items={PLATFORM_PILLS}
              value={platformSubView}
              onChange={setPlatformSubView}
            />

            {platformSubView === 'ai-journey' && <AIPathJourneyView />}
            {platformSubView === 'mcp-servers' && <MCPSection />}
          </div>
        )}
      </div>

      {/* Create Test Modal */}
      <CreateTestModal
        isOpen={state.showCreateModal}
        onClose={() => state.setShowCreateModal(false)}
        onCreateAI={state.createTestFromAI}
        onCreateManual={state.createTestManual}
        loading={state.loadingTests}
        aiProcessing={state.aiProcessing}
        error={state.error}
      />
    </div>
  );
}
