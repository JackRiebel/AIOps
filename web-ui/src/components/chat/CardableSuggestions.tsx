'use client';

import { memo, useCallback, useState, useMemo } from 'react';
import { PlusCircle, Table, Check, Layers, Wifi, Shield, Server, Activity, AlertTriangle, Network } from 'lucide-react';
import { CardAgent } from '@/services/card-agent';
import type { CanvasCard, CanvasCardType } from '@/types/session';

/**
 * CardableSuggestions - Shows "Add to Canvas" buttons for tool results
 *
 * Supports two data formats:
 * 1. tool_data array: [{tool: "meraki_list_vlans", data: [...]}, ...]
 *    - Shows one button per tool with valid cardable data
 * 2. Legacy single array/object: Backwards compatible with old format
 *
 * Each button creates a separate card on the canvas with:
 * - Title derived from tool name (e.g., "VLANs", "Firewall Rules")
 * - Source query context for follow-up questions
 */

// ============================================================================
// Types
// ============================================================================

/** Tool data item from backend (with live topic info) */
interface ToolDataItem {
  tool: string;
  data: unknown;
  data_type?: string;      // Semantic type: "vlans", "firewall_rules", etc.
  live_topic?: string;     // WebSocket topic for live updates
  network_id?: string;     // Network context
  org_id?: string;         // Organization context
}

/** Cardable tool info after validation */
interface CardableTool {
  tool: string;
  title: string;
  data: unknown[];
  count: number;
  dataType?: string;       // Semantic type for card labeling
  liveTopic?: string;      // WebSocket topic for live updates
  networkId?: string;      // Network context
  orgId?: string;          // Organization context
  suggestedCardType?: CanvasCardType;  // Suggested visualization type
}

/** Extracted data array with metadata */
interface ExtractedDataItem {
  key: string;              // "vlans", "ssids", "devices"
  data: unknown[];          // The actual array
  dataType: string;         // Semantic type for card generation
  title: string;            // "VLANs (3)"
  cardType: CanvasCardType; // Suggested card type
}

/**
 * Check if a value looks like a Meraki network ID (L_ or N_ prefix)
 */
function isMerakiNetworkId(val: unknown): val is string {
  return typeof val === 'string' && (val.startsWith('L_') || val.startsWith('N_'));
}

/**
 * Extract networkId from data object
 * Tries multiple locations where networkId might be found
 */
function extractNetworkIdFromData(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const obj = data as Record<string, unknown>;

  // Direct id field with Meraki pattern (L_ or N_ prefix)
  if (isMerakiNetworkId(obj.id)) return obj.id;

  // Explicit networkId fields
  if (typeof obj.networkId === 'string') return obj.networkId;
  if (typeof obj.network_id === 'string') return obj.network_id;

  // Nested in network object
  if (obj.network && typeof obj.network === 'object') {
    const network = obj.network as Record<string, unknown>;
    if (isMerakiNetworkId(network.id)) return network.id;
    if (typeof network.networkId === 'string') return network.networkId;
  }

  // From array items
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    if (isMerakiNetworkId(first?.id)) return first.id;
    if (typeof first?.networkId === 'string') return first.networkId;
    if (typeof first?.network_id === 'string') return first.network_id;
  }

  return undefined;
}

// ============================================================================
// Data Type to Card Type Mapping
// ============================================================================

/**
 * Maps data types/keys to card configurations
 * Used for smart card type inference and title generation
 */
