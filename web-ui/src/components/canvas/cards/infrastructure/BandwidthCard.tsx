'use client';

import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface BandwidthDataPoint {
  timestamp: string;
  sent: number;   // bytes/sec
  recv: number;   // bytes/sec
  total?: number;
}

interface TopConsumer {
  name: string;
  ip?: string;
  bandwidth: number;
  type?: 'device' | 'application' | 'user';
}

interface InterfaceData {
  interface: string;
  name?: string;
  currentBandwidth: {
    sent: number;
    recv: number;
  };
  history?: BandwidthDataPoint[];
  capacity?: number;
}

interface BandwidthCardData {
  interfaces?: InterfaceData[];
  traffic?: BandwidthDataPoint[];
  sent?: number;
  recv?: number;
  history?: BandwidthDataPoint[];
  capacity?: number;
  slaThreshold?: number;
  topConsumers?: TopConsumer[];
  networkId?: string;
  deviceSerial?: string;
}

interface BandwidthCardProps {
  data: BandwidthCardData;
  config?: {
    showChart?: boolean;
    timeRange?: string;
  };
}

function formatBitRate(bytesPerSec: number): string {
  const bitsPerSec = bytesPerSec * 8;
  if (bitsPerSec === 0) return '0 bps';
  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const i = Math.min(Math.floor(Math.log(bitsPerSec) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bitsPerSec / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * BandwidthCard - Real-time Bandwidth Visualization
 *
 * Shows:
 * - Animated real-time bandwidth chart
 * - SLA threshold lines with breach highlighting
 * - Zoom and pan controls
 * - Top consumers mini-chart
 * - Capacity utilization with alerts
 * - Trend prediction line
 */
export const BandwidthCard = memo(({ data, config }: BandwidthCardProps) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null);
  const [showTopConsumers, setShowTopConsumers] = useState(false);
  const animationRef = useRef<number>(0);
  const [animationOffset, setAnimationOffset] = useState(0);
  const { demoMode } = useDemoMode();

  // Animation for flowing data effect
  useEffect(() => {
    const animate = () => {
      setAnimationOffset(prev => (prev + 0.5) % 100);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const processedData = useMemo(() => {
    // Generate mock data when no data available and demo mode is on
    if (demoMode && (!data || (!data.interfaces?.length && !data.history?.length && !data.traffic?.length))) {
      const now = Date.now();
      const mockHistory = Array.from({ length: 24 }, (_, i) => {
        const timestamp = new Date(now - (23 - i) * 3600000).toISOString();
        const baseLoad = 50 + Math.sin(i / 3) * 20;
        return {
          timestamp,
          sent: Math.round((baseLoad + Math.random() * 15) * 1000000),
          recv: Math.round((baseLoad * 1.5 + Math.random() * 20) * 1000000),
        };
      });
      const lastPoint = mockHistory[mockHistory.length - 1];
      return {
        type: 'simple' as const,
        sent: lastPoint.sent,
        recv: lastPoint.recv,
        total: lastPoint.sent + lastPoint.recv,
        capacity: 1000000000, // 1 Gbps
        utilization: ((lastPoint.sent + lastPoint.recv) / 1000000000) * 100,
        history: mockHistory.map(h => ({
          timestamp: h.timestamp,
          sent: h.sent,
          recv: h.recv,
          total: h.sent + h.recv,
        })),
        topConsumers: [
          { name: 'workstation-15', ip: '10.0.100.15', bandwidth: 127000000, type: 'device' as const },
          { name: 'server-db-1', ip: '10.0.100.22', bandwidth: 103000000, type: 'device' as const },
          { name: 'backup-nas', ip: '10.0.100.8', bandwidth: 135000000, type: 'device' as const },
        ],
        slaThreshold: 80,
      };
    }

    // Return null if no data and demo mode is off
    if (!data || (!data.interfaces?.length && !data.history?.length && !data.traffic?.length)) {
      return null;
    }

    // Handle multiple interfaces
    if (data.interfaces && data.interfaces.length > 0) {
      const totalSent = data.interfaces.reduce((sum, i) => sum + i.currentBandwidth.sent, 0);
      const totalRecv = data.interfaces.reduce((sum, i) => sum + i.currentBandwidth.recv, 0);
      const totalCapacity = data.interfaces.reduce((sum, i) => sum + (i.capacity || 0), 0);

      return {
        type: 'multi-interface' as const,
        interfaces: data.interfaces.map(iface => ({
          id: iface.interface,
          name: iface.name || iface.interface,
          sent: iface.currentBandwidth.sent,
          recv: iface.currentBandwidth.recv,
          total: iface.currentBandwidth.sent + iface.currentBandwidth.recv,
          history: iface.history,
          capacity: iface.capacity,
          utilization: iface.capacity ? ((iface.currentBandwidth.sent + iface.currentBandwidth.recv) / iface.capacity) * 100 : undefined,
        })),
        totalSent,
        totalRecv,
        totalCapacity,
        topConsumers: data.topConsumers || [],
        slaThreshold: data.slaThreshold,
      };
    }

    // Handle simple traffic data
    const history = data.history || data.traffic || [];
    const sent = data.sent ?? (history[history.length - 1]?.sent ?? 0);
    const recv = data.recv ?? (history[history.length - 1]?.recv ?? 0);
    const capacity = data.capacity;

    return {
      type: 'simple' as const,
      sent,
      recv,
      total: sent + recv,
      capacity,
      utilization: capacity ? ((sent + recv) / capacity) * 100 : undefined,
      history: history.map(h => ({
        timestamp: h.timestamp,
        sent: h.sent || 0,
        recv: h.recv || 0,
        total: (h.sent || 0) + (h.recv || 0),
      })),
      topConsumers: data.topConsumers || [],
      slaThreshold: data.slaThreshold,
    };
  }, [data, demoMode]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(z => Math.min(z * 1.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(z => Math.max(z / 1.5, 0.5));
  }, []);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No bandwidth data
      </div>
    );
  }

  // Get current data based on selection
  const currentData = processedData.type === 'multi-interface'
    ? selectedInterface
      ? processedData.interfaces.find(i => i.id === selectedInterface)
      : {
          sent: processedData.totalSent,
          recv: processedData.totalRecv,
          total: processedData.totalSent + processedData.totalRecv,
          capacity: processedData.totalCapacity,
          utilization: processedData.totalCapacity
            ? ((processedData.totalSent + processedData.totalRecv) / processedData.totalCapacity) * 100
            : undefined,
          history: processedData.interfaces[0]?.history,
        }
    : processedData;

  // SVG chart dimensions
  const chartWidth = 340;
  const chartHeight = 120;
  const margin = { top: 15, right: 10, bottom: 25, left: 45 };
  const graphWidth = chartWidth - margin.left - margin.right;
  const graphHeight = chartHeight - margin.top - margin.bottom;

  // Get history for chart
  const history = currentData?.history || [];
  const visiblePoints = Math.floor(history.length / zoomLevel);
  const startIdx = Math.max(0, history.length - visiblePoints);
  const visibleHistory = history.slice(startIdx);

  // Calculate scales
  const maxValue = Math.max(
    ...visibleHistory.map(h => h.total || (h.sent + h.recv)),
    currentData?.capacity || 0,
    processedData.slaThreshold || 0
  ) * 1.1;

  const xScale = (idx: number) => margin.left + (idx / Math.max(1, visibleHistory.length - 1)) * graphWidth;
  const yScale = (value: number) => margin.top + graphHeight - (value / maxValue) * graphHeight;

  // Generate chart paths
  const generatePath = (values: number[], type: 'line' | 'area') => {
    if (values.length === 0) return '';
    const points = values.map((v, i) => `${xScale(i)},${yScale(v)}`);
    if (type === 'area') {
      return `M ${margin.left},${yScale(0)} L ${points.join(' L ')} L ${xScale(values.length - 1)},${yScale(0)} Z`;
    }
    return `M ${points.join(' L ')}`;
  };

  const sentPath = generatePath(visibleHistory.map(h => h.sent), 'area');
  const recvPath = generatePath(visibleHistory.map(h => h.recv), 'area');
  const totalPath = generatePath(visibleHistory.map(h => h.total || (h.sent + h.recv)), 'line');

  // Capacity warning level
  const utilizationLevel = currentData?.utilization || 0;
  const isWarning = utilizationLevel >= 70 && utilizationLevel < 90;
  const isCritical = utilizationLevel >= 90;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Bandwidth
            </span>
            {isCritical && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                High Load
              </span>
            )}
            {isWarning && !isCritical && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                Warning
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Zoom out"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Zoom in"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Interface selector for multi-interface */}
        {processedData.type === 'multi-interface' && (
          <div className="flex gap-1 mt-2 overflow-x-auto">
            <button
              onClick={() => setSelectedInterface(null)}
              className={`px-2 py-0.5 text-[9px] font-medium rounded whitespace-nowrap transition-colors ${
                !selectedInterface
                  ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {processedData.interfaces.map(iface => (
              <button
                key={iface.id}
                onClick={() => setSelectedInterface(iface.id)}
                className={`px-2 py-0.5 text-[9px] font-medium rounded whitespace-nowrap transition-colors ${
                  selectedInterface === iface.id
                    ? 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {iface.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
              {formatBitRate(currentData?.total || 0)}
            </div>
            {currentData?.utilization !== undefined && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden w-24">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCritical ? 'bg-red-500' :
                      isWarning ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, currentData.utilization)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 tabular-nums">
                  {currentData.utilization.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="flex items-center gap-1 justify-end text-[10px] text-slate-500">
                <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                TX
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                {formatBitRate(currentData?.sent || 0)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 justify-end text-[10px] text-slate-500">
                <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                RX
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                {formatBitRate(currentData?.recv || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-hidden p-2">
        {visibleHistory.length > 0 ? (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              {/* Gradients */}
              <linearGradient id="sentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="recvGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
              </linearGradient>
              {/* Animated pattern for real-time effect */}
              <pattern id="flowPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                <line x1="0" y1="10" x2="10" y2="0" stroke="#06b6d4" strokeWidth="0.5" opacity="0.3">
                  <animate attributeName="x1" from="-10" to="0" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="x2" from="0" to="10" dur="1s" repeatCount="indefinite" />
                </line>
              </pattern>
            </defs>

            {/* Background grid */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = yScale((pct / 100) * maxValue);
              return (
                <g key={pct}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={chartWidth - margin.right}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="0.5"
                    strokeDasharray={pct === 0 ? 'none' : '2,2'}
                  />
                  <text x={margin.left - 4} y={y} fontSize="8" fill="#94a3b8" textAnchor="end" dominantBaseline="middle">
                    {formatBitRate((pct / 100) * maxValue)}
                  </text>
                </g>
              );
            })}

            {/* SLA threshold line */}
            {processedData.slaThreshold && (
              <g>
                <line
                  x1={margin.left}
                  y1={yScale(processedData.slaThreshold)}
                  x2={chartWidth - margin.right}
                  y2={yScale(processedData.slaThreshold)}
                  stroke="#f59e0b"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <text
                  x={chartWidth - margin.right}
                  y={yScale(processedData.slaThreshold) - 4}
                  fontSize="7"
                  fill="#f59e0b"
                  textAnchor="end"
                >
                  SLA
                </text>
              </g>
            )}

            {/* Capacity line */}
            {currentData?.capacity && (
              <g>
                <line
                  x1={margin.left}
                  y1={yScale(currentData.capacity)}
                  x2={chartWidth - margin.right}
                  y2={yScale(currentData.capacity)}
                  stroke="#ef4444"
                  strokeWidth="1"
                  strokeDasharray="6,3"
                />
                <text
                  x={chartWidth - margin.right}
                  y={yScale(currentData.capacity) - 4}
                  fontSize="7"
                  fill="#ef4444"
                  textAnchor="end"
                >
                  Capacity
                </text>
              </g>
            )}

            {/* Sent area */}
            <path d={sentPath} fill="url(#sentGradient)" />

            {/* Recv area */}
            <path d={recvPath} fill="url(#recvGradient)" />

            {/* Total line */}
            <path
              d={totalPath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Animated data flow indicator at end */}
            {visibleHistory.length > 0 && (
              <g>
                <circle
                  cx={xScale(visibleHistory.length - 1)}
                  cy={yScale(visibleHistory[visibleHistory.length - 1].total || 0)}
                  r="4"
                  fill="#06b6d4"
                  stroke="white"
                  strokeWidth="2"
                >
                  <animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite" />
                </circle>
              </g>
            )}

            {/* Interactive hover points */}
            {visibleHistory.map((point, idx) => (
              <g
                key={idx}
                onMouseEnter={() => setHoveredPoint(idx)}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={xScale(idx) - 5}
                  y={margin.top}
                  width={10}
                  height={graphHeight}
                  fill="transparent"
                />
                {hoveredPoint === idx && (
                  <>
                    <line
                      x1={xScale(idx)}
                      y1={margin.top}
                      x2={xScale(idx)}
                      y2={chartHeight - margin.bottom}
                      stroke="#06b6d4"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                    <circle
                      cx={xScale(idx)}
                      cy={yScale(point.total || 0)}
                      r="4"
                      fill="#06b6d4"
                      stroke="white"
                      strokeWidth="2"
                    />
                    {/* Tooltip */}
                    <g>
                      <rect
                        x={xScale(idx) - 45}
                        y={yScale(point.total || 0) - 35}
                        width="90"
                        height="30"
                        rx="4"
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke="#06b6d4"
                        strokeWidth="1"
                      />
                      <text x={xScale(idx)} y={yScale(point.total || 0) - 22} fontSize="8" fill="white" textAnchor="middle" fontWeight="bold">
                        {formatBitRate(point.total || 0)}
                      </text>
                      <text x={xScale(idx)} y={yScale(point.total || 0) - 12} fontSize="7" fill="#94a3b8" textAnchor="middle">
                        {formatTime(point.timestamp)}
                      </text>
                    </g>
                  </>
                )}
              </g>
            ))}

            {/* Time labels */}
            {visibleHistory.length > 0 && (() => {
              // Generate unique indices for time labels
              const indices = [
                { idx: 0, label: 'start' },
                { idx: Math.floor(visibleHistory.length / 2), label: 'middle' },
                { idx: visibleHistory.length - 1, label: 'end' },
              ].filter((item, pos, arr) =>
                // Filter out duplicates by idx
                arr.findIndex(x => x.idx === item.idx) === pos
              );
              return indices.map(({ idx, label }) => (
                <text
                  key={label}
                  x={xScale(idx)}
                  y={chartHeight - 5}
                  fontSize="7"
                  fill="#94a3b8"
                  textAnchor="middle"
                >
                  {formatTime(visibleHistory[idx]?.timestamp || '')}
                </text>
              ));
            })()}
          </svg>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
            No historical data available
          </div>
        )}
      </div>

      {/* Top Consumers / Footer */}
      {processedData.topConsumers && processedData.topConsumers.length > 0 ? (
        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setShowTopConsumers(!showTopConsumers)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span>Top Consumers</span>
            <svg
              className={`w-3 h-3 transition-transform ${showTopConsumers ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showTopConsumers && (
            <div className="px-3 pb-2 space-y-1">
              {processedData.topConsumers.slice(0, 3).map((consumer, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                    {consumer.name}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium tabular-nums">
                    {formatBitRate(consumer.bandwidth)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-center gap-4 text-[8px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              TX
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              RX
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              Total
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

BandwidthCard.displayName = 'BandwidthCard';

export default BandwidthCard;
