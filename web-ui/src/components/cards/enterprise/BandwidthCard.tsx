'use client';

import React from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { ProgressBarList } from '../widgets/ProgressBar';
import { MetricGrid } from '../widgets/MetricTile';
import { SparklineChart } from '../widgets/SparklineChart';
import { DataTable, Column } from '../widgets/DataTable';
import { StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import '../styles/cisco-theme.css';

export interface InterfaceData {
  label: string;
  value: number;
  status?: StatusLevel;
}

export interface TopTalker {
  name: string;
  ip: string;
  type: string;
  download: string;
  upload: string;
  total: string;
}

export interface BandwidthData {
  interfaces: InterfaceData[];
  top_talkers: TopTalker[];
  sparkline: number[];
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
    status?: StatusLevel;
    sparkline?: number[];
  }>;
  time_range: string;
}

export interface BandwidthCardProps {
  deviceSerial: string;
  orgId?: string;
  title?: string;
  pollingInterval?: number;
  initialData?: BandwidthData;
  onDataUpdate?: (data: BandwidthData) => void;
}

const TOP_TALKER_COLUMNS: Column<TopTalker>[] = [
  { key: 'name', label: 'Device', width: '30%' },
  { key: 'ip', label: 'IP', width: '25%' },
  { key: 'download', label: 'Down', align: 'right', width: '15%' },
  { key: 'upload', label: 'Up', align: 'right', width: '15%' },
  { key: 'total', label: 'Total', align: 'right', width: '15%' },
];

export function BandwidthCard({
  deviceSerial,
  orgId,
  title = 'Bandwidth Utilization',
  pollingInterval = 15000,
  initialData,
  onDataUpdate,
}: BandwidthCardProps) {
  const endpoint = `/api/cards/bandwidth/${deviceSerial}/data${orgId ? `?org_id=${orgId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<BandwidthData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: BandwidthData };
      return response.data || (raw as BandwidthData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load bandwidth data</p>
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
            <div className="skeleton h-12 rounded" />
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-6 rounded" />
              ))}
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Overall Sparkline */}
            {data.sparkline && data.sparkline.length > 0 && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <SparklineChart
                  data={data.sparkline}
                  height={60}
                  color="#049FD9"
                  showArea
                  showEndpoint
                />
              </div>
            )}

            {/* Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <MetricGrid metrics={data.metrics} columns={3} size="sm" />
            )}

            {/* Interface Utilization */}
            {data.interfaces && data.interfaces.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Interface Utilization
                </h4>
                <ProgressBarList items={data.interfaces} size="sm" />
              </div>
            )}

            {/* Top Talkers */}
            {data.top_talkers && data.top_talkers.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Top Talkers
                </h4>
                <DataTable
                  columns={TOP_TALKER_COLUMNS}
                  data={data.top_talkers}
                  maxRows={5}
                  size="sm"
                />
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

export default BandwidthCard;
