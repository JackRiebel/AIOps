'use client';

import React, { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { blockApplication, type ActionState, createActionStateManager } from '@/services/cardActions';

interface TrafficCategory {
  application?: string;
  name?: string;
  category?: string;
  bytes: number;
  percentage?: number;
  connections?: number;
  clients?: number;
}

interface TrafficCompositionCardData {
  categories?: TrafficCategory[];
  traffic?: TrafficCategory[];
  items?: Array<{ label: string; value: number }>;
  totalBytes?: number;
  networkId?: string;
  timeRange?: string;
}

interface TrafficCompositionCardProps {
  data: TrafficCompositionCardData;
  config?: {
    maxCategories?: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Consistent color palette matching the app theme
const CHART_COLORS = [
  { main: '#06b6d4', light: 'rgba(6, 182, 212, 0.1)' },   // Cyan (primary)
  { main: '#3b82f6', light: 'rgba(59, 130, 246, 0.1)' },  // Blue
  { main: '#22c55e', light: 'rgba(34, 197, 94, 0.1)' },   // Green
  { main: '#f59e0b', light: 'rgba(245, 158, 11, 0.1)' },  // Amber
  { main: '#8b5cf6', light: 'rgba(139, 92, 246, 0.1)' },  // Violet
  { main: '#ef4444', light: 'rgba(239, 68, 68, 0.1)' },   // Red
  { main: '#ec4899', light: 'rgba(236, 72, 153, 0.1)' },  // Pink
  { main: '#64748b', light: 'rgba(100, 116, 139, 0.1)' }, // Slate
];

interface ProcessedCategory extends TrafficCategory {
  displayName: string;
  percentage: number;
  color: typeof CHART_COLORS[0];
  startAngle: number;
  endAngle: number;
}

export const TrafficCompositionCard = memo(({ data, config }: TrafficCompositionCardProps) => {
  const maxCategories = config?.maxCategories ?? 8;
  const { demoMode } = useDemoMode();

  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });
  const stateManager = useMemo(() => createActionStateManager(setActionState), []);

  const processedData = useMemo(() => {
    if (!data && !demoMode) return null;

    let categories: TrafficCategory[] = [];

    if (data?.categories && data.categories.length > 0) {
      categories = data.categories;
    } else if (data?.traffic && data.traffic.length > 0) {
      categories = data.traffic;
    } else if (data?.items && data.items.length > 0) {
      categories = data.items.map(item => ({
        name: item.label,
        bytes: item.value,
      }));
    }

    // Generate demo data if needed
    if (categories.length === 0 && demoMode) {
      categories = [
        { name: 'Web Browsing', application: 'HTTPS/HTTP', bytes: 2500000000, connections: 4521, clients: 85 },
        { name: 'Video Streaming', application: 'YouTube/Netflix', bytes: 1800000000, connections: 856, clients: 42 },
        { name: 'Cloud Services', application: 'AWS/Azure/GCP', bytes: 950000000, connections: 2103, clients: 38 },
        { name: 'Productivity', application: 'Microsoft 365', bytes: 720000000, connections: 1234, clients: 76 },
        { name: 'Communication', application: 'Zoom/Teams/Slack', bytes: 450000000, connections: 312, clients: 54 },
        { name: 'Voice', application: 'VoIP/SIP', bytes: 180000000, connections: 89, clients: 23 },
        { name: 'Other', application: 'Misc', bytes: 320000000, connections: 567, clients: 31 },
      ];
    }

    if (categories.length === 0) return null;

    // Sort by bytes and limit
    const sorted = [...categories]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, maxCategories);

    const totalBytes = data?.totalBytes || sorted.reduce((sum, c) => sum + c.bytes, 0);

    // Build donut segments with angles
    let currentAngle = -90; // Start from top
    const withAngles: ProcessedCategory[] = sorted.map((cat, idx) => {
      const percentage = totalBytes > 0 ? (cat.bytes / totalBytes) * 100 : 0;
      const angleSpan = (percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      currentAngle = endAngle;

      return {
        ...cat,
        displayName: cat.name || cat.application || cat.category || 'Unknown',
        percentage,
        color: CHART_COLORS[idx % CHART_COLORS.length],
        startAngle,
        endAngle,
      };
    });

    return {
      categories: withAngles,
      totalBytes,
      categoryCount: categories.length,
    };
  }, [data, maxCategories, demoMode]);

  const handleBlockApp = useCallback(async (category: ProcessedCategory) => {
    stateManager.setLoading();

    const result = await blockApplication({
      applicationId: category.displayName,
      applicationName: category.displayName,
      networkId: data?.networkId,
    });

    if (result.success) {
      stateManager.setSuccess(`${category.displayName} blocked`);
      setSelectedCategory(null);
    } else {
      stateManager.setError(result.message);
    }
  }, [data?.networkId, stateManager]);

  const selectedCategoryData = useMemo(() => {
    if (!selectedCategory || !processedData) return null;
    return processedData.categories.find(c => c.displayName === selectedCategory);
  }, [selectedCategory, processedData]);

  const hoveredCategoryData = useMemo(() => {
    if (!hoveredCategory || !processedData) return null;
    return processedData.categories.find(c => c.displayName === hoveredCategory);
  }, [hoveredCategory, processedData]);

  // SVG path for donut segment
  const createArcPath = useCallback((startAngle: number, endAngle: number, outerRadius: number, innerRadius: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const cx = 100, cy = 100;

    const x1 = cx + outerRadius * Math.cos(startRad);
    const y1 = cy + outerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(endRad);
    const y2 = cy + outerRadius * Math.sin(endRad);
    const x3 = cx + innerRadius * Math.cos(endRad);
    const y3 = cy + innerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(startRad);
    const y4 = cy + innerRadius * Math.sin(startRad);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
  }, []);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No traffic data available
      </div>
    );
  }

  // Center display info
  const centerInfo = hoveredCategoryData || {
    displayName: 'Total',
    bytes: processedData.totalBytes,
    percentage: 100,
    color: { main: '#64748b' }
  };

  return (
    <div className="h-full flex flex-col">
      {selectedCategory && selectedCategoryData ? (
        /* Detail View */
        <div className="flex-1 flex flex-col p-3">
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline mb-3"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to chart
          </button>

          {/* Category Header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: selectedCategoryData.color.light }}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: selectedCategoryData.color.main }}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {selectedCategoryData.displayName}
              </h3>
              {selectedCategoryData.application && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedCategoryData.application}
                </p>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Traffic</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {formatBytes(selectedCategoryData.bytes)}
              </div>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Share</div>
              <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                {selectedCategoryData.percentage.toFixed(1)}%
              </div>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Connections</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {(selectedCategoryData.connections || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Clients</div>
              <div className="text-lg font-bold text-slate-700 dark:text-slate-300">
                {(selectedCategoryData.clients || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
            <button
              onClick={() => handleBlockApp(selectedCategoryData)}
              disabled={actionState.status === 'loading'}
              className="flex-1 py-2 text-xs font-medium rounded bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
            >
              Block Category
            </button>
            <button
              className="flex-1 py-2 text-xs font-medium rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
            >
              View Details
            </button>
          </div>
        </div>
      ) : (
        /* Donut Chart View */
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Traffic Composition
              </span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {formatBytes(processedData.totalBytes)}
              </span>
            </div>
          </div>

          {/* Chart Area */}
          <div className="flex-1 flex items-center justify-center p-2 min-h-0">
            <div className="relative w-full max-w-[160px] aspect-square">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Donut segments */}
                {processedData.categories.map((cat, idx) => {
                  const isHovered = hoveredCategory === cat.displayName;
                  const outerR = isHovered ? 88 : 85;
                  const innerR = isHovered ? 52 : 55;

                  return (
                    <path
                      key={idx}
                      d={createArcPath(cat.startAngle, cat.endAngle - 0.5, outerR, innerR)}
                      fill={cat.color.main}
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        opacity: hoveredCategory && !isHovered ? 0.4 : 1,
                      }}
                      onMouseEnter={() => setHoveredCategory(cat.displayName)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onClick={() => setSelectedCategory(cat.displayName)}
                    />
                  );
                })}

                {/* Center circle background */}
                <circle cx="100" cy="100" r="48" fill="currentColor" className="text-white dark:text-slate-900" />

                {/* Center text */}
                <text x="100" y="92" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[10px]">
                  {centerInfo.displayName === 'Total' ? 'Total' : centerInfo.displayName.length > 10 ? centerInfo.displayName.slice(0, 8) + '...' : centerInfo.displayName}
                </text>
                <text x="100" y="110" textAnchor="middle" className="fill-slate-700 dark:fill-slate-300 text-[13px] font-bold">
                  {formatBytes(centerInfo.bytes)}
                </text>
                {hoveredCategoryData && (
                  <text x="100" y="125" textAnchor="middle" className="fill-cyan-600 dark:fill-cyan-400 text-[10px] font-medium">
                    {hoveredCategoryData.percentage.toFixed(1)}%
                  </text>
                )}
              </svg>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {processedData.categories.slice(0, 6).map((cat, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 cursor-pointer group"
                  onMouseEnter={() => setHoveredCategory(cat.displayName)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => setSelectedCategory(cat.displayName)}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color.main }}
                  />
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                    {cat.displayName}
                  </span>
                  <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 ml-auto tabular-nums">
                    {cat.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Action Feedback */}
      {actionState.status !== 'idle' && (
        <div className={`flex-shrink-0 px-3 py-2 border-t text-xs flex items-center gap-2 ${
          actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' :
          actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' :
          'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {actionState.status === 'loading' && (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <span>{actionState.message}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400">
          <span>{processedData.categoryCount} categories</span>
          <span>{data?.timeRange || 'Last 2 hours'}</span>
        </div>
      </div>
    </div>
  );
});

TrafficCompositionCard.displayName = 'TrafficCompositionCard';

export default TrafficCompositionCard;
