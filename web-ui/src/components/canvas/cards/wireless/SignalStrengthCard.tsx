'use client';

import React, { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface ClientSignalData {
  mac: string;
  rssi: number; // dBm, e.g., -65
  snr: number; // dB, e.g., 25
  apName: string;
  ssid: string;
}

interface SignalStrengthCardProps {
  data: {
    clients?: ClientSignalData[];
    avgRssi?: number;
    avgSnr?: number;
  };
  config?: Record<string, any>;
}

// Signal quality buckets
const BUCKETS = [
  { label: 'Excellent', min: -50, color: '#10b981' }, // > -50 dBm
  { label: 'Good', min: -65, color: '#3b82f6' },      // -50 to -65 dBm
  { label: 'Fair', min: -75, color: '#f59e0b' },      // -65 to -75 dBm
  { label: 'Poor', min: -85, color: '#f97316' },      // -75 to -85 dBm
  { label: 'Bad', min: -100, color: '#ef4444' },      // < -85 dBm
];

const SignalStrengthCard = memo(({ data }: SignalStrengthCardProps) => {
  const { demoMode } = useDemoMode();

  const processedData = useMemo(() => {
    let clients = data?.clients || [];

    // Mock data for demo mode
    if (clients.length === 0 && (demoMode || !data)) {
      clients = Array.from({ length: 50 }).map((_, i) => ({
        mac: `00:11:22:33:44:${i.toString(16).padStart(2, '0')}`,
        rssi: -40 - Math.random() * 50, // -40 to -90
        snr: 10 + Math.random() * 40,
        apName: `AP-${Math.floor(i / 10)}`,
        ssid: i % 2 === 0 ? 'Corporate' : 'Guest',
      }));
    }

    if (clients.length === 0) return null;

    // Distribute into buckets
    const distribution = BUCKETS.map(bucket => ({
      ...bucket,
      count: 0,
      clients: [] as ClientSignalData[],
    }));

    let totalRssi = 0;

    clients.forEach(client => {
      totalRssi += client.rssi;
      // Find matching bucket
      const bucketIndex = BUCKETS.findIndex((b, i) => {
        const nextB = BUCKETS[i - 1]; // Check previous (higher signal)
        // If it's the first bucket, check if greater than min
        if (i === 0) return client.rssi >= b.min;
        // Otherwise check if between this min and prev min
        return client.rssi >= b.min && client.rssi < (nextB?.min || 0);
      });

      // Default to last bucket if no match (extremely poor signal)
      const targetIndex = bucketIndex >= 0 ? bucketIndex : BUCKETS.length - 1;
      distribution[targetIndex].count++;
      distribution[targetIndex].clients.push(client);
    });

    const avgRssi = Math.round(totalRssi / clients.length);

    return { distribution, avgRssi, totalClients: clients.length };
  }, [data, demoMode]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No client signal data
      </div>
    );
  }

  const { distribution, avgRssi, totalClients } = processedData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 rounded shadow-lg text-xs">
          <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{data.label} Signal</div>
          <div className="text-slate-500 dark:text-slate-400">Range: {data.min} dBm +</div>
          <div className="text-slate-500 dark:text-slate-400">Clients: {data.count} ({Math.round(data.count / totalClients * 100)}%)</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col p-3">
      {/* Summary Stats */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            Avg Signal Strength
          </div>
          <div className={`text-2xl font-bold ${avgRssi > -65 ? 'text-emerald-500' :
              avgRssi > -75 ? 'text-amber-500' : 'text-red-500'
            }`}>
            {avgRssi} <span className="text-xs font-normal text-slate-400">dBm</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            Active Clients
          </div>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
            {totalClients}
          </div>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {distribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend / Insight */}
      <div className="mt-2 text-[10px] text-center text-slate-400 dark:text-slate-500">
        Signal Distribution (RSSI)
      </div>
    </div>
  );
});

SignalStrengthCard.displayName = 'SignalStrengthCard';

export { SignalStrengthCard };
