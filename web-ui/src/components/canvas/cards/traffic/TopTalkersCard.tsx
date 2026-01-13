'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { setClientPolicy, type ActionState, createActionStateManager } from '@/services/cardActions';

interface TopTalker {
  id?: string;
  mac?: string;
  ip?: string;
  description?: string;
  hostname?: string;
  manufacturer?: string;
  sent: number;
  recv: number;
  total?: number;
  usage?: { sent: number; recv: number };
  status?: string;
  vlan?: number;
  ssid?: string;
}

interface TopTalkersCardData {
  clients?: TopTalker[];
  items?: TopTalker[];
  networkId?: string;
  timeRange?: string;
}

interface TopTalkersCardProps {
  data: TopTalkersCardData;
  config?: {
    showCount?: number;
    sortBy?: 'total' | 'sent' | 'recv';
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Consistent color palette matching app theme
const CLIENT_COLORS = [
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#ec4899', // pink
  '#f97316', // orange
];

export const TopTalkersCard = memo(({ data, config }: TopTalkersCardProps) => {
  const showCount = config?.showCount ?? 8;
  const sortBy = config?.sortBy ?? 'total';
  const { demoMode } = useDemoMode();

  const [selectedClient, setSelectedClient] = useState<TopTalker | null>(null);
  const [blockedClients, setBlockedClients] = useState<Set<string>>(new Set());
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });
  const stateManager = useMemo(() => createActionStateManager(setActionState), []);

  const processedData = useMemo(() => {
    if (!data && !demoMode) return null;

    let clients = data?.clients || data?.items || [];

    // Generate demo data if needed
    if (clients.length === 0 && demoMode) {
      const demoClients = [
        { hostname: 'DESKTOP-ADMIN01', ip: '10.0.1.15', description: 'Windows Workstation', manufacturer: 'Dell', vlan: 10 },
        { hostname: 'MacBook-JSmith', ip: '10.0.1.42', description: 'MacBook Pro', manufacturer: 'Apple', vlan: 10 },
        { hostname: 'SRV-DATABASE', ip: '10.0.2.10', description: 'Database Server', manufacturer: 'VMware', vlan: 20 },
        { hostname: 'iPhone-Guest', ip: '10.0.3.88', description: 'iPhone 15 Pro', manufacturer: 'Apple', vlan: 30 },
        { hostname: 'LAPTOP-DEV02', ip: '10.0.1.67', description: 'Dev Laptop', manufacturer: 'Lenovo', vlan: 10 },
        { hostname: 'NAS-BACKUP', ip: '10.0.2.30', description: 'Synology NAS', manufacturer: 'Synology', vlan: 20 },
        { hostname: 'PRINTER-FL2', ip: '10.0.1.200', description: 'HP LaserJet', manufacturer: 'HP', vlan: 10 },
        { hostname: 'CAM-LOBBY', ip: '10.0.4.15', description: 'Security Camera', manufacturer: 'Ubiquiti', vlan: 40 },
      ];

      clients = demoClients.map((c, i) => ({
        id: `demo-${i}`,
        ...c,
        mac: `00:1A:2B:${i.toString(16).padStart(2, '0')}:3C:4D`,
        sent: Math.floor(Math.random() * 400000000) + 50000000,
        recv: Math.floor(Math.random() * 600000000) + 100000000,
        status: 'Online',
      }));
    }

    const withTotals = clients.map((client, idx) => {
      const sent = client.sent || client.usage?.sent || 0;
      const recv = client.recv || client.usage?.recv || 0;
      return {
        ...client,
        id: client.id || client.mac || `client-${idx}`,
        sent,
        recv,
        total: client.total ?? (sent + recv),
        displayName: client.description || client.hostname || client.ip || client.mac || 'Unknown',
        color: CLIENT_COLORS[idx % CLIENT_COLORS.length],
      };
    });

    const sorted = [...withTotals].sort((a, b) => {
      switch (sortBy) {
        case 'sent': return b.sent - a.sent;
        case 'recv': return b.recv - a.recv;
        default: return (b.total || 0) - (a.total || 0);
      }
    }).slice(0, showCount);

    const totalBandwidth = withTotals.reduce((sum, c) => sum + (c.total || 0), 0);
    const maxTraffic = sorted[0]?.total || 1;

    return {
      clients: sorted,
      totalBandwidth,
      totalClients: clients.length,
      maxTraffic,
    };
  }, [data, showCount, sortBy, demoMode]);

  const handleBlockClient = useCallback(async (client: TopTalker) => {
    const clientId = client.mac || client.id || '';
    if (!clientId) return;

    setBlockedClients(prev => new Set([...prev, clientId]));
    stateManager.setLoading();

    const result = await setClientPolicy({
      networkId: data?.networkId || '',
      clientId,
      policy: 'blocked',
    });

    if (result.success) {
      stateManager.setSuccess(`${client.hostname || client.ip} blocked`);
    } else {
      stateManager.setError(result.message);
      setBlockedClients(prev => {
        const next = new Set(prev);
        next.delete(clientId);
        return next;
      });
    }
  }, [data?.networkId, stateManager]);

  if (!processedData || processedData.clients.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No client data
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {selectedClient ? (
        /* Detail View */
        <>
          <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <button
              onClick={() => setSelectedClient(null)}
              className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to list
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {/* Client Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {selectedClient.description || selectedClient.hostname || 'Unknown'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedClient.ip}</p>
              </div>
            </div>

            {/* Traffic Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Uploaded</div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatBytes(selectedClient.sent)}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Downloaded</div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatBytes(selectedClient.recv)}</div>
              </div>
            </div>

            {/* Client Details */}
            <div className="space-y-2 mb-4">
              {selectedClient.mac && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">MAC Address</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-mono">{selectedClient.mac}</span>
                </div>
              )}
              {selectedClient.manufacturer && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Manufacturer</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">{selectedClient.manufacturer}</span>
                </div>
              )}
              {selectedClient.vlan && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">VLAN</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">{selectedClient.vlan}</span>
                </div>
              )}
              {selectedClient.ssid && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">SSID</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">{selectedClient.ssid}</span>
                </div>
              )}
              {selectedClient.status && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Status</span>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{selectedClient.status}</span>
                </div>
              )}
            </div>

            {/* Block Action */}
            <button
              onClick={() => handleBlockClient(selectedClient)}
              disabled={actionState.status === 'loading' || blockedClients.has(selectedClient.mac || selectedClient.id || '')}
              className="w-full py-2.5 text-xs font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              {blockedClients.has(selectedClient.mac || selectedClient.id || '') ? 'Blocked' : 'Block Client'}
            </button>
          </div>
        </>
      ) : (
        /* List View */
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Top Talkers
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-700 dark:text-slate-300 font-medium">{formatBytes(processedData.totalBandwidth)}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                  {processedData.totalClients} clients
                </span>
              </div>
            </div>
          </div>

          {/* Client List */}
          <div className="flex-1 overflow-auto">
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {processedData.clients.map((client, idx) => {
                const isBlocked = blockedClients.has(client.mac || client.id || '');
                const percentage = processedData.maxTraffic > 0 ? ((client.total || 0) / processedData.maxTraffic) * 100 : 0;

                return (
                  <div
                    key={client.id}
                    className={`px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${isBlocked ? 'opacity-40' : ''}`}
                    onClick={() => setSelectedClient(client)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank & Avatar */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 w-4 text-right">
                          {idx + 1}
                        </span>
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: client.color }}
                        >
                          {(client.displayName || '').slice(0, 2).toUpperCase()}
                        </div>
                      </div>

                      {/* Client Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                            {client.displayName}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums flex-shrink-0">
                            {formatBytes(client.total || 0)}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${percentage}%`, backgroundColor: client.color }}
                            />
                          </div>
                        </div>

                        {/* Sent/Recv */}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {client.ip}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            {formatBytes(client.sent)}
                          </span>
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            {formatBytes(client.recv)}
                          </span>
                        </div>
                      </div>

                      {/* Chevron */}
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
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
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <svg className="w-2.5 h-2.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Upload
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-2.5 h-2.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Download
            </span>
          </div>
          <span>{data?.timeRange || 'Last 2 hours'}</span>
        </div>
      </div>
    </div>
  );
});

TopTalkersCard.displayName = 'TopTalkersCard';
export default TopTalkersCard;
