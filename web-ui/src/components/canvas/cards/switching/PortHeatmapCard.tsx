'use client';

import { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface PortData {
  portId: string;
  name?: string;
  enabled: boolean;
  status?: 'connected' | 'disconnected' | 'disabled' | 'err-disabled';
  speed?: string;
  duplex?: string;
  poeEnabled?: boolean;
  type?: 'access' | 'trunk';
  vlan?: number;
  utilization?: number;  // 0-100%
  trafficInKbps?: { sent: number; recv: number };
  errors?: number;
}

interface SwitchData {
  serial: string;
  name: string;
  model?: string;
  ports: PortData[];
}

interface PortHeatmapCardData {
  switches?: SwitchData[];
  ports?: PortData[];
  deviceSerial?: string;
  deviceName?: string;
  networkId?: string;
}

interface PortHeatmapCardProps {
  data: PortHeatmapCardData;
  config?: {
    metric?: 'utilization' | 'status' | 'errors';
  };
}

function getUtilizationColor(utilization: number): string {
  if (utilization >= 90) return 'bg-red-500';
  if (utilization >= 70) return 'bg-orange-500';
  if (utilization >= 50) return 'bg-amber-500';
  if (utilization >= 30) return 'bg-lime-500';
  return 'bg-emerald-500';
}

function getStatusColor(status: string, enabled: boolean): { bg: string; isDisabled: boolean } {
  if (!enabled || status === 'disabled') {
    return { bg: 'bg-slate-200 dark:bg-slate-700', isDisabled: true };
  }
  switch (status) {
    case 'connected': return { bg: 'bg-emerald-500', isDisabled: false };
    case 'disconnected': return { bg: 'bg-slate-400 dark:bg-slate-500', isDisabled: false };
    case 'err-disabled': return { bg: 'bg-red-500', isDisabled: false };
    default: return { bg: 'bg-slate-400 dark:bg-slate-500', isDisabled: false };
  }
}

/**
 * PortHeatmapCard - Switch port utilization heatmap
 *
 * Shows:
 * - Grid of ports with color-coded utilization
 * - Port status indicators
 * - Error highlighting
 * - Multi-switch support
 */
export const PortHeatmapCard = memo(({ data, config }: PortHeatmapCardProps) => {
  const metric = config?.metric ?? 'utilization';
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    // Generate mock data if no real data available and demo mode is enabled
    if ((!data || (!data.ports?.length && !data.switches?.length)) && demoMode) {
      const mockPorts: PortData[] = Array.from({ length: 48 }, (_, i) => {
        const portNum = i + 1;
        const isConnected = Math.random() > 0.4;
        const hasError = !isConnected && Math.random() > 0.95;
        return {
          portId: String(portNum),
          name: isConnected ? `port-${portNum}` : undefined,
          enabled: !hasError && Math.random() > 0.1,
          status: hasError ? 'err-disabled' as const : isConnected ? 'connected' as const : 'disconnected' as const,
          speed: isConnected ? (Math.random() > 0.3 ? '1 Gbps' : '100 Mbps') : undefined,
          duplex: isConnected ? 'full' : undefined,
          poeEnabled: Math.random() > 0.5,
          type: isConnected ? (Math.random() > 0.85 ? 'trunk' as const : 'access' as const) : undefined,
          vlan: isConnected ? Math.floor(Math.random() * 200) + 1 : undefined,
          utilization: isConnected ? Math.floor(Math.random() * 100) : 0,
          errors: hasError ? Math.floor(Math.random() * 100) + 5 : (isConnected && Math.random() > 0.95 ? Math.floor(Math.random() * 3) : 0),
        };
      });
      return [{
        serial: 'Q2XX-XXXX-DEMO',
        name: 'Core-Switch-01',
        model: 'MS350-48',
        ports: mockPorts,
      }];
    }

    // Return null if no data and demo mode is off
    if (!data || (!data.ports?.length && !data.switches?.length)) return null;

    // Handle single switch ports array
    if (data.ports && data.ports.length > 0) {
      return [{
        serial: data.deviceSerial || 'unknown',
        name: data.deviceName || 'Switch',
        ports: data.ports,
      }];
    }

    // Handle multiple switches
    if (data.switches && data.switches.length > 0) {
      return data.switches;
    }

    return null;
  }, [data]);

  if (!processedData || processedData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No port data available
      </div>
    );
  }

  // Calculate summary stats
  const allPorts = processedData.flatMap(s => s.ports);
  const connectedPorts = allPorts.filter(p => p.status === 'connected').length;
  const errorPorts = allPorts.filter(p => p.status === 'err-disabled' || (p.errors && p.errors > 0)).length;
  const avgUtilization = allPorts.length > 0
    ? Math.round(allPorts.reduce((sum, p) => sum + (p.utilization || 0), 0) / allPorts.length)
    : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Port Utilization
          </span>
          {errorPorts > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              {errorPorts} errors
            </span>
          )}
        </div>
      </div>

      {/* Stats summary */}
      <div className="flex-shrink-0 px-3 py-2 grid grid-cols-3 gap-2 border-b border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {connectedPorts}
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Connected</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">
            {allPorts.length}
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Total Ports</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {avgUtilization}%
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Avg Util</div>
        </div>
      </div>

      {/* Port grids per switch */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-4">
          {processedData.map((sw) => (
            <div key={sw.serial}>
              {/* Switch name */}
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 truncate">
                {sw.name}
                {sw.model && (
                  <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400">
                    ({sw.model})
                  </span>
                )}
              </div>

              {/* Port grid */}
              <div className="grid grid-cols-12 gap-1">
                {sw.ports.slice(0, 48).map((port, portIndex) => {
                  const statusInfo = getStatusColor(port.status || 'disconnected', port.enabled);
                  const colorClass = metric === 'utilization' && port.status === 'connected'
                    ? getUtilizationColor(port.utilization || 0)
                    : statusInfo.bg;
                  const isDisabled = !port.enabled || port.status === 'disabled';

                  const hasError = port.status === 'err-disabled' || (port.errors && port.errors > 0);

                  return (
                    <div
                      key={`${sw.serial}-${port.portId ?? portIndex}`}
                      className={`
                        relative w-full aspect-square rounded-sm ${colorClass} overflow-hidden
                        ${hasError ? 'ring-2 ring-red-500' : ''}
                        ${isDisabled ? 'border border-dashed border-slate-400 dark:border-slate-500' : ''}
                        group cursor-default
                      `}
                      title={`Port ${port.portId}: ${port.status || 'unknown'}${isDisabled ? ' (disabled)' : ''} - ${port.utilization || 0}%`}
                    >
                      {/* Disabled strikethrough */}
                      {isDisabled && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-[141%] h-px bg-slate-400 dark:bg-slate-500 rotate-45" />
                        </div>
                      )}
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                        <div className="font-medium">Port {port.portId}</div>
                        <div>{isDisabled ? 'Disabled' : (port.status || 'Unknown')}</div>
                        {port.utilization !== undefined && port.status === 'connected' && (
                          <div>Util: {port.utilization}%</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Port count indicator if more than 48 */}
              {sw.ports.length > 48 && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 text-center">
                  Showing 48 of {sw.ports.length} ports
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-center gap-3">
          {metric === 'utilization' ? (
            <>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                <span className="text-[9px] text-slate-500 dark:text-slate-400">&lt;30%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-amber-500" />
                <span className="text-[9px] text-slate-500 dark:text-slate-400">50-70%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-red-500" />
                <span className="text-[9px] text-slate-500 dark:text-slate-400">&gt;90%</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-[9px] text-slate-500 dark:text-slate-400">Up</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-slate-400 dark:bg-slate-500" />
                <span className="text-[9px] text-slate-500 dark:text-slate-400">Down</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="relative w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-slate-700 border border-dashed border-slate-400 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[141%] h-px bg-slate-400 rotate-45" />
                  </div>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">Disabled</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                <span className="text-[9px] text-slate-500 dark:text-slate-400">Error</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

PortHeatmapCard.displayName = 'PortHeatmapCard';

export default PortHeatmapCard;
