'use client';

import React, { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, type ActionState } from '@/services/cardActions';

interface APChannelData {
  apName: string;
  serial?: string;
  mac?: string;
  band: '2.4GHz' | '5GHz' | '6GHz';
  channel: number;
  channelWidth?: number; // 20, 40, 80, 160 MHz
  utilization: number;  // 0-100%
  interference?: number; // 0-100%
  noiseFloor?: number; // dBm
  txPower?: number; // dBm
  clients?: number;
  neighborAPs?: number;
  dfsEvents?: number;
}

interface InterferenceSource {
  type: 'microwave' | 'bluetooth' | 'zigbee' | 'radar' | 'cordless' | 'unknown';
  frequency: number; // MHz
  strength: number; // 0-100
  band: '2.4GHz' | '5GHz';
}

interface ChannelHeatmapCardData {
  accessPoints?: APChannelData[];
  aps?: APChannelData[];
  interferenceSource?: InterferenceSource[];
  networkId?: string;
  timeRange?: string;
}

interface ChannelHeatmapCardProps {
  data: ChannelHeatmapCardData;
  config?: {
    band?: '2.4GHz' | '5GHz' | '6GHz' | 'all';
  };
}

interface ChannelUtilData {
  aps: APChannelData[];
  avgUtil: number;
  maxUtil: number;
}

// 2.4GHz channels with center frequencies (MHz)
const CHANNELS_2_4GHZ: { channel: number; freq: number }[] = [
  { channel: 1, freq: 2412 },
  { channel: 2, freq: 2417 },
  { channel: 3, freq: 2422 },
  { channel: 4, freq: 2427 },
  { channel: 5, freq: 2432 },
  { channel: 6, freq: 2437 },
  { channel: 7, freq: 2442 },
  { channel: 8, freq: 2447 },
  { channel: 9, freq: 2452 },
  { channel: 10, freq: 2457 },
  { channel: 11, freq: 2462 },
];

// 5GHz UNII bands with channels
const CHANNELS_5GHZ: { channel: number; freq: number; dfs: boolean; band: string }[] = [
  // UNII-1 (5150-5250 MHz) - Indoor only, no DFS
  { channel: 36, freq: 5180, dfs: false, band: 'UNII-1' },
  { channel: 40, freq: 5200, dfs: false, band: 'UNII-1' },
  { channel: 44, freq: 5220, dfs: false, band: 'UNII-1' },
  { channel: 48, freq: 5240, dfs: false, band: 'UNII-1' },
  // UNII-2A (5250-5350 MHz) - DFS required
  { channel: 52, freq: 5260, dfs: true, band: 'UNII-2A' },
  { channel: 56, freq: 5280, dfs: true, band: 'UNII-2A' },
  { channel: 60, freq: 5300, dfs: true, band: 'UNII-2A' },
  { channel: 64, freq: 5320, dfs: true, band: 'UNII-2A' },
  // UNII-2C (5470-5725 MHz) - DFS required
  { channel: 100, freq: 5500, dfs: true, band: 'UNII-2C' },
  { channel: 104, freq: 5520, dfs: true, band: 'UNII-2C' },
  { channel: 108, freq: 5540, dfs: true, band: 'UNII-2C' },
  { channel: 112, freq: 5560, dfs: true, band: 'UNII-2C' },
  // UNII-3 (5725-5850 MHz) - Higher power, no DFS
  { channel: 149, freq: 5745, dfs: false, band: 'UNII-3' },
  { channel: 153, freq: 5765, dfs: false, band: 'UNII-3' },
  { channel: 157, freq: 5785, dfs: false, band: 'UNII-3' },
  { channel: 161, freq: 5805, dfs: false, band: 'UNII-3' },
  { channel: 165, freq: 5825, dfs: false, band: 'UNII-3' },
];

// UNII band boundaries for visual grouping
const UNII_BANDS = [
  { name: 'UNII-1', startFreq: 5170, endFreq: 5250, color: '#22c55e', dfs: false },
  { name: 'DFS', startFreq: 5250, endFreq: 5330, color: '#f59e0b', dfs: true },  // UNII-2A
  { name: 'DFS', startFreq: 5490, endFreq: 5570, color: '#f59e0b', dfs: true },  // UNII-2C
  { name: 'UNII-3', startFreq: 5735, endFreq: 5835, color: '#3b82f6', dfs: false },
];

