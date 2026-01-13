'use client';

import React, { memo, useMemo } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface RoamingEvent {
  timestamp: string;
  clientMac: string;
  clientName?: string;
  fromAp: string;
  toAp: string;
  duration: number; // ms to roam
  status: 'success' | 'failure' | 'slow';
  ssid: string;
}

interface RoamingEventsCardProps {
  data: {
    events?: RoamingEvent[];
    totalRoams?: number;
    failureRate?: number;
  };
}

const RoamingEventsCard = memo(({ data }: RoamingEventsCardProps) => {
  const { demoMode } = useDemoMode();

  const events = useMemo(() => {
    let rawEvents = data?.events || [];

    if (rawEvents.length === 0 && (demoMode || !data)) {
      // Generate mock events
      const now = Date.now();
      rawEvents = Array.from({ length: 8 }).map((_, i) => ({
        timestamp: new Date(now - i * 1000 * 60 * 5).toISOString(), // Every 5 mins
        clientMac: `00:11:22:${Math.floor(Math.random() * 90 + 10)}:${Math.floor(Math.random() * 90 + 10)}:FF`,
        clientName: ['iPhone-USER', 'Laptop-IT', 'Scanner-WH', 'Pixel-Guest'][Math.floor(Math.random() * 4)],
        fromAp: `AP-Floor${Math.floor(Math.random() * 2) + 1}-West`,
        toAp: `AP-Floor${Math.floor(Math.random() * 2) + 1}-East`,
        duration: Math.floor(Math.random() * 200) + 50, // 50-250ms
        status: Math.random() > 0.8 ? (Math.random() > 0.5 ? 'slow' : 'failure') : 'success',
        ssid: 'Corporate-WiFi',
      })) as RoamingEvent[];
    }
    return rawEvents;
  }, [data, demoMode]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-500';
      case 'slow': return 'bg-amber-500';
      case 'failure': return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (events.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No roaming events recorded
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {events.map((event, idx) => (
          <div key={idx} className="relative flex gap-3 pl-2">
            {/* Timeline Line */}
            {idx !== events.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-[-12px] w-px bg-slate-200 dark:bg-slate-700" />
            )}

            {/* Status Dot */}
            <div className={`relative z-10 w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${getStatusColor(event.status)} ring-4 ring-white dark:ring-slate-900`} />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                  {event.clientName || event.clientMac}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {formatTime(event.timestamp)}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="truncate max-w-[80px]">{event.fromAp}</span>
                <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="truncate max-w-[80px]">{event.toAp}</span>
              </div>

              <div className="mt-1 flex gap-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${event.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                    event.status === 'slow' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400' :
                      'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                  {event.status === 'success' ? 'Successful Roam' : event.status === 'slow' ? 'Slow Roam' : 'Roam Failed'}
                </span>
                {event.duration > 0 && (
                  <span className="text-[9px] text-slate-400 py-0.5">
                    {event.duration}ms
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

RoamingEventsCard.displayName = 'RoamingEventsCard';

export { RoamingEventsCard };
