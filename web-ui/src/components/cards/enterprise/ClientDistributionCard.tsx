'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { MetricGrid } from '../widgets/MetricTile';
import { DataTable, Column } from '../widgets/DataTable';
import { StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import '../styles/cisco-theme.css';

export interface DistributionItem {
  name: string;
  count: number;
  color: string;
  percentage: number;
}

export interface ClientInfo {
  name: string;
  ip: string;
  mac: string;
  ssid: string;
  usage: string;
  signal: number;
  status: StatusLevel;
}

export interface ClientDistributionData {
  total_clients: number;
  distributions: {
    by_ssid: DistributionItem[];
    by_device_type: DistributionItem[];
    by_vlan: DistributionItem[];
  };
  top_clients: ClientInfo[];
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: { direction: 'up' | 'down' | 'stable'; percent?: number };
    status?: StatusLevel;
  }>;
  connection_quality: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  views: string[];
  default_view: string;
}

export interface ClientDistributionCardProps {
  networkId: string;
  orgId?: string;
  title?: string;
  pollingInterval?: number;
  initialData?: ClientDistributionData;
  onClientClick?: (clientMac: string) => void;
  onDataUpdate?: (data: ClientDistributionData) => void;
}

const CLIENT_COLUMNS: Column<ClientInfo>[] = [
  { key: 'name', label: 'Device', width: '25%' },
  { key: 'ssid', label: 'SSID', width: '20%' },
  { key: 'usage', label: 'Usage', align: 'right', width: '15%' },
  {
    key: 'signal',
    label: 'Signal',
    align: 'right',
    width: '15%',
    render: (value) => `${value} dBm`,
  },
  {
    key: 'status',
    label: 'Status',
    align: 'center',
    width: '10%',
    render: (value) => (
      <StatusIndicator
        status={value as StatusLevel}
        size="sm"
        showLabel={false}
      />
    ),
  },
];

export function ClientDistributionCard({
  networkId,
  orgId,
  title = 'Client Distribution',
  pollingInterval = 30000,
  initialData,
  onClientClick,
  onDataUpdate,
}: ClientDistributionCardProps) {
  const [view, setView] = useState<string>('by_ssid');

  const endpoint = `/api/cards/clients/${networkId}/data${orgId ? `?org_id=${orgId}` : ''}`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<ClientDistributionData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: ClientDistributionData };
      return response.data || (raw as ClientDistributionData);
    },
    onSuccess: onDataUpdate,
  });

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString();
  };

  const currentDistribution = data?.distributions?.[view as keyof typeof data.distributions] || [];

  if (error) {
    return (
      <div className="enterprise-card">
        <div className="enterprise-card-header">
          <h3 className="enterprise-card-title">{title}</h3>
        </div>
        <div className="enterprise-card-body text-center py-8">
          <p className="text-red-500 dark:text-red-400">Failed to load client data</p>
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
              {data.total_clients} total clients
            </p>
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
            <div className="skeleton h-32 rounded" />
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-12 rounded" />
              ))}
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <MetricGrid metrics={data.metrics} columns={4} size="sm" />
            )}

            {/* View Tabs */}
            {data.views && data.views.length > 1 && (
              <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
                {data.views.map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      view === v
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {v.replace('by_', '').replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </button>
                ))}
              </div>
            )}

            {/* Distribution Chart */}
            {currentDistribution.length > 0 && (
              <div className="flex gap-4">
                {/* Pie chart representation */}
                <div className="relative w-32 h-32 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90">
                    {currentDistribution.reduce(
                      (acc, item, index) => {
                        const startAngle = acc.offset;
                        const angle = (item.percentage / 100) * 360;
                        const endAngle = startAngle + angle;

                        const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                        const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                        const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                        const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                        const largeArc = angle > 180 ? 1 : 0;

                        const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

                        acc.elements.push(
                          <path
                            key={index}
                            d={path}
                            fill={item.color}
                            stroke="white"
                            strokeWidth="1"
                          />
                        );

                        return { elements: acc.elements, offset: endAngle };
                      },
                      { elements: [] as React.ReactNode[], offset: 0 }
                    ).elements}
                  </svg>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-2">
                  {currentDistribution.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {item.name}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.count}
                        </span>
                        <span className="text-gray-500 ml-1">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Connection Quality */}
            {data.connection_quality && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Connection Quality
                </h4>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Excellent: {data.connection_quality.excellent}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Good: {data.connection_quality.good}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Fair: {data.connection_quality.fair}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Poor: {data.connection_quality.poor}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Top Clients */}
            {data.top_clients && data.top_clients.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Top Clients by Usage
                </h4>
                <DataTable
                  columns={CLIENT_COLUMNS}
                  data={data.top_clients}
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

export default ClientDistributionCard;
