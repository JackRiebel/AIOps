'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, type ActionState } from '@/services/cardActions';

interface UplinkData {
  interface: string;
  status: 'active' | 'ready' | 'connecting' | 'not connected' | 'failed';
  isPrimary: boolean;
  ip?: string;
  publicIp?: string;
  gateway?: string;
  provider?: string;
  connectionType?: string;
  latency?: number;
  jitter?: number;
  loss?: number;
  bandwidth?: { up: number; down: number };
  usagePercent?: number;
  monthlyCost?: number;
  endpoint?: { city: string; country: string };
  healthScore?: number;
}

interface FailoverEvent {
  timestamp: string;
  from: string;
  to: string;
  reason: string;
  duration?: number;
}

interface WANFailoverCardData {
  uplinks?: UplinkData[];
  failoverEnabled?: boolean;
  failoverMode?: 'load-balance' | 'failover' | 'active-passive';
  lastFailover?: string;
  currentPrimary?: string;
  failoverHistory?: FailoverEvent[];
  deviceName?: string;
}

interface WANFailoverCardProps {
  data: WANFailoverCardData;
  config?: Record<string, unknown>;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  ready: '#06b6d4',
  connecting: '#f59e0b',
  'not connected': '#64748b',
  failed: '#ef4444',
};

const CONNECTION_ICONS: Record<string, string> = {
  Fiber: '🔷',
  Cable: '📺',
  DSL: '📞',
  Cellular: '📱',
  Satellite: '📡',
  default: '🌐',
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export const WANFailoverCard = memo(({ data }: WANFailoverCardProps) => {
  const { demoMode } = useDemoMode();
  const [selectedUplink, setSelectedUplink] = useState<UplinkData | null>(null);
  const [showForceFailover, setShowForceFailover] = useState(false);
  const [hoveredUplink, setHoveredUplink] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    // Generate mock data if no real data available and demo mode is enabled
    let uplinks = data?.uplinks || [];
    if (uplinks.length === 0 && demoMode) {
      uplinks = [
        { interface: 'WAN1', status: 'active', isPrimary: true, ip: '10.0.0.1', publicIp: '203.0.113.50', gateway: '10.0.0.254', provider: 'AT&T Fiber', connectionType: 'Fiber', latency: 12, jitter: 2, loss: 0, bandwidth: { up: 500, down: 1000 }, usagePercent: 65, monthlyCost: 299, healthScore: 98 },
        { interface: 'WAN2', status: 'ready', isPrimary: false, ip: '10.1.0.1', publicIp: '198.51.100.25', gateway: '10.1.0.254', provider: 'Comcast Business', connectionType: 'Cable', latency: 25, jitter: 5, loss: 0.1, bandwidth: { up: 100, down: 500 }, usagePercent: 0, monthlyCost: 149, healthScore: 95 },
        { interface: 'WAN3', status: 'not connected', isPrimary: false, ip: undefined, publicIp: undefined, gateway: '10.2.0.254', provider: 'Verizon 5G', connectionType: 'Cellular', latency: 45, jitter: 15, loss: 0.5, bandwidth: { up: 50, down: 150 }, usagePercent: 0, monthlyCost: 79, healthScore: 0 },
      ];
    }

    if (uplinks.length === 0) return null;

    const sorted = [...uplinks].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      if (a.status !== b.status) {
        if (a.status === 'active') return -1;
        if (b.status === 'active') return 1;
      }
      return a.interface.localeCompare(b.interface);
    });

    const activeUplinks = sorted.filter(u => u.status === 'active');
    const totalBandwidth = sorted.reduce((sum, u) => sum + (u.bandwidth?.down || 0), 0);
    const totalCost = sorted.reduce((sum, u) => sum + (u.monthlyCost || 0), 0);

    // Calculate traffic distribution for active uplinks
    const trafficDistribution = activeUplinks.map(u => ({
      interface: u.interface,
      percent: u.usagePercent || (100 / activeUplinks.length),
    }));

    return {
      uplinks: sorted,
      activeCount: activeUplinks.length,
      totalUplinks: sorted.length,
      failoverEnabled: data?.failoverEnabled ?? true,
      failoverMode: data?.failoverMode || 'failover',
      currentPrimary: data?.currentPrimary || sorted.find(u => u.isPrimary)?.interface,
      failoverHistory: data?.failoverHistory || [],
      totalBandwidth,
      totalCost,
      trafficDistribution,
      deviceName: data?.deviceName || 'Edge Router',
    };
  }, [data, demoMode]);

  const handleForceFailover = useCallback(async (targetInterface: string) => {
    setActionState({ status: 'loading', message: `Initiating failover to ${targetInterface}...` });
    setShowForceFailover(false);

    const result = await executeCardAction('wan-failover', {
      targetInterface,
      deviceName: processedData?.deviceName,
    });

    if (result.success) {
      setActionState({ status: 'success', message: `Failover to ${targetInterface} initiated` });
    } else {
      setActionState({ status: 'error', message: result.message });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [processedData?.deviceName]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No WAN uplink data
      </div>
    );
  }

  const modeLabels: Record<string, string> = {
    'load-balance': 'Load Balance',
    'failover': 'Failover',
    'active-passive': 'Active-Passive',
  };

  // Calculate positions for uplinks around the center
  const centerX = 200;
  const centerY = 120;
  const radius = 80;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            WAN Failover
          </span>
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
              {modeLabels[processedData.failoverMode]}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {processedData.activeCount}/{processedData.totalUplinks} active
            </span>
          </div>
        </div>
      </div>

      {/* Network Diagram */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 bg-slate-900 overflow-hidden">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 400 240"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern id="wanGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56,189,248,0.06)" strokeWidth="0.5" />
              </pattern>
              <filter id="linkGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Animated dash pattern */}
              <pattern id="flowPattern" width="10" height="1" patternUnits="userSpaceOnUse">
                <rect width="6" height="1" fill="currentColor" />
              </pattern>
            </defs>

            <rect width="400" height="240" fill="url(#wanGrid)" />

            {/* Center device (router) */}
            <g>
              <circle cx={centerX} cy={centerY} r={28} fill="#1e293b" stroke="#3b82f6" strokeWidth={2} />
              <text x={centerX} y={centerY - 5} textAnchor="middle" fill="white" fontSize="16">🌐</text>
              <text x={centerX} y={centerY + 12} textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="500">
                {processedData.deviceName}
              </text>
            </g>

            {/* WAN Links */}
            {processedData.uplinks.map((uplink, idx) => {
              const angle = (idx * (360 / processedData.uplinks.length) - 90) * (Math.PI / 180);
              const endX = centerX + Math.cos(angle) * radius;
              const endY = centerY + Math.sin(angle) * radius;
              const color = STATUS_COLORS[uplink.status] || STATUS_COLORS['not connected'];
              const isActive = uplink.status === 'active';
              const isHovered = hoveredUplink === uplink.interface;
              const lineWidth = isActive ? 3 : 2;
              const icon = CONNECTION_ICONS[uplink.connectionType || ''] || CONNECTION_ICONS.default;

              // Control points for curved line
              const midX = (centerX + endX) / 2;
              const midY = (centerY + endY) / 2;
              const curveOffset = 15;
              const perpX = -(endY - centerY) / radius * curveOffset;
              const perpY = (endX - centerX) / radius * curveOffset;

              return (
                <g
                  key={uplink.interface}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredUplink(uplink.interface)}
                  onMouseLeave={() => setHoveredUplink(null)}
                  onClick={() => setSelectedUplink(selectedUplink?.interface === uplink.interface ? null : uplink)}
                >
                  {/* Connection line */}
                  <path
                    d={`M ${centerX} ${centerY} Q ${midX + perpX} ${midY + perpY} ${endX} ${endY}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? lineWidth + 2 : lineWidth}
                    opacity={isActive ? 0.8 : 0.4}
                    strokeDasharray={isActive ? 'none' : '4,4'}
                    filter={isActive ? 'url(#linkGlow)' : undefined}
                    className="transition-all duration-200"
                  />

                  {/* Animated traffic flow for active links */}
                  {isActive && (
                    <>
                      <circle r={3} fill={color}>
                        <animateMotion
                          dur={`${1.5 + idx * 0.2}s`}
                          repeatCount="indefinite"
                          path={`M ${centerX} ${centerY} Q ${midX + perpX} ${midY + perpY} ${endX} ${endY}`}
                        />
                      </circle>
                      <circle r={3} fill={color}>
                        <animateMotion
                          dur={`${1.5 + idx * 0.2}s`}
                          repeatCount="indefinite"
                          begin={`${0.75 + idx * 0.1}s`}
                          path={`M ${centerX} ${centerY} Q ${midX + perpX} ${midY + perpY} ${endX} ${endY}`}
                        />
                      </circle>
                    </>
                  )}

                  {/* Endpoint cloud/icon */}
                  <g transform={`translate(${endX}, ${endY})`}>
                    <circle
                      r={isHovered ? 22 : 18}
                      fill="#1e293b"
                      stroke={color}
                      strokeWidth={uplink.isPrimary ? 3 : 2}
                      className="transition-all duration-200"
                    />
                    {uplink.isPrimary && (
                      <circle r={22} fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3,3">
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from="0"
                          to="360"
                          dur="10s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                    <text y={-3} textAnchor="middle" fontSize="12">{icon}</text>
                    <text y={8} textAnchor="middle" fill="#e2e8f0" fontSize="7" fontWeight="600">
                      {uplink.interface}
                    </text>
                  </g>

                  {/* Latency label on hover */}
                  {isHovered && uplink.latency !== undefined && (
                    <g transform={`translate(${midX + perpX}, ${midY + perpY})`}>
                      <rect x={-20} y={-8} width={40} height={16} rx={3} fill="#1e293b" stroke={color} strokeWidth={1} />
                      <text y={3} textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="600">
                        {uplink.latency.toFixed(0)}ms
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Traffic distribution pie (bottom left) */}
          <div className="absolute bottom-2 left-2 px-2 py-1.5 bg-slate-900/90 rounded text-[9px] backdrop-blur-sm">
            <div className="text-slate-400 mb-1">Traffic Split</div>
            <div className="flex gap-1">
              {processedData.trafficDistribution.map((t, i) => (
                <div key={t.interface} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS.active }}
                  />
                  <span className="text-white font-medium">{t.percent.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats (bottom right) */}
          <div className="absolute bottom-2 right-2 px-2 py-1.5 bg-slate-900/90 rounded text-[9px] text-slate-300 backdrop-blur-sm">
            <div><span className="text-white font-semibold">{processedData.totalBandwidth}</span> Mbps total</div>
            {processedData.totalCost > 0 && (
              <div className="text-slate-400">${processedData.totalCost}/mo</div>
            )}
          </div>

          {/* Selected uplink details panel */}
          {selectedUplink && (
            <div className="absolute top-2 right-2 w-48 bg-slate-900/95 border border-slate-600 rounded-lg text-xs text-white shadow-xl z-20 backdrop-blur-sm">
              <div className="p-2.5 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {CONNECTION_ICONS[selectedUplink.connectionType || ''] || CONNECTION_ICONS.default}
                    </span>
                    <div>
                      <div className="font-semibold">{selectedUplink.interface}</div>
                      <div className="text-[10px] text-slate-400">{selectedUplink.provider || selectedUplink.connectionType}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUplink(null)}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-2.5 space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="font-medium" style={{ color: STATUS_COLORS[selectedUplink.status] }}>
                    {selectedUplink.status.charAt(0).toUpperCase() + selectedUplink.status.slice(1)}
                  </span>
                </div>
                {selectedUplink.publicIp && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Public IP</span>
                    <code className="text-slate-200 font-mono">{selectedUplink.publicIp}</code>
                  </div>
                )}
                {selectedUplink.latency !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latency</span>
                    <span className={`font-semibold ${
                      selectedUplink.latency > 100 ? 'text-red-400' :
                      selectedUplink.latency > 50 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>{selectedUplink.latency.toFixed(1)} ms</span>
                  </div>
                )}
                {selectedUplink.jitter !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Jitter</span>
                    <span className="text-slate-200">{selectedUplink.jitter.toFixed(1)} ms</span>
                  </div>
                )}
                {selectedUplink.loss !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Packet Loss</span>
                    <span className={`font-semibold ${
                      selectedUplink.loss > 5 ? 'text-red-400' :
                      selectedUplink.loss > 1 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>{selectedUplink.loss.toFixed(2)}%</span>
                  </div>
                )}
                {selectedUplink.healthScore !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Health Score</span>
                    <span className={`font-semibold ${
                      selectedUplink.healthScore < 50 ? 'text-red-400' :
                      selectedUplink.healthScore < 80 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>{selectedUplink.healthScore}%</span>
                  </div>
                )}
                {selectedUplink.bandwidth && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bandwidth</span>
                    <span className="text-slate-200">
                      ↓{selectedUplink.bandwidth.down} / ↑{selectedUplink.bandwidth.up} Mbps
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-700 flex gap-2">
                  {selectedUplink.status === 'ready' && (
                    <button
                      onClick={() => setShowForceFailover(true)}
                      className="flex-1 py-1.5 text-[10px] bg-amber-600 hover:bg-amber-500 rounded transition-colors font-medium"
                    >
                      Force Failover
                    </button>
                  )}
                  <button
                    className="flex-1 py-1.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded transition-colors font-medium"
                  >
                    View Metrics
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Force failover confirmation */}
          {showForceFailover && selectedUplink && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
              <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 max-w-xs text-center shadow-xl">
                <div className="text-amber-400 text-2xl mb-2">⚠️</div>
                <div className="text-white font-semibold mb-1">Force Failover?</div>
                <div className="text-slate-400 text-xs mb-3">
                  This will switch primary WAN to {selectedUplink.interface}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowForceFailover(false)}
                    className="flex-1 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleForceFailover(selectedUplink.interface)}
                    className="flex-1 py-2 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors font-medium"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Feedback */}
      {actionState.status !== 'idle' && (
        <div className={`flex-shrink-0 px-3 py-1.5 border-t text-[10px] ${
          actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' :
          actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' :
          'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {actionState.message}
        </div>
      )}

      {/* Failover history timeline */}
      {processedData.failoverHistory.length > 0 && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 max-h-16 overflow-auto">
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">
            Recent Failovers
          </div>
          <div className="space-y-1">
            {processedData.failoverHistory.slice(0, 2).map((event, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-400">{formatTimeAgo(event.timestamp)}</span>
                <span className="text-slate-600 dark:text-slate-300">
                  {event.from} → {event.to}
                </span>
                <span className="text-slate-500">({event.reason})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

WANFailoverCard.displayName = 'WANFailoverCard';

export default WANFailoverCard;
