'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  Test,
  TestResult,
  Alert,
  Agent,
  TEEvent,
  Outage,
  HealthMetric,
  TestHealthCell,
  TimelineItem,
  CrossPlatformInsight,
  AgentGroupSummary,
  MerakiCachedDevice,
  MerakiCachedNetwork,
  CatalystCachedDevice,
  CatalystCachedNetwork,
  CachedOrganization,
  PlatformHealthSummary,
  CorrelatedDevice,
  SiteHealthSummary,
  TEDashboard,
  TEDashboardWidget,
  TESplunkCorrelation,
} from './types';
import { useTECoreFetch } from './hooks/useTECoreFetch';
import { useTETestResults } from './hooks/useTETestResults';
import { useTEInfrastructureCache } from './hooks/useTEInfrastructureCache';
import { useTEHealthMetrics } from './hooks/useTEHealthMetrics';
import { useTETestHealth } from './hooks/useTETestHealth';
import { useTECrossPlatform } from './hooks/useTECrossPlatform';
import { useTEDashboards } from './hooks/useTEDashboards';
import { useTETestCreation } from './hooks/useTETestCreation';

// ============================================================================
// Types
// ============================================================================

export interface TECommandCenterState {
  // Raw data
  tests: Test[];
  alerts: Alert[];
  agents: Agent[];
  events: TEEvent[];
  outages: Outage[];
  endpointAgents: any[];
  testResults: Record<number, TestResult[]>;
  loadingResults: Record<number, boolean>;
  merakiDevices: MerakiCachedDevice[];
  merakiNetworks: MerakiCachedNetwork[];
  catalystDevices: CatalystCachedDevice[];
  catalystNetworks: CatalystCachedNetwork[];
  organizations: CachedOrganization[];

  // Per-resource loading
  loadingTests: boolean;
  loadingAlerts: boolean;
  loadingAgents: boolean;
  loadingEvents: boolean;
  loadingOutages: boolean;
  loadingEndpoints: boolean;
  loading: boolean;

  // Derived state
  initialLoadComplete: boolean;
  isConfigured: boolean;
  error: string | null;
  healthScore: number;
  metrics: HealthMetric[];
  testHealthMap: TestHealthCell[];
  issueTimeline: TimelineItem[];
  agentsByRegion: Record<string, AgentGroupSummary>;
  crossPlatformInsights: CrossPlatformInsight[];
  platformHealth: PlatformHealthSummary[];
  correlatedDevices: CorrelatedDevice[];
  siteHealth: SiteHealthSummary[];
  lastSyncTime: Date | null;

  // Computed counts
  activeAlertCount: number;
  enabledAgentsCount: number;
  activeOutageCount: number;

  // UI state
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  aiProcessing: boolean;

  // MCP & Dashboards
  mcpAvailable: boolean;
  mcpTools: string[];
  dashboards: TEDashboard[];
  dashboardWidgets: Record<string, TEDashboardWidget[]>;
  loadingDashboards: boolean;
  splunkCorrelation: TESplunkCorrelation | null;
  loadingSplunkCorrelation: boolean;

