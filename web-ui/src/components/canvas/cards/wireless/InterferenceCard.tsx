'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, type ActionState } from '@/services/cardActions';

interface InterferenceSource {
  type: 'microwave' | 'bluetooth' | 'cordless' | 'video' | 'jammer' | 'radar' | 'unknown' | 'wifi';
  severity: 'high' | 'medium' | 'low';
  affectedChannels?: number[];
  affectedBand?: '2.4GHz' | '5GHz';
  dutyCycle?: number;
  apName?: string;
  apSerial?: string;
  firstSeen?: string;
  lastSeen?: string;
  frequency?: number;
  power?: number;
}

interface APInterference {
  apName: string;
  serial?: string;
  band: '2.4GHz' | '5GHz';
  channel: number;
  interference: number;
  noiseFloor: number;
  utilization: number;
  sources?: InterferenceSource[];
  trend?: number[];
}

interface InterferenceCardData {
  accessPoints?: APInterference[];
  aps?: APInterference[];
  sources?: InterferenceSource[];
  networkId?: string;
  timeRange?: string;
}

interface InterferenceCardProps {
  data: InterferenceCardData;
  config?: {
    showSources?: boolean;
  };
}

const SOURCE_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  microwave: { icon: '🍳', label: 'Microwave', color: '#f97316', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  bluetooth: { icon: '📶', label: 'Bluetooth', color: '#3b82f6', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  cordless: { icon: '📞', label: 'Cordless', color: '#8b5cf6', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  video: { icon: '📹', label: 'Video', color: '#ec4899', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  jammer: { icon: '⚡', label: 'Jammer', color: '#ef4444', bg: 'bg-red-100 dark:bg-red-900/30' },
  radar: { icon: '📡', label: 'Radar', color: '#f59e0b', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  wifi: { icon: '📻', label: 'WiFi', color: '#06b6d4', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  unknown: { icon: '❓', label: 'Unknown', color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-700' },
};

// 2.4GHz channels (1-14)
const CHANNELS_2_4 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
// 5GHz channels (common UNII bands)
const CHANNELS_5 = [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165];

type BandView = '2.4GHz' | '5GHz';

/**
 * InterferenceCard - Spectrum analyzer with interactive channel visualization
 */
export const InterferenceCard = memo(({ data }: InterferenceCardProps) => {
  const { demoMode } = useDemoMode();
  const [selectedBand, setSelectedBand] = useState<BandView>('2.4GHz');
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [hoveredChannel, setHoveredChannel] = useState<number | null>(null);
  const [selectedAP, setSelectedAP] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    if (!data && demoMode) {
      // Generate mock data
      const mockAPs: APInterference[] = [
        { apName: 'AP-Floor2-East', band: '2.4GHz', channel: 6, interference: 45, noiseFloor: -85, utilization: 72, sources: [{ type: 'microwave', severity: 'high', affectedChannels: [5, 6, 7], dutyCycle: 35 }] },
        { apName: 'AP-Floor2-West', band: '2.4GHz', channel: 1, interference: 28, noiseFloor: -88, utilization: 55 },
        { apName: 'AP-Floor1-Main', band: '2.4GHz', channel: 11, interference: 52, noiseFloor: -82, utilization: 85, sources: [{ type: 'bluetooth', severity: 'medium', affectedChannels: [10, 11], dutyCycle: 20 }] },
        { apName: 'AP-Lobby', band: '5GHz', channel: 36, interference: 15, noiseFloor: -92, utilization: 40 },
        { apName: 'AP-Conference', band: '5GHz', channel: 149, interference: 8, noiseFloor: -95, utilization: 25 },
        { apName: 'AP-Executive', band: '5GHz', channel: 52, interference: 22, noiseFloor: -90, utilization: 60, sources: [{ type: 'radar', severity: 'low', affectedChannels: [52, 56], dutyCycle: 5 }] },
      ];
      return processInterference(mockAPs, []);
    }

    if (!data) return null;

    const aps = data.accessPoints || data.aps || [];
    const sources = data.sources || [];

    if (aps.length === 0 && sources.length === 0) return null;
    return processInterference(aps, sources);
  }, [data, demoMode]);

  function processInterference(aps: APInterference[], sources: InterferenceSource[]) {
    const sortedAPs = [...aps].sort((a, b) => b.interference - a.interference);

    // Generate channel interference data
    const channelData2_4: Record<number, { interference: number; utilization: number; aps: string[]; sources: InterferenceSource[] }> = {};
    const channelData5: Record<number, { interference: number; utilization: number; aps: string[]; sources: InterferenceSource[] }> = {};

    CHANNELS_2_4.forEach(ch => {
      channelData2_4[ch] = { interference: Math.random() * 30, utilization: Math.random() * 40, aps: [], sources: [] };
    });
    CHANNELS_5.forEach(ch => {
      channelData5[ch] = { interference: Math.random() * 15, utilization: Math.random() * 30, aps: [], sources: [] };
    });

    // Populate from APs
    aps.forEach(ap => {
      const channelData = ap.band === '2.4GHz' ? channelData2_4 : channelData5;
      if (channelData[ap.channel]) {
        channelData[ap.channel].interference = ap.interference;
        channelData[ap.channel].utilization = ap.utilization;
        channelData[ap.channel].aps.push(ap.apName);
        if (ap.sources) {
          channelData[ap.channel].sources.push(...ap.sources);
        }
      }
    });

    // Add mock trend data
    const withTrend = sortedAPs.map(ap => ({
      ...ap,
      trend: ap.trend || Array.from({ length: 12 }, () => ap.interference * (0.7 + Math.random() * 0.6)),
    }));

    // Collect all sources
    const allSources: InterferenceSource[] = [...sources];
    aps.forEach(ap => {
      if (ap.sources) {
        ap.sources.forEach(s => allSources.push({ ...s, apName: ap.apName }));
      }
    });

    // Stats
    const avgInterference = aps.length > 0
      ? Math.round(aps.reduce((sum, ap) => sum + ap.interference, 0) / aps.length)
      : 0;
    const highCount = aps.filter(ap => ap.interference >= 30).length;
    const avgNoiseFloor = aps.length > 0
      ? Math.round(aps.reduce((sum, ap) => sum + ap.noiseFloor, 0) / aps.length)
      : -95;

    // Source type counts
    const sourceTypes: Record<string, number> = {};
    allSources.forEach(s => {
      sourceTypes[s.type] = (sourceTypes[s.type] || 0) + 1;
    });

    return {
      aps: withTrend,
      channelData2_4,
      channelData5,
      allSources,
      sourceTypes,
      avgInterference,
      highCount,
      avgNoiseFloor,
    };
  }

  const channels = selectedBand === '2.4GHz' ? CHANNELS_2_4 : CHANNELS_5;
  const channelData = selectedBand === '2.4GHz' ? processedData?.channelData2_4 : processedData?.channelData5;

  const selectedAPData = useMemo(() => {
    if (!selectedAP || !processedData) return null;
    return processedData.aps.find(ap => ap.apName === selectedAP);
  }, [selectedAP, processedData]);

  const selectedChannelData = useMemo(() => {
    if (!selectedChannel || !channelData) return null;
    return channelData[selectedChannel];
  }, [selectedChannel, channelData]);

  const generateSparkline = useCallback((trend: number[], width: number, height: number) => {
    if (!trend || trend.length === 0) return '';
    const max = Math.max(...trend);
    const min = Math.min(...trend);
    const range = max - min || 1;

    const points = trend.map((v, i) => {
      const x = (i / (trend.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  }, []);

  const getInterferenceColor = (interference: number) => {
    if (interference >= 50) return '#ef4444';
    if (interference >= 30) return '#f97316';
    if (interference >= 15) return '#f59e0b';
    return '#22c55e';
  };

  const handleAction = useCallback(async (action: string, channel?: number) => {
    setActionState({ status: 'loading', message: `Executing ${action}...` });

    if (action === 'avoid-channel' && channel) {
      const result = await executeCardAction('avoid-channel', {
        channel,
        band: selectedBand,
        networkId: data?.networkId,
      });

      if (result.success) {
        setActionState({ status: 'success', message: `Channel ${channel} marked for avoidance` });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } else if (action === 'auto-channel') {
      const result = await executeCardAction('auto-channel', {
        networkId: data?.networkId,
      });

      if (result.success) {
        setActionState({ status: 'success', message: 'Auto-channel optimization started' });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [selectedBand, data?.networkId]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No interference data
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
              RF Interference
            </span>
            {processedData.highCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                {processedData.highCount} high
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setSelectedBand('2.4GHz'); setSelectedChannel(null); }}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                selectedBand === '2.4GHz'
                  ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              2.4GHz
            </button>
            <button
              onClick={() => { setSelectedBand('5GHz'); setSelectedChannel(null); }}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                selectedBand === '5GHz'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              5GHz
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-2">
        {selectedAP && selectedAPData ? (
          /* AP Detail View */
          <div className="h-full flex flex-col">
            <button
              onClick={() => setSelectedAP(null)}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back to spectrum
            </button>

            <div className="flex-1 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {selectedAPData.apName}
                </span>
                <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${
                  selectedAPData.band === '2.4GHz'
                    ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                }`}>
                  {selectedAPData.band} Ch {selectedAPData.channel}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                  <div className="text-lg font-bold" style={{ color: getInterferenceColor(selectedAPData.interference) }}>
                    {selectedAPData.interference}%
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Interference</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {selectedAPData.noiseFloor}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Noise (dBm)</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {selectedAPData.utilization}%
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Utilization</div>
                </div>
              </div>

              {/* Trend */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Interference Trend</div>
                <svg viewBox="0 0 180 40" className="w-full h-10">
                  <path
                    d={generateSparkline(selectedAPData.trend || [], 180, 36)}
                    fill="none"
                    stroke={getInterferenceColor(selectedAPData.interference)}
                    strokeWidth="2"
                  />
                </svg>
              </div>

              {/* Sources */}
              {selectedAPData.sources && selectedAPData.sources.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Interference Sources
                  </div>
                  <div className="space-y-1">
                    {selectedAPData.sources.map((source, i) => {
                      const config = SOURCE_TYPE_CONFIG[source.type] || SOURCE_TYPE_CONFIG.unknown;
                      return (
                        <div key={i} className={`flex items-center gap-2 p-1.5 rounded ${config.bg}`}>
                          <span className="text-sm">{config.icon}</span>
                          <div className="flex-1">
                            <div className="text-[10px] font-medium" style={{ color: config.color }}>
                              {config.label}
                            </div>
                            <div className="text-[9px] text-slate-500 dark:text-slate-400">
                              Channels {source.affectedChannels?.join(', ')} • {source.dutyCycle}% duty cycle
                            </div>
                          </div>
                          <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${
                            source.severity === 'high' ? 'bg-red-200 text-red-700' :
                            source.severity === 'medium' ? 'bg-amber-200 text-amber-700' :
                            'bg-emerald-200 text-emerald-700'
                          }`}>
                            {source.severity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Spectrum View */
          <div className="h-full flex flex-col">
            {/* Spectrum Analyzer */}
            <div className="flex-shrink-0 mb-2">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">
                Channel Spectrum ({selectedBand})
              </div>
              <svg viewBox={`0 0 ${channels.length * 18 + 20} 70`} className="w-full h-16">
                {/* Grid lines */}
                {[25, 50, 75].map(pct => (
                  <line
                    key={pct}
                    x1="10" y1={60 - (pct / 100) * 50}
                    x2={channels.length * 18 + 10} y2={60 - (pct / 100) * 50}
                    stroke="currentColor"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                    className="text-slate-200 dark:text-slate-700"
                  />
                ))}

                {/* Bars */}
                {channels.map((ch, i) => {
                  const chData = channelData?.[ch];
                  const interference = chData?.interference || 0;
                  const utilization = chData?.utilization || 0;
                  const isHovered = hoveredChannel === ch;
                  const isSelected = selectedChannel === ch;
                  const x = 10 + i * 18;
                  const barHeight = (interference / 100) * 50;
                  const utilHeight = (utilization / 100) * 50;

                  return (
                    <g
                      key={ch}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredChannel(ch)}
                      onMouseLeave={() => setHoveredChannel(null)}
                      onClick={() => setSelectedChannel(ch === selectedChannel ? null : ch)}
                    >
                      {/* Utilization bar (background) */}
                      <rect
                        x={x}
                        y={60 - utilHeight}
                        width="14"
                        height={utilHeight}
                        fill="currentColor"
                        className="text-slate-200 dark:text-slate-700"
                        rx="2"
                      />
                      {/* Interference bar */}
                      <rect
                        x={x}
                        y={60 - barHeight}
                        width="14"
                        height={barHeight}
                        fill={getInterferenceColor(interference)}
                        rx="2"
                        opacity={isHovered || isSelected ? 1 : 0.8}
                        className="transition-all"
                      />
                      {/* Selection highlight */}
                      {isSelected && (
                        <rect
                          x={x - 2}
                          y={5}
                          width="18"
                          height="58"
                          fill="none"
                          stroke={selectedBand === '2.4GHz' ? '#f97316' : '#3b82f6'}
                          strokeWidth="2"
                          rx="3"
                        />
                      )}
                      {/* Channel label */}
                      <text
                        x={x + 7}
                        y="68"
                        textAnchor="middle"
                        className={`text-[7px] fill-slate-500 dark:fill-slate-400 ${isHovered || isSelected ? 'font-bold' : ''}`}
                      >
                        {ch}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Channel Details */}
            {selectedChannel && selectedChannelData && (
              <div className="flex-shrink-0 mb-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
                    Channel {selectedChannel}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: getInterferenceColor(selectedChannelData.interference) }}>
                    {Math.round(selectedChannelData.interference)}% interference
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400">
                  <span>Utilization: {Math.round(selectedChannelData.utilization)}%</span>
                  {selectedChannelData.aps.length > 0 && (
                    <span>• {selectedChannelData.aps.length} APs</span>
                  )}
                  {selectedChannelData.sources.length > 0 && (
                    <span className="text-amber-600">• {selectedChannelData.sources.length} sources</span>
                  )}
                </div>
              </div>
            )}

            {/* Source Type Filter */}
            {Object.keys(processedData.sourceTypes).length > 0 && (
              <div className="flex-shrink-0 mb-2 flex flex-wrap gap-1">
                {Object.entries(processedData.sourceTypes).map(([type, count]) => {
                  const config = SOURCE_TYPE_CONFIG[type] || SOURCE_TYPE_CONFIG.unknown;
                  const isActive = sourceFilter === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setSourceFilter(isActive ? null : type)}
                      className={`px-1.5 py-0.5 text-[9px] rounded flex items-center gap-1 transition-all ${
                        isActive ? config.bg : 'bg-slate-100 dark:bg-slate-700'
                      }`}
                    >
                      <span>{config.icon}</span>
                      <span style={{ color: isActive ? config.color : undefined }}>
                        {config.label} ({count})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* AP List */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {processedData.aps
                .filter(ap => ap.band === selectedBand)
                .filter(ap => !sourceFilter || ap.sources?.some(s => s.type === sourceFilter))
                .map((ap) => (
                  <div
                    key={ap.apName}
                    className="p-1.5 bg-slate-50 dark:bg-slate-800/30 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={() => setSelectedAP(ap.apName)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Interference indicator */}
                      <div
                        className="w-2 h-8 rounded-sm"
                        style={{ backgroundColor: getInterferenceColor(ap.interference) }}
                      />

                      {/* AP info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-slate-800 dark:text-slate-200 truncate">
                            {ap.apName}
                          </span>
                          <span className="text-[9px] text-slate-400">Ch {ap.channel}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400">
                          <span>{ap.noiseFloor} dBm</span>
                          <span>•</span>
                          <span>{ap.utilization}% util</span>
                          {ap.sources && ap.sources.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600">{ap.sources.length} sources</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Interference value and trend */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <svg viewBox="0 0 40 16" className="w-10 h-4">
                          <path
                            d={generateSparkline(ap.trend || [], 40, 14)}
                            fill="none"
                            stroke={getInterferenceColor(ap.interference)}
                            strokeWidth="1.5"
                          />
                        </svg>
                        <div className="text-right">
                          <div className="text-xs font-semibold" style={{ color: getInterferenceColor(ap.interference) }}>
                            {ap.interference}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Stats Summary */}
            <div className="flex-shrink-0 mt-2 grid grid-cols-3 gap-1">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Avg Interference</div>
                <div className="text-[10px] font-semibold" style={{ color: getInterferenceColor(processedData.avgInterference) }}>
                  {processedData.avgInterference}%
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Noise Floor</div>
                <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
                  {processedData.avgNoiseFloor} dBm
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Sources</div>
                <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
                  {processedData.allSources.length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex gap-1">
          <button
            onClick={() => handleAction('optimize', selectedChannel || undefined)}
            className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Optimize Channels
          </button>
          {selectedChannel && (
            <button
              onClick={() => handleAction('avoid', selectedChannel)}
              className="flex-1 px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
            >
              Avoid Ch {selectedChannel}
            </button>
          )}
          <button
            onClick={() => handleAction('locate')}
            className="px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            Locate
          </button>
        </div>
      </div>
    </div>
  );
});

InterferenceCard.displayName = 'InterferenceCard';

export default InterferenceCard;
