/**
 * Smart Card Factory
 *
 * Factory functions for creating SmartCard instances from AI tool responses.
 * Handles card initialization, visualization config, and refresh setup.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SmartCard,
  AllCardTypes,
  CardSize,
  VisualizationConfig,
  CreateCardOptions,
  FreshnessStatus,
  ColumnConfig,
  VisualizationType,
} from './types';
import { CARD_REGISTRY, getDefaultRefreshInterval, getDefaultSize } from './registry';

// =============================================================================
// Card Creation
// =============================================================================

/**
 * Create a new SmartCard from AI tool response data
 */
export function createCard<T = unknown>(options: CreateCardOptions<T>): SmartCard<T> {
  const definition = CARD_REGISTRY[options.type];
  const now = new Date().toISOString();

  if (!definition) {
    console.warn(`Unknown card type: ${options.type}, using defaults`);
  }

  // Use registry's defaultSize first, then infer from visualization, then fallback to 'md'
  const size = definition?.defaultSize
    ?? (options.visualization?.type
      ? inferSizeFromVisualization(options.visualization.type as VisualizationType, options.data)
      : 'md');

  const visualization = buildVisualizationConfig(
    options.type,
    options.visualization,
    options.data
  );

  const refreshInterval = options.refreshInterval ?? getDefaultRefreshInterval(options.type);

  return {
    id: uuidv4(),
    type: options.type,
    title: options.title,
    subtitle: options.subtitle,
    size: size as CardSize,

    initialData: {
      payload: options.data,
      toolCallId: options.toolCallId,
      generatedAt: now,
    },

    data: {
      current: options.data,
      lastUpdated: now,
      isStale: false,
      status: 'live' as FreshnessStatus,
    },

    refresh: {
      endpoint: options.refreshEndpoint,
      interval: refreshInterval,
      enabled: refreshInterval > 0 && !!options.refreshEndpoint,
    },

    scope: options.scope,

    visualization,

    aiContext: options.originalQuery
      ? {
          originalQuery: options.originalQuery,
          sourceMessageId: options.sourceMessageId,
          suggestedActions: generateSuggestedActions(options.type, options.data),
        }
      : undefined,

    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

// =============================================================================
// Visualization Config Builders
// =============================================================================

/**
 * Build visualization config based on card type and data
 */
function buildVisualizationConfig<T>(
  type: AllCardTypes,
  partial?: Partial<VisualizationConfig>,
  data?: T
): VisualizationConfig {
  const definition = CARD_REGISTRY[type];
  const vizType = partial?.type ?? definition?.visualization ?? 'table';

  const baseConfig: VisualizationConfig = {
    type: vizType,
    ...partial,
  };

  // Add type-specific defaults
  switch (vizType) {
    case 'table':
      return {
        ...baseConfig,
        columns: partial?.columns ?? inferTableColumns(data),
        pageSize: partial?.pageSize ?? 10,
      };

    case 'donut':
      return {
        ...baseConfig,
        showValues: partial?.showValues ?? true,
        chart: {
          showLegend: true,
          animate: true,
          ...partial?.chart,
        },
      };

    case 'line_chart':
    case 'area_chart':
      return {
        ...baseConfig,
        chart: {
          xField: 'timestamp',
          yField: 'value',
          showGrid: true,
          showLegend: true,
          animate: true,
          ...partial?.chart,
        },
      };

    case 'bar_chart':
      return {
        ...baseConfig,
        orientation: partial?.orientation ?? 'horizontal',
        showValues: partial?.showValues ?? true,
        chart: {
          showGrid: true,
          animate: true,
          ...partial?.chart,
        },
      };

    case 'gauge':
    case 'multi_gauge':
      return {
        ...baseConfig,
        thresholds: partial?.thresholds ?? [
          { value: 33, color: '#ef4444', label: 'Poor' },
          { value: 66, color: '#f59e0b', label: 'Fair' },
          { value: 100, color: '#10b981', label: 'Good' },
        ],
      };

    case 'status_grid':
      return {
        ...baseConfig,
        statusField: partial?.statusField ?? 'status',
        statusColors: partial?.statusColors ?? {
          online: '#10b981',
          active: '#10b981',
          up: '#10b981',
          offline: '#ef4444',
          down: '#ef4444',
          alerting: '#f59e0b',
          warning: '#f59e0b',
          dormant: '#6b7280',
          unknown: '#94a3b8',
        },
        compact: partial?.compact ?? false,
      };

    case 'big_number':
      return {
        ...baseConfig,
        valueField: partial?.valueField ?? 'value',
        labelField: partial?.labelField ?? 'label',
        trendField: partial?.trendField ?? 'trend',
        precision: partial?.precision ?? 0,
      };

    case 'badge_list':
      return {
        ...baseConfig,
        statusColors: partial?.statusColors ?? {
          critical: '#ef4444',
          high: '#f97316',
          medium: '#f59e0b',
          low: '#3b82f6',
          info: '#6b7280',
          p1: '#ef4444',
          p2: '#f97316',
          p3: '#f59e0b',
          p4: '#3b82f6',
        },
      };

    case 'timeline':
      return {
        ...baseConfig,
        compact: partial?.compact ?? false,
      };

    case 'alert_list':
    case 'device_list':
      return {
        ...baseConfig,
        compact: partial?.compact ?? false,
      };

    default:
      return baseConfig;
  }
}

/**
 * Infer table columns from data structure
 */
function inferTableColumns<T>(data: T): ColumnConfig[] {
  if (!data) return [];

  // Handle array data
  const sample = Array.isArray(data) ? data[0] : data;
  if (!sample || typeof sample !== 'object') return [];

  const columns: ColumnConfig[] = [];
  const fieldOrder = [
    'name', 'hostname', 'serial', 'id',
    'status', 'state', 'health',
    'ip', 'lanIp', 'managementIp', 'mac',
    'model', 'platform', 'type', 'family',
    'value', 'count', 'usage',
    'lastSeen', 'lastUpdated', 'timestamp',
  ];

  const keys = Object.keys(sample as object);

  // Sort by field order, then alphabetically
  const sortedKeys = keys.sort((a, b) => {
    const aIndex = fieldOrder.indexOf(a);
    const bIndex = fieldOrder.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys.slice(0, 8)) {
    // Limit to 8 columns
    columns.push({
      key,
      label: formatColumnLabel(key),
      type: inferColumnType(key, (sample as Record<string, unknown>)[key]),
      sortable: true,
    });
  }

  return columns;
}

/**
 * Format a field key into a readable column label
 */
function formatColumnLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, str => str.toUpperCase())
    .replace(/\bIp\b/g, 'IP')
    .replace(/\bId\b/g, 'ID')
    .replace(/\bMac\b/g, 'MAC')
    .replace(/\bSsid\b/g, 'SSID')
    .replace(/\bVpn\b/g, 'VPN')
    .replace(/\bDns\b/g, 'DNS')
    .trim();
}

/**
 * Infer column type from key name and sample value
 */
function inferColumnType(
  key: string,
  value: unknown
): 'string' | 'number' | 'status' | 'date' | 'badge' | 'progress' {
  const keyLower = key.toLowerCase();

  if (
    keyLower === 'status' ||
    keyLower === 'state' ||
    keyLower.includes('status')
  ) {
    return 'status';
  }

  if (
    keyLower === 'severity' ||
    keyLower === 'priority' ||
    keyLower === 'type' ||
    keyLower === 'classification'
  ) {
    return 'badge';
  }

  if (
    keyLower.includes('time') ||
    keyLower.includes('date') ||
    keyLower.includes('seen') ||
    keyLower.includes('created') ||
    keyLower.includes('updated')
  ) {
    return 'date';
  }

  if (
    keyLower === 'progress' ||
    keyLower === 'utilization' ||
    keyLower === 'health' ||
    keyLower.includes('percent') ||
    keyLower.includes('rate')
  ) {
    return 'progress';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  return 'string';
}

/**
 * Infer appropriate card size from visualization type and data
 */
function inferSizeFromVisualization<T>(
  vizType: VisualizationType,
  data: T
): CardSize {
  const itemCount = Array.isArray(data) ? data.length : 1;

  switch (vizType) {
    case 'big_number':
    case 'sparkline':
      return 'xs';

    case 'gauge':
    case 'badge_list':
      return 'sm';

    case 'donut':
      return 'md';  // Donut needs vertical space for legend

    case 'multi_gauge':
    case 'stat_row':
      return 'lg';  // Multi-gauge needs horizontal space

    case 'bar_chart':
    case 'line_chart':
    case 'area_chart':
      return itemCount > 5 ? 'lg' : 'md';

    case 'status_grid':
      return itemCount > 6 ? 'lg' : 'md';

    case 'table':
      // Tables benefit from width for columns
      if (itemCount <= 3) return 'md';
      return 'lg';  // Tables need horizontal space for columns

    case 'timeline':
    case 'alert_list':
    case 'device_list':
      return itemCount > 8 ? 'tall' : 'md';

    case 'heatmap':
    case 'topology':
      return 'lg';

    case 'progress_list':
      return itemCount > 6 ? 'md' : 'sm';

    default:
      return 'md';
  }
}

// =============================================================================
// AI Context Helpers
// =============================================================================

/**
 * Generate suggested follow-up actions based on card type and data
 */
function generateSuggestedActions<T>(type: AllCardTypes, data: T): string[] {
  const suggestions: string[] = [];

  switch (type) {
    case 'meraki_network_health':
      suggestions.push(
        'Show me offline devices',
        'What caused the recent outages?',
        'Compare health across networks'
      );
      break;

    case 'meraki_device_table':
      suggestions.push(
        'Show only alerting devices',
        'Export device list',
        'Check firmware versions'
      );
      break;

    case 'meraki_alert_summary':
      suggestions.push(
        'Show critical alert details',
        'What triggered these alerts?',
        'Silence low-priority alerts'
      );
      break;

    case 'meraki_uplink_status':
      suggestions.push(
        'Run uplink speed test',
        'Show uplink failover history',
        'Check ISP latency trends'
      );
      break;

    case 'te_alert_summary':
      suggestions.push(
        'Show alert details',
        'Which tests are failing?',
        'Show path visualization'
      );
      break;

    case 'splunk_notable_events':
      suggestions.push(
        'Show event details',
        'Investigate this threat',
        'Create correlation rule'
      );
      break;

    case 'catalyst_site_health':
      suggestions.push(
        'Show site issues',
        'Compare to other sites',
        'View device inventory'
      );
      break;

    default:
      suggestions.push(
        'Tell me more',
        'Export this data',
        'Show related metrics'
      );
  }

  return suggestions;
}

// =============================================================================
// Card Update Helpers
// =============================================================================

/**
 * Update card data from refresh response
 */
export function updateCardData<T>(
  card: SmartCard<T>,
  newData: T,
  error?: string
): SmartCard<T> {
  const now = new Date().toISOString();

  return {
    ...card,
    data: {
      current: error ? card.data.current : newData,
      lastUpdated: now,
      isStale: !!error,
      error,
      status: error ? 'error' : 'live',
    },
    refresh: {
      ...card.refresh,
      lastAttempt: now,
      retryCount: error
        ? (card.refresh.retryCount ?? 0) + 1
        : 0,
    },
    updatedAt: now,
  };
}

/**
 * Mark card data as stale (for freshness indicators)
 */
export function markCardStale<T>(card: SmartCard<T>): SmartCard<T> {
  return {
    ...card,
    data: {
      ...card.data,
      isStale: true,
      status: 'stale',
    },
  };
}

/**
 * Toggle card pin status
 */
export function toggleCardPin<T>(card: SmartCard<T>): SmartCard<T> {
  return {
    ...card,
    pinned: !card.pinned,
    updatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// Card Serialization
// =============================================================================

/**
 * Serialize card for storage (strip sensitive data)
 */
export function serializeCard<T>(card: SmartCard<T>): SmartCard<T> {
  return {
    ...card,
    // Keep initial data for restoration
    // Remove refresh attempt tracking
    refresh: {
      ...card.refresh,
      lastAttempt: undefined,
      retryCount: undefined,
    },
  };
}

/**
 * Deserialize card from storage
 */
export function deserializeCard<T>(data: SmartCard<T>): SmartCard<T> {
  return {
    ...data,
    data: {
      ...data.data,
      // Reset status on load - will be refreshed
      status: data.refresh.enabled ? 'loading' : 'live',
    },
  };
}
