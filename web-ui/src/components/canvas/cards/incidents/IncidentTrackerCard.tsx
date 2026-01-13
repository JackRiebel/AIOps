'use client';

import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { executeCardAction, type ActionState } from '@/services/cardActions';

interface TimelineEvent {
  timestamp: string;
  action: string;
  user?: string;
}

interface Incident {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  statusChangedAt?: string;
  assignee?: string;
  affectedDevices?: number;
  affectedNetworks?: string[];
  rootCause?: string;
  timeline?: TimelineEvent[];
}

interface IncidentTrackerCardData {
  incidents?: Incident[];
  organizationId?: string;
  networkId?: string;
}

interface IncidentTrackerCardProps {
  data: IncidentTrackerCardData;
  config?: {
    showResolved?: boolean;
  };
}

type StatusKey = 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
type PriorityKey = 'critical' | 'high' | 'medium' | 'low';

const STATUS_ORDER: StatusKey[] = ['open', 'investigating', 'identified', 'monitoring', 'resolved'];

const STATUS_CONFIG: Record<StatusKey, { label: string; color: string; bg: string; border: string; fill: string }> = {
  open: {
    label: 'Open',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-100 dark:bg-red-900/40',
    border: 'border-red-300 dark:border-red-700',
    fill: '#ef4444'
  },
  investigating: {
    label: 'Investigating',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    border: 'border-orange-300 dark:border-orange-700',
    fill: '#f97316'
  },
  identified: {
    label: 'Identified',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    border: 'border-amber-300 dark:border-amber-700',
    fill: '#f59e0b'
  },
  monitoring: {
    label: 'Monitoring',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    border: 'border-blue-300 dark:border-blue-700',
    fill: '#3b82f6'
  },
  resolved: {
    label: 'Resolved',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    border: 'border-emerald-300 dark:border-emerald-700',
    fill: '#10b981'
  },
};

const PRIORITY_CONFIG: Record<PriorityKey, { label: string; color: string; bg: string; glow: string }> = {
  critical: {
    label: 'P1',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-100 dark:bg-red-900/40',
    glow: 'shadow-red-500/50'
  },
  high: {
    label: 'P2',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    glow: 'shadow-orange-500/50'
  },
  medium: {
    label: 'P3',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    glow: ''
  },
  low: {
    label: 'P4',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-700',
    glow: ''
  },
};

// Generate avatar colors based on name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500',
    'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500',
    'bg-orange-500', 'bg-teal-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDuration(start: string, end?: string): string {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffMs = endTime - startTime;

  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatShortTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * IncidentTrackerCard - Interactive Kanban-style incident tracker
 *
 * Features:
 * - Drag-and-drop between status columns
 * - Real-time timer showing time in current state
 * - Assignee avatars with quick reassign
 * - Incident detail panel with timeline
 * - Priority-based visual indicators
 */
