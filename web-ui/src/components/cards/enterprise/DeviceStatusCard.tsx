'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { DeviceGrid, DeviceType } from '../widgets/DeviceIcon';
import { StatusSummary, StatusLevel } from '../widgets/StatusIndicator';
import '../styles/cisco-theme.css';

export interface DeviceData {
  id: string;
  name: string;
  type: DeviceType;
  model?: string;
  status: StatusLevel;
  ip?: string;
  mac?: string;
}

export interface DeviceStatusData {
  devices: DeviceData[];
  summary: Array<{
    status: StatusLevel;
    label: string;
    count: number;
    pulse?: boolean;
  }>;
  total: number;
  filters: string[];
}

export interface DeviceStatusCardProps {
  networkId: string;
  orgId?: string;
  title?: string;
  pollingInterval?: number;
  initialData?: DeviceStatusData;
  onDeviceClick?: (deviceId: string) => void;
  onDataUpdate?: (data: DeviceStatusData) => void;
}

export function DeviceStatusCard({
  networkId,
  orgId,
  title = 'Device Status',
  pollingInterval = 15000,
  initialData,
  onDeviceClick,
  onDataUpdate,
}: DeviceStatusCardProps) {
  const [filter, setFilter] = useState<string>('all');

  const endpoint = `/api/cards/device-status/${networkId}/data${orgId ? `?org_id=${orgId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<DeviceStatusData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: DeviceStatusData };
      return response.data || (raw as DeviceStatusData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const filteredDevices = data?.devices?.filter((device) => {
    if (filter === 'all') return true;
    return device.type === filter;
  }) || [];

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load device data</p>
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
          {data && (
            <p className="enterprise-card-subtitle">
              {data.total} devices
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
            <div className="flex gap-4">
              <div className="skeleton h-6 w-20 rounded" />
              <div className="skeleton h-6 w-20 rounded" />
              <div className="skeleton h-6 w-20 rounded" />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="skeleton h-20 rounded" />
              ))}
            </div>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Status Summary */}
            {data.summary && (
              <StatusSummary summary={data.summary} />
            )}

            {/* Filter Tabs */}
            {data.filters && data.filters.length > 1 && (
              <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
                {data.filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      filter === f
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* Device Grid */}
            {filteredDevices.length > 0 ? (
              <DeviceGrid
                devices={filteredDevices}
                size="md"
                columns={4}
                onDeviceClick={onDeviceClick}
              />
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No devices match the current filter
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="enterprise-card-footer">
        <span>Last updated: {formatTime(lastUpdated)}</span>
        <span>
          Showing {filteredDevices.length} of {data?.total || 0}
        </span>
      </div>
    </div>
  );
}

export default DeviceStatusCard;
