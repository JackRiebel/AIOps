'use client';

import { memo, useMemo, useState, useCallback } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { acknowledgeSecurityEvent, createIncident, type ActionState } from '@/services/cardActions';

interface SecurityEvent {
  id?: string;
  timestamp: string;
  eventType: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  sourceIp?: string;
  destIp?: string;
  protocol?: string;
  action?: 'blocked' | 'allowed' | 'detected';
  category?: string;
  deviceSerial?: string;
  deviceName?: string;
  acknowledged?: boolean;
  correlationId?: string;
  incidentId?: string;
}

interface SecurityEventsCardData {
  events?: SecurityEvent[];
  networkId?: string;
  timeRange?: string;
}

interface SecurityEventsCardProps {
  data: SecurityEventsCardData;
  config?: {
    maxEvents?: number;
    showDetails?: boolean;
  };
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; stroke: string; label: string; priority: number }> = {
  critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40', stroke: '#ef4444', label: 'Critical', priority: 4 },
  high: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40', stroke: '#f97316', label: 'High', priority: 3 },
  medium: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40', stroke: '#f59e0b', label: 'Medium', priority: 2 },
  low: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40', stroke: '#eab308', label: 'Low', priority: 1 },
  info: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40', stroke: '#3b82f6', label: 'Info', priority: 0 },
};

const ACTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  blocked: { icon: '🛡️', color: 'text-red-500', label: 'Blocked' },
  allowed: { icon: '✓', color: 'text-green-500', label: 'Allowed' },
  detected: { icon: '⚠', color: 'text-amber-500', label: 'Detected' },
};

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * SecurityEventsCard - Interactive Security Event Timeline
 *
 * Shows:
 * - Severity filter toggles
 * - Expandable event details with actions
 * - Acknowledge and Create Incident buttons
 * - Event correlation indicators
 * - Sound/visual alert for critical events
 */
