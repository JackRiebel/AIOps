'use client';

import { memo, useMemo, useState } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { EmptyState } from '../core';

// ============================================================================
// Types
// ============================================================================

interface DistributionItem {
  name: string;
  count: number;
  color: string;
  percentage: number;
}

interface ClientDistributionData {
  total_clients?: number;
  distributions?: {
    by_ssid?: DistributionItem[];
    by_device_type?: DistributionItem[];
    by_vlan?: DistributionItem[];
  };
  top_clients?: Array<{
    name: string;
    ip: string;
    mac: string;
    ssid: string;
    usage: string;
    signal: number;
    status: string;
  }>;
  connection_quality?: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  views?: string[];
}

// ============================================================================
// View Configuration
// ============================================================================

const VIEW_ICONS: Record<string, React.ReactNode> = {
  by_ssid: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  by_device_type: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  by_vlan: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  ),
};

const VIEW_LABELS: Record<string, string> = {
  by_ssid: 'SSID',
  by_device_type: 'Device',
  by_vlan: 'VLAN',
};

// ============================================================================
// Demo Data
// ============================================================================

const DEMO_DATA: ClientDistributionData = {
  total_clients: 285,
  distributions: {
    by_ssid: [
      { name: 'Corporate-5G', count: 145, color: '#3b82f6', percentage: 50.9 },
      { name: 'Guest-WiFi', count: 78, color: '#8b5cf6', percentage: 27.4 },
      { name: 'IoT-Network', count: 42, color: '#06b6d4', percentage: 14.7 },
      { name: 'Executive', count: 20, color: '#10b981', percentage: 7.0 },
    ],
    by_device_type: [
      { name: 'Windows', count: 120, color: '#3b82f6', percentage: 42.1 },
      { name: 'iOS', count: 85, color: '#8b5cf6', percentage: 29.8 },
      { name: 'Android', count: 50, color: '#06b6d4', percentage: 17.5 },
      { name: 'macOS', count: 30, color: '#10b981', percentage: 10.5 },
    ],
    by_vlan: [
      { name: 'VLAN 100', count: 150, color: '#3b82f6', percentage: 52.6 },
      { name: 'VLAN 200', count: 80, color: '#8b5cf6', percentage: 28.1 },
      { name: 'VLAN 300', count: 55, color: '#06b6d4', percentage: 19.3 },
    ],
  },
  connection_quality: { excellent: 120, good: 100, fair: 45, poor: 20 },
  views: ['by_ssid', 'by_device_type', 'by_vlan'],
};

// ============================================================================
// Component
// ============================================================================

