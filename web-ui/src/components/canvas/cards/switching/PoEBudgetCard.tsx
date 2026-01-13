'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { configurePort, type ActionState } from '@/services/cardActions';

interface PoEPort {
  portId: string;
  name?: string;
  poeEnabled: boolean;
  poeClass?: number;
  powerConsumption?: number;
  maxPower?: number;
  status?: 'delivering' | 'not-delivering' | 'disabled' | 'fault';
  deviceType?: string;
  deviceName?: string;
  deviceMac?: string;
  priority?: 'critical' | 'high' | 'low';
}

interface SwitchPoEData {
  serial: string;
  name: string;
  model?: string;
  totalBudget: number;
  usedPower: number;
  availablePower: number;
  ports: PoEPort[];
  trend?: number[];
}

interface PoEBudgetCardData {
  switches?: SwitchPoEData[];
  totalBudget?: number;
  usedPower?: number;
  ports?: PoEPort[];
  deviceSerial?: string;
  deviceName?: string;
  networkId?: string;
}

interface PoEBudgetCardProps {
  data: PoEBudgetCardData;
  config?: {
    showPortDetails?: boolean;
    portsPerRow?: number;
  };
}

function getPowerColor(percentage: number): { bg: string; color: string } {
  if (percentage >= 90) return { bg: '#ef4444', color: 'text-red-600' };
  if (percentage >= 75) return { bg: '#f97316', color: 'text-orange-600' };
  if (percentage >= 50) return { bg: '#f59e0b', color: 'text-amber-600' };
  return { bg: '#22c55e', color: 'text-emerald-600' };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'delivering': return '#22c55e';
    case 'not-delivering': return '#64748b';
    case 'disabled': return '#94a3b8';
    case 'fault': return '#ef4444';
    default: return '#94a3b8';
  }
}

function formatPower(watts: number): string {
  if (watts >= 1000) return `${(watts / 1000).toFixed(1)}kW`;
  return `${watts.toFixed(1)}W`;
}

const DEVICE_ICONS: Record<string, string> = {
  'ip phone': '📞',
  'phone': '📞',
  'ap': '📡',
  'access point': '📡',
  'camera': '📹',
  'ip camera': '📹',
  'sensor': '🌡️',
  'iot': '📟',
  'default': '🔌',
};

const POE_CLASSES: Record<number, { name: string; maxWatts: number }> = {
  0: { name: 'Class 0', maxWatts: 15.4 },
  1: { name: 'Class 1', maxWatts: 4 },
  2: { name: 'Class 2', maxWatts: 7 },
  3: { name: 'Class 3', maxWatts: 15.4 },
  4: { name: 'PoE+', maxWatts: 30 },
  5: { name: 'PoE++ Type 3', maxWatts: 45 },
  6: { name: 'PoE++ Type 3', maxWatts: 60 },
  7: { name: 'PoE++ Type 4', maxWatts: 75 },
  8: { name: 'PoE++ Type 4', maxWatts: 90 },
};

/**
 * PoEBudgetCard - Switch panel visualization with interactive port management
 */
