'use client';

/**
 * VisualizationRenderer
 *
 * Renders the appropriate visualization component based on the card's
 * visualization configuration.
 */

import { memo } from 'react';
import { VisualizationConfig, VisualizationType } from '../types';
import { BigNumber } from './BigNumber';
import { DonutChart } from './DonutChart';
import { StatusGrid } from './StatusGrid';
import { DataTable } from './DataTable';
import { Gauge, MultiGauge } from './Gauge';
import { BadgeList } from './BadgeList';
import { BarChart } from './BarChart';
import { LineChart, AreaChart } from './LineChart';
import { Timeline } from './Timeline';
import { AlertList, DeviceList } from './AlertList';
import { StatCards } from './StatCards';

// Enhanced enterprise-style visualizations
import { NetworkHealthViz } from './NetworkHealthViz';
import { WirelessOverviewViz } from './WirelessOverviewViz';
import { DeviceStatusViz } from './DeviceStatusViz';
import { SecurityEventsViz } from './SecurityEventsViz';
import { TrafficAnalyticsViz } from './TrafficAnalyticsViz';

// Network Performance Change Cards
import { PerformanceOverviewViz } from './PerformanceOverviewViz';
import { ChangeComparisonViz } from './ChangeComparisonViz';
import { ChangeHistoryViz } from './ChangeHistoryViz';

// ThousandEyes visualizations
import { TEPathVisualizationViz } from './TEPathVisualizationViz';
import { TELatencyChartViz } from './TELatencyChartViz';
import { TEBgpChangesViz } from './TEBgpChangesViz';
import { TENetworkDiagnosticViz } from './TENetworkDiagnosticViz';

interface VisualizationRendererProps {
  data: unknown;
  config: VisualizationConfig;
  onAction?: (action: string, payload?: unknown) => void;
}

export const VisualizationRenderer = memo(({
  data,
  config,
  onAction,
}: VisualizationRendererProps) => {
  // Wrap all returns in a full-height flex container to ensure proper centering
  const wrapContent = (content: React.ReactNode) => (
    <div className="h-full w-full flex-1 flex flex-col">{content}</div>
  );

  // Handle null/undefined data
  if (data === null || data === undefined) {
    return wrapContent(<EmptyState message="No data available" />);
  }

  // Handle contextual empty state objects from transformers
  if (typeof data === 'object' && !Array.isArray(data)) {
    const dataObj = data as Record<string, unknown>;
    if (dataObj._emptyState === true && typeof dataObj.message === 'string') {
      return wrapContent(<EmptyState message={dataObj.message} icon={dataObj.icon as string | undefined} />);
    }
  }

  // Handle empty object — show "no data" instead of perpetual "Loading..."
  if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data as object).length === 0) {
    return wrapContent(<EmptyState message="No data available" />);
  }

  // Handle empty arrays with contextual message based on visualization type
  if (Array.isArray(data) && data.length === 0) {
    const emptyMessages: Record<string, { message: string; icon?: string }> = {
      'table': { message: 'No records found', icon: 'chart' },
      'bar_chart': { message: 'No data to display', icon: 'chart' },
      'line_chart': { message: 'No trend data available', icon: 'chart' },
      'timeline': { message: 'No events in this timeframe', icon: 'alert' },
      'alert_list': { message: 'No alerts - all systems normal', icon: 'success' },
      'status_grid': { message: 'No status data available', icon: 'network' },
      'badge_list': { message: 'No items to display' },
    };
    const emptyConfig = emptyMessages[config.type] || { message: 'No data available' };
    return wrapContent(<EmptyState message={emptyConfig.message} icon={emptyConfig.icon} />);
  }

  return wrapContent(renderVisualization(config.type, data, config, onAction));
});

VisualizationRenderer.displayName = 'VisualizationRenderer';

// =============================================================================
// Visualization Routing
// =============================================================================

