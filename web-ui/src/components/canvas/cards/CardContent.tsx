'use client';

import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import type { CanvasCard, CanvasCardType, ActionCardConfig, ActionType } from '@/types/session';
import { StatusIndicator } from '@/components/common/StatusIndicator';
import { ProgressBar } from '@/components/common/ProgressBar';
import { DeviceTypeIcon } from '@/components/common/DeviceTypeIcon';
import { useDemoMode } from '@/contexts/DemoModeContext';

// Infrastructure monitoring cards (Phase 4)
import { BandwidthCard } from './infrastructure/BandwidthCard';
import { InterfaceStatusCard } from './infrastructure/InterfaceStatusCard';
import { LatencyCard } from './infrastructure/LatencyCard';
import { NetworkHealthCard } from './infrastructure/NetworkHealthCard';
import { PacketLossCard } from './infrastructure/PacketLossCard';
import { ResourceHealthCard } from './infrastructure/ResourceHealthCard';
import { UptimeCard } from './infrastructure/UptimeCard';
import { SLACard } from './infrastructure/SLACard';
import { WANFailoverCard } from './infrastructure/WANFailoverCard';

// Traffic & Performance Analytics cards (Phase 5)
import { TopTalkersCard } from './traffic/TopTalkersCard';
import { TrafficCompositionCard } from './traffic/TrafficCompositionCard';
import { ApplicationUsageCard } from './traffic/ApplicationUsageCard';
import { QoSCard } from './traffic/QoSCard';
import { TrafficHeatmapCard } from './traffic/TrafficHeatmapCard';
import { ClientTimelineCard } from './traffic/ClientTimelineCard';
import { ThroughputComparisonCard } from './traffic/ThroughputComparisonCard';

// Security & Compliance cards (Phase 6)
import { SecurityEventsCard } from './security/SecurityEventsCard';
import { ThreatMapCard } from './security/ThreatMapCard';
import { FirewallHitsCard } from './security/FirewallHitsCard';
import { BlockedConnectionsCard } from './security/BlockedConnectionsCard';
import { IntrusionDetectionCard } from './security/IntrusionDetectionCard';
import { ComplianceScoreCard } from './security/ComplianceScoreCard';

// Wireless Deep Dive cards (Phase 7)
import { ChannelHeatmapCard } from './wireless/ChannelHeatmapCard';
import { SignalStrengthCard } from './wireless/SignalStrengthCard';
import { SSIDBreakdownCard } from './wireless/SSIDBreakdownCard';
import { RoamingEventsCard } from './wireless/RoamingEventsCard';
import { InterferenceCard } from './wireless/InterferenceCard';

// Switch & Infrastructure cards (Phase 8)
import { PortHeatmapCard } from './switching/PortHeatmapCard';
import { TopologyCard } from './topology/TopologyCard';
import { VLANDistributionCard } from './switching/VLANDistributionCard';
import { PoEBudgetCard } from './switching/PoEBudgetCard';
import { SpanningTreeCard } from './switching/SpanningTreeCard';
import { StackStatusCard } from './switching/StackStatusCard';

// Alerts & Incidents cards (Phase 9)
import { AlertTimelineCard } from './incidents/AlertTimelineCard';
import { IncidentTrackerCard } from './incidents/IncidentTrackerCard';
import { AlertCorrelationCard } from './incidents/AlertCorrelationCard';
import { MTTRCard } from './incidents/MTTRCard';

// Splunk & Log Integration cards (Phase 10)
import { LogVolumeCard } from './splunk/LogVolumeCard';
import { ErrorDistributionCard } from './splunk/ErrorDistributionCard';
import { EventCorrelationCard } from './splunk/EventCorrelationCard';
import { LogSeverityCard } from './splunk/LogSeverityCard';
import { SplunkSearchResultsCard } from './splunk/SplunkSearchResultsCard';

// Knowledge Base cards (Phase 11)
import { KnowledgeSourcesCard } from './knowledge/KnowledgeSourcesCard';
import { DatasheetComparisonCard } from './knowledge/DatasheetComparisonCard';
import { KnowledgeDetailCard } from './knowledge/KnowledgeDetailCard';
import { ProductDetailCard } from './knowledge/ProductDetailCard';

// AI Contextual cards (Phase 12) - Display data provided by AI
import { AIMetricCard } from './ai/AIMetricCard';
import { AIStatsGridCard } from './ai/AIStatsGridCard';
import { AIGaugeCard } from './ai/AIGaugeCard';
import { AIBreakdownCard } from './ai/AIBreakdownCard';
import { AIFindingCard } from './ai/AIFindingCard';
import { AIDeviceSummaryCard } from './ai/AIDeviceSummaryCard';

// AI-powered cards
import { DeviceChatCard } from '@/components/cards/ai/DeviceChatCard';

// Client cards (Phase 13 - extracted for modularity)
import { ClientDistributionCard } from './clients';

// Core card components and utilities (extracted for modularity)
import {
  EmptyState,
  MetricsCard,
  TableCard,
  MAX_DISPLAY_ROWS,
  isMerakiNetworkId,
  formatCellValue,
  formatMetricValue,
  formatTime,
  computeArrayMetrics,
  extractStatus,
  executeQuickAction,
  getActionsForDevice,
} from './core';

/**
 * Extract networkId from data in various formats
 * Handles: direct object, array, items wrapper, network wrapper
 */
function extractNetworkId(data: unknown, config?: Record<string, unknown>): string | undefined {
  // First check config (highest priority)
  if (config?.networkId && typeof config.networkId === 'string') {
    return config.networkId;
  }

  if (!data || typeof data !== 'object') return undefined;

  const obj = data as Record<string, unknown>;

  // Direct id with Meraki pattern
  if (isMerakiNetworkId(obj.id)) return obj.id;

  // Explicit networkId fields
  if (typeof obj.networkId === 'string') return obj.networkId;
  if (typeof obj.network_id === 'string') return obj.network_id;

  // Nested in network object
  if (obj.network && typeof obj.network === 'object') {
    const network = obj.network as Record<string, unknown>;
    if (isMerakiNetworkId(network.id)) return network.id;
  }

  // Check items array (wrapped data from CardableSuggestions)
  if (Array.isArray(obj.items) && obj.items.length > 0) {
    const first = obj.items[0] as Record<string, unknown>;
    if (isMerakiNetworkId(first?.id)) return first.id;
    if (typeof first?.networkId === 'string') return first.networkId;
  }

  // From array directly
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    if (isMerakiNetworkId(first?.id)) return first.id;
    if (typeof first?.networkId === 'string') return first.networkId;
  }

  return undefined;
}

/**
 * CardContent - Renders visualization content based on card type
 *
 * Following "Show, Don't Tell" philosophy:
 * - Auto-detects best visualization from data
 * - No configuration needed
 * - Clean, minimal design with status indicators
 */

// ============================================================================
// Types
// ============================================================================

export interface CardContentProps {
  card: CanvasCard;
  className?: string;
}

// NOTE: TableCard, MetricsCard, EmptyState, and helper functions are now imported from ./core
// This reduces file size and improves modularity
// OLD INLINE DEFINITIONS REMOVED - Using imports from ./core instead

// ============================================================================
// DEPRECATED: OLD TableCard_memo REMOVED - Now using TableCard from ./core
// ============================================================================

/* eslint-disable @typescript-eslint/no-unused-vars */
const _TableCard_WAS_HERE = null; // Placeholder - see ./core/TableCard.tsx for implementation
/* eslint-enable @typescript-eslint/no-unused-vars */

// NOTE: Old TableCard implementation removed - now using TableCard from ./core

// NOTE: Old MetricsCard implementation removed - now using MetricsCard from ./core
// NOTE: ClientDistributionCard extracted to ./clients/ClientDistributionCard.tsx

// ============================================================================
// Chart Card (for performance-chart, timeseries)
// ============================================================================

