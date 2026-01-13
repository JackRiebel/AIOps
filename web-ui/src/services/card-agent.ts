/**
 * Card Agent Service
 *
 * A dedicated service that interfaces with the Claude-based CardGeneratorAgent
 * on the backend for intelligent card generation.
 *
 * Hybrid approach:
 * - Backend Claude agent analyzes data and outputs structured JSON
 * - Frontend validates with Zod and renders appropriate components
 * - Falls back to local inference for simple cases
 *
 * Following "Show, Don't Tell" philosophy:
 * - User triggers card creation with "+" button
 * - Agent automatically picks best visualization
 * - No configuration dialogs - just smart defaults
 */

import type { CanvasCard, CanvasCardType, CanvasCardLayout, CardSubscription } from '@/types/session';
import { validateCardOutputWithFallback, type CardOutput } from './card-schemas';
import { findNextAvailablePosition, DEFAULT_CARD_WIDTH, DEFAULT_CARD_HEIGHT, DEFAULT_MIN_W, DEFAULT_MIN_H } from '@/utils/canvas-layout';

// ============================================================================
// Types
// ============================================================================

/** Generic data that can be visualized - could be arrays, objects, or primitives */
export type CardData = unknown;

/** Card configuration object */
export type CardConfig = Record<string, unknown>;

export interface CardableData {
  /** Unique identifier for this data chunk */
  id: string;
  /** Type hint from AI (optional, agent will infer if not provided) */
  suggestedType?: CanvasCardType;
  /** Human-readable label for the + button */
  label: string;
  /** The actual data to visualize */
  data: CardData;
  /** Optional configuration hints */
  config?: CardConfig;
}

export interface CardGenerationResult {
  success: boolean;
  card?: CanvasCard;
  error?: string;
}

// Data shape detectors
interface DataShape {
  type: 'table' | 'list' | 'metrics' | 'timeseries' | 'hierarchy' | 'network' | 'unknown';
  columns?: string[];
  rowCount?: number;
  hasTimestamp?: boolean;
  hasNumericValues?: boolean;
}

// ============================================================================
// Data Analysis Functions
// ============================================================================

/**
 * Analyze data structure to determine its shape
 */
function analyzeDataShape(data: CardData): DataShape {
  if (!data) {
    return { type: 'unknown' };
  }

  // Array of objects - likely a table or list
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: 'list', rowCount: 0 };
    }

    const firstItem = data[0] as Record<string, unknown> | null;

    // Array of objects with consistent keys = table
    if (typeof firstItem === 'object' && firstItem !== null) {
      const columns = Object.keys(firstItem);
      const hasTimestamp = columns.some(c =>
        ['timestamp', 'time', 'date', 'created_at', 'updated_at'].includes(c.toLowerCase())
      );
      const hasNumericValues = columns.some(c =>
        typeof firstItem[c] === 'number'
      );

      // Check if it looks like timeseries data
      if (hasTimestamp && hasNumericValues && data.length > 2) {
        return { type: 'timeseries', columns, rowCount: data.length, hasTimestamp, hasNumericValues };
      }

      // Check if it looks like network topology (nodes/edges pattern)
      if (columns.includes('source') && columns.includes('target')) {
        return { type: 'network', columns, rowCount: data.length };
      }
      if (columns.includes('nodes') || columns.includes('edges')) {
        return { type: 'network', columns, rowCount: data.length };
      }

      // Check for hierarchy (parent/children pattern)
      if (columns.includes('parent') || columns.includes('children')) {
        return { type: 'hierarchy', columns, rowCount: data.length };
      }

      return { type: 'table', columns, rowCount: data.length, hasTimestamp, hasNumericValues };
    }

    // Array of primitives = simple list
    return { type: 'list', rowCount: data.length };
  }

  // Single object with numeric values = metrics
  if (typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>;
    const keys = Object.keys(dataObj);
    const numericKeys = keys.filter(k => typeof dataObj[k] === 'number');

    if (numericKeys.length >= 2) {
      return { type: 'metrics', columns: keys, hasNumericValues: true };
    }

    // Check for network structure
    if ('nodes' in dataObj && 'edges' in dataObj) {
      return { type: 'network' };
    }

    // Check for hierarchy
    if ('children' in dataObj || 'nodes' in dataObj) {
      return { type: 'hierarchy' };
    }
  }

  return { type: 'unknown' };
}

/**
 * Determine the best card type based on data shape
 */
function inferCardType(shape: DataShape, hint?: CanvasCardType): CanvasCardType {
  // Use hint if provided
  if (hint) return hint;

  switch (shape.type) {
    case 'table':
      return 'device-table';
    case 'timeseries':
      return 'performance-chart';
    case 'metrics':
      return 'network-health';
    case 'network':
      return 'topology';
    case 'hierarchy':
      return 'topology';
    case 'list':
      return shape.rowCount && shape.rowCount > 5 ? 'device-table' : 'alert-summary';
    default:
      return 'custom';
  }
}

