'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, createIncident, type ActionState } from '@/services/cardActions';

interface CorrelatedAlert {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  source?: string;
  deviceSerial?: string;
  deviceName?: string;
}

interface AlertCluster {
  id: string;
  name: string;
  description?: string;
  rootCause?: string;
  confidence: number;
  alerts: CorrelatedAlert[];
  affectedDevices: number;
  affectedNetworks: number;
  firstSeen: string;
  lastSeen: string;
  severity: 'critical' | 'warning' | 'info';
  status?: 'active' | 'investigating' | 'resolved';
}

interface AlertCorrelationCardData {
  clusters?: AlertCluster[];
  totalAlerts?: number;
  correlatedAlerts?: number;
  uncorrelatedAlerts?: number;
  networkId?: string;
  organizationId?: string;
}

interface AlertCorrelationCardProps {
  data: AlertCorrelationCardData;
  config?: {
    showUncorrelated?: boolean;
  };
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; stroke: string }> = {
  critical: { color: '#ef4444', bg: '#fecaca', stroke: '#dc2626' },
  warning: { color: '#f59e0b', bg: '#fef3c7', stroke: '#d97706' },
  info: { color: '#3b82f6', bg: '#dbeafe', stroke: '#2563eb' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: '#ef4444', label: 'Active' },
  investigating: { color: '#f59e0b', label: 'Investigating' },
  resolved: { color: '#22c55e', label: 'Resolved' },
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

type ViewMode = 'graph' | 'list';

/**
 * AlertCorrelationCard - Interactive correlation graph with cluster management
 */
export const AlertCorrelationCard = memo(({ data }: AlertCorrelationCardProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const { demoMode } = useDemoMode();
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    // Generate mock data when no clusters available
    const mockClusters: AlertCluster[] = [
      {
        id: '1', name: 'Network Connectivity Issue', rootCause: 'ISP outage affecting primary link',
        confidence: 92, severity: 'critical', status: 'active', affectedDevices: 15, affectedNetworks: 3,
        firstSeen: new Date(Date.now() - 45 * 60000).toISOString(),
        lastSeen: new Date(Date.now() - 5 * 60000).toISOString(),
        alerts: [
          { id: 'a1', title: 'Uplink down on Core-SW-1', severity: 'critical', timestamp: new Date(Date.now() - 45 * 60000).toISOString() },
          { id: 'a2', title: 'High latency detected', severity: 'warning', timestamp: new Date(Date.now() - 40 * 60000).toISOString() },
          { id: 'a3', title: 'OSPF neighbor lost', severity: 'critical', timestamp: new Date(Date.now() - 35 * 60000).toISOString() },
          { id: 'a4', title: 'BGP session down', severity: 'critical', timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
        ],
      },
      {
        id: '2', name: 'Wireless Capacity Exhaustion', rootCause: 'High client density on APs',
        confidence: 78, severity: 'warning', status: 'investigating', affectedDevices: 8, affectedNetworks: 1,
        firstSeen: new Date(Date.now() - 120 * 60000).toISOString(),
        lastSeen: new Date(Date.now() - 15 * 60000).toISOString(),
        alerts: [
          { id: 'b1', title: 'Channel utilization > 80%', severity: 'warning', timestamp: new Date(Date.now() - 120 * 60000).toISOString() },
          { id: 'b2', title: 'Client association failures', severity: 'warning', timestamp: new Date(Date.now() - 100 * 60000).toISOString() },
          { id: 'b3', title: 'Interference detected', severity: 'info', timestamp: new Date(Date.now() - 60 * 60000).toISOString() },
        ],
      },
      {
        id: '3', name: 'Security Event Cluster', rootCause: 'Unauthorized access attempts',
        confidence: 85, severity: 'critical', status: 'investigating', affectedDevices: 5, affectedNetworks: 2,
        firstSeen: new Date(Date.now() - 180 * 60000).toISOString(),
        lastSeen: new Date(Date.now() - 30 * 60000).toISOString(),
        alerts: [
          { id: 'c1', title: 'Failed login attempts', severity: 'warning', timestamp: new Date(Date.now() - 180 * 60000).toISOString() },
          { id: 'c2', title: 'Rogue AP detected', severity: 'critical', timestamp: new Date(Date.now() - 120 * 60000).toISOString() },
        ],
      },
      {
        id: '4', name: 'Certificate Expiry', rootCause: 'SSL certificates expiring soon',
        confidence: 95, severity: 'info', status: 'active', affectedDevices: 3, affectedNetworks: 1,
        firstSeen: new Date(Date.now() - 240 * 60000).toISOString(),
        lastSeen: new Date(Date.now() - 60 * 60000).toISOString(),
        alerts: [
          { id: 'd1', title: 'Certificate expires in 7 days', severity: 'info', timestamp: new Date(Date.now() - 240 * 60000).toISOString() },
        ],
      },
    ];

    // Use mock data if demo mode is on and no real clusters available
    if (demoMode && (!data?.clusters || data.clusters.length === 0)) {
      return processClusters(mockClusters);
    }

    // Return null if no data and demo mode is off
    if (!data?.clusters || data.clusters.length === 0) {
      return null;
    }

    return processClusters(data.clusters);
  }, [data, demoMode]);

  function processClusters(clusters: AlertCluster[]) {
    const sorted = [...clusters].sort((a, b) => {
      const severityOrder = ['critical', 'warning', 'info'];
      const severityDiff = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      if (severityDiff !== 0) return severityDiff;
      return b.alerts.length - a.alerts.length;
    });

    const correlatedCount = data?.correlatedAlerts ?? sorted.reduce((sum, c) => sum + c.alerts.length, 0);
    const totalCount = data?.totalAlerts ?? correlatedCount + (data?.uncorrelatedAlerts ?? 0);
    const correlationRate = totalCount > 0 ? Math.round((correlatedCount / totalCount) * 100) : 0;

    return {
      clusters: sorted,
      totalAlerts: totalCount,
      correlatedAlerts: correlatedCount,
      uncorrelatedAlerts: data?.uncorrelatedAlerts ?? 0,
      correlationRate,
      criticalCount: sorted.filter(c => c.severity === 'critical').length,
      activeCount: sorted.filter(c => c.status === 'active').length,
    };
  }

  const filteredClusters = useMemo(() => {
    if (!processedData) return [];
    if (!severityFilter) return processedData.clusters;
    return processedData.clusters.filter(c => c.severity === severityFilter);
  }, [processedData, severityFilter]);

  const selectedClusterData = useMemo(() => {
    if (!selectedCluster || !processedData) return null;
    return processedData.clusters.find(c => c.id === selectedCluster);
  }, [selectedCluster, processedData]);

  const handleAction = useCallback(async (action: string, clusterId?: string) => {
    setActionState({ status: 'loading', message: `Executing ${action}...` });
    try {
      switch (action) {
        case 'investigate': {
          const result = await executeCardAction('investigate-cluster', {
            clusterId,
            networkId: data?.networkId,
          });
          if (result.success) {
            setActionState({ status: 'success', message: 'Investigation started' });
          } else {
            setActionState({ status: 'error', message: result.message });
          }
          break;
        }
        case 'incident': {
          const cluster = processedData?.clusters.find(c => c.id === clusterId);
          const result = await createIncident({
            title: cluster?.name || 'Correlated Alert Cluster',
            description: cluster?.rootCause || 'Multiple correlated alerts detected',
            priority: cluster?.severity === 'critical' ? 'critical' : 'medium',
          });
          if (result.success) {
            setActionState({ status: 'success', message: 'Incident created' });
          } else {
            setActionState({ status: 'error', message: result.message });
          }
          break;
        }
        case 'dismiss': {
          const result = await executeCardAction('dismiss-cluster', {
            clusterId,
            networkId: data?.networkId,
          });
          if (result.success) {
            setActionState({ status: 'success', message: 'Cluster dismissed' });
            setSelectedCluster(null);
          } else {
            setActionState({ status: 'error', message: result.message });
          }
          break;
        }
        case 'refresh': {
          const result = await executeCardAction('refresh-correlation', {
            networkId: data?.networkId,
          });
          if (result.success) {
            setActionState({ status: 'success', message: 'Refreshed' });
          } else {
            setActionState({ status: 'error', message: result.message });
          }
          break;
        }
        default:
          setActionState({ status: 'error', message: 'Unknown action' });
      }
    } catch {
      setActionState({ status: 'error', message: 'Action failed' });
    }
    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [data?.networkId, processedData?.clusters]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No correlated alerts
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Alert Correlation
            </span>
            {processedData.activeCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                {processedData.activeCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                viewMode === 'graph'
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Severity Filter */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 flex gap-1">
        <button
          onClick={() => setSeverityFilter(null)}
          className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
            !severityFilter ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : 'text-slate-500'
          }`}
        >
          All ({processedData.clusters.length})
        </button>
        <button
          onClick={() => setSeverityFilter('critical')}
          className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
            severityFilter === 'critical' ? 'bg-red-100 text-red-700' : 'text-red-600'
          }`}
        >
          Critical
        </button>
        <button
          onClick={() => setSeverityFilter('warning')}
          className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
            severityFilter === 'warning' ? 'bg-amber-100 text-amber-700' : 'text-amber-600'
          }`}
        >
          Warning
        </button>
        <button
          onClick={() => setSeverityFilter('info')}
          className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
            severityFilter === 'info' ? 'bg-blue-100 text-blue-700' : 'text-blue-600'
          }`}
        >
          Info
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-2">
        {selectedCluster && selectedClusterData ? (
          /* Detail View */
          <div className="h-full flex flex-col">
            <button
              onClick={() => setSelectedCluster(null)}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back to overview
            </button>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {/* Cluster Header */}
              <div className="flex items-start gap-2">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: SEVERITY_CONFIG[selectedClusterData.severity].color }}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {selectedClusterData.name}
                  </div>
                  {selectedClusterData.rootCause && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Root cause: {selectedClusterData.rootCause}
                    </div>
                  )}
                </div>
                <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded`} style={{
                  backgroundColor: SEVERITY_CONFIG[selectedClusterData.severity].bg,
                  color: SEVERITY_CONFIG[selectedClusterData.severity].stroke,
                }}>
                  {selectedClusterData.confidence}% confidence
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1.5 text-center">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedClusterData.alerts.length}</div>
                  <div className="text-[8px] text-slate-500 dark:text-slate-400">Alerts</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1.5 text-center">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedClusterData.affectedDevices}</div>
                  <div className="text-[8px] text-slate-500 dark:text-slate-400">Devices</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1.5 text-center">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedClusterData.affectedNetworks}</div>
                  <div className="text-[8px] text-slate-500 dark:text-slate-400">Networks</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1.5 text-center">
                  <div className="text-sm font-bold" style={{ color: STATUS_CONFIG[selectedClusterData.status || 'active'].color }}>
                    {STATUS_CONFIG[selectedClusterData.status || 'active'].label}
                  </div>
                  <div className="text-[8px] text-slate-500 dark:text-slate-400">Status</div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 mb-1">
                  <span>First: {formatTimeAgo(selectedClusterData.firstSeen)}</span>
                  <span>Last: {formatTimeAgo(selectedClusterData.lastSeen)}</span>
                </div>
                <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded">
                  <div
                    className="h-full rounded"
                    style={{
                      width: '100%',
                      background: `linear-gradient(to right, ${SEVERITY_CONFIG[selectedClusterData.severity].bg}, ${SEVERITY_CONFIG[selectedClusterData.severity].color})`,
                    }}
                  />
                </div>
              </div>

              {/* All Alerts */}
              <div>
                <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  All Alerts ({selectedClusterData.alerts.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {selectedClusterData.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center gap-2 p-1.5 bg-white dark:bg-slate-800 rounded text-[10px]"
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: SEVERITY_CONFIG[alert.severity].color }}
                      />
                      <span className="flex-1 text-slate-700 dark:text-slate-300 truncate">{alert.title}</span>
                      <span className="text-slate-400 flex-shrink-0">{formatTimeAgo(alert.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'graph' ? (
          /* Graph View */
          <div className="h-full flex flex-col">
            <svg viewBox="0 0 280 160" className="w-full flex-1">
              {/* Correlation lines */}
              {filteredClusters.slice(0, 6).map((cluster, i) => {
                const angle = (i / Math.min(filteredClusters.length, 6)) * 2 * Math.PI - Math.PI / 2;
                const radius = 55;
                const cx = 140 + radius * Math.cos(angle);
                const cy = 80 + radius * Math.sin(angle);

                return (
                  <line
                    key={`line-${cluster.id}`}
                    x1="140" y1="80"
                    x2={cx} y2={cy}
                    stroke={SEVERITY_CONFIG[cluster.severity].color}
                    strokeWidth={hoveredCluster === cluster.id ? 3 : 2}
                    strokeDasharray={cluster.status === 'resolved' ? '4,2' : 'none'}
                    opacity={hoveredCluster === null || hoveredCluster === cluster.id ? 0.6 : 0.2}
                    className="transition-all"
                  />
                );
              })}

              {/* Central hub */}
              <circle
                cx="140" cy="80" r="16"
                fill="#8b5cf6"
                className="cursor-pointer"
                onClick={() => setSelectedCluster(null)}
              />
              <text x="140" y="84" textAnchor="middle" className="text-[9px] fill-white font-bold pointer-events-none">
                {processedData.correlationRate}%
              </text>

              {/* Cluster nodes */}
              {filteredClusters.slice(0, 6).map((cluster, i) => {
                const angle = (i / Math.min(filteredClusters.length, 6)) * 2 * Math.PI - Math.PI / 2;
                const radius = 55;
                const cx = 140 + radius * Math.cos(angle);
                const cy = 80 + radius * Math.sin(angle);
                const nodeSize = 10 + Math.min(cluster.alerts.length * 2, 12);
                const isHovered = hoveredCluster === cluster.id;
                const isActive = cluster.status === 'active';

                return (
                  <g
                    key={cluster.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredCluster(cluster.id)}
                    onMouseLeave={() => setHoveredCluster(null)}
                    onClick={() => setSelectedCluster(cluster.id)}
                  >
                    {/* Pulse for active */}
                    {isActive && (
                      <circle
                        cx={cx} cy={cy}
                        r={nodeSize + 4}
                        fill={SEVERITY_CONFIG[cluster.severity].color}
                        opacity="0.3"
                        className=""
                      />
                    )}
                    {/* Node */}
                    <circle
                      cx={cx} cy={cy}
                      r={isHovered ? nodeSize + 3 : nodeSize}
                      fill={SEVERITY_CONFIG[cluster.severity].color}
                      opacity={hoveredCluster === null || isHovered ? 1 : 0.5}
                      className="transition-all"
                    />
                    {/* Alert count */}
                    <text
                      x={cx} y={cy + 3}
                      textAnchor="middle"
                      className="text-[8px] fill-white font-bold pointer-events-none"
                    >
                      {cluster.alerts.length}
                    </text>
                  </g>
                );
              })}

              {/* Hover tooltip */}
              {hoveredCluster && (() => {
                const cluster = filteredClusters.find(c => c.id === hoveredCluster);
                if (!cluster) return null;
                return (
                  <g>
                    <rect x="5" y="130" width="270" height="28" rx="4" fill="white" stroke="#e2e8f0" />
                    <text x="10" y="143" className="text-[8px] fill-slate-800 font-medium">{cluster.name}</text>
                    <text x="10" y="154" className="text-[7px] fill-slate-500">
                      {cluster.alerts.length} alerts • {cluster.affectedDevices} devices • {cluster.confidence}% conf
                    </text>
                  </g>
                );
              })()}
            </svg>

            {/* Stats Summary */}
            <div className="flex-shrink-0 grid grid-cols-3 gap-1 mt-1">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-1 text-center">
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400">{processedData.correlationRate}%</div>
                <div className="text-[8px] text-purple-700 dark:text-purple-300">Correlated</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{processedData.correlatedAlerts}</div>
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Grouped</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{processedData.uncorrelatedAlerts}</div>
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Standalone</div>
              </div>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="h-full overflow-y-auto space-y-2">
            {filteredClusters.map((cluster) => {
              const isHovered = hoveredCluster === cluster.id;

              return (
                <div
                  key={cluster.id}
                  className={`p-2 rounded border cursor-pointer transition-all ${
                    isHovered ? 'shadow-md' : ''
                  }`}
                  style={{
                    borderColor: SEVERITY_CONFIG[cluster.severity].color,
                    backgroundColor: isHovered ? SEVERITY_CONFIG[cluster.severity].bg : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredCluster(cluster.id)}
                  onMouseLeave={() => setHoveredCluster(null)}
                  onClick={() => setSelectedCluster(cluster.id)}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: SEVERITY_CONFIG[cluster.severity].color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {cluster.name}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>{cluster.alerts.length} alerts</span>
                        <span>•</span>
                        <span>{cluster.confidence}% conf</span>
                        <span>•</span>
                        <span style={{ color: STATUS_CONFIG[cluster.status || 'active'].color }}>
                          {STATUS_CONFIG[cluster.status || 'active'].label}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400 flex-shrink-0">
                      {formatTimeAgo(cluster.lastSeen)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Feedback */}
      {actionState.status !== 'idle' && (
        <div className={`flex-shrink-0 px-2 py-1 flex items-center gap-2 text-[10px] ${
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

      {/* Actions Footer */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex gap-1">
          {selectedCluster ? (
            <>
              <button
                onClick={() => handleAction('investigate', selectedCluster)}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Investigate
              </button>
              <button
                onClick={() => handleAction('incident', selectedCluster)}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
              >
                Create Incident
              </button>
              <button
                onClick={() => handleAction('dismiss', selectedCluster)}
                className="px-2 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Dismiss
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleAction('refresh')}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={() => handleAction('settings')}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
              >
                Settings
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

AlertCorrelationCard.displayName = 'AlertCorrelationCard';

export default AlertCorrelationCard;
