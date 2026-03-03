'use client';

/**
 * Card Components for Chat V2
 *
 * Self-contained card rendering system with:
 * - Network health visualization
 * - Device tables
 * - Alert summaries
 * - Performance metrics
 * - Client distribution charts
 */

import { memo, useMemo } from 'react';
import type { SmartCard } from '../../cards/types';

// =============================================================================
// Types
// =============================================================================

interface CardContentProps {
  card: SmartCard;
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

// =============================================================================
// Status Indicator Component
// =============================================================================

const StatusIndicator = memo(({ status }: { status: string }) => {
  const getStatusColor = (s: string) => {
    const lower = s.toLowerCase();
    if (lower === 'online' || lower === 'healthy' || lower === 'good' || lower === 'active') {
      return 'bg-emerald-500';
    }
    if (lower === 'warning' || lower === 'degraded' || lower === 'alerting') {
      return 'bg-amber-500';
    }
    if (lower === 'offline' || lower === 'critical' || lower === 'error' || lower === 'down') {
      return 'bg-red-500';
    }
    return 'bg-slate-500';
  };

  return (
    <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor(status)}`} />
  );
});
StatusIndicator.displayName = 'StatusIndicator';

// =============================================================================
// Empty State Component
// =============================================================================

const EmptyState = memo(({ message = 'No data available' }: { message?: string }) => (
  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
    {message}
  </div>
));
EmptyState.displayName = 'EmptyState';

// =============================================================================
// Network Health Card
// =============================================================================

const NetworkHealthCard = memo(({ data }: { data: unknown }) => {
  const health = useMemo(() => {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    return {
      status: (d.status as string) || 'Unknown',
      online: (d.online as number) || (d.onlineDevices as number) || 0,
      offline: (d.offline as number) || (d.offlineDevices as number) || 0,
      alerting: (d.alerting as number) || 0,
    };
  }, [data]);

  if (!health) return <EmptyState />;

  const total = health.online + health.offline + health.alerting;
  const healthPercent = total > 0 ? Math.round((health.online / total) * 100) : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Health percentage */}
      <div className="text-center">
        <div className="text-4xl font-bold text-white">{healthPercent}%</div>
        <div className="text-sm text-slate-400">Network Health</div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
          style={{ width: `${healthPercent}%` }}
        />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-4 text-center text-sm">
        <div>
          <div className="text-emerald-400 font-semibold">{health.online}</div>
          <div className="text-slate-500">Online</div>
        </div>
        <div>
          <div className="text-red-400 font-semibold">{health.offline}</div>
          <div className="text-slate-500">Offline</div>
        </div>
        <div>
          <div className="text-amber-400 font-semibold">{health.alerting}</div>
          <div className="text-slate-500">Alerting</div>
        </div>
      </div>
    </div>
  );
});
NetworkHealthCard.displayName = 'NetworkHealthCard';

// =============================================================================
// Device Table Card
// =============================================================================

const DeviceTableCard = memo(({ data }: { data: unknown }) => {
  const devices = useMemo(() => {
    if (Array.isArray(data)) return data.slice(0, 10);
    if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).items)) {
      return ((data as Record<string, unknown>).items as unknown[]).slice(0, 10);
    }
    return [];
  }, [data]);

  if (devices.length === 0) return <EmptyState message="No devices found" />;

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-800 text-slate-400">
          <tr>
            <th className="text-left p-2 font-medium">Name</th>
            <th className="text-left p-2 font-medium">Status</th>
            <th className="text-left p-2 font-medium">Model</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device: unknown, idx: number) => {
            const d = device as Record<string, unknown>;
            return (
              <tr key={idx} className="border-t border-slate-700/50 hover:bg-slate-800/50">
                <td className="p-2 text-white truncate max-w-[200px]">
                  {(d.name as string) || (d.hostname as string) || `Device ${idx + 1}`}
                </td>
                <td className="p-2">
                  <span className="flex items-center gap-2">
                    <StatusIndicator status={(d.status as string) || 'unknown'} />
                    <span className="text-slate-300 capitalize">{(d.status as string) || 'Unknown'}</span>
                  </span>
                </td>
                <td className="p-2 text-slate-400">{(d.model as string) || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
DeviceTableCard.displayName = 'DeviceTableCard';

// =============================================================================
// Alert Summary Card
// =============================================================================

const AlertSummaryCard = memo(({ data }: { data: unknown }) => {
  const alerts = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).alerts)) {
      return (data as Record<string, unknown>).alerts as unknown[];
    }
    return [];
  }, [data]);

  const summary = useMemo(() => {
    let critical = 0, warning = 0, info = 0;
    alerts.forEach((alert: unknown) => {
      const a = alert as Record<string, unknown>;
      const severity = ((a.severity as string) || '').toLowerCase();
      if (severity === 'critical' || severity === 'high') critical++;
      else if (severity === 'warning' || severity === 'medium') warning++;
      else info++;
    });
    return { critical, warning, info, total: alerts.length };
  }, [alerts]);

  if (summary.total === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-emerald-400">
        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm">All clear</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-center">
        <div className="text-3xl font-bold text-white">{summary.total}</div>
        <div className="text-sm text-slate-400">Active Alerts</div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-red-500/10 rounded-lg">
          <div className="text-xl font-bold text-red-400">{summary.critical}</div>
          <div className="text-xs text-slate-500">Critical</div>
        </div>
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <div className="text-xl font-bold text-amber-400">{summary.warning}</div>
          <div className="text-xs text-slate-500">Warning</div>
        </div>
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <div className="text-xl font-bold text-blue-400">{summary.info}</div>
          <div className="text-xs text-slate-500">Info</div>
        </div>
      </div>
    </div>
  );
});
AlertSummaryCard.displayName = 'AlertSummaryCard';

// =============================================================================
// Client Distribution Card
// =============================================================================

const ClientDistributionCard = memo(({ data }: { data: unknown }) => {
  const distribution = useMemo(() => {
    if (!data || typeof data !== 'object') return [];

    // Handle various data formats
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.distribution)) return d.distribution as Array<{ name: string; count: number }>;
    if (Array.isArray(d.clients)) {
      // Group clients by some property
      const clients = d.clients as Array<Record<string, unknown>>;
      const groups: Record<string, number> = {};
      clients.forEach(c => {
        const key = (c.os as string) || (c.manufacturer as string) || 'Unknown';
        groups[key] = (groups[key] || 0) + 1;
      });
      return Object.entries(groups).map(([name, count]) => ({ name, count }));
    }

    return [];
  }, [data]);

  if (distribution.length === 0) return <EmptyState message="No client data" />;

  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  const colors = ['bg-cyan-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500'];

  return (
    <div className="p-4 space-y-3">
      {distribution.slice(0, 5).map((item, idx) => {
        const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <div key={idx}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-300 truncate">{item.name}</span>
              <span className="text-slate-400">{item.count} ({percent}%)</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[idx % colors.length]} transition-all`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});
ClientDistributionCard.displayName = 'ClientDistributionCard';

// =============================================================================
// Performance Chart Card
// =============================================================================

const PerformanceChartCard = memo(({ data }: { data: unknown }) => {
  const metrics = useMemo(() => {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    return {
      latency: (d.latency as number) || (d.avgLatency as number) || 0,
      throughput: (d.throughput as number) || 0,
      packetLoss: (d.packetLoss as number) || (d.lossPercent as number) || 0,
    };
  }, [data]);

  if (!metrics) return <EmptyState />;

  return (
    <div className="p-4 grid grid-cols-3 gap-4 text-center">
      <div>
        <div className="text-2xl font-bold text-cyan-400">{metrics.latency}ms</div>
        <div className="text-xs text-slate-500">Latency</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-blue-400">{formatBytes(metrics.throughput)}/s</div>
        <div className="text-xs text-slate-500">Throughput</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-purple-400">{metrics.packetLoss}%</div>
        <div className="text-xs text-slate-500">Packet Loss</div>
      </div>
    </div>
  );
});
PerformanceChartCard.displayName = 'PerformanceChartCard';

// =============================================================================
// Security Events Card
// =============================================================================

const SecurityEventsCard = memo(({ data }: { data: unknown }) => {
  const events = useMemo(() => {
    if (Array.isArray(data)) return data.slice(0, 5);
    return [];
  }, [data]);

  if (events.length === 0) return <EmptyState message="No security events" />;

  return (
    <div className="overflow-auto h-full">
      <div className="space-y-2 p-2">
        {events.map((event: unknown, idx: number) => {
          const e = event as Record<string, unknown>;
          return (
            <div key={idx} className="p-2 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <StatusIndicator status={(e.severity as string) || 'info'} />
                <span className="text-sm text-white truncate">
                  {(e.message as string) || (e.type as string) || 'Security Event'}
                </span>
              </div>
              {typeof e.timestamp === 'string' && (
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(e.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
SecurityEventsCard.displayName = 'SecurityEventsCard';

// =============================================================================
// Custom/Generic Card
// =============================================================================

const CustomCard = memo(({ data }: { data: unknown }) => {
  const content = useMemo(() => {
    if (!data) return null;
    if (typeof data === 'string') return data;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return 'Unable to display data';
    }
  }, [data]);

  if (!content) return <EmptyState />;

  return (
    <div className="p-4 overflow-auto h-full w-full">
      <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all font-mono w-full max-w-full">{content}</pre>
    </div>
  );
});
CustomCard.displayName = 'CustomCard';

// =============================================================================
// Main Card Content Component
// =============================================================================

export const CardContent = memo(({ card, className = '' }: CardContentProps) => {
  // SmartCard stores data in data.current
  const cardData = card.data?.current;

  const renderContent = () => {
    // Map SmartCard types to legacy card renderers using string pattern matching
    const type = card.type as string;

    // Network health cards
    if (type.includes('health') || type.includes('status')) {
      return <NetworkHealthCard data={cardData} />;
    }

    // Device/table cards
    if (type.includes('device') || type.includes('inventory') || type.includes('table')) {
      return <DeviceTableCard data={cardData} />;
    }

    // Alert cards
    if (type.includes('alert') || type.includes('issue')) {
      return <AlertSummaryCard data={cardData} />;
    }

    // Client/distribution cards
    if (type.includes('client') || type.includes('ssid')) {
      return <ClientDistributionCard data={cardData} />;
    }

    // Performance/bandwidth cards
    if (type.includes('bandwidth') || type.includes('latency') || type.includes('performance')) {
      return <PerformanceChartCard data={cardData} />;
    }

    // Security cards
    if (type.includes('security')) {
      return <SecurityEventsCard data={cardData} />;
    }

    // Topology cards
    if (type.includes('topology') || type.includes('path')) {
      return <EmptyState message="Topology visualization" />;
    }

    // Default fallback
    return <CustomCard data={cardData} />;
  };

  return (
    <div className={`h-full w-full flex flex-col overflow-hidden max-w-full ${className}`}>
      {/* Header with drag handle */}
      <div className="drag-handle flex items-center justify-between px-4 py-3 border-b border-slate-700/50 cursor-move bg-slate-800/30 flex-shrink-0 w-full max-w-full">
        <div className="min-w-0 flex-1 overflow-hidden">
          <h3 className="text-sm font-medium text-white truncate">{card.title}</h3>
          {card.subtitle && (
            <p className="text-xs text-slate-500 truncate">{card.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <span className="text-xs text-slate-500 capitalize">
            {card.type.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0 w-full max-w-full">
        {renderContent()}
      </div>
    </div>
  );
});

CardContent.displayName = 'CardContent';

export default CardContent;
