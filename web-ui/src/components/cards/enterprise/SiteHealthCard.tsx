'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusSummary, StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import { MetricTile } from '../widgets/MetricTile';
import '../styles/cisco-theme.css';

export interface Site {
  id: string;
  name: string;
  location: string;
  health_score: number;
  status: StatusLevel;
  devices: number;
  clients: number;
  alerts: number;
}

export interface SiteHealthData {
  sites: Site[];
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
  worst_sites: Site[];
  total_clients: number;
}

export interface SiteHealthCardProps {
  orgId: string;
  title?: string;
  pollingInterval?: number;
  initialData?: SiteHealthData;
  onSiteClick?: (siteId: string) => void;
  onDataUpdate?: (data: SiteHealthData) => void;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

export function SiteHealthCard({
  orgId,
  title = 'Site Health',
  pollingInterval = 30000,
  initialData,
  onSiteClick,
  onDataUpdate,
}: SiteHealthCardProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const endpoint = `/api/cards/site-health/${orgId}/data`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<SiteHealthData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: SiteHealthData };
      return response.data || (raw as SiteHealthData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return STATUS_COLORS.healthy;
    if (score >= 60) return STATUS_COLORS.warning;
    return STATUS_COLORS.critical;
  };

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load site health</p>
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
            {data?.sites?.length || 0} sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          >
            {viewMode === 'grid' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            )}
          </button>
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
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-20 rounded" />
              ))}
            </div>
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

            {/* Sites Grid/List */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {data.sites.map((site) => (
                  <div
                    key={site.id}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    onClick={() => onSiteClick?.(site.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[site.status] }}
                      />
                      <span
                        className="text-lg font-bold"
                        style={{ color: getHealthColor(site.health_score) }}
                      >
                        {site.health_score}%
                      </span>
                    </div>
                    <div className="text-sm font-medium truncate" title={site.name}>
                      {site.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {site.location}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{site.devices} devices</span>
                      <span>|</span>
                      <span>{site.clients} clients</span>
                    </div>
                    {site.alerts > 0 && (
                      <div className="mt-1 text-xs text-red-500 dark:text-red-400">
                        {site.alerts} alerts
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {data.sites.map((site) => (
                  <div
                    key={site.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => onSiteClick?.(site.id)}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[site.status] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{site.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {site.location}
                      </div>
                    </div>
                    <span
                      className="text-sm font-bold"
                      style={{ color: getHealthColor(site.health_score) }}
                    >
                      {site.health_score}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Worst Sites Alert */}
            {data.worst_sites && data.worst_sites.length > 0 && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                  Needs Attention
                </div>
                {data.worst_sites.slice(0, 2).map((site) => (
                  <div
                    key={site.id}
                    className="text-sm cursor-pointer hover:underline"
                    onClick={() => onSiteClick?.(site.id)}
                  >
                    {site.name} ({site.health_score}%)
                  </div>
                ))}
              </div>
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
            pulse={!isPaused && (data?.summary?.some((s) => s.pulse) ?? false)}
          />
          <span>{isPaused ? 'Paused' : 'Live'}</span>
        </span>
      </div>
    </div>
  );
}

export default SiteHealthCard;