function renderVisualization(
  type: VisualizationType,
  data: unknown,
  config: VisualizationConfig,
  onAction?: (action: string, payload?: unknown) => void
): React.ReactNode {
  switch (type) {
    case 'big_number':
      return renderBigNumber(data, config);

    case 'donut':
      return renderDonut(data, config);

    case 'status_grid':
      return renderStatusGrid(data, config, onAction);

    case 'table':
      return renderTable(data, config, onAction);

    case 'gauge':
      return renderGauge(data, config);

    case 'multi_gauge':
      return renderMultiGauge(data, config);

    case 'badge_list':
      return renderBadgeList(data, config);

    case 'bar_chart':
      return renderBarChart(data, config);

    case 'line_chart':
      return renderLineChart(data, config);

    case 'area_chart':
      return renderAreaChart(data, config);

    case 'timeline':
      return renderTimeline(data, config, onAction);

    case 'alert_list':
      return renderAlertList(data, config, onAction);

    case 'device_list':
      return renderDeviceList(data, config, onAction);

    case 'progress_list':
      return renderProgressList(data, config);

    case 'stat_row':
      return renderStatRow(data, config);

    case 'sparkline':
      return renderSparkline(data, config);

    case 'heatmap':
      return renderHeatmap(data, config);

    case 'topology':
      return renderTopology(data, config);

    // Enhanced enterprise-style visualizations
    case 'network_health':
      return <NetworkHealthViz data={data as Record<string, unknown>} />;

    case 'wireless_overview':
      return <WirelessOverviewViz data={data as Record<string, unknown>} />;

    case 'device_status':
      return <DeviceStatusViz data={data as Record<string, unknown>} />;

    case 'security_events':
      return <SecurityEventsViz data={data as Record<string, unknown>} />;

    case 'traffic_analytics':
      return <TrafficAnalyticsViz data={data as Record<string, unknown>} />;

    // Network Performance Change Cards
    case 'performance_overview':
      return <PerformanceOverviewViz data={data as Record<string, unknown>} onAction={onAction} />;

    case 'change_comparison':
      return <ChangeComparisonViz data={data as Record<string, unknown>} onAction={onAction} />;

    case 'change_history':
      return <ChangeHistoryViz data={data as Record<string, unknown>} onAction={onAction} />;

    // ThousandEyes visualizations
    case 'te_path_flow':
      return <TEPathVisualizationViz data={data as Record<string, unknown>} />;

    case 'te_latency_waterfall':
      return <TELatencyChartViz data={data as Record<string, unknown>} />;

    case 'te_bgp_routing':
      return <TEBgpChangesViz data={data as Record<string, unknown>} />;

    case 'te_network_diagnostic':
      return <TENetworkDiagnosticViz data={data as Record<string, unknown>} />;

    case 'custom':
      return <EmptyState message="Custom visualization not configured" />;

    default:
      console.warn(`Unknown visualization type: ${type}`);
      return <EmptyState message="Unsupported visualization" />;
  }
}

// =============================================================================
// Render Functions
// =============================================================================

function renderBigNumber(data: unknown, config: VisualizationConfig) {
  const valueField = config.valueField ?? 'value';
  const labelField = config.labelField ?? 'label';
  const trendField = config.trendField ?? 'trend';

  let value: number | string;
  let label: string | undefined;
  let trend: number | undefined;

  if (typeof data === 'number') {
    value = data;
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    value = obj[valueField] as number ?? obj.count ?? obj.total ?? 0;
    label = obj[labelField] as string;
    trend = obj[trendField] as number;
  } else {
    value = 0;
  }

  return (
    <BigNumber
      value={value}
      label={label}
      unit={config.unit}
      trend={trend}
      precision={config.precision}
    />
  );
}

function renderDonut(data: unknown, config: VisualizationConfig) {
  // Convert data to Record<string, number> format
  let donutData: Record<string, number> = {};

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    // Handle AI breakdown format: {items: [{label, value}], displayAs, title}
    if (Array.isArray(obj.items)) {
      (obj.items as Array<Record<string, unknown>>).forEach((item, index) => {
        const label = String(item.label ?? item.name ?? `Item ${index + 1}`);
        const value = typeof item.value === 'number' ? item.value :
                      typeof item.count === 'number' ? item.count : 0;
        donutData[label] = value;
      });
      return (
        <DonutChart
          data={donutData}
          showLegend={config.chart?.showLegend ?? true}
          showValues={config.showValues}
          colors={config.statusColors}
        />
      );
    }

    // Check if it's already the right format
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'number') {
        donutData[key] = value;
      } else if (typeof value === 'object' && value !== null) {
        // Try to extract count from nested object
        const nested = value as Record<string, unknown>;
        const count = nested.count ?? nested.value ?? nested.total ?? nested.clientCount;
        if (typeof count === 'number') {
          donutData[key] = count;
        }
      }
    }
  } else if (Array.isArray(data)) {
    // Convert array to object format
    data.forEach((item, index) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const label = String(obj.label ?? obj.name ?? obj.ssid ?? `Item ${index + 1}`);
        const value = typeof obj.value === 'number' ? obj.value :
                      typeof obj.count === 'number' ? obj.count :
                      typeof obj.clientCount === 'number' ? obj.clientCount : 0;
        donutData[label] = value;
      }
    });
  }

  return (
    <DonutChart
      data={donutData}
      showLegend={config.chart?.showLegend ?? true}
      showValues={config.showValues}
      colors={config.statusColors}
    />
  );
}

