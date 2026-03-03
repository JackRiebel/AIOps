/**
 * Card Suggestion Scoring Configuration
 *
 * Centralized scoring weights for the smart card suggestion system.
 * Tune these values to adjust which cards are suggested and when.
 */

// ============================================================================
// Template Scoring Weights
// ============================================================================

export const TEMPLATE_SCORING = {
  /** Points for matching template name in query */
  nameMatch: 50,

  /** Points per description word match (>3 chars) */
  descriptionWordMatch: 5,

  /** Points for matching a template tag */
  tagMatch: 20,

  /** Points for matching template category */
  categoryMatch: 10,

  /** Bonus for troubleshooting keywords with troubleshooting category */
  troubleshootingBonus: 25,

  /** Bonus when data contains matching device types (wireless/switch/security) */
  dataTypeMatch: 30,

  /** Penalty when template expects device types not present in data */
  missingDataTypeVeto: -100,
};

// ============================================================================
// Card Scoring Weights
// ============================================================================

export const CARD_SCORING = {
  /** Points per title word match (>2 chars) */
  titleWordMatch: 15,

  /** Points per keyword match */
  keywordMatch: 15,

  /** Penalty for unrelated cards in specific queries */
  unrelatedPenalty: -25,

  /** Penalty when query matches a different exclusive card group */
  exclusiveGroupPenalty: -30,

  /** Bonus when data contains relevant device/event types */
  dataPresenceBonus: 20,

  /** Penalty for wireless cards when no wireless APs in network */
  missingWirelessVeto: -50,

  /** Penalty for switch cards when no switches in network */
  missingSwitchVeto: -50,

  /** Small boost for live-capable cards when data is available */
  liveCardBonus: 5,
};

// ============================================================================
// Threshold Configuration
// ============================================================================

export const SCORE_THRESHOLDS = {
  /** Minimum template score to be considered (filter threshold) */
  minimumTemplateScore: 15,

  /** Maximum number of templates to consider */
  maxTemplates: 2,

  /** Required card score for specific queries */
  specificQueryCardThreshold: 20,

  /** Required card score when template score > 60 */
  strongTemplateCardThreshold: 10,

  /** Required card score when template score > 40 */
  mediumTemplateCardThreshold: 15,

  /** Required card score for weaker template matches */
  weakTemplateCardThreshold: 25,

  /** Maximum template-derived suggestions per query */
  maxTemplateSuggestions: 2,

  /** Maximum rule-based suggestions when no template matches */
  maxRuleSuggestions: 2,

  /** Minimum rule priority to consider when no template matches */
  minimumRulePriority: 95,

  /** Final maximum suggestions to show user */
  maxFinalSuggestions: 2,
};

// ============================================================================
// Complementary Card Boost
// ============================================================================

export const COMPLEMENTARY_SCORING = {
  /** Priority boost for cards that complement existing canvas cards */
  complementaryBoost: 15,
};

// ============================================================================
// History Penalty (imported from suggestion-history.ts)
// ============================================================================
// Note: History penalties are configured in suggestion-history.ts:
// - PENALTY_SUGGESTED: 35 (base penalty for recently suggested)
// - PENALTY_ADDED: 50 (higher penalty for added cards)
// - PENALTY_SAME_QUERY: 100 (very high penalty for same query)
// - HISTORY_DECAY_MS: 5 minutes (penalty decay starts)
// - HISTORY_EXPIRE_MS: 15 minutes (entries removed)

// ============================================================================
// Card Limits
// ============================================================================

export const CARD_LIMITS = {
  /** Maximum cards to auto-add per message */
  maxAutoAddPerMessage: 1,
};

// ============================================================================
// Troubleshooting Keywords
// ============================================================================

export const TROUBLESHOOTING_PATTERNS = [
  'troubleshoot',
  'debug',
  'issue',
  'problem',
  'fix',
  'diagnose',
  'investigate',
  'failing',
  'error',
  'not working',
];

// ============================================================================
// Specificity Indicators (queries with these are considered "specific")
// ============================================================================

export const SPECIFICITY_INDICATORS_CONFIG = {
  patterns: [
    // WiFi/Wireless specific
    'wifi', 'wireless', 'ssid', 'ap', 'access point', 'channel', 'rf', 'interference',
    'signal', 'roaming', 'client signal', 'snr', 'rssi', 'mrr', 'mr', 'cw',

    // Switching specific
    'switch', 'port', 'vlan', 'poe', 'spanning tree', 'stp', 'stack', 'trunk',
    'ms-', 'ms ', 'catalyst',

    // Security specific
    'security', 'threat', 'firewall', 'ids', 'intrusion', 'malware', 'blocked',
    'mx', 'compliance',

    // Alerting specific
    'alert', 'incident', 'mttr', 'correlation',

    // Performance specific
    'latency', 'packet loss', 'bandwidth', 'throughput', 'jitter', 'qos',

    // Topology/Path specific
    'topology', 'path', 'route', 'trace', 'hop',

    // Splunk specific
    'splunk', 'log', 'siem', 'event', 'search',

    // Device specific
    'device', 'serial', 'uptime', 'cpu', 'memory', 'interface',

    // Traffic specific
    'traffic', 'top talker', 'application', 'flow',
  ],
};

// ============================================================================
// Similar Card Groups (prevent suggesting similar cards)
// ============================================================================

export const SIMILAR_CARD_GROUPS = {
  network: ['network-health', 'health-trend', 'device-table'],
  connectivity: ['path-analysis', 'topology'],
  alerts: ['alert-summary', 'alert-correlation'],
  performance: ['latency-monitor', 'packet-loss', 'bandwidth-utilization'],
  infrastructure: ['interface-status', 'switch-ports', 'uplink-status'],
  wan: ['wan-failover', 'uplink-status', 'sd-wan-health'],
  splunk: ['log-volume-trend', 'splunk-event-summary', 'event-correlation'],
  device: ['device-detail', 'device-comparison'],
  wireless: ['rf-analysis', 'channel-utilization', 'rf-heatmap'],
  security: ['security-events', 'threat-analysis', 'firewall-events', 'compliance-status'],
};

// ============================================================================
// Complementary Card Mappings
// ============================================================================

export const COMPLEMENTARY_CARDS: Record<string, string[]> = {
  'network-health': ['device-status', 'alert-summary', 'topology'],
  'topology': ['device-status', 'path-analysis', 'vlan-distribution'],
  'rf-analysis': ['interference-monitor', 'ssid-client-breakdown', 'channel-utilization-heatmap'],
  'security-events': ['threat-map', 'blocked-connections', 'firewall-hits'],
  'device-status': ['cpu-memory-health', 'uptime-tracker', 'port-utilization-heatmap'],
  'alert-summary': ['alert-timeline', 'alert-correlation', 'incident-tracker'],
  'bandwidth-utilization': ['traffic-composition', 'top-talkers', 'qos-statistics'],
  'splunk-search-results': ['log-volume-trend', 'log-severity-breakdown', 'error-distribution'],
  'threat-map': ['security-events', 'intrusion-detection', 'blocked-connections'],
  'client-distribution': ['client-timeline', 'ssid-client-breakdown', 'roaming-events'],
  'poe-budget': ['device-status', 'port-utilization-heatmap', 'interface-status'],
  'vlan-distribution': ['topology', 'device-status', 'traffic-composition'],
};
