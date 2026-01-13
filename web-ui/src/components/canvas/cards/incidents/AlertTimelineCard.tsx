'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { acknowledgeSecurityEvent, executeCardAction, type ActionState } from '@/services/cardActions';

interface TimelineAlert {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info' | 'resolved';
  timestamp: string;
  source?: string;
  category?: string;
  deviceName?: string;
  deviceSerial?: string;
  networkId?: string;
  networkName?: string;
  acknowledged?: boolean;
  resolvedAt?: string;
  correlationId?: string;
  actionsTaken?: string[];
  impact?: string;
}

interface AlertTimelineCardData {
  alerts?: TimelineAlert[];
  timeRange?: string;
  networkId?: string;
  organizationId?: string;
}

interface AlertTimelineCardProps {
  data: AlertTimelineCardData;
  config?: {
    showResolved?: boolean;
    groupByDay?: boolean;
  };
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; stroke: string; label: string }> = {
  critical: {
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-100 dark:bg-red-900/40',
    stroke: '#ef4444',
    label: 'Critical',
  },
  warning: {
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    stroke: '#f59e0b',
    label: 'Warning',
  },
  info: {
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    stroke: '#3b82f6',
    label: 'Info',
  },
  resolved: {
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    stroke: '#22c55e',
    label: 'Resolved',
  },
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return time.toLocaleDateString();
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * AlertTimelineCard - Visual Timeline with Actions
 *
 * Shows:
 * - Interactive timeline visualization
 * - Activity density mini-chart
 * - Severity filtering
 * - Click-to-expand with Acknowledge/Resolve/Suppress actions
 * - Correlated alert indicators
 */
export const AlertTimelineCard = memo(({ data, config }: AlertTimelineCardProps) => {
  const { demoMode } = useDemoMode();
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [hoveredAlert, setHoveredAlert] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<TimelineAlert | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    // Generate mock data if no real data and demo mode is enabled
    let sourceAlerts = data?.alerts || [];
    if (sourceAlerts.length === 0 && demoMode) {
      const now = new Date();
      sourceAlerts = [
        { id: 'alert-1', title: 'High CPU Usage', severity: 'critical' as const, timestamp: new Date(now.getTime() - 5 * 60000).toISOString(), source: 'Core-Switch-1', category: 'performance' },
        { id: 'alert-2', title: 'Link Down', severity: 'critical' as const, timestamp: new Date(now.getTime() - 15 * 60000).toISOString(), source: 'AP-Floor2-East', category: 'connectivity' },
        { id: 'alert-3', title: 'DHCP Pool Exhausted', severity: 'warning' as const, timestamp: new Date(now.getTime() - 30 * 60000).toISOString(), source: 'MX-Firewall', category: 'network' },
        { id: 'alert-4', title: 'Client Authentication Failed', severity: 'warning' as const, timestamp: new Date(now.getTime() - 45 * 60000).toISOString(), source: 'AP-Lobby', category: 'security' },
        { id: 'alert-5', title: 'Configuration Changed', severity: 'info' as const, timestamp: new Date(now.getTime() - 60 * 60000).toISOString(), source: 'MS-Access-1', category: 'audit' },
        { id: 'alert-6', title: 'Port Status Change', severity: 'info' as const, timestamp: new Date(now.getTime() - 90 * 60000).toISOString(), source: 'MS-Dist-1', category: 'connectivity' },
        { id: 'alert-7', title: 'High Bandwidth Usage', severity: 'warning' as const, timestamp: new Date(now.getTime() - 120 * 60000).toISOString(), source: 'Core-Switch-2', category: 'performance' },
        { id: 'alert-8', title: 'Firmware Update Available', severity: 'info' as const, timestamp: new Date(now.getTime() - 180 * 60000).toISOString(), source: 'MX-Firewall', category: 'system' },
      ];
    }

    if (sourceAlerts.length === 0) return null;

    // Filter and sort alerts
    let alerts = [...sourceAlerts];
    if (severityFilter) {
      alerts = alerts.filter(a => a.severity === severityFilter);
    }
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate stats
    const criticalCount = sourceAlerts.filter(a => a.severity === 'critical').length;
    const warningCount = sourceAlerts.filter(a => a.severity === 'warning').length;
    const infoCount = sourceAlerts.filter(a => a.severity === 'info').length;
    const resolvedCount = sourceAlerts.filter(a => a.severity === 'resolved').length;
    const unacknowledged = sourceAlerts.filter(a => !a.acknowledged && a.severity !== 'resolved').length;

    // Build hourly activity data for the last 24 hours
    const now = new Date();
    const hourlyActivity: { hour: number; count: number; severity: string }[] = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 3600000);
      const hourEnd = new Date(hourStart.getTime() + 3600000);
      const hourAlerts = sourceAlerts.filter(a => {
        const t = new Date(a.timestamp);
        return t >= hourStart && t < hourEnd;
      });
      const maxSeverity = hourAlerts.reduce((max, a) => {
        const order: Record<string, number> = { critical: 3, warning: 2, info: 1, resolved: 0 };
        return (order[a.severity] || 0) > (order[max] || 0) ? a.severity : max;
      }, 'resolved');
      hourlyActivity.push({
        hour: hourStart.getHours(),
        count: hourAlerts.length,
        severity: maxSeverity,
      });
    }

    // Find correlated alerts
    const correlationGroups: Record<string, TimelineAlert[]> = {};
    for (const alert of sourceAlerts) {
      if (alert.correlationId) {
        if (!correlationGroups[alert.correlationId]) {
          correlationGroups[alert.correlationId] = [];
        }
        correlationGroups[alert.correlationId].push(alert);
      }
    }

    return {
      alerts,
      allAlerts: sourceAlerts,
      total: sourceAlerts.length,
      criticalCount,
      warningCount,
      infoCount,
      resolvedCount,
      unacknowledged,
      hourlyActivity,
      correlationGroups,
    };
  }, [data, severityFilter, demoMode]);

  const handleAcknowledge = useCallback(async () => {
    if (!selectedAlert?.id) return;
    setActionState({ status: 'loading', message: 'Acknowledging...' });
    const result = await acknowledgeSecurityEvent({
      eventId: selectedAlert.id,
    });
    if (result.success) {
      setActionState({ status: 'success', message: 'Alert acknowledged' });
    } else {
      setActionState({ status: 'error', message: result.message });
    }
    setShowActions(false);
    setTimeout(() => setActionState({ status: 'idle' }), 3000);
  }, [selectedAlert]);

  const handleResolve = useCallback(async () => {
    if (!selectedAlert?.id) return;
    setActionState({ status: 'loading', message: 'Resolving...' });
    const result = await executeCardAction('resolve-alert', {
      alertId: selectedAlert.id,
      networkId: data?.networkId,
    });
    if (result.success) {
      setActionState({ status: 'success', message: 'Alert resolved' });
      setSelectedAlert(null);
    } else {
      setActionState({ status: 'error', message: result.message });
    }
    setShowActions(false);
    setTimeout(() => setActionState({ status: 'idle' }), 3000);
  }, [selectedAlert, data?.networkId]);

  const handleSuppress = useCallback(async () => {
    if (!selectedAlert?.title) return;
    setActionState({ status: 'loading', message: 'Suppressing...' });
    const result = await executeCardAction('suppress-alert', {
      alertTitle: selectedAlert.title,
      alertId: selectedAlert.id,
      networkId: data?.networkId,
    });
    if (result.success) {
      setActionState({ status: 'success', message: 'Similar alerts suppressed' });
    } else {
      setActionState({ status: 'error', message: result.message });
    }
    setShowActions(false);
    setTimeout(() => setActionState({ status: 'idle' }), 3000);
  }, [selectedAlert, data?.networkId]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No alerts to display
      </div>
    );
  }

  // SVG dimensions for activity chart
  const chartWidth = 300;
  const chartHeight = 40;
  const barWidth = chartWidth / 24 - 1;
  const maxCount = Math.max(...processedData.hourlyActivity.map(h => h.count), 1);

  return (
    <div className="h-full flex flex-col">
      {/* Header with severity filters */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Alert Timeline
          </span>
          {processedData.unacknowledged > 0 && (
            <span className="px-2 py-0.5 text-[9px] font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              {processedData.unacknowledged} new
            </span>
          )}
        </div>

        {/* Severity filter buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => setSeverityFilter(null)}
            className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
              !severityFilter
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            All ({processedData.total})
          </button>
          <button
            onClick={() => setSeverityFilter(severityFilter === 'critical' ? null : 'critical')}
            className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
              severityFilter === 'critical'
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {processedData.criticalCount}
          </button>
          <button
            onClick={() => setSeverityFilter(severityFilter === 'warning' ? null : 'warning')}
            className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
              severityFilter === 'warning'
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {processedData.warningCount}
          </button>
          <button
            onClick={() => setSeverityFilter(severityFilter === 'info' ? null : 'info')}
            className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
              severityFilter === 'info'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {processedData.infoCount}
          </button>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Last 24 Hours</div>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-10" preserveAspectRatio="xMidYMid meet">
          {/* Background */}
          <rect width={chartWidth} height={chartHeight} fill="transparent" />

          {/* Hour bars */}
          {processedData.hourlyActivity.map((hour, idx) => {
            const barHeight = (hour.count / maxCount) * (chartHeight - 10);
            const x = idx * (chartWidth / 24);
            const y = chartHeight - barHeight - 2;
            const severity = SEVERITY_CONFIG[hour.severity] || SEVERITY_CONFIG.info;

            return (
              <g key={idx}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={hour.count > 0 ? severity.stroke : '#e2e8f0'}
                  rx="1"
                  opacity={hour.count > 0 ? 0.7 : 0.3}
                />
                {/* Hour label every 6 hours */}
                {idx % 6 === 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight}
                    fontSize="7"
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {hour.hour}h
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Alert List */}
      {selectedAlert ? (
        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-800">
          {showActions ? (
            <div className="p-3">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-3">
                Actions for: {selectedAlert.title}
              </div>
              <div className="space-y-2">
                {!selectedAlert.acknowledged && (
                  <button
                    onClick={handleAcknowledge}
                    className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Acknowledge
                  </button>
                )}
                {selectedAlert.severity !== 'resolved' && (
                  <button
                    onClick={handleResolve}
                    className="w-full px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Mark Resolved
                  </button>
                )}
                <button
                  onClick={handleSuppress}
                  className="w-full px-3 py-2 bg-slate-500 hover:bg-slate-600 text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Suppress Similar
                </button>
                <button
                  onClick={() => setShowActions(false)}
                  className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: SEVERITY_CONFIG[selectedAlert.severity].stroke }}
                    />
                    <span className={`text-xs font-medium ${SEVERITY_CONFIG[selectedAlert.severity].color}`}>
                      {SEVERITY_CONFIG[selectedAlert.severity].label}
                    </span>
                    {selectedAlert.acknowledged && (
                      <span className="px-1.5 py-0.5 text-[8px] font-medium rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        ACK
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">
                    {selectedAlert.title}
                  </div>
                  {selectedAlert.description && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {selectedAlert.description}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
                <div>
                  <span className="text-slate-500">Time:</span>
                  <span className="ml-1 text-slate-700 dark:text-slate-300">{formatTime(selectedAlert.timestamp)}</span>
                </div>
                {selectedAlert.source && (
                  <div>
                    <span className="text-slate-500">Source:</span>
                    <span className="ml-1 text-slate-700 dark:text-slate-300">{selectedAlert.source}</span>
                  </div>
                )}
                {selectedAlert.deviceName && (
                  <div>
                    <span className="text-slate-500">Device:</span>
                    <span className="ml-1 text-slate-700 dark:text-slate-300">{selectedAlert.deviceName}</span>
                  </div>
                )}
                {selectedAlert.category && (
                  <div>
                    <span className="text-slate-500">Category:</span>
                    <span className="ml-1 text-slate-700 dark:text-slate-300">{selectedAlert.category}</span>
                  </div>
                )}
              </div>

              {selectedAlert.impact && (
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-[10px] text-amber-700 dark:text-amber-300">
                  <span className="font-medium">Impact:</span> {selectedAlert.impact}
                </div>
              )}

              {/* Correlated alerts */}
              {selectedAlert.correlationId && processedData.correlationGroups[selectedAlert.correlationId]?.length > 1 && (
                <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                  <div className="text-[10px] font-medium text-purple-700 dark:text-purple-300 mb-1">
                    Correlated Alerts ({processedData.correlationGroups[selectedAlert.correlationId].length - 1} related)
                  </div>
                  <div className="space-y-1">
                    {processedData.correlationGroups[selectedAlert.correlationId]
                      .filter(a => a.id !== selectedAlert.id)
                      .slice(0, 2)
                      .map(alert => (
                        <div
                          key={alert.id}
                          className="text-[9px] text-purple-600 dark:text-purple-400 truncate cursor-pointer hover:underline"
                          onClick={() => setSelectedAlert(alert)}
                        >
                          {alert.title}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowActions(true)}
                className="mt-3 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Take Action
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />

            <div className="p-2 space-y-1">
              {processedData.alerts.slice(0, 20).map((alert, idx) => {
                const severityConfig = SEVERITY_CONFIG[alert.severity];
                const isHovered = hoveredAlert === alert.id;
                const hasCorrelation = alert.correlationId && processedData.correlationGroups[alert.correlationId]?.length > 1;

                return (
                  <div
                    key={alert.id || idx}
                    className={`relative pl-8 pr-2 py-1.5 rounded cursor-pointer transition-all ${
                      isHovered ? 'bg-slate-100 dark:bg-slate-700' : ''
                    }`}
                    onMouseEnter={() => setHoveredAlert(alert.id)}
                    onMouseLeave={() => setHoveredAlert(null)}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    {/* Timeline dot */}
                    <div
                      className="absolute left-2 top-3 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: isHovered ? severityConfig.stroke : 'transparent',
                        borderColor: severityConfig.stroke,
                      }}
                    >
                      {alert.severity === 'critical' && !isHovered && (
                        <span className="absolute w-4 h-4 rounded-full" style={{ backgroundColor: severityConfig.stroke, opacity: 0.4 }} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-medium ${severityConfig.color} truncate`}>
                            {alert.title}
                          </span>
                          {hasCorrelation && (
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[8px] flex items-center justify-center">
                              {processedData.correlationGroups[alert.correlationId!].length}
                            </span>
                          )}
                          {alert.acknowledged && (
                            <svg className="w-3 h-3 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400">
                          <span>{formatTime(alert.timestamp)}</span>
                          {alert.source && <span>• {alert.source}</span>}
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-400 flex-shrink-0">
                        {formatTimeAgo(alert.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {processedData.alerts.length > 20 && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center py-2 pl-8">
                +{processedData.alerts.length - 20} more alerts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Feedback */}
      {actionState.status !== 'idle' && (
        <div className={`flex-shrink-0 px-3 py-1 flex items-center gap-2 text-[10px] ${
          actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
          actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' :
          'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {actionState.status === 'loading' && (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {actionState.status === 'success' && <span>✓</span>}
          {actionState.status === 'error' && <span>✗</span>}
          <span>{actionState.message}</span>
        </div>
      )}

      {/* Footer with legend */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between text-[8px]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Critical
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Warning
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Info
            </span>
          </div>
          <span className="text-slate-400">Click for actions</span>
        </div>
      </div>
    </div>
  );
});

AlertTimelineCard.displayName = 'AlertTimelineCard';

export default AlertTimelineCard;