const DATA_TYPE_CARD_MAP: Record<string, { cardType: CanvasCardType; title: string; icon: 'table' | 'network' | 'chart' | 'alert' | 'wireless' | 'shield' }> = {
  // Network Configuration
  vlans: { cardType: 'device-table', title: 'VLANs', icon: 'network' },
  ssids: { cardType: 'device-table', title: 'SSIDs', icon: 'wireless' },
  firewall_rules: { cardType: 'device-table', title: 'Firewall Rules', icon: 'shield' },
  l3_firewall_rules: { cardType: 'device-table', title: 'L3 Firewall Rules', icon: 'shield' },
  l7_firewall_rules: { cardType: 'device-table', title: 'L7 Firewall Rules', icon: 'shield' },
  switch_ports: { cardType: 'device-table', title: 'Switch Ports', icon: 'network' },
  ports: { cardType: 'device-table', title: 'Ports', icon: 'network' },

  // Devices & Inventory
  devices: { cardType: 'device-table', title: 'Devices', icon: 'table' },
  clients: { cardType: 'device-table', title: 'Clients', icon: 'table' },
  networks: { cardType: 'device-table', title: 'Networks', icon: 'network' },
  organizations: { cardType: 'device-table', title: 'Organizations', icon: 'table' },

  // Wireless & RF
  rf_profiles: { cardType: 'performance-chart', title: 'RF Profiles', icon: 'chart' },
  channel_utilization: { cardType: 'performance-chart', title: 'Channel Utilization', icon: 'chart' },
  wireless_status: { cardType: 'network-health', title: 'Wireless Status', icon: 'wireless' },

  // Health & Metrics
  health: { cardType: 'network-health', title: 'Health', icon: 'chart' },
  health_scores: { cardType: 'network-health', title: 'Health Scores', icon: 'chart' },
  uplink_status: { cardType: 'network-health', title: 'Uplink Status', icon: 'network' },
  uplinks: { cardType: 'network-health', title: 'Uplinks', icon: 'network' },

  // Topology
  topology: { cardType: 'topology', title: 'Network Topology', icon: 'network' },

  // Alerts & Events
  alerts: { cardType: 'alert-summary', title: 'Alerts', icon: 'alert' },
  events: { cardType: 'alert-summary', title: 'Events', icon: 'alert' },
  incidents: { cardType: 'alert-summary', title: 'Incidents', icon: 'alert' },

  // Diagnostics
  ping_results: { cardType: 'action', title: 'Ping Results', icon: 'chart' },
  traceroute_results: { cardType: 'action', title: 'Traceroute', icon: 'network' },

  // New card types (Phase 2)
  rf_analysis: { cardType: 'rf-analysis', title: 'RF Analysis', icon: 'wireless' },
  rf_summary: { cardType: 'rf-analysis', title: 'RF Summary', icon: 'wireless' },
  access_points: { cardType: 'rf-analysis', title: 'Access Points RF', icon: 'wireless' },
  health_trend: { cardType: 'health-trend', title: 'Health Trend', icon: 'chart' },
  health_history: { cardType: 'health-trend', title: 'Health History', icon: 'chart' },
  comparison: { cardType: 'comparison', title: 'Comparison', icon: 'chart' },
  config_diff: { cardType: 'comparison', title: 'Config Changes', icon: 'chart' },
  path_analysis: { cardType: 'path-analysis', title: 'Path Analysis', icon: 'network' },
  path_trace: { cardType: 'path-analysis', title: 'Path Trace', icon: 'network' },
  connectivity: { cardType: 'path-analysis', title: 'Connectivity', icon: 'network' },
};

/**
 * Card type priority scoring for relevance ranking
 * Higher score = more useful/comprehensive card, shown first
 */
const CARD_TYPE_PRIORITY: Record<string, number> = {
  'incident-detail': 100,   // Highest priority for incident analysis
  'network-health': 98,     // Network health and status
  'topology': 95,           // Visual network map
  'rf-analysis': 90,        // Wireless analysis
  'health-trend': 85,       // Performance trends
  'incidents': 80,          // Active incidents
  'alert-summary': 75,      // Alerts are important
  'compliance': 70,         // Security compliance
  'performance-chart': 60,  // Metrics
  'device-table': 50,       // Device inventory
  'table': 40,              // Generic table
  'action': 30,             // Action results (ping, traceroute)
};

// Maximum number of card suggestions to show
const MAX_CARD_SUGGESTIONS = 3;

// Card types prioritized for incident analysis queries
const INCIDENT_CARD_TYPES = new Set([
  'incident-detail',
  'network-health',
  'rf-analysis',
  'health-trend',
]);

// ============================================================================
// Smart Card Detection
// ============================================================================

