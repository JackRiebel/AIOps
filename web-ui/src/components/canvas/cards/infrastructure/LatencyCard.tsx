'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { runMTR, type ActionState } from '@/services/cardActions';

interface LatencyDataPoint {
  timestamp: string;
  latency: number;  // ms
  jitter?: number;  // ms
}

interface NetworkHop {
  hop: number;
  ip: string;
  hostname?: string;
  latency: number;  // ms
  packetLoss?: number; // percentage
  location?: string;
}

interface LatencyCardData {
  current: number;  // Current latency in ms
  average?: number;
  min?: number;
  max?: number;
  jitter?: number;
  history?: LatencyDataPoint[];
  traceroute?: NetworkHop[];
  target?: string;  // e.g., "8.8.8.8" or "internet"
  uplink?: string;  // e.g., "WAN1"
  networkId?: string;
  deviceSerial?: string;
}

interface LatencyCardProps {
  data: LatencyCardData;
  config?: {
    thresholds?: {
      warning: number;
      critical: number;
    };
  };
}

function getLatencyColor(latency: number, thresholds: { warning: number; critical: number }): string {
  if (latency >= thresholds.critical) return '#ef4444';
  if (latency >= thresholds.warning) return '#f59e0b';
  return '#22c55e';
}

/**
 * LatencyCard - Network Path Visualization
 *
 * Shows:
 * - Visual network path with latency per hop
 * - Animated packet traveling along path
 * - Jitter visualization with error bars
 * - Time-series chart with hover details
 * - Run MTR action button
 */
