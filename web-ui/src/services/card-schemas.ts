/**
 * Card Schemas - Zod validation schemas for Card Agent output
 *
 * Ensures the Claude-based Card Agent returns properly structured JSON
 * that can be safely rendered in the frontend.
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

/**
 * Supported card types - synced with CanvasCardType in types/session.ts
 *
 * NOTE: Keep this in sync with the CanvasCardType type definition.
 * This schema is used for validating Card Agent output.
 */
export const CardTypeSchema = z.enum([
  // Core types (Phase 1)
  'network-health',
  'client-distribution',
  'performance-chart',
  'device-table',
  'topology',
  'network-topology',
  'alert-summary',
  'action',
  'custom',
  // AI-powered cards
  'device-chat',
  // Phase 2 visualization types
  'rf-analysis',
  'health-trend',
  'comparison',
  'path-analysis',
  // Phase 3 device-centric cards
  'device-detail',
  'device-status',
  'client-list',
  'ssid-performance',
  'uplink-status',
  'switch-ports',
  // Phase 4: Core Infrastructure Monitoring
  'bandwidth-utilization',
  'interface-status',
  'latency-monitor',
  'packet-loss',
  'cpu-memory-health',
  'uptime-tracker',
  'sla-compliance',
  'wan-failover',
  // Phase 5: Traffic & Performance Analytics
  'top-talkers',
  'traffic-composition',
  'application-usage',
  'qos-statistics',
  'traffic-heatmap',
  'client-timeline',
  'throughput-comparison',
  // Phase 6: Security & Compliance
  'security-events',
  'threat-map',
  'firewall-hits',
  'blocked-connections',
  'intrusion-detection',
  'compliance-score',
  // Phase 7: Wireless Deep Dive
  'channel-utilization-heatmap',
  'client-signal-strength',
  'ssid-client-breakdown',
  'roaming-events',
  'interference-monitor',
  // Phase 8: Switch & Infrastructure
  'port-utilization-heatmap',
  'vlan-distribution',
  'poe-budget',
  'spanning-tree-status',
  'stack-status',
  // Phase 9: Alerts & Incidents
  'alert-timeline',
  'incident-tracker',
  'alert-correlation',
  'mttr-metrics',
  // Phase 10: Splunk & Log Integration
  'log-volume-trend',
  'splunk-event-summary',
  'splunk-search-results',
  'error-distribution',
  'event-correlation',
  'log-severity-breakdown',
  // Phase 11: Knowledge Base
  'knowledge-sources',
  'datasheet-comparison',
  'knowledge-detail',
  'product-detail',
  // Phase 12: AI Contextual Cards
  'ai-metric',
  'ai-stats-grid',
  'ai-gauge',
  'ai-breakdown',
  'ai-finding',
  'ai-device-summary',
]);

export type CardType = z.infer<typeof CardTypeSchema>;

/** Chart sub-types */
export const ChartTypeSchema = z.enum([
  'bar',
  'line',
  'area',
  'pie',
  'donut',
  'sparkline',
]);

export type ChartType = z.infer<typeof ChartTypeSchema>;

// ============================================================================
// Layout Schema
// ============================================================================

export const CardLayoutSchema = z.object({
  width: z.number().min(2).max(12).default(4),
  height: z.number().min(2).max(8).default(3),
});

export type CardLayout = z.infer<typeof CardLayoutSchema>;

// ============================================================================
// Data Point Schemas
// ============================================================================

/** Generic data point for charts */
export const DataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  category: z.string().optional(),
  color: z.string().optional(),
});

export type DataPoint = z.infer<typeof DataPointSchema>;

/** Time series data point */
export const TimeSeriesPointSchema = z.object({
  timestamp: z.string(),
  value: z.number(),
  series: z.string().optional(),
});

export type TimeSeriesPoint = z.infer<typeof TimeSeriesPointSchema>;

/** Table row (flexible) */
export const TableRowSchema = z.record(z.string(), z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]));

export type TableRow = z.infer<typeof TableRowSchema>;