/**
 * Generate default layout based on card type
 * Uses grid-aware position calculation to prevent overlaps
 */
function generateDefaultLayout(cardType: CanvasCardType, existingCards: CanvasCard[]): CanvasCardLayout {
  // Default sizes based on card type - optimized for compact display
  const sizes: Record<CanvasCardType, { w: number; h: number; minW: number; minH: number }> = {
    // Core cards - compact
    'network-health': { w: 4, h: 3, minW: 3, minH: 2 },
    'client-distribution': { w: 3, h: 3, minW: 3, minH: 2 },
    'performance-chart': { w: 4, h: 3, minW: 3, minH: 2 },
    'device-table': { w: 6, h: 4, minW: 4, minH: 3 },
    'topology': { w: 5, h: 4, minW: 4, minH: 3 },
    'network-topology': { w: 5, h: 4, minW: 4, minH: 3 },
    'alert-summary': { w: 3, h: 3, minW: 3, minH: 2 },
    'action': { w: 4, h: 3, minW: 3, minH: 2 },
    'custom': { w: 3, h: 3, minW: 2, minH: 2 },
    // AI-powered cards
    'device-chat': { w: 4, h: 4, minW: 3, minH: 3 },
    // Phase 2 cards - compact
    'rf-analysis': { w: 4, h: 4, minW: 3, minH: 3 },
    'health-trend': { w: 4, h: 3, minW: 3, minH: 2 },
    'comparison': { w: 5, h: 3, minW: 4, minH: 2 },
    'path-analysis': { w: 3, h: 4, minW: 3, minH: 3 },
    // Phase 3 device-centric cards - compact
    'device-detail': { w: 4, h: 4, minW: 3, minH: 3 },
    'device-status': { w: 4, h: 3, minW: 3, minH: 2 },
    'client-list': { w: 5, h: 3, minW: 4, minH: 2 },
    'ssid-performance': { w: 4, h: 3, minW: 3, minH: 2 },
    'uplink-status': { w: 3, h: 2, minW: 2, minH: 2 },
    'switch-ports': { w: 6, h: 4, minW: 5, minH: 3 },
    // Phase 4: Core Infrastructure - compact gauges/charts
    'bandwidth-utilization': { w: 4, h: 3, minW: 3, minH: 2 },
    'interface-status': { w: 4, h: 3, minW: 3, minH: 2 },
    'latency-monitor': { w: 3, h: 3, minW: 2, minH: 2 },
    'packet-loss': { w: 3, h: 3, minW: 2, minH: 2 },
    'cpu-memory-health': { w: 4, h: 3, minW: 3, minH: 2 },
    'uptime-tracker': { w: 4, h: 3, minW: 3, minH: 2 },
    'sla-compliance': { w: 4, h: 3, minW: 3, minH: 2 },
    'wan-failover': { w: 4, h: 3, minW: 3, minH: 2 },
    // Phase 5: Traffic Analytics - compact
    'top-talkers': { w: 4, h: 4, minW: 3, minH: 3 },
    'traffic-composition': { w: 4, h: 3, minW: 3, minH: 3 },
    'application-usage': { w: 4, h: 4, minW: 3, minH: 3 },
    'qos-statistics': { w: 5, h: 4, minW: 4, minH: 3 },
    'traffic-heatmap': { w: 6, h: 4, minW: 5, minH: 3 },
    'client-timeline': { w: 4, h: 4, minW: 3, minH: 3 },
    'throughput-comparison': { w: 5, h: 3, minW: 4, minH: 2 },
    // Phase 6: Security - compact
    'security-events': { w: 5, h: 4, minW: 4, minH: 3 },
    'threat-map': { w: 5, h: 4, minW: 4, minH: 3 },
    'firewall-hits': { w: 4, h: 4, minW: 3, minH: 3 },
    'blocked-connections': { w: 6, h: 4, minW: 5, minH: 3 },
    'intrusion-detection': { w: 5, h: 4, minW: 4, minH: 3 },
    'compliance-score': { w: 4, h: 4, minW: 3, minH: 3 },
    // Phase 7: Wireless - compact
    'channel-utilization-heatmap': { w: 6, h: 4, minW: 5, minH: 3 },
    'client-signal-strength': { w: 4, h: 3, minW: 3, minH: 2 },
    'ssid-client-breakdown': { w: 4, h: 3, minW: 3, minH: 3 },
    'roaming-events': { w: 4, h: 4, minW: 3, minH: 3 },
    'interference-monitor': { w: 4, h: 4, minW: 3, minH: 3 },
    // Phase 8: Switch - heatmaps need more space
    'port-utilization-heatmap': { w: 6, h: 4, minW: 5, minH: 3 },
    'vlan-distribution': { w: 4, h: 3, minW: 3, minH: 3 },
    'poe-budget': { w: 4, h: 4, minW: 3, minH: 3 },
    'spanning-tree-status': { w: 5, h: 4, minW: 4, minH: 3 },
    'stack-status': { w: 5, h: 4, minW: 4, minH: 3 },
    // Phase 9: Alerts & Incidents
    'alert-timeline': { w: 4, h: 5, minW: 3, minH: 4 },
    'incident-tracker': { w: 8, h: 4, minW: 6, minH: 3 },
    'alert-correlation': { w: 5, h: 4, minW: 4, minH: 3 },
    'mttr-metrics': { w: 4, h: 4, minW: 3, minH: 3 },
    // Phase 10: Splunk - compact
    'log-volume-trend': { w: 4, h: 3, minW: 3, minH: 2 },
    'splunk-event-summary': { w: 4, h: 3, minW: 3, minH: 2 },
    'splunk-search-results': { w: 5, h: 4, minW: 4, minH: 3 },
    'error-distribution': { w: 5, h: 4, minW: 4, minH: 3 },
    'event-correlation': { w: 6, h: 4, minW: 5, minH: 3 },
    'log-severity-breakdown': { w: 4, h: 3, minW: 3, minH: 3 },
    // Phase 11: Knowledge Base
    'knowledge-sources': { w: 4, h: 4, minW: 3, minH: 3 },
    'datasheet-comparison': { w: 6, h: 4, minW: 5, minH: 3 },
    'knowledge-detail': { w: 5, h: 4, minW: 4, minH: 3 },
    'product-detail': { w: 4, h: 4, minW: 3, minH: 3 },
    // Phase 12: AI Contextual cards
    'ai-metric': { w: 3, h: 3, minW: 2, minH: 2 },
    'ai-stats-grid': { w: 4, h: 3, minW: 3, minH: 2 },
    'ai-gauge': { w: 3, h: 3, minW: 2, minH: 2 },
    'ai-breakdown': { w: 4, h: 4, minW: 3, minH: 3 },
    'ai-finding': { w: 4, h: 3, minW: 3, minH: 2 },
    'ai-device-summary': { w: 4, h: 4, minW: 3, minH: 3 },
  };

  const size = sizes[cardType] || sizes.custom;

  // Use grid-aware position calculation to prevent overlaps
  const position = findNextAvailablePosition(existingCards, size.w, size.h);

  return {
    x: position.x,
    y: position.y,
    w: size.w,
    h: size.h,
    minW: size.minW,
    minH: size.minH,
  };
}