  // Actions
  refresh: () => void;
  fetchTestResults: (testId: number, testType: string) => Promise<void>;
  createTestFromAI: (prompt: string) => Promise<void>;
  createTestManual: (config: { testName: string; url: string; testType: string; interval: number }) => Promise<void>;
  runInstantTest: (config: any) => Promise<any>;
  updateTest: (testId: number, data: Record<string, any>) => Promise<void>;
  deleteTest: (testId: number) => Promise<void>;
  fetchDashboardWidgets: (dashboardId: string) => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useTECommandCenter(): TECommandCenterState {
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const initialFetchDone = useRef(false);

  // Sub-hooks
  const core = useTECoreFetch();
  const infra = useTEInfrastructureCache();
  const dashboardsHook = useTEDashboards();

  const testResultsHook = useTETestResults({
    tests: core.tests,
    loadingTests: core.loadingTests,
  });

  const healthMetrics = useTEHealthMetrics({
    tests: core.tests,
    agents: core.agents,
    alerts: core.alerts,
    events: core.events,
    outages: core.outages,
    testResults: testResultsHook.testResults,
  });

  const testHealth = useTETestHealth({
    tests: core.tests,
    alerts: core.alerts,
    events: core.events,
    outages: core.outages,
    testResults: testResultsHook.testResults,
  });

  const crossPlatform = useTECrossPlatform({
    agents: core.agents,
    alerts: core.alerts,
    tests: core.tests,
    merakiDevices: infra.merakiDevices,
    merakiNetworks: infra.merakiNetworks,
    catalystDevices: infra.catalystDevices,
    catalystNetworks: infra.catalystNetworks,
    organizations: infra.organizations,
    isConfigured: core.isConfigured,
    activeAlertCount: healthMetrics.activeAlertCount,
    enabledAgentsCount: healthMetrics.enabledAgentsCount,
    initialLoadComplete,
  });

  const testCreation = useTETestCreation({
    fetchTests: core.fetchTests,
    setError: core.setError,
  });

  // Composite loading
  const loading = core.loadingTests || core.loadingAlerts || core.loadingAgents ||
    core.loadingEvents || core.loadingOutages || core.loadingEndpoints;

  // Refresh
  const refresh = useCallback(() => {
    core.setError(null);
    setLastSyncTime(new Date());
    Promise.allSettled([
      core.fetchTests(), core.fetchAlerts(), core.fetchAgents(),
      core.fetchEvents(), core.fetchOutages(), core.fetchEndpointAgents(),
      infra.fetchNetworkCache(),
      dashboardsHook.checkMcpStatus(),
    ]);
  }, [core, infra, dashboardsHook]);

  // Initial fetch
  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    setLastSyncTime(new Date());
    core.fetchAgentTypeFilter().then(() => {
      Promise.allSettled([
        core.fetchTests(), core.fetchAlerts(), core.fetchAgents(),
        core.fetchEvents(), core.fetchOutages(), core.fetchEndpointAgents(),
        infra.fetchNetworkCache(),
        dashboardsHook.checkMcpStatus(),
      ]).then(() => setInitialLoadComplete(true));
    });
  }, [core, infra, dashboardsHook]);

  return {
    tests: testHealth.enrichedTests,
    alerts: core.alerts,
    agents: core.agents,
    events: core.events,
    outages: core.outages,
    endpointAgents: core.endpointAgents,
    testResults: testResultsHook.testResults,
    loadingResults: testResultsHook.loadingResults,
    merakiDevices: infra.merakiDevices,
    merakiNetworks: infra.merakiNetworks,
    catalystDevices: infra.catalystDevices,
    catalystNetworks: infra.catalystNetworks,
    organizations: infra.organizations,
    mcpAvailable: dashboardsHook.mcpAvailable,
    mcpTools: dashboardsHook.mcpTools,
    dashboards: dashboardsHook.dashboards,
    dashboardWidgets: dashboardsHook.dashboardWidgets,
    loadingDashboards: dashboardsHook.loadingDashboards,
    splunkCorrelation: crossPlatform.splunkCorrelation,
    loadingSplunkCorrelation: crossPlatform.loadingSplunkCorrelation,
    loadingTests: core.loadingTests,
    loadingAlerts: core.loadingAlerts,
    loadingAgents: core.loadingAgents,
    loadingEvents: core.loadingEvents,
    loadingOutages: core.loadingOutages,
    loadingEndpoints: core.loadingEndpoints,
    loading,
    initialLoadComplete,
    isConfigured: core.isConfigured,
    error: core.error,
    healthScore: healthMetrics.healthScore,
    metrics: healthMetrics.metrics,
    testHealthMap: testHealth.testHealthMap,
    issueTimeline: testHealth.issueTimeline,
    agentsByRegion: crossPlatform.agentsByRegion,
    crossPlatformInsights: crossPlatform.crossPlatformInsights,
    platformHealth: crossPlatform.platformHealth,
    correlatedDevices: crossPlatform.correlatedDevices,
    siteHealth: crossPlatform.siteHealth,
    lastSyncTime,
    activeAlertCount: healthMetrics.activeAlertCount,
    enabledAgentsCount: healthMetrics.enabledAgentsCount,
    activeOutageCount: healthMetrics.activeOutageCount,
    showCreateModal: testCreation.showCreateModal,
    setShowCreateModal: testCreation.setShowCreateModal,
    aiProcessing: testCreation.aiProcessing,
    refresh,
    fetchTestResults: testResultsHook.fetchTestResults,
    createTestFromAI: testCreation.createTestFromAI,
    createTestManual: testCreation.createTestManual,
    runInstantTest: testCreation.runInstantTest,
    updateTest: testCreation.updateTest,
    deleteTest: testCreation.deleteTest,
    fetchDashboardWidgets: dashboardsHook.fetchDashboardWidgets,
  };
}
