'use client';

import { useCallback } from 'react';
import type { TimeRange } from '@/types/visualization';
import type {
  Test,
  Agent,
  Alert,
  TestResult,
  TestHealthCell,
  PathTopology,
  TimelineItem,
  CrossPlatformInsight,
  AgentGroupSummary,
  CorrelatedDevice,
  SiteHealthSummary,
  PlatformHealthSummary,
  TEEvent,
  Outage,
} from '@/components/thousandeyes/types';
import { useTECommandCenter } from '@/components/thousandeyes/useTECommandCenter';
import { useSplunkCommandCenter } from '@/components/splunk/useSplunkCommandCenter';
import { useMerakiOrganizations } from './hooks/useMerakiOrganizations';
import { useMerakiTopology } from './hooks/useMerakiTopology';
import { useMerakiVpn } from './hooks/useMerakiVpn';
import { useMerakiPerformance } from './hooks/useMerakiPerformance';
import { useCrossPlatformAnnotations } from './hooks/useCrossPlatformAnnotations';
import { usePlatformStatuses } from './hooks/usePlatformStatuses';

// Re-export types used by the original interface
import type { NetworkPlatformOrg } from '@/types';
import type {
  TopologyNode,
  TopologyEdge,
  OrgNetworkNode,
  OrgVpnEdge,
  DeviceAnnotation,
  LinkAnnotation,
  PerformanceData,
  PlatformStatus,
} from '@/types/visualization';

// ============================================================================
// Types
// ============================================================================

interface Network {
  id: string;
  name: string;
  organizationId?: string;
  productTypes?: string[];
  timeZone?: string;
}

export interface VisualizationHubState {
  // Meraki
  organizations: NetworkPlatformOrg[];
  networks: Network[];
  selectedOrg: string;
  selectedNetwork: string;
  topologyNodes: TopologyNode[];
  topologyEdges: TopologyEdge[];
  vpnNodes: OrgNetworkNode[];
  vpnEdges: OrgVpnEdge[];
  vpnSummary: { totalNetworks: number; hubCount: number; spokeCount: number; standaloneCount: number; totalVpnTunnels: number } | null;
  performanceData: PerformanceData[];

  // ThousandEyes (from command center)
  teTests: Test[];
  teAgents: Agent[];
  teAlerts: Alert[];
  teTestResults: Record<number, TestResult[]>;
  teTestHealth: TestHealthCell[];
  teConfigured: boolean;
  tePathTopology: PathTopology | null;
  teHealthScore: number;
  teIssueTimeline: TimelineItem[];
  teCrossPlatformInsights: CrossPlatformInsight[];
  teAgentsByRegion: Record<string, AgentGroupSummary>;
  teCorrelatedDevices: CorrelatedDevice[];
  teSiteHealth: SiteHealthSummary[];
  tePlatformHealth: PlatformHealthSummary[];
  teEvents: TEEvent[];
  teOutages: Outage[];
  teActiveOutageCount: number;

  // Splunk
  splunkConfigured: boolean;
  splunkInsights: any[];
  splunkEventCount: number;

  // Cross-platform
  deviceAnnotations: Map<string, DeviceAnnotation>;
  linkAnnotations: Map<string, LinkAnnotation>;
  platformStatuses: PlatformStatus[];

  // Loading / errors
  loading: boolean;
  topologyLoading: boolean;
  performanceLoading: boolean;
  error: string | null;

  // Actions
  setSelectedOrg: (org: string) => void;
  setSelectedNetwork: (net: string) => void;
  setIncludeClients: (include: boolean) => void;
  fetchTopology: () => Promise<void>;
  fetchVpnTopology: () => Promise<void>;
  fetchPerformance: (timeRange: TimeRange) => Promise<void>;
  fetchTETestResults: (testId: number, testType: string) => Promise<void>;
  refresh: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useVisualizationHub(): VisualizationHubState {
  const orgs = useMerakiOrganizations();

  const topology = useMerakiTopology({
    selectedOrg: orgs.selectedOrg,
    selectedNetwork: orgs.selectedNetwork,
  });

  const vpn = useMerakiVpn({
    selectedOrg: orgs.selectedOrg,
    organizations: orgs.organizations,
  });

  const performance = useMerakiPerformance({
    selectedOrg: orgs.selectedOrg,
    selectedNetwork: orgs.selectedNetwork,
  });

  const te = useTECommandCenter();
  const splunk = useSplunkCommandCenter();

  const annotations = useCrossPlatformAnnotations({
    topologyNodes: topology.topologyNodes,
    teAgents: te.agents,
    teTests: te.tests,
    teAlerts: te.alerts,
    teTestHealthMap: te.testHealthMap,
    teTestResults: te.testResults,
  });

  const { platformStatuses } = usePlatformStatuses({
    organizations: orgs.organizations,
    topologyNodes: topology.topologyNodes,
    teAgents: te.agents,
    teIsConfigured: te.isConfigured,
    teHealthScore: te.healthScore,
    splunkIsConfigured: splunk.isConfigured,
    splunkError: splunk.error,
    splunkIndexCount: splunk.indexCount,
  });

  const refresh = useCallback(() => {
    if (orgs.selectedNetwork) topology.fetchTopology();
    te.refresh();
    splunk.refresh();
  }, [orgs.selectedNetwork, topology, te, splunk]);

  const fetchTETestResults = useCallback(async (testId: number, testType: string) => {
    await te.fetchTestResults(testId, testType);
  }, [te]);

  return {
    organizations: orgs.organizations,
    networks: orgs.networks,
    selectedOrg: orgs.selectedOrg,
    selectedNetwork: orgs.selectedNetwork,
    topologyNodes: topology.topologyNodes,
    topologyEdges: topology.topologyEdges,
    vpnNodes: vpn.vpnNodes,
    vpnEdges: vpn.vpnEdges,
    vpnSummary: vpn.vpnSummary,
    performanceData: performance.performanceData,

    teTests: te.tests,
    teAgents: te.agents,
    teAlerts: te.alerts,
    teTestResults: te.testResults,
    teTestHealth: te.testHealthMap,
    teConfigured: te.isConfigured,
    tePathTopology: null,
    teHealthScore: te.healthScore,
    teIssueTimeline: te.issueTimeline,
    teCrossPlatformInsights: te.crossPlatformInsights,
    teAgentsByRegion: te.agentsByRegion,
    teCorrelatedDevices: te.correlatedDevices,
    teSiteHealth: te.siteHealth,
    tePlatformHealth: te.platformHealth,
    teEvents: te.events,
    teOutages: te.outages,
    teActiveOutageCount: te.activeOutageCount,

    splunkConfigured: splunk.isConfigured,
    splunkInsights: splunk.insights,
    splunkEventCount: splunk.totalEventCount,

    deviceAnnotations: annotations.deviceAnnotations,
    linkAnnotations: annotations.linkAnnotations,
    platformStatuses,

    loading: orgs.loading,
    topologyLoading: topology.topologyLoading,
    performanceLoading: performance.performanceLoading,
    error: orgs.error,

    setSelectedOrg: orgs.setSelectedOrg,
    setSelectedNetwork: orgs.setSelectedNetwork,
    setIncludeClients: topology.setIncludeClients,
    fetchTopology: topology.fetchTopology,
    fetchVpnTopology: vpn.fetchVpnTopology,
    fetchPerformance: performance.fetchPerformance,
    fetchTETestResults,
    refresh,
  };
}