const INTERFERENCE_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  microwave: { icon: '📡', label: 'Microwave', color: '#ef4444' },
  bluetooth: { icon: '🔵', label: 'Bluetooth', color: '#3b82f6' },
  zigbee: { icon: '⚡', label: 'ZigBee', color: '#22c55e' },
  radar: { icon: '🛡️', label: 'Radar', color: '#f59e0b' },
  cordless: { icon: '📞', label: 'Cordless Phone', color: '#8b5cf6' },
  unknown: { icon: '❓', label: 'Unknown', color: '#6b7280' },
};

const BAND_COLORS = {
  '2.4GHz': { primary: '#3b82f6', secondary: '#93c5fd', bg: 'bg-blue-500' },
  '5GHz': { primary: '#8b5cf6', secondary: '#c4b5fd', bg: 'bg-purple-500' },
  '6GHz': { primary: '#06b6d4', secondary: '#67e8f9', bg: 'bg-cyan-500' },
};

function getUtilizationColor(utilization: number): string {
  if (utilization >= 80) return '#ef4444';
  if (utilization >= 60) return '#f97316';
  if (utilization >= 40) return '#f59e0b';
  if (utilization >= 20) return '#eab308';
  return '#22c55e';
}

/**
 * ChannelHeatmapCard - RF Spectrum Analyzer
 *
 * Shows:
 * - Visual spectrum graph with channel utilization
 * - Overlapping channel visualization for 2.4GHz
 * - Interference source markers
 * - DFS radar indicators for 5GHz
 * - Click-to-expand AP details with Change Channel action
 */