export const LatencyCard = memo(({ data, config }: LatencyCardProps) => {
  const thresholds = config?.thresholds ?? { warning: 50, critical: 100 };
  const [showPath, setShowPath] = useState(true);
  const [hoveredHop, setHoveredHop] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [showMTR, setShowMTR] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Generate demo data if no real data and demo mode is enabled
    const mockData: LatencyCardData = (demoMode && !data?.current) ? {
      current: 24,
      average: 28,
      min: 18,
      max: 45,
      jitter: 3.2,
      target: '8.8.8.8',
      uplink: 'WAN1',
      history: Array.from({ length: 24 }, (_, i) => ({
        timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
        latency: 20 + Math.random() * 20,
        jitter: 2 + Math.random() * 4,
      })),
      traceroute: [
        { hop: 1, ip: '192.168.1.1', hostname: 'gateway.local', latency: 1, location: 'Local' },
        { hop: 2, ip: '10.0.0.1', hostname: 'isp-gateway', latency: 8, location: 'ISP' },
        { hop: 3, ip: '72.14.215.1', hostname: 'core-router', latency: 15, location: 'Regional' },
        { hop: 4, ip: '8.8.8.8', hostname: 'dns.google', latency: 24, location: 'Google' },
      ],
    } : data;

    if (!mockData) return null;

    const current = mockData.current ?? 0;
    const history = mockData.history ?? [];
    const latencyValues = history.map(h => h.latency);

    // Calculate stats if not provided
    const avg = mockData.average ?? (latencyValues.length > 0 ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length : current);
    const min = mockData.min ?? (latencyValues.length > 0 ? Math.min(...latencyValues) : current);
    const max = mockData.max ?? (latencyValues.length > 0 ? Math.max(...latencyValues) : current);
    const jitter = mockData.jitter ?? (latencyValues.length > 1
      ? Math.sqrt(latencyValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / latencyValues.length)
      : 0);

    // Determine status
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (current >= thresholds.critical) {
      status = 'critical';
    } else if (current >= thresholds.warning) {
      status = 'warning';
    }

    // Use traceroute from data or mockData
    const traceroute = mockData.traceroute || [
      { hop: 1, ip: '192.168.1.1', hostname: 'gateway', latency: 1, location: 'Local' },
      { hop: 2, ip: '10.0.0.1', hostname: 'isp-edge', latency: 8, location: 'ISP' },
      { hop: 3, ip: '72.14.215.85', hostname: 'core-rtr', latency: 15, location: 'Transit' },
      { hop: 4, ip: mockData.target || '8.8.8.8', hostname: 'destination', latency: current, location: 'Destination' },
    ];

    return {
      current,
      average: avg,
      min,
      max,
      jitter,
      history,
      traceroute,
      status,
    };
  }, [data, thresholds]);

  const handleRunMTR = useCallback(async () => {
    const serial = data?.deviceSerial;
    const target = data?.target || '8.8.8.8';

    if (!serial) {
      setActionState({ status: 'error', message: 'Device serial not available' });
      setTimeout(() => setActionState({ status: 'idle' }), 3000);
      setShowMTR(false);
      return;
    }

    setActionState({ status: 'loading', message: 'Running MTR...' });
    setShowMTR(false);

    const result = await runMTR({ serial, destination: target, count: 10 });

    if (result.success) {
      setActionState({ status: 'success', message: result.message, data: result.data });
    } else {
      setActionState({ status: 'error', message: result.message });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [data?.deviceSerial, data?.target]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No latency data
      </div>
    );
  }

  const statusColors = {
    good: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    critical: 'text-red-600 dark:text-red-400',
  };

  // SVG dimensions for path visualization
  const pathWidth = 340;
  const pathHeight = 80;
  const hopSpacing = pathWidth / (processedData.traceroute.length + 1);

  // SVG dimensions for chart
  const chartWidth = 340;
  const chartHeight = 60;
  const margin = { top: 10, right: 10, bottom: 15, left: 35 };
  const graphWidth = chartWidth - margin.left - margin.right;
  const graphHeight = chartHeight - margin.top - margin.bottom;

  // Chart scales
  const history = processedData.history;
  const maxLatency = Math.max(...history.map(h => h.latency + (h.jitter || 0)), thresholds.critical) * 1.2;
  const xScale = (idx: number) => margin.left + (idx / Math.max(1, history.length - 1)) * graphWidth;
  const yScale = (latency: number) => margin.top + graphHeight - (latency / maxLatency) * graphHeight;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Latency
            </span>
            {data.uplink && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {data.uplink}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPath(!showPath)}
              className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
                showPath
                  ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Path
            </button>
            <button
              onClick={() => setShowPath(false)}
              className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
                !showPath
                  ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Chart
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className={`text-2xl font-bold tabular-nums ${statusColors[processedData.status]}`}>
                {processedData.current.toFixed(1)}
                <span className="text-sm font-medium ml-0.5">ms</span>
              </div>
            </div>
            <div className="flex gap-3 text-[10px]">
              <div>
                <div className="text-slate-500">Min</div>
                <div className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{processedData.min.toFixed(1)}ms</div>
              </div>
              <div>
                <div className="text-slate-500">Avg</div>
                <div className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{processedData.average.toFixed(1)}ms</div>
              </div>
              <div>
                <div className="text-slate-500">Max</div>
                <div className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{processedData.max.toFixed(1)}ms</div>
              </div>
              <div>
                <div className="text-slate-500">Jitter</div>
                <div className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">±{processedData.jitter.toFixed(1)}ms</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div className="flex-1 overflow-hidden p-2">
        {showPath ? (
          // Network Path Visualization
          <svg viewBox={`0 0 ${pathWidth} ${pathHeight}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* Path gradient */}
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor={getLatencyColor(processedData.current, thresholds)} />
              </linearGradient>
              {/* Glow filter */}
              <filter id="hopGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connection lines */}
            {processedData.traceroute.map((hop, idx) => {
              if (idx === 0) return null;
              const x1 = idx * hopSpacing;
              const x2 = (idx + 1) * hopSpacing;
              const y = pathHeight / 2;
              const pathId = `hopPath-${idx}`;

              return (
                <g key={`line-${idx}`}>
                  <path
                    id={pathId}
                    d={`M ${x1} ${y} L ${x2} ${y}`}
                    fill="none"
                    stroke="url(#pathGradient)"
                    strokeWidth="3"
                    opacity={hoveredHop !== null && hoveredHop !== idx && hoveredHop !== idx - 1 ? 0.3 : 1}
                  />
                  {/* Animated packet */}
                  <circle r="4" fill="#06b6d4">
                    <animateMotion dur={`${0.5 + idx * 0.3}s`} repeatCount="indefinite">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                </g>
              );
            })}

            {/* Hop nodes */}
            {processedData.traceroute.map((hop, idx) => {
              const x = (idx + 1) * hopSpacing;
              const y = pathHeight / 2;
              const isHovered = hoveredHop === idx;
              const hopColor = getLatencyColor(hop.latency, thresholds);

              return (
                <g
                  key={`hop-${idx}`}
                  onMouseEnter={() => setHoveredHop(idx)}
                  onMouseLeave={() => setHoveredHop(null)}
                  style={{ cursor: 'pointer' }}
                  opacity={hoveredHop !== null && hoveredHop !== idx ? 0.4 : 1}
                >
                  {/* Node circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 14 : 12}
                    fill="rgba(15, 23, 42, 0.9)"
                    stroke={hopColor}
                    strokeWidth={isHovered ? 3 : 2}
                    filter={isHovered ? 'url(#hopGlow)' : undefined}
                  />

                  {/* Hop number */}
                  <text
                    x={x}
                    y={y + 1}
                    fontSize="9"
                    fill="white"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight="bold"
                  >
                    {hop.hop}
                  </text>

                  {/* Latency label */}
                  <text
                    x={x}
                    y={y + 25}
                    fontSize="8"
                    fill={hopColor}
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {hop.latency}ms
                  </text>

                  {/* Location/hostname label */}
                  <text
                    x={x}
                    y={y - 20}
                    fontSize="7"
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {hop.hostname || hop.ip}
                  </text>

                  {/* Tooltip on hover */}
                  {isHovered && (
                    <g>
                      <rect
                        x={x - 50}
                        y={y + 35}
                        width="100"
                        height="32"
                        rx="4"
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke={hopColor}
                        strokeWidth="1"
                      />
                      <text x={x} y={y + 47} fontSize="8" fill="white" textAnchor="middle" fontWeight="bold">
                        {hop.ip}
                      </text>
                      <text x={x} y={y + 58} fontSize="7" fill="#94a3b8" textAnchor="middle">
                        {hop.location || 'Unknown'}{hop.packetLoss ? ` · ${hop.packetLoss}% loss` : ''}
                      </text>
                    </g>
                  )}

                  {/* Packet loss indicator */}
                  {hop.packetLoss && hop.packetLoss > 0 && (
                    <circle
                      cx={x + 10}
                      cy={y - 8}
                      r="5"
                      fill="#ef4444"
                    >
                      <title>{hop.packetLoss}% packet loss</title>
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Source indicator */}
            <g>
              <rect x="5" y={pathHeight / 2 - 10} width="30" height="20" rx="4" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" />
              <text x="20" y={pathHeight / 2 + 1} fontSize="7" fill="#22c55e" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
                SRC
              </text>
            </g>
          </svg>
        ) : (
          // Time-series Chart with Jitter
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="latencyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Threshold lines */}
            <line
              x1={margin.left}
              y1={yScale(thresholds.warning)}
              x2={chartWidth - margin.right}
              y2={yScale(thresholds.warning)}
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <line
              x1={margin.left}
              y1={yScale(thresholds.critical)}
              x2={chartWidth - margin.right}
              y2={yScale(thresholds.critical)}
              stroke="#ef4444"
              strokeWidth="1"
              strokeDasharray="3,3"
            />

            {/* Area fill */}
            {history.length > 0 && (
              <path
                d={`M ${margin.left},${yScale(0)} ${history.map((h, i) => `L ${xScale(i)},${yScale(h.latency)}`).join(' ')} L ${xScale(history.length - 1)},${yScale(0)} Z`}
                fill="url(#latencyGradient)"
              />
            )}

            {/* Jitter error bars */}
            {history.map((point, idx) => {
              if (!point.jitter) return null;
              const x = xScale(idx);
              const yCenter = yScale(point.latency);
              const yTop = yScale(point.latency + point.jitter);
              const yBottom = yScale(point.latency - point.jitter);

              return (
                <g key={`jitter-${idx}`} opacity="0.5">
                  <line x1={x} y1={yTop} x2={x} y2={yBottom} stroke="#f59e0b" strokeWidth="1" />
                  <line x1={x - 3} y1={yTop} x2={x + 3} y2={yTop} stroke="#f59e0b" strokeWidth="1" />
                  <line x1={x - 3} y1={yBottom} x2={x + 3} y2={yBottom} stroke="#f59e0b" strokeWidth="1" />
                </g>
              );
            })}

            {/* Main latency line */}
            {history.length > 0 && (
              <path
                d={`M ${history.map((h, i) => `${xScale(i)},${yScale(h.latency)}`).join(' L ')}`}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}

            {/* Data points with hover */}
            {history.map((point, idx) => (
              <g
                key={idx}
                onMouseEnter={() => setHoveredPoint(idx)}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect x={xScale(idx) - 8} y={margin.top} width="16" height={graphHeight} fill="transparent" />
                <circle
                  cx={xScale(idx)}
                  cy={yScale(point.latency)}
                  r={hoveredPoint === idx ? 5 : 3}
                  fill={getLatencyColor(point.latency, thresholds)}
                  stroke="white"
                  strokeWidth="1.5"
                />
                {hoveredPoint === idx && (
                  <g>
                    <rect
                      x={xScale(idx) - 35}
                      y={yScale(point.latency) - 30}
                      width="70"
                      height="25"
                      rx="4"
                      fill="rgba(15, 23, 42, 0.95)"
                      stroke="#06b6d4"
                    />
                    <text x={xScale(idx)} y={yScale(point.latency) - 18} fontSize="9" fill="white" textAnchor="middle" fontWeight="bold">
                      {point.latency.toFixed(1)}ms
                    </text>
                    {point.jitter && (
                      <text x={xScale(idx)} y={yScale(point.latency) - 8} fontSize="7" fill="#f59e0b" textAnchor="middle">
                        ±{point.jitter.toFixed(1)}ms jitter
                      </text>
                    )}
                  </g>
                )}
              </g>
            ))}

            {/* Y-axis labels */}
            {[0, 50, 100].map(val => (
              <text key={val} x={margin.left - 4} y={yScale(val)} fontSize="7" fill="#94a3b8" textAnchor="end" dominantBaseline="middle">
                {val}ms
              </text>
            ))}
          </svg>
        )}
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

      {/* Actions / Footer */}
      {showMTR ? (
        <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Run MTR to {data.target || 'destination'}?
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRunMTR}
              className="flex-1 px-2 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded transition-colors"
            >
              Run MTR
            </button>
            <button
              onClick={() => setShowMTR(false)}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[8px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                &lt;{thresholds.warning}ms
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {thresholds.warning}-{thresholds.critical}ms
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                &gt;{thresholds.critical}ms
              </span>
            </div>
            <button
              onClick={() => setShowMTR(true)}
              className="px-2 py-0.5 text-[9px] font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded transition-colors"
            >
              Run MTR
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

LatencyCard.displayName = 'LatencyCard';

export default LatencyCard;
