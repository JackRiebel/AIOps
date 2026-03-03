'use client';

import { memo, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  Lightbulb,
  ChevronRight,
  Search,
  X,
  Check,
  ArrowLeft,
  Archive,
  RefreshCw,
  MousePointer,
  Network,
  ChevronDown,
  Settings,
  ExternalLink,
  Zap,
  Clock,
} from 'lucide-react';
import { DashboardCard } from '@/components/dashboard';
import { WorkflowProgress, type WorkflowStatus } from './WorkflowProgress';
import { EventTimelineItem } from './EventTimelineItem';
import { PostMortemButton } from './PostMortemButton';
import { AIFeedbackControl } from './AIFeedbackControl';
import type { Incident, Event } from './index';

// ============================================================================
// Types
// ============================================================================

export interface IncidentDetailPanelProps {
  incident: Incident | null;
  events: Event[];
  onUpdateStatus: (id: number, status: string) => void;
  onAskAI: () => void;
  formatTimestamp: (timestamp: string) => string;
  className?: string;
}

// ============================================================================
// StatusBadge Component
// ============================================================================

function StatusBadge({ status }: { status: WorkflowStatus }) {
  const config: Record<WorkflowStatus, string> = {
    open: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/40',
    investigating: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-200 dark:border-amber-500/40',
    resolved: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40',
    closed: 'bg-slate-200 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-500/40',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${config[status]}`}>
      {status}
    </span>
  );
}

// ============================================================================
// AICostBanner Component
// ============================================================================

function AICostBanner({ events }: { events: Event[] }) {
  const { totalCost, totalTokens } = useMemo(() => {
    const cost = events.reduce((sum, e) => sum + (e.ai_cost || 0), 0);
    const tokens = events.reduce((sum, e) => sum + (e.token_count || 0), 0);
    return { totalCost: cost, totalTokens: tokens };
  }, [events]);

  if (totalCost === 0 && totalTokens === 0) return null;

  return (
    <div className="p-3 bg-gradient-to-r from-purple-50 dark:from-purple-500/10 to-cyan-50 dark:to-cyan-500/10 rounded-lg border border-purple-200 dark:border-purple-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">AI Analysis</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 dark:text-slate-500 uppercase">Cost</div>
            <div className="text-sm font-bold text-purple-600 dark:text-purple-300">${totalCost.toFixed(4)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 dark:text-slate-500 uppercase">Tokens</div>
            <div className="text-sm font-bold text-cyan-600 dark:text-cyan-300">{totalTokens.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AISessionLink Component
// ============================================================================

function AISessionLink({ incident }: { incident: Incident }) {
  if (!incident.ai_assisted || !incident.ai_session_id) return null;

  // Format time saved
  const formatTimeSaved = (seconds: number) => {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.round((seconds % 3600) / 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (seconds >= 60) {
      return `${Math.round(seconds / 60)}m`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            AI-Assisted Resolution
          </span>
        </div>
        {incident.ai_time_saved_seconds && incident.ai_time_saved_seconds > 0 && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Clock className="w-3 h-3" />
            ~{formatTimeSaved(incident.ai_time_saved_seconds)} saved
          </div>
        )}
      </div>
      <Link
        href={`/chat-v2?session=${incident.ai_session_id}`}
        className="mt-2 flex items-center justify-between px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 rounded-lg transition-colors group"
      >
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          View AI Session
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

// ============================================================================
// TransitionButton Component
// ============================================================================

function TransitionButton({
  onClick,
  icon: Icon,
  label,
  variant = 'default',
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  variant?: 'amber' | 'emerald' | 'red' | 'slate' | 'default';
}) {
  const variants: Record<string, string> = {
    amber: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 hover:border-amber-500/50 text-amber-600 dark:text-amber-300',
    emerald: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-500/50 text-emerald-600 dark:text-emerald-300',
    red: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/50 text-red-600 dark:text-red-300',
    slate: 'bg-slate-500/10 hover:bg-slate-500/20 border-slate-500/30 hover:border-slate-500/50 text-slate-600 dark:text-slate-400',
    default: 'bg-slate-700/30 hover:bg-slate-700/50 border-slate-600/30 hover:border-slate-600/50 text-slate-500 dark:text-slate-400',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${variants[variant]}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ============================================================================
// CaseManagement Component
// ============================================================================

function CaseManagement({
  incident,
  onUpdateStatus,
}: {
  incident: Incident;
  onUpdateStatus: (id: number, status: string) => void;
}) {
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider">
          Case Management
        </h3>
        <StatusBadge status={incident.status as WorkflowStatus} />
      </div>

      {/* Workflow Progress */}
      <WorkflowProgress currentStatus={incident.status as WorkflowStatus} className="mb-4" />

      {/* Transition Actions */}
      <div className="border-t border-slate-200 dark:border-slate-700/50 pt-3">
        <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">
          Transition to:
        </p>
        <div className="flex flex-wrap gap-2">
          {incident.status === 'open' && (
            <>
              <TransitionButton
                onClick={() => onUpdateStatus(incident.id, 'investigating')}
                icon={Search}
                label="Start Investigation"
                variant="amber"
              />
              <TransitionButton
                onClick={() => onUpdateStatus(incident.id, 'closed')}
                icon={X}
                label="Close (False Positive)"
                variant="slate"
              />
            </>
          )}
          {incident.status === 'investigating' && (
            <>
              <TransitionButton
                onClick={() => onUpdateStatus(incident.id, 'resolved')}
                icon={Check}
                label="Mark Resolved"
                variant="emerald"
              />
              <TransitionButton
                onClick={() => onUpdateStatus(incident.id, 'open')}
                icon={ArrowLeft}
                label="Re-open"
                variant="slate"
              />
            </>
          )}
          {incident.status === 'resolved' && (
            <>
              <TransitionButton
                onClick={() => onUpdateStatus(incident.id, 'closed')}
                icon={Archive}
                label="Archive Case"
                variant="slate"
              />
              <TransitionButton
                onClick={() => onUpdateStatus(incident.id, 'investigating')}
                icon={RefreshCw}
                label="Re-investigate"
                variant="slate"
              />
            </>
          )}
          {incident.status === 'closed' && (
            <TransitionButton
              onClick={() => onUpdateStatus(incident.id, 'open')}
              icon={RefreshCw}
              label="Re-open Case"
              variant="red"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NetworkInfoBox Component
// ============================================================================

function NetworkInfoBox({ incident }: { incident: Incident }) {
  if (!incident.network_name) return null;

  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/20">
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Network: {incident.network_name}
        </span>
      </div>
      {incident.network_id && (
        <span className="text-xs text-blue-500 dark:text-blue-400 mt-1 block ml-6">
          ID: {incident.network_id}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// DeviceConfigPanel Component
// ============================================================================

function DeviceConfigPanel({ config }: { config: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!config || Object.keys(config).length === 0) return null;

  const hasDeviceInfo = !!config.device_info;
  const hasRadioSettings = !!config.radio_settings;
  const hasChannelUtil = !!config.channel_utilization;
  const hasRfProfiles = !!config.rf_profiles;
  const hasEnabledSsids = !!config.enabled_ssids;
  const hasPortStatuses = !!config.port_statuses;
  const hasUplinkSettings = !!config.uplink_settings;

  return (
    <div className="border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
            Device Configuration Context
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Device Info */}
          {hasDeviceInfo && (
            <ConfigSection title="Device Info" data={config.device_info} />
          )}

          {/* Radio Settings */}
          {hasRadioSettings && (
            <ConfigSection title="Radio Settings" data={config.radio_settings} />
          )}

          {/* RF Profiles */}
          {hasRfProfiles && (
            <ConfigSection title="RF Profiles" data={config.rf_profiles} />
          )}

          {/* Channel Utilization */}
          {hasChannelUtil && (
            <ConfigSection title="Channel Utilization (Recent)" data={config.channel_utilization} />
          )}

          {/* SSIDs */}
          {hasEnabledSsids && (
            <ConfigSection title="Enabled SSIDs" data={config.enabled_ssids} />
          )}

          {/* Port Statuses */}
          {hasPortStatuses && (
            <ConfigSection title="Port Statuses" data={config.port_statuses} />
          )}

          {/* Uplink Settings */}
          {hasUplinkSettings && (
            <ConfigSection title="Uplink Settings" data={config.uplink_settings} />
          )}
        </div>
      )}
    </div>
  );
}

function ConfigSection({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2 border border-slate-200 dark:border-slate-700/30">
      <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
        {title}
      </span>
      <pre className="text-xs text-slate-600 dark:text-slate-400 overflow-x-auto max-h-32 overflow-y-auto custom-scrollbar">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ============================================================================
// EmptyState Component
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-16 h-16 mb-4 bg-cyan-100 dark:bg-cyan-500/10 rounded-full flex items-center justify-center">
        <MousePointer className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
        Select an Incident
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
        Click any incident to view details and take action
      </p>
    </div>
  );
}

// ============================================================================
// IncidentDetailPanel Component
// ============================================================================

export const IncidentDetailPanel = memo(({
  incident,
  events,
  onUpdateStatus,
  onAskAI,
  formatTimestamp,
  className = '',
}: IncidentDetailPanelProps) => {
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);

  return (
    <div className={`xl:sticky xl:top-8 ${className}`}>
      <DashboardCard
        title="Incident Details"
        icon={<FileText className="w-4 h-4" />}
        accent="cyan"
      >
        {incident ? (
          <div className="space-y-4">
            {/* Network Info */}
            <NetworkInfoBox incident={incident} />

            {/* AI Session Link - shows if incident was AI-assisted */}
            <AISessionLink incident={incident} />

            {/* AI Cost Banner */}
            <AICostBanner events={events} />

            {/* AI Feedback - show when incident was AI-assisted */}
            {incident.ai_assisted && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <AIFeedbackControl
                  incidentId={incident.id}
                  className="w-full"
                />
              </div>
            )}

            {/* Device Configuration Context */}
            <DeviceConfigPanel config={incident.device_config} />

            {/* Ask AI Button */}
            <button
              onClick={onAskAI}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-purple-500/30 flex items-center justify-between px-4 py-3.5 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-sm">Ask AI</div>
                  <div className="text-xs text-white/70">Analyze this incident</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/70 group-hover:translate-x-0.5 transition" />
            </button>

            {/* Post-Mortem Report - show for resolved/closed incidents */}
            {(incident.status === 'resolved' || incident.status === 'closed') && (
              <PostMortemButton
                incidentId={incident.id}
                incidentTitle={incident.title}
                className="w-full justify-center"
              />
            )}

            {/* Case Management */}
            <CaseManagement incident={incident} onUpdateStatus={onUpdateStatus} />

            {/* Event Timeline */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-3">
                Event Timeline ({events.length} events)
              </h3>
              <div className="max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                {events.map((event, index) => (
                  <EventTimelineItem
                    key={event.id}
                    event={event}
                    isExpanded={expandedEventId === event.id}
                    isLast={index === events.length - 1}
                    onToggle={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                    formatTimestamp={formatTimestamp}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </DashboardCard>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.4);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.6);
        }
      `}</style>
    </div>
  );
});

IncidentDetailPanel.displayName = 'IncidentDetailPanel';

export default IncidentDetailPanel;