// Metadata field names that should NOT be treated as cardable data
const METADATA_FIELD_NAMES = new Set([
  'capabilities',
  'example_queries',
  'suggestions',
  'possible_entity',
  'type',
  'message',
  'original_query',
  // Pagination/count metadata - these are NOT entity data
  'count',
  'total',
  'page',
  'perPage',
  'per_page',
  'limit',
  'offset',
  'pageSize',
  'page_size',
]);

// Response types that should NOT generate cards
const NON_CARDABLE_RESPONSE_TYPES = new Set([
  'greeting',
  'help',
  'clarification_request',
  'acknowledgment',
]);

/**
 * Type guard for tool_data array format: [{tool, data}, ...]
 */
function isToolDataArray(data: unknown): data is ToolDataItem[] {
  return Array.isArray(data) && data.length > 0 &&
    typeof data[0] === 'object' && data[0] !== null &&
    'tool' in data[0] && 'data' in data[0];
}

/**
 * Convert tool name to readable title
 * meraki_list_vlans → "VLANs"
 * meraki_get_l3_firewall_rules → "L3 Firewall Rules"
 */
function formatToolName(toolName: string): string {
  const parts = toolName.split('_');
  // Remove platform prefix (meraki_, catalyst_, etc.)
  const withoutPrefix = parts.slice(1);
  // Remove action verbs
  const withoutVerb = withoutPrefix.filter(p =>
    !['list', 'get', 'show', 'fetch', 'read', 'appliance', 'network', 'device'].includes(p.toLowerCase())
  );

  if (withoutVerb.length === 0) {
    // Fallback: use last meaningful part
    return withoutPrefix[withoutPrefix.length - 1]?.charAt(0).toUpperCase() +
           withoutPrefix[withoutPrefix.length - 1]?.slice(1) || 'Data';
  }

  return withoutVerb
    .map(p => p.toUpperCase() === p ? p : p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * Convert object key to readable title
 * devices → "Devices"
 * firewall_rules → "Firewall Rules"
 * vlanConfigs → "VLAN Configs"
 */
function formatKeyAsTitle(key: string): string {
  // Handle snake_case
  if (key.includes('_')) {
    return key.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  // Handle camelCase
  const withSpaces = key.replace(/([a-z])([A-Z])/g, '$1 $2');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

/**
 * Extract data array from tool result (handles nested structures)
 * Returns the FIRST matching array (legacy behavior)
 */
function extractDataArray(data: unknown): unknown[] | null {
  if (Array.isArray(data) && data.length > 0) {
    return data;
  }
  if (typeof data === 'object' && data !== null) {
    // Check for common nested array patterns
    const obj = data as Record<string, unknown>;
    for (const key of ['results', 'data', 'items', 'devices', 'rules', 'vlans']) {
      if (Array.isArray(obj[key]) && obj[key].length > 0) {
        return obj[key];
      }
    }
    // Check any array property
    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && value.length > 0) {
        return value;
      }
    }
  }
  return null;
}

/**
 * Extract ALL data arrays from a nested object structure
 * Returns multiple arrays with their keys for multi-card generation
 */
function extractAllDataArrays(data: unknown): ExtractedDataItem[] {
  const results: ExtractedDataItem[] = [];

  // If it's already an array, return it as a single item
  if (Array.isArray(data) && data.length > 0 && isActualDataArray(data)) {
    const mapping = DATA_TYPE_CARD_MAP['data'] || { cardType: 'device-table' as CanvasCardType, title: 'Data', icon: 'table' };
    results.push({
      key: 'data',
      data: data,
      dataType: 'data',
      title: mapping.title,
      cardType: mapping.cardType,
    });
    return results;
  }

  // If it's an object, check all properties for arrays
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      // Skip metadata fields
      if (METADATA_FIELD_NAMES.has(key)) continue;

      if (Array.isArray(value) && value.length > 0 && isActualDataArray(value, key)) {
        // Normalize key for lookup (snake_case)
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
        const mapping = DATA_TYPE_CARD_MAP[normalizedKey] || {
          cardType: 'device-table' as CanvasCardType,
          title: formatKeyAsTitle(key),
          icon: 'table',
        };

        results.push({
          key,
          data: value,
          dataType: normalizedKey,
          title: mapping.title,
          cardType: mapping.cardType,
        });
      }
    }
  }

  return results;
}