export const ClientDistributionCard = memo(({ data }: { data: ClientDistributionData }) => {
  const [view, setView] = useState<string>('by_ssid');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { demoMode } = useDemoMode();

  // Generate demo data if needed
  const processedData = useMemo(() => {
    if (demoMode && (!data || !data.distributions)) {
      return DEMO_DATA;
    }
    if (!data || !data.distributions) return null;
    return data;
  }, [data, demoMode]);

  if (!processedData) {
    return <EmptyState message="No client data available" />;
  }

  const currentDistribution = processedData.distributions?.[view as keyof typeof processedData.distributions] || [];
  const totalClients = processedData.total_clients || 0;

  // Generate donut chart paths (ring style, more modern)
  const donutSegments = useMemo(() => {
    if (!currentDistribution.length) return [];

    const segments: Array<{
      path: string;
      color: string;
      item: DistributionItem;
      midAngle: number;
    }> = [];
    let startAngle = -90;
    const cx = 50, cy = 50;
    const outerR = 42, innerR = 28;

    currentDistribution.forEach((item) => {
      const angle = (item.percentage / 100) * 360;
      const endAngle = startAngle + angle;
      const midAngle = startAngle + angle / 2;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      // Outer arc
      const x1 = cx + outerR * Math.cos(startRad);
      const y1 = cy + outerR * Math.sin(startRad);
      const x2 = cx + outerR * Math.cos(endRad);
      const y2 = cy + outerR * Math.sin(endRad);

      // Inner arc
      const x3 = cx + innerR * Math.cos(endRad);
      const y3 = cy + innerR * Math.sin(endRad);
      const x4 = cx + innerR * Math.cos(startRad);
      const y4 = cy + innerR * Math.sin(startRad);

      const largeArc = angle > 180 ? 1 : 0;
      const path = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      segments.push({ path, color: item.color, item, midAngle });
      startAngle = endAngle;
    });

    return segments;
  }, [currentDistribution]);

  // Connection quality bar
  const qualityData = processedData.connection_quality;
  const qualityTotal = qualityData ? qualityData.excellent + qualityData.good + qualityData.fair + qualityData.poor : 0;

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-slate-200/80 dark:border-slate-700/80">
        <div className="flex items-center justify-between">
          {/* Total clients with icon */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">
                {totalClients.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">connected clients</div>
            </div>
          </div>

          {/* View tabs with icons */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            {(processedData.views || ['by_ssid', 'by_device_type', 'by_vlan']).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all duration-200 ${view === v
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                {VIEW_ICONS[v]}
                <span className="hidden sm:inline">{VIEW_LABELS[v] || v.replace('by_', '')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden p-3">
        <div className="flex gap-4 h-full">
          {/* Donut chart with center info */}
          <div className="flex-shrink-0 relative">
            <svg viewBox="0 0 100 100" className="w-28 h-28">
              {/* Background ring */}
              <circle
                cx="50" cy="50" r="35"
                fill="none"
                stroke="currentColor"
                strokeWidth="14"
                className="text-slate-100 dark:text-slate-800"
              />

              {/* Donut segments */}
              {donutSegments.map((seg, i) => (
                <path
                  key={i}
                  d={seg.path}
                  fill={seg.color}
                  className={`transition-all duration-200 cursor-pointer ${hoveredIndex === i ? 'opacity-100' : hoveredIndex !== null ? 'opacity-40' : 'opacity-90'
                    }`}
                  style={{
                    filter: hoveredIndex === i ? 'brightness(1.1)' : 'none',
                    transform: hoveredIndex === i ? 'scale(1.02)' : 'scale(1)',
                    transformOrigin: '50px 50px',
                  }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))}

              {/* Center circle with info */}
              <circle cx="50" cy="50" r="24" className="fill-white dark:fill-slate-900" />

              {/* Center text */}
              {hoveredIndex !== null && currentDistribution[hoveredIndex] ? (
                <>
                  <text x="50" y="46" textAnchor="middle" className="text-[9px] font-bold fill-slate-800 dark:fill-slate-100">
                    {currentDistribution[hoveredIndex].count}
                  </text>
                  <text x="50" y="56" textAnchor="middle" className="text-[6px] fill-slate-500 dark:fill-slate-400">
                    {currentDistribution[hoveredIndex].percentage.toFixed(1)}%
                  </text>
                </>
              ) : (
                <>
                  <text x="50" y="46" textAnchor="middle" className="text-[9px] font-bold fill-slate-800 dark:fill-slate-100">
                    {currentDistribution.length}
                  </text>
                  <text x="50" y="56" textAnchor="middle" className="text-[6px] fill-slate-500 dark:fill-slate-400">
                    {VIEW_LABELS[view] || 'items'}
                  </text>
                </>
              )}
            </svg>
          </div>

          {/* Legend with progress bars */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {currentDistribution.map((item, i) => (
              <div
                key={i}
                className={`group rounded-lg p-2 transition-all duration-200 cursor-pointer ${hoveredIndex === i
                  ? 'bg-slate-100 dark:bg-slate-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                      {item.count.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 tabular-nums w-9 text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                      opacity: hoveredIndex === i ? 1 : 0.8,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Connection quality footer - stacked bar */}
      {qualityData && qualityTotal > 0 && (
        <div className="flex-shrink-0 px-3 py-2.5 border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Signal Quality</span>
            <div className="flex items-center gap-3 text-[9px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-500 dark:text-slate-400">{qualityData.excellent}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-slate-500 dark:text-slate-400">{qualityData.good}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-500 dark:text-slate-400">{qualityData.fair}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-slate-500 dark:text-slate-400">{qualityData.poor}</span>
              </span>
            </div>
          </div>
          {/* Stacked bar */}
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(qualityData.excellent / qualityTotal) * 100}%` }}
            />
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(qualityData.good / qualityTotal) * 100}%` }}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${(qualityData.fair / qualityTotal) * 100}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{ width: `${(qualityData.poor / qualityTotal) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

ClientDistributionCard.displayName = 'ClientDistributionCard';

export default ClientDistributionCard;