/**
 * Detect the data source and generate a live subscription configuration
 * Returns null if the data source can't be determined
 */
function detectLiveSubscription(data: CardData, cardType: CanvasCardType): { isLive: boolean; subscription?: CardSubscription } {
  // Look for source indicators in the data
  let source: string | null = null;
  let orgId: string | null = null;

  if (Array.isArray(data) && data.length > 0) {
    const firstItem = data[0] as Record<string, unknown> | null;
    if (!firstItem || typeof firstItem !== 'object') {
      return { isLive: false };
    }

    // Meraki device indicators
    if (firstItem.serial || firstItem.networkId || firstItem.productType) {
      source = 'meraki';
      orgId = (firstItem.organizationId || firstItem.orgId) as string | null;
    }

    // ThousandEyes indicators
    if (firstItem.testId || firstItem.agentId || firstItem.testName) {
      source = 'thousandeyes';
    }

    // Splunk indicators
    if (firstItem._time || firstItem.sourcetype || firstItem._raw) {
      source = 'splunk';
    }

    // Catalyst indicators
    if (firstItem.managementIpAddress || firstItem.platformId || firstItem.hostname) {
      source = 'catalyst';
    }
  }

  // If no source detected, not a live card
  if (!source) {
    return { isLive: false };
  }

  // Generate topic based on source and card type
  let topic: string;
  let transformFn: string | undefined;

  switch (cardType) {
    case 'device-table':
      topic = `${source}:devices`;
      transformFn = `${source}-devices`;
      break;
    case 'alert-summary':
      topic = `${source}:alerts`;
      transformFn = `${source}-alerts`;
      break;
    case 'network-health':
      topic = 'health';
      transformFn = 'health-metrics';
      break;
    case 'performance-chart':
      topic = `${source}:metrics`;
      break;
    default:
      topic = `${source}:events`;
  }

  // Append org ID if available
  if (orgId) {
    topic = `${topic}:${orgId}`;
  }

  return {
    isLive: true,
    subscription: {
      topic,
      transformFn,
    },
  };
}

/**
 * Generate a title based on data content
 */