/** Network node for topology */
export const NetworkNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string().optional(),
  status: z.enum(['online', 'offline', 'warning', 'unknown']).default('unknown'),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type NetworkNode = z.infer<typeof NetworkNodeSchema>;

/** Alert/notification item */
export const AlertItemSchema = z.object({
  id: z.string().optional(),
  message: z.string(),
  severity: z.enum(['critical', 'error', 'warning', 'info', 'success']).default('info'),
  timestamp: z.string().optional(),
  source: z.string().optional(),
});

export type AlertItem = z.infer<typeof AlertItemSchema>;

// ============================================================================
// Card Props Schemas (per card type)
// ============================================================================

/** Props for chart cards */
export const ChartPropsSchema = z.object({
  chartType: ChartTypeSchema,
  data: z.array(DataPointSchema).or(z.array(TimeSeriesPointSchema)),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  showLegend: z.boolean().default(false),
  interactive: z.boolean().default(true),
});

/** Props for table cards */
export const TablePropsSchema = z.object({
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    width: z.number().optional(),
    sortable: z.boolean().default(true),
  })),
  data: z.array(TableRowSchema),
  pageSize: z.number().default(10),
  searchable: z.boolean().default(true),
});

/** Props for metrics cards */
export const MetricsPropsSchema = z.object({
  metrics: z.array(z.object({
    label: z.string(),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional(),
    trend: z.enum(['up', 'down', 'stable']).optional(),
    trendValue: z.number().optional(),
  })),
  layout: z.enum(['grid', 'row', 'compact']).default('grid'),
});

/** Props for topology cards */
export const TopologyPropsSchema = z.object({
  nodes: z.array(NetworkNodeSchema),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
  })).optional(),
  layout: z.enum(['force', 'grid', 'hierarchical']).default('grid'),
});

/** Props for alert summary cards */
export const AlertPropsSchema = z.object({
  alerts: z.array(AlertItemSchema),
  showTimestamps: z.boolean().default(true),
  groupBy: z.enum(['severity', 'source', 'none']).default('none'),
});

/** Props for custom cards */
export const CustomPropsSchema = z.object({
  content: z.any(),
  format: z.enum(['json', 'text', 'markdown']).default('json'),
});

// ============================================================================
// Card Output Schema (what the agent returns)
// ============================================================================

export const CardOutputSchema = z.object({
  cardType: CardTypeSchema,
  title: z.string(),
  props: z.union([
    ChartPropsSchema,
    TablePropsSchema,
    MetricsPropsSchema,
    TopologyPropsSchema,
    AlertPropsSchema,
    CustomPropsSchema,
  ]),
  layout: CardLayoutSchema.optional(),
  // Metadata about the generation
  metrics: z.object({
    tokensIn: z.number().optional(),
    tokensOut: z.number().optional(),
    cost: z.number().optional(),
    timeTaken: z.number().optional(),
  }).optional(),
});

export type CardOutput = z.infer<typeof CardOutputSchema>;

// ============================================================================
// Card Generation Request Schema
// ============================================================================

export const CardGenerationRequestSchema = z.object({
  data: z.any(),
  dataDescription: z.string().optional(),
  preferredCardType: CardTypeSchema.optional(),
  context: z.string().optional(),
});

export type CardGenerationRequest = z.infer<typeof CardGenerationRequestSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate card output from the agent
 */
export function validateCardOutput(data: unknown): CardOutput | null {
  const result = CardOutputSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.error('[CardSchema] Validation failed:', result.error.issues);
  return null;
}

/**
 * Validate and provide fallback for invalid card output
 */
export function validateCardOutputWithFallback(data: unknown, rawData: any): CardOutput {
  const result = CardOutputSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  // Return a generic custom card with the raw data
  console.warn('[CardSchema] Falling back to custom card due to validation errors');
  return {
    cardType: 'custom',
    title: 'Data Summary',
    props: {
      content: rawData,
      format: 'json',
    } as z.infer<typeof CustomPropsSchema>,
  };
}

export default {
  CardOutputSchema,
  CardGenerationRequestSchema,
  validateCardOutput,
  validateCardOutputWithFallback,
};
