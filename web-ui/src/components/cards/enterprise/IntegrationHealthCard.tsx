'use client';

import React from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusSummary, StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import { MetricTile } from '../widgets/MetricTile';
import '../styles/cisco-theme.css';

export interface Integration {
  id: string;
  name: string;
  description: string;
  status: StatusLevel;
  last_sync: string;
  response_time: number;
  requests_24h: number;
  errors_24h: number;
  icon: string;
}

export interface IntegrationHealthData {
  integrations: Integration[];
  summary: Array<{
    status: StatusLevel;
    label: string;
    count: number;
    pulse?: boolean;
  }>;
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    status?: StatusLevel;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
  }>;
}

export interface IntegrationHealthCardProps {
  title?: string;
  pollingInterval?: number;
  initialData?: IntegrationHealthData;
  onIntegrationClick?: (integrationId: string) => void;
  onDataUpdate?: (data: IntegrationHealthData) => void;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

const INTEGRATION_ICONS: Record<string, React.ReactNode> = {
  cloud: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  search: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  eye: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  server: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  brain: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  database: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
};

export function IntegrationHealthCard({
  title = 'Integration Health',
  pollingInterval = 60000,
  initialData,
  onIntegrationClick,
  onDataUpdate,
}: IntegrationHealthCardProps) {
  const endpoint = '/api/cards/integration-health/data';

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<IntegrationHealthData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: IntegrationHealthData };
      return response.data || (raw as IntegrationHealthData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const formatLastSync = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(diff / 60000);

      if (seconds < 60) return `${seconds}s ago`;
      if (minutes < 60) return `${minutes}m ago`;
      return date.toLocaleTimeString();
    } catch {
      return isoString;
    }
  };

  const getIcon = (iconName: string) => {
    return INTEGRATION_ICONS[iconName] || INTEGRATION_ICONS.server;
  };

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load integration health</p>
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
          <p className="enterprise-card-subtitle">
            {data?.integrations?.length || 0} integrations
          </p>
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
            {[...Array(4)].map((_, i) => (
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

            {/* Integration Grid */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data.integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  onClick={() => onIntegrationClick?.(integration.id)}
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `${STATUS_COLORS[integration.status]}15`,
                      color: STATUS_COLORS[integration.status],
                    }}
                  >
                    {getIcon(integration.icon)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{integration.name}</span>
                      <StatusIndicator
                        status={integration.status}
                        size="sm"
                        showLabel={false}
                        pulse={integration.status === 'critical'}
                      />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {integration.description}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-medium">
                      {integration.response_time}ms
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatLastSync(integration.last_sync)}
                    </div>
                  </div>
                </div>
              ))}
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

export default IntegrationHealthCard;
