'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ActionState {
  status: ActionStatus;
  message?: string;
  portId?: string;
}

interface TrafficHistory {
  timestamp: string;
  inBytes: number;
  outBytes: number;
}

interface NeighborInfo {
  deviceId: string;
  portId: string;
  platform?: string;
  protocol: 'cdp' | 'lldp';
}

interface PortStatus {
  portId: string;
  name?: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'disabled' | 'err-disabled' | 'unknown';
  speed?: string;
  duplex?: 'full' | 'half' | 'auto';
  errors?: number;
  errorsHistory?: number[];
  poeEnabled?: boolean;
  poeStatus?: 'delivering' | 'searching' | 'disabled' | 'fault';
  poePower?: number;
  vlan?: number;
  type?: 'access' | 'trunk';
  utilization?: number;
  trafficHistory?: TrafficHistory[];
  neighbor?: NeighborInfo;
  macCount?: number;
}

interface InterfaceStatusCardData {
  ports?: PortStatus[];
  interfaces?: Array<{
    name: string;
    status: string;
    speed?: string;
    errors?: number;
  }>;
  deviceSerial?: string;
  deviceName?: string;
  model?: string;
  networkId?: string;
}

interface InterfaceStatusCardProps {
  data: InterfaceStatusCardData;
  config?: {
    showDetails?: boolean;
    groupByStatus?: boolean;
    portsPerRow?: number;
  };
}

type SortMode = 'port' | 'status' | 'utilization' | 'errors';
type FilterStatus = 'all' | 'connected' | 'disconnected' | 'error';

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; label: string; pattern?: string }> = {
  connected: { bg: 'bg-emerald-500', border: 'border-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', label: 'Up' },
  disconnected: { bg: 'bg-slate-400 dark:bg-slate-500', border: 'border-slate-400', text: 'text-slate-500', label: 'Down' },
  disabled: { bg: 'bg-slate-200 dark:bg-slate-700', border: 'border-dashed border-slate-400 dark:border-slate-500', text: 'text-slate-400', label: 'Disabled', pattern: 'disabled' },
  'err-disabled': { bg: 'bg-red-500', border: 'border-red-400', text: 'text-red-600 dark:text-red-400', label: 'Error' },
  unknown: { bg: 'bg-amber-400', border: 'border-amber-300', text: 'text-amber-600', label: 'Unknown' },
};