const ChartCard = memo(({ data, config }: { data: any[]; config?: Record<string, any> }) => {
  const chartData = useMemo(() => {
    // Validate data is a non-empty array with valid first element
    if (!Array.isArray(data) || data.length === 0 || !data[0] || typeof data[0] !== 'object') return [];

    const keys = Object.keys(data[0]);
    const numericKey = keys.find(k => typeof data[0][k] === 'number');
    const labelKey = keys.find(k => typeof data[0][k] === 'string' && k !== numericKey);
    if (!numericKey) return [];

    return data.map(d => ({
      value: d[numericKey] as number,
      label: labelKey ? d[labelKey] : '',
    }));
  }, [data]);

  if (chartData.length === 0) {
    return <EmptyState message="No numeric data" />;
  }

  const values = chartData.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Stats header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600" />
            <span className="text-slate-500 dark:text-slate-400">Total:</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{formatMetricValue(total)}</span>
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-slate-500 dark:text-slate-400">
            Avg: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatMetricValue(avg)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="text-slate-400 dark:text-slate-500">Max:</span> {formatMetricValue(max)}
          </span>
          <span className="text-red-500 dark:text-red-400 font-medium">
            <span className="text-slate-400 dark:text-slate-500">Min:</span> {formatMetricValue(min)}
          </span>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 flex items-end gap-0.5 p-3 pb-4">
        {chartData.map((d, i) => {
          const height = ((d.value - min) / range) * 100;
          const isHighest = d.value === max;
          const isLowest = d.value === min;

          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative min-w-[8px]">
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-all duration-150
                              pointer-events-none z-20 transform group-hover:translate-y-0 translate-y-1">
                <div className="px-2 py-1.5 rounded-lg shadow-lg text-[10px] font-medium whitespace-nowrap
                                bg-slate-800 dark:bg-slate-900 text-white border border-slate-700">
                  {d.label && <div className="text-slate-400 mb-0.5">{d.label}</div>}
                  <div className="text-cyan-400 font-bold">{formatMetricValue(d.value)}</div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-slate-800 dark:bg-slate-900 border-r border-b border-slate-700" />
              </div>

              {/* Bar */}
              <div
                className={`
                  w-full rounded-t-md transition-all duration-300 ease-out
                  ${isHighest ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' :
                    isLowest ? 'bg-gradient-to-t from-red-500 to-red-400' :
                      'bg-gradient-to-t from-cyan-600 to-cyan-400'}
                  group-hover:shadow-lg group-hover:scale-x-110
                  ${isHighest ? 'group-hover:shadow-emerald-500/30' :
                    isLowest ? 'group-hover:shadow-red-500/30' :
                      'group-hover:shadow-cyan-500/30'}
                `}
                style={{ height: `${Math.max(height, 8)}%` }}
              />

              {/* Label below (if few items) */}
              {chartData.length <= 12 && d.label && (
                <div className="mt-1 text-[8px] text-slate-400 dark:text-slate-500 truncate max-w-full transform -rotate-45 origin-left">
                  {d.label.slice(0, 8)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

ChartCard.displayName = 'ChartCard';

// ============================================================================
// Topology Card (for network topology, hierarchies)
// ============================================================================

interface TopologyNode {
  id: string | number;
  label: string;
  type: string;
  status: string;
}

// Helper to extract and normalize status - uses the imported extractStatus from ./core
// This local version is kept for the specific status normalization used by AlertSummaryCard
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _extractStatusNormalized(item: Record<string, unknown>): string {
  // Try various common status field names
  const statusValue = item.status || item.deviceStatus || item.state || item.health;
  if (!statusValue) return 'unknown';

  // Normalize status string
  const normalized = String(statusValue).toLowerCase().trim();

  // Map common variations
  if (['online', 'active', 'up', 'healthy', 'connected'].includes(normalized)) return 'online';
  if (['offline', 'inactive', 'down', 'disconnected'].includes(normalized)) return 'offline';
  if (['alerting', 'warning', 'degraded'].includes(normalized)) return 'alerting';
  if (['dormant', 'standby', 'idle'].includes(normalized)) return 'dormant';

  return normalized || 'unknown';
}



// ============================================================================
// Alert Summary Card
// ============================================================================

// Helper for relative time formatting
function formatRelativeTime(time: string): string {
  try {
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  } catch {
    return time;
  }
}

// Severity icon component
function SeverityIcon({ severity }: { severity: string }) {
  const s = severity.toLowerCase();

  if (s === 'critical' || s === 'error') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    );
  }
  if (s === 'warning') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (s === 'success') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  // Info default
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

interface ProcessedAlert {
  id: string | number;
  message: string;
  description?: string;
  severity: string;
  time?: string;
  deviceName: string;
  networkName: string;
  category?: string;
}

const AlertCard = memo(({ data }: { data: any }) => {
  const { demoMode } = useDemoMode();

  const alerts: ProcessedAlert[] = useMemo(() => {
    // Handle wrapped data: { items: [...] }, { alerts: [...] }, or direct array
    let alertData = data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Try common wrapper properties
      alertData = data.items || data.alerts || data.data || data.results || data.events || [];
    }

    if (!Array.isArray(alertData)) alertData = [];

    // Generate demo data if demo mode is on and no real data
    if (alertData.length === 0 && demoMode) {
      const now = new Date();
      alertData = [
        { id: 'demo-1', title: 'High latency detected on WAN link', severity: 'warning', timestamp: new Date(now.getTime() - 5 * 60000).toISOString(), category: 'connectivity', deviceName: 'MX-Firewall' },
        { id: 'demo-2', title: 'AP-Office-2 went offline', severity: 'critical', timestamp: new Date(now.getTime() - 15 * 60000).toISOString(), category: 'wireless', deviceName: 'AP-Office-2' },
        { id: 'demo-3', title: 'New client connected', severity: 'info', timestamp: new Date(now.getTime() - 30 * 60000).toISOString(), category: 'client' },
        { id: 'demo-4', title: 'Switch port error rate increased', severity: 'warning', timestamp: new Date(now.getTime() - 45 * 60000).toISOString(), category: 'switching', deviceName: 'Core-Switch-1' },
        { id: 'demo-5', title: 'VPN tunnel established', severity: 'info', timestamp: new Date(now.getTime() - 60 * 60000).toISOString(), category: 'security' },
        { id: 'demo-6', title: 'DHCP lease pool 80% utilized', severity: 'warning', timestamp: new Date(now.getTime() - 90 * 60000).toISOString(), category: 'dhcp' },
        { id: 'demo-7', title: 'Firmware update available', severity: 'info', timestamp: new Date(now.getTime() - 120 * 60000).toISOString(), category: 'system', deviceName: 'MS-Access-1' },
      ];
    }

    if (alertData.length === 0) return [];

    return alertData.slice(0, 15).map((item: any, i: number) => {
      // Extract meaningful message from various alert formats
      let message = '';

      // Try direct message fields first
      if (item.message) {
        message = item.message;
      } else if (item.description) {
        message = item.description;
      } else if (item.title) {
        message = item.title;
      } else if (item.alertTypeId || item.type) {
        // Convert snake_case/camelCase type to readable text
        const typeStr = item.alertTypeId || item.type;
        message = typeStr
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
      } else if (item.eventType) {
        message = item.eventType
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase());
      }

      // Add device/scope context if available
      const deviceName = item.scope?.devices?.[0]?.name || item.deviceName || item.deviceSerial || '';
      const networkName = item.scope?.network?.name || item.networkName || '';

      // Build a complete message
      if (!message && deviceName) {
        message = `Alert on ${deviceName}`;
      }
      if (!message) {
        // Last resort: try to find any string field
        const stringFields = Object.entries(item).filter(([k, v]) =>
          typeof v === 'string' && v.length > 5 && v.length < 200 &&
          !k.toLowerCase().includes('id') && !k.toLowerCase().includes('url')
        );
        if (stringFields.length > 0) {
          message = stringFields[0][1] as string;
        }
      }

      // Final fallback
      if (!message) message = 'Alert';

      // Determine severity
      let severity = (item.severity || item.level || item.priority || 'info').toLowerCase();
      // Map common Meraki severity values
      if (severity === 'critical' || severity === 'high') severity = 'critical';
      else if (severity === 'warning' || severity === 'medium') severity = 'warning';
      else if (severity === 'informational' || severity === 'low') severity = 'info';

      return {
        id: item.id || item.alertId || item.alertConfigId || i,
        message,
        description: item.description !== message ? item.description : undefined,
        severity,
        time: item.timestamp || item.time || item.created_at || item.occurredAt || item.startedAt || item.sentAt,
        deviceName,
        networkName,
        category: item.category || item.alertType,
      };
    });
  }, [data, demoMode]);

  if (alerts.length === 0) {
    return <EmptyState message="No alerts" />;
  }

  const severityStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    critical: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', icon: 'text-red-500' },
    error: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', icon: 'text-red-500' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-500' },
    info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-500' },
    success: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', icon: 'text-emerald-500' },
  };

  // Count by severity
  const criticalCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'error').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="h-full flex flex-col">
      {/* Header with summary */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Alerts
        </span>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              {warningCount} warning
            </span>
          )}
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {alerts.length} total
          </span>
        </div>
      </div>

      {/* Alerts list */}
      <div className="flex-1 overflow-auto">
        <div className="space-y-2 p-2">
          {alerts.map((alert) => {
            const styles = severityStyles[alert.severity] || severityStyles.info;
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${styles.bg} ${styles.border}
                            hover:shadow-md transition-shadow cursor-pointer`}
              >
                {/* Icon */}
                <span className={`flex-shrink-0 p-1.5 rounded-lg ${styles.bg} ${styles.icon}`}>
                  <SeverityIcon severity={alert.severity} />
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Category badge */}
                  {alert.category && (
                    <span className="inline-block px-1.5 py-0.5 text-[8px] font-medium uppercase rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 mb-1">
                      {alert.category}
                    </span>
                  )}
                  {/* Main message */}
                  <div className={`text-xs font-medium ${styles.text} leading-tight`}>
                    {alert.message}
                  </div>
                  {/* Description if different */}
                  {alert.description && (
                    <div className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2">
                      {alert.description}
                    </div>
                  )}
                  {/* Metadata row */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400">
                    {alert.time && (
                      <span className="flex items-center gap-0.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatRelativeTime(alert.time)}
                      </span>
                    )}
                    {alert.deviceName && (
                      <span className="flex items-center gap-0.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                        {alert.deviceName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

AlertCard.displayName = 'AlertCard';

// ============================================================================
// Custom/Fallback Card
// ============================================================================

// Simple JSON syntax highlighter
function highlightJSON(json: string): React.ReactNode {
  // Split into tokens and colorize
  const parts: React.ReactNode[] = [];
  let i = 0;
  const regex = /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+\.?\d*)|(\btrue\b|\bfalse\b)|(\bnull\b)|([{}\[\],:])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(json)) !== null) {
    // Add any non-matched text
    if (match.index > lastIndex) {
      parts.push(<span key={i++}>{json.slice(lastIndex, match.index)}</span>);
    }

    if (match[1]) {
      // Key (property name)
      parts.push(<span key={i++} className="text-purple-600 dark:text-purple-400">{match[1]}</span>);
      parts.push(<span key={i++} className="text-slate-400">:</span>);
    } else if (match[2]) {
      // String value
      parts.push(<span key={i++} className="text-emerald-600 dark:text-emerald-400">{match[2]}</span>);
    } else if (match[3]) {
      // Number
      parts.push(<span key={i++} className="text-cyan-600 dark:text-cyan-400">{match[3]}</span>);
    } else if (match[4]) {
      // Boolean
      parts.push(<span key={i++} className="text-amber-600 dark:text-amber-400">{match[4]}</span>);
    } else if (match[5]) {
      // Null
      parts.push(<span key={i++} className="text-red-500 dark:text-red-400">{match[5]}</span>);
    } else if (match[6]) {
      // Brackets and punctuation
      parts.push(<span key={i++} className="text-slate-500 dark:text-slate-400">{match[6]}</span>);
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < json.length) {
    parts.push(<span key={i++}>{json.slice(lastIndex)}</span>);
  }

  return parts;
}

const CustomCard = memo(({ data }: { data: any }) => {
  const [copied, setCopied] = useState(false);

  const content = useMemo(() => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  }, [data]);

  const isJSON = typeof data === 'object' && data !== null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {isJSON ? 'JSON Data' : 'Raw Data'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded
                     bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                     hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3 bg-slate-900 dark:bg-slate-950">
        <pre className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed">
          {isJSON ? highlightJSON(content) : (
            <span className="text-slate-300">{content}</span>
          )}
        </pre>
      </div>
    </div>
  );
});

CustomCard.displayName = 'CustomCard';

// NOTE: Old EmptyState implementation removed - now using EmptyState from ./core

// NOTE: Old helper functions removed - now using imports from ./core

// ============================================================================
// Action Card (Interactive actions: ping, traceroute, etc.)
// ============================================================================

// Get icon for action type
function getActionIcon(actionType: ActionType): React.ReactNode {
  switch (actionType) {
    case 'ping':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      );
    case 'traceroute':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      );
    case 'cable-test':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'blink-led':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'reboot':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

// Get action label
function getActionLabel(actionType: ActionType): string {
  const labels: Record<ActionType, string> = {
    'ping': 'Ping',
    'traceroute': 'Traceroute',
    'cable-test': 'Cable Test',
    'blink-led': 'Blink LED',
    'reboot': 'Reboot',
    'wake-on-lan': 'Wake on LAN',
    'cycle-port': 'Cycle Port',
  };
  return labels[actionType] || actionType;
}

// Get action color scheme
function getActionColor(actionType: ActionType): { bg: string; hover: string; text: string } {
  switch (actionType) {
    case 'reboot':
      return { bg: 'bg-red-500', hover: 'hover:bg-red-600', text: 'text-white' };
    case 'blink-led':
      return { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', text: 'text-white' };
    default:
      return { bg: 'bg-cyan-500', hover: 'hover:bg-cyan-600', text: 'text-white' };
  }
}

const ActionCard = memo(({ data, config }: { data: any; config?: Record<string, any> }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState('8.8.8.8');

  // Extract action config from card config or data
  const actionConfig: ActionCardConfig = config?.actionConfig || data?.actionConfig || {
    actionType: data?.actionType || 'ping',
    targetDevice: data?.targetDevice || data?.device,
    parameters: data?.parameters || {},
  };

  const actionType = actionConfig.actionType;
  const device = actionConfig.targetDevice;
  const colors = getActionColor(actionType);

  const handleRun = async () => {
    if (!device?.serial) {
      setError('No device serial available');
      return;
    }

    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/actions/${actionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          serial: device.serial,
          target: target,
          count: actionConfig.parameters?.count || 5,
          ...actionConfig.parameters,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Action failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute action');
    } finally {
      setIsRunning(false);
    }
  };

  // Render result based on action type
  const renderResult = () => {
    if (!result) return null;

    if (actionType === 'ping') {
      const pingResult = result.data || result;
      return (
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Sent:</span>
              <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">{pingResult.sent || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500">Received:</span>
              <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">{pingResult.received || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500">Loss:</span>
              <span className={`ml-2 font-medium ${(pingResult.loss || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {pingResult.loss || 0}%
              </span>
            </div>
            <div>
              <span className="text-slate-500">Avg RTT:</span>
              <span className="ml-2 font-medium text-cyan-600 dark:text-cyan-400">{pingResult.averageLatency || '-'}ms</span>
            </div>
          </div>
          {pingResult.replies && (
            <div className="mt-2 text-[10px] text-slate-400 font-mono">
              {pingResult.replies.slice(0, 5).map((r: any, i: number) => (
                <div key={i}>seq={r.sequenceId} time={r.latency}ms</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Traceroute visualization
    if (actionType === 'traceroute') {
      const traceResult = result.data || result;
      const hops = traceResult.hops || [];

      // Check if this is a ping fallback (no hops data)
      const isPingFallback = hops.length === 0 && (traceResult.sent || traceResult.received || traceResult.replies);

      if (isPingFallback) {
        // Show ping results with traceroute-style visualization
        const pingReplies = traceResult.replies || [];
        const avgLatency = traceResult.averageLatency || (pingReplies.length > 0
          ? pingReplies.reduce((sum: number, r: any) => sum + (r.latency || 0), 0) / pingReplies.length
          : 0);

        return (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            {/* Note about ping fallback */}
            <div className="mb-3 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[10px] text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> Traceroute via API not available for this device. Showing ping results.
            </div>

            {/* Visual path (simplified) */}
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500 to-emerald-500" />

              {/* Source */}
              <div className="relative flex items-center gap-3 mb-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center z-10">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{device?.name || 'Source'}</span>
              </div>

              {/* Destination */}
              <div className="relative flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full ${traceResult.loss === 0 ? 'bg-emerald-500' : 'bg-red-500'} flex items-center justify-center z-10`}>
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={traceResult.loss === 0 ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{target}</span>
                  <span className="text-xs text-slate-400 ml-2">{avgLatency.toFixed(1)}ms avg</span>
                </div>
              </div>
            </div>

            {/* Ping stats */}
            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-slate-400">Sent</div>
                <div className="font-semibold text-slate-700 dark:text-slate-200">{traceResult.sent || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-400">Received</div>
                <div className="font-semibold text-emerald-600">{traceResult.received || 0}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-400">Loss</div>
                <div className={`font-semibold ${(traceResult.loss || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {traceResult.loss || 0}%
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Get latency color based on value
      const getLatencyColor = (latency: number | null) => {
        if (latency === null || latency === undefined) return 'bg-slate-400';
        if (latency < 20) return 'bg-emerald-500';
        if (latency < 50) return 'bg-yellow-500';
        if (latency < 100) return 'bg-orange-500';
        return 'bg-red-500';
      };

      const getLatencyTextColor = (latency: number | null) => {
        if (latency === null || latency === undefined) return 'text-slate-400';
        if (latency < 20) return 'text-emerald-600 dark:text-emerald-400';
        if (latency < 50) return 'text-yellow-600 dark:text-yellow-400';
        if (latency < 100) return 'text-orange-600 dark:text-orange-400';
        return 'text-red-600 dark:text-red-400';
      };

      return (
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
          {/* Header with summary */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {hops.length} hops to destination
            </span>
            {hops.length > 0 && (
              <span className="text-xs text-slate-500">
                Total: {hops.reduce((sum: number, h: any) => sum + (h.latency || 0), 0).toFixed(1)}ms
              </span>
            )}
          </div>

          {/* Visual path */}
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500 via-slate-300 to-emerald-500 dark:via-slate-600" />

            {/* Source */}
            <div className="relative flex items-center gap-3 mb-2">
              <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center z-10">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">{device?.name || 'Source'}</span>
                <span className="text-slate-400 ml-2">{device?.ip || ''}</span>
              </div>
            </div>

            {/* Hops */}
            {hops.map((hop: any, idx: number) => (
              <div key={idx} className="relative flex items-center gap-3 mb-2">
                <div className={`w-6 h-6 rounded-full ${getLatencyColor(hop.latency)} flex items-center justify-center z-10 text-white text-[10px] font-bold`}>
                  {idx + 1}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {hop.ip || hop.host || '*'}
                    </span>
                    {hop.host && hop.host !== hop.ip && (
                      <span className="text-slate-400 ml-1 text-[10px]">({hop.ip})</span>
                    )}
                  </div>
                  <span className={`text-xs font-mono font-medium ${getLatencyTextColor(hop.latency)}`}>
                    {hop.latency !== null && hop.latency !== undefined ? `${hop.latency}ms` : '*'}
                  </span>
                </div>
              </div>
            ))}

            {/* Destination */}
            <div className="relative flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center z-10">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-xs">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{target || 'Destination'}</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;20ms</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> &lt;50ms</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> &lt;100ms</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> 100ms+</span>
          </div>
        </div>
      );
    }

    // Default JSON result
    return (
      <div className="mt-3 p-3 bg-slate-900 rounded-lg overflow-auto max-h-32">
        <pre className="text-[10px] font-mono text-slate-300">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="text-cyan-500 dark:text-cyan-400">
            {getActionIcon(actionType)}
          </span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {getActionLabel(actionType)}
          </span>
        </div>
        {device && (
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {device.name || device.model || device.serial}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-3 overflow-auto">
        {/* Device Info */}
        {device && (
          <div className="mb-3 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-2">
              <DeviceTypeIcon type={device.model || 'device'} className="w-5 h-5 text-slate-500" />
              <div>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{device.name}</div>
                <div className="text-[10px] text-slate-500">{device.serial}</div>
              </div>
            </div>
          </div>
        )}

        {/* Target input (for ping/traceroute) */}
        {(actionType === 'ping' || actionType === 'traceroute') && (
          <div className="mb-3">
            <label className="block text-[10px] font-medium text-slate-500 mb-1">Target IP/Hostname</label>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200
                         focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="8.8.8.8"
            />
          </div>
        )}

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={isRunning || !device?.serial}
          className={`w-full py-2 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2
                      transition-all duration-200 ${colors.bg} ${colors.hover} ${colors.text}
                      disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isRunning ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running...
            </>
          ) : (
            <>
              {getActionIcon(actionType)}
              Run {getActionLabel(actionType)}
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Result */}
        {renderResult()}
      </div>
    </div>
  );
});

ActionCard.displayName = 'ActionCard';

// ============================================================================
// RF Analysis Card (Wireless AP utilization)
// ============================================================================

const RFAnalysisCard = memo(({ data, config }: { data: any; config?: Record<string, any> }) => {
  const [rfData, setRfData] = useState<any>(data);
  const [loading, setLoading] = useState(data?.needsEnrichment === true);
  const [error, setError] = useState<string | null>(null);

  // Extract networkId using robust fallback
  const networkId = extractNetworkId(data, config);

  // Debug logging
  useEffect(() => {
    console.log('[RFAnalysisCard] Config received:', {
      configNetworkId: config?.networkId,
      extractedNetworkId: networkId,
      needsEnrichment: data?.needsEnrichment,
      hasData: !!data,
      configKeys: config ? Object.keys(config) : [],
    });
  }, [config, data, networkId]);

  // Fetch real RF data if needed
  useEffect(() => {
    if (data?.needsEnrichment) {
      if (!networkId) {
        console.error('[RFAnalysisCard] Cannot fetch RF data - networkId is missing from all sources');
        setError('Network context not available. Try asking about a specific network.');
        setLoading(false);
        return;
      }
      setLoading(true);
      console.log('[RFAnalysisCard] Fetching RF data for network:', networkId);
      fetch(`/api/network/${networkId}/rf-analysis`, {
        credentials: 'include',
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch RF data');
          const result = await res.json();
          setRfData(result);
        })
        .catch((err) => {
          console.error('[RFAnalysisCard] Fetch error:', err);
          setError(err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [data?.needsEnrichment, networkId]);

  // Show loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-500 dark:text-slate-400">Loading RF data...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return <EmptyState message={`Error: ${error}`} />;
  }

  const accessPoints = rfData?.accessPoints || [];
  const recommendations = rfData?.recommendations || [];
  const networkName = rfData?.networkName;

  if (accessPoints.length === 0) {
    return <EmptyState message="No RF data available" />;
  }

  // Get utilization color
  const getUtilizationColor = (util: number) => {
    if (util < 50) return 'bg-emerald-500';
    if (util < 75) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Get band color
  const getBandColor = (band: string) => {
    if (band.includes('6')) return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
    if (band.includes('5')) return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
    return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            RF Analysis {networkName && `- ${networkName}`}
          </span>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
          {accessPoints.length} APs
        </span>
      </div>

      {/* AP Utilization Bars */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {accessPoints.map((ap: any, i: number) => (
          <div key={ap.serial || i} className="space-y-1">
            {/* AP Name and Band */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                  {ap.name || ap.serial}
                </span>
                <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${getBandColor(ap.band)}`}>
                  {ap.band}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                <span>Ch {ap.channel}</span>
                <span>{ap.power} dBm</span>
                <span>{ap.clients} clients</span>
              </div>
            </div>

            {/* Utilization Bar */}
            <div className="relative h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 ${getUtilizationColor(ap.utilization)} transition-all duration-300`}
                style={{ width: `${Math.min(ap.utilization, 100)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-end pr-2">
                <span className="text-[10px] font-bold text-slate-700 dark:text-white drop-shadow">
                  {ap.utilization}%
                </span>
              </div>
            </div>

            {/* Interference indicator */}
            {ap.interference > 30 && (
              <div className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {ap.interference}% interference
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
          <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1">Recommendations</div>
          <ul className="space-y-1">
            {recommendations.slice(0, 3).map((rec: string, i: number) => (
              <li key={i} className="text-[10px] text-amber-600 dark:text-amber-300 flex items-start gap-1">
                <span>•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

RFAnalysisCard.displayName = 'RFAnalysisCard';

// ============================================================================
// Health Trend Card (Historical health scores)
// ============================================================================

const HealthTrendCard = memo(({ data, config }: { data: any; config?: Record<string, any> }) => {
  const [healthData, setHealthData] = useState<any>(data);
  const [loading, setLoading] = useState(data?.needsEnrichment === true);
  const [error, setError] = useState<string | null>(null);

  // Extract networkId using robust fallback
  const networkId = extractNetworkId(data, config);

  // Debug logging
  useEffect(() => {
    console.log('[HealthTrendCard] Config received:', {
      configNetworkId: config?.networkId,
      extractedNetworkId: networkId,
      needsEnrichment: data?.needsEnrichment,
      hasData: !!data,
      configKeys: config ? Object.keys(config) : [],
      dataKeys: data ? Object.keys(data) : [],
    });
  }, [config, data, networkId]);

  // Fetch real health data if needed
  useEffect(() => {
    if (data?.needsEnrichment) {
      if (!networkId) {
        console.error('[HealthTrendCard] Cannot fetch health data - networkId is missing from all sources');
        setError('Network context not available. Try asking about a specific network.');
        setLoading(false);
        return;
      }
      setLoading(true);
      console.log('[HealthTrendCard] Fetching health data for network:', networkId);
      fetch(`/api/network/${networkId}/health-summary`, {
        credentials: 'include',
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to fetch health data');
          const result = await res.json();
          setHealthData(result);
        })
        .catch((err) => {
          console.error('[HealthTrendCard] Fetch error:', err);
          setError(err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [data?.needsEnrichment, networkId]);

  // Show loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-500 dark:text-slate-400">Loading health data...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return <EmptyState message={`Error: ${error}`} />;
  }

  const history = healthData?.history || [];
  const current = healthData?.current;
  const thresholds = healthData?.thresholds || { warning: 80, critical: 60 };
  const networkName = healthData?.networkName;

  if (history.length === 0 && !current) {
    return <EmptyState message="No health data available" />;
  }

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= thresholds.warning) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= thresholds.critical) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= thresholds.warning) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (score >= thresholds.critical) return 'bg-amber-100 dark:bg-amber-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  // Calculate trend line points for SVG
  const maxScore = 100;
  const chartHeight = 80;
  const chartWidth = 200;
  const points = history.slice(-20).map((h: any, i: number, arr: any[]) => {
    const x = (i / Math.max(arr.length - 1, 1)) * chartWidth;
    const y = chartHeight - (h.score / maxScore) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Health Trend {networkName && `- ${networkName}`}
          </span>
        </div>
      </div>

      {/* Current Score */}
      {current && (
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Current Score</div>
              <div className={`text-3xl font-bold ${getScoreColor(current.score)}`}>
                {current.score}
                <span className="text-lg">/100</span>
              </div>
            </div>
            {current.delta !== undefined && current.delta !== 0 && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${current.delta > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                }`}>
                <svg className={`w-3 h-3 ${current.delta < 0 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-xs font-medium">{Math.abs(current.delta)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trend Chart */}
      {history.length > 1 && (
        <div className="flex-1 p-3">
          <div className="relative h-24">
            {/* Threshold lines */}
            <div
              className="absolute w-full border-t border-dashed border-amber-400"
              style={{ top: `${100 - thresholds.warning}%` }}
            />
            <div
              className="absolute w-full border-t border-dashed border-red-400"
              style={{ top: `${100 - thresholds.critical}%` }}
            />

            {/* SVG Chart */}
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              {/* Area fill */}
              <path
                d={`M 0,${chartHeight} L ${points} L ${chartWidth},${chartHeight} Z`}
                fill="url(#healthGradient)"
                opacity="0.3"
              />
              {/* Line */}
              <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-cyan-500"
              />
              {/* Gradient definition */}
              <defs>
                <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(6, 182, 212)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="rgb(6, 182, 212)" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between mt-2 text-[9px] text-slate-500 dark:text-slate-400">
            <span>{history.length > 0 ? formatTime(history[0].timestamp) : ''}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-amber-400" /> Warning ({thresholds.warning})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-red-400" /> Critical ({thresholds.critical})
              </span>
            </div>
            <span>{history.length > 0 ? formatTime(history[history.length - 1].timestamp) : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
});

HealthTrendCard.displayName = 'HealthTrendCard';

// ============================================================================
// Comparison Card (Before/After)
// ============================================================================

const ComparisonCard = memo(({ data }: { data: any }) => {
  const before = data?.before;
  const after = data?.after;
  const changes = data?.changes || [];
  const summary = data?.summary;

  if (!before && !after) {
    return <EmptyState message="No comparison data available" />;
  }

  // Count improvements/degradations
  const improvements = changes.filter((c: any) => c.improvement === true).length;
  const degradations = changes.filter((c: any) => c.improvement === false).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Comparison
          </span>
        </div>
        <div className="flex items-center gap-2">
          {improvements > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
              +{improvements} improved
            </span>
          )}
          {degradations > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              -{degradations} degraded
            </span>
          )}
        </div>
      </div>

      {/* Before/After Labels */}
      <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-700">
        <div className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/80">
          <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">BEFORE</div>
          <div className="text-[9px] text-slate-500 dark:text-slate-500">{before?.label || before?.timestamp}</div>
        </div>
        <div className="px-3 py-2 bg-cyan-50/50 dark:bg-cyan-900/20">
          <div className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-400">AFTER</div>
          <div className="text-[9px] text-slate-500 dark:text-slate-500">{after?.label || after?.timestamp}</div>
        </div>
      </div>

      {/* Changes List */}
      <div className="flex-1 overflow-auto">
        {changes.map((change: any, i: number) => (
          <div
            key={i}
            className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-700/50 text-xs"
          >
            {/* Before value */}
            <div className="px-3 py-2 border-r border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{change.field}</div>
              <div className="font-mono text-slate-700 dark:text-slate-300">
                {formatCellValue(change.oldValue)}
              </div>
            </div>
            {/* After value with change indicator */}
            <div className="px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{change.field}</div>
                <div className="font-mono text-slate-700 dark:text-slate-300">
                  {formatCellValue(change.newValue)}
                </div>
              </div>
              {change.improvement !== undefined && (
                <span className={`w-5 h-5 flex items-center justify-center rounded-full ${change.improvement
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  }`}>
                  {change.improvement ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {summary && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs text-slate-600 dark:text-slate-400">{summary}</p>
        </div>
      )}
    </div>
  );
});

ComparisonCard.displayName = 'ComparisonCard';

// ============================================================================
// Path Analysis Card (Connectivity path trace)
// ============================================================================

const PathAnalysisCard = memo(({ data }: { data: any }) => {
  const { demoMode } = useDemoMode();

  // Generate demo data when no real data and demo mode is on
  const effectiveData = useMemo(() => {
    if (demoMode && (!data?.source || !data?.destination)) {
      return {
        source: { name: 'Office Router', ip: '192.168.1.1', type: 'gateway' },
        destination: { name: 'Google DNS', ip: '8.8.8.8', type: 'external' },
        hops: [
          { order: 1, name: 'ISP Gateway', ip: '10.0.0.1', latency: 5, status: 'reachable' },
          { order: 2, name: 'Regional Core', ip: '72.14.215.1', latency: 15, status: 'reachable' },
          { order: 3, name: 'Google Edge', ip: '142.250.80.1', latency: 8, status: 'reachable', isBottleneck: false },
        ],
        overallStatus: 'healthy',
        totalLatency: 28,
        issues: [],
      };
    }
    return data;
  }, [data, demoMode]);

  const source = effectiveData?.source;
  const destination = effectiveData?.destination;
  const hops = effectiveData?.hops || [];
  const overallStatus = effectiveData?.overallStatus || 'unknown';
  const totalLatency = effectiveData?.totalLatency;
  const issues = effectiveData?.issues || [];

  if (!source || !destination) {
    return <EmptyState message="No path data available" />;
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'reachable':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30';
      case 'degraded':
        return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'failed':
      case 'unreachable':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Path Analysis
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${getStatusColor(overallStatus)}`}>
            {overallStatus}
          </span>
          {totalLatency !== undefined && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {totalLatency}ms
            </span>
          )}
        </div>
      </div>

      {/* Path Visualization */}
      <div className="flex-1 overflow-auto p-3">
        <div className="flex flex-col items-center">
          {/* Source */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <div className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{source.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{source.ip || source.type}</div>
            </div>
          </div>

          {/* Hops */}
          {hops.map((hop: any, i: number) => (
            <div key={i} className="flex flex-col items-center">
              {/* Connection line */}
              <div className={`w-0.5 h-6 ${hop.status === 'unreachable' ? 'border-l-2 border-dashed border-red-400' : 'bg-slate-300 dark:bg-slate-600'}`} />

              {/* Hop */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${hop.isBottleneck
                ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                : hop.status === 'unreachable'
                  ? 'border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50'
                  : 'border-transparent bg-slate-100 dark:bg-slate-700'
                }`}>
                <div className={`w-6 h-6 flex items-center justify-center rounded-full ${getStatusColor(hop.status)}`}>
                  <span className="text-[10px] font-bold">{hop.order}</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{hop.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {hop.ip} {hop.latency !== undefined && `• ${hop.latency}ms`}
                  </div>
                </div>
                {hop.isBottleneck && (
                  <span className="px-1.5 py-0.5 text-[9px] font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                    Bottleneck
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Destination */}
          <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <div className="w-8 h-8 flex items-center justify-center bg-emerald-200 dark:bg-emerald-800/50 rounded-full">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{destination.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">{destination.ip || destination.type}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/20">
          <div className="text-[10px] font-semibold text-red-700 dark:text-red-400 mb-1">Issues Detected</div>
          <ul className="space-y-1">
            {issues.map((issue: string, i: number) => (
              <li key={i} className="text-[10px] text-red-600 dark:text-red-300 flex items-start gap-1">
                <span>•</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

PathAnalysisCard.displayName = 'PathAnalysisCard';

// ============================================================================
// Device Detail Card (Single device with embedded actions)
// ============================================================================

interface DeviceDetailCardProps {
  data: any;
  config?: Record<string, any>;
  onAddCard?: (card: any) => void;
}

// Detect device type from model string
function getDeviceType(model: string): 'mx' | 'ms' | 'mr' | 'mv' | 'mt' | 'mg' | 'unknown' {
  const m = (model || '').toUpperCase();
  if (m.startsWith('MX') || m.startsWith('Z')) return 'mx';
  if (m.startsWith('MS')) return 'ms';
  if (m.startsWith('MR') || m.startsWith('CW')) return 'mr';
  if (m.startsWith('MV')) return 'mv';
  if (m.startsWith('MT')) return 'mt';
  if (m.startsWith('MG')) return 'mg';
  return 'unknown';
}

const DeviceDetailCard = memo(({ data, config, onAddCard }: DeviceDetailCardProps) => {
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [actionResult, setActionResult] = useState<any>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Enrichment state
  const [deviceData, setDeviceData] = useState<any>(data);
  const [loading, setLoading] = useState(data?.needsEnrichment === true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [typeSpecificData, setTypeSpecificData] = useState<any>(null);

  // Get serial from data or config
  const deviceSerial = config?.deviceSerial || data?.device?.serial || data?.serial;

  // Fetch device details when needsEnrichment is true
  useEffect(() => {
    if (data?.needsEnrichment && deviceSerial) {
      console.log('[DeviceDetailCard] Fetching device details for:', deviceSerial);
      setLoading(true);

      // Fetch device details first to determine type
      fetch(`/api/meraki/devices/${deviceSerial}`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(async (device) => {
          if (!device) {
            setFetchError('Device not found');
            setLoading(false);
            return;
          }

          const deviceType = getDeviceType(device.model);

          // Fetch status and clients in parallel
          const [status, clients] = await Promise.all([
            fetch(`/api/meraki/devices/${deviceSerial}/status`, { credentials: 'include' })
              .then(res => res.ok ? res.json() : null).catch(() => null),
            fetch(`/api/meraki/devices/${deviceSerial}/clients?timespan=86400`, { credentials: 'include' })
              .then(res => res.ok ? res.json() : []).catch(() => []),
          ]);

          // Merge device details with status
          // Note: Meraki API status can be "online", "offline", "alerting", or "dormant"
          // The device object from getDevice might not include status, so we prioritize the live status
          const liveStatus = status?.status || status?.deviceStatus;
          const deviceStatus = device?.status || device?.deviceStatus;
          const mergedDevice = {
            ...device,
            status: liveStatus || deviceStatus || 'unknown',
            lanIp: status?.lanIp || device.lanIp,
            publicIp: status?.publicIp || device.wan1Ip || device.publicIp,
            wan1Ip: status?.wan1Ip,
            wan2Ip: status?.wan2Ip,
            gateway: status?.gateway,
            primaryDns: status?.primaryDns,
          };

          // Debug logging for status issues
          if (!liveStatus && !deviceStatus) {
            console.warn(`[DeviceDetailCard] No status found for device ${deviceSerial}`, {
              statusResponse: status,
              deviceResponse: device,
            });
          }

          // Determine available actions based on device type
          const availableActions: string[] = ['ping', 'blink-led'];
          if (deviceType === 'ms') availableActions.push('cable-test', 'cycle-port');
          if (deviceType === 'mx') availableActions.push('traceroute');

          // Fetch type-specific data
          let typeData: any = null;
          try {
            if (deviceType === 'ms') {
              // Switch: fetch port statuses
              const ports = await fetch(`/api/meraki/devices/${deviceSerial}/switch/ports`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : []).catch(() => []);
              const portStatuses = await fetch(`/api/meraki/devices/${deviceSerial}/switch/ports/status`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : []).catch(() => []);
              const portsUp = portStatuses.filter((p: any) => p.status === 'Connected').length;
              const poeUsage = portStatuses.reduce((sum: number, p: any) => sum + (p.powerUsageInWh || 0), 0);
              typeData = { ports, portStatuses, portsUp, totalPorts: ports.length, poeUsage };
            } else if (deviceType === 'mr') {
              // AP: fetch RF data
              const rfStatus = await fetch(`/api/meraki/devices/${deviceSerial}/wireless/status`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : null).catch(() => null);
              typeData = { rfStatus, ssidCount: device.ssids?.length || 0 };
            } else if (deviceType === 'mx') {
              // MX: fetch uplinks and VPN
              const uplinks = await fetch(`/api/meraki/devices/${deviceSerial}/appliance/uplinks`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : null).catch(() => null);
              typeData = { uplinks };
            }
          } catch (e) {
            console.log('[DeviceDetailCard] Type-specific fetch failed:', e);
          }

          setDeviceData({
            device: mergedDevice,
            deviceType,
            clients: clients || [],
            clientCount: clients?.length || 0,
            neighbors: [],
            availableActions,
            recentEvents: [],
          });
          setTypeSpecificData(typeData);
          setFetchError(null);
        })
        .catch(err => {
          console.error('[DeviceDetailCard] Failed to fetch device:', err);
          setFetchError(err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [data?.needsEnrichment, deviceSerial]);

  // Show loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent mb-3" />
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading device details...</div>
        <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1">{deviceSerial}</div>
      </div>
    );
  }

  const device = deviceData?.device || deviceData;
  const clients = deviceData?.clients || [];
  const clientCount = deviceData?.clientCount || clients.length;
  const neighbors = deviceData?.neighbors || [];
  const availableActions = deviceData?.availableActions || ['ping', 'blink-led'];
  const recentEvents = deviceData?.recentEvents || [];
  const deviceType = deviceData?.deviceType || getDeviceType(device?.model || '');

  if (!device || !device.serial) {
    return <EmptyState message={fetchError || "No device data available"} />;
  }

  // Execute a quick action
  const executeAction = async (actionType: string) => {
    setIsActionRunning(true);
    setActionError(null);
    setActionResult(null);

    try {
      const response = await fetch(`/api/actions/${actionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          serial: device.serial,
          target: '8.8.8.8',
          count: 5,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || result.error || 'Action failed');
      }
      setActionResult({ type: actionType, data: result });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to execute action');
    } finally {
      setIsActionRunning(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-emerald-500';
      case 'offline': return 'bg-red-500';
      case 'alerting': return 'bg-amber-500';
      case 'dormant': return 'bg-slate-400';
      case 'unknown': return 'bg-slate-500';
      default: return 'bg-slate-400';
    }
  };

  // Get action icon
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'ping':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />;
      case 'blink-led':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />;
      case 'cable-test':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />;
      case 'reboot':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />;
      default:
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with device name and status */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-cyan-50/30 dark:from-slate-800/50 dark:to-cyan-900/20">
        <div className="flex items-center gap-2">
          <DeviceTypeIcon type={device.model || 'device'} className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
              {device.name || device.serial}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {device.serial}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(device.status)}`} />
          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 uppercase">
            {device.status || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Device Stats Grid - Type Specific */}
      <div className="grid grid-cols-2 gap-2 p-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Model:</span>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{device.model || '-'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Clients:</span>
          <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">{clientCount}</span>
        </div>

        {/* MX/Z - Security Appliance specific */}
        {deviceType === 'mx' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">WAN 1:</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{device.wan1Ip || device.publicIp || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">WAN 2:</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{device.wan2Ip || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Gateway:</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{device.gateway || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">DNS:</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{device.primaryDns || '-'}</span>
            </div>
          </>
        )}

        {/* MS - Switch specific */}
        {deviceType === 'ms' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Ports:</span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {typeSpecificData?.portsUp || 0}/{typeSpecificData?.totalPorts || '-'} up
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">PoE:</span>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {typeSpecificData?.poeUsage ? `${typeSpecificData.poeUsage.toFixed(1)}W` : '-'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">LAN IP:</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{device.lanIp || '-'}</span>
            </div>
          </>
        )}

        {/* MR - Access Point specific */}
        {deviceType === 'mr' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">LAN IP:</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{device.lanIp || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Channel:</span>
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                {typeSpecificData?.rfStatus?.basicServiceSets?.[0]?.channel || '-'}
              </span>
            </div>
          </>
        )}

        {/* Generic fallback for other types */}
        {!['mx', 'ms', 'mr'].includes(deviceType) && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">LAN IP:</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{device.lanIp || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">WAN IP:</span>
              <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{device.publicIp || '-'}</span>
            </div>
          </>
        )}
      </div>

      {/* Type-specific info section */}
      {deviceType === 'ms' && typeSpecificData?.portStatuses && (
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Port Status</div>
          <div className="flex flex-wrap gap-1">
            {typeSpecificData.portStatuses.slice(0, 24).map((port: any, i: number) => (
              <div
                key={i}
                title={`Port ${port.portId}: ${port.status}`}
                className={`w-3 h-3 rounded-sm ${port.status === 'Connected' ? 'bg-emerald-500' :
                  port.status === 'Disabled' ? 'bg-slate-300 dark:bg-slate-600' :
                    'bg-slate-200 dark:bg-slate-700'
                  }`}
              />
            ))}
            {typeSpecificData.portStatuses.length > 24 && (
              <span className="text-[10px] text-slate-400">+{typeSpecificData.portStatuses.length - 24}</span>
            )}
          </div>
        </div>
      )}

      {deviceType === 'mx' && typeSpecificData?.uplinks && (
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Uplinks</div>
          <div className="space-y-1">
            {(Array.isArray(typeSpecificData.uplinks) ? typeSpecificData.uplinks : [typeSpecificData.uplinks]).map((uplink: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className={`w-2 h-2 rounded-full ${uplink?.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-slate-600 dark:text-slate-400">{uplink?.interface || `WAN ${i + 1}`}</span>
                <span className="text-slate-400">{uplink?.publicIp || '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">
          Quick Actions
        </div>
        <div className="flex flex-wrap gap-2">
          {availableActions.slice(0, 4).map((action: string) => (
            <button
              key={action}
              onClick={() => executeAction(action)}
              disabled={isActionRunning}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg
                         bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300
                         hover:bg-cyan-100 dark:hover:bg-cyan-900/30 hover:text-cyan-700 dark:hover:text-cyan-400
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {getActionIcon(action)}
              </svg>
              {action.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Action Result */}
        {actionResult && (
          <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-[10px]">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {actionResult.type} completed
            </span>
          </div>
        )}
        {actionError && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-[10px] text-red-600 dark:text-red-400">
            {actionError}
          </div>
        )}
      </div>

      {/* Recent Events / Neighbors */}
      <div className="flex-1 overflow-auto p-3">
        {neighbors.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Connected Devices
            </div>
            <div className="space-y-1">
              {neighbors.slice(0, 3).map((n: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                  <span className="truncate">{n.systemName || n.deviceId || 'Unknown'}</span>
                  <span className="text-slate-400 dark:text-slate-500">({n.port})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentEvents.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Recent Events
            </div>
            <div className="space-y-1">
              {recentEvents.slice(0, 3).map((e: any, i: number) => (
                <div key={i} className="text-[10px] text-slate-600 dark:text-slate-400">
                  • {e.description}
                  <span className="text-slate-400 dark:text-slate-500 ml-1">
                    ({formatRelativeTime(e.timestamp)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

DeviceDetailCard.displayName = 'DeviceDetailCard';

// ============================================================================
// AI Card Wrappers
// ============================================================================

/**
 * DeviceChatCardWrapper - Wraps DeviceChatCard for canvas integration
 *
 * Maps card.data and card.config to DeviceChatCard props.
 */
const DeviceChatCardWrapper = memo(function DeviceChatCardWrapper({
  data,
  config,
}: {
  data: any;
  config?: Record<string, any>;
}) {
  // Extract device info from data or config
  const deviceSerial = config?.deviceSerial || data?.serial || data?.deviceSerial;
  const deviceName = config?.deviceName || data?.name || data?.deviceName;
  const deviceModel = config?.deviceModel || data?.model || data?.deviceModel;

  // If no device serial, show empty state
  if (!deviceSerial) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">No device selected</p>
          <p className="text-xs mt-1 opacity-75">Configure a device serial to enable chat</p>
        </div>
      </div>
    );
  }

  return (
    <DeviceChatCard
      deviceSerial={deviceSerial}
      deviceName={deviceName}
      deviceModel={deviceModel}
      title={`Chat: ${deviceName || deviceSerial}`}
    />
  );
});

DeviceChatCardWrapper.displayName = 'DeviceChatCardWrapper';

// ============================================================================
// Card Type to Component Map
// ============================================================================

const cardComponents: Record<CanvasCardType, React.ComponentType<{ data: any; config?: Record<string, any> }>> = {
  'network-health': NetworkHealthCard,
  'client-distribution': ClientDistributionCard,
  'performance-chart': ChartCard,
  'device-table': TableCard,
  'topology': TopologyCard,
  'alert-summary': AlertCard,
  'action': ActionCard,
  'custom': CustomCard,
  // AI-powered cards
  'device-chat': DeviceChatCardWrapper,
  // Phase 2 visualization types
  'rf-analysis': RFAnalysisCard,
  'health-trend': HealthTrendCard,
  'comparison': ComparisonCard,
  'path-analysis': PathAnalysisCard,
  // Phase 3 device-centric cards (AI Canvas Overhaul)
  'device-detail': DeviceDetailCard,
  'device-status': InterfaceStatusCard,  // Reuses InterfaceStatusCard for device status grid
  // network-overview removed - functionality covered by standalone cards
  'client-list': TableCard,         // Reuses TableCard with client-specific rendering
  'ssid-performance': MetricsCard,  // Reuses MetricsCard for SSID metrics
  'uplink-status': MetricsCard,     // Reuses MetricsCard for uplink data
  'switch-ports': TableCard,        // Reuses TableCard with port-specific rendering
  // Phase 4: Core Infrastructure Monitoring cards
  'bandwidth-utilization': BandwidthCard,
  'interface-status': InterfaceStatusCard,
  'latency-monitor': LatencyCard,
  'packet-loss': PacketLossCard,
  'cpu-memory-health': ResourceHealthCard,
  'uptime-tracker': UptimeCard,
  'sla-compliance': SLACard,
  'wan-failover': WANFailoverCard,
  // Phase 5: Traffic & Performance Analytics cards
  'top-talkers': TopTalkersCard,
  'traffic-composition': TrafficCompositionCard,
  'application-usage': ApplicationUsageCard,
  'qos-statistics': QoSCard,
  'traffic-heatmap': TrafficHeatmapCard,
  'client-timeline': ClientTimelineCard,
  'throughput-comparison': ThroughputComparisonCard,
  // Phase 6: Security & Compliance cards
  'security-events': SecurityEventsCard,
  'threat-map': ThreatMapCard,
  'firewall-hits': FirewallHitsCard,
  'blocked-connections': BlockedConnectionsCard,
  'intrusion-detection': IntrusionDetectionCard,
  'compliance-score': ComplianceScoreCard,
  // Phase 7: Wireless Deep Dive cards
  'channel-utilization-heatmap': ChannelHeatmapCard,
  'client-signal-strength': SignalStrengthCard,
  'ssid-client-breakdown': SSIDBreakdownCard,
  'roaming-events': RoamingEventsCard,
  'interference-monitor': InterferenceCard,
  // Phase 8: Switch & Infrastructure cards
  'network-topology': TopologyCard,
  'port-utilization-heatmap': PortHeatmapCard,
  'vlan-distribution': VLANDistributionCard,
  'poe-budget': PoEBudgetCard,
  'spanning-tree-status': SpanningTreeCard,
  'stack-status': StackStatusCard,
  // Phase 9: Alerts & Incidents cards
  'alert-timeline': AlertTimelineCard,
  'incident-tracker': IncidentTrackerCard,
  'alert-correlation': AlertCorrelationCard,
  'mttr-metrics': MTTRCard,
  // Phase 10: Splunk & Log Integration cards
  'log-volume-trend': LogVolumeCard,
  'splunk-event-summary': ErrorDistributionCard,  // Reuses ErrorDistributionCard for event type breakdown
  'splunk-search-results': SplunkSearchResultsCard,
  'error-distribution': ErrorDistributionCard,
  'event-correlation': EventCorrelationCard,
  'log-severity-breakdown': LogSeverityCard,
  // Phase 11: Knowledge Base cards
  'knowledge-sources': KnowledgeSourcesCard,
  'datasheet-comparison': DatasheetComparisonCard,
  'knowledge-detail': KnowledgeDetailCard,
  'product-detail': ProductDetailCard,
  // Phase 12: AI Contextual cards (data provided by AI)
  'ai-metric': AIMetricCard,
  'ai-stats-grid': AIStatsGridCard,
  'ai-gauge': AIGaugeCard,
  'ai-breakdown': AIBreakdownCard,
  'ai-finding': AIFindingCard,
  'ai-device-summary': AIDeviceSummaryCard,
};

// ============================================================================
// Data Extraction Layer
// ============================================================================

/**
 * Some API endpoints return combined data for multiple card types.
 * This function extracts the relevant portion for each card type.
 */
function extractCardData(cardType: string, data: any): any {
  if (!data) return data;

  // Performance endpoint returns { latency: {...}, packetLoss: {...} }
  // Extract the relevant nested data for each card type
  switch (cardType) {
    case 'latency-monitor':
      // If data has a latency key, extract it; otherwise assume it's already extracted
      if (data.latency && typeof data.latency === 'object') {
        return {
          current: data.latency.current,
          average: data.latency.average,
          min: data.latency.min,
          max: data.latency.max,
          jitter: data.jitter?.current,
          history: data.latency.history,
        };
      }
      return data;

    case 'packet-loss':
      // If data has a packetLoss key, extract it
      if (data.packetLoss && typeof data.packetLoss === 'object') {
        return {
          current: data.packetLoss.current,
          average: data.packetLoss.average,
          history: data.packetLoss.history?.map((h: any) => ({
            timestamp: h.timestamp,
            loss: h.lossPercent ?? h.loss,
            utilization: h.utilization,
          })),
        };
      }
      return data;

    case 'path-analysis':
      // Path analysis endpoint returns source/destination/hops directly
      // If the data already has source, use it as-is
      if (data.source && data.destination) {
        return data;
      }
      // Fallback: if data looks like topology data (nodes/links), return empty
      if (data.nodes && !data.source) {
        return {};
      }
      return data;

    case 'qos-statistics':
      // Backend now returns 'queues' directly, but handle legacy 'qosClasses' too
      if (data.queues && data.queues.length > 0) {
        return data;
      }
      if (data.qosClasses && !data.queues) {
        return {
          ...data,
          queues: data.qosClasses.map((qos: any) => ({
            name: qos.class || qos.name,
            priority: qos.priority,
            bytesIn: qos.packets ? qos.packets * 1500 : 0,
            bytesOut: qos.packets ? qos.packets * 1400 : 0,
            packetsIn: qos.packets || 0,
            packetsOut: Math.floor((qos.packets || 0) * 0.95),
            dropped: qos.drops || 0,
            latency: 5,
            jitter: 2,
            bufferUsage: qos.bufferUsage || 20,
          })),
        };
      }
      return data;

    case 'traffic-composition':
      // Backend now returns 'categories' directly
      // TrafficCompositionCard expects: categories, traffic, or items
      if (data.categories && data.categories.length > 0) {
        return data;
      }
      // Handle legacy trafficComposition format
      if (data.trafficComposition?.byCategory) {
        return {
          ...data,
          categories: data.trafficComposition.byCategory,
        };
      }
      return data;

    case 'application-usage':
      // Backend returns 'applications' directly - pass through
      return data;

    case 'top-talkers':
      // Backend returns 'clients' directly - pass through
      return data;

    case 'roaming-events':
      // Wireless-overview endpoint returns roamingEvents but RoamingEventsCard expects events or roaming
      if (data.roamingEvents && !data.events && !data.roaming) {
        return {
          ...data,
          events: data.roamingEvents,
        };
      }
      return data;

    case 'interference-monitor':
      // Wireless-overview endpoint returns interference.sources but InterferenceCard expects sources at top level
      if (data.interference && !data.sources) {
        return {
          ...data,
          sources: data.interference.sources,
          accessPoints: data.accessPoints,
        };
      }
      return data;

    case 'poe-budget':
      // Device-status endpoint returns poeBudget but PoEBudgetCard expects totalBudget/usedPower
      if (data.poeBudget && !data.totalBudget) {
        return {
          ...data,
          totalBudget: data.poeBudget.total,
          usedPower: data.poeBudget.used,
          ports: data.ports,
        };
      }
      return data;

    case 'spanning-tree-status':
      // Device-status returns minimal spanningTree but SpanningTreeCard expects switches with ports
      // Generate compatible data if we only have minimal data
      if (data.spanningTree && !data.switches) {
        return {
          ...data,
          rootBridge: {
            name: data.spanningTree.rootBridge || 'Root Bridge',
            bridgeId: '0000.0000.0001',
            priority: 4096,
          },
          stpMode: 'rstp',
          topologyChanges: data.spanningTree.changes || 0,
        };
      }
      return data;

    case 'stack-status':
      // Device-status returns stacks but may not have full member details
      if (data.stacks && data.switches) {
        // Enhance stacks with switch details
        return {
          ...data,
          stacks: data.stacks.map((stack: any) => ({
            ...stack,
            stackId: stack.stackId || 'stack-1',
            members: data.switches.map((sw: any, i: number) => ({
              serial: sw.serial,
              name: sw.name,
              model: sw.model,
              role: i === 0 ? 'master' : i === 1 ? 'standby' : 'member',
              status: sw.status === 'online' ? 'online' : 'offline',
              ports: 48,
            })),
          })),
        };
      }
      return data;

    case 'device-table':
      // Device-status returns { devices: [...] } but TableCard expects array directly
      if (data.devices && Array.isArray(data.devices)) {
        return data.devices;
      }
      return data;

    // =========================================================================
    // Security Cards - all share the security-events endpoint
    // =========================================================================
    case 'security-events':
      // SecurityEventsCard expects { events: [...] }
      // Backend returns events directly
      return data;

    case 'threat-map':
      // ThreatMapCard expects { threats: [...] } or { locations: [...] }
      // Backend returns both threats and locations as aliases
      return data;

    case 'blocked-connections':
      // BlockedConnectionsCard expects { connections: [...] } or { blocked: [...] } or { blockedConnections: [...] }
      // Backend returns connections and blockedConnections as aliases
      return data;

    case 'firewall-hits':
      // FirewallHitsCard expects { rules: [...] }
      // Backend returns rules directly
      return data;

    case 'intrusion-detection':
      // IntrusionDetectionCard expects { alerts: [...] }
      // Backend returns alerts directly
      return data;

    default:
      return data;
  }
}

// ============================================================================
// Main CardContent Component
// ============================================================================

export const CardContent = memo(({ card, className = '' }: CardContentProps) => {
  const Component = cardComponents[card.type] || CustomCard;

  // Extract the relevant data for this card type
  const extractedData = extractCardData(card.type, card.data);

  return (
    <div className={`h-full ${className}`}>
      <Component data={extractedData} config={card.config} />
    </div>
  );
});

CardContent.displayName = 'CardContent';

export default CardContent;