export const IncidentTrackerCard = memo(({ data, config }: IncidentTrackerCardProps) => {
  const showResolved = config?.showResolved ?? false;
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [draggedIncident, setDraggedIncident] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<StatusKey | null>(null);
  const [, setTick] = useState(0);
  const { demoMode } = useDemoMode();
  const [actionState, setActionState] = useState<ActionState>({ status: 'idle' });

  // Update timers every minute
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const processedData = useMemo(() => {
    let incidents: Incident[];

    if (demoMode && (!data?.incidents || data.incidents.length === 0)) {
      // Generate demo incidents when no data available and demo mode is on
      const now = new Date();
      incidents = [
        {
          id: 'demo-1',
          title: 'High latency on WAN uplink',
          description: 'Intermittent latency spikes affecting branch office connectivity',
          status: 'investigating',
          priority: 'high',
          createdAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
          statusChangedAt: new Date(now.getTime() - 1800000).toISOString(),
          assignee: 'Alex Chen',
          affectedDevices: 3,
          affectedNetworks: ['Branch-Office-1'],
        },
        {
          id: 'demo-2',
          title: 'AP offline - Conference Room B',
          description: 'Access point not responding to health checks',
          status: 'open',
          priority: 'medium',
          createdAt: new Date(now.getTime() - 45 * 60000).toISOString(),
          affectedDevices: 1,
          affectedNetworks: ['HQ-Wireless'],
        },
        {
          id: 'demo-3',
          title: 'Switch port errors detected',
          description: 'CRC errors on multiple ports indicating cable issues',
          status: 'identified',
          priority: 'low',
          createdAt: new Date(now.getTime() - 6 * 3600000).toISOString(),
          statusChangedAt: new Date(now.getTime() - 3600000).toISOString(),
          assignee: 'Jordan Lee',
          affectedDevices: 1,
          rootCause: 'Faulty patch cable on port Gi1/0/24',
        },
        {
          id: 'demo-4',
          title: 'DHCP pool exhaustion warning',
          description: 'Guest VLAN approaching 90% address utilization',
          status: 'monitoring',
          priority: 'medium',
          createdAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
          statusChangedAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
          assignee: 'Sam Taylor',
          affectedNetworks: ['Guest-Network'],
        },
      ];
    } else if (data?.incidents && data.incidents.length > 0) {
      incidents = [...data.incidents];
    } else {
      // No data and demo mode is off
      return null;
    }
    if (!showResolved) {
      incidents = incidents.filter(i => i.status !== 'resolved');
    }

    // Group by status
    const byStatus: Record<StatusKey, Incident[]> = {
      open: [],
      investigating: [],
      identified: [],
      monitoring: [],
      resolved: [],
    };

    for (const incident of incidents) {
      if (byStatus[incident.status]) {
        byStatus[incident.status].push(incident);
      }
    }

    // Sort each group by priority then by created date
    const priorityOrder: PriorityKey[] = ['critical', 'high', 'medium', 'low'];
    for (const status of Object.keys(byStatus) as StatusKey[]) {
      byStatus[status].sort((a, b) => {
        const priorityDiff = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    // Calculate stats
    const openCount = incidents.filter(i => i.status === 'open').length;
    const criticalCount = incidents.filter(i => i.priority === 'critical' && i.status !== 'resolved').length;
    const activeCount = incidents.filter(i => i.status !== 'resolved').length;
    const avgResolutionTime = incidents
      .filter(i => i.status === 'resolved' && i.resolvedAt)
      .reduce((acc, i) => {
        const duration = new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime();
        return acc + duration;
      }, 0) / (incidents.filter(i => i.status === 'resolved').length || 1);

    return {
      byStatus,
      total: incidents.length,
      openCount,
      criticalCount,
      activeCount,
      avgResolutionTime,
    };
  }, [data, showResolved, demoMode]);

  const handleDragStart = useCallback((incidentId: string) => {
    setDraggedIncident(incidentId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: StatusKey) => {
    e.preventDefault();
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(async (newStatus: StatusKey) => {
    if (draggedIncident) {
      setActionState({ status: 'loading', message: 'Updating status...' });
      try {
        const response = await fetch(`/api/incidents/${draggedIncident}/status?status=${newStatus}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          setActionState({ status: 'success', message: `Moved to ${newStatus}` });
        } else {
          setActionState({ status: 'error', message: 'Failed to update status' });
        }
      } catch {
        setActionState({ status: 'error', message: 'Failed to update status' });
      }
      setTimeout(() => setActionState({ status: 'idle' }), 3000);
    }
    setDraggedIncident(null);
    setDragOverColumn(null);
  }, [draggedIncident]);

  const handleAction = useCallback(async (action: string, incident: Incident) => {
    setActionState({ status: 'loading', message: `Executing ${action}...` });
    try {
      switch (action) {
        case 'create': {
          const createResponse = await fetch('/api/incidents', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'New Incident',
              description: 'Manually created incident',
              severity: 'medium',
            }),
          });

          if (!createResponse.ok) {
            setActionState({ status: 'error', message: 'Failed to create incident' });
            setTimeout(() => setActionState({ status: 'idle' }), 5000);
            return;
          }

          setActionState({ status: 'success', message: 'Incident created' });
          setTimeout(() => setActionState({ status: 'idle' }), 3000);
          return;
        }

        case 'reassign': {
          if (!incident?.id) {
            setActionState({ status: 'error', message: 'No incident selected' });
            setTimeout(() => setActionState({ status: 'idle' }), 5000);
            return;
          }

          const reassignResponse = await fetch(`/api/incidents/${incident.id}/reassign?assignee=`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!reassignResponse.ok) {
            setActionState({ status: 'error', message: 'Failed to reassign' });
            setTimeout(() => setActionState({ status: 'idle' }), 5000);
            return;
          }

          setActionState({ status: 'success', message: 'Incident reassigned' });
          setTimeout(() => setActionState({ status: 'idle' }), 3000);
          return;
        }

        case 'resolve':
        case 'escalate': {
          if (!incident?.id) {
            setActionState({ status: 'error', message: 'No incident selected' });
            setTimeout(() => setActionState({ status: 'idle' }), 5000);
            return;
          }

          const newStatus = action === 'resolve' ? 'resolved' : 'investigating';
          const statusResponse = await fetch(`/api/incidents/${incident.id}/status?status=${newStatus}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!statusResponse.ok) {
            setActionState({ status: 'error', message: 'Failed to update status' });
            setTimeout(() => setActionState({ status: 'idle' }), 5000);
            return;
          }

          setActionState({ status: 'success', message: action === 'resolve' ? 'Incident resolved' : 'Incident escalated' });
          setTimeout(() => setActionState({ status: 'idle' }), 3000);
          return;
        }

        default:
          setActionState({ status: 'error', message: 'Unknown action' });
          setTimeout(() => setActionState({ status: 'idle' }), 5000);
      }
    } catch {
      setActionState({ status: 'error', message: 'Action failed' });
      setTimeout(() => setActionState({ status: 'idle' }), 5000);
    }
  }, []);

  if (!processedData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
        <svg className="w-12 h-12 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <span className="text-sm">No incidents to track</span>
        <button
          onClick={() => handleAction('create', {} as Incident)}
          className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Create Incident
        </button>
      </div>
    );
  }

  // When an incident is selected, show detail panel
  if (selectedIncident) {
    const statusConfig = STATUS_CONFIG[selectedIncident.status];
    const priorityConfig = PRIORITY_CONFIG[selectedIncident.priority];
    const statusIndex = STATUS_ORDER.indexOf(selectedIncident.status);
    const progress = ((statusIndex + 1) / STATUS_ORDER.length) * 100;

    return (
      <div className="h-full flex flex-col">
        {/* Header with back button */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIncident(null)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${priorityConfig.bg} ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
              {selectedIncident.title}
            </span>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-1">
            {STATUS_ORDER.slice(0, -1).map((status, idx) => (
              <div key={status} className="flex items-center">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold
                    ${idx <= statusIndex
                      ? `${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].color}`
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}
                >
                  {idx < statusIndex ? '✓' : idx + 1}
                </div>
                {idx < STATUS_ORDER.length - 2 && (
                  <div className={`w-8 h-0.5 mx-0.5 ${idx < statusIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{
                width: `${progress}%`,
                backgroundColor: statusConfig.fill
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className={`text-[9px] font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">
              ⏱️ {formatDuration(selectedIncident.statusChangedAt || selectedIncident.createdAt)} in this state
            </span>
          </div>
        </div>

        {/* Incident details */}
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {/* Assignee */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Assignee</span>
            {selectedIncident.assignee ? (
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full ${getAvatarColor(selectedIncident.assignee)} flex items-center justify-center`}>
                  <span className="text-[9px] font-bold text-white">{getInitials(selectedIncident.assignee)}</span>
                </div>
                <span className="text-xs text-slate-700 dark:text-slate-300">{selectedIncident.assignee}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">Unassigned</span>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Duration</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {formatDuration(selectedIncident.createdAt, selectedIncident.resolvedAt)}
              </div>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">Affected</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                {selectedIncident.affectedDevices || 0} devices
              </div>
            </div>
          </div>

          {/* Description */}
          {selectedIncident.description && (
            <div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">Description</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{selectedIncident.description}</p>
            </div>
          )}

          {/* Root Cause */}
          {selectedIncident.rootCause && (
            <div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-1">Root Cause</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{selectedIncident.rootCause}</p>
            </div>
          )}

          {/* Timeline */}
          {selectedIncident.timeline && selectedIncident.timeline.length > 0 && (
            <div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase mb-2">Timeline</div>
              <div className="space-y-2">
                {selectedIncident.timeline.slice(0, 5).map((event, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full bg-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-slate-600 dark:text-slate-400">{event.action}</div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500">
                        {formatShortTime(event.timestamp)}
                        {event.user && ` • ${event.user}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 dark:border-slate-700 flex gap-2">
          <button
            onClick={() => handleAction('reassign', selectedIncident)}
            className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Reassign
          </button>
          <button
            onClick={() => handleAction('escalate', selectedIncident)}
            className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/60 transition-colors"
          >
            Escalate
          </button>
          {selectedIncident.status !== 'resolved' && (
            <button
              onClick={() => handleAction('resolve', selectedIncident)}
              className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    );
  }

  // Main Kanban view
  const displayStatuses = showResolved ? STATUS_ORDER : STATUS_ORDER.slice(0, -1);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Incident Tracker
          </span>
          <div className="flex items-center gap-2">
            {processedData.criticalCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                {processedData.criticalCount} critical
              </span>
            )}
            <button
              onClick={() => handleAction('create', {} as Incident)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
              title="Create Incident"
            >
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-red-600 dark:text-red-400">{processedData.openCount}</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">open</span>
          </div>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{processedData.activeCount}</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">active</span>
          </div>
          <div className="flex-1" />
          <div className="text-[9px] text-slate-500 dark:text-slate-400">
            Avg resolution: {formatDuration('2024-01-01', new Date(Date.now() - processedData.avgResolutionTime).toISOString())}
          </div>
        </div>
      </div>

      {/* Action Feedback */}
      {actionState.status !== 'idle' && (
        <div className={`flex-shrink-0 px-3 py-1.5 flex items-center gap-2 text-xs ${
          actionState.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
          actionState.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' :
          'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {actionState.status === 'loading' && (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {actionState.status === 'success' && (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
          {actionState.status === 'error' && (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{actionState.message}</span>
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex-1 overflow-auto p-2">
        <div className="flex gap-2 h-full min-w-max">
          {displayStatuses.map((status) => {
            const incidents = processedData.byStatus[status];
            const statusConfig = STATUS_CONFIG[status];
            const isDropTarget = dragOverColumn === status;

            return (
              <div
                key={status}
                className={`w-44 flex-shrink-0 flex flex-col rounded-lg transition-all duration-200
                  ${isDropTarget ? `ring-2 ring-offset-2 ring-${status === 'resolved' ? 'emerald' : 'blue'}-500` : ''}`}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(status)}
              >
                {/* Column header */}
                <div className={`px-2 py-1.5 rounded-t-lg ${statusConfig.bg} border ${statusConfig.border} border-b-0`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                      {incidents.length}
                    </span>
                  </div>
                </div>

                {/* Incident cards */}
                <div className={`flex-1 overflow-auto rounded-b-lg p-1.5 space-y-1.5 border ${statusConfig.border} border-t-0 bg-slate-50/50 dark:bg-slate-900/30`}>
                  {incidents.slice(0, 6).map((incident) => {
                    const priorityConfig = PRIORITY_CONFIG[incident.priority];
                    const isCritical = incident.priority === 'critical';
                    const isDragging = draggedIncident === incident.id;

                    return (
                      <div
                        key={incident.id}
                        draggable
                        onDragStart={() => handleDragStart(incident.id)}
                        onDragEnd={() => setDraggedIncident(null)}
                        onClick={() => setSelectedIncident(incident)}
                        className={`p-2 bg-white dark:bg-slate-800 rounded-lg border cursor-pointer
                          transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
                          ${isDragging ? 'opacity-50 scale-95' : ''}
                          ${isCritical
                            ? 'border-red-300 dark:border-red-700 shadow-sm shadow-red-500/20'
                            : 'border-slate-200 dark:border-slate-700'}`}
                      >
                        {/* Priority + Title */}
                        <div className="flex items-start gap-1.5">
                          <span className={`flex-shrink-0 px-1 py-0.5 text-[8px] font-bold rounded ${priorityConfig.bg} ${priorityConfig.color}`}>
                            {priorityConfig.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 line-clamp-2 leading-tight">
                              {incident.title}
                            </div>
                          </div>
                        </div>

                        {/* Timer + Stats */}
                        <div className="mt-1.5 flex items-center justify-between">
                          <div className={`flex items-center gap-1 text-[9px] tabular-nums
                            ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                            {formatDuration(incident.statusChangedAt || incident.createdAt)}
                          </div>
                          {incident.affectedDevices !== undefined && incident.affectedDevices > 0 && (
                            <span className="text-[9px] text-slate-400 dark:text-slate-500">
                              {incident.affectedDevices} devices
                            </span>
                          )}
                        </div>

                        {/* Assignee avatar */}
                        {incident.assignee && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <div className={`w-4 h-4 rounded-full ${getAvatarColor(incident.assignee)} flex items-center justify-center`}>
                              <span className="text-[7px] font-bold text-white">{getInitials(incident.assignee)}</span>
                            </div>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate">
                              {incident.assignee}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {incidents.length > 6 && (
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 text-center py-1 bg-white/50 dark:bg-slate-800/50 rounded">
                      +{incidents.length - 6} more
                    </div>
                  )}

                  {incidents.length === 0 && (
                    <div className="text-[9px] text-slate-400 dark:text-slate-500 text-center py-6">
                      No incidents
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag hint */}
      {draggedIncident && (
        <div className="flex-shrink-0 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-center">
          <span className="text-[9px] text-blue-600 dark:text-blue-400">
            Drag to change status
          </span>
        </div>
      )}
    </div>
  );
});

IncidentTrackerCard.displayName = 'IncidentTrackerCard';

export default IncidentTrackerCard;
