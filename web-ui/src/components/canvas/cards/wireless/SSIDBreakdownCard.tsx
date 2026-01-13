'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { configureSSID, type ActionState } from '@/services/cardActions';

interface SSIDData {
  ssid: string;
  number?: number;
  enabled?: boolean;
  clientCount: number;
  bandwidthUsage?: number;
  band?: '2.4GHz' | '5GHz' | '6GHz' | 'dual' | 'tri';
  authMode?: string;
  encryption?: 'WPA3' | 'WPA2' | 'WPA' | 'WEP' | 'Open' | string;
  vlan?: number;
  visible?: boolean;
  splashPage?: boolean;
  trend?: number[];
  band2_4Clients?: number;
  band5Clients?: number;
  band6Clients?: number;
}

interface SSIDBreakdownCardData {
  ssids?: SSIDData[];
  totalClients?: number;
  networkId?: string;
  timeRange?: string;
}

interface SSIDBreakdownCardProps {
  data: SSIDBreakdownCardData;
  config?: {
    showBandwidth?: boolean;
    maxSSIDs?: number;
  };
}

const SSID_COLORS = [
  { bg: '#3b82f6', light: '#dbeafe' }, // Blue
  { bg: '#8b5cf6', light: '#ede9fe' }, // Purple
  { bg: '#06b6d4', light: '#cffafe' }, // Cyan
  { bg: '#10b981', light: '#d1fae5' }, // Emerald
  { bg: '#f59e0b', light: '#fef3c7' }, // Amber
  { bg: '#ec4899', light: '#fce7f3' }, // Pink
  { bg: '#6366f1', light: '#e0e7ff' }, // Indigo
  { bg: '#14b8a6', light: '#ccfbf1' }, // Teal
];