function renderStatusGrid(
  data: unknown,
  config: VisualizationConfig,
  onAction?: (action: string, payload?: unknown) => void
) {
  let items: unknown[];

  if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    // Handle wrapped arrays: {items: [...]}, {uplinks: [...]}, {ports: [...]}, etc.
    const arrayField = Object.values(obj).find(v => Array.isArray(v));
    items = Array.isArray(arrayField) ? arrayField : [];
  } else {
    items = [];
  }

  return (
    <StatusGrid
      data={items as Parameters<typeof StatusGrid>[0]['data']}
      statusField={config.statusField}
      statusColors={config.statusColors}
      compact={config.compact}
      onItemClick={onAction ? (item) => onAction('click', item) : undefined}
    />
  );
}

function renderTable(
  data: unknown,
  config: VisualizationConfig,
  onAction?: (action: string, payload?: unknown) => void
) {
  let rows: Array<Record<string, unknown>>;

  if (Array.isArray(data)) {
    rows = data;
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    // Handle knowledge-sources format: {query, documents: [...]}
    if (Array.isArray(obj.documents)) {
      rows = obj.documents;
    }
    // Handle datasheet-comparison format: {products: [...], features: [...]}
    else if (Array.isArray(obj.products)) {
      rows = obj.products;
    }
    // Handle generic wrapper: {items: [...]} or {results: [...]} or {data: [...]}
    else if (Array.isArray(obj.items)) {
      rows = obj.items;
    } else if (Array.isArray(obj.results)) {
      rows = obj.results;
    } else if (Array.isArray(obj.data)) {
      rows = obj.data;
    } else {
      rows = [];
    }
  } else {
    rows = [];
  }

  return (
    <DataTable
      data={rows}
      columns={config.columns}
      pageSize={config.pageSize}
      compact={config.compact}
      onRowClick={onAction ? (row) => onAction('click', row) : undefined}
    />
  );
}

function renderGauge(data: unknown, config: VisualizationConfig) {
  const valueField = config.valueField ?? 'value';

  let value: number;
  let label: string | undefined;

  if (typeof data === 'number') {
    value = data;
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    value = obj[valueField] as number ?? obj.score ?? obj.health ?? 0;
    label = obj.label as string;
  } else {
    value = 0;
  }

  return (
    <Gauge
      value={value}
      label={label}
      unit={config.unit}
      thresholds={config.thresholds}
    />
  );
}

function renderMultiGauge(data: unknown, config: VisualizationConfig) {
  let gauges: Array<{ value: number; label: string; unit?: string; min?: number; max?: number; inverted?: boolean }>;

  if (Array.isArray(data)) {
    gauges = data.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        // Extract numeric value
        let value = 0;
        if (typeof obj.value === 'number') value = obj.value;
        else if (typeof obj.score === 'number') value = obj.score;
        else if (typeof obj.utilization === 'number') value = obj.utilization;
        else if (typeof obj.health === 'number') value = obj.health;

        return {
          value,
          label: String(obj.label ?? obj.name ?? obj.title ?? `Item ${index + 1}`),
          unit: typeof obj.unit === 'string' ? obj.unit : undefined,
          min: typeof obj.min === 'number' ? obj.min : undefined,
          max: typeof obj.max === 'number' ? obj.max : undefined,
          inverted: typeof obj.inverted === 'boolean' ? obj.inverted : undefined,
        };
      }
      return { value: typeof item === 'number' ? item : 0, label: `Item ${index + 1}` };
    });
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    gauges = Object.entries(obj).map(([label, value]) => ({
      value: typeof value === 'number' ? value : (typeof value === 'object' && value !== null ? (value as Record<string, number>).value ?? 0 : 0),
      label,
    }));
  } else {
    gauges = [];
  }

  return (
    <MultiGauge
      data={gauges}
      thresholds={config.thresholds}
    />
  );
}

