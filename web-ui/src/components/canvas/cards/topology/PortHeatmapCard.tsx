'use client';

import React, { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface PortData {
    portId: string;
    number: number;
    status: 'connected' | 'disconnected' | 'disabled' | 'alerting';
    poeUsage?: number; // Watts
    speed?: string; // 1G, 10G, etc.
    clientCount?: number;
    usageMbps?: number;
}

interface PortHeatmapCardProps {
    data: {
        deviceName?: string;
        model?: string;
        ports?: PortData[];
    };
}

const PortHeatmapCard = memo(({ data }: PortHeatmapCardProps) => {
    const { demoMode } = useDemoMode();

    const switchData = useMemo(() => {
        let ports = data?.ports || [];

        if (ports.length === 0 && (demoMode || !data)) {
            // Mock switch ports (48 port switch)
            ports = Array.from({ length: 48 }).map((_, i) => ({
                portId: `p-${i + 1}`,
                number: i + 1,
                status: Math.random() > 0.4 ? 'connected' : (Math.random() > 0.8 ? 'disabled' : 'disconnected'),
                poeUsage: Math.random() > 0.6 ? Math.floor(Math.random() * 30) : 0,
                speed: i >= 44 ? '10G' : '1G', // Uplinks
                usageMbps: Math.random() * 1000,
            }));
        }

        return {
            ports,
            deviceName: data?.deviceName || 'Switch-Stack-01',
            model: data?.model || 'MS390-48LP'
        };
    }, [data, demoMode]);

    const getPortColor = (port: PortData) => {
        if (port.status === 'disabled') return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
        if (port.status === 'disconnected') return 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600';

        // Connected - Color by usage heat
        if (port.usageMbps && port.usageMbps > 800) return 'bg-red-500 border-red-600';
        if (port.usageMbps && port.usageMbps > 300) return 'bg-amber-500 border-amber-600';
        return 'bg-emerald-500 border-emerald-600';
    };

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{switchData.deviceName}</div>
                    <div className="text-xs text-slate-500">{switchData.model} • {switchData.ports.length} Ports</div>
                </div>

                {/* Simple Legend */}
                <div className="flex gap-3 text-[9px] text-slate-500 uppercase tracking-wide">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500"></span> Active</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500"></span> High Use</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded border border-slate-300"></span> Down</div>
                </div>
            </div>

            {/* Switch Faceplate Visualization */}
            <div className="flex-1 flex flex-col justify-center">
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-600 shadow-inner">

                    {/* Port Grid - mimicking standard 48p layout (2 rows of 24) */}
                    <div className="grid grid-cols-24 gap-1">
                        {/* Top Row (Odd ports usually) */}
                        {switchData.ports.filter((_, i) => i % 2 === 0).map((port) => (
                            <div key={port.portId} className="flex flex-col items-center gap-0.5 group relative">
                                <div className={`w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 rounded-sm border ${getPortColor(port)} transition-all hover:scale-110 shadow-sm relative`}>
                                    {/* PoE Indicator dot */}
                                    {port.poeUsage && port.poeUsage > 0 && (
                                        <div className="absolute -top-px -right-px w-1 h-1 bg-yellow-300 rounded-full animate-pulse" />
                                    )}
                                </div>
                                <span className="text-[8px] text-slate-400 font-mono hidden sm:block">{port.number}</span>

                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 w-32 bg-slate-900 text-white textxs p-2 rounded shadow-xl pointer-events-none">
                                    <div className="font-semibold mb-0.5">Port {port.number}</div>
                                    <div className="text-slate-300 capitalize">{port.status}</div>
                                    {port.status === 'connected' && (
                                        <>
                                            <div className="text-slate-400 mt-1">{port.speed} • {Math.round(port.usageMbps || 0)} Mbps</div>
                                            {port.poeUsage && <div>PoE: {port.poeUsage}W</div>}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Row (Even ports usually) */}
                    <div className="grid grid-cols-24 gap-1 mt-1">
                        {switchData.ports.filter((_, i) => i % 2 !== 0).map((port) => (
                            <div key={port.portId} className="flex flex-col items-center gap-0.5 group relative">
                                <div className={`w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 rounded-sm border ${getPortColor(port)} transition-all hover:scale-110 shadow-sm relative`}>
                                    {/* PoE Indicator dot */}
                                    {port.poeUsage && port.poeUsage > 0 && (
                                        <div className="absolute -top-px -right-px w-1 h-1 bg-yellow-300 rounded-full animate-pulse" />
                                    )}
                                </div>
                                <span className="text-[8px] text-slate-400 font-mono hidden sm:block">{port.number}</span>
                                {/* Tooltip */}
                                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 w-32 bg-slate-900 text-white textxs p-2 rounded shadow-xl pointer-events-none">
                                    <div className="font-semibold mb-0.5">Port {port.number}</div>
                                    <div className="text-slate-300 capitalize">{port.status}</div>
                                    {port.status === 'connected' && (
                                        <>
                                            <div className="text-slate-400 mt-1">{port.speed} • {Math.round(port.usageMbps || 0)} Mbps</div>
                                            {port.poeUsage && <div>PoE: {port.poeUsage}W</div>}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
});

PortHeatmapCard.displayName = 'PortHeatmapCard';

export { PortHeatmapCard };