/**
 * Get icon component for a data type
 */
function getIconForDataType(dataType?: string): React.ReactNode {
  if (!dataType) return <Table className="w-3.5 h-3.5" />;

  const normalizedType = dataType.toLowerCase();
  const mapping = DATA_TYPE_CARD_MAP[normalizedType];

  if (!mapping) return <Table className="w-3.5 h-3.5" />;

  switch (mapping.icon) {
    case 'wireless':
      return <Wifi className="w-3.5 h-3.5" />;
    case 'shield':
      return <Shield className="w-3.5 h-3.5" />;
    case 'network':
      return <Network className="w-3.5 h-3.5" />;
    case 'chart':
      return <Activity className="w-3.5 h-3.5" />;
    case 'alert':
      return <AlertTriangle className="w-3.5 h-3.5" />;
    default:
      return <Table className="w-3.5 h-3.5" />;
  }
}

/**
 * Check if an array looks like actual data (objects with entity properties)
 * vs metadata (simple strings, suggestion lists, etc.)
 */
function isActualDataArray(arr: unknown[], fieldName?: string): boolean {
  if (fieldName && METADATA_FIELD_NAMES.has(fieldName)) {
    return false;
  }

  if (arr.length === 0) return false;

  const firstItem = arr[0];

  // Array of strings/numbers - not cardable
  if (typeof firstItem === 'string' || typeof firstItem === 'number') {
    return false;
  }

  // Array of objects - check for entity-like properties
  if (typeof firstItem === 'object' && firstItem !== null) {
    const keys = Object.keys(firstItem);
    if (keys.length < 1) return false;

    // Expanded list of entity indicators - covers network equipment, configs, events, actions
    const entityIndicators = [
      // Core identifiers
      'id', 'serial', 'name', 'status', 'mac', 'ip', 'networkid', 'hostname', 'model', 'device',
      'device_id', 'deviceid', 'network_id', 'org_id', 'organization_id', 'site_id',
      'network_name', 'device_name', 'org_name', 'site_name',
      // Network properties
      'address', 'url', 'firmware', 'version', 'type', 'category', 'description',
      'ssid', 'vlan', 'port', 'interface', 'serial_number', 'serialnumber',
      'wan_ip', 'lan_ip', 'public_ip', 'local_ip', 'publicip', 'lanip',
      // Timestamps
      'created', 'updated', 'timestamp', 'last_seen', 'lastseen', 'createdat', 'updatedat',
      // Metrics and status (note: 'count' and 'total' removed - they're metadata, not entity properties)
      'health', 'score', 'clients', 'usage',
      // Firewall and policies
      'policy', 'rule', 'rules', 'comment', 'protocol', 'action', 'destport', 'srcport',
      // Network equipment and connectivity
      'uplink', 'downlink', 'bandwidth', 'throughput', 'latency', 'packet_loss', 'jitter',
      'gateway', 'subnet', 'cidr', 'netmask', 'dns', 'dhcp',
      // Configuration items
      'config', 'setting', 'acl', 'route', 'vlan_id', 'vlanid', 'tag', 'tags',
      // Events and logs
      'event', 'log', 'alert', 'incident', 'message', 'severity', 'priority',
      // Action and diagnostic results
      'result', 'output', 'response', 'reply', 'success', 'failure', 'error',
      'ping', 'traceroute', 'hop', 'rtt', 'ttl', 'loss', 'reachable', 'target',
      // Client and user data
      'client', 'user', 'username', 'email', 'manufacturer', 'os', 'vendor',
    ];

    const hasEntityProperty = keys.some(k => {
      const lower = k.toLowerCase();
      if (entityIndicators.includes(lower)) return true;
      // Suffix pattern matching
      if (lower.endsWith('_id') || lower.endsWith('id')) return true;
      if (lower.endsWith('_name') || lower.endsWith('name')) return true;
      if (lower.endsWith('_ip') || lower.endsWith('ip')) return true;
      if (lower.endsWith('_mac') || lower.endsWith('mac')) return true;
      if (lower.endsWith('serial') || lower.endsWith('_serial')) return true;
      if (lower.endsWith('_url') || lower.endsWith('url')) return true;
      if (lower.endsWith('_status') || lower.endsWith('status')) return true;
      return false;
    });

    return hasEntityProperty;
  }

  return false;
}

