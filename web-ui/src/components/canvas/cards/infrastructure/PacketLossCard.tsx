'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface PacketLossDataPoint {
  timestamp: string;
  loss: number;
  utilization?: number;
}

interface AffectedApplication {
  name: string;
  impactLevel: 'severe' | 'moderate' | 'minimal';
  retransmissions?: number;
}

interface InterfaceStats {
  name: string;
  inErrors: number;
  outErrors: number;
  crcErrors: number;
  collisions: number;
  drops: number;
}

interface PacketLossCardData {
  current: number;
  average?: number;
  history?: PacketLossDataPoint[];
  uplink?: string;
  target?: string;
  networkId?: string;
  deviceSerial?: string;
  retransmissionRate?: number;
  affectedApps?: AffectedApplication[];
  interfaceStats?: InterfaceStats;
  correlatedIssue?: string;
}

interface PacketLossCardProps {
  data: PacketLossCardData;
  config?: {
    thresholds?: {
      warning: number;
      critical: number;
    };
  };
}

type ViewMode = 'overview' | 'details' | 'apps';

const IMPACT_CONFIG = {
  severe: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/40',
    label: 'Severe'
  },
  moderate: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    label: 'Moderate'
  },
  minimal: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    label: 'Minimal'
  },
};

const ROOT_CAUSE_SUGGESTIONS: Record<string, string[]> = {
  congestion: [
    'Network utilization exceeding 80%',
    'Consider QoS policy adjustment',
    'Upgrade bandwidth or add link'
  ],
  hardware: [
    'High CRC errors indicate cable/connector issue',
    'Check physical connections',
    'Replace suspect cables'
  ],
  config: [
    'Duplex mismatch detected',
    'MTU size may be incorrect',
    'Check interface configuration'
  ],
  normal: [
    'Loss within acceptable range',
    'Continue monitoring'
  ]
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * PacketLossCard - Comprehensive packet loss analysis
 *
 * Features:
 * - Affected applications with impact levels
 * - Time-series with utilization correlation
 * - Interface error breakdown
 * - Retransmission rate tracking
 * - Root cause suggestions
 * - "Capture Packets" action
 */
export const PacketLossCard = memo(({ data, config }: PacketLossCardProps) => {
  const thresholds = config?.thresholds ?? { warning: 1, critical: 5 };
  const { demoMode } = useDemoMode();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const processedData = useMemo(() => {
    // Generate mock data if no real data available and demo mode is enabled
    const mockData = (demoMode && (!data || data.current === undefined)) ? (() => {
      const now = new Date();
      const history: PacketLossDataPoint[] = Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(now.getTime() - (23 - i) * 5 * 60000).toISOString(),
        loss: Math.random() * 2 + (i > 18 ? Math.random() * 3 : 0),
        utilization: 40 + Math.random() * 40 + (i > 18 ? 20 : 0),
      }));
      return {
        current: 1.8,
        average: 0.9,
        history,
        uplink: 'WAN1',
        target: '8.8.8.8',
        retransmissionRate: 2.3,
        affectedApps: [
          { name: 'VoIP/SIP', impactLevel: 'moderate' as const, retransmissions: 45 },
          { name: 'Video Conference', impactLevel: 'minimal' as const, retransmissions: 12 },
          { name: 'File Transfer', impactLevel: 'minimal' as const, retransmissions: 8 },
        ],
        interfaceStats: {
          name: 'GigabitEthernet0/0',
          inErrors: 23,
          outErrors: 5,
          crcErrors: 12,
          collisions: 3,
          drops: 156,
        },
        correlatedIssue: 'Elevated traffic during business hours',
      };
    })() : data;

    const current = mockData.current ?? 0;
    const history = mockData.history ?? [];
    const avg = mockData.average ?? (history.length > 0
      ? history.reduce((a, b) => a + b.loss, 0) / history.length
      : current);

    // Determine status
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (current >= thresholds.critical) {
      status = 'critical';
    } else if (current >= thresholds.warning) {
      status = 'warning';
    }

    // Determine root cause
    let rootCause: 'congestion' | 'hardware' | 'config' | 'normal' = 'normal';
    const avgUtilization = history.length > 0
      ? history.reduce((sum, h) => sum + (h.utilization || 0), 0) / history.length
      : 0;

    if (avgUtilization > 80 && current > thresholds.warning) {
      rootCause = 'congestion';
    } else if (mockData.interfaceStats && (mockData.interfaceStats.crcErrors > 100 || mockData.interfaceStats.collisions > 50)) {
      rootCause = 'hardware';
    } else if (current > thresholds.critical) {
      rootCause = 'config';
    }

    // Calculate peak loss
    const peakLoss = history.length > 0 ? Math.max(...history.map(h => h.loss)) : current;
    const peakTime = history.length > 0
      ? history.find(h => h.loss === peakLoss)?.timestamp
      : null;

    return {
      current,
      average: avg,
      history,
      status,
      rootCause,
      peakLoss,
      peakTime,
      retransmissionRate: mockData.retransmissionRate ?? 0,
      affectedApps: mockData.affectedApps ?? [],
      interfaceStats: mockData.interfaceStats,
      correlatedIssue: mockData.correlatedIssue,
    };
  }, [data, thresholds]);

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleAction = useCallback(async (action: string) => {
    const serial = data?.deviceSerial;
    const target = data?.target || '8.8.8.8';

    if (!serial) {
      setActionFeedback('Device serial not available');
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }

    setActionFeedback('Processing...');

    try {
      if (action === 'capture') {
        // Run a ping test to diagnose connectivity
        const response = await fetch('/api/actions/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ serial, target, count: 5 }),
        });

        const result = await response.json();
        if (result.success) {
          const pingData = result.data;
          setActionFeedback(`Ping: ${pingData.received}/${pingData.sent} received, ${pingData.loss}% loss`);
        } else {
          setActionFeedback(result.error || 'Ping test failed');
        }
      } else if (action === 'alert') {
        // For now, show that alert would be configured
        setActionFeedback('Alert threshold would be configured (UI coming soon)');
      }
    } catch (error) {
      setActionFeedback(error instanceof Error ? error.message : 'Action failed');
    }

    setTimeout(() => setActionFeedback(null), 5000);
  }, [data?.deviceSerial, data?.target]);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <svg className="w-12 h-12 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span className="text-sm">No packet loss data</span>
      </div>
    );
  }

  const statusColors = {
    good: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', ring: 'ring-emerald-500' },
    warning: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', ring: 'ring-amber-500' },
    critical: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', ring: 'ring-red-500' },
  };

  const currentColor = statusColors[processedData.status];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Packet Loss
            </span>
            {data?.uplink && (
              <span className="px-1.5 py-0.5 text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                {data?.uplink}
              </span>
            )}
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
            {(['overview', 'details', 'apps'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-1.5 py-0.5 text-[9px] transition-colors ${
                  viewMode === mode
                    ? `${currentColor.bg} text-white`
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {mode === 'overview' ? 'Overview' : mode === 'details' ? 'Errors' : 'Apps'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main gauge and stats */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          {/* Main gauge */}
          <div className="relative">
            <svg viewBox="0 0 80 50" className="w-24 h-14">
              {/* Background arc */}
              <path
                d="M 10 45 A 35 35 0 0 1 70 45"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                className="text-slate-200 dark:text-slate-700"
              />
              {/* Value arc */}
              <path
                d="M 10 45 A 35 35 0 0 1 70 45"
                fill="none"
                stroke={processedData.status === 'critical' ? '#ef4444' : processedData.status === 'warning' ? '#f59e0b' : '#10b981'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(processedData.current / 10, 1) * 110} 110`}
              />
              {/* Value text */}
              <text x="40" y="42" textAnchor="middle" className="text-lg font-bold fill-slate-700 dark:fill-slate-200">
                {processedData.current.toFixed(2)}%
              </text>
            </svg>
            {processedData.status === 'critical' && (
              <div className={`absolute -top-1 -right-1 w-3 h-3 ${currentColor.bg} rounded-full`} />
            )}
          </div>

          {/* Stats */}
          <div className="flex-1 grid grid-cols-2 gap-2 ml-4">
            <div className="text-center p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Avg</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {processedData.average.toFixed(2)}%
              </div>
            </div>
            <div className="text-center p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Peak</div>
              <div className={`text-sm font-bold tabular-nums ${processedData.peakLoss > thresholds.critical ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {processedData.peakLoss.toFixed(2)}%
              </div>
            </div>
            <div className="text-center p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Retrans</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {processedData.retransmissionRate.toFixed(1)}%
              </div>
            </div>
            <div className="text-center p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Trend</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {processedData.history.length > 1
                  ? processedData.history[processedData.history.length - 1].loss > processedData.history[0].loss
                    ? '↑' : '↓'
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'overview' && (
          <div className="p-3">
            {/* Time series */}
            {processedData.history.length > 0 && (
              <div className="mb-3">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">Loss Over Time</div>
                <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="w-full h-16">
                  {/* Threshold lines */}
                  <line x1="0" y1={50 - (thresholds.warning / 10) * 50} x2="200" y2={50 - (thresholds.warning / 10) * 50}
                    stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 2" />
                  <line x1="0" y1={50 - (thresholds.critical / 10) * 50} x2="200" y2={50 - (thresholds.critical / 10) * 50}
                    stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2 2" />

                  {/* Loss area */}
                  <path
                    d={`M 0 50 ${processedData.history.map((h, i) => {
                      const x = (i / (processedData.history.length - 1)) * 200;
                      const y = 50 - Math.min(h.loss / 10, 1) * 50;
                      return `L ${x} ${y}`;
                    }).join(' ')} L 200 50 Z`}
                    fill="url(#lossGradient)"
                  />
                  <defs>
                    <linearGradient id="lossGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={processedData.status === 'critical' ? '#ef4444' : processedData.status === 'warning' ? '#f59e0b' : '#10b981'} stopOpacity="0.5" />
                      <stop offset="100%" stopColor={processedData.status === 'critical' ? '#ef4444' : processedData.status === 'warning' ? '#f59e0b' : '#10b981'} stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {/* Loss line */}
                  <path
                    d={`M ${processedData.history.map((h, i) => {
                      const x = (i / (processedData.history.length - 1)) * 200;
                      const y = 50 - Math.min(h.loss / 10, 1) * 50;
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ')}`}
                    fill="none"
                    stroke={processedData.status === 'critical' ? '#ef4444' : processedData.status === 'warning' ? '#f59e0b' : '#10b981'}
                    strokeWidth="1.5"
                  />

                  {/* Utilization overlay (if available) */}
                  {processedData.history.some(h => h.utilization !== undefined) && (
                    <path
                      d={`M ${processedData.history.map((h, i) => {
                        const x = (i / (processedData.history.length - 1)) * 200;
                        const y = 50 - ((h.utilization || 0) / 100) * 50;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}`}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.6"
                    />
                  )}

                  {/* Data points */}
                  {processedData.history.map((h, i) => {
                    const x = (i / (processedData.history.length - 1)) * 200;
                    const y = 50 - Math.min(h.loss / 10, 1) * 50;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={selectedPoint === i ? 4 : 2}
                        fill={h.loss >= thresholds.critical ? '#ef4444' : h.loss >= thresholds.warning ? '#f59e0b' : '#10b981'}
                        className="cursor-pointer"
                        onClick={() => setSelectedPoint(selectedPoint === i ? null : i)}
                      />
                    );
                  })}
                </svg>
                <div className="flex justify-between text-[8px] text-slate-400 dark:text-slate-500 mt-0.5">
                  <span>{processedData.history.length > 0 && formatTime(processedData.history[0].timestamp)}</span>
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5"><span className="w-2 h-0.5 bg-current rounded" /> Loss</span>
                    <span className="flex items-center gap-0.5 text-blue-500"><span className="w-2 h-0.5 bg-current rounded" style={{ borderStyle: 'dashed' }} /> Util</span>
                  </span>
                  <span>{processedData.history.length > 0 && formatTime(processedData.history[processedData.history.length - 1].timestamp)}</span>
                </div>
              </div>
            )}

            {/* Root cause analysis */}
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">Root Cause Analysis</div>
              <div className={`text-xs font-medium mb-1 ${currentColor.text}`}>
                {processedData.rootCause === 'congestion' ? 'Possible Congestion' :
                 processedData.rootCause === 'hardware' ? 'Hardware Issue Suspected' :
                 processedData.rootCause === 'config' ? 'Configuration Issue' : 'Within Normal Range'}
              </div>
              <ul className="space-y-0.5">
                {ROOT_CAUSE_SUGGESTIONS[processedData.rootCause].map((suggestion, i) => (
                  <li key={i} className="text-[10px] text-slate-600 dark:text-slate-400 flex items-start gap-1">
                    <span className="text-slate-400">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {viewMode === 'details' && processedData.interfaceStats && (
          <div className="p-3 space-y-2">
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Interface Error Breakdown</div>
            {[
              { label: 'Input Errors', value: processedData.interfaceStats.inErrors, max: 1000 },
              { label: 'Output Errors', value: processedData.interfaceStats.outErrors, max: 1000 },
              { label: 'CRC Errors', value: processedData.interfaceStats.crcErrors, max: 500 },
              { label: 'Collisions', value: processedData.interfaceStats.collisions, max: 200 },
              { label: 'Drops', value: processedData.interfaceStats.drops, max: 500 },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-slate-600 dark:text-slate-400">{stat.label}</span>
                  <span className={`text-[10px] font-medium tabular-nums ${
                    stat.value > stat.max * 0.8 ? 'text-red-600 dark:text-red-400' :
                    stat.value > stat.max * 0.5 ? 'text-amber-600 dark:text-amber-400' :
                    'text-slate-700 dark:text-slate-300'
                  }`}>
                    {stat.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      stat.value > stat.max * 0.8 ? 'bg-red-500' :
                      stat.value > stat.max * 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(stat.value / stat.max, 1) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'apps' && (
          <div className="p-3 space-y-2">
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Affected Applications</div>
            {processedData.affectedApps.length > 0 ? (
              processedData.affectedApps.map((app, i) => {
                const impactConfig = IMPACT_CONFIG[app.impactLevel];
                return (
                  <div key={i} className={`p-2 rounded-lg border ${impactConfig.bg} border-slate-200 dark:border-slate-700`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{app.name}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${impactConfig.bg} ${impactConfig.color}`}>
                        {impactConfig.label}
                      </span>
                    </div>
                    {app.retransmissions !== undefined && (
                      <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        {app.retransmissions.toLocaleString()} retransmissions
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-xs">
                No applications significantly affected
              </div>
            )}
          </div>
        )}
      </div>

      {/* Correlated issue alert */}
      {processedData.correlatedIssue && (
        <div className="flex-shrink-0 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-[10px] text-amber-700 dark:text-amber-300">{processedData.correlatedIssue}</span>
          </div>
        </div>
      )}

      {/* Action feedback */}
      {actionFeedback && (
        <div className="flex-shrink-0 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
          <span className="text-[10px] text-blue-700 dark:text-blue-300">{actionFeedback}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 flex gap-2">
        <button
          onClick={() => handleAction('capture')}
          disabled={actionFeedback === 'Processing...'}
          className={`flex-1 px-2 py-1.5 text-[10px] font-medium ${currentColor.bg} text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50`}
        >
          Run Ping Test
        </button>
        <button
          onClick={() => handleAction('alert')}
          disabled={actionFeedback === 'Processing...'}
          className="px-2 py-1.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          Set Alert
        </button>
      </div>
    </div>
  );
});

PacketLossCard.displayName = 'PacketLossCard';

export default PacketLossCard;