function renderBadgeList(data: unknown, config: VisualizationConfig) {
  let badgeData: Record<string, number> | Array<{ label: string; value: number; color?: string }>;

  if (Array.isArray(data)) {
    // Check if it's already [{label, value}] format
    if (data.length > 0 && typeof data[0] === 'object' && 'label' in (data[0] as object) && 'value' in (data[0] as object)) {
      badgeData = data as Array<{ label: string; value: number; color?: string }>;
    } else {
      // Array of raw objects (e.g., alert objects) - count by severity/type field
      const counts: Record<string, number> = {};
      data.forEach((item) => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          const category = String(obj.severity ?? obj.priority ?? obj.type ?? obj.status ?? 'unknown').toLowerCase();
          counts[category] = (counts[category] || 0) + 1;
        }
      });
      badgeData = counts;
    }
  } else if (typeof data === 'object' && data !== null) {
    badgeData = data as Record<string, number>;
  } else {
    badgeData = {};
  }

  return (
    <BadgeList
      data={badgeData}
      statusColors={config.statusColors}
      orientation={config.orientation}
      compact={config.compact}
    />
  );
}

function renderBarChart(data: unknown, config: VisualizationConfig) {
  let items: unknown[];
  if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    // Handle {items: [...]} wrapper or convert object to [{label, value}]
    if (Array.isArray(obj.items)) {
      items = obj.items;
    } else {
      items = Object.entries(obj)
        .filter(([key]) => key !== 'total' && key !== 'title' && key !== 'displayAs')
        .map(([label, value]) => ({
          label,
          value: typeof value === 'number' ? value : 0,
        }));
    }
  } else {
    items = [];
  }

  return (
    <BarChart
      data={items as Parameters<typeof BarChart>[0]['data']}
      orientation={config.orientation}
      showValues={config.showValues}
      showGrid={config.chart?.showGrid}
      unit={config.unit}
    />
  );
}

function renderLineChart(data: unknown, config: VisualizationConfig) {
  const points = Array.isArray(data) ? data : [];

  return (
    <LineChart
      data={points}
      type="line"
      xField={config.chart?.xField}
      yField={config.chart?.yField}
      seriesField={config.chart?.seriesField}
      colors={config.chart?.colors}
      showGrid={config.chart?.showGrid}
      showLegend={config.chart?.showLegend}
      animate={config.chart?.animate}
    />
  );
}

function renderAreaChart(data: unknown, config: VisualizationConfig) {
  const points = Array.isArray(data) ? data : [];

  return (
    <AreaChart
      data={points}
      xField={config.chart?.xField}
      yField={config.chart?.yField}
      seriesField={config.chart?.seriesField}
      colors={config.chart?.colors}
      showGrid={config.chart?.showGrid}
      showLegend={config.chart?.showLegend}
      animate={config.chart?.animate}
    />
  );
}

function renderTimeline(
  data: unknown,
  config: VisualizationConfig,
  onAction?: (action: string, payload?: unknown) => void
) {
  const events = Array.isArray(data) ? data : [];

  return (
    <Timeline
      data={events}
      compact={config.compact}
      onEventClick={onAction ? (event) => onAction('click', event) : undefined}
    />
  );
}

function renderAlertList(
  data: unknown,
  config: VisualizationConfig,
  onAction?: (action: string, payload?: unknown) => void
) {
  let alerts: unknown[];

  if (Array.isArray(data)) {
    alerts = data;
  } else if (typeof data === 'object' && data !== null) {
    // Handle single finding/alert object (e.g., from ai-finding card)
    const obj = data as Record<string, unknown>;
    alerts = [{
      title: obj.title ?? obj.name ?? 'Finding',
      description: obj.description ?? obj.details ?? obj.message,
      severity: obj.severity ?? 'info',
      recommendation: obj.recommendation,
      timestamp: obj.timestamp,
      status: obj.status,
      source: obj.source,
    }];
  } else {
    alerts = [];
  }

  return (
    <AlertList
      data={alerts as Parameters<typeof AlertList>[0]['data']}
      compact={config.compact}
      severityColors={config.statusColors}
      onAlertClick={onAction ? (alert) => onAction('click', alert) : undefined}
    />
  );
}