function generateCardTitle(data: CardData, cardType: CanvasCardType, label?: string): string {
  if (label) return label;

  // Try to infer from data
  if (Array.isArray(data) && data.length > 0) {
    const firstItem = data[0] as Record<string, unknown> | null;
    if (firstItem && typeof firstItem === 'object') {
      if (firstItem.name) return `${data.length} ${cardType === 'device-table' ? 'Devices' : 'Items'}`;
      if (firstItem.serial) return `${data.length} Devices`;
      if (firstItem.network) return `${data.length} Networks`;
    }
  }

  // Default titles by type
  const defaultTitles: Record<CanvasCardType, string> = {
    'network-health': 'Network Health',
    'client-distribution': 'Client Distribution',
    'performance-chart': 'Performance',
    'device-table': 'Devices',
    'topology': 'Network Topology',
    'network-topology': 'Network Topology',
    'alert-summary': 'Alerts',
    'action': 'Action',
    'custom': 'Card',
    // AI-powered cards
    'device-chat': 'Device Chat',
    // New card types (Phase 2)
    'rf-analysis': 'RF Analysis',
    'health-trend': 'Health Trend',
    'comparison': 'Comparison',
    'path-analysis': 'Path Analysis',
    // Phase 3 device-centric cards
    'device-detail': 'Device Details',
    'device-status': 'Device Status',
    'client-list': 'Clients',
    'ssid-performance': 'SSID Performance',
    'uplink-status': 'Uplink Status',
    'switch-ports': 'Switch Ports',
    // Phase 4: Core Infrastructure Monitoring cards
    'bandwidth-utilization': 'Bandwidth',
    'interface-status': 'Interface Status',
    'latency-monitor': 'Latency',
    'packet-loss': 'Packet Loss',
    'cpu-memory-health': 'Resource Health',
    'uptime-tracker': 'Uptime',
    'sla-compliance': 'SLA Compliance',
    'wan-failover': 'WAN Failover',
    // Phase 5: Traffic & Performance Analytics cards
    'top-talkers': 'Top Talkers',
    'traffic-composition': 'Traffic Composition',
    'application-usage': 'Application Usage',
    'qos-statistics': 'QoS Statistics',
    'traffic-heatmap': 'Traffic Heatmap',
    'client-timeline': 'Client Timeline',
    'throughput-comparison': 'Throughput Comparison',
    // Phase 6: Security & Compliance cards
    'security-events': 'Security Events',
    'threat-map': 'Threat Map',
    'firewall-hits': 'Firewall Hits',
    'blocked-connections': 'Blocked Connections',
    'intrusion-detection': 'Intrusion Detection',
    'compliance-score': 'Compliance Score',
    // Phase 7: Wireless Deep Dive cards
    'channel-utilization-heatmap': 'Channel Heatmap',
    'client-signal-strength': 'Signal Strength',
    'ssid-client-breakdown': 'SSID Breakdown',
    'roaming-events': 'Roaming Events',
    'interference-monitor': 'Interference Monitor',
    // Phase 8: Switch & Infrastructure cards
    'port-utilization-heatmap': 'Port Heatmap',
    'vlan-distribution': 'VLAN Distribution',
    'poe-budget': 'PoE Budget',
    'spanning-tree-status': 'Spanning Tree',
    'stack-status': 'Stack Status',
    // Phase 9: Alerts & Incidents cards
    'alert-timeline': 'Alert Timeline',
    'incident-tracker': 'Incident Tracker',
    'alert-correlation': 'Alert Correlation',
    'mttr-metrics': 'MTTR Metrics',
    // Phase 10: Splunk & Log Integration cards
    'log-volume-trend': 'Log Volume',
    'splunk-event-summary': 'Event Summary',
    'splunk-search-results': 'Splunk Results',
    'error-distribution': 'Error Distribution',
    'event-correlation': 'Event Correlation',
    'log-severity-breakdown': 'Log Severity',
    // Phase 11: Knowledge Base cards
    'knowledge-sources': 'Source Documents',
    'datasheet-comparison': 'Product Comparison',
    'knowledge-detail': 'Document Details',
    'product-detail': 'Product Details',
    // Phase 12: AI Contextual cards
    'ai-metric': 'Metric',
    'ai-stats-grid': 'Stats',
    'ai-gauge': 'Gauge',
    'ai-breakdown': 'Breakdown',
    'ai-finding': 'Finding',
    'ai-device-summary': 'Device Summary',
  };

  return defaultTitles[cardType] || 'Card';
}

// ============================================================================
// Card Agent Class
// ============================================================================

// ============================================================================
// AI Layout Specification Types
// ============================================================================

export interface AILayoutSpec {
  /** Overall layout arrangement */
  arrangement: 'grid' | 'side-by-side' | 'stacked' | 'dashboard';
  /** Title for the layout group */
  title?: string;
  /** Cards with their positions */
  cards: AICardSpec[];
}

export interface AICardSpec {
  /** Card type */
  type: CanvasCardType;
  /** Card title */
  title: string;
  /** Grid position */
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** Card data */
  data?: CardData;
  /** Card configuration */
  config?: CardConfig;
  /** Whether this card should receive live updates */
  isLive?: boolean;
}

export interface LayoutGenerationResult {
  success: boolean;
  cards?: CanvasCard[];
  error?: string;
}

// ============================================================================
// Card Agent Class
// ============================================================================

