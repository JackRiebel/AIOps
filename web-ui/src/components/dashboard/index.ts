// Dashboard Components
export { DashboardLayout } from './DashboardLayout';
export type { DashboardLayoutProps } from './DashboardLayout';

export { DashboardCard } from './DashboardCard';
export type { DashboardCardProps, CardAccent } from './DashboardCard';

export { TopStatsBar } from './TopStatsBar';
export type { TopStatsBarProps, StatItem } from './TopStatsBar';

export { UnifiedHealthWidget } from './UnifiedHealthWidget';
export type { UnifiedHealthWidgetProps, IntegrationHealth } from './UnifiedHealthWidget';

export { CriticalIncidentsWidget } from './CriticalIncidentsWidget';
export type { CriticalIncidentsWidgetProps, Incident } from './CriticalIncidentsWidget';

export { WidgetGrid } from './WidgetGrid';
export type { WidgetGridProps, WidgetConfig } from './WidgetGrid';

export { MiniTopologyWidget } from './MiniTopologyWidget';
export type { MiniTopologyWidgetProps, DeviceSummary, NetworkSummary } from './MiniTopologyWidget';

export { AgentPerformanceWidget } from './AgentPerformanceWidget';
export type { AgentPerformanceWidgetProps } from './AgentPerformanceWidget';

export { ActiveAutomationsWidget } from './ActiveAutomationsWidget';
export type { ActiveAutomationsWidgetProps, AutomationItem } from './ActiveAutomationsWidget';

export { RecentActivityWidget } from './RecentActivityWidget';
export type { RecentActivityWidgetProps, ActivityItem } from './RecentActivityWidget';

// Data indicators
export { DataFreshnessIndicator } from './DataFreshnessIndicator';
export type { default as DataFreshnessIndicatorProps } from './DataFreshnessIndicator';

export { DashboardSkeleton, StatsBarSkeleton, WidgetSkeleton, ChartSkeleton } from './DashboardSkeleton';

// Predictive Intelligence Widgets
export { HealthVelocityWidget } from './HealthVelocityWidget';
export type { HealthVelocityWidgetProps, VelocityDataPoint } from './HealthVelocityWidget';

// Keep existing exports
export { TopNavbar } from './TopNavbar';
export type { TopNavbarProps } from './TopNavbar';
