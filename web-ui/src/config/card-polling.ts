/**
 * Card Polling Configuration
 *
 * Maps card types to their API endpoints and required parameters.
 * Used by template cards to fetch initial data and poll for updates.
 */

export type CardDataRequirement = 'none' | 'orgId' | 'networkId' | 'both';

export interface CardPollingConfig {
  /** API endpoint pattern (e.g., '/api/cards/network-health/{networkId}/data') */
  endpoint: string;
  /** What context this card requires */
  requires: CardDataRequirement;
  /** Polling interval in ms (0 = no polling, just initial fetch) */
  pollingInterval: number;
  /** Human-readable message when context is missing */
  contextMessage?: string;
}

/**
 * Card type to polling configuration mapping
 */
export const CARD_POLLING_CONFIG: Record<string, CardPollingConfig> = {
  // =========================================================================
  // Health Cards
  // =========================================================================
  'network-health': {
    endpoint: '/api/cards/network-health/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view health data',
  },
  'device-status': {
    endpoint: '/api/cards/device-status/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 15000,
    contextMessage: 'Select a network to view device status',
  },
  'compliance-score': {
    endpoint: '/api/cards/compliance/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 60000,
    contextMessage: 'Select a network to view compliance',
  },

  // =========================================================================
  // Topology Cards
  // =========================================================================
  'topology': {
    endpoint: '/api/cards/topology/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view topology',
  },
  'vlan-distribution': {
    endpoint: '/api/cards/vlan/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 60000,
    contextMessage: 'Select a network to view VLANs',
  },
  'path-analysis': {
    endpoint: '/api/cards/path-analysis/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view path analysis',
  },

  // =========================================================================
  // Traffic Cards
  // =========================================================================
  'bandwidth-utilization': {
    endpoint: '/api/cards/traffic-flow/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 15000,
    contextMessage: 'Select a network to view bandwidth',
  },
  'traffic-composition': {
    endpoint: '/api/cards/traffic-flow/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view traffic',
  },
  'top-talkers': {
    endpoint: '/api/cards/traffic-flow/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view top talkers',
  },
  'application-usage': {
    endpoint: '/api/cards/traffic-flow/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view application usage',
  },
  'qos-statistics': {
    endpoint: '/api/cards/traffic-flow/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view QoS statistics',
  },

  // =========================================================================
  // Performance Cards (use org-level Meraki uplink loss/latency data)
  // =========================================================================
  'latency-monitor': {
    endpoint: '/api/cards/performance/default/data?org_id={orgId}',
    requires: 'orgId',
    pollingInterval: 15000,
    contextMessage: 'Select an organization to view latency data',
  },
  'packet-loss': {
    endpoint: '/api/cards/performance/default/data?org_id={orgId}',
    requires: 'orgId',
    pollingInterval: 15000,
    contextMessage: 'Select an organization to view packet loss data',
  },

  // =========================================================================
  // Alert Cards (work with org-level data)
  // =========================================================================
  'alert-summary': {
    endpoint: '/api/cards/alerts/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 10000,
    contextMessage: 'Select an organization to view alerts',
  },
  'alert-timeline': {
    endpoint: '/api/cards/alerts/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 10000,
    contextMessage: 'Select an organization to view alert timeline',
  },
  'alert-correlation': {
    endpoint: '/api/cards/alerts/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 30000,
    contextMessage: 'Select an organization to view correlations',
  },
  'mttr-metrics': {
    endpoint: '/api/cards/alerts/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 60000,
    contextMessage: 'Select an organization to view MTTR',
  },

  // =========================================================================
  // Incident Cards
  // =========================================================================
  'incident-tracker': {
    endpoint: '/api/cards/incidents/data',
    requires: 'none',
    pollingInterval: 15000,
  },

  // =========================================================================
  // Security Cards
  // =========================================================================
  'security-events': {
    endpoint: '/api/cards/security-events/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 15000,
    contextMessage: 'Select an organization to view security events',
  },
  'threat-map': {
    endpoint: '/api/cards/security-events/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 15000,
    contextMessage: 'Select an organization to view threat map',
  },
  'blocked-connections': {
    endpoint: '/api/cards/security-events/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 15000,
    contextMessage: 'Select an organization to view blocked connections',
  },
  'firewall-hits': {
    endpoint: '/api/cards/security-events/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 15000,
    contextMessage: 'Select an organization to view firewall data',
  },
  'intrusion-detection': {
    endpoint: '/api/cards/security-events/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 15000,
    contextMessage: 'Select an organization to view IDS data',
  },

  // =========================================================================
  // Wireless Cards
  // =========================================================================
  'rf-analysis': {
    endpoint: '/api/cards/wireless-overview/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view RF analysis',
  },
  'client-distribution': {
    endpoint: '/api/cards/clients/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view client distribution',
  },
  'ssid-client-breakdown': {
    endpoint: '/api/cards/wireless-overview/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view SSID breakdown',
  },
  'channel-utilization-heatmap': {
    endpoint: '/api/cards/wireless-overview/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view channel utilization',
  },
  'client-signal-strength': {
    endpoint: '/api/cards/wireless-overview/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view signal strength',
  },
  'roaming-events': {
    endpoint: '/api/cards/wireless-overview/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view roaming events',
  },
  'interference-monitor': {
    endpoint: '/api/cards/wireless-overview/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view interference',
  },

  // =========================================================================
  // Switch Cards
  // =========================================================================
  'port-utilization-heatmap': {
    endpoint: '/api/cards/device-status/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view port utilization',
  },
  'poe-budget': {
    endpoint: '/api/cards/device-status/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view PoE budget',
  },
  'spanning-tree-status': {
    endpoint: '/api/cards/device-status/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 60000,
    contextMessage: 'Select a network to view spanning tree',
  },
  'stack-status': {
    endpoint: '/api/cards/device-status/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view stack status',
  },
  'wan-failover': {
    endpoint: '/api/cards/wan-failover/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view WAN failover',
  },

  // =========================================================================
  // Infrastructure Cards
  // =========================================================================
  'cpu-memory-health': {
    endpoint: '/api/cards/resource-health/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view resource health',
  },
  'uptime-tracker': {
    endpoint: '/api/cards/device-status/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 60000,
    contextMessage: 'Select a network to view uptime',
  },
  'sla-compliance': {
    endpoint: '/api/cards/sla-metrics/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 60000,
    contextMessage: 'Select a network to view SLA compliance',
  },
  'device-table': {
    endpoint: '/api/cards/device-status/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view devices',
  },

  // =========================================================================
  // Splunk Cards (use Splunk insights data)
  // =========================================================================
  'splunk-search-results': {
    endpoint: '/api/cards/splunk-data/search-results/data',
    requires: 'none',
    pollingInterval: 60000, // Poll every 60s
    contextMessage: 'Splunk insights required - run insight generation',
  },
  'log-severity-breakdown': {
    endpoint: '/api/cards/splunk-data/log-severity/data',
    requires: 'none',
    pollingInterval: 60000, // Poll every 60s
    contextMessage: 'Splunk insights required - run insight generation',
  },
  'log-volume-trend': {
    endpoint: '/api/cards/splunk-data/log-volume/data',
    requires: 'none',
    pollingInterval: 60000, // Poll every 60s
    contextMessage: 'Splunk insights required - run insight generation',
  },
  'error-distribution': {
    endpoint: '/api/cards/splunk-data/error-distribution/data',
    requires: 'none',
    pollingInterval: 60000, // Poll every 60s
    contextMessage: 'Splunk insights required - run insight generation',
  },
  'event-correlation': {
    endpoint: '/api/cards/splunk-data/event-correlation/data',
    requires: 'none',
    pollingInterval: 60000, // Poll every 60s
    contextMessage: 'Splunk insights required - run insight generation',
  },

  // =========================================================================
  // Integration Cards
  // =========================================================================
  'integration-health': {
    endpoint: '/api/cards/integration-health/data',
    requires: 'none',
    pollingInterval: 60000,
  },

  // =========================================================================
  // Site-level Cards
  // =========================================================================
  'site-health': {
    endpoint: '/api/cards/site-health/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 30000,
    contextMessage: 'Select an organization to view site health',
  },

  // =========================================================================
  // Cost Tracking
  // =========================================================================
  'cost-tracking': {
    endpoint: '/api/cards/cost-tracking/{orgId}/data',
    requires: 'orgId',
    pollingInterval: 60000,
    contextMessage: 'Select an organization to view costs',
  },

  // =========================================================================
  // Client Timeline
  // =========================================================================
  'client-timeline': {
    endpoint: '/api/cards/clients/{networkId}/data',
    requires: 'networkId',
    pollingInterval: 30000,
    contextMessage: 'Select a network to view client timeline',
  },
};