function normalizeStatus(status: string): PortStatus['status'] {
  const normalized = status.toLowerCase();
  if (normalized === 'up' || normalized === 'connected' || normalized === 'online') return 'connected';
  if (normalized === 'down' || normalized === 'disconnected' || normalized === 'offline') return 'disconnected';
  if (normalized === 'disabled') return 'disabled';
  if (normalized.includes('err') || normalized.includes('error')) return 'err-disabled';
  return 'unknown';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * InterfaceStatusCard - Interactive port status grid
 *
 * Features:
 * - Traffic sparklines per interface
 * - Click interface for detailed stats
 * - Error rate trend indicators
 * - Neighbor discovery info (CDP/LLDP)
 * - Sort/filter by status, utilization
 * - "Run Cable Test" action
 * - Physical port layout visualization
 */
export const InterfaceStatusCard = memo(({ data, config }: InterfaceStatusCardProps) => {
  const portsPerRow = config?.portsPerRow ?? 12;
  const { demoMode } = useDemoMode();

  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortMode, setSortMode] = useState<SortMode>('port');
  const [selectedPorts, setSelectedPorts] = useState<Set<string>>(new Set());
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedPorts = useMemo(() => {
    if (!data && !demoMode) return null;

    let ports: PortStatus[] = [];

    if (data?.ports && data.ports.length > 0) {
      ports = data.ports;
    } else if (data?.interfaces && data.interfaces.length > 0) {
      ports = data.interfaces.map((iface, idx) => ({
        portId: `${idx + 1}`,
        name: iface.name,
        enabled: iface.status !== 'disabled',
        status: normalizeStatus(iface.status),
        speed: iface.speed,
        errors: iface.errors,
      }));
    }

    // Generate mock data if no real data available and demo mode is enabled
    if (ports.length === 0 && demoMode) {
      const now = new Date();
      ports = Array.from({ length: 24 }, (_, i) => {
        const portNum = i + 1;
        const isConnected = Math.random() > 0.35;
        const hasError = !isConnected && Math.random() > 0.85;
        const status: PortStatus['status'] = hasError ? 'err-disabled' : isConnected ? 'connected' : 'disconnected';

        return {
          portId: `${portNum}`,
          name: `GigabitEthernet1/0/${portNum}`,
          enabled: status !== 'disconnected',
          status,
          speed: isConnected ? (Math.random() > 0.5 ? '1 Gbps' : '100 Mbps') : undefined,
          duplex: isConnected ? 'full' : undefined,
          errors: hasError ? Math.floor(Math.random() * 500) + 10 : (isConnected && Math.random() > 0.9 ? Math.floor(Math.random() * 5) : 0),
          vlan: isConnected ? Math.floor(Math.random() * 100) + 1 : undefined,
          type: isConnected ? (Math.random() > 0.8 ? 'trunk' : 'access') : undefined,
          utilization: isConnected ? Math.floor(Math.random() * 85) + 5 : 0,
          poeEnabled: Math.random() > 0.6,
          poeStatus: isConnected ? (Math.random() > 0.3 ? 'delivering' : 'searching') : 'disabled',
          poePower: isConnected ? Math.floor(Math.random() * 30) + 5 : 0,
          trafficHistory: isConnected ? Array.from({ length: 12 }, (_, j) => ({
            timestamp: new Date(now.getTime() - (11 - j) * 5 * 60000).toISOString(),
            inBytes: Math.floor(Math.random() * 100000000) + 10000000,
            outBytes: Math.floor(Math.random() * 80000000) + 5000000,
          })) : undefined,
          neighbor: isConnected && Math.random() > 0.5 ? {
            deviceId: `switch-${Math.floor(Math.random() * 10) + 1}.local`,
            portId: `Gi0/${Math.floor(Math.random() * 24) + 1}`,
            platform: 'Cisco Catalyst',
            protocol: Math.random() > 0.5 ? 'cdp' : 'lldp',
          } : undefined,
          macCount: isConnected ? Math.floor(Math.random() * 50) + 1 : 0,
        };
      });
    }

    // Filter
    let filtered = ports;
    if (filterStatus !== 'all') {
      filtered = ports.filter(p => {
        if (filterStatus === 'connected') return p.status === 'connected';
        if (filterStatus === 'disconnected') return p.status === 'disconnected' || p.status === 'disabled';
        if (filterStatus === 'error') return p.status === 'err-disabled' || (p.errors ?? 0) > 0;
        return true;
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === 'port') return parseInt(a.portId) - parseInt(b.portId);
      if (sortMode === 'status') {
        const order = ['err-disabled', 'connected', 'unknown', 'disconnected', 'disabled'];
        return order.indexOf(a.status) - order.indexOf(b.status);
      }
      if (sortMode === 'utilization') return (b.utilization ?? 0) - (a.utilization ?? 0);
      if (sortMode === 'errors') return (b.errors ?? 0) - (a.errors ?? 0);
      return 0;
    });

    return sorted;
  }, [data, filterStatus, sortMode]);

  const summary = useMemo(() => {
    if (!data?.ports && !data?.interfaces) return null;
    const ports = data.ports || (data.interfaces?.map((iface, idx) => ({
      portId: `${idx + 1}`,
      status: normalizeStatus(iface.status),
      errors: iface.errors,
    })) ?? []);

    return {
      total: ports.length,
      connected: ports.filter(p => p.status === 'connected').length,
      disconnected: ports.filter(p => p.status === 'disconnected' || p.status === 'disabled').length,
      errors: ports.filter(p => p.status === 'err-disabled' || (p.errors ?? 0) > 0).length,
    };
  }, [data]);

  const selectedPortData = useMemo(() => {
    if (!selectedPort || !processedPorts) return null;
    return processedPorts.find(p => p.portId === selectedPort);
  }, [selectedPort, processedPorts]);

  const handleAction = useCallback(async (action: string, port?: PortStatus) => {
    const serial = data?.deviceSerial;
    if (!serial) {
      setActionState({ status: 'error', message: 'Device serial not available' });
      setTimeout(() => setActionState({ status: 'idle' }), 3000);
      return;
    }

    const portId = port?.portId;
    setActionState({ status: 'loading', portId });

    try {
      let response;

      switch (action) {
        case 'cable-test':
          if (!portId) throw new Error('Port ID required for cable test');
          response = await fetch('/api/actions/cable-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ serial, ports: [portId] }),
          });
          break;

        case 'enable':
        case 'disable':
          if (!portId) throw new Error('Port ID required');
          response = await fetch('/api/actions/port-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              serial,
              port_id: portId,
              enabled: action === 'enable'
            }),
          });
          break;

        case 'enable-bulk':
        case 'disable-bulk':
          const ports = Array.from(selectedPorts);
          if (ports.length === 0) throw new Error('No ports selected');
          // Execute port config for each selected port
          const results = await Promise.allSettled(
            ports.map(pid =>
              fetch('/api/actions/port-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  serial,
                  port_id: pid,
                  enabled: action === 'enable-bulk'
                }),
              })
            )
          );
          const failed = results.filter(r => r.status === 'rejected').length;
          if (failed > 0) {
            throw new Error(`${failed} of ${ports.length} ports failed to update`);
          }
          setSelectedPorts(new Set());
          setActionState({
            status: 'success',
            message: `${ports.length} ports ${action === 'enable-bulk' ? 'enabled' : 'disabled'}`
          });
          setTimeout(() => setActionState({ status: 'idle' }), 3000);
          return;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (!response) throw new Error('No response received');

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || result.detail || 'Action failed');
      }

      const successMessages: Record<string, string> = {
        'cable-test': `Cable test completed for port ${portId}`,
        'enable': `Port ${portId} enabled`,
        'disable': `Port ${portId} disabled`,
      };

      setActionState({
        status: 'success',
        message: successMessages[action] || 'Action completed',
        portId
      });
      setTimeout(() => setActionState({ status: 'idle' }), 3000);

    } catch (error) {
      setActionState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Action failed',
        portId
      });
      setTimeout(() => setActionState({ status: 'idle' }), 5000);
    }
  }, [data?.deviceSerial, selectedPorts]);

  const togglePortSelection = useCallback((portId: string) => {
    setSelectedPorts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(portId)) newSet.delete(portId);
      else newSet.add(portId);
      return newSet;
    });
  }, []);

  if (!processedPorts || processedPorts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <svg className="w-12 h-12 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="18" rx="2" />
          <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01" />
        </svg>
        <span className="text-sm">No interface data</span>
      </div>
    );
  }

  // Detail view for selected port
  if (selectedPortData) {
    const colors = STATUS_CONFIG[selectedPortData.status] || STATUS_CONFIG.unknown;
    const hasNeighbor = !!selectedPortData.neighbor;

    return (
      <div className="h-full flex flex-col">
        {/* Header with back */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedPort(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">Port {selectedPortData.portId}</div>
              {selectedPortData.name && <div className="text-[9px] text-slate-500">{selectedPortData.name}</div>}
            </div>
            <span className={`px-2 py-0.5 text-[9px] font-medium rounded ${colors.bg} text-white`}>
              {colors.label}
            </span>
          </div>
        </div>

        {/* Port details */}
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {/* Traffic sparkline */}
          {selectedPortData.trafficHistory && selectedPortData.trafficHistory.length > 0 && (
            <div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">Traffic</div>
              <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-12 bg-slate-50 dark:bg-slate-800/50 rounded">
                {/* In traffic (blue) */}
                <path
                  d={`M ${selectedPortData.trafficHistory.map((h, i) => {
                    const x = (i / (selectedPortData.trafficHistory!.length - 1)) * 200;
                    const maxBytes = Math.max(...selectedPortData.trafficHistory!.map(t => Math.max(t.inBytes, t.outBytes)));
                    const y = 40 - (h.inBytes / maxBytes) * 35;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}`}
                  fill="none" stroke="#3b82f6" strokeWidth="1.5"
                />
                {/* Out traffic (green) */}
                <path
                  d={`M ${selectedPortData.trafficHistory.map((h, i) => {
                    const x = (i / (selectedPortData.trafficHistory!.length - 1)) * 200;
                    const maxBytes = Math.max(...selectedPortData.trafficHistory!.map(t => Math.max(t.inBytes, t.outBytes)));
                    const y = 40 - (h.outBytes / maxBytes) * 35;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}`}
                  fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2"
                />
              </svg>
              <div className="flex justify-center gap-4 text-[8px] text-slate-500 mt-0.5">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500" />In</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500" />Out</span>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            {selectedPortData.speed && (
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                <div className="text-[9px] text-slate-500 uppercase">Speed</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedPortData.speed}</div>
              </div>
            )}
            {selectedPortData.duplex && (
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                <div className="text-[9px] text-slate-500 uppercase">Duplex</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{selectedPortData.duplex}</div>
              </div>
            )}
            {selectedPortData.utilization !== undefined && (
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                <div className="text-[9px] text-slate-500 uppercase">Utilization</div>
                <div className={`text-sm font-bold ${selectedPortData.utilization > 80 ? 'text-red-600' : selectedPortData.utilization > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {selectedPortData.utilization.toFixed(0)}%
                </div>
              </div>
            )}
            {selectedPortData.errors !== undefined && (
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                <div className="text-[9px] text-slate-500 uppercase">Errors</div>
                <div className={`text-sm font-bold ${selectedPortData.errors > 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                  {selectedPortData.errors.toLocaleString()}
                </div>
              </div>
            )}
            {selectedPortData.vlan && (
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                <div className="text-[9px] text-slate-500 uppercase">VLAN</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedPortData.vlan}</div>
              </div>
            )}
            {selectedPortData.macCount !== undefined && (
              <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                <div className="text-[9px] text-slate-500 uppercase">MAC Count</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{selectedPortData.macCount}</div>
              </div>
            )}
          </div>

          {/* PoE status */}
          {selectedPortData.poeEnabled && (
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">PoE</span>
                </div>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {selectedPortData.poeStatus} {selectedPortData.poePower ? `(${selectedPortData.poePower}W)` : ''}
                </span>
              </div>
            </div>
          )}

          {/* Neighbor discovery */}
          {hasNeighbor && (
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-[9px] text-blue-600 dark:text-blue-400 uppercase mb-1">
                {selectedPortData.neighbor!.protocol.toUpperCase()} Neighbor
              </div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{selectedPortData.neighbor!.deviceId}</div>
              <div className="text-[10px] text-slate-500">Port: {selectedPortData.neighbor!.portId}</div>
              {selectedPortData.neighbor!.platform && (
                <div className="text-[10px] text-slate-500">{selectedPortData.neighbor!.platform}</div>
              )}
            </div>
          )}

          {/* Error history trend */}
          {selectedPortData.errorsHistory && selectedPortData.errorsHistory.length > 0 && (
            <div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">Error Trend</div>
              <div className="flex items-end gap-0.5 h-8">
                {selectedPortData.errorsHistory.map((err, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${err > 0 ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                    style={{ height: `${Math.min(err / Math.max(...selectedPortData.errorsHistory!) * 100, 100)}%`, minHeight: '2px' }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action feedback */}
        {actionState.status !== 'idle' && (
          <div className={`flex-shrink-0 px-3 py-2 text-[10px] font-medium ${
            actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
            actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
            'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {actionState.status === 'loading' && (
              <span className="flex items-center gap-2">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            )}
            {actionState.status === 'success' && `✓ ${actionState.message}`}
            {actionState.status === 'error' && `✗ ${actionState.message}`}
          </div>
        )}

        {/* Actions */}
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 flex gap-2">
          <button
            onClick={() => handleAction('cable-test', selectedPortData)}
            disabled={actionState.status === 'loading'}
            className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run Cable Test
          </button>
          <button
            onClick={() => handleAction(selectedPortData.enabled ? 'disable' : 'enable', selectedPortData)}
            disabled={actionState.status === 'loading'}
            className={`px-2 py-1.5 text-[10px] font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedPortData.enabled
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {selectedPortData.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    );
  }

  // Main grid view
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Interface Status
            </span>
            {data.deviceName && <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{data.deviceName}</div>}
          </div>
          {summary && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />{summary.connected}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />{summary.disconnected}
              </span>
              {summary.errors > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" />{summary.errors}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filter/sort controls */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
            {(['all', 'connected', 'disconnected', 'error'] as FilterStatus[]).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-1.5 py-0.5 text-[9px] capitalize ${
                  filterStatus === status ? 'bg-slate-600 text-white' : 'text-slate-500'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border-0 rounded text-slate-600 dark:text-slate-400"
          >
            <option value="port">By Port</option>
            <option value="status">By Status</option>
            <option value="utilization">By Usage</option>
            <option value="errors">By Errors</option>
          </select>
        </div>
      </div>

      {/* Port grid */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${portsPerRow}, minmax(0, 1fr))` }}>
          {processedPorts.map((port) => {
            const colors = STATUS_CONFIG[port.status] || STATUS_CONFIG.unknown;
            const hasErrors = (port.errors ?? 0) > 0;
            const isSelected = selectedPorts.has(port.portId);

            return (
              <div
                key={port.portId}
                onClick={() => setSelectedPort(port.portId)}
                onContextMenu={(e) => { e.preventDefault(); togglePortSelection(port.portId); }}
                className={`relative group flex flex-col items-center justify-center
                  aspect-square rounded border-2 transition-all cursor-pointer overflow-hidden
                  ${colors.bg} ${colors.border}
                  hover:scale-110 hover:z-10 hover:shadow-lg
                  ${hasErrors ? 'ring-2 ring-red-400 ring-offset-1' : ''}
                  ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              >
                {/* Disabled port strikethrough pattern */}
                {port.status === 'disabled' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[141%] h-0.5 bg-slate-400 dark:bg-slate-500 rotate-45 origin-center" />
                  </div>
                )}

                <span className={`text-[8px] font-bold drop-shadow-sm z-10 ${port.status === 'disabled' ? 'text-slate-500 dark:text-slate-400' : 'text-white'}`}>{port.portId}</span>

                {/* Utilization bar */}
                {port.utilization !== undefined && port.status === 'connected' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                    <div
                      className={`h-full ${port.utilization > 80 ? 'bg-red-300' : port.utilization > 60 ? 'bg-amber-300' : 'bg-emerald-300'}`}
                      style={{ width: `${port.utilization}%` }}
                    />
                  </div>
                )}

                {hasErrors && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 flex items-center justify-center bg-red-600 rounded-full text-[6px] text-white font-bold z-20">!</span>
                )}

                {port.poeEnabled && port.poeStatus === 'delivering' && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full border border-amber-500" />
                )}

                {port.neighbor && (
                  <span className="absolute -top-1 -left-1 w-2.5 h-2.5 flex items-center justify-center bg-blue-500 rounded-full text-[6px] text-white z-20">N</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk action feedback */}
      {actionState.status !== 'idle' && !selectedPort && (
        <div className={`flex-shrink-0 px-3 py-2 text-[10px] font-medium ${
          actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
          actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
          'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        }`}>
          {actionState.status === 'loading' && (
            <span className="flex items-center gap-2">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing bulk action...
            </span>
          )}
          {actionState.status === 'success' && `✓ ${actionState.message}`}
          {actionState.status === 'error' && `✗ ${actionState.message}`}
        </div>
      )}

      {/* Bulk actions (if ports selected) */}
      {selectedPorts.size > 0 ? (
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-blue-700 dark:text-blue-300">{selectedPorts.size} ports selected</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('disable-bulk')}
                disabled={actionState.status === 'loading'}
                className="px-2 py-1 text-[9px] bg-red-100 text-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disable
              </button>
              <button
                onClick={() => handleAction('enable-bulk')}
                disabled={actionState.status === 'loading'}
                className="px-2 py-1 text-[9px] bg-emerald-100 text-emerald-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enable
              </button>
              <button
                onClick={() => setSelectedPorts(new Set())}
                disabled={actionState.status === 'loading'}
                className="px-2 py-1 text-[9px] bg-slate-100 text-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-center gap-3 text-[9px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" />Up</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-400 dark:bg-slate-500" />Down</span>
            <span className="flex items-center gap-1">
              <span className="relative w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-700 border border-dashed border-slate-400 overflow-hidden">
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-[141%] h-px bg-slate-400 rotate-45" />
                </span>
              </span>
              Disabled
            </span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500" />Error</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 border border-amber-500" />PoE</span>
            <span className="flex items-center gap-1 text-blue-500"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Neighbor</span>
          </div>
        </div>
      )}
    </div>
  );
});

InterfaceStatusCard.displayName = 'InterfaceStatusCard';

export default InterfaceStatusCard;
