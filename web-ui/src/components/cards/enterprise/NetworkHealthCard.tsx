'use client';

import React from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { HealthGauge, GaugeGrid } from '../widgets/HealthGauge';
import { MetricGrid } from '../widgets/MetricTile';
import { StatusIndicator } from '../widgets/StatusIndicator';
import '../styles/cisco-theme.css';

export interface NetworkHealthData {
  overall: {
    value: number;
    label: string;
    trend?: 'up' | 'down' | 'stable';
  };
  categories: Array<{
    value: number;
    label: string;
    trend?: 'up' | 'down' | 'stable';
  }>;
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
    status?: 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';
    sparkline?: number[];
  }>;
  summary: {
    status: string;
    message: string;
    last_incident?: string | null;
  };
}

export interface NetworkHealthCardProps {
  networkId: string;
  orgId?: string;
  title?: string;
  pollingInterval?: number;
  initialData?: NetworkHealthData;
  onDataUpdate?: (data: NetworkHealthData) => void;
}

export function NetworkHealthCard({
  networkId,
  orgId,
  title = 'Network Health',
  pollingInterval = 30000,
  initialData,
  onDataUpdate,
}: NetworkHealthCardProps) {
  const endpoint = `/api/cards/network-health/${networkId}/data${orgId ? `?org_id=${orgId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<NetworkHealthData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: NetworkHealthData };
      return response.data || (raw as NetworkHealthData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'var(--status-healthy)';
      case 'warning': return 'var(--status-warning)';
      case 'critical': return 'var(--status-critical)';
      default: return 'var(--text-secondary)';
    }
  };

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load health data</p>
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
          {data?.summary && (
            <p className="enterprise-card-subtitle" style={{ color: getStatusColor(data.summary.status) }}>
              {data.summary.message}
            </p>
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
            <div className="skeleton h-24 w-24 mx-auto rounded-full" />
            <div className="grid grid-cols-3 gap-4">
              <div className="skeleton h-16 rounded" />
              <div className="skeleton h-16 rounded" />
              <div className="skeleton h-16 rounded" />
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Overall Health Gauge */}
            <div className="flex justify-center">
              <HealthGauge
                value={data.overall.value}
                label={data.overall.label}
                trend={data.overall.trend}
                size="lg"
              />
            </div>

            {/* Category Gauges */}
            {data.categories && data.categories.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <GaugeGrid gauges={data.categories} size="sm" columns={data.categories.length} />
              </div>
            )}

            {/* Key Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <MetricGrid metrics={data.metrics} columns={Math.min(4, data.metrics.length)} size="sm" />
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
          />
          <span>{isPaused ? 'Paused' : 'Live'}</span>
        </span>
      </div>
    </div>
  );
}

export default NetworkHealthCard;