export const SecurityEventsCard = memo(({ data, config }: SecurityEventsCardProps) => {
  const maxEvents = config?.maxEvents ?? 15;
  const { demoMode } = useDemoMode();
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  const processedData = useMemo(() => {
    if (!data && !demoMode) return null;

    let events = Array.isArray(data?.events) ? data.events : [];

    // Generate mock data if no real data available and demo mode is enabled
    if (events.length === 0 && demoMode) {
      const now = new Date();
      const mockEventTypes = [
        { type: 'Malware Detected', desc: 'Trojan.GenericKD detected in downloaded file', severity: 'critical' as const },
        { type: 'Brute Force Attempt', desc: 'Multiple failed SSH login attempts from external IP', severity: 'high' as const },
        { type: 'Port Scan Detected', desc: 'Sequential port scanning activity detected', severity: 'medium' as const },
        { type: 'Suspicious DNS Query', desc: 'Query to known malicious domain blocked', severity: 'high' as const },
        { type: 'Unauthorized Access', desc: 'Access attempt to restricted network segment', severity: 'critical' as const },
        { type: 'Data Exfiltration', desc: 'Unusual outbound data transfer detected', severity: 'high' as const },
        { type: 'Policy Violation', desc: 'Unencrypted HTTP traffic to external site', severity: 'medium' as const },
        { type: 'Certificate Warning', desc: 'Self-signed certificate detected on internal service', severity: 'low' as const },
        { type: 'ARP Spoofing', desc: 'Duplicate MAC address detected on network', severity: 'high' as const },
        { type: 'Firewall Rule Hit', desc: 'Traffic blocked by egress firewall rule', severity: 'info' as const },
      ];
      const mockSrcIps = ['192.168.1.105', '10.0.50.22', '172.16.0.88', '10.0.100.150', '192.168.5.33'];
      const mockDestIps = ['45.33.32.156', '185.220.101.1', '104.244.42.65', '23.185.0.2', '52.96.162.50'];

      events = mockEventTypes.map((evt, i) => ({
        id: `demo-${i}`,
        timestamp: new Date(now.getTime() - i * 15 * 60000).toISOString(),
        eventType: evt.type,
        severity: evt.severity,
        description: evt.desc,
        sourceIp: mockSrcIps[i % mockSrcIps.length],
        destIp: mockDestIps[i % mockDestIps.length],
        protocol: ['TCP', 'UDP', 'ICMP'][i % 3],
        action: (['blocked', 'detected', 'allowed'] as const)[i % 3],
        category: ['malware', 'intrusion', 'policy'][i % 3],
        deviceName: `fw-edge-0${(i % 3) + 1}`,
        acknowledged: i > 6,
        correlationId: i < 3 ? 'corr-001' : i < 5 ? 'corr-002' : undefined,
      }));
    }

    // Filter by severity
    const filteredEvents = severityFilter
      ? events.filter(e => e.severity === severityFilter)
      : events;

    // Sort by timestamp (newest first)
    const sorted = [...filteredEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Calculate severity counts
    const severityCounts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const event of events) {
      if (severityCounts[event.severity] !== undefined) {
        severityCounts[event.severity]++;
      }
    }

    // Find correlated events
    const correlationGroups: Record<string, SecurityEvent[]> = {};
    for (const event of events) {
      if (event.correlationId) {
        if (!correlationGroups[event.correlationId]) {
          correlationGroups[event.correlationId] = [];
        }
        correlationGroups[event.correlationId].push(event);
      }
    }

    // Count unacknowledged
    const unacknowledged = events.filter(e => !e.acknowledged && (e.severity === 'critical' || e.severity === 'high')).length;

    return {
      events: sorted.slice(0, maxEvents),
      allEvents: events,
      totalCount: events.length,
      severityCounts,
      correlationGroups,
      unacknowledged,
    };
  }, [data, maxEvents, severityFilter, demoMode]);

  const handleAcknowledge = useCallback(async () => {
    if (!selectedEvent?.id) return;

    setActionState({ status: 'loading', message: 'Acknowledging event...' });

    const result = await acknowledgeSecurityEvent({
      eventId: selectedEvent.id,
      notes: `Acknowledged from Security Events Card`,
    });

    if (result.success) {
      setActionState({ status: 'success', message: 'Event acknowledged' });
      setShowActions(false);
    } else {
      setActionState({ status: 'error', message: result.message });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [selectedEvent]);

  const handleCreateIncident = useCallback(async () => {
    if (!selectedEvent) return;

    setActionState({ status: 'loading', message: 'Creating incident...' });

    const result = await createIncident({
      title: selectedEvent.eventType,
      description: selectedEvent.description,
      priority: selectedEvent.severity === 'critical' ? 'critical' :
               selectedEvent.severity === 'high' ? 'high' :
               selectedEvent.severity === 'medium' ? 'medium' : 'low',
      relatedAlerts: selectedEvent.id ? [selectedEvent.id] : undefined,
    });

    if (result.success) {
      setActionState({ status: 'success', message: 'Incident created' });
      setShowActions(false);
      setSelectedEvent(null);
    } else {
      setActionState({ status: 'error', message: result.message });
    }

    setTimeout(() => setActionState({ status: 'idle' }), 5000);
  }, [selectedEvent]);

  if (!processedData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No security events
      </div>
    );
  }

  // Empty state when no events and demo mode is off
  if (processedData.totalCount === 0 && !demoMode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          No Security Events
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          No events detected in the past 24 hours
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
          Enable Demo Mode to see sample data
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Security Events
            </span>
            {processedData.unacknowledged > 0 && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {processedData.unacknowledged} new
              </span>
            )}
          </div>
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {processedData.totalCount} total
          </span>
        </div>

        {/* Severity filter buttons */}
        <div className="flex gap-1">
          <button
            onClick={() => setSeverityFilter(null)}
            className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
              !severityFilter
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {(['critical', 'high', 'medium', 'low'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
              className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors flex items-center gap-1 ${
                severityFilter === sev
                  ? `${SEVERITY_CONFIG[sev].bg} ${SEVERITY_CONFIG[sev].color}`
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              disabled={processedData.severityCounts[sev] === 0}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: SEVERITY_CONFIG[sev].stroke }}
              />
              {processedData.severityCounts[sev]}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Event Details */}
      {selectedEvent ? (
        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-800">
          {showActions ? (
            <div className="p-3">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-3">
                Actions for: {selectedEvent.eventType}
              </div>

              {/* Action Feedback */}
              {actionState.status !== 'idle' && (
                <div className={`mb-3 px-2 py-1.5 rounded text-[10px] flex items-center gap-2 ${
                  actionState.status === 'loading' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                  actionState.status === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                  'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
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
              <div className="space-y-2">
                {!selectedEvent.acknowledged && (
                  <button
                    onClick={handleAcknowledge}
                    className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Acknowledge
                  </button>
                )}
                {!selectedEvent.incidentId && (
                  <button
                    onClick={handleCreateIncident}
                    className="w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Create Incident
                  </button>
                )}
                <button
                  onClick={() => setShowActions(false)}
                  className="w-full px-3 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 text-xs font-medium rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: SEVERITY_CONFIG[selectedEvent.severity].stroke }}
                  />
                  <span className={`text-xs font-medium ${SEVERITY_CONFIG[selectedEvent.severity].color}`}>
                    {SEVERITY_CONFIG[selectedEvent.severity].label}
                  </span>
                  {selectedEvent.acknowledged && (
                    <span className="px-1.5 py-0.5 text-[8px] font-medium rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      ACK
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-2">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {selectedEvent.eventType}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {selectedEvent.description}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
                <div>
                  <span className="text-slate-500">Time:</span>
                  <span className="ml-1 text-slate-700 dark:text-slate-300">{formatTime(selectedEvent.timestamp)}</span>
                </div>
                {selectedEvent.sourceIp && (
                  <div>
                    <span className="text-slate-500">Source:</span>
                    <span className="ml-1 text-slate-700 dark:text-slate-300 font-mono">{selectedEvent.sourceIp}</span>
                  </div>
                )}
                {selectedEvent.destIp && (
                  <div>
                    <span className="text-slate-500">Dest:</span>
                    <span className="ml-1 text-slate-700 dark:text-slate-300 font-mono">{selectedEvent.destIp}</span>
                  </div>
                )}
                {selectedEvent.protocol && (
                  <div>
                    <span className="text-slate-500">Protocol:</span>
                    <span className="ml-1 text-slate-700 dark:text-slate-300">{selectedEvent.protocol}</span>
                  </div>
                )}
                {selectedEvent.deviceName && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Device:</span>
                    <span className="ml-1 text-slate-700 dark:text-slate-300">{selectedEvent.deviceName}</span>
                  </div>
                )}
              </div>

              {selectedEvent.action && (
                <div className={`mt-2 px-2 py-1 rounded text-[10px] font-medium inline-flex items-center gap-1 ${ACTION_CONFIG[selectedEvent.action].color}`}>
                  <span>{ACTION_CONFIG[selectedEvent.action].icon}</span>
                  {ACTION_CONFIG[selectedEvent.action].label}
                </div>
              )}

              {/* Correlated events */}
              {selectedEvent.correlationId && processedData.correlationGroups[selectedEvent.correlationId]?.length > 1 && (
                <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                  <div className="text-[10px] font-medium text-purple-700 dark:text-purple-300 mb-1">
                    Related Events ({processedData.correlationGroups[selectedEvent.correlationId].length - 1})
                  </div>
                  <div className="space-y-1">
                    {processedData.correlationGroups[selectedEvent.correlationId]
                      .filter(e => e.id !== selectedEvent.id)
                      .slice(0, 2)
                      .map((event, idx) => (
                        <div
                          key={idx}
                          className="text-[9px] text-purple-600 dark:text-purple-400 truncate cursor-pointer hover:underline"
                          onClick={() => setSelectedEvent(event)}
                        >
                          {event.eventType}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowActions(true)}
                className="mt-3 w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Take Action
              </button>
            </div>
          )}
        </div>
      ) : (
        // Event list
        <div className="flex-1 overflow-auto">
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {processedData.events.map((event, idx) => {
              const severityConfig = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.info;
              const actionConfig = event.action ? ACTION_CONFIG[event.action] : null;
              const hasCorrelation = event.correlationId && processedData.correlationGroups[event.correlationId]?.length > 1;

              return (
                <div
                  key={event.id || idx}
                  className="px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex items-start gap-2">
                    {/* Severity indicator */}
                    <div className="relative">
                      <div
                        className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: severityConfig.stroke }}
                      />
                      {event.severity === 'critical' && !event.acknowledged && (
                        <span
                          className="absolute -inset-0.5 rounded-full"
                          style={{ backgroundColor: severityConfig.stroke, opacity: 0.4 }}
                        />
                      )}
                    </div>

                    {/* Event content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                            {event.eventType}
                          </span>
                          {hasCorrelation && (
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[8px] flex items-center justify-center">
                              {processedData.correlationGroups[event.correlationId!].length}
                            </span>
                          )}
                          {event.acknowledged && (
                            <svg className="w-3 h-3 flex-shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                          {formatTimeAgo(event.timestamp)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {event.description}
                      </p>

                      <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500 dark:text-slate-400">
                        {event.sourceIp && (
                          <span className="font-mono">{event.sourceIp}</span>
                        )}
                        {event.sourceIp && event.destIp && (
                          <span>→</span>
                        )}
                        {event.destIp && (
                          <span className="font-mono">{event.destIp}</span>
                        )}
                        {actionConfig && (
                          <span className={`${actionConfig.color} font-medium flex items-center gap-0.5 ml-auto`}>
                            {actionConfig.icon} {actionConfig.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between text-[8px]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_CONFIG.critical.stroke }}></span>
              Crit
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_CONFIG.high.stroke }}></span>
              High
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_CONFIG.medium.stroke }}></span>
              Med
            </span>
          </div>
          <span className="text-slate-400">Click for actions</span>
        </div>
      </div>
    </div>
  );
});

SecurityEventsCard.displayName = 'SecurityEventsCard';

export default SecurityEventsCard;
