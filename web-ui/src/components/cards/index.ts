/**
 * Enterprise Network Dashboard Cards
 *
 * A complete card system for enterprise network visualization.
 * Features polling-based live data, Cisco-style design, and reusable widgets.
 *
 * Card Categories (17 total):
 * - Health & Status: NetworkHealthCard, DeviceStatusCard, ComplianceCard, SiteHealthCard, IntegrationHealthCard
 * - Topology & Architecture: TopologyMapCard, VLANDiagramCard, PathTraceCard
 * - Traffic & Performance: BandwidthCard, PerformanceCard, TrafficFlowCard, WirelessOverviewCard
 * - Events & Alerts: AlertTimelineCard, MerakiEventCard, SecurityEventsCard
 * - Clients & Analytics: ClientDistributionCard, CostTrackingCard
 */

// Core widgets (base building blocks)
export * from './widgets';

// Enterprise cards - explicit exports to avoid naming conflicts
export {
  // Health & Status
  NetworkHealthCard,
  DeviceStatusCard,
  ComplianceCard,
  SiteHealthCard,
  IntegrationHealthCard,
  // Topology & Architecture
  TopologyMapCard,
  VLANDiagramCard,
  PathTraceCard,
  // Traffic & Performance
  BandwidthCard,
  PerformanceCard,
  TrafficFlowCard,
  WirelessOverviewCard,
  // Events & Alerts
  AlertTimelineCard,
  MerakiEventCard,
  SecurityEventsCard,
  // Clients & Analytics
  ClientDistributionCard,
  CostTrackingCard,
} from './enterprise';

// Enterprise card props types
export type {
  // Health & Status types
  NetworkHealthCardProps,
  NetworkHealthData,
  DeviceStatusCardProps,
  DeviceStatusData,
  DeviceData,
  ComplianceCardProps,
  ComplianceData,
  ComplianceCategory,
  NonCompliantItem,
  SiteHealthCardProps,
  SiteHealthData,
  Site,
  IntegrationHealthCardProps,
  IntegrationHealthData,
  Integration,
  // Topology & Architecture types
  TopologyMapCardProps,
  TopologyData,
  VLANDiagramCardProps,
  VLANDiagramData,
  VLANInfo,
  PortInfo,
  PathTraceCardProps,
  PathTraceData,
  PathHop,
  // Traffic & Performance types
  BandwidthCardProps,
  BandwidthData,
  InterfaceData,
  TopTalker,
  PerformanceCardProps,
  PerformanceData,
  PerformanceGauge,
  PerformanceTarget,
  TrafficFlowCardProps,
  TrafficFlowData,
  FlowNode,
  FlowLink,
  TopFlow,
  WirelessOverviewCardProps,
  WirelessOverviewData,
  AccessPoint,
  SSID,
  ChannelInfo,
  // Events & Alerts types
  AlertTimelineCardProps,
  AlertTimelineData,
  TimelineEvent,
  MerakiEventCardProps,
  MerakiEventData,
  MerakiEvent,
  EventType,
  SecurityEventsCardProps,
  SecurityEventsData,
  SecurityEvent,
  ThreatType,
  // Clients & Analytics types
  ClientDistributionCardProps,
  ClientDistributionData,
  DistributionItem,
  ClientInfo,
  CostTrackingCardProps,
  CostTrackingData,
  ModelCost,
  DailyCost,
  TopOperation,
  BudgetInfo,
} from './enterprise';

// Enterprise-specific topology types (more detailed than widget types)
export type {
  TopologyNode as EnterpriseTopologyNode,
  TopologyEdge as EnterpriseTopologyEdge,
} from './enterprise/TopologyMapCard';

// Hooks
export { usePollingCard } from './hooks/usePollingCard';
export type { UsePollingCardOptions, UsePollingCardResult } from './hooks/usePollingCard';

// Re-export commonly used types for convenience
export type { StatusLevel } from './widgets/StatusIndicator';

// Composite Card for grouping related cards
export { CompositeCard, CompositeFromTemplate } from './CompositeCard';
export type { CompositeCardProps, CompositeFromTemplateProps } from './CompositeCard';
