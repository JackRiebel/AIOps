'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { adjustQoS, type ActionState } from '@/services/cardActions';

interface QoSQueue {
  name: string;
  priority: number;
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  dropped?: number;
  latency?: number;
  jitter?: number;
  bufferUsage?: number;
  trend?: number[];
  dropTrend?: number[];
  applications?: Array<{ name: string; bytes: number; priority: string }>;
}

interface QoSCardData {
  queues?: QoSQueue[];
  shapingEnabled?: boolean;
  uplinkBandwidth?: number;
  downlinkBandwidth?: number;
  networkId?: string;
  policyName?: string;
}

interface QoSCardProps {
  data: QoSCardData;
  config?: Record<string, unknown>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const PRIORITY_COLORS = [
  { bg: '#ef4444', light: '#fecaca', name: 'Critical' },     // 0 - Red
  { bg: '#f97316', light: '#fed7aa', name: 'High' },         // 1 - Orange
  { bg: '#eab308', light: '#fef08a', name: 'Medium-High' },  // 2 - Yellow
  { bg: '#84cc16', light: '#d9f99d', name: 'Medium' },       // 3 - Lime
  { bg: '#22c55e', light: '#bbf7d0', name: 'Normal' },       // 4 - Green
  { bg: '#06b6d4', light: '#a5f3fc', name: 'Low' },          // 5 - Cyan
  { bg: '#3b82f6', light: '#bfdbfe', name: 'Best Effort' },  // 6 - Blue
  { bg: '#6b7280', light: '#d1d5db', name: 'Scavenger' },    // 7 - Gray
];

type ViewMode = 'overview' | 'detail';

/**
 * QoSCard - Interactive QoS queue visualization with buffer monitoring
 */
export const QoSCard = memo(({ data }: QoSCardProps) => {
  const { demoMode } = useDemoMode();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedQueue, setSelectedQueue] = useState<number | null>(null);
  const [hoveredQueue, setHoveredQueue] = useState<number | null>(null);
  const [showDrops, setShowDrops] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    if ((!data || !data.queues || data.queues.length === 0) && demoMode) {
      // Generate mock data for demonstration
      const mockQueues: QoSQueue[] = [
        { name: 'Voice', priority: 0, bytesIn: 45000000, bytesOut: 42000000, packetsIn: 150000, packetsOut: 140000, dropped: 12, latency: 5, jitter: 2, bufferUsage: 15 },
        { name: 'Video', priority: 1, bytesIn: 180000000, bytesOut: 165000000, packetsIn: 450000, packetsOut: 420000, dropped: 45, latency: 12, jitter: 5, bufferUsage: 35 },
        { name: 'Interactive', priority: 2, bytesIn: 85000000, bytesOut: 78000000, packetsIn: 280000, packetsOut: 260000, dropped: 28, latency: 18, jitter: 8, bufferUsage: 28 },
        { name: 'Bulk Data', priority: 4, bytesIn: 320000000, bytesOut: 290000000, packetsIn: 850000, packetsOut: 780000, dropped: 1250, latency: 45, jitter: 15, bufferUsage: 72 },
        { name: 'Best Effort', priority: 6, bytesIn: 420000000, bytesOut: 380000000, packetsIn: 1200000, packetsOut: 1100000, dropped: 8500, latency: 85, jitter: 35, bufferUsage: 88 },
        { name: 'Scavenger', priority: 7, bytesIn: 95000000, bytesOut: 82000000, packetsIn: 350000, packetsOut: 300000, dropped: 15000, latency: 150, jitter: 60, bufferUsage: 95 },
      ];
      return processQueues(mockQueues);
    }
    if (!data || !data.queues || data.queues.length === 0) return null;
    return processQueues(data.queues);
  }, [data, demoMode]);

  function processQueues(queues: QoSQueue[]) {
    const sorted = [...queues].sort((a, b) => a.priority - b.priority);
    const totalIn = sorted.reduce((sum, q) => sum + q.bytesIn, 0);
    const totalOut = sorted.reduce((sum, q) => sum + q.bytesOut, 0);
    const totalDropped = sorted.reduce((sum, q) => sum + (q.dropped || 0), 0);
    const totalPackets = sorted.reduce((sum, q) => sum + q.packetsIn + q.packetsOut, 0);

    return {
      queues: sorted.map(q => ({
        ...q,
        percentageIn: totalIn > 0 ? (q.bytesIn / totalIn) * 100 : 0,
        percentageOut: totalOut > 0 ? (q.bytesOut / totalOut) * 100 : 0,
        dropRate: q.packetsIn + q.packetsOut > 0
          ? ((q.dropped || 0) / (q.packetsIn + q.packetsOut)) * 100
          : 0,
        color: PRIORITY_COLORS[q.priority] || PRIORITY_COLORS[7],
        trend: q.trend || Array.from({ length: 12 }, () => Math.random() * (q.bytesIn + q.bytesOut)),
        dropTrend: q.dropTrend || Array.from({ length: 12 }, (_, i) =>
          (q.dropped || 0) * (0.5 + Math.random() * 0.5) * (i > 8 ? 1.5 : 1)
        ),
        bufferUsage: q.bufferUsage ?? Math.floor(Math.random() * 80 + 10),
        applications: q.applications || [
          { name: 'App 1', bytes: q.bytesIn * 0.4, priority: 'Matched' },
          { name: 'App 2', bytes: q.bytesIn * 0.35, priority: 'Matched' },
          { name: 'Other', bytes: q.bytesIn * 0.25, priority: 'Default' },
        ],
      })),
      totalIn,
      totalOut,
      totalDropped,
      totalPackets,
      overallDropRate: totalPackets > 0 ? (totalDropped / totalPackets) * 100 : 0,
    };
  }

  const selectedQueueData = useMemo(() => {
    if (selectedQueue === null || !processedData) return null;
    return processedData.queues.find(q => q.priority === selectedQueue);
  }, [selectedQueue, processedData]);

  const generateSparkline = useCallback((trend: number[], width: number, height: number, fill = false) => {
    if (!trend || trend.length === 0) return '';
    const max = Math.max(...trend);
    const min = Math.min(...trend);
    const range = max - min || 1;

    const points = trend.map((v, i) => {
      const x = (i / (trend.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    });

    if (fill) {
      return `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;
    }
    return `M ${points.join(' L ')}`;
  }, []);

  const handleAction = useCallback(async (action: string, queue?: string) => {
    const queueData = queue ? processedData?.queues.find(q => q.name === queue) : null;

    setActionState({ status: 'loading', message: `Executing ${action}...` });

    if (action === 'adjust' && queueData) {
      const result = await adjustQoS({
        trafficClass: queueData.name,
        priority: queueData.priority <= 2 ? 'high' : queueData.priority <= 4 ? 'normal' : 'low',
        networkId: data?.networkId,
      });

      if (result.success) {
        setActionState({ status: 'success', message: `Priority adjusted for ${queue}` });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } else if (action === 'limit' && queueData) {
      const result = await adjustQoS({
        trafficClass: queueData.name,
        priority: 'normal',
        bandwidthLimit: 100, // Default limit
        networkId: data?.networkId,
      });

      if (result.success) {
        setActionState({ status: 'success', message: `Bandwidth limit set for ${queue}` });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } else if (action === 'policy') {
      // Navigate to policy page or show policy modal
      setActionState({ status: 'success', message: 'Opening QoS policy settings...' });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [processedData?.queues, data?.networkId]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No QoS data
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
              QoS Statistics
            </span>
            {data?.policyName && (
              <span className="px-1.5 py-0.5 text-[9px] rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                {data.policyName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDrops(!showDrops)}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                showDrops
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              Drops
            </button>
            {data?.shapingEnabled !== undefined && (
              <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${
                data.shapingEnabled
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {data.shapingEnabled ? 'Active' : 'Off'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-2">
        {viewMode === 'detail' && selectedQueueData ? (
          /* Detail View */
          <div className="h-full flex flex-col">
            <button
              onClick={() => { setViewMode('overview'); setSelectedQueue(null); }}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back to overview
            </button>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {/* Queue Header */}
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: selectedQueueData.color.bg }}
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {selectedQueueData.name}
                </span>
                <span className="px-1.5 py-0.5 text-[9px] rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                  Priority {selectedQueueData.priority}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1.5 text-center">
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Latency</div>
                  <div className={`text-xs font-semibold ${
                    (selectedQueueData.latency || 0) > 100 ? 'text-red-600' :
                    (selectedQueueData.latency || 0) > 50 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {selectedQueueData.latency || 0}ms
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1.5 text-center">
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Jitter</div>
                  <div className={`text-xs font-semibold ${
                    (selectedQueueData.jitter || 0) > 30 ? 'text-red-600' :
                    (selectedQueueData.jitter || 0) > 15 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {selectedQueueData.jitter || 0}ms
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1.5 text-center">
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Drop Rate</div>
                  <div className={`text-xs font-semibold ${
                    selectedQueueData.dropRate > 1 ? 'text-red-600' :
                    selectedQueueData.dropRate > 0.1 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {selectedQueueData.dropRate.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1.5 text-center">
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Buffer</div>
                  <div className={`text-xs font-semibold ${
                    selectedQueueData.bufferUsage > 80 ? 'text-red-600' :
                    selectedQueueData.bufferUsage > 60 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {selectedQueueData.bufferUsage}%
                  </div>
                </div>
              </div>

              {/* Buffer Gauge */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Buffer Utilization</div>
                <div className="relative h-6">
                  <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                    <div
                      className="h-full transition-all rounded"
                      style={{
                        width: `${selectedQueueData.bufferUsage}%`,
                        backgroundColor: selectedQueueData.bufferUsage > 80 ? '#ef4444' :
                          selectedQueueData.bufferUsage > 60 ? '#f59e0b' : selectedQueueData.color.bg,
                      }}
                    />
                  </div>
                  {/* Warning thresholds */}
                  <div className="absolute top-0 bottom-0 left-[60%] w-px bg-amber-500 opacity-50" />
                  <div className="absolute top-0 bottom-0 left-[80%] w-px bg-red-500 opacity-50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-slate-800 dark:text-white drop-shadow">
                      {selectedQueueData.bufferUsage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Traffic Trend */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Traffic Trend</div>
                <svg viewBox="0 0 200 50" className="w-full h-12">
                  <path
                    d={generateSparkline(selectedQueueData.trend, 200, 46, true)}
                    fill={selectedQueueData.color.light}
                    opacity="0.5"
                  />
                  <path
                    d={generateSparkline(selectedQueueData.trend, 200, 46)}
                    fill="none"
                    stroke={selectedQueueData.color.bg}
                    strokeWidth="2"
                  />
                </svg>
              </div>

              {/* Drop Trend */}
              {(selectedQueueData.dropped || 0) > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
                  <div className="text-[9px] text-red-600 dark:text-red-400 mb-1">
                    Drop Trend ({(selectedQueueData.dropped || 0).toLocaleString()} total)
                  </div>
                  <svg viewBox="0 0 200 30" className="w-full h-8">
                    <path
                      d={generateSparkline(selectedQueueData.dropTrend, 200, 26, true)}
                      fill="#fecaca"
                      opacity="0.5"
                    />
                    <path
                      d={generateSparkline(selectedQueueData.dropTrend, 200, 26)}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
              )}

              {/* Matched Applications */}
              <div>
                <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Matched Applications
                </div>
                <div className="space-y-1">
                  {selectedQueueData.applications.map((app, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-600 dark:text-slate-400 w-20 truncate">{app.name}</span>
                      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${(app.bytes / selectedQueueData.bytesIn) * 100}%`,
                            backgroundColor: selectedQueueData.color.bg,
                          }}
                        />
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 w-12 text-right">
                        {formatBytes(app.bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Overview */
          <div className="h-full flex flex-col">
            {/* Stacked Queue Visualization */}
            <div className="mb-3">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Queue Distribution</div>
              <svg viewBox="0 0 280 60" className="w-full h-14">
                {/* Background */}
                <rect x="0" y="10" width="280" height="40" rx="4" fill="currentColor" className="text-slate-100 dark:text-slate-800" />

                {/* Stacked bars */}
                {(() => {
                  let xOffset = 0;
                  return processedData.queues.map((queue, i) => {
                    const width = (queue.percentageIn / 100) * 280;
                    const x = xOffset;
                    xOffset += width;

                    const isHovered = hoveredQueue === queue.priority;
                    const isSelected = selectedQueue === queue.priority;

                    return (
                      <g
                        key={i}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredQueue(queue.priority)}
                        onMouseLeave={() => setHoveredQueue(null)}
                        onClick={() => { setSelectedQueue(queue.priority); setViewMode('detail'); }}
                      >
                        <rect
                          x={x}
                          y={isHovered || isSelected ? 5 : 10}
                          width={Math.max(width - 1, 0)}
                          height={isHovered || isSelected ? 50 : 40}
                          fill={queue.color.bg}
                          rx="2"
                          className="transition-all"
                          opacity={hoveredQueue === null || isHovered ? 1 : 0.5}
                        />
                        {/* Drop indicator */}
                        {showDrops && queue.dropRate > 0.1 && width > 10 && (
                          <circle
                            cx={x + width / 2}
                            cy="8"
                            r="3"
                            fill="#ef4444"
                            className=""
                          />
                        )}
                        {/* Label if wide enough */}
                        {width > 30 && (
                          <text
                            x={x + width / 2}
                            y="34"
                            textAnchor="middle"
                            className="text-[8px] fill-white font-medium pointer-events-none"
                          >
                            P{queue.priority}
                          </text>
                        )}
                      </g>
                    );
                  });
                })()}
              </svg>
            </div>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {processedData.queues.map((queue) => {
                const isHovered = hoveredQueue === queue.priority;

                return (
                  <div
                    key={queue.priority}
                    className={`p-1.5 rounded cursor-pointer transition-all ${
                      isHovered ? 'bg-slate-100 dark:bg-slate-700/50' : 'bg-slate-50 dark:bg-slate-800/30'
                    }`}
                    onMouseEnter={() => setHoveredQueue(queue.priority)}
                    onMouseLeave={() => setHoveredQueue(null)}
                    onClick={() => { setSelectedQueue(queue.priority); setViewMode('detail'); }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Color indicator */}
                      <div
                        className="w-2 h-8 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: queue.color.bg }}
                      />

                      {/* Queue info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
                            {queue.name}
                          </span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                            P{queue.priority}
                          </span>
                          {showDrops && queue.dropRate > 0.1 && (
                            <span className={`text-[8px] px-1 py-0.5 rounded ${
                              queue.dropRate > 1
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                            }`}>
                              {queue.dropRate.toFixed(2)}%
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500 dark:text-slate-400">
                          {formatBytes(queue.bytesIn + queue.bytesOut)} • {queue.latency || 0}ms
                        </div>
                      </div>

                      {/* Buffer mini gauge */}
                      <div className="w-8 flex-shrink-0">
                        <svg viewBox="0 0 32 32" className="w-8 h-8">
                          {/* Background arc */}
                          <path
                            d="M 6 26 A 12 12 0 1 1 26 26"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="text-slate-200 dark:text-slate-700"
                          />
                          {/* Value arc */}
                          <path
                            d="M 6 26 A 12 12 0 1 1 26 26"
                            fill="none"
                            stroke={queue.bufferUsage > 80 ? '#ef4444' : queue.bufferUsage > 60 ? '#f59e0b' : queue.color.bg}
                            strokeWidth="4"
                            strokeDasharray={`${(queue.bufferUsage / 100) * 50.27} 50.27`}
                            strokeLinecap="round"
                          />
                          <text
                            x="16" y="20"
                            textAnchor="middle"
                            className="text-[8px] fill-slate-600 dark:fill-slate-300 font-medium"
                          >
                            {queue.bufferUsage}%
                          </text>
                        </svg>
                      </div>

                      {/* Mini trend */}
                      <svg viewBox="0 0 40 20" className="w-10 h-5 flex-shrink-0">
                        <path
                          d={generateSparkline(queue.trend, 40, 18)}
                          fill="none"
                          stroke={queue.color.bg}
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Stats */}
            <div className="flex-shrink-0 mt-2 grid grid-cols-4 gap-1">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Queues</div>
                <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
                  {processedData.queues.length}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Total</div>
                <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
                  {formatBytes(processedData.totalIn + processedData.totalOut)}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Dropped</div>
                <div className={`text-[10px] font-semibold ${processedData.totalDropped > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                  {processedData.totalDropped.toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Drop Rate</div>
                <div className={`text-[10px] font-semibold ${processedData.overallDropRate > 0.1 ? 'text-amber-600' : 'text-slate-800 dark:text-slate-200'}`}>
                  {processedData.overallDropRate.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Feedback */}
      {actionState.status !== 'idle' && (
        <div className={`flex-shrink-0 px-3 py-2 border-t text-xs flex items-center gap-2 ${
          actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' :
          actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' :
          'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {actionState.status === 'loading' && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {actionState.status === 'success' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {actionState.status === 'error' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{actionState.message}</span>
        </div>
      )}

      {/* Actions Footer */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex gap-1">
          <button
            onClick={() => handleAction('adjust', selectedQueueData?.name)}
            className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Adjust Priority
          </button>
          <button
            onClick={() => handleAction('limit', selectedQueueData?.name)}
            className="flex-1 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            Set Limit
          </button>
          <button
            onClick={() => handleAction('policy')}
            className="px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Policy
          </button>
        </div>
      </div>
    </div>
  );
});

QoSCard.displayName = 'QoSCard';

export default QoSCard;