export const ChannelHeatmapCard = memo(({ data, config }: ChannelHeatmapCardProps) => {
  const { demoMode } = useDemoMode();
  const [selectedBand, setSelectedBand] = useState<'2.4GHz' | '5GHz'>('2.4GHz');
  const [hoveredChannel, setHoveredChannel] = useState<number | null>(null);
  const [selectedAP, setSelectedAP] = useState<APChannelData | null>(null);
  const [showChangeChannel, setShowChangeChannel] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    if (!data && !demoMode) return null;

    let aps = data?.accessPoints || data?.aps || [];

    // Generate mock data if no real data and demo mode is enabled
    if (aps.length === 0 && demoMode) {
      aps = [
        { apName: 'AP-Floor1-Main', band: '2.4GHz' as const, channel: 1, channelWidth: 20, utilization: 65, interference: 25, noiseFloor: -85, txPower: 18, clients: 24, neighborAPs: 3 },
        { apName: 'AP-Floor1-East', band: '2.4GHz' as const, channel: 6, channelWidth: 20, utilization: 78, interference: 42, noiseFloor: -82, txPower: 17, clients: 32, neighborAPs: 5 },
        { apName: 'AP-Floor1-West', band: '2.4GHz' as const, channel: 11, channelWidth: 20, utilization: 45, interference: 18, noiseFloor: -88, txPower: 19, clients: 18, neighborAPs: 2 },
        { apName: 'AP-Floor2-Main', band: '5GHz' as const, channel: 36, channelWidth: 40, utilization: 55, interference: 12, noiseFloor: -92, txPower: 20, clients: 28, neighborAPs: 1 },
        { apName: 'AP-Floor2-East', band: '5GHz' as const, channel: 149, channelWidth: 80, utilization: 38, interference: 8, noiseFloor: -95, txPower: 22, clients: 15, neighborAPs: 0 },
        { apName: 'AP-Conf-Room', band: '5GHz' as const, channel: 52, channelWidth: 40, utilization: 25, interference: 5, noiseFloor: -93, txPower: 18, clients: 8, neighborAPs: 0, dfsEvents: 2 },
      ];
    }

    if (aps.length === 0) return null;

    // Group by band
    const byBand: Record<string, APChannelData[]> = {
      '2.4GHz': [],
      '5GHz': [],
      '6GHz': [],
    };

    for (const ap of aps) {
      if (byBand[ap.band]) {
        byBand[ap.band].push(ap);
      }
    }

    // Calculate channel utilization map for each band
    const channelMap: Record<string, Record<number, ChannelUtilData>> = {};

    for (const [band, bandAPs] of Object.entries(byBand)) {
      channelMap[band] = {};
      for (const ap of bandAPs) {
        if (!channelMap[band][ap.channel]) {
          channelMap[band][ap.channel] = { aps: [], avgUtil: 0, maxUtil: 0 };
        }
        channelMap[band][ap.channel].aps.push(ap);
      }

      // Calculate averages
      for (const ch of Object.keys(channelMap[band])) {
        const chData = channelMap[band][Number(ch)];
        chData.avgUtil = Math.round(chData.aps.reduce((s, a) => s + a.utilization, 0) / chData.aps.length);
        chData.maxUtil = Math.max(...chData.aps.map(a => a.utilization));
      }
    }

    // Count DFS events
    const dfsEventCount = byBand['5GHz'].reduce((sum, ap) => sum + (ap.dfsEvents || 0), 0);

    return {
      byBand,
      channelMap,
      interference: data?.interferenceSource || [],
      totalAPs: aps.length,
      dfsEventCount,
    };
  }, [data, demoMode]);

  const handleChangeChannel = useCallback(() => {
    setShowChangeChannel(true);
  }, []);

  const handleConfirmChannelChange = useCallback(async (newChannel: number) => {
    if (!selectedAP?.serial) {
      setActionState({ status: 'error', message: 'No AP serial available' });
      setTimeout(() => setActionState({ status: 'idle' }), 3000);
      return;
    }

    setActionState({ status: 'loading', message: `Changing channel to ${newChannel}...` });

    const result = await executeCardAction('change-channel', {
      serial: selectedAP.serial,
      channel: newChannel,
      band: selectedAP.band,
    });

    if (result.success) {
      setActionState({ status: 'success', message: `${selectedAP.apName} changed to ch ${newChannel}` });
    } else {
      setActionState({ status: 'error', message: result.message });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
    setShowChangeChannel(false);
    setSelectedAP(null);
  }, [selectedAP]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No channel data
      </div>
    );
  }

  const bandAPs = processedData.byBand[selectedBand] || [];
  const channelData: Record<number, ChannelUtilData> = processedData.channelMap[selectedBand] || {};
  const channels = selectedBand === '2.4GHz' ? CHANNELS_2_4GHZ : CHANNELS_5GHZ;
  const bandColor = BAND_COLORS[selectedBand];

  // SVG dimensions
  const width = 400;
  const height = 160;
  const margin = { top: 20, right: 10, bottom: 30, left: 30 };
  const graphWidth = width - margin.left - margin.right;
  const graphHeight = height - margin.top - margin.bottom;

  // Calculate x scale
  const minFreq = Math.min(...channels.map(c => c.freq)) - 10;
  const maxFreq = Math.max(...channels.map(c => c.freq)) + 10;
  const xScale = (freq: number) => margin.left + ((freq - minFreq) / (maxFreq - minFreq)) * graphWidth;
  const yScale = (util: number) => margin.top + graphHeight - (util / 100) * graphHeight;

  // Generate spectrum curve for each channel
  const generateChannelCurve = (channel: typeof channels[0], utilization: number) => {
    const centerX = xScale(channel.freq);
    const peakY = yScale(utilization);
    const baseY = yScale(0);

    // For 5GHz, use a minimum visual width since the frequency range is much larger
    // 2.4GHz: 50MHz range, 5GHz: 645MHz range (13x wider!)
    // We need to ensure curves are visible and not paper-thin
    let halfWidth: number;
    if (selectedBand === '2.4GHz') {
      // 2.4GHz: channels overlap, use actual 22MHz width
      const channelWidthMHz = 22;
      halfWidth = (channelWidthMHz / (maxFreq - minFreq)) * graphWidth / 2;
    } else {
      // 5GHz: use minimum visual width for visibility (roughly 1/17th of graph for 17 channels)
      // This ensures each channel curve is clearly visible
      const minVisualWidth = graphWidth / 25; // Minimum width for visibility
      halfWidth = Math.max(minVisualWidth / 2, 8); // At least 8px half-width
    }

    return `M ${centerX - halfWidth} ${baseY}
            Q ${centerX - halfWidth * 0.5} ${peakY + (baseY - peakY) * 0.3}, ${centerX} ${peakY}
            Q ${centerX + halfWidth * 0.5} ${peakY + (baseY - peakY) * 0.3}, ${centerX + halfWidth} ${baseY}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with band tabs */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {(['2.4GHz', '5GHz'] as const).map((band) => (
              <button
                key={band}
                onClick={() => setSelectedBand(band)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  selectedBand === band
                    ? band === '2.4GHz'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {band} ({processedData.byBand[band]?.length || 0})
              </button>
            ))}
          </div>
          {selectedBand === '5GHz' && processedData.dfsEventCount > 0 && (
            <span className="px-2 py-0.5 text-[9px] font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              {processedData.dfsEventCount} DFS
            </span>
          )}
        </div>
      </div>

      {/* Spectrum Visualization */}
      <div className="flex-1 p-2 overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Gradient for filled curves */}
            <linearGradient id="spectrumGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={bandColor.primary} stopOpacity="0.6" />
              <stop offset="100%" stopColor={bandColor.primary} stopOpacity="0.1" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* UNII Band regions for 5GHz */}
          {selectedBand === '5GHz' && UNII_BANDS.map((band) => {
            const x1 = xScale(band.startFreq);
            const x2 = xScale(band.endFreq);
            return (
              <g key={band.name}>
                {/* Band background */}
                <rect
                  x={x1}
                  y={margin.top}
                  width={x2 - x1}
                  height={graphHeight}
                  fill={band.color}
                  opacity="0.08"
                />
                {/* Band label */}
                <text
                  x={(x1 + x2) / 2}
                  y={margin.top + 8}
                  fontSize="7"
                  fill={band.color}
                  textAnchor="middle"
                  fontWeight="500"
                  opacity="0.8"
                >
                  {band.name}
                </text>
              </g>
            );
          })}

          {/* Background grid */}
          <g className="text-slate-200 dark:text-slate-700">
            {[0, 25, 50, 75, 100].map((util) => (
              <g key={util}>
                <line
                  x1={margin.left}
                  y1={yScale(util)}
                  x2={width - margin.right}
                  y2={yScale(util)}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  strokeDasharray={util === 0 ? "none" : "2,2"}
                />
                <text
                  x={margin.left - 4}
                  y={yScale(util)}
                  fontSize="8"
                  fill="currentColor"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {util}%
                </text>
              </g>
            ))}
          </g>

          {/* Noise floor animation */}
          <path
            d={`M ${margin.left} ${yScale(5)} ${Array.from({ length: 50 }, (_, i) => {
              const x = margin.left + (i / 49) * graphWidth;
              const noise = 3 + Math.random() * 4;
              return `L ${x} ${yScale(noise)}`;
            }).join(' ')} L ${width - margin.right} ${yScale(5)}`}
            fill="none"
            stroke="#64748b"
            strokeWidth="0.5"
            opacity="0.5"
          >
            <animate
              attributeName="d"
              dur="2s"
              repeatCount="indefinite"
              values={`M ${margin.left} ${yScale(5)} ${Array.from({ length: 50 }, (_, i) => {
                const x = margin.left + (i / 49) * graphWidth;
                const noise = 3 + Math.random() * 4;
                return `L ${x} ${yScale(noise)}`;
              }).join(' ')} L ${width - margin.right} ${yScale(5)};
              M ${margin.left} ${yScale(5)} ${Array.from({ length: 50 }, (_, i) => {
                const x = margin.left + (i / 49) * graphWidth;
                const noise = 3 + Math.random() * 4;
                return `L ${x} ${yScale(noise)}`;
              }).join(' ')} L ${width - margin.right} ${yScale(5)}`}
            />
          </path>

          {/* Channel curves */}
          {channels.map((ch): React.ReactNode => {
            const chData: ChannelUtilData | undefined = channelData[ch.channel];
            const utilization = chData?.maxUtil || 0;
            const isHovered = hoveredChannel === ch.channel;

            // For 5GHz, check if it's a DFS channel
            const isDFS = 'dfs' in ch && ch.dfs;
            const hasAPsOnChannel = chData && chData.aps.length > 0;

            // Channel curve element
            let channelCurveElement: React.ReactNode = null;
            if (chData && chData.aps.length > 0) {
              channelCurveElement = (
                <g>
                  <path
                    d={generateChannelCurve(ch, utilization)}
                    fill="url(#spectrumGradient)"
                    stroke={getUtilizationColor(utilization)}
                    strokeWidth={isHovered ? 2 : 1}
                    opacity={isHovered ? 1 : 0.7}
                    filter={isHovered ? 'url(#glow)' : undefined}
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                    onMouseEnter={() => setHoveredChannel(ch.channel)}
                    onMouseLeave={() => setHoveredChannel(null)}
                    onClick={() => {
                      setSelectedAP(chData.aps[0]);
                    }}
                  />
                  {/* Peak indicator */}
                  <circle
                    cx={xScale(ch.freq)}
                    cy={yScale(utilization)}
                    r={isHovered ? 4 : 3}
                    fill={getUtilizationColor(utilization)}
                    stroke="white"
                    strokeWidth="1"
                  >
                    {utilization >= 70 ? (
                      <animate
                        attributeName="r"
                        values="3;5;3"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    ) : null}
                  </circle>
                </g>
              );
            }

            return (
              <g key={ch.channel}>
                {/* Channel curve - render if APs exist on this channel */}
                {channelCurveElement as React.ReactNode}

                {/* DFS indicator - only show for channels with active APs */}
                {isDFS && hasAPsOnChannel ? (
                  <g>
                    <circle
                      cx={xScale(ch.freq)}
                      cy={margin.top - 6}
                      r="4"
                      fill="#f59e0b"
                      opacity="0.8"
                    />
                    <text
                      x={xScale(ch.freq)}
                      y={margin.top - 3}
                      fontSize="5"
                      fill="white"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      D
                    </text>
                  </g>
                ) : null}

                {/* Channel label - for 5GHz, only show first/last of each UNII band to avoid crowding */}
                {(() => {
                  // For 5GHz, only show key channels: 36, 48 (UNII-1), 52, 64 (UNII-2A), 100, 112 (UNII-2C), 149, 165 (UNII-3)
                  const keyChannels5GHz = [36, 48, 52, 64, 100, 112, 149, 165];
                  const showLabel = selectedBand === '2.4GHz' || keyChannels5GHz.includes(ch.channel) || isHovered || hasAPsOnChannel;

                  if (!showLabel) return null;

                  return (
                    <text
                      x={xScale(ch.freq)}
                      y={height - 8}
                      fontSize={selectedBand === '5GHz' ? '7' : '8'}
                      fill={isHovered ? bandColor.primary : hasAPsOnChannel ? '#64748b' : '#94a3b8'}
                      textAnchor="middle"
                      fontWeight={isHovered || hasAPsOnChannel ? 'bold' : 'normal'}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredChannel(ch.channel)}
                      onMouseLeave={() => setHoveredChannel(null)}
                    >
                      {ch.channel}
                    </text>
                  );
                })()}
              </g>
            );
          })}

          {/* Interference markers */}
          {processedData.interference
            .filter(i => i.band === selectedBand)
            .map((interference, idx) => {
              const iconInfo = INTERFERENCE_ICONS[interference.type];
              const x = xScale(interference.frequency);

              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={margin.top}
                    x2={x}
                    y2={yScale(0)}
                    stroke={iconInfo.color}
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    opacity="0.6"
                  />
                  <text
                    x={x}
                    y={margin.top + 10}
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {iconInfo.icon}
                  </text>
                </g>
              );
            })}

          {/* Hover tooltip */}
          {hoveredChannel && channelData[hoveredChannel] && (
            <g>
              <rect
                x={xScale(channels.find(c => c.channel === hoveredChannel)!.freq) - 35}
                y={margin.top + 5}
                width="70"
                height="40"
                rx="4"
                fill="rgba(15, 23, 42, 0.9)"
                stroke={bandColor.primary}
                strokeWidth="1"
              />
              <text
                x={xScale(channels.find(c => c.channel === hoveredChannel)!.freq)}
                y={margin.top + 18}
                fontSize="9"
                fill="white"
                textAnchor="middle"
                fontWeight="bold"
              >
                Ch {hoveredChannel}
              </text>
              <text
                x={xScale(channels.find(c => c.channel === hoveredChannel)!.freq)}
                y={margin.top + 30}
                fontSize="8"
                fill="#94a3b8"
                textAnchor="middle"
              >
                {channelData[hoveredChannel].aps.length} APs
              </text>
              <text
                x={xScale(channels.find(c => c.channel === hoveredChannel)!.freq)}
                y={margin.top + 40}
                fontSize="8"
                fill={getUtilizationColor(channelData[hoveredChannel].maxUtil)}
                textAnchor="middle"
              >
                {channelData[hoveredChannel].maxUtil}% util
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* AP List / Details Panel */}
      {selectedAP ? (
        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          {showChangeChannel ? (
            // Channel selection panel
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Select new channel for {selectedAP.apName}
                </span>
                <button
                  onClick={() => setShowChangeChannel(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {(selectedBand === '2.4GHz' ? [1, 6, 11] : [36, 40, 44, 48, 149, 153, 157, 161]).map((ch) => {
                  const isCurrentChannel = selectedAP.channel === ch;
                  return (
                    <button
                      key={ch}
                      onClick={() => handleConfirmChannelChange(ch)}
                      disabled={isCurrentChannel}
                      className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                        isCurrentChannel
                          ? 'bg-slate-200 dark:bg-slate-600 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/40'
                      }`}
                    >
                      Ch {ch}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            // AP details panel
            <div className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {selectedAP.apName}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Channel {selectedAP.channel} · {selectedAP.channelWidth || 20}MHz · {selectedAP.txPower || 'Auto'} dBm
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAP(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                <div>
                  <div className={`text-sm font-bold ${
                    selectedAP.utilization >= 70 ? 'text-red-500' :
                    selectedAP.utilization >= 40 ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {selectedAP.utilization}%
                  </div>
                  <div className="text-[8px] text-slate-500">Util</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {selectedAP.clients || 0}
                  </div>
                  <div className="text-[8px] text-slate-500">Clients</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {selectedAP.noiseFloor || -90} dBm
                  </div>
                  <div className="text-[8px] text-slate-500">Noise</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {selectedAP.neighborAPs || 0}
                  </div>
                  <div className="text-[8px] text-slate-500">Neighbors</div>
                </div>
              </div>

              <button
                onClick={handleChangeChannel}
                className="mt-2 w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Change Channel
              </button>
            </div>
          )}
        </div>
      ) : (
        // Mini AP list when no AP selected
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 max-h-24 overflow-auto">
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Click a channel to manage
          </div>
          <div className="flex flex-wrap gap-1">
            {bandAPs.slice(0, 6).map((ap, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedAP(ap)}
                onMouseEnter={() => setHoveredChannel(ap.channel)}
                onMouseLeave={() => setHoveredChannel(null)}
                className={`px-2 py-0.5 text-[9px] rounded flex items-center gap-1 transition-colors ${
                  hoveredChannel === ap.channel
                    ? 'bg-slate-200 dark:bg-slate-600'
                    : 'bg-slate-100 dark:bg-slate-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  ap.utilization >= 70 ? 'bg-red-500' :
                  ap.utilization >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[60px]">
                  {ap.apName}
                </span>
                <span className="text-slate-500">Ch{ap.channel}</span>
              </button>
            ))}
            {bandAPs.length > 6 && (
              <span className="px-2 py-0.5 text-[9px] text-slate-400">
                +{bandAPs.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between text-[8px]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Low
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Med
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              High
            </span>
          </div>
          {processedData.interference.length > 0 && (
            <div className="flex items-center gap-1 text-slate-500">
              <span>⚡</span>
              <span>{processedData.interference.length} interference</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ChannelHeatmapCard.displayName = 'ChannelHeatmapCard';

export default ChannelHeatmapCard;
