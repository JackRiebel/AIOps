'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { configureVLAN, createVLAN, getRoutingTable, getVLANDevices, type ActionState } from '@/services/cardActions';

interface VLANData {
  id: number;
  name: string;
  subnet?: string;
  applianceIp?: string;
  clientCount?: number;
  deviceCount?: number;
  portCount?: number;
  traffic?: { sent: number; recv: number };
  percentage?: number;
  trend?: number[];
  dhcpEnabled?: boolean;
  vpnEnabled?: boolean;
  status?: 'active' | 'inactive' | 'warning';
}

interface VLANDistributionCardData {
  vlans?: VLANData[];
  networkId?: string;
  networkName?: string;
  totalClients?: number;
}

interface RoutingEntry {
  destination: string;
  nextHop: string;
  interface?: string;
  metric?: number;
  type: 'static' | 'connected' | 'dynamic';
}

interface VLANDevice {
  mac: string;
  ip?: string;
  description?: string;
  deviceType?: string;
}

interface VLANDistributionCardProps {
  data: VLANDistributionCardData;
  config?: {
    metric?: 'clients' | 'traffic' | 'devices';
  };
}

const VLAN_COLORS = [
  { bg: '#06b6d4', light: '#cffafe' }, // cyan
  { bg: '#8b5cf6', light: '#ede9fe' }, // violet
  { bg: '#f59e0b', light: '#fef3c7' }, // amber
  { bg: '#10b981', light: '#d1fae5' }, // emerald
  { bg: '#ec4899', light: '#fce7f3' }, // pink
  { bg: '#3b82f6', light: '#dbeafe' }, // blue
  { bg: '#f97316', light: '#fed7aa' }, // orange
  { bg: '#84cc16', light: '#ecfccb' }, // lime
  { bg: '#6366f1', light: '#e0e7ff' }, // indigo
  { bg: '#14b8a6', light: '#ccfbf1' }, // teal
];

type MetricType = 'clients' | 'traffic' | 'devices';
type ViewMode = 'chart' | 'topology';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * VLANDistributionCard - Interactive VLAN topology and distribution visualization
 */