const SECURITY_BADGES = {
  WPA3: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', icon: '🔐' },
  WPA2: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', icon: '🔒' },
  WPA: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', icon: '🔑' },
  WEP: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', icon: '⚠' },
  Open: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', icon: '🔓' },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * SSIDBreakdownCard - SSID client distribution with security badges and management
 */
export const SSIDBreakdownCard = memo(({ data, config }: SSIDBreakdownCardProps) => {
  const showBandwidth = config?.showBandwidth ?? true;
  const maxSSIDs = config?.maxSSIDs ?? 8;
  const { demoMode } = useDemoMode();

  const [selectedSSID, setSelectedSSID] = useState<string | null>(null);
  const [hoveredSSID, setHoveredSSID] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'clients' | 'bandwidth'>('clients');
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    if (!data && demoMode) {
      // Generate mock data
      const mockSSIDs: SSIDData[] = [
        { ssid: 'Corporate-5G', enabled: true, clientCount: 145, bandwidthUsage: 2500000000, band: 'dual', authMode: '802.1X', encryption: 'WPA3', vlan: 100, visible: true, band2_4Clients: 25, band5Clients: 120 },
        { ssid: 'Guest-WiFi', enabled: true, clientCount: 78, bandwidthUsage: 850000000, band: 'dual', authMode: 'PSK', encryption: 'WPA2', vlan: 200, visible: true, splashPage: true, band2_4Clients: 45, band5Clients: 33 },
        { ssid: 'IoT-Network', enabled: true, clientCount: 52, bandwidthUsage: 120000000, band: '2.4GHz', authMode: 'PSK', encryption: 'WPA2', vlan: 300, visible: false, band2_4Clients: 52, band5Clients: 0 },
        { ssid: 'Executive', enabled: true, clientCount: 12, bandwidthUsage: 980000000, band: '5GHz', authMode: '802.1X', encryption: 'WPA3', vlan: 50, visible: false, band2_4Clients: 0, band5Clients: 12 },
        { ssid: 'Conference', enabled: true, clientCount: 8, bandwidthUsage: 450000000, band: 'dual', authMode: 'PSK', encryption: 'WPA2', vlan: 150, visible: true, band2_4Clients: 2, band5Clients: 6 },
      ];
      return processSSIDs(mockSSIDs);
    }

    if (!data || !data.ssids || data.ssids.length === 0) return null;
    return processSSIDs(data.ssids);
  }, [data, maxSSIDs, demoMode]);

  function processSSIDs(ssids: SSIDData[]) {
    const enabledSSIDs = ssids.filter(s => s.enabled !== false);
    const sorted = [...enabledSSIDs].sort((a, b) => b.clientCount - a.clientCount);
    const displaySSIDs = sorted.slice(0, maxSSIDs);

    const totalClients = data?.totalClients ?? sorted.reduce((sum, s) => sum + s.clientCount, 0);
    const totalBandwidth = sorted.reduce((sum, s) => sum + (s.bandwidthUsage || 0), 0);

    const withMeta = displaySSIDs.map((ssid, idx) => ({
      ...ssid,
      percentage: totalClients > 0 ? (ssid.clientCount / totalClients) * 100 : 0,
      bandwidthPercentage: totalBandwidth > 0 ? ((ssid.bandwidthUsage || 0) / totalBandwidth) * 100 : 0,
      color: SSID_COLORS[idx % SSID_COLORS.length],
      trend: ssid.trend || Array.from({ length: 12 }, () =>
        Math.floor(ssid.clientCount * (0.7 + Math.random() * 0.6))
      ),
      band2_4Clients: ssid.band2_4Clients ?? Math.floor(ssid.clientCount * 0.3),
      band5Clients: ssid.band5Clients ?? Math.floor(ssid.clientCount * 0.7),
      band6Clients: ssid.band6Clients ?? 0,
    }));

    // Security summary
    const securitySummary = {
      wpa3: withMeta.filter(s => s.encryption === 'WPA3').length,
      wpa2: withMeta.filter(s => s.encryption === 'WPA2').length,
      open: withMeta.filter(s => s.encryption === 'Open' || !s.encryption).length,
      weak: withMeta.filter(s => s.encryption === 'WEP' || s.encryption === 'WPA').length,
    };

    return {
      ssids: withMeta,
      totalClients,
      totalBandwidth,
      ssidCount: enabledSSIDs.length,
      disabledCount: ssids.filter(s => s.enabled === false).length,
      securitySummary,
    };
  }

  const selectedSSIDData = useMemo(() => {
    if (!selectedSSID || !processedData) return null;
    return processedData.ssids.find(s => s.ssid === selectedSSID);
  }, [selectedSSID, processedData]);

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

  // Generate donut paths
  const donutPaths = useMemo(() => {
    if (!processedData) return [];

    const paths: Array<{
      d: string;
      color: string;
      ssid: typeof processedData.ssids[0];
    }> = [];

    const cx = 50, cy = 50;
    const outerR = 42, innerR = 28;
    let startAngle = -90;

    processedData.ssids.forEach(ssid => {
      const percentage = viewMode === 'clients' ? ssid.percentage : ssid.bandwidthPercentage;
      const sweep = (percentage / 100) * 360;
      const endAngle = startAngle + sweep;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = cx + outerR * Math.cos(startRad);
      const y1 = cy + outerR * Math.sin(startRad);
      const x2 = cx + outerR * Math.cos(endRad);
      const y2 = cy + outerR * Math.sin(endRad);
      const x3 = cx + innerR * Math.cos(endRad);
      const y3 = cy + innerR * Math.sin(endRad);
      const x4 = cx + innerR * Math.cos(startRad);
      const y4 = cy + innerR * Math.sin(startRad);

      const largeArc = sweep > 180 ? 1 : 0;

      paths.push({
        d: `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`,
        color: ssid.color.bg,
        ssid,
      });

      startAngle = endAngle;
    });

    return paths;
  }, [processedData, viewMode]);

  const handleAction = useCallback(async (action: string, ssid?: string) => {
    const ssidData = ssid ? processedData?.ssids.find(s => s.ssid === ssid) : null;
    const networkId = data?.networkId;

    setActionState({ status: 'loading', message: `Executing ${action}...` });

    if ((action === 'enable' || action === 'disable') && ssidData && networkId) {
      const result = await configureSSID({
        networkId: networkId,
        ssidNumber: ssidData.number ?? 0,
        enabled: action === 'enable',
      });

      if (result.success) {
        setActionState({ status: 'success', message: `SSID ${action === 'enable' ? 'enabled' : 'disabled'}` });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } else if (action === 'edit' && networkId && ssidData) {
      // Open Meraki dashboard SSID settings in new tab
      const dashboardUrl = `https://dashboard.meraki.com/go/wl/n/${networkId}/manage/configure/ssid/${ssidData.number ?? 0}`;
      window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
      setActionState({ status: 'success', message: 'Opening SSID settings in Meraki Dashboard...' });
    } else if (action === 'add' && networkId) {
      // Open Meraki dashboard to add new SSID
      const dashboardUrl = `https://dashboard.meraki.com/go/wl/n/${networkId}/manage/configure/ssid_settings`;
      window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
      setActionState({ status: 'success', message: 'Opening SSID configuration in Meraki Dashboard...' });
    } else if (action === 'rf' && networkId) {
      // Open Meraki dashboard RF settings
      const dashboardUrl = `https://dashboard.meraki.com/go/wl/n/${networkId}/manage/configure/radio_settings`;
      window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
      setActionState({ status: 'success', message: 'Opening RF Settings in Meraki Dashboard...' });
    } else if (action === 'clients' && ssidData) {
      // Open Meraki dashboard clients filtered by SSID
      const dashboardUrl = networkId
        ? `https://dashboard.meraki.com/go/wl/n/${networkId}/manage/usage/list?ssid=${encodeURIComponent(ssidData.ssid)}`
        : '#';
      if (networkId) {
        window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
        setActionState({ status: 'success', message: `Opening clients for ${ssidData.ssid}...` });
      } else {
        setActionState({ status: 'error', message: 'Network ID not available' });
      }
    } else if (!networkId) {
      setActionState({ status: 'error', message: 'Network ID not available for this action' });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [processedData?.ssids, data?.networkId]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No SSID data
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
              SSID Breakdown
            </span>
            {processedData.securitySummary.weak > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                {processedData.securitySummary.weak} weak
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('clients')}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                viewMode === 'clients'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Clients
            </button>
            <button
              onClick={() => setViewMode('bandwidth')}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                viewMode === 'bandwidth'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Bandwidth
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-2">
        {selectedSSID && selectedSSIDData ? (
          /* Detail View */
          <div className="h-full flex flex-col">
            <button
              onClick={() => setSelectedSSID(null)}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back to overview
            </button>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {/* SSID Header */}
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: selectedSSIDData.color.bg }}
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {selectedSSIDData.ssid}
                </span>
                {selectedSSIDData.encryption && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${
                    SECURITY_BADGES[selectedSSIDData.encryption as keyof typeof SECURITY_BADGES]?.bg || 'bg-slate-100'
                  } ${
                    SECURITY_BADGES[selectedSSIDData.encryption as keyof typeof SECURITY_BADGES]?.text || 'text-slate-600'
                  }`}>
                    {SECURITY_BADGES[selectedSSIDData.encryption as keyof typeof SECURITY_BADGES]?.icon || ''} {selectedSSIDData.encryption}
                  </span>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {selectedSSIDData.clientCount}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Clients</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {formatBytes(selectedSSIDData.bandwidthUsage || 0)}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Bandwidth</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {selectedSSIDData.vlan || '-'}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">VLAN</div>
                </div>
              </div>

              {/* Band Distribution */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Band Distribution</div>
                <div className="flex gap-1 h-4 rounded overflow-hidden">
                  {selectedSSIDData.band2_4Clients > 0 && (
                    <div
                      className="bg-orange-400 flex items-center justify-center"
                      style={{ width: `${(selectedSSIDData.band2_4Clients / selectedSSIDData.clientCount) * 100}%` }}
                    >
                      <span className="text-[8px] text-white font-medium">2.4</span>
                    </div>
                  )}
                  {selectedSSIDData.band5Clients > 0 && (
                    <div
                      className="bg-blue-500 flex items-center justify-center"
                      style={{ width: `${(selectedSSIDData.band5Clients / selectedSSIDData.clientCount) * 100}%` }}
                    >
                      <span className="text-[8px] text-white font-medium">5</span>
                    </div>
                  )}
                  {selectedSSIDData.band6Clients > 0 && (
                    <div
                      className="bg-purple-500 flex items-center justify-center"
                      style={{ width: `${(selectedSSIDData.band6Clients / selectedSSIDData.clientCount) * 100}%` }}
                    >
                      <span className="text-[8px] text-white font-medium">6</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-slate-500 dark:text-slate-400">
                  <span>2.4GHz: {selectedSSIDData.band2_4Clients}</span>
                  <span>5GHz: {selectedSSIDData.band5Clients}</span>
                  {selectedSSIDData.band6Clients > 0 && <span>6GHz: {selectedSSIDData.band6Clients}</span>}
                </div>
              </div>

              {/* Client Trend */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Client Trend (24h)</div>
                <svg viewBox="0 0 180 40" className="w-full h-10">
                  <path
                    d={generateSparkline(selectedSSIDData.trend, 180, 36)}
                    fill="none"
                    stroke={selectedSSIDData.color.bg}
                    strokeWidth="2"
                  />
                </svg>
              </div>

              {/* Config Details */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <span className="text-slate-500 dark:text-slate-400">Auth Mode</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{selectedSSIDData.authMode || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <span className="text-slate-500 dark:text-slate-400">Visible</span>
                  <span className={`font-medium ${selectedSSIDData.visible ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {selectedSSIDData.visible ? 'Yes' : 'Hidden'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <span className="text-slate-500 dark:text-slate-400">Splash Page</span>
                  <span className={`font-medium ${selectedSSIDData.splashPage ? 'text-blue-600' : 'text-slate-400'}`}>
                    {selectedSSIDData.splashPage ? 'Enabled' : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <span className="text-slate-500 dark:text-slate-400">Band</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{selectedSSIDData.band || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Overview */
          <div className="h-full flex flex-col">
            <div className="flex gap-3 flex-shrink-0 mb-2">
              {/* Donut Chart */}
              <div className="flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-20 h-20">
                  {/* Background */}
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="14"
                    className="text-slate-100 dark:text-slate-800"
                  />

                  {/* Segments */}
                  {donutPaths.map((path, i) => (
                    <path
                      key={i}
                      d={path.d}
                      fill={path.color}
                      className="cursor-pointer transition-all"
                      opacity={hoveredSSID === null || hoveredSSID === path.ssid.ssid ? 1 : 0.3}
                      onMouseEnter={() => setHoveredSSID(path.ssid.ssid)}
                      onMouseLeave={() => setHoveredSSID(null)}
                      onClick={() => setSelectedSSID(path.ssid.ssid)}
                    />
                  ))}

                  {/* Center text */}
                  <text x="50" y="46" textAnchor="middle" className="text-sm font-bold fill-slate-800 dark:fill-slate-200">
                    {viewMode === 'clients' ? processedData.totalClients : formatBytes(processedData.totalBandwidth)}
                  </text>
                  <text x="50" y="58" textAnchor="middle" className="text-[8px] fill-slate-500 dark:fill-slate-400">
                    {viewMode === 'clients' ? 'clients' : 'total'}
                  </text>
                </svg>
              </div>

              {/* Security Summary */}
              <div className="flex-1 space-y-1">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Security</div>
                <div className="grid grid-cols-2 gap-1">
                  {processedData.securitySummary.wpa3 > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded">
                      <span className="text-[9px]">🔐</span>
                      <span className="text-[9px] font-medium text-emerald-700 dark:text-emerald-300">WPA3: {processedData.securitySummary.wpa3}</span>
                    </div>
                  )}
                  {processedData.securitySummary.wpa2 > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <span className="text-[9px]">🔒</span>
                      <span className="text-[9px] font-medium text-blue-700 dark:text-blue-300">WPA2: {processedData.securitySummary.wpa2}</span>
                    </div>
                  )}
                  {processedData.securitySummary.open > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-700 rounded">
                      <span className="text-[9px]">🔓</span>
                      <span className="text-[9px] font-medium text-slate-600 dark:text-slate-400">Open: {processedData.securitySummary.open}</span>
                    </div>
                  )}
                  {processedData.securitySummary.weak > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 rounded">
                      <span className="text-[9px]">⚠</span>
                      <span className="text-[9px] font-medium text-red-700 dark:text-red-300">Weak: {processedData.securitySummary.weak}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SSID List */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {processedData.ssids.map((ssid) => {
                const isHovered = hoveredSSID === ssid.ssid;
                const percentage = viewMode === 'clients' ? ssid.percentage : ssid.bandwidthPercentage;
                const value = viewMode === 'clients' ? ssid.clientCount : formatBytes(ssid.bandwidthUsage || 0);

                return (
                  <div
                    key={ssid.ssid}
                    className={`p-1.5 rounded cursor-pointer transition-all ${
                      isHovered ? 'bg-slate-100 dark:bg-slate-700/50' : 'bg-slate-50 dark:bg-slate-800/30'
                    }`}
                    onMouseEnter={() => setHoveredSSID(ssid.ssid)}
                    onMouseLeave={() => setHoveredSSID(null)}
                    onClick={() => setSelectedSSID(ssid.ssid)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Color bar */}
                      <div
                        className="w-1.5 h-10 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: ssid.color.bg }}
                      />

                      {/* SSID info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-slate-800 dark:text-slate-200 truncate">
                            {ssid.ssid}
                          </span>
                          {ssid.encryption && (
                            <span className={`px-1 py-0.5 text-[8px] font-medium rounded ${
                              SECURITY_BADGES[ssid.encryption as keyof typeof SECURITY_BADGES]?.bg || 'bg-slate-100'
                            } ${
                              SECURITY_BADGES[ssid.encryption as keyof typeof SECURITY_BADGES]?.text || 'text-slate-600'
                            }`}>
                              {ssid.encryption}
                            </span>
                          )}
                          {!ssid.visible && (
                            <span className="text-[8px] text-slate-400">Hidden</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {/* Progress bar */}
                          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden">
                            <div
                              className="h-full rounded transition-all"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: ssid.color.bg,
                              }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 tabular-nums w-8 text-right">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Value and trend */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <svg viewBox="0 0 40 16" className="w-10 h-4">
                          <path
                            d={generateSparkline(ssid.trend, 40, 14)}
                            fill="none"
                            stroke={ssid.color.bg}
                            strokeWidth="1.5"
                          />
                        </svg>
                        <div className="text-right">
                          <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            {value}
                          </div>
                          {ssid.band && (
                            <div className="text-[8px] text-slate-400">{ssid.band}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="flex-shrink-0 mt-2 flex gap-1">
              <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Active</div>
                <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
                  {processedData.ssidCount}
                </div>
              </div>
              {processedData.disabledCount > 0 && (
                <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                  <div className="text-[8px] text-slate-500 dark:text-slate-400">Disabled</div>
                  <div className="text-[10px] font-semibold text-slate-400">
                    {processedData.disabledCount}
                  </div>
                </div>
              )}
              <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Clients</div>
                <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
                  {processedData.totalClients}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex gap-1">
          {selectedSSID ? (
            <>
              <button
                onClick={() => handleAction('edit', selectedSSID)}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Edit SSID
              </button>
              <button
                onClick={() => handleAction('clients', selectedSSID)}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                View Clients
              </button>
              <button
                onClick={() => handleAction('disable', selectedSSID)}
                className="px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              >
                Disable
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleAction('add')}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Add SSID
              </button>
              <button
                onClick={() => handleAction('rf')}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                RF Settings
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

SSIDBreakdownCard.displayName = 'SSIDBreakdownCard';

export default SSIDBreakdownCard;
