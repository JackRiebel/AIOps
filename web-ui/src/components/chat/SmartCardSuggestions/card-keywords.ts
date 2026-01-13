/**
 * Card type keywords and matching utilities for SmartCardSuggestions
 */

/**
 * Keywords for each card type - helps match data/query context to specific cards
 */
export const CARD_TYPE_KEYWORDS: Record<string, string[]> = {
  // Wireless
  'rf-analysis': ['wireless', 'wifi', 'rf', 'access point', 'ap', 'signal'],
  'interference-monitor': ['interference', 'noise', 'channel', 'wireless issue'],
  'client-signal-strength': ['signal', 'client', 'connection', 'strength', 'rssi'],
  'roaming-events': ['roaming', 'handoff', 'disconnect', 'reconnect', 'sticky client'],
  'channel-utilization-heatmap': ['channel', 'utilization', 'congestion', 'heatmap'],
  'ssid-client-breakdown': ['ssid', 'network', 'client', 'distribution'],
  'client-distribution': ['client', 'distribution', 'connected', 'users'],
  // Network Health
  'network-health': ['health', 'status', 'overview', 'check'],
  'health-trend': ['trend', 'history', 'timeline', 'health'],
  'topology': ['topology', 'map', 'diagram', 'connection', 'layout'],
  'device-table': ['device', 'list', 'inventory', 'table'],
  // Alerts
  'alert-summary': ['alert', 'warning', 'critical', 'notification'],
  'alert-timeline': ['timeline', 'history', 'alert', 'event'],
  'alert-correlation': ['correlation', 'related', 'pattern', 'alert'],
  'incident-tracker': ['incident', 'issue', 'problem', 'outage'],
  // Performance
  'latency-monitor': ['latency', 'delay', 'response time', 'slow'],
  'bandwidth-utilization': ['bandwidth', 'throughput', 'usage', 'speed'],
  'packet-loss': ['packet loss', 'drops', 'errors', 'quality'],
  'path-analysis': ['path', 'trace', 'route', 'connectivity'],
  // Infrastructure
  'cpu-memory-health': ['cpu', 'memory', 'resource', 'utilization'],
  'uptime-tracker': ['uptime', 'availability', 'downtime'],
  'sla-compliance': ['sla', 'compliance', 'target', 'objective'],
  'wan-failover': ['wan', 'failover', 'backup', 'redundancy'],
  // Traffic
  'top-talkers': ['top talkers', 'bandwidth hog', 'heavy users', 'traffic'],
  'traffic-composition': ['traffic', 'application', 'protocol', 'breakdown'],
  'application-usage': ['application', 'app', 'usage', 'software'],
  'qos-statistics': ['qos', 'quality of service', 'priority', 'dscp'],
  // Security
  'security-events': ['security', 'threat', 'attack', 'malware', 'intrusion'],
  'threat-map': ['threat', 'geo', 'location', 'attack', 'origin'],
  'compliance-score': ['compliance', 'audit', 'policy', 'score'],
  'blocked-connections': ['blocked', 'firewall', 'denied', 'rule'],
  'firewall-hits': ['firewall', 'rule', 'hit', 'match'],
  'intrusion-detection': ['intrusion', 'ids', 'ips', 'detection'],
  // Switch
  'port-utilization-heatmap': ['port', 'switch', 'utilization', 'heatmap'],
  'vlan-distribution': ['vlan', 'segment', 'network', 'distribution'],
  'poe-budget': ['poe', 'power', 'budget', 'ethernet'],
  'spanning-tree-status': ['spanning tree', 'stp', 'loop', 'redundancy'],
  'stack-status': ['stack', 'member', 'switch'],
  // Splunk
  'splunk-search-results': ['splunk', 'search', 'query', 'log'],
  'log-severity-breakdown': ['severity', 'error', 'warning', 'log'],
  'log-volume-trend': ['log', 'volume', 'trend', 'count'],
  'error-distribution': ['error', 'distribution', 'type', 'breakdown'],
};

/**
 * Exclusive card groups - cards within a group are alternatives, not complements
 * If query matches one card strongly, other cards in same group get penalized
 */
export const EXCLUSIVE_CARD_GROUPS: string[][] = [
  // Wireless: client-focused vs infrastructure-focused
  ['client-signal-strength', 'client-distribution', 'roaming-events', 'ssid-client-breakdown'],
  ['interference-monitor', 'channel-utilization-heatmap', 'rf-analysis'],
  // Alerts: summary vs timeline
  ['alert-summary', 'alert-correlation'],
  ['alert-timeline', 'incident-tracker'],
  // Security: events vs map
  ['security-events', 'blocked-connections'],
  ['threat-map', 'intrusion-detection'],
];

/**
 * Specificity indicators - if query contains these, it's considered "specific"
 * and cards without keyword matches should be penalized
 */
export const SPECIFICITY_INDICATORS = [
  'client', 'signal', 'roaming', 'interference', 'channel',
  'latency', 'bandwidth', 'packet loss',
  'firewall', 'threat', 'intrusion',
  'port', 'vlan', 'poe',
  'splunk', 'log', 'error',
];

/**
 * Check if a query is specific (mentions particular topics)
 */
export function isSpecificQuery(query: string): boolean {
  const q = query.toLowerCase();
  return SPECIFICITY_INDICATORS.some(ind => q.includes(ind));
}

/**
 * Get the exclusive group for a card type (if any)
 */
export function getExclusiveGroup(cardType: string): string[] | undefined {
  return EXCLUSIVE_CARD_GROUPS.find(group => group.includes(cardType));
}

/**
 * Calculate keyword match score for a card type against a query
 */
export function calculateKeywordScore(cardType: string, query: string): number {
  const keywords = CARD_TYPE_KEYWORDS[cardType];
  if (!keywords) return 0;

  const q = query.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    if (q.includes(keyword)) {
      score += keyword.split(' ').length; // Multi-word matches score higher
    }
  }

  return score;
}