export class CardAgent {
  /**
   * Generate a canvas card from data
   */
  static generateCard(
    cardableData: CardableData,
    existingCards: CanvasCard[] = []
  ): CardGenerationResult {
    console.log('[CardAgent][DEBUG] ===== generateCard CALLED =====');
    console.log('[CardAgent][DEBUG] cardableData:', {
      id: cardableData.id,
      label: cardableData.label,
      suggestedType: cardableData.suggestedType,
      configNetworkId: cardableData.config?.networkId,
      configOrgId: cardableData.config?.orgId,
      hasData: !!cardableData.data,
    });

    try {
      // Check if this is an AI contextual card (data provided by AI)
      const isAICard = cardableData.suggestedType?.startsWith('ai-');

      if (isAICard && cardableData.suggestedType) {
        // AI contextual cards bypass data analysis - use data as-is
        console.log('[CardAgent][DEBUG] AI contextual card detected, bypassing analysis');

        const cardType = cardableData.suggestedType;
        const layout = generateDefaultLayout(cardType, existingCards);
        const title = cardableData.label || generateCardTitle(cardableData.data, cardType);
        const now = new Date().toISOString();

        const card: CanvasCard = {
          id: cardableData.id || crypto.randomUUID(),
          type: cardType,
          title,
          layout,
          data: cardableData.data,
          config: {
            ...cardableData.config,
            isLocked: false,
            aiGenerated: true,
          },
          metadata: {
            createdAt: now,
            updatedAt: now,
            costUsd: 0,
            isLive: false, // AI contextual cards are static (data already provided)
          },
        };

        console.log('[CardAgent][DEBUG] Generated AI contextual card:', {
          id: card.id,
          type: card.type,
          title: card.title,
        });
        return { success: true, card };
      }

      // Standard card - analyze data shape
      const shape = analyzeDataShape(cardableData.data);
      console.log('[CardAgent][DEBUG] Data shape:', shape);

      // Determine card type
      const cardType = inferCardType(shape, cardableData.suggestedType);
      console.log('[CardAgent][DEBUG] Inferred cardType:', cardType);

      // Generate layout
      const layout = generateDefaultLayout(cardType, existingCards);

      // Generate title
      const title = generateCardTitle(cardableData.data, cardType, cardableData.label);

      // Detect if this data can be live-updated
      const liveConfig = detectLiveSubscription(cardableData.data, cardType);

      const now = new Date().toISOString();

      const card: CanvasCard = {
        id: crypto.randomUUID(),
        type: cardType,
        title,
        layout,
        data: cardableData.data,
        config: {
          ...cardableData.config,
          // Add shape info for the renderer
          dataShape: shape,
          // Lock state (default unlocked)
          isLocked: false,
        },
        metadata: {
          createdAt: now,
          updatedAt: now,
          costUsd: 0,
          isLive: liveConfig.isLive,
          subscription: liveConfig.subscription,
        },
      };

      console.log('[CardAgent][DEBUG] Generated card:', {
        id: card.id,
        type: card.type,
        title: card.title,
        configNetworkId: card.config?.networkId,
        configOrgId: card.config?.orgId,
        hasData: !!card.data,
      });
      console.log('[CardAgent][DEBUG] ===== END generateCard =====');

      return { success: true, card };
    } catch (error) {
      console.error('[CardAgent][DEBUG] Failed to generate card:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Detect cardable data in an AI response
   * Returns an array of data chunks that can be turned into cards
   *
   * IMPORTANT: Only returns ONE cardable to avoid duplicates.
   * Priority: structured data > JSON blocks > markdown tables > bullet lists
   */
  static detectCardableData(response: string, structuredData?: CardData): CardableData[] {
    // If structured data is provided, use it exclusively (most reliable)
    if (structuredData) {
      if (Array.isArray(structuredData) && structuredData.length > 0) {
        // Single array - one cardable
        const shape = analyzeDataShape(structuredData);
        if (shape.type !== 'unknown') {
          return [{
            id: crypto.randomUUID(),
            label: generateCardTitle(structuredData, inferCardType(shape)),
            data: structuredData,
          }];
        }
      } else if (typeof structuredData === 'object' && structuredData !== null) {
        // Object - find the first cardable array field
        const dataObj = structuredData as Record<string, unknown>;
        for (const [key, value] of Object.entries(dataObj)) {
          if (Array.isArray(value) && value.length > 0) {
            const shape = analyzeDataShape(value);
            if (shape.type !== 'unknown') {
              return [{
                id: crypto.randomUUID(),
                label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                data: value,
              }];
            }
          }
        }
      }
    }

    // No structured data - try parsing the response text
    // Priority 1: JSON blocks (most structured)
    const jsonMatches = response.matchAll(/```(?:json)?\s*([\s\S]*?)```/g);
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        const shape = analyzeDataShape(parsed);
        if (shape.type !== 'unknown') {
          return [{
            id: crypto.randomUUID(),
            label: 'Visualize Data',
            data: parsed,
          }];
        }
      } catch {
        // Not valid JSON, continue
      }
    }

    // Priority 2: Markdown tables
    const tableMatches = response.matchAll(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g);
    for (const match of tableMatches) {
      try {
        const headerLine = match[1];
        const dataLines = match[2].trim().split('\n');

        // Parse headers
        const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);

        // Parse rows
        const rows = dataLines.map(line => {
          const cells = line.split('|').map(c => c.trim()).filter(c => c);
          const row: Record<string, string> = {};
          headers.forEach((h, i) => {
            row[h] = cells[i] || '';
          });
          return row;
        });

        if (rows.length > 0 && headers.length > 0) {
          return [{
            id: crypto.randomUUID(),
            label: `Table (${rows.length} rows)`,
            data: rows,
            suggestedType: 'device-table',
          }];
        }
      } catch {
        // Failed to parse table, continue
      }
    }

    // Priority 3: Bullet lists with key:value format
    const listMatches = response.match(/(?:^|\n)(?:[-*•]\s+.+(?:\n|$)){3,}/gm);
    if (listMatches && listMatches.length > 0) {
      const listMatch = listMatches[0]; // Only use first list
      const items = listMatch.trim().split('\n').map(line =>
        line.replace(/^[-*•]\s+/, '').trim()
      ).filter(item => item);

      // Check if items have a "key: value" format
      const keyValueItems = items.filter(item => item.includes(':'));
      if (keyValueItems.length >= items.length * 0.5) {
        // Parse as metrics/key-value pairs
        const data: Record<string, string | number> = {};
        keyValueItems.forEach(item => {
          const [key, ...valueParts] = item.split(':');
          const value = valueParts.join(':').trim();
          const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
          data[key.trim()] = isNaN(numValue) ? value : numValue;
        });

        if (Object.keys(data).length >= 3) {
          return [{
            id: crypto.randomUUID(),
            label: 'Summary Metrics',
            data,
            suggestedType: 'network-health',
          }];
        }
      }
    }

    // No cardable data found
    return [];
  }

