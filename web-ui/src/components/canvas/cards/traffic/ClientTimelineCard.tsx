'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { setClientPolicy, executeCardAction, type ActionState } from '@/services/cardActions';

interface ClientEvent {
  id?: string;
  timestamp: string;
  eventType: 'connect' | 'disconnect' | 'roam' | 'auth' | 'dhcp' | 'error' | string;
  clientMac?: string;
  clientIp?: string;
  clientName?: string;
  details?: string;
  ssid?: string;
  ap?: string;
  duration?: number;
  signalStrength?: number;
  channel?: number;
  band?: '2.4GHz' | '5GHz' | '6GHz';
  reason?: string;
}

interface ClientTimelineCardData {
  events?: ClientEvent[];
  client?: {
    mac: string;
    ip?: string;
    name?: string;
    vendor?: string;
    os?: string;
  };
  networkId?: string;
  timeRange?: string;
}

interface ClientTimelineCardProps {
  data: ClientTimelineCardData;
  config?: {
    maxEvents?: number;
    compact?: boolean;
  };
}

const EVENT_TYPES = {
  connect: { color: '#22c55e', bgColor: 'bg-emerald-100 dark:bg-emerald-900/40', textColor: 'text-emerald-700 dark:text-emerald-300', label: 'Connected', icon: '↗' },
  disconnect: { color: '#ef4444', bgColor: 'bg-red-100 dark:bg-red-900/40', textColor: 'text-red-700 dark:text-red-300', label: 'Disconnected', icon: '↘' },
  roam: { color: '#3b82f6', bgColor: 'bg-blue-100 dark:bg-blue-900/40', textColor: 'text-blue-700 dark:text-blue-300', label: 'Roamed', icon: '↔' },
  auth: { color: '#8b5cf6', bgColor: 'bg-purple-100 dark:bg-purple-900/40', textColor: 'text-purple-700 dark:text-purple-300', label: 'Authenticated', icon: '🔐' },
  dhcp: { color: '#06b6d4', bgColor: 'bg-cyan-100 dark:bg-cyan-900/40', textColor: 'text-cyan-700 dark:text-cyan-300', label: 'DHCP', icon: '📡' },
  error: { color: '#f97316', bgColor: 'bg-orange-100 dark:bg-orange-900/40', textColor: 'text-orange-700 dark:text-orange-300', label: 'Error', icon: '⚠' },
  association: { color: '#10b981', bgColor: 'bg-teal-100 dark:bg-teal-900/40', textColor: 'text-teal-700 dark:text-teal-300', label: 'Associated', icon: '🔗' },
  disassociation: { color: '#f59e0b', bgColor: 'bg-amber-100 dark:bg-amber-900/40', textColor: 'text-amber-700 dark:text-amber-300', label: 'Disassociated', icon: '✂' },
};

const TIME_RANGES = ['1h', '6h', '24h', '7d'];

/**
 * ClientTimelineCard - Interactive client event timeline with filtering
 */
