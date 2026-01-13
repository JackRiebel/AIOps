'use client';

import React from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusIndicator } from '../widgets/StatusIndicator';
import '../styles/cisco-theme.css';

export interface IncidentEvent {
  id: number;
  source: string;
  event_type: string;
  severity: string;
  title: string;
  description: string;
  timestamp: string;
  affected_resource: string;
}

export interface IncidentData {
  incident: {
    id: number;
    title: string;
    status: string;
    severity: string;
    start_time: string;
    end_time: string | null;
    root_cause_hypothesis: string | null;
    confidence_score: number | null;
    affected_services: string[];
    network_id: string | null;
    network_name: string | null;
  };
  events: IncidentEvent[];
  event_count: number;
  severity_breakdown: Record<string, number>;
}

export interface IncidentDetailCardProps {
  incidentId: number;
  title?: string;
  pollingInterval?: number;
  initialData?: IncidentData;
  onDataUpdate?: (data: IncidentData) => void;
  onViewDetails?: (incidentId: number) => void;
}

const SEVERITY_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  critical: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', label: 'Critical' },
  high: { color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.1)', label: 'High' },
  medium: { color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.1)', label: 'Medium' },
  low: { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)', label: 'Low' },
  info: { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)', label: 'Info' },
};

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  open: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', label: 'Open' },
  investigating: { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)', label: 'Investigating' },
  resolved: { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)', label: 'Resolved' },
  closed: { color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)', label: 'Closed' },
};

export function IncidentDetailCard({
  incidentId,
  title = 'Incident Detail',
  pollingInterval = 30000,
  initialData,
  onDataUpdate,
  onViewDetails,
}: IncidentDetailCardProps) {
  const endpoint = `/api/cards/incident/${incidentId}/data`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<IncidentData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: IncidentData };
      return response.data || (raw as IncidentData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getSeverityConfig = (severity: string) => SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
  const getStatusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.open;

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load incident data</p>
          <button
            onClick={refresh}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const incident = data?.incident;
  const events = data?.events || [];
  const severityConfig = incident ? getSeverityConfig(incident.severity) : getSeverityConfig('info');
  const statusConfig = incident ? getStatusConfig(incident.status) : getStatusConfig('open');

  return (
    <div className="enterprise-card">
      {/* Header */}
      <div className="enterprise-card-header">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="enterprise-card-title truncate">
              {incident ? `Incident #${incident.id}` : title}
            </h3>
            {incident && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase"
                style={{
                  color: severityConfig.color,
                  backgroundColor: severityConfig.bgColor,
                }}
              >
                {incident.severity}
              </span>
            )}
          </div>
          {incident && (
            <p className="enterprise-card-subtitle truncate">{incident.title}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={isPaused ? resume : pause}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            title={isPaused ? 'Resume polling' : 'Pause polling'}
          >
            {isPaused ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
              </svg>
            )}
          </button>
          <button
            onClick={refresh}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh now"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="enterprise-card-body">
        {loading && !data ? (
          <div className="flex flex-col gap-4">
            <div className="skeleton h-8 w-full rounded" />
            <div className="skeleton h-20 w-full rounded" />
            <div className="skeleton h-24 w-full rounded" />
          </div>
        ) : data && incident ? (
          <div className="space-y-4">
            {/* Status & Metrics */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase"
                  style={{
                    color: statusConfig.color,
                    backgroundColor: statusConfig.bgColor,
                    border: `1px solid ${statusConfig.color}40`,
                  }}
                >
                  {incident.status}
                </span>
                {incident.network_name && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {incident.network_name}
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {data.event_count} events
                </div>
                {incident.confidence_score && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {incident.confidence_score}% confidence
                  </div>
                )}
              </div>
            </div>

            {/* Hypothesis */}
            {incident.root_cause_hypothesis && (
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700/50">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">
                    AI Hypothesis
                  </span>
                </div>
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  {incident.root_cause_hypothesis}
                </p>
              </div>
            )}

            {/* Affected Services */}
            {incident.affected_services && incident.affected_services.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Affected Services
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {incident.affected_services.slice(0, 5).map((service, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {service}
                    </span>
                  ))}
                  {incident.affected_services.length > 5 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">
                      +{incident.affected_services.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Recent Events */}
            {events.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Recent Events
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {events.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-800/30 rounded text-sm"
                    >
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: getSeverityConfig(event.severity).color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-gray-900 dark:text-white">
                          {event.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTimestamp(event.timestamp)} - {event.source}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View Full Details Button */}
            {onViewDetails && (
              <button
                onClick={() => onViewDetails(incident.id)}
                className="w-full py-2 text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 border border-cyan-200 dark:border-cyan-700 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
              >
                View Full Details
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="enterprise-card-footer">
        <span>Last updated: {formatTime(lastUpdated)}</span>
        <span className="flex items-center gap-1">
          <StatusIndicator
            status={isPaused ? 'offline' : 'healthy'}
            size="sm"
            showLabel={false}
          />
          <span>{isPaused ? 'Paused' : 'Live'}</span>
        </span>
      </div>
    </div>
  );
}

export default IncidentDetailCard;