export const VLANDistributionCard = memo(({ data, config }: VLANDistributionCardProps) => {
  const { demoMode } = useDemoMode();
  const [metric, setMetric] = useState<MetricType>(config?.metric ?? 'clients');
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [selectedVLAN, setSelectedVLAN] = useState<number | null>(null);
  const [hoveredVLAN, setHoveredVLAN] = useState<number | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });
  const [showAddVLAN, setShowAddVLAN] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [routingEntries, setRoutingEntries] = useState<RoutingEntry[]>([]);
  const [vlanDevices, setVlanDevices] = useState<VLANDevice[]>([]);
  const [newVLAN, setNewVLAN] = useState({ id: '', name: '', subnet: '' });

  const processedData = useMemo(() => {
    // Check if we have real VLAN data
    const hasRealData = data && data.vlans && data.vlans.length > 0;

    // Generate demo data if demo mode is ON and no real data
    if (demoMode && !hasRealData) {
      const mockVLANs: VLANData[] = [
        { id: 1, name: 'Management', subnet: '10.0.1.0/24', clientCount: 45, deviceCount: 12, portCount: 24, dhcpEnabled: true, status: 'active' },
        { id: 100, name: 'Corporate', subnet: '10.0.100.0/24', clientCount: 185, deviceCount: 45, portCount: 96, dhcpEnabled: true, status: 'active' },
        { id: 200, name: 'Guest', subnet: '10.0.200.0/24', clientCount: 78, deviceCount: 8, portCount: 48, dhcpEnabled: true, vpnEnabled: false, status: 'active' },
        { id: 300, name: 'IoT', subnet: '10.0.30.0/24', clientCount: 52, deviceCount: 52, portCount: 24, dhcpEnabled: true, status: 'warning' },
        { id: 400, name: 'VoIP', subnet: '10.0.40.0/24', clientCount: 35, deviceCount: 35, portCount: 48, dhcpEnabled: true, status: 'active' },
        { id: 500, name: 'Servers', subnet: '10.0.50.0/24', clientCount: 12, deviceCount: 12, portCount: 12, dhcpEnabled: false, status: 'active' },
        { id: 999, name: 'Native', subnet: '10.0.0.0/24', clientCount: 5, deviceCount: 5, portCount: 8, status: 'inactive' },
      ];
      return processVLANs(mockVLANs);
    }

    // No data and demo mode is off - return null to show empty state
    if (!hasRealData) return null;

    // TypeScript knows data.vlans exists because hasRealData is true
    return processVLANs(data!.vlans!);
  }, [data, metric, demoMode]);

  function processVLANs(vlans: VLANData[]) {
    let total = 0;
    const vlansWithMetric = vlans.map(vlan => {
      let value = 0;
      switch (metric) {
        case 'clients':
          value = vlan.clientCount || 0;
          break;
        case 'devices':
          value = vlan.deviceCount || 0;
          break;
        case 'traffic':
          value = vlan.traffic ? vlan.traffic.sent + vlan.traffic.recv : (vlan.clientCount || 0) * 1000000;
          break;
      }
      total += value;
      return { ...vlan, value };
    });

    const sorted = vlansWithMetric
      .sort((a, b) => b.value - a.value)
      .map((vlan, idx) => ({
        ...vlan,
        percentage: total > 0 ? (vlan.value / total) * 100 : 0,
        color: VLAN_COLORS[idx % VLAN_COLORS.length],
        trend: vlan.trend || Array.from({ length: 12 }, () => vlan.value * (0.7 + Math.random() * 0.6)),
      }));

    const activeCount = sorted.filter(v => v.status === 'active').length;
    const warningCount = sorted.filter(v => v.status === 'warning').length;

    return {
      vlans: sorted,
      total,
      activeCount,
      warningCount,
      totalPorts: sorted.reduce((sum, v) => sum + (v.portCount || 0), 0),
    };
  }

  const selectedVLANData = useMemo(() => {
    if (!selectedVLAN || !processedData) return null;
    return processedData.vlans.find(v => v.id === selectedVLAN);
  }, [selectedVLAN, processedData]);

  // Generate donut paths
  const donutPaths = useMemo(() => {
    if (!processedData) return [];

    const paths: Array<{
      d: string;
      color: string;
      vlan: typeof processedData.vlans[0];
    }> = [];

    const cx = 50, cy = 50;
    const outerR = 40, innerR = 26;
    let startAngle = -90;

    processedData.vlans.forEach(vlan => {
      const sweep = (vlan.percentage / 100) * 360;
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
        color: vlan.color.bg,
        vlan,
      });

      startAngle = endAngle;
    });

    return paths;
  }, [processedData]);

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

  const handleAction = useCallback(async (action: string, vlanId?: number) => {
    if (action === 'add') {
      setShowAddVLAN(true);
      return;
    }

    if (action === 'routing') {
      // Generate mock routing entries based on VLANs
      const mockRoutes: RoutingEntry[] = [
        { destination: '0.0.0.0/0', nextHop: '10.0.1.1', interface: 'WAN1', metric: 1, type: 'static' },
      ];

      // Add connected routes for each VLAN
      if (processedData) {
        processedData.vlans.forEach(vlan => {
          if (vlan.subnet) {
            mockRoutes.push({
              destination: vlan.subnet,
              nextHop: 'direct',
              interface: `VLAN${vlan.id}`,
              type: 'connected',
            });
          }
        });
      }

      mockRoutes.push({ destination: '192.168.0.0/16', nextHop: '10.0.1.254', interface: 'WAN1', metric: 10, type: 'static' });

      if (demoMode || !data?.networkId) {
        setRoutingEntries(mockRoutes);
        setShowRouting(true);
        return;
      }

      setActionState({ status: 'loading', message: 'Loading routing table...' });
      const result = await getRoutingTable({ networkId: data.networkId });

      if (result.success && result.data) {
        setRoutingEntries(result.data as RoutingEntry[]);
      } else {
        // Fallback to mock data on API failure
        setRoutingEntries(mockRoutes);
      }

      setShowRouting(true);
      setActionState({ status: 'idle' });
      return;
    }

    if (action === 'devices' && vlanId) {
      setActionState({ status: 'loading', message: 'Loading devices...' });

      if (demoMode || !data?.networkId) {
        // Demo mode: show mock devices
        setVlanDevices([
          { mac: 'aa:bb:cc:dd:ee:01', ip: '10.0.100.10', description: 'Workstation-1', deviceType: 'Computer' },
          { mac: 'aa:bb:cc:dd:ee:02', ip: '10.0.100.11', description: 'Workstation-2', deviceType: 'Computer' },
          { mac: 'aa:bb:cc:dd:ee:03', ip: '10.0.100.20', description: 'IP-Phone-1', deviceType: 'Phone' },
          { mac: 'aa:bb:cc:dd:ee:04', ip: '10.0.100.30', description: 'Printer-Floor1', deviceType: 'Printer' },
        ]);
        setShowDevices(true);
        setActionState({ status: 'idle' });
        return;
      }

      const result = await getVLANDevices({ networkId: data.networkId, vlanId });
      if (result.success && result.data) {
        setVlanDevices(result.data as VLANDevice[]);
        setShowDevices(true);
        setActionState({ status: 'idle' });
      } else {
        setActionState({ status: 'error', message: result.message });
        setTimeout(() => setActionState({ status: 'idle' }), 3000);
      }
      return;
    }

    setActionState({ status: 'loading', message: `Executing ${action}...` });

    if (action === 'edit' && vlanId) {
      const result = await configureVLAN({
        networkId: data?.networkId || '',
        vlanId,
      });

      if (result.success) {
        setActionState({ status: 'success', message: `VLAN ${vlanId} settings opened` });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } else if (action === 'disable' && vlanId) {
      const result = await configureVLAN({
        networkId: data?.networkId || '',
        vlanId,
        enabled: false,
      });

      if (result.success) {
        setActionState({ status: 'success', message: `VLAN ${vlanId} disabled` });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [data?.networkId, demoMode, processedData]);

  const handleAddVLAN = useCallback(async () => {
    if (!newVLAN.id || !newVLAN.name) {
      setActionState({ status: 'error', message: 'VLAN ID and name are required' });
      setTimeout(() => setActionState({ status: 'idle' }), 3000);
      return;
    }

    const vlanId = parseInt(newVLAN.id, 10);
    if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
      setActionState({ status: 'error', message: 'VLAN ID must be between 1 and 4094' });
      setTimeout(() => setActionState({ status: 'idle' }), 3000);
      return;
    }

    setActionState({ status: 'loading', message: 'Creating VLAN...' });

    if (demoMode) {
      // Demo mode: simulate success
      setActionState({ status: 'success', message: `VLAN ${vlanId} "${newVLAN.name}" created` });
      setShowAddVLAN(false);
      setNewVLAN({ id: '', name: '', subnet: '' });
      setTimeout(() => setActionState({ status: 'idle' }), 3000);
      return;
    }

    const result = await createVLAN({
      networkId: data?.networkId || '',
      vlanId,
      name: newVLAN.name,
      subnet: newVLAN.subnet || undefined,
    });

    if (result.success) {
      setActionState({ status: 'success', message: `VLAN ${vlanId} created successfully` });
      setShowAddVLAN(false);
      setNewVLAN({ id: '', name: '', subnet: '' });
    } else {
      setActionState({ status: 'error', message: result.message });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [newVLAN, data?.networkId, demoMode]);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 px-4">
        <svg className="w-10 h-10 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
        <span className="text-sm font-medium mb-1">No VLAN Data</span>
        <span className="text-xs text-center text-slate-400 dark:text-slate-500">
          VLANs may not be enabled for this network
        </span>
        {!demoMode && (
          <span className="text-[10px] text-slate-400 dark:text-slate-600 mt-2">
            Enable Demo Mode to see sample data
          </span>
        )}
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
              VLAN Distribution
            </span>
            {processedData.warningCount > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                {processedData.warningCount} warning
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                viewMode === 'chart'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode('topology')}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                viewMode === 'topology'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Topology
            </button>
          </div>
        </div>
      </div>

      {/* Metric Toggle */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 flex gap-1">
        {(['clients', 'devices', 'traffic'] as MetricType[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`flex-1 px-2 py-0.5 text-[9px] rounded transition-colors ${
              metric === m
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-2">
        {/* Add VLAN Panel */}
        {showAddVLAN ? (
          <div className="h-full flex flex-col">
            <button
              onClick={() => setShowAddVLAN(false)}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back
            </button>
            <div className="flex-1 space-y-3">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Add New VLAN</div>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">VLAN ID *</label>
                  <input
                    type="number"
                    min="1"
                    max="4094"
                    value={newVLAN.id}
                    onChange={(e) => setNewVLAN(prev => ({ ...prev, id: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1-4094"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newVLAN.name}
                    onChange={(e) => setNewVLAN(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Corporate"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">Subnet (optional)</label>
                  <input
                    type="text"
                    value={newVLAN.subnet}
                    onChange={(e) => setNewVLAN(prev => ({ ...prev, subnet: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 10.0.100.0/24"
                  />
                </div>
              </div>
              <button
                onClick={handleAddVLAN}
                disabled={actionState.status === 'loading'}
                className="w-full px-3 py-2 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 rounded transition-colors"
              >
                {actionState.status === 'loading' ? 'Creating...' : 'Create VLAN'}
              </button>
              {actionState.status === 'error' && (
                <div className="text-[10px] text-red-600 dark:text-red-400">{actionState.message}</div>
              )}
            </div>
          </div>
        ) : showRouting ? (
          /* Routing Table Panel */
          <div className="h-full flex flex-col">
            <button
              onClick={() => setShowRouting(false)}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back
            </button>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Routing Table</div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {routingEntries.length === 0 ? (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-4">No routes found</div>
              ) : (
                routingEntries.map((route, idx) => (
                  <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{route.destination}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${
                        route.type === 'connected' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                        route.type === 'static' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                        'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                      }`}>
                        {route.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-slate-500 dark:text-slate-400">
                      <span>→ {route.nextHop}</span>
                      {route.interface && <span>via {route.interface}</span>}
                      {route.metric !== undefined && <span>metric {route.metric}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : showDevices ? (
          /* VLAN Devices Panel */
          <div className="h-full flex flex-col">
            <button
              onClick={() => setShowDevices(false)}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back to VLAN
            </button>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
              VLAN {selectedVLAN} Devices
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {vlanDevices.length === 0 ? (
                <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-4">No devices found</div>
              ) : (
                vlanDevices.map((device, idx) => (
                  <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-800/30 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {device.deviceType === 'Computer' ? '💻' :
                         device.deviceType === 'Phone' ? '📞' :
                         device.deviceType === 'Printer' ? '🖨️' : '📟'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-medium text-slate-800 dark:text-slate-200 truncate">
                          {device.description || 'Unknown Device'}
                        </div>
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                          {device.ip || 'No IP'} • {device.mac}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : selectedVLAN && selectedVLANData ? (
          /* Detail View */
          <div className="h-full flex flex-col">
            <button
              onClick={() => setSelectedVLAN(null)}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back to overview
            </button>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {/* VLAN Header */}
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: selectedVLANData.color.bg }}
                />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  VLAN {selectedVLANData.id}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedVLANData.name}
                </span>
                <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${
                  selectedVLANData.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                  selectedVLANData.status === 'warning' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                  'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {selectedVLANData.status}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {selectedVLANData.clientCount || 0}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Clients</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {selectedVLANData.deviceCount || 0}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Devices</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                    {selectedVLANData.portCount || 0}
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400">Ports</div>
                </div>
              </div>

              {/* Subnet Info */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Network Configuration</div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Subnet: </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{selectedVLANData.subnet || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Gateway: </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{selectedVLANData.applianceIp || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="flex gap-2">
                <span className={`px-2 py-1 text-[9px] rounded ${
                  selectedVLANData.dhcpEnabled
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  DHCP {selectedVLANData.dhcpEnabled ? 'Enabled' : 'Disabled'}
                </span>
                {selectedVLANData.vpnEnabled !== undefined && (
                  <span className={`px-2 py-1 text-[9px] rounded ${
                    selectedVLANData.vpnEnabled
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                    VPN {selectedVLANData.vpnEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                )}
              </div>

              {/* Trend Chart */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Usage Trend</div>
                <svg viewBox="0 0 180 40" className="w-full h-10">
                  <path
                    d={generateSparkline(selectedVLANData.trend || [], 180, 36)}
                    fill="none"
                    stroke={selectedVLANData.color.bg}
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </div>
        ) : viewMode === 'topology' ? (
          /* Topology View */
          <div className="h-full flex flex-col">
            <svg viewBox="0 0 280 180" className="w-full flex-1">
              {/* Central router/switch */}
              <rect x="120" y="75" width="40" height="30" rx="4" fill="#3b82f6" />
              <text x="140" y="94" textAnchor="middle" className="text-[8px] fill-white font-medium">Core</text>

              {/* VLAN nodes arranged in a circle */}
              {processedData.vlans.slice(0, 8).map((vlan, i) => {
                const angle = (i / Math.min(processedData.vlans.length, 8)) * 2 * Math.PI - Math.PI / 2;
                const radius = 70;
                const cx = 140 + radius * Math.cos(angle);
                const cy = 90 + radius * Math.sin(angle);
                const nodeSize = 12 + (vlan.percentage / 100) * 20;
                const isHovered = hoveredVLAN === vlan.id;
                const isSelected = selectedVLAN === vlan.id;

                return (
                  <g
                    key={vlan.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredVLAN(vlan.id)}
                    onMouseLeave={() => setHoveredVLAN(null)}
                    onClick={() => setSelectedVLAN(vlan.id)}
                  >
                    {/* Connection line */}
                    <line
                      x1="140" y1="90"
                      x2={cx} y2={cy}
                      stroke={vlan.color.bg}
                      strokeWidth={isHovered ? 3 : 2}
                      opacity={hoveredVLAN === null || isHovered ? 0.6 : 0.2}
                      className="transition-all"
                    />
                    {/* Node */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered || isSelected ? nodeSize + 4 : nodeSize}
                      fill={vlan.color.bg}
                      opacity={hoveredVLAN === null || isHovered ? 1 : 0.5}
                      className="transition-all"
                    />
                    {/* Status indicator */}
                    {vlan.status === 'warning' && (
                      <circle
                        cx={cx + nodeSize * 0.7}
                        cy={cy - nodeSize * 0.7}
                        r="4"
                        fill="#f59e0b"
                        className=""
                      />
                    )}
                    {/* Label */}
                    <text
                      x={cx}
                      y={cy + 3}
                      textAnchor="middle"
                      className="text-[7px] fill-white font-bold pointer-events-none"
                    >
                      {vlan.id}
                    </text>
                  </g>
                );
              })}

              {/* Hover tooltip */}
              {hoveredVLAN && (() => {
                const vlan = processedData.vlans.find(v => v.id === hoveredVLAN);
                if (!vlan) return null;
                return (
                  <g>
                    <rect x="180" y="5" width="90" height="40" rx="4" fill="white" stroke="#e2e8f0" />
                    <text x="185" y="18" className="text-[8px] fill-slate-800 font-medium">VLAN {vlan.id}: {vlan.name}</text>
                    <text x="185" y="30" className="text-[7px] fill-slate-500">{vlan.clientCount} clients • {vlan.deviceCount} devices</text>
                    <text x="185" y="40" className="text-[7px] fill-slate-500">{vlan.subnet}</text>
                  </g>
                );
              })()}
            </svg>

            {/* Legend */}
            <div className="flex-shrink-0 flex flex-wrap gap-1 mt-1">
              {processedData.vlans.slice(0, 6).map(vlan => (
                <span
                  key={vlan.id}
                  className={`px-1.5 py-0.5 text-[8px] rounded cursor-pointer transition-colors ${
                    hoveredVLAN === vlan.id ? 'ring-2 ring-offset-1' : ''
                  }`}
                  style={{ backgroundColor: vlan.color.light, color: vlan.color.bg }}
                  onMouseEnter={() => setHoveredVLAN(vlan.id)}
                  onMouseLeave={() => setHoveredVLAN(null)}
                  onClick={() => setSelectedVLAN(vlan.id)}
                >
                  {vlan.id}: {vlan.name}
                </span>
              ))}
            </div>
          </div>
        ) : (
          /* Chart View */
          <div className="h-full flex flex-col">
            <div className="flex gap-3 flex-shrink-0 mb-2">
              {/* Donut Chart */}
              <div className="flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-20 h-20">
                  {/* Background */}
                  <circle
                    cx="50" cy="50" r="40"
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
                      opacity={hoveredVLAN === null || hoveredVLAN === path.vlan.id ? 1 : 0.3}
                      onMouseEnter={() => setHoveredVLAN(path.vlan.id)}
                      onMouseLeave={() => setHoveredVLAN(null)}
                      onClick={() => setSelectedVLAN(path.vlan.id)}
                    />
                  ))}

                  {/* Center text */}
                  <text x="50" y="46" textAnchor="middle" className="text-sm font-bold fill-slate-800 dark:fill-slate-200">
                    {metric === 'traffic' ? formatBytes(processedData.total) : processedData.total.toLocaleString()}
                  </text>
                  <text x="50" y="58" textAnchor="middle" className="text-[8px] fill-slate-500 dark:fill-slate-400">
                    {metric}
                  </text>
                </svg>
              </div>

              {/* Stats */}
              <div className="flex-1 space-y-1">
                <div className="text-[9px] text-slate-500 dark:text-slate-400">Summary</div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{processedData.vlans.length}</div>
                    <div className="text-[8px] text-slate-500 dark:text-slate-400">VLANs</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1">
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{processedData.activeCount}</div>
                    <div className="text-[8px] text-slate-500 dark:text-slate-400">Active</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{processedData.totalPorts}</div>
                    <div className="text-[8px] text-slate-500 dark:text-slate-400">Ports</div>
                  </div>
                  {processedData.warningCount > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-1">
                      <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">{processedData.warningCount}</div>
                      <div className="text-[8px] text-amber-700 dark:text-amber-300">Warnings</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* VLAN List */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {processedData.vlans.map((vlan) => {
                const isHovered = hoveredVLAN === vlan.id;

                return (
                  <div
                    key={vlan.id}
                    className={`p-1.5 rounded cursor-pointer transition-all ${
                      isHovered ? 'bg-slate-100 dark:bg-slate-700/50' : 'bg-slate-50 dark:bg-slate-800/30'
                    }`}
                    onMouseEnter={() => setHoveredVLAN(vlan.id)}
                    onMouseLeave={() => setHoveredVLAN(null)}
                    onClick={() => setSelectedVLAN(vlan.id)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Color bar */}
                      <div
                        className="w-1.5 h-8 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: vlan.color.bg }}
                      />

                      {/* VLAN info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200">
                            {vlan.id}
                          </span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                            {vlan.name}
                          </span>
                          {vlan.status === 'warning' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-slate-500 dark:text-slate-400">
                          <span>{vlan.clientCount} clients</span>
                          <span>•</span>
                          <span className="font-mono">{vlan.subnet}</span>
                        </div>
                      </div>

                      {/* Percentage and trend */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <svg viewBox="0 0 40 16" className="w-10 h-4">
                          <path
                            d={generateSparkline(vlan.trend || [], 40, 14)}
                            fill="none"
                            stroke={vlan.color.bg}
                            strokeWidth="1.5"
                          />
                        </svg>
                        <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 w-10 text-right">
                          {vlan.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex gap-1">
          {selectedVLAN ? (
            <>
              <button
                onClick={() => handleAction('edit', selectedVLAN)}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Edit VLAN
              </button>
              <button
                onClick={() => handleAction('devices', selectedVLAN)}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                View Devices
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleAction('add')}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Add VLAN
              </button>
              <button
                onClick={() => handleAction('routing')}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                Routing Table
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

VLANDistributionCard.displayName = 'VLANDistributionCard';

export default VLANDistributionCard;
