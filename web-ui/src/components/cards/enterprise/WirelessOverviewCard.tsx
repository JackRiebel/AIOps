'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusSummary, StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import { MetricTile } from '../widgets/MetricTile';
import '../styles/cisco-theme.css';

export interface AccessPoint {
  id: string;
  name: string;
  model: string;
  status: StatusLevel;
  clients: number;
  channel_2g: number;
  channel_5g: number;
  utilization_2g: number;
  utilization_5g: number;
  last_seen: string;
}

export interface SSID {
  name: string;
  clients: number;
  enabled: boolean;
  band: string;
}

export interface ChannelInfo {
  channel: number;
  utilization: number;
  interference: number;
}

export interface WirelessOverviewData {
  access_points: AccessPoint[];
  ssids: SSID[];
  channel_data: {
    '2.4GHz': ChannelInfo[];
    '5GHz': ChannelInfo[];
  };
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
  bands: string[];
  time_range: string;
}

export interface WirelessOverviewCardProps {
  networkId: string;
  orgId?: string;
  title?: string;
  pollingInterval?: number;
  initialData?: WirelessOverviewData;
  onAPClick?: (apId: string) => void;
  onDataUpdate?: (data: WirelessOverviewData) => void;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

export function WirelessOverviewCard({
  networkId,
  orgId,
  title = 'Wireless Overview',
  pollingInterval = 30000,
  initialData,
  onAPClick,
  onDataUpdate,
}: WirelessOverviewCardProps) {
  const [viewMode, setViewMode] = useState<'aps' | 'channels'>('aps');
  const [selectedBand, setSelectedBand] = useState<'2.4GHz' | '5GHz'>('5GHz');

  const endpoint = `/api/cards/wireless-overview/${networkId}/data${orgId ? `?org_id=${orgId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<WirelessOverviewData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: WirelessOverviewData };
      return response.data || (raw as WirelessOverviewData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const getUtilizationColor = (value: number) => {
    if (value >= 80) return STATUS_COLORS.critical;
    if (value >= 60) return STATUS_COLORS.warning;
    return STATUS_COLORS.healthy;
  };

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load wireless data</p>
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
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-12 rounded" />
              ))}
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

            {/* View Toggle */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
              <button
                onClick={() => setViewMode('aps')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  viewMode === 'aps'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Access Points
              </button>
              <button
                onClick={() => setViewMode('channels')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  viewMode === 'channels'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Channels
              </button>
            </div>

            {/* AP List */}
            {viewMode === 'aps' && data.access_points && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {data.access_points.map((ap) => (
                  <div
                    key={ap.id}
                    className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    onClick={() => onAPClick?.(ap.id)}
                  >
                    {/* Status & Icon */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                        </svg>
                      </div>
                      <span
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900"
                        style={{ backgroundColor: STATUS_COLORS[ap.status] }}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{ap.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {ap.model} • {ap.clients} clients
                      </div>
                    </div>

                    {/* Utilization */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">2.4G</span>
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${ap.utilization_2g}%`,
                              backgroundColor: getUtilizationColor(ap.utilization_2g),
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <span className="text-gray-500">5G</span>
                        <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${ap.utilization_5g}%`,
                              backgroundColor: getUtilizationColor(ap.utilization_5g),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Channel View */}
            {viewMode === 'channels' && data.channel_data && (
              <div className="space-y-3">
                {/* Band Toggle */}
                <div className="flex gap-2">
                  {(['2.4GHz', '5GHz'] as const).map((band) => (
                    <button
                      key={band}
                      onClick={() => setSelectedBand(band)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedBand === band
                          ? 'bg-gray-200 dark:bg-gray-700 font-medium'
                          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {band}
                    </button>
                  ))}
                </div>

                {/* Channel Bars */}
                <div className="space-y-2">
                  {data.channel_data[selectedBand]?.map((ch) => (
                    <div key={ch.channel} className="flex items-center gap-2">
                      <span className="text-xs w-8 text-right text-gray-500 dark:text-gray-400">
                        Ch {ch.channel}
                      </span>
                      <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden relative">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${ch.utilization}%`,
                            backgroundColor: getUtilizationColor(ch.utilization),
                          }}
                        />
                        {ch.interference > 0 && (
                          <div
                            className="absolute top-0 h-full bg-red-500/30"
                            style={{
                              left: `${ch.utilization}%`,
                              width: `${Math.min(ch.interference, 100 - ch.utilization)}%`,
                            }}
                          />
                        )}
                      </div>
                      <span className="text-xs w-10 text-gray-500 dark:text-gray-400">
                        {ch.utilization}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS.healthy }} />
                    Utilization
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-500/30" />
                    Interference
                  </span>
                </div>
              </div>
            )}

            {/* SSIDs */}
            {data.ssids && data.ssids.length > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Active SSIDs
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.ssids.filter(s => s.enabled).map((ssid, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0" />
                      </svg>
                      {ssid.name}
                      <span className="text-gray-500">({ssid.clients})</span>
                    </span>
                  ))}
                </div>
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

export default WirelessOverviewCard;