function renderDeviceList(
  data: unknown,
  config: VisualizationConfig,
  onAction?: (action: string, payload?: unknown) => void
) {
  let devices: unknown[];

  if (Array.isArray(data)) {
    devices = data;
  } else if (typeof data === 'object' && data !== null) {
    // Handle single device object (e.g., from ai-device-summary)
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.devices)) {
      devices = obj.devices;
    } else {
      // Wrap single device as array
      devices = [obj];
    }
  } else {
    devices = [];
  }

  return (
    <DeviceList
      data={devices as Parameters<typeof DeviceList>[0]['data']}
      compact={config.compact}
      statusColors={config.statusColors}
      onDeviceClick={onAction ? (device) => onAction('click', device) : undefined}
    />
  );
}

function renderProgressList(data: unknown, config: VisualizationConfig) {
  const items = Array.isArray(data) ? data : [];

  return (
    <div className="h-full overflow-auto py-2 px-3">
      {items.map((item: Record<string, unknown>, index: number) => {
        const label = String(item.label ?? item.name ?? item.appName ?? `Item ${index + 1}`);
        const value = Number(item.value ?? item.score ?? item.healthScore ?? item.progress ?? 0);

        return (
          <div key={index} className="mb-3 last:mb-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{label}</span>
              <span className="text-xs text-slate-500 tabular-nums">{value.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, value))}%`,
                  backgroundColor: value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderStatRow(data: unknown, config: VisualizationConfig) {
  let stats: Array<{ label: string; value: number | string; icon?: string; color?: string; subtext?: string; percentage?: number }>;

  // Handle wrapped data from AI cards and knowledge cards
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    // {stats: [...]} wrapper (from ai-stats-grid)
    if (Array.isArray(obj.stats)) {
      data = obj.stats;
    }
    // {product: {name, specs: [{label, value}]}} wrapper (from product-detail)
    else if (typeof obj.product === 'object' && obj.product !== null) {
      const product = obj.product as Record<string, unknown>;
      const specs = Array.isArray(product.specs) ? product.specs : [];
      data = [
        ...(product.name ? [{ label: 'Product', value: product.name }] : []),
        ...(product.category ? [{ label: 'Category', value: product.category }] : []),
        ...specs,
      ];
    }
  }

  if (Array.isArray(data)) {
    // If array items are already {label, value} format, use them
    // Otherwise, try to extract useful stats from the objects
    stats = data.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        // Check if it's already a stat object
        if ('label' in obj && 'value' in obj) {
          return {
            label: String(obj.label ?? `Item ${index + 1}`),
            value: formatStatValue(obj.value),
            icon: obj.icon as string | undefined,
            color: obj.color as string | undefined,
            subtext: obj.subtext as string | undefined,
            percentage: obj.percentage as number | undefined,
          };
        }
        // Otherwise extract the first useful value
        const name = obj.name ?? obj.label ?? obj.title ?? `Item ${index + 1}`;
        const value = obj.value ?? obj.count ?? obj.total ?? obj.score ?? '-';
        return {
          label: String(name),
          value: formatStatValue(value),
          icon: obj.icon as string | undefined,
          color: obj.color as string | undefined,
        };
      }
      return { label: `Item ${index + 1}`, value: formatStatValue(item) };
    });
  } else if (typeof data === 'object' && data !== null) {
    stats = Object.entries(data as Record<string, unknown>).map(([label, value]) => ({
      label,
      value: formatStatValue(value),
    }));
  } else {
    stats = [];
  }

  // Use the new graphical StatCards component
  return <StatCards data={stats} compact={config.compact} />;
}

/** Format a value for display in stats, handling objects gracefully */
function formatStatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    // For objects, try to get a count or length
    if (Array.isArray(value)) return String(value.length);
    const obj = value as Record<string, unknown>;
    if ('count' in obj) return String(obj.count);
    if ('total' in obj) return String(obj.total);
    if ('value' in obj) return formatStatValue(obj.value);
    return '-';
  }
  return String(value);
}

function renderSparkline(data: unknown, config: VisualizationConfig) {
  const points = Array.isArray(data) ? data : [];

  if (points.length < 2) {
    return <EmptyState message="Insufficient data" />;
  }

  const values = points.map(p =>
    typeof p === 'number' ? p : (p as Record<string, unknown>).value as number ?? 0
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 120;
  const height = 30;
  const padding = 2;

  const pathData = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const lastValue = values[values.length - 1];
  const prevValue = values[values.length - 2];
  const trend = lastValue >= prevValue ? '#10b981' : '#ef4444';

  return (
    <div className="flex items-center justify-center gap-3 h-full">
      <svg width={width} height={height}>
        <path
          d={pathData}
          fill="none"
          stroke={trend}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
        {lastValue.toLocaleString()}
      </span>
    </div>
  );
}

function renderHeatmap(data: unknown, config: VisualizationConfig) {
  // Convert data to array format
  let items: Array<Record<string, unknown>> = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    // Check for outages or similar nested arrays
    if (Array.isArray(obj.outages)) {
      items = obj.outages;
    } else {
      // Convert object to array of key-value pairs
      items = Object.entries(obj).map(([key, value]) => ({
        label: key,
        value: typeof value === 'number' ? value : 0,
      }));
    }
  }

  if (items.length === 0) {
    return <EmptyState message="No heatmap data available" />;
  }

  // Render as a grid of colored cells
  const getSeverityColor = (severity: string | undefined, count: number) => {
    if (severity === 'critical' || count >= 5) return 'bg-red-500';
    if (severity === 'warning' || count >= 2) return 'bg-amber-500';
    if (severity === 'good' || count === 0) return 'bg-emerald-500';
    return 'bg-blue-500';
  };

  return (
    <div className="h-full overflow-auto p-3">
      <div className="grid grid-cols-2 gap-2">
        {items.slice(0, 8).map((item, index) => {
          const label = String(item.region || item.label || item.name || `Cell ${index + 1}`);
          const count = Number(item.count ?? item.value ?? 0);
          const severity = String(item.severity || '');

          return (
            <div
              key={index}
              className={`${getSeverityColor(severity, count)} rounded-lg p-3 text-white`}
            >
              <div className="text-xs font-medium truncate opacity-90">{label}</div>
              <div className="text-lg font-bold">{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderTopology(data: unknown, config: VisualizationConfig) {
  // Convert data to nodes/edges format
  let items: Array<Record<string, unknown>> = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.paths)) {
      items = obj.paths;
    } else if (Array.isArray(obj.nodes)) {
      items = obj.nodes;
    }
  }

  if (items.length === 0) {
    return <EmptyState message="No topology data available" />;
  }

  // Render as a simple list of connections
  const getStatusColor = (status: string) => {
    if (status === 'active' || status === 'online') return 'bg-emerald-500';
    if (status === 'inactive' || status === 'offline') return 'bg-slate-500';
    return 'bg-blue-500';
  };

  return (
    <div className="h-full overflow-auto p-3">
      <div className="space-y-2">
        {items.slice(0, 6).map((item, index) => {
          const source = String(item.source || item.from || item.name || `Node ${index + 1}`);
          const target = String(item.target || item.to || item.destination || '');
          const status = String(item.status || 'active');

          return (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg"
            >
              <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-900 dark:text-white truncate">{source}</div>
                {target && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>→</span>
                    <span className="truncate">{target}</span>
                  </div>
                )}
              </div>
              <div className={`text-xs px-2 py-0.5 rounded ${
                status === 'active' || status === 'online'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-500/20 text-slate-500 dark:text-slate-400'
              }`}>
                {status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================

interface EmptyStateProps {
  message: string;
  icon?: string;
}

const EmptyState = ({ message, icon }: EmptyStateProps) => {
  // Icon mapping for contextual empty states
  const getIcon = (): React.ReactNode => {
    switch (icon) {
      case 'chart':
        return (
          <svg className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        );
      case 'network':
        return (
          <svg className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        );
      case 'dns':
        return (
          <svg className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        );
      case 'phone':
        return (
          <svg className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        );
      case 'web':
        return (
          <svg className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9c0 1.657-4.03 3-9 3s-9-1.343-9-3m18 0c0-1.657-4.03-3-9-3s-9 1.343-9 3m9-9a9 9 0 00-9 9" />
          </svg>
        );
      case 'security':
        return (
          <svg className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'alert':
        return (
          <svg className="w-8 h-8 mb-2 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'config':
        return (
          <svg className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'success':
        // Green shield with checkmark for security "all clear" states
        return (
          <svg className="w-8 h-8 mb-2 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[100px] text-center px-4">
      {icon && getIcon()}
      <span className="text-slate-500 dark:text-slate-400 text-sm">{message}</span>
    </div>
  );
};
