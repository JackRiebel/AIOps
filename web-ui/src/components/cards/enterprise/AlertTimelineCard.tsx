'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusSummary, StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import { MetricTile } from '../widgets/MetricTile';
import '../styles/cisco-theme.css';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  severity: StatusLevel;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertTimelineData {
  events: TimelineEvent[];
  summary: Array<{
    status: StatusLevel;
    label: string;
    count: number;
    pulse?: boolean;
  }>;
  metrics: Array<{
    label: string;
    value: string | number;
    status?: StatusLevel;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
  }>;
  filters: string[];
  time_range: string;
}

export interface AlertTimelineCardProps {
  orgId: string;
  networkId?: string;
  title?: string;
  pollingInterval?: number;
  maxEvents?: number;
  initialData?: AlertTimelineData;
  onEventClick?: (eventId: string) => void;
  onDataUpdate?: (data: AlertTimelineData) => void;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

export function AlertTimelineCard({
  orgId,
  networkId,
  title = 'Alert Timeline',
  pollingInterval = 10000,
  maxEvents = 10,
  initialData,
  onEventClick,
  onDataUpdate,
}: AlertTimelineCardProps) {
  const [filter, setFilter] = useState<string>('all');

  const endpoint = `/api/cards/alerts/${orgId}/data${networkId ? `?network_id=${networkId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<AlertTimelineData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: AlertTimelineData };
      return response.data || (raw as AlertTimelineData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const formatEventTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  const filteredEvents = data?.events?.filter((event) => {
    if (filter === 'all') return true;
    return event.severity === filter;
  }).slice(0, maxEvents) || [];

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load alerts</p>
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

  return (
    <div className="enterprise-card">
      {/* Header */}
      <div className="enterprise-card-header">
        <div>
          <h3 className="enterprise-card-title">{title}</h3>
          {data?.time_range && (
            <p className="enterprise-card-subtitle">{data.time_range}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={isPaused ? resume : pause}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
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
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="skeleton h-6 w-16 rounded" />
              <div className="skeleton h-6 w-16 rounded" />
              <div className="skeleton h-6 w-16 rounded" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Summary */}
            {data.summary && <StatusSummary summary={data.summary} />}

            {/* Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {data.metrics.map((metric, i) => (
                  <MetricTile key={i} {...metric} size="sm" />
                ))}
              </div>
            )}

            {/* Filter Tabs */}
            {data.filters && data.filters.length > 1 && (
              <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
                {data.filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      filter === f
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-0 max-h-[300px] overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No alerts match the current filter
                </div>
              ) : (
                filteredEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className="timeline-event cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors"
                    onClick={() => onEventClick?.(event.id)}
                  >
                    <div className="timeline-event-indicator">
                      <div
                        className="timeline-event-dot"
                        style={{ borderColor: STATUS_COLORS[event.severity] }}
                      />
                      {index < filteredEvents.length - 1 && (
                        <div className="timeline-event-line" />
                      )}
                    </div>
                    <div className="timeline-event-content">
                      <div className="timeline-event-title">{event.title}</div>
                      {event.description && (
                        <div className="timeline-event-description">
                          {event.description}
                        </div>
                      )}
                      <div className="timeline-event-time flex items-center gap-2">
                        <span>{formatEventTime(event.timestamp)}</span>
                        {event.source && (
                          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                            {event.source}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
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
            pulse={!isPaused && (data?.summary?.some((s) => s.pulse) ?? false)}
          />
          <span>{isPaused ? 'Paused' : 'Monitoring'}</span>
        </span>
      </div>
    </div>
  );
}

export default AlertTimelineCard;