  /**
   * Update card lock state
   */
  static setCardLocked(card: CanvasCard, isLocked: boolean): CanvasCard {
    return {
      ...card,
      config: {
        ...card.config,
        isLocked,
      },
      metadata: {
        ...card.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Check if a card is locked
   */
  static isCardLocked(card: CanvasCard): boolean {
    return card.config?.isLocked === true;
  }

  /**
   * Generate a card using the Claude-based backend agent
   * Falls back to local inference if the backend call fails
   */
  static async generateCardWithClaude(
    data: CardData,
    context: string = '',
    existingCards: CanvasCard[] = []
  ): Promise<CardGenerationResult> {
    try {
      // Try backend Claude agent first
      const response = await fetch('/api/agents/card-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          context,
          preferredCardType: null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.card) {
        // Validate with Zod and apply fallback if needed
        const validatedCard = validateCardOutputWithFallback(result.card, data);

        // Convert to CanvasCard
        const layout = generateDefaultLayout(
          validatedCard.cardType as CanvasCardType,
          existingCards
        );

        const now = new Date().toISOString();

        // Detect if this data can be live-updated
        const props = validatedCard.props as Record<string, unknown>;
        const cardData = (props.data as CardData) || data;
        const liveConfig = detectLiveSubscription(cardData, validatedCard.cardType as CanvasCardType);

        // Use grid-aware position calculation if layout is provided
        const cardWidth = validatedCard.layout?.width || layout.w;
        const cardHeight = validatedCard.layout?.height || layout.h;
        const position = findNextAvailablePosition(existingCards, cardWidth, cardHeight);

        const card: CanvasCard = {
          id: crypto.randomUUID(),
          type: validatedCard.cardType as CanvasCardType,
          title: validatedCard.title,
          layout: validatedCard.layout ? {
            x: position.x,
            y: position.y,
            w: cardWidth,
            h: cardHeight,
          } : layout,
          data: cardData,
          config: {
            ...validatedCard.props,
            isLocked: false,
            generatedByClaude: true,
          },
          metadata: {
            createdAt: now,
            updatedAt: now,
            costUsd: validatedCard.metrics?.cost || 0,
            isLive: liveConfig.isLive,
            subscription: liveConfig.subscription,
          },
        };

        return { success: true, card };
      }

      // Backend returned error, fall back to local
      console.warn('[CardAgent] Backend returned error, using local inference');
      return this.generateCard({ id: crypto.randomUUID(), label: 'Data', data }, existingCards);

    } catch (error) {
      console.warn('[CardAgent] Backend call failed, using local inference:', error);
      // Fall back to local inference
      return this.generateCard({ id: crypto.randomUUID(), label: 'Data', data }, existingCards);
    }
  }

  /**
   * Generate multiple cards from an AI layout specification
   * This allows the AI to create cohesive dashboard layouts
   */
  static generateCardsFromLayout(
    layoutSpec: AILayoutSpec,
    existingCards: CanvasCard[] = []
  ): LayoutGenerationResult {
    console.log('[CardAgent] Generating cards from layout spec:', layoutSpec.arrangement);

    try {
      const now = new Date().toISOString();
      const layoutGroupId = layoutSpec.title ? `layout-${Date.now()}` : undefined;

      // First, create cards with their specified positions (relative to each other)
      const rawCards: CanvasCard[] = layoutSpec.cards.map((spec) => {
        // Detect if this data can be live-updated
        const liveConfig = spec.data
          ? detectLiveSubscription(spec.data, spec.type)
          : { isLive: spec.isLive || false };

        return {
          id: crypto.randomUUID(),
          type: spec.type,
          title: spec.title,
          layout: {
            x: spec.position.x,
            y: spec.position.y,
            w: spec.position.w,
            h: spec.position.h,
          },
          data: spec.data || {},
          config: {
            ...spec.config,
            isLocked: false,
            layoutGroupId,
            layoutGroupTitle: layoutSpec.title,
          },
          metadata: {
            createdAt: now,
            updatedAt: now,
            costUsd: 0,
            isLive: liveConfig.isLive,
            subscription: liveConfig.subscription,
          },
        };
      });

      // Use grid-aware position calculation to place cards without overlapping existing cards
      // This handles the offset and collision resolution properly
      let allCards = [...existingCards];
      const validatedCards: CanvasCard[] = [];

      for (const card of rawCards) {
        const position = findNextAvailablePosition(
          allCards,
          card.layout.w,
          card.layout.h
        );
        const validatedCard = {
          ...card,
          layout: {
            ...card.layout,
            x: position.x,
            y: position.y,
          },
        };
        validatedCards.push(validatedCard);
        allCards.push(validatedCard);
      }

      console.log(`[CardAgent] Generated ${validatedCards.length} cards from layout`);
      return { success: true, cards: validatedCards };
    } catch (error) {
      console.error('[CardAgent] Failed to generate cards from layout:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse AI response for layout specifications
   * Looks for structured layout instructions in the response
   */
  static parseLayoutFromResponse(response: string): AILayoutSpec | null {
    // Look for layout specification in JSON format
    const layoutMatch = response.match(/```(?:json)?\s*\{[\s\S]*?"cards"\s*:\s*\[[\s\S]*?\][\s\S]*?\}```/);
    if (layoutMatch) {
      try {
        // Extract JSON from code block
        const jsonStr = layoutMatch[0].replace(/```(?:json)?\s*/, '').replace(/```$/, '');
        const parsed = JSON.parse(jsonStr);

        // Validate it has the required structure
        if (parsed.cards && Array.isArray(parsed.cards)) {
          return {
            arrangement: parsed.arrangement || parsed.layout || 'grid',
            title: parsed.title,
            cards: parsed.cards.map((card: Record<string, unknown>) => ({
              type: (card.type || card.cardType || 'custom') as CanvasCardType,
              title: (card.title || card.name || 'Card') as string,
              position: (card.position as { x: number; y: number; w: number; h: number }) || {
                x: (card.x as number) || 0,
                y: (card.y as number) || 0,
                w: (card.w as number) || (card.width as number) || 4,
                h: (card.h as number) || (card.height as number) || 3,
              },
              data: card.data as CardData,
              config: card.config as CardConfig,
              isLive: Boolean(card.isLive || card.live),
            })),
          };
        }
      } catch (e) {
        console.warn('[CardAgent] Failed to parse layout JSON:', e);
      }
    }

    // Look for simpler layout patterns (e.g., "Create a dashboard with...")
    const dashboardMatch = response.match(/dashboard|layout|arrange|side.by.side|grid/i);
    if (dashboardMatch) {
      // Try to extract card types mentioned
      const cardTypes = this.extractMentionedCardTypes(response);
      if (cardTypes.length >= 2) {
        return this.generateAutoLayout(cardTypes);
      }
    }

    return null;
  }

  /**
   * Extract card types mentioned in the response
   */
  private static extractMentionedCardTypes(response: string): CanvasCardType[] {
    const cardTypePatterns: { pattern: RegExp; type: CanvasCardType }[] = [
      { pattern: /network\s*health/i, type: 'network-health' },
      { pattern: /device\s*(table|list|inventory)/i, type: 'device-table' },
      { pattern: /topology/i, type: 'topology' },
      { pattern: /alert\s*(summary|list)/i, type: 'alert-summary' },
      { pattern: /performance\s*chart/i, type: 'performance-chart' },
      { pattern: /client\s*distribution/i, type: 'client-distribution' },
      { pattern: /bandwidth/i, type: 'bandwidth-utilization' },
      { pattern: /latency/i, type: 'latency-monitor' },
      { pattern: /security\s*events/i, type: 'security-events' },
      { pattern: /threat\s*map/i, type: 'threat-map' },
      { pattern: /firewall/i, type: 'firewall-hits' },
      { pattern: /wireless|rf/i, type: 'rf-analysis' },
      { pattern: /incident/i, type: 'incident-tracker' },
      { pattern: /splunk|log/i, type: 'splunk-search-results' },
    ];

    const foundTypes: CanvasCardType[] = [];
    for (const { pattern, type } of cardTypePatterns) {
      if (pattern.test(response) && !foundTypes.includes(type)) {
        foundTypes.push(type);
      }
    }

    return foundTypes;
  }

  /**
   * Generate an automatic layout for a set of card types
   */
  private static generateAutoLayout(cardTypes: CanvasCardType[]): AILayoutSpec {
    const cards: AICardSpec[] = [];
    let currentY = 0;
    let currentX = 0;
    const maxWidth = 12; // Grid is 12 columns

    for (const type of cardTypes) {
      // Get default size for this card type
      const sizes: Record<string, { w: number; h: number }> = {
        'network-health': { w: 4, h: 3 },
        'device-table': { w: 8, h: 4 },
        'topology': { w: 6, h: 5 },
        'alert-summary': { w: 4, h: 3 },
        'performance-chart': { w: 6, h: 4 },
        'bandwidth-utilization': { w: 6, h: 4 },
        'latency-monitor': { w: 4, h: 4 },
        'security-events': { w: 6, h: 6 },
        'threat-map': { w: 6, h: 5 },
        'rf-analysis': { w: 6, h: 5 },
        'incident-tracker': { w: 10, h: 6 },
        'splunk-search-results': { w: 6, h: 6 },
      };

      const size = sizes[type] || { w: 4, h: 3 };

      // Check if card fits on current row
      if (currentX + size.w > maxWidth) {
        currentX = 0;
        currentY += 4; // Move to next row (average card height)
      }

      cards.push({
        type,
        title: generateCardTitle(null, type),
        position: {
          x: currentX,
          y: currentY,
          w: size.w,
          h: size.h,
        },
        isLive: true,
      });

      currentX += size.w;
    }

    return {
      arrangement: 'grid',
      title: 'Auto-Generated Dashboard',
      cards,
    };
  }

  /**
   * Create a predefined layout for common scenarios
   */
  static createScenarioLayout(
    scenario: 'incident' | 'performance' | 'security' | 'wireless' | 'overview'
  ): AILayoutSpec {
    const scenarios: Record<string, AILayoutSpec> = {
      incident: {
        arrangement: 'dashboard',
        title: 'Incident Analysis',
        cards: [
          { type: 'incident-tracker', title: 'Active Incidents', position: { x: 0, y: 0, w: 6, h: 4 }, isLive: true },
          { type: 'network-health', title: 'Network Health', position: { x: 6, y: 0, w: 6, h: 4 }, isLive: true },
          { type: 'alert-timeline', title: 'Alert Timeline', position: { x: 0, y: 4, w: 12, h: 3 }, isLive: true },
        ],
      },
      performance: {
        arrangement: 'dashboard',
        title: 'Performance Debug',
        cards: [
          { type: 'latency-monitor', title: 'Latency', position: { x: 0, y: 0, w: 4, h: 4 }, isLive: true },
          { type: 'bandwidth-utilization', title: 'Bandwidth', position: { x: 4, y: 0, w: 4, h: 4 }, isLive: true },
          { type: 'packet-loss', title: 'Packet Loss', position: { x: 8, y: 0, w: 4, h: 4 }, isLive: true },
          { type: 'path-analysis', title: 'Path Analysis', position: { x: 0, y: 4, w: 12, h: 3 } },
        ],
      },
      security: {
        arrangement: 'dashboard',
        title: 'Security Overview',
        cards: [
          { type: 'threat-map', title: 'Threat Map', position: { x: 0, y: 0, w: 8, h: 4 }, isLive: true },
          { type: 'compliance-score', title: 'Compliance', position: { x: 8, y: 0, w: 4, h: 4 } },
          { type: 'security-events', title: 'Security Events', position: { x: 0, y: 4, w: 6, h: 4 }, isLive: true },
          { type: 'blocked-connections', title: 'Blocked', position: { x: 6, y: 4, w: 6, h: 4 }, isLive: true },
        ],
      },
      wireless: {
        arrangement: 'dashboard',
        title: 'Wireless Health',
        cards: [
          { type: 'rf-analysis', title: 'RF Analysis', position: { x: 0, y: 0, w: 6, h: 4 }, isLive: true },
          { type: 'client-distribution', title: 'Clients', position: { x: 6, y: 0, w: 6, h: 4 }, isLive: true },
          { type: 'channel-utilization-heatmap', title: 'Channel Utilization', position: { x: 0, y: 4, w: 6, h: 4 }, isLive: true },
          { type: 'ssid-client-breakdown', title: 'SSID Breakdown', position: { x: 6, y: 4, w: 6, h: 4 } },
        ],
      },
      overview: {
        arrangement: 'dashboard',
        title: 'Network Overview',
        cards: [
          { type: 'network-health', title: 'Network Health', position: { x: 0, y: 0, w: 4, h: 4 }, isLive: true },
          { type: 'alert-summary', title: 'Alerts', position: { x: 4, y: 0, w: 4, h: 4 }, isLive: true },
          { type: 'topology', title: 'Topology', position: { x: 8, y: 0, w: 4, h: 4 }, isLive: true },
          { type: 'device-table', title: 'Devices', position: { x: 0, y: 4, w: 6, h: 4 } },
        ],
      },
    };

    return scenarios[scenario] || scenarios.overview;
  }
}

export default CardAgent;
