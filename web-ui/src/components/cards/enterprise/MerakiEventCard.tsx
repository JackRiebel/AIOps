'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusSummary, StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import { MetricTile } from '../widgets/MetricTile';
import '../styles/cisco-theme.css';

export interface MerakiEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  severity: StatusLevel;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface EventType {
  name: string;
  count: number;
  color: string;
}

export interface MerakiEventData {
  events: MerakiEvent[];
  metrics: Array<{
    label: string;
    value: string | number;
    status?: StatusLevel;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
  }>;
  event_types: EventType[];
  filters: string[];
  time_range: string;
}

export interface MerakiEventCardProps {
  networkId: string;
  orgId?: string;
  title?: string;
  pollingInterval?: number;
  maxEvents?: number;
  initialData?: MerakiEventData;
  onEventClick?: (eventId: string) => void;
  onDataUpdate?: (data: MerakiEventData) => void;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

const EVENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  status_change: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  config_change: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  firmware: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  port_change: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  client: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  dhcp: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
};

export function MerakiEventCard({
  networkId,
  orgId,
  title = 'Meraki Events',
  pollingInterval = 10000,
  maxEvents = 10,
  initialData,
  onEventClick,
  onDataUpdate,
}: MerakiEventCardProps) {
  const [filter, setFilter] = useState<string>('all');

  const endpoint = `/api/cards/meraki-events/${networkId}/data${orgId ? `?org_id=${orgId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<MerakiEventData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: MerakiEventData };
      return response.data || (raw as MerakiEventData);
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

  const getEventIcon = (event: MerakiEvent) => {
    const type = event.metadata?.type as string | undefined;
    return type && EVENT_TYPE_ICONS[type] ? EVENT_TYPE_ICONS[type] : (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  const filteredEvents = data?.events?.filter((event) => {
    if (filter === 'all') return true;
    const metadataType = event.metadata?.type as string | undefined;
    return metadataType === filter;
  }).slice(0, maxEvents) || [];

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load Meraki events</p>
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
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-12 rounded" />
              ))}
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {data.metrics.map((metric, i) => (
                  <MetricTile key={i} {...metric} size="sm" />
                ))}
              </div>
            )}

            {/* Event Type Distribution */}
            {data.event_types && data.event_types.length > 0 && (
              <div className="flex gap-1 h-2 rounded overflow-hidden">
                {data.event_types.map((type, i) => (
                  <div
                    key={i}
                    className="transition-all cursor-pointer hover:opacity-80"
                    style={{
                      backgroundColor: type.color,
                      flex: type.count,
                    }}
                    title={`${type.name}: ${type.count}`}
                    onClick={() => setFilter(type.name.toLowerCase().replace(/ /g, '_'))}
                  />
                ))}
              </div>
            )}

            {/* Filter Tabs */}
            {data.filters && data.filters.length > 1 && (
              <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto">
                {data.filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                      filter === f
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}

            {/* Event Timeline */}
            <div className="space-y-0 max-h-[300px] overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No events match the current filter
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
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: `${STATUS_COLORS[event.severity]}20`,
                          color: STATUS_COLORS[event.severity],
                        }}
                      >
                        {getEventIcon(event)}
                      </div>
                      {index < filteredEvents.length - 1 && (
                        <div className="timeline-event-line ml-3" />
                      )}
                    </div>
                    <div className="timeline-event-content">
                      <div className="timeline-event-title">{event.title}</div>
                      {event.description && (
                        <div className="timeline-event-description">
                          {event.description}
                        </div>
                      )}
                      <div className="timeline-event-time">
                        {formatEventTime(event.timestamp)}
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
            pulse={!isPaused}
          />
          <span>{isPaused ? 'Paused' : 'Live'}</span>
        </span>
      </div>
    </div>
  );
}

export default MerakiEventCard;