// ============================================================================
// Types for Props
// ============================================================================

export interface CardableSuggestionsProps {
  /** AI response content (text) - unused now, kept for compatibility */
  responseContent: string;
  /** Structured data from the AI response - can be tool_data array or legacy format */
  structuredData?: unknown;
  /** Handler when user clicks to add a card */
  onAddCard: (card: CanvasCard) => void;
  /** Existing cards (to calculate layout position and track removal) */
  existingCards?: CanvasCard[];
  /** Source query that generated this data (for card context) */
  sourceQuery?: string;
  /** Source message ID (for linking card to message) */
  sourceMessageId?: string;
  /** Tool name that generated this data (legacy - used for single-tool responses) */
  toolName?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Main CardableSuggestions Component
// ============================================================================

export const CardableSuggestions = memo(({
  structuredData,
  onAddCard,
  existingCards = [],
  sourceQuery,
  sourceMessageId,
  className = '',
}: CardableSuggestionsProps) => {
  // Track which tools have been added to canvas
  const [addedTools, setAddedTools] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState<string | null>(null);

  // Get all cardable tools from structured data
  const cardableTools = useMemo((): CardableTool[] => {
    if (!structuredData) {
      return [];
    }

    // Check response type - don't generate cards for greetings/help/etc.
    if (
      typeof structuredData === 'object' &&
      structuredData !== null &&
      !Array.isArray(structuredData) &&
      'type' in structuredData &&
      typeof (structuredData as Record<string, unknown>).type === 'string' &&
      NON_CARDABLE_RESPONSE_TYPES.has((structuredData as Record<string, unknown>).type as string)
    ) {
      return [];
    }

    // Handle tool_data array format: [{tool, data, data_type, live_topic, ...}, ...]
    if (isToolDataArray(structuredData)) {
      const results: CardableTool[] = [];

      for (const td of structuredData) {
        // First try to extract ALL arrays from the tool data (for multi-card generation)
        const allArrays = extractAllDataArrays(td.data);

        if (allArrays.length > 1) {
          // Multiple arrays found - create separate CardableTools for each
          for (const extracted of allArrays) {
            const uniqueKey = `${td.tool}:${extracted.key}`;
            const extractedNetworkId = td.network_id || extractNetworkIdFromData(td.data);
            results.push({
              tool: uniqueKey,
              title: extracted.title,
              data: extracted.data,
              count: extracted.data.length,
              dataType: extracted.dataType,
              liveTopic: td.live_topic ? `${td.live_topic}:${extracted.dataType}` : undefined,
              networkId: extractedNetworkId,
              orgId: td.org_id,
              suggestedCardType: extracted.cardType,
            });
          }
        } else {
          // Single array or direct array - use legacy behavior
          const dataArray = extractDataArray(td.data);
          if (dataArray && isActualDataArray(dataArray)) {
            // Use data_type from backend for title if available
            const mapping = td.data_type ? DATA_TYPE_CARD_MAP[td.data_type] : undefined;
            const extractedNetworkId = td.network_id || extractNetworkIdFromData(td.data);
            results.push({
              tool: td.tool,
              title: mapping?.title || formatToolName(td.tool),
              data: dataArray,
              count: dataArray.length,
              dataType: td.data_type,
              liveTopic: td.live_topic,
              networkId: extractedNetworkId,
              orgId: td.org_id,
              suggestedCardType: mapping?.cardType,
            });
          } else if (td.data && typeof td.data === 'object' && !Array.isArray(td.data)) {
            // Handle single object responses (e.g., meraki_networks_get returns a single network)
            const singleObj = td.data as Record<string, unknown>;
            const objNetworkId = td.network_id || extractNetworkIdFromData(td.data);

            // Check if this is a network object (has id starting with L_ or N_)
            const isNetworkObject = isMerakiNetworkId(singleObj.id);

            if (isNetworkObject || td.data_type === 'networks') {
              // Create network-health card for single network
              results.push({
                tool: td.tool,
                title: (singleObj.name as string) || 'Network Health',
                data: [singleObj],  // Wrap in array for type compatibility
                count: 1,
                dataType: 'network',
                liveTopic: td.live_topic,
                networkId: objNetworkId,
                orgId: td.org_id,
                suggestedCardType: 'network-health',
              });
            } else {
              // Generic single object - wrap in array for device-table
              const mapping = td.data_type ? DATA_TYPE_CARD_MAP[td.data_type] : undefined;
              results.push({
                tool: td.tool,
                title: mapping?.title || formatToolName(td.tool),
                data: [singleObj],
                count: 1,
                dataType: td.data_type,
                liveTopic: td.live_topic,
                networkId: objNetworkId,
                orgId: td.org_id,
                suggestedCardType: mapping?.cardType || 'device-table',
              });
            }
          }
        }
      }
      return results;
    }

    // Legacy: single data array
    if (Array.isArray(structuredData) && structuredData.length > 0) {
      if (isActualDataArray(structuredData)) {
        return [{
          tool: 'data',
          title: 'Data',
          data: structuredData,
          count: structuredData.length,
        }];
      }
      return [];
    }

    // Legacy: object with array properties - collect ALL cardable arrays (not just first)
    if (typeof structuredData === 'object' && structuredData !== null) {
      const results: CardableTool[] = [];
      const obj = structuredData as Record<string, unknown>;

      // Check each property for cardable arrays
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value) && value.length > 0 && isActualDataArray(value, key)) {
          results.push({
            tool: key,
            title: formatKeyAsTitle(key),
            data: value,
            count: value.length,
          });
        }
      }

      // If we found cardable arrays, return them
      if (results.length > 0) {
        return results;
      }

      // Handle single object with meaningful data (not just {success: true})
      const meaningfulKeys = Object.keys(obj).filter(k =>
        !['success', 'error', 'message', 'type'].includes(k.toLowerCase())
      );
      if (meaningfulKeys.length > 0 && meaningfulKeys.some(k => {
        const val = obj[k];
        return val !== null && val !== undefined && typeof val !== 'boolean';
      })) {
        // Check if it looks like entity data
        if (isActualDataArray([obj])) {
          return [{
            tool: 'result',
            title: 'Result',
            data: [obj],  // Wrap single object in array for consistent handling
            count: 1,
          }];
        }
      }
    }

    return [];
  }, [structuredData]);

  // Detect if this is an incident analysis query
  const isIncidentQuery = useMemo(() => {
    if (!sourceQuery) return false;
    const q = sourceQuery.toLowerCase();
    return q.includes('incident #') ||
           q.includes('incident#') ||
           q.includes('analyze incident') ||
           q.includes('incident analysis');
  }, [sourceQuery]);

  // Filter, deduplicate, score, and limit card suggestions
  const filteredCardableTools = useMemo((): CardableTool[] => {
    // Step 1: Filter out cards with empty or useless data
    const withValidData = cardableTools.filter(tool => {
      // Check if data exists and has content
      if (!tool.data) return false;
      if (Array.isArray(tool.data) && tool.data.length === 0) return false;
      if (typeof tool.data === 'object' && Object.keys(tool.data).length === 0) return false;
      if (tool.count === 0) return false;
      return true;
    });

    // Step 2: Build deduplication sets
    const networksWithOverview = new Set<string>();
    const seenCardTypes = new Set<string>();
    const seenNetworkCardCombos = new Set<string>();

    for (const tool of withValidData) {
      if (tool.suggestedCardType === 'network-health' && tool.networkId) {
        networksWithOverview.add(tool.networkId);
      }
    }

    // Step 3: Filter and deduplicate
    let deduplicated = withValidData.filter(tool => {
      const cardType = tool.suggestedCardType || 'table';
      const networkId = tool.networkId || 'global';
      const comboKey = `${cardType}:${networkId}`;

      // Skip duplicate card type + network combinations
      if (seenNetworkCardCombos.has(comboKey)) {
        return false;
      }
      seenNetworkCardCombos.add(comboKey);

      // Skip device-table if network-health exists for same network
      if (cardType === 'device-table' && tool.networkId && networksWithOverview.has(tool.networkId)) {
        return false;
      }

      // Skip generic tables if we already have a more specific card type
      if (cardType === 'table' && seenCardTypes.size >= 2) {
        return false;
      }

      seenCardTypes.add(cardType);
      return true;
    });

    // Step 3.5: For incident queries, only show incident-relevant card types
    if (isIncidentQuery) {
      const incidentFiltered = deduplicated.filter(tool => {
        const cardType = tool.suggestedCardType || 'table';
        return INCIDENT_CARD_TYPES.has(cardType);
      });

      // If we have incident-specific cards, use only those
      if (incidentFiltered.length > 0) {
        deduplicated = incidentFiltered;
      }
    }

    // Step 4: Score and sort by priority
    const scored = deduplicated.map(tool => ({
      tool,
      priority: CARD_TYPE_PRIORITY[tool.suggestedCardType || 'table'] || 30,
    }));

    scored.sort((a, b) => b.priority - a.priority);

    // Step 5: Limit to configured max suggestions
    const limited = scored.slice(0, MAX_CARD_SUGGESTIONS).map(s => s.tool);

    return limited;
  }, [cardableTools, isIncidentQuery]);

  // Check if cards we added still exist (to allow re-adding if removed)
  const stillExists = useCallback((toolName: string) => {
    // Check both by tool name and by checking if addedTools contains it
    // Cards are considered "added" only if they're still in existingCards
    return existingCards.some(c =>
      c.metadata?.toolName === toolName
    );
  }, [existingCards]);

  // Handle adding a specific tool's data as card
  const handleAddToolCard = useCallback((toolInfo: CardableTool) => {
    if (stillExists(toolInfo.tool)) {
      return;
    }

    setIsAdding(toolInfo.tool);

    // Cards that need data enrichment from the backend API
    const enrichmentCardTypes = ['rf-analysis', 'health-trend', 'network-health'];
    const needsEnrichment = enrichmentCardTypes.includes(toolInfo.suggestedCardType || '');

    // Extract networkId from data if not already available
    const networkId = toolInfo.networkId || extractNetworkIdFromData(toolInfo.data);

    // Prepare card data - add needsEnrichment flag for cards that fetch their own data
    const cardData = needsEnrichment
      ? { ...((Array.isArray(toolInfo.data) ? { items: toolInfo.data } : toolInfo.data) as object), needsEnrichment: true }
      : toolInfo.data;

    const result = CardAgent.generateCard(
      {
        id: crypto.randomUUID(),
        label: `${toolInfo.title} (${toolInfo.count} ${toolInfo.count === 1 ? 'item' : 'items'})`,
        data: cardData,
        suggestedType: toolInfo.suggestedCardType,
        config: {
          networkId,
          orgId: toolInfo.orgId,
        },
      },
      existingCards
    );

    if (result.success && result.card) {
      // Build card with context and live subscription if available
      const cardWithContext = {
        ...result.card,
        title: toolInfo.title,
        metadata: {
          ...result.card.metadata,
          sourceQuery,
          sourceMessageId,
          toolName: toolInfo.tool,
          // Enable live updates if we have a WebSocket topic
          isLive: !!toolInfo.liveTopic,
          subscription: toolInfo.liveTopic ? {
            topic: toolInfo.liveTopic,
            transformFn: `${toolInfo.dataType || 'default'}-transform`,
          } : undefined,
        },
      };
      onAddCard(cardWithContext);
      setAddedTools(prev => new Set([...prev, toolInfo.tool]));
    }

    setIsAdding(null);
  }, [existingCards, onAddCard, sourceQuery, sourceMessageId, stillExists]);

  // Handle adding ALL cardable tools at once
  const handleAddAll = useCallback(() => {
    const toolsToAdd = filteredCardableTools.filter(t => !stillExists(t.tool));
    if (toolsToAdd.length === 0) return;

    setIsAdding('__all__');

    // Cards that need data enrichment from the backend API
    const enrichmentCardTypes = ['rf-analysis', 'health-trend', 'network-health'];

    for (const toolInfo of toolsToAdd) {
      // Extract networkId from data if not already available
      const networkId = toolInfo.networkId || extractNetworkIdFromData(toolInfo.data);

      // Prepare card data - add needsEnrichment flag for cards that fetch their own data
      const needsEnrichment = enrichmentCardTypes.includes(toolInfo.suggestedCardType || '');
      const cardData = needsEnrichment
        ? { ...((Array.isArray(toolInfo.data) ? { items: toolInfo.data } : toolInfo.data) as object), needsEnrichment: true }
        : toolInfo.data;

      const result = CardAgent.generateCard(
        {
          id: crypto.randomUUID(),
          label: `${toolInfo.title} (${toolInfo.count} ${toolInfo.count === 1 ? 'item' : 'items'})`,
          data: cardData,
          suggestedType: toolInfo.suggestedCardType,
          config: {
            networkId,
            orgId: toolInfo.orgId,
          },
        },
        existingCards
      );

      if (result.success && result.card) {
        const cardWithContext = {
          ...result.card,
          title: toolInfo.title,
          metadata: {
            ...result.card.metadata,
            sourceQuery,
            sourceMessageId,
            toolName: toolInfo.tool,
            isLive: !!toolInfo.liveTopic,
            subscription: toolInfo.liveTopic ? {
              topic: toolInfo.liveTopic,
              transformFn: `${toolInfo.dataType || 'default'}-transform`,
            } : undefined,
          },
        };
        onAddCard(cardWithContext);
        setAddedTools(prev => new Set([...prev, toolInfo.tool]));
      }
    }

    setIsAdding(null);
  }, [filteredCardableTools, existingCards, onAddCard, sourceQuery, sourceMessageId, stillExists]);

  // Calculate totals for Add All button
  const totalItems = filteredCardableTools.reduce((sum, t) => sum + t.count, 0);
  const allAdded = filteredCardableTools.every(t => stillExists(t.tool));
  const isAddingAll = isAdding === '__all__';

  // Don't render if no cardable tools
  if (filteredCardableTools.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 mt-3 ${className}`}>
      {/* Label */}
      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
        Add to Canvas:
      </span>

      {/* Individual tool buttons */}
      {filteredCardableTools.map((toolInfo) => {
        const isAdded = addedTools.has(toolInfo.tool) && stillExists(toolInfo.tool);
        const isCurrentlyAdding = isAdding === toolInfo.tool;

        return (
          <button
            key={toolInfo.tool}
            onClick={() => handleAddToolCard(toolInfo)}
            disabled={isAdded || isCurrentlyAdding || isAddingAll}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
              text-xs font-medium transition-all
              ${isAdded
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 cursor-default'
                : isCurrentlyAdding
                ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 cursor-wait'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 hover:text-cyan-700 dark:hover:text-cyan-300'
              }
            `}
          >
            {isAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                {toolInfo.title}
              </>
            ) : isCurrentlyAdding ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <PlusCircle className="w-3.5 h-3.5" />
                {getIconForDataType(toolInfo.dataType)}
                {toolInfo.title} ({toolInfo.count})
              </>
            )}
          </button>
        );
      })}

      {/* Add All button - only show when there are 2+ cardable tools */}
      {filteredCardableTools.length >= 2 && (
        <button
          onClick={handleAddAll}
          disabled={allAdded || isAddingAll}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
            text-xs font-medium transition-all border
            ${allAdded
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 cursor-default'
              : isAddingAll
              ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 border-slate-300 dark:border-slate-600 cursor-wait'
              : 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700 hover:bg-cyan-100 dark:hover:bg-cyan-900/40'
            }
          `}
        >
          {allAdded ? (
            <>
              <Check className="w-3.5 h-3.5" />
              All Added
            </>
          ) : isAddingAll ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Adding All...
            </>
          ) : (
            <>
              <Layers className="w-3.5 h-3.5" />
              Add All ({totalItems})
            </>
          )}
        </button>
      )}
    </div>
  );
});

CardableSuggestions.displayName = 'CardableSuggestions';

export default CardableSuggestions;