export const ClientTimelineCard = memo(({ data, config }: ClientTimelineCardProps) => {
  const maxEvents = config?.maxEvents ?? 20;
  const { demoMode } = useDemoMode();

  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const [eventFilters, setEventFilters] = useState<Set<string>>(new Set(Object.keys(EVENT_TYPES)));
  const [timeRange, setTimeRange] = useState('24h');
  const [highlightSSID, setHighlightSSID] = useState<string | null>(null);
  const [highlightAP, setHighlightAP] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    if (!data && demoMode) {
      // Generate mock data for demonstration
      const mockEvents: ClientEvent[] = [
        { id: '1', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), eventType: 'connect', ssid: 'Corporate-5G', ap: 'AP-Floor2-East', signalStrength: -45, channel: 149, band: '5GHz' },
        { id: '2', timestamp: new Date(Date.now() - 25 * 60000).toISOString(), eventType: 'dhcp', clientIp: '10.0.1.45', details: 'Lease renewed' },
        { id: '3', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), eventType: 'roam', ssid: 'Corporate-5G', ap: 'AP-Floor2-West', signalStrength: -52, reason: 'Better signal', channel: 36, band: '5GHz' },
        { id: '4', timestamp: new Date(Date.now() - 90 * 60000).toISOString(), eventType: 'auth', details: '802.1X PEAP-MSCHAPv2' },
        { id: '5', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), eventType: 'connect', ssid: 'Corporate-5G', ap: 'AP-Floor2-East', signalStrength: -48, channel: 149, band: '5GHz' },
        { id: '6', timestamp: new Date(Date.now() - 180 * 60000).toISOString(), eventType: 'disconnect', reason: 'Client initiated', duration: 45 },
        { id: '7', timestamp: new Date(Date.now() - 240 * 60000).toISOString(), eventType: 'error', details: 'Authentication timeout', reason: 'RADIUS not responding' },
        { id: '8', timestamp: new Date(Date.now() - 300 * 60000).toISOString(), eventType: 'roam', ssid: 'Corporate-2G', ap: 'AP-Floor1-Main', signalStrength: -68, channel: 6, band: '2.4GHz' },
        { id: '9', timestamp: new Date(Date.now() - 360 * 60000).toISOString(), eventType: 'connect', ssid: 'Corporate-2G', ap: 'AP-Floor1-Main', signalStrength: -62, channel: 6, band: '2.4GHz' },
      ];
      return processEvents(mockEvents);
    }

    if (!data || !data.events || data.events.length === 0) return null;
    return processEvents(data.events);
  }, [data]);

  function processEvents(events: ClientEvent[]) {
    // Filter by event type
    const filtered = events.filter(e => eventFilters.has(e.eventType));

    // Sort by timestamp descending
    const sorted = [...filtered].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, maxEvents);

    // Calculate stats
    const stats = {
      connects: events.filter(e => e.eventType === 'connect').length,
      disconnects: events.filter(e => e.eventType === 'disconnect').length,
      roams: events.filter(e => e.eventType === 'roam').length,
      errors: events.filter(e => e.eventType === 'error').length,
      total: events.length,
    };

    // Find unique SSIDs and APs
    const ssids = new Set(events.filter(e => e.ssid).map(e => e.ssid!));
    const aps = new Set(events.filter(e => e.ap).map(e => e.ap!));

    // Calculate session segments
    const sessions: Array<{ start: Date; end: Date; ssid?: string; ap?: string }> = [];
    let sessionStart: ClientEvent | null = null;

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .forEach(event => {
        if (event.eventType === 'connect' && !sessionStart) {
          sessionStart = event;
        } else if (event.eventType === 'disconnect' && sessionStart) {
          sessions.push({
            start: new Date(sessionStart.timestamp),
            end: new Date(event.timestamp),
            ssid: sessionStart.ssid,
            ap: sessionStart.ap,
          });
          sessionStart = null;
        }
      });

    // Add current session if still connected
    if (sessionStart) {
      sessions.push({
        start: new Date((sessionStart as ClientEvent).timestamp),
        end: new Date(),
        ssid: (sessionStart as ClientEvent).ssid,
        ap: (sessionStart as ClientEvent).ap,
      });
    }

    return {
      events: sorted,
      stats,
      ssids: Array.from(ssids),
      aps: Array.from(aps),
      sessions,
    };
  }

  const toggleEventFilter = useCallback((eventType: string) => {
    setEventFilters(prev => {
      const next = new Set(prev);
      if (next.has(eventType)) {
        next.delete(eventType);
      } else {
        next.add(eventType);
      }
      return next;
    });
  }, []);

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);

    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, []);

  const selectedEventData = useMemo(() => {
    if (!selectedEvent || !processedData) return null;
    return processedData.events.find(e => e.id === selectedEvent);
  }, [selectedEvent, processedData]);

  const handleAction = useCallback(async (action: string) => {
    const clientMac = data?.client?.mac;
    if (!clientMac && action !== 'track') {
      setActionState({ status: 'error', message: 'No client selected' });
      setTimeout(() => setActionState({ status: 'idle' }), 3000);
      return;
    }

    setActionState({ status: 'loading', message: `Executing ${action}...` });

    if (action === 'track') {
      setActionState({ status: 'success', message: 'Client tracking enabled' });
    } else if (action === 'deauth') {
      const result = await executeCardAction('deauth-client', {
        clientMac,
        networkId: data?.networkId,
      });

      if (result.success) {
        setActionState({ status: 'success', message: 'Client deauthenticated' });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    } else if (action === 'block') {
      const result = await setClientPolicy({
        networkId: data?.networkId || '',
        clientId: clientMac || '',
        policy: 'blocked',
      });

      if (result.success) {
        setActionState({ status: 'success', message: 'Client blocked' });
      } else {
        setActionState({ status: 'error', message: result.message });
      }
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [data?.client?.mac, data?.networkId]);

  const isHighlighted = useCallback((event: ClientEvent) => {
    if (highlightSSID && event.ssid === highlightSSID) return true;
    if (highlightAP && event.ap === highlightAP) return true;
    return false;
  }, [highlightSSID, highlightAP]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No client events
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
              Client Timeline
            </span>
            {processedData.stats.errors > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                {processedData.stats.errors} errors
              </span>
            )}
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="text-[9px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border-0 text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            {TIME_RANGES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Client Info */}
        {data?.client && (
          <div className="mt-1 flex items-center gap-2 text-[10px]">
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {data.client.mac}
            </span>
            {data.client.ip && (
              <span className="text-slate-500">• {data.client.ip}</span>
            )}
          </div>
        )}
      </div>

      {/* Event Type Filters */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {Object.entries(EVENT_TYPES).map(([type, config]) => {
            const count = processedData.events.filter(e => e.eventType === type).length;
            const isActive = eventFilters.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleEventFilter(type)}
                className={`px-1.5 py-0.5 text-[9px] rounded flex items-center gap-1 transition-all ${
                  isActive
                    ? `${config.bgColor} ${config.textColor}`
                    : 'bg-transparent text-slate-400 dark:text-slate-500 opacity-50'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isActive ? config.color : '#94a3b8' }}
                />
                {config.label}
                {count > 0 && <span className="opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-2">
        {selectedEvent && selectedEventData ? (
          /* Detail View */
          <div className="h-full flex flex-col">
            <button
              onClick={() => setSelectedEvent(null)}
              className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              ← Back to timeline
            </button>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {/* Event Header */}
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{
                    backgroundColor: EVENT_TYPES[selectedEventData.eventType as keyof typeof EVENT_TYPES]?.bgColor || '#f1f5f9',
                    color: EVENT_TYPES[selectedEventData.eventType as keyof typeof EVENT_TYPES]?.color || '#64748b',
                  }}
                >
                  {EVENT_TYPES[selectedEventData.eventType as keyof typeof EVENT_TYPES]?.icon || '?'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {EVENT_TYPES[selectedEventData.eventType as keyof typeof EVENT_TYPES]?.label || selectedEventData.eventType}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {new Date(selectedEventData.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Event Details Grid */}
              <div className="grid grid-cols-2 gap-2">
                {selectedEventData.ssid && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">SSID</div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {selectedEventData.ssid}
                    </div>
                  </div>
                )}
                {selectedEventData.ap && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">Access Point</div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {selectedEventData.ap}
                    </div>
                  </div>
                )}
                {selectedEventData.signalStrength && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">Signal Strength</div>
                    <div className={`text-xs font-medium ${
                      selectedEventData.signalStrength > -50 ? 'text-emerald-600' :
                      selectedEventData.signalStrength > -70 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {selectedEventData.signalStrength} dBm
                    </div>
                  </div>
                )}
                {selectedEventData.channel && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">Channel</div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {selectedEventData.channel} ({selectedEventData.band || ''})
                    </div>
                  </div>
                )}
                {selectedEventData.clientIp && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">IP Address</div>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
                      {selectedEventData.clientIp}
                    </div>
                  </div>
                )}
                {selectedEventData.duration && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                    <div className="text-[9px] text-slate-500 dark:text-slate-400">Session Duration</div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {selectedEventData.duration} minutes
                    </div>
                  </div>
                )}
              </div>

              {/* Reason/Details */}
              {(selectedEventData.reason || selectedEventData.details) && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-2">
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Details</div>
                  <div className="text-[10px] text-slate-700 dark:text-slate-300">
                    {selectedEventData.reason || selectedEventData.details}
                  </div>
                </div>
              )}

              {/* Related Events */}
              <div>
                <div className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Related Events (same {selectedEventData.ssid ? 'SSID' : 'AP'})
                </div>
                <div className="space-y-1">
                  {processedData.events
                    .filter(e => e.id !== selectedEventData.id && (e.ssid === selectedEventData.ssid || e.ap === selectedEventData.ap))
                    .slice(0, 4)
                    .map(e => (
                      <div
                        key={e.id}
                        className="flex items-center gap-2 p-1 rounded bg-slate-100/50 dark:bg-slate-700/30 text-[10px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50"
                        onClick={() => setSelectedEvent(e.id || null)}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: EVENT_TYPES[e.eventType as keyof typeof EVENT_TYPES]?.color || '#94a3b8' }}
                        />
                        <span className="text-slate-600 dark:text-slate-400">{formatTime(e.timestamp)}</span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {EVENT_TYPES[e.eventType as keyof typeof EVENT_TYPES]?.label || e.eventType}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Timeline View */
          <div className="h-full flex flex-col">
            {/* Mini Stats */}
            <div className="flex-shrink-0 grid grid-cols-4 gap-1 mb-2">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded p-1 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {processedData.stats.connects}
                </div>
                <div className="text-[8px] text-emerald-700 dark:text-emerald-300">Connects</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded p-1 text-center">
                <div className="text-xs font-bold text-red-600 dark:text-red-400">
                  {processedData.stats.disconnects}
                </div>
                <div className="text-[8px] text-red-700 dark:text-red-300">Disconnects</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-1 text-center">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {processedData.stats.roams}
                </div>
                <div className="text-[8px] text-blue-700 dark:text-blue-300">Roams</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded p-1 text-center">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {processedData.events.length}
                </div>
                <div className="text-[8px] text-slate-500 dark:text-slate-400">Visible</div>
              </div>
            </div>

            {/* Interactive Timeline */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

                {/* Events */}
                <div className="space-y-1">
                  {processedData.events.map((event, index) => {
                    const eventConfig = EVENT_TYPES[event.eventType as keyof typeof EVENT_TYPES] || {
                      color: '#94a3b8',
                      bgColor: '#f1f5f9',
                      label: event.eventType,
                      icon: '?',
                    };
                    const isHovered = hoveredEvent === event.id;
                    const highlighted = isHighlighted(event);

                    return (
                      <div
                        key={event.id || index}
                        className={`relative flex items-start gap-2 p-1.5 rounded cursor-pointer transition-all ${
                          isHovered || highlighted
                            ? 'bg-slate-100 dark:bg-slate-700/50'
                            : ''
                        }`}
                        onMouseEnter={() => {
                          setHoveredEvent(event.id || null);
                          if (event.ssid) setHighlightSSID(event.ssid);
                          if (event.ap) setHighlightAP(event.ap);
                        }}
                        onMouseLeave={() => {
                          setHoveredEvent(null);
                          setHighlightSSID(null);
                          setHighlightAP(null);
                        }}
                        onClick={() => setSelectedEvent(event.id || null)}
                      >
                        {/* Timeline dot */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-transform ${
                            isHovered ? 'scale-125' : ''
                          }`}
                          style={{
                            backgroundColor: eventConfig.bgColor,
                            border: `2px solid ${eventConfig.color}`,
                          }}
                        >
                          <span className="text-[10px]">{eventConfig.icon}</span>
                        </div>

                        {/* Event content */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium text-slate-800 dark:text-slate-200">
                              {eventConfig.label}
                            </span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">
                              {formatTime(event.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                            {event.ssid && (
                              <span className={`px-1 py-0.5 rounded ${highlighted && highlightSSID === event.ssid ? 'bg-blue-100 dark:bg-blue-900/40' : ''}`}>
                                {event.ssid}
                              </span>
                            )}
                            {event.ap && (
                              <span className={`px-1 py-0.5 rounded ${highlighted && highlightAP === event.ap ? 'bg-purple-100 dark:bg-purple-900/40' : ''}`}>
                                {event.ap}
                              </span>
                            )}
                            {event.signalStrength && (
                              <span className={`${
                                event.signalStrength > -50 ? 'text-emerald-600' :
                                event.signalStrength > -70 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {event.signalStrength}dBm
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Duration indicator */}
                        {event.duration && (
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                            {event.duration}m
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SSID/AP Legend */}
            {(processedData.ssids.length > 1 || processedData.aps.length > 1) && (
              <div className="flex-shrink-0 mt-2 p-1.5 bg-slate-50 dark:bg-slate-800/50 rounded">
                <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-1">Hover to highlight</div>
                <div className="flex flex-wrap gap-1">
                  {processedData.ssids.map(ssid => (
                    <span
                      key={ssid}
                      className={`px-1.5 py-0.5 text-[9px] rounded cursor-pointer transition-colors ${
                        highlightSSID === ssid
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                      onMouseEnter={() => setHighlightSSID(ssid)}
                      onMouseLeave={() => setHighlightSSID(null)}
                    >
                      {ssid}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Feedback */}
      {actionState.status !== 'idle' && (
        <div className={`flex-shrink-0 px-3 py-2 border-t text-xs flex items-center gap-2 ${
          actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' :
          actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' :
          'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {actionState.status === 'loading' && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {actionState.status === 'success' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {actionState.status === 'error' && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{actionState.message}</span>
        </div>
      )}

      {/* Actions Footer */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex gap-1">
          <button
            onClick={() => handleAction('track')}
            className="flex-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Track Client
          </button>
          <button
            onClick={() => handleAction('deauth')}
            className="flex-1 px-2 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            Deauth
          </button>
          <button
            onClick={() => handleAction('block')}
            className="px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          >
            Block
          </button>
        </div>
      </div>
    </div>
  );
});

ClientTimelineCard.displayName = 'ClientTimelineCard';

export default ClientTimelineCard;