/**
 * Get polling configuration for a card type
 */
export function getCardPollingConfig(cardType: string): CardPollingConfig | null {
  return CARD_POLLING_CONFIG[cardType] || null;
}

/**
 * Build the API URL for a card given its type and context
 */
export function buildCardDataUrl(
  cardType: string,
  context: { orgId?: string; networkId?: string; deviceSerial?: string },
  options?: { demoMode?: boolean }
): string | null {
  const config = CARD_POLLING_CONFIG[cardType];
  if (!config) return null;

  let url = config.endpoint;

  // Replace placeholders
  if (context.networkId) {
    url = url.replace('{networkId}', context.networkId);
  }
  if (context.orgId) {
    url = url.replace('{orgId}', context.orgId);
  }
  if (context.deviceSerial) {
    url = url.replace('{deviceSerial}', context.deviceSerial);
  }

  // Check if all required placeholders were replaced
  if (url.includes('{')) {
    return null; // Missing required parameter
  }

  // Add org_id as query parameter for network-level endpoints
  // This helps the backend know which Meraki credentials to use
  if (context.orgId && config.requires === 'networkId' && !url.includes('org_id=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}org_id=${encodeURIComponent(context.orgId)}`;
  }

  // Add network_id as query parameter when available
  // This is needed for endpoints like security-events that can optionally fetch
  // network-specific data (like firewall rules) when a network is selected
  if (context.networkId && !url.includes('{networkId}') && !url.includes('network_id=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}network_id=${encodeURIComponent(context.networkId)}`;
  }

  // Add demo_mode parameter to tell backend whether to generate fallback data
  if (options?.demoMode !== undefined) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}demo_mode=${options.demoMode}`;
  }

  return url;
}

/**
 * Check if a card has the required context to fetch data
 */
export function hasRequiredContext(
  cardType: string,
  context: { orgId?: string; networkId?: string }
): boolean {
  const config = CARD_POLLING_CONFIG[cardType];
  if (!config) return false;

  switch (config.requires) {
    case 'none':
      return true;
    case 'orgId':
      return !!context.orgId;
    case 'networkId':
      return !!context.networkId;
    case 'both':
      return !!context.orgId && !!context.networkId;
    default:
      return false;
  }
}

export default CARD_POLLING_CONFIG;