export const PoEBudgetCard = memo(({ data, config }: PoEBudgetCardProps) => {
  const portsPerRow = config?.portsPerRow ?? 12;
  const { demoMode } = useDemoMode();

  const [selectedSwitch, setSelectedSwitch] = useState<string | null>(null);
  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'panel' | 'list'>('panel');
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    if (!data && demoMode) {
      // Generate mock data
      const mockPorts: PoEPort[] = Array.from({ length: 24 }, (_, i) => {
        const portNum = i + 1;
        const isPoE = Math.random() > 0.2;
        const isDelivering = isPoE && Math.random() > 0.3;
        return {
          portId: String(portNum),
          name: isDelivering ? ['Phone', 'AP', 'Camera', 'Sensor'][Math.floor(Math.random() * 4)] : undefined,
          poeEnabled: isPoE,
          poeClass: isDelivering ? Math.floor(Math.random() * 5) : undefined,
          powerConsumption: isDelivering ? Math.random() * 25 + 2 : 0,
          status: !isPoE ? 'disabled' : isDelivering ? 'delivering' : 'not-delivering',
          deviceType: isDelivering ? ['phone', 'ap', 'camera', 'sensor'][Math.floor(Math.random() * 4)] : undefined,
          priority: ['critical', 'high', 'low'][Math.floor(Math.random() * 3)] as 'critical' | 'high' | 'low',
        };
      });

      return {
        switches: [{
          serial: 'Q2XX-XXXX-XXXX',
          name: 'Core-Switch-1',
          model: 'MS225-24P',
          totalBudget: 370,
          usedPower: mockPorts.reduce((sum, p) => sum + (p.powerConsumption || 0), 0),
          availablePower: 370 - mockPorts.reduce((sum, p) => sum + (p.powerConsumption || 0), 0),
          ports: mockPorts,
          trend: Array.from({ length: 24 }, () => 150 + Math.random() * 100),
        }],
        totalBudget: 370,
        usedPower: mockPorts.reduce((sum, p) => sum + (p.powerConsumption || 0), 0),
      };
    }

    if (!data) return null;

    if (data.ports && data.ports.length > 0) {
      const usedPower = data.ports.reduce((sum, p) => sum + (p.powerConsumption || 0), 0);
      return {
        switches: [{
          serial: data.deviceSerial || 'unknown',
          name: data.deviceName || 'Switch',
          totalBudget: data.totalBudget || 370,
          usedPower,
          availablePower: (data.totalBudget || 370) - usedPower,
          ports: data.ports,
          trend: Array.from({ length: 24 }, () => usedPower * (0.8 + Math.random() * 0.4)),
        }],
        totalBudget: data.totalBudget || 370,
        usedPower,
      };
    }

    if (data.switches && data.switches.length > 0) {
      const totalBudget = data.switches.reduce((sum, s) => sum + s.totalBudget, 0);
      const usedPower = data.switches.reduce((sum, s) => sum + s.usedPower, 0);
      return {
        switches: data.switches.map(s => ({
          ...s,
          trend: s.trend || Array.from({ length: 24 }, () => s.usedPower * (0.8 + Math.random() * 0.4)),
        })),
        totalBudget,
        usedPower,
      };
    }

    return null;
  }, [data]);

  const currentSwitch = useMemo(() => {
    if (!processedData) return null;
    if (selectedSwitch) {
      return processedData.switches.find(s => s.serial === selectedSwitch);
    }
    return processedData.switches[0];
  }, [processedData, selectedSwitch]);

  const selectedPortData = useMemo(() => {
    if (!selectedPort || !currentSwitch) return null;
    return currentSwitch.ports.find(p => p.portId === selectedPort);
  }, [selectedPort, currentSwitch]);

  // Calculate class breakdown
  const classBreakdown = useMemo(() => {
    if (!currentSwitch) return {};
    const breakdown: Record<number, { count: number; power: number }> = {};
    currentSwitch.ports.forEach(p => {
      if (p.poeClass !== undefined && p.status === 'delivering') {
        if (!breakdown[p.poeClass]) breakdown[p.poeClass] = { count: 0, power: 0 };
        breakdown[p.poeClass].count++;
        breakdown[p.poeClass].power += p.powerConsumption || 0;
      }
    });
    return breakdown;
  }, [currentSwitch]);

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

  const handleAction = useCallback(async (action: string, portId?: string) => {
    if (!currentSwitch) return;

    setActionState({ status: 'loading', message: `Executing ${action}...` });

    if ((action === 'enable-poe' || action === 'disable-poe') && portId) {
      const result = await configurePort({
        serial: currentSwitch.serial,
        portId,
        poeEnabled: action === 'enable-poe',
      });

      if (result.success) {
        setActionState({ status: 'success', message: `PoE ${action === 'enable-poe' ? 'enabled' : 'disabled'} on port ${portId}` });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } else if (action === 'cycle-power' && portId) {
      const result = await configurePort({
        serial: currentSwitch.serial,
        portId,
        poeEnabled: false, // First disable
      });

      if (result.success) {
        // Then re-enable after brief delay
        setTimeout(async () => {
          await configurePort({
            serial: currentSwitch.serial,
            portId,
            poeEnabled: true,
          });
          setActionState({ status: 'success', message: `Power cycled on port ${portId}` });
        }, 1000);
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [currentSwitch]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No PoE data available
      </div>
    );
  }

  const usagePercentage = processedData.totalBudget > 0
    ? (processedData.usedPower / processedData.totalBudget) * 100
    : 0;
  const powerColor = getPowerColor(usagePercentage);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              PoE Budget
            </span>
            {usagePercentage >= 80 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                High Usage
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('panel')}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                viewMode === 'panel'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Panel
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-2">
        {selectedPort && selectedPortData ? (
          /* Port Detail View */
          <div className="h-full flex flex-col">
            <button
              onClick={() => setSelectedPort(null)}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back to panel
            </button>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {/* Port Header */}
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: getStatusColor(selectedPortData.status || 'disabled') }}
                >
                  {selectedPortData.portId}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Port {selectedPortData.portId}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {selectedPortData.status === 'delivering' ? 'Delivering Power' :
                     selectedPortData.status === 'not-delivering' ? 'Not Delivering' :
                     selectedPortData.status === 'fault' ? 'Fault Detected' : 'Disabled'}
                  </div>
                </div>
              </div>

              {/* Power Stats */}
              {selectedPortData.status === 'delivering' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {formatPower(selectedPortData.powerConsumption || 0)}
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">Current</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {formatPower(selectedPortData.maxPower || POE_CLASSES[selectedPortData.poeClass || 0]?.maxWatts || 15.4)}
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">Max</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {POE_CLASSES[selectedPortData.poeClass || 0]?.name || 'N/A'}
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">Class</div>
                  </div>
                </div>
              )}

              {/* Connected Device */}
              {selectedPortData.deviceType && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Connected Device</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {DEVICE_ICONS[selectedPortData.deviceType.toLowerCase()] || DEVICE_ICONS.default}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {selectedPortData.deviceName || selectedPortData.deviceType}
                      </div>
                      {selectedPortData.deviceMac && (
                        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {selectedPortData.deviceMac}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Priority */}
              {selectedPortData.priority && (
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Priority</span>
                  <span className={`px-2 py-0.5 text-[9px] font-medium rounded ${
                    selectedPortData.priority === 'critical' ? 'bg-red-100 text-red-700' :
                    selectedPortData.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {selectedPortData.priority.charAt(0).toUpperCase() + selectedPortData.priority.slice(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Overview */
          <div className="h-full flex flex-col">
            {/* Power Gauge Summary */}
            <div className="flex-shrink-0 flex gap-3 mb-2">
              {/* Mini Gauge */}
              <div className="flex-shrink-0">
                <svg viewBox="0 0 80 50" className="w-16 h-10">
                  <path
                    d="M 8 45 A 32 32 0 1 1 72 45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className="text-slate-200 dark:text-slate-700"
                  />
                  <path
                    d="M 8 45 A 32 32 0 1 1 72 45"
                    fill="none"
                    stroke={powerColor.bg}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(usagePercentage / 100) * 100.5} 100.5`}
                  />
                  <text x="40" y="40" textAnchor="middle" className={`text-xs font-bold ${powerColor.color} fill-current`}>
                    {usagePercentage.toFixed(0)}%
                  </text>
                </svg>
              </div>

              {/* Power Stats */}
              <div className="flex-1 space-y-0.5 text-[9px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Used</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{formatPower(processedData.usedPower)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Available</span>
                  <span className="font-semibold text-emerald-600">{formatPower(processedData.totalBudget - processedData.usedPower)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Total</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{formatPower(processedData.totalBudget)}</span>
                </div>
              </div>

              {/* Trend */}
              {currentSwitch?.trend && (
                <svg viewBox="0 0 60 30" className="w-14 h-8 flex-shrink-0">
                  <path
                    d={generateSparkline(currentSwitch.trend, 60, 28)}
                    fill="none"
                    stroke={powerColor.bg}
                    strokeWidth="2"
                  />
                </svg>
              )}
            </div>

            {/* Switch Panel or List */}
            {viewMode === 'panel' && currentSwitch ? (
              /* Port Panel Grid */
              <div className="flex-1 overflow-y-auto">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">
                  {currentSwitch.name} ({currentSwitch.ports.length} ports)
                </div>
                <div
                  className="grid gap-0.5"
                  style={{ gridTemplateColumns: `repeat(${portsPerRow}, minmax(0, 1fr))` }}
                >
                  {currentSwitch.ports.map((port, portIndex) => {
                    const isHovered = hoveredPort === port.portId;
                    const isSelected = selectedPort === port.portId;
                    const utilization = port.maxPower
                      ? ((port.powerConsumption || 0) / port.maxPower) * 100
                      : 0;
                    const isDisabled = port.status === 'disabled' || !port.poeEnabled;

                    return (
                      <div
                        key={`${currentSwitch.serial}-${port.portId ?? portIndex}`}
                        className={`aspect-square rounded cursor-pointer transition-all flex items-center justify-center relative overflow-hidden ${
                          isHovered || isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                        } ${isDisabled ? 'border border-dashed border-slate-400 dark:border-slate-500' : ''}`}
                        style={{ backgroundColor: getStatusColor(port.status || 'disabled') }}
                        onMouseEnter={() => setHoveredPort(port.portId)}
                        onMouseLeave={() => setHoveredPort(null)}
                        onClick={() => setSelectedPort(port.portId)}
                      >
                        <span className={`text-[7px] font-bold ${isDisabled ? 'text-slate-500 dark:text-slate-400' : 'text-white'}`}>
                          {port.portId}
                        </span>
                        {/* Disabled strikethrough pattern */}
                        {isDisabled && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-[141%] h-px bg-slate-400 dark:bg-slate-500 rotate-45" />
                          </div>
                        )}
                        {/* Utilization indicator */}
                        {port.status === 'delivering' && utilization > 70 && (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-0.5"
                            style={{ backgroundColor: utilization > 90 ? '#ef4444' : '#f59e0b' }}
                          />
                        )}
                        {/* Fault indicator */}
                        {port.status === 'fault' && (
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hover tooltip */}
                {hoveredPort && currentSwitch && (() => {
                  const port = currentSwitch.ports.find(p => p.portId === hoveredPort);
                  if (!port) return null;
                  return (
                    <div className="mt-2 p-1.5 bg-slate-100 dark:bg-slate-700 rounded text-[9px]">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        Port {port.portId}: {port.status}
                      </div>
                      {port.status === 'delivering' && (
                        <div className="text-slate-600 dark:text-slate-400">
                          {formatPower(port.powerConsumption || 0)} • {port.deviceType || 'Unknown device'}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Legend */}
                <div className="mt-2 flex flex-wrap gap-2 text-[8px]">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: getStatusColor('delivering') }} />
                    <span className="text-slate-500 dark:text-slate-400">Delivering</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: getStatusColor('not-delivering') }} />
                    <span className="text-slate-500 dark:text-slate-400">Ready</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="relative w-2.5 h-2.5 rounded border border-dashed border-slate-400 dark:border-slate-500 overflow-hidden" style={{ backgroundColor: getStatusColor('disabled') }}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[141%] h-px bg-slate-400 dark:bg-slate-500 rotate-45" />
                      </div>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400">Disabled</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: getStatusColor('fault') }} />
                    <span className="text-slate-500 dark:text-slate-400">Fault</span>
                  </div>
                </div>
              </div>
            ) : (
              /* List View */
              <div className="flex-1 overflow-y-auto space-y-1">
                {currentSwitch?.ports
                  .filter(p => p.status === 'delivering')
                  .sort((a, b) => (b.powerConsumption || 0) - (a.powerConsumption || 0))
                  .map((port) => {
                    const deviceIcon = port.deviceType
                      ? DEVICE_ICONS[port.deviceType.toLowerCase()] || DEVICE_ICONS.default
                      : DEVICE_ICONS.default;

                    return (
                      <div
                        key={port.portId}
                        className="flex items-center gap-2 p-1.5 bg-slate-50 dark:bg-slate-800/30 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                        onClick={() => setSelectedPort(port.portId)}
                      >
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                          style={{ backgroundColor: getStatusColor(port.status || 'disabled') }}
                        >
                          {port.portId}
                        </div>
                        <span className="text-sm">{deviceIcon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                            {port.deviceName || port.deviceType || `Port ${port.portId}`}
                          </div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400">
                            {POE_CLASSES[port.poeClass || 0]?.name || 'Unknown'} • {port.priority || 'normal'} priority
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            {formatPower(port.powerConsumption || 0)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Class Breakdown */}
            {Object.keys(classBreakdown).length > 0 && (
              <div className="flex-shrink-0 mt-2 flex gap-1">
                {Object.entries(classBreakdown).map(([cls, data]) => (
                  <div key={cls} className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                    <div className="text-[8px] text-slate-500 dark:text-slate-400">{POE_CLASSES[Number(cls)]?.name || `C${cls}`}</div>
                    <div className="text-[9px] font-semibold text-slate-700 dark:text-slate-300">{data.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex gap-1">
          {selectedPort ? (
            <>
              <button
                onClick={() => handleAction('toggle', selectedPort)}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {selectedPortData?.poeEnabled ? 'Disable' : 'Enable'} PoE
              </button>
              <button
                onClick={() => handleAction('reset', selectedPort)}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              >
                Reset Port
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleAction('schedule')}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Schedule
              </button>
              <button
                onClick={() => handleAction('alerts')}
                className="flex-1 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                Set Alert
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

PoEBudgetCard.displayName = 'PoEBudgetCard';

export default PoEBudgetCard;
