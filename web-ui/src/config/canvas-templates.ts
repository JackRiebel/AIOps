/**
 * Canvas Templates - Pre-defined layouts for common scenarios
 *
 * Templates allow users to quickly set up dashboards for specific use cases.
 * Each template defines a set of cards with their positions and configurations.
 */

import type { CanvasCard, CanvasCardType } from '@/types/session';

// =============================================================================
// Types
// =============================================================================

export interface CanvasTemplate {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Category for grouping */
  category: TemplateCategory;
  /** Icon name (Lucide icon) */
  icon: string;
  /** Tags for search */
  tags: string[];
  /** Card definitions */
  cards: TemplateCard[];
  /** Preview image URL (optional) */
  previewUrl?: string;
}

export interface TemplateCard {
  /** Card type */
  type: CanvasCardType;
  /** Card title */
  title: string;
  /** Grid position */
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** Initial configuration (optional) */
  config?: Record<string, unknown>;
  /** Whether this card requires live data */
  isLive?: boolean;
}

export type TemplateCategory =
  | 'troubleshooting'
  | 'monitoring'
  | 'security'
  | 'wireless'
  | 'analysis'
  | 'overview';

// =============================================================================
// Template Definitions
// =============================================================================

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  // -------------------------------------------------------------------------
  // Troubleshooting Templates
  // -------------------------------------------------------------------------
  {
    id: 'incident-analysis',
    name: 'Incident Analysis',
    description: 'Track and analyze network incidents with timeline and health metrics',
    category: 'troubleshooting',
    icon: 'AlertTriangle',
    tags: ['incident', 'alerts', 'troubleshoot', 'timeline'],
    cards: [
      {
        type: 'incident-tracker',
        title: 'Active Incidents',
        layout: { x: 0, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'network-health',
        title: 'Network Health',
        layout: { x: 6, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'alert-timeline',
        title: 'Alert Timeline',
        layout: { x: 0, y: 4, w: 12, h: 3 },
        isLive: true,
      },
    ],
  },
  {
    id: 'performance-debug',
    name: 'Performance Debug',
    description: 'Debug network performance issues with latency, bandwidth, and path analysis',
    category: 'troubleshooting',
    icon: 'Activity',
    tags: ['performance', 'latency', 'bandwidth', 'debug'],
    cards: [
      {
        type: 'latency-monitor',
        title: 'Latency Monitor',
        layout: { x: 0, y: 0, w: 4, h: 4 },
        isLive: true,
      },
      {
        type: 'bandwidth-utilization',
        title: 'Bandwidth Utilization',
        layout: { x: 4, y: 0, w: 4, h: 4 },
        isLive: true,
      },
      {
        type: 'packet-loss',
        title: 'Packet Loss',
        layout: { x: 8, y: 0, w: 4, h: 4 },
        isLive: true,
      },
      {
        type: 'path-analysis',
        title: 'Path Analysis',
        layout: { x: 0, y: 4, w: 12, h: 3 },
      },
    ],
  },
  {
    id: 'connectivity-troubleshoot',
    name: 'Connectivity Issues',
    description: 'Diagnose client connectivity problems with signal and roaming analysis',
    category: 'troubleshooting',
    icon: 'Wifi',
    tags: ['connectivity', 'client', 'signal', 'roaming'],
    cards: [
      {
        type: 'client-signal-strength',
        title: 'Client Signal Strength',
        layout: { x: 0, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'roaming-events',
        title: 'Roaming Events',
        layout: { x: 6, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'client-timeline',
        title: 'Client Timeline',
        layout: { x: 0, y: 4, w: 12, h: 3 },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Monitoring Templates
  // -------------------------------------------------------------------------
  {
    id: 'network-overview',
    name: 'Network Overview',
    description: 'High-level view of network status, devices, and topology',
    category: 'overview',
    icon: 'LayoutDashboard',
    tags: ['overview', 'dashboard', 'devices', 'topology'],
    cards: [
      {
        type: 'network-health',
        title: 'Network Health',
        layout: { x: 0, y: 0, w: 4, h: 4 },
        isLive: true,
      },
      {
        type: 'alert-summary',
        title: 'Active Alerts',
        layout: { x: 4, y: 0, w: 4, h: 4 },
        isLive: true,
      },
      {
        type: 'topology',
        title: 'Network Topology',
        layout: { x: 8, y: 0, w: 4, h: 4 },
        isLive: true,
      },
      {
        type: 'device-table',
        title: 'Device Inventory',
        layout: { x: 0, y: 4, w: 6, h: 4 },
      },
    ],
  },
  {
    id: 'infrastructure-health',
    name: 'Infrastructure Health',
    description: 'Monitor CPU, memory, uptime, and SLA compliance across devices',
    category: 'monitoring',
    icon: 'Server',
    tags: ['health', 'cpu', 'memory', 'uptime', 'infrastructure'],
    cards: [
      {
        type: 'cpu-memory-health',
        title: 'CPU & Memory',
        layout: { x: 0, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'uptime-tracker',
        title: 'Uptime Tracker',
        layout: { x: 6, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'sla-compliance',
        title: 'SLA Compliance',
        layout: { x: 0, y: 4, w: 6, h: 3 },
      },
      {
        type: 'wan-failover',
        title: 'WAN Failover Status',
        layout: { x: 6, y: 4, w: 6, h: 3 },
        isLive: true,
      },
    ],
  },
  {
    id: 'traffic-analytics',
    name: 'Traffic Analytics',
    description: 'Analyze network traffic patterns, top talkers, and application usage',
    category: 'analysis',
    icon: 'BarChart3',
    tags: ['traffic', 'analytics', 'applications', 'bandwidth'],
    cards: [
      {
        type: 'top-talkers',
        title: 'Top Talkers',
        layout: { x: 0, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'traffic-composition',
        title: 'Traffic Composition',
        layout: { x: 6, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'application-usage',
        title: 'Application Usage',
        layout: { x: 0, y: 4, w: 8, h: 4 },
      },
      {
        type: 'qos-statistics',
        title: 'QoS Statistics',
        layout: { x: 8, y: 4, w: 4, h: 4 },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Security Templates
  // -------------------------------------------------------------------------
  {
    id: 'security-overview',
    name: 'Security Overview',
    description: 'Monitor security events, threats, and compliance status',
    category: 'security',
    icon: 'Shield',
    tags: ['security', 'threats', 'compliance', 'firewall'],
    cards: [
      {
        type: 'threat-map',
        title: 'Threat Map',
        layout: { x: 0, y: 0, w: 8, h: 4 },
        isLive: true,
      },
      {
        type: 'compliance-score',
        title: 'Compliance Score',
        layout: { x: 8, y: 0, w: 4, h: 4 },
      },
      {
        type: 'security-events',
        title: 'Security Events',
        layout: { x: 0, y: 4, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'blocked-connections',
        title: 'Blocked Connections',
        layout: { x: 6, y: 4, w: 6, h: 4 },
        isLive: true,
      },
    ],
  },
  {
    id: 'firewall-analysis',
    name: 'Firewall Analysis',
    description: 'Deep dive into firewall rules, hits, and intrusion detection',
    category: 'security',
    icon: 'ShieldAlert',
    tags: ['firewall', 'rules', 'intrusion', 'ids'],
    cards: [
      {
        type: 'firewall-hits',
        title: 'Firewall Hits',
        layout: { x: 0, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'intrusion-detection',
        title: 'Intrusion Detection',
        layout: { x: 6, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'blocked-connections',
        title: 'Blocked Connections',
        layout: { x: 0, y: 4, w: 12, h: 4 },
        isLive: true,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Wireless Templates
  // -------------------------------------------------------------------------
  {
    id: 'wireless-health',
    name: 'Wireless Health',
    description: 'Monitor wireless network health, RF analysis, and client distribution',
    category: 'wireless',
    icon: 'Radio',
    tags: ['wireless', 'wifi', 'rf', 'clients'],
    cards: [
      {
        type: 'rf-analysis',
        title: 'RF Analysis',
        layout: { x: 0, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'client-distribution',
        title: 'Client Distribution',
        layout: { x: 6, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'ssid-client-breakdown',
        title: 'SSID Breakdown',
        layout: { x: 0, y: 4, w: 6, h: 4 },
      },
      {
        type: 'channel-utilization-heatmap',
        title: 'Channel Utilization',
        layout: { x: 6, y: 4, w: 6, h: 4 },
        isLive: true,
      },
    ],
  },
  {
    id: 'wireless-troubleshoot',
    name: 'Wireless Troubleshoot',
    description: 'Debug wireless issues with interference, signal, and roaming analysis',
    category: 'wireless',
    icon: 'WifiOff',
    tags: ['wireless', 'troubleshoot', 'interference', 'signal'],
    cards: [
      {
        type: 'interference-monitor',
        title: 'Interference Monitor',
        layout: { x: 0, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'client-signal-strength',
        title: 'Signal Strength',
        layout: { x: 6, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'roaming-events',
        title: 'Roaming Events',
        layout: { x: 0, y: 4, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'channel-utilization-heatmap',
        title: 'Channel Heatmap',
        layout: { x: 6, y: 4, w: 6, h: 4 },
        isLive: true,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Analysis Templates
  // -------------------------------------------------------------------------
  {
    id: 'splunk-analysis',
    name: 'Splunk Analysis',
    description: 'Analyze logs, events, and correlations from Splunk',
    category: 'analysis',
    icon: 'FileSearch',
    tags: ['splunk', 'logs', 'events', 'correlation'],
    cards: [
      {
        type: 'splunk-search-results',
        title: 'Search Results',
        layout: { x: 0, y: 0, w: 8, h: 4 },
      },
      {
        type: 'log-severity-breakdown',
        title: 'Severity Breakdown',
        layout: { x: 8, y: 0, w: 4, h: 4 },
      },
      {
        type: 'log-volume-trend',
        title: 'Log Volume Trend',
        layout: { x: 0, y: 4, w: 6, h: 3 },
        isLive: true,
      },
      {
        type: 'error-distribution',
        title: 'Error Distribution',
        layout: { x: 6, y: 4, w: 6, h: 3 },
      },
    ],
  },
  {
    id: 'switch-infrastructure',
    name: 'Switch Infrastructure',
    description: 'Monitor switch ports, VLANs, PoE, and spanning tree',
    category: 'monitoring',
    icon: 'Network',
    tags: ['switch', 'ports', 'vlan', 'poe'],
    cards: [
      {
        type: 'port-utilization-heatmap',
        title: 'Port Utilization',
        layout: { x: 0, y: 0, w: 6, h: 4 },
        isLive: true,
      },
      {
        type: 'vlan-distribution',
        title: 'VLAN Distribution',
        layout: { x: 6, y: 0, w: 6, h: 4 },
      },
      {
        type: 'poe-budget',
        title: 'PoE Budget',
        layout: { x: 0, y: 4, w: 4, h: 3 },
        isLive: true,
      },
      {
        type: 'spanning-tree-status',
        title: 'Spanning Tree',
        layout: { x: 4, y: 4, w: 4, h: 3 },
      },
      {
        type: 'stack-status',
        title: 'Stack Status',
        layout: { x: 8, y: 4, w: 4, h: 3 },
        isLive: true,
      },
    ],
  },
  {
    id: 'alert-management',
    name: 'Alert Management',
    description: 'Manage and correlate alerts with MTTR tracking',
    category: 'monitoring',
    icon: 'Bell',
    tags: ['alerts', 'mttr', 'correlation', 'management'],
    cards: [
      {
        type: 'alert-summary',
        title: 'Alert Summary',
        layout: { x: 0, y: 0, w: 4, h: 4 },
        isLive: true,
      },
      {
        type: 'alert-correlation',
        title: 'Alert Correlation',
        layout: { x: 4, y: 0, w: 4, h: 4 },
      },
      {
        type: 'mttr-metrics',
        title: 'MTTR Metrics',
        layout: { x: 8, y: 0, w: 4, h: 4 },
      },
      {
        type: 'alert-timeline',
        title: 'Alert Timeline',
        layout: { x: 0, y: 4, w: 12, h: 3 },
        isLive: true,
      },
    ],
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): CanvasTemplate[] {
  return CANVAS_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get all unique categories
 */
export function getTemplateCategories(): TemplateCategory[] {
  return [...new Set(CANVAS_TEMPLATES.map((t) => t.category))];
}

/**
 * Search templates by query
 */
export function searchTemplates(query: string): CanvasTemplate[] {
  const lowerQuery = query.toLowerCase();
  return CANVAS_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): CanvasTemplate | undefined {
  return CANVAS_TEMPLATES.find((t) => t.id === id);
}

/**
 * Context for template cards - provides organization and network info for data fetching
 */
export interface TemplateContext {
  /** Organization name for API calls */
  orgId?: string;
  /** Network ID for network-specific cards */
  networkId?: string;
  /** Network name for display */
  networkName?: string;
}

/**
 * Convert template to canvas cards
 */
export function templateToCanvasCards(
  template: CanvasTemplate,
  context?: TemplateContext
): CanvasCard[] {
  const now = new Date().toISOString();

  console.log('[templateToCanvasCards] Creating cards with context:', context);

  const cards = template.cards.map((card, index) => {
    const canvasCard = {
      id: `${template.id}-${index}-${crypto.randomUUID().slice(0, 8)}`,
      type: card.type,
      title: card.title,
      layout: card.layout,
      data: {}, // Data will be populated by live polling or API calls
      config: {
        ...card.config,
        // Add context to card config for polling
        orgId: context?.orgId,
        networkId: context?.networkId,
        networkName: context?.networkName,
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        costUsd: 0,
        isLive: card.isLive || false,
        templateSource: template.id,
      },
    };
    console.log(`[templateToCanvasCards] Card ${card.type}:`, {
      layout: canvasCard.layout,
      configNetworkId: canvasCard.config.networkId,
      configOrgId: canvasCard.config.orgId,
    });
    return canvasCard;
  });

  return cards;
}

/**
 * Category display info
 */
export const CATEGORY_INFO: Record<TemplateCategory, { label: string; icon: string; color: string }> = {
  troubleshooting: { label: 'Troubleshooting', icon: 'Wrench', color: 'text-amber-500' },
  monitoring: { label: 'Monitoring', icon: 'Activity', color: 'text-cyan-500' },
  security: { label: 'Security', icon: 'Shield', color: 'text-red-500' },
  wireless: { label: 'Wireless', icon: 'Wifi', color: 'text-purple-500' },
  analysis: { label: 'Analysis', icon: 'BarChart3', color: 'text-green-500' },
  overview: { label: 'Overview', icon: 'LayoutDashboard', color: 'text-blue-500' },
};

// =============================================================================
// Query-Based Template Suggestion
// =============================================================================

/**
 * Keyword patterns for template matching
 * Keywords have weights: primary keywords (3 points), secondary (1 point)
 */
const TEMPLATE_KEYWORDS: Record<string, { primary: string[]; secondary: string[] }> = {
  'wireless-health': {
    primary: ['wireless', 'wifi', 'wi-fi', 'wlan'],
    secondary: ['rf', 'ssid', 'channel', 'access point', 'ap', 'radio', 'signal'],
  },
  'wireless-troubleshoot': {
    primary: ['wireless issue', 'wifi problem', 'wifi trouble'],
    secondary: ['signal', 'interference', 'roaming', 'disconnect'],
  },
  'security-overview': {
    primary: ['security', 'threat', 'attack'],
    secondary: ['malware', 'intrusion', 'compliance', 'breach'],
  },
  'firewall-analysis': {
    primary: ['firewall'],
    secondary: ['block', 'rule', 'ids', 'ips', 'intrusion detection'],
  },
  'incident-analysis': {
    primary: ['incident', 'outage'],
    secondary: ['alert', 'problem', 'issue', 'down'],
  },
  'performance-debug': {
    primary: ['performance', 'latency', 'slow'],
    secondary: ['bandwidth', 'speed', 'packet loss', 'delay'],
  },
  'connectivity-troubleshoot': {
    primary: ['connectivity', 'can\'t connect', 'cannot connect'],
    secondary: ['connection', 'client', 'disconnect'],
  },
  'network-overview': {
    primary: ['overview', 'dashboard', 'status'],
    secondary: ['summary', 'health', 'network'],
  },
  'infrastructure-health': {
    primary: ['infrastructure', 'device health'],
    secondary: ['cpu', 'memory', 'uptime'],
  },
  'traffic-analytics': {
    primary: ['traffic', 'analytics'],
    secondary: ['usage', 'application', 'top talkers', 'bandwidth'],
  },
  'splunk-analysis': {
    primary: ['splunk', 'logs'],
    secondary: ['events', 'search', 'spl', 'log'],
  },
  'switch-infrastructure': {
    primary: ['switch', 'switches'],
    secondary: ['port', 'vlan', 'poe', 'spanning tree'],
  },
  'alert-management': {
    primary: ['alerts', 'alert management'],
    secondary: ['notification', 'mttr', 'correlation'],
  },
};

/**
 * Suggest the most relevant template based on a user query
 *
 * @param query - User's natural language query
 * @returns Template suggestion with confidence score, or null if no match
 */
export function suggestTemplateForQuery(query: string): {
  template: CanvasTemplate;
  confidence: number;
  matchedKeywords: string[];
} | null {
  const lowerQuery = query.toLowerCase();
  const results: Array<{
    templateId: string;
    score: number;
    hasPrimaryMatch: boolean;
    matchedKeywords: string[];
  }> = [];

  // Score each template based on keyword matches
  for (const [templateId, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
    const matchedKeywords: string[] = [];
    let score = 0;
    let hasPrimaryMatch = false;

    // Check primary keywords (3 points each)
    for (const keyword of keywords.primary) {
      if (lowerQuery.includes(keyword)) {
        matchedKeywords.push(keyword);
        score += 3;
        hasPrimaryMatch = true;
      }
    }

    // Check secondary keywords (1 point each)
    for (const keyword of keywords.secondary) {
      if (lowerQuery.includes(keyword)) {
        matchedKeywords.push(keyword);
        score += 1;
      }
    }

    // Also check template name and tags
    const template = getTemplateById(templateId);
    if (template) {
      if (lowerQuery.includes(template.name.toLowerCase())) {
        score += 3;
        hasPrimaryMatch = true;
        matchedKeywords.push(template.name);
      }
      for (const tag of template.tags) {
        if (lowerQuery.includes(tag.toLowerCase())) {
          score += 1;
          if (!matchedKeywords.includes(tag)) {
            matchedKeywords.push(tag);
          }
        }
      }
    }

    if (score > 0) {
      results.push({ templateId, score, hasPrimaryMatch, matchedKeywords });
    }
  }

  if (results.length === 0) {
    return null;
  }

  // Sort by: primary match first, then by score descending
  results.sort((a, b) => {
    if (a.hasPrimaryMatch !== b.hasPrimaryMatch) {
      return b.hasPrimaryMatch ? 1 : -1;
    }
    return b.score - a.score;
  });

  const best = results[0];
  const template = getTemplateById(best.templateId);

  if (!template) {
    return null;
  }

  // Calculate confidence:
  // - Primary match = at least 0.5 confidence
  // - Score adds to it (max 0.5 more)
  const baseConfidence = best.hasPrimaryMatch ? 0.5 : 0.1;
  const scoreBonus = Math.min(best.score / 10, 0.5);
  const confidence = Math.min(baseConfidence + scoreBonus, 1);

  return {
    template,
    confidence,
    matchedKeywords: best.matchedKeywords,
  };
}

/**
 * Get template suggestion as a simple object for SSE events
 */
export function getTemplateSuggestionEvent(query: string, networkId?: string, orgId?: string): {
  type: 'template_suggestion';
  templateId: string;
  templateName: string;
  confidence: number;
  matchedKeywords: string[];
  context: { networkId?: string; orgId?: string };
} | null {
  const suggestion = suggestTemplateForQuery(query);
  if (!suggestion || suggestion.confidence < 0.2) {
    return null;
  }

  return {
    type: 'template_suggestion',
    templateId: suggestion.template.id,
    templateName: suggestion.template.name,
    confidence: suggestion.confidence,
    matchedKeywords: suggestion.matchedKeywords,
    context: { networkId, orgId },
  };
}

export default CANVAS_TEMPLATES;
