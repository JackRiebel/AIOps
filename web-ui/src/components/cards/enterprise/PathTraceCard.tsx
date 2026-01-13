'use client';

import React, { useState } from 'react';
import { usePollingCard } from '../hooks/usePollingCard';
import { StatusIndicator, StatusLevel } from '../widgets/StatusIndicator';
import { MetricGrid } from '../widgets/MetricTile';
import { DeviceIcon, DeviceType } from '../widgets/DeviceIcon';
import '../styles/cisco-theme.css';

export interface PathHop {
  hop: number;
  name: string;
  ip: string;
  type: DeviceType;
  latency: number;
  loss: number;
  status: StatusLevel;
  location?: string;
}

export interface PathTraceData {
  source: {
    name: string;
    ip: string;
    type: DeviceType;
  };
  destination: {
    name: string;
    ip: string;
    type: DeviceType;
  };
  hops: PathHop[];
  metrics: Array<{
    label: string;
    value: string | number;
    unit?: string;
    status?: StatusLevel;
  }>;
  summary: {
    total_hops: number;
    total_latency: number;
    avg_loss: number;
    status: StatusLevel;
  };
  timestamp: string;
}

export interface PathTraceCardProps {
  source: string;
  destination: string;
  title?: string;
  pollingInterval?: number;
  initialData?: PathTraceData;
  onHopClick?: (hop: PathHop) => void;
  onDataUpdate?: (data: PathTraceData) => void;
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  healthy: '#00A86B',
  warning: '#F5A623',
  critical: '#D0021B',
  offline: '#8E8E93',
  unknown: '#C7C7CC',
};

export function PathTraceCard({
  source,
  destination,
  title = 'Path Trace',
  pollingInterval = 30000,
  initialData,
  onHopClick,
  onDataUpdate,
}: PathTraceCardProps) {
  const [hoveredHop, setHoveredHop] = useState<number | null>(null);

  const endpoint = `/api/cards/path-trace/${encodeURIComponent(source)}/${encodeURIComponent(destination)}/data`;

  const { data, loading, error, lastUpdated, refresh, isPaused, pause, resume } = usePollingCard<PathTraceData>({
    endpoint,
    interval: pollingInterval,
    initialData,
    transform: (raw: unknown) => {
      const response = raw as { data?: PathTraceData };
      return response.data || (raw as PathTraceData);
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
          <p className="text-red-500 dark:text-red-400">Failed to trace path</p>
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
              {data.source.name} → {data.destination.name}
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
            <div className="skeleton h-8 w-48 rounded" />
            <div className="flex items-center gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-16 w-16 rounded-full" />
              ))}
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary Metrics */}
            {data.metrics && data.metrics.length > 0 && (
              <MetricGrid metrics={data.metrics} columns={4} size="sm" />
            )}

            {/* Path Visualization */}
            <div className="relative p-4 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-x-auto">
              <div className="flex items-center min-w-max">
                {/* Source */}
                <div className="flex flex-col items-center">
                  <DeviceIcon
                    type={data.source.type}
                    status="healthy"
                    size="md"
                  />
                  <span className="mt-1 text-xs font-medium text-gray-900 dark:text-white">
                    {data.source.name}
                  </span>
                  <span className="text-xs text-gray-500">{data.source.ip}</span>
                </div>

                {/* Hops */}
                {data.hops.map((hop, index) => (
                  <React.Fragment key={hop.hop}>
                    {/* Connection Line */}
                    <div className="relative flex-shrink-0 w-16 h-1 mx-1">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[hop.status] }}
                      />
                      {/* Latency Label */}
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                        <span className="text-xs text-gray-500">
                          {hop.latency.toFixed(1)}ms
                        </span>
                      </div>
                    </div>

                    {/* Hop Node */}
                    <div
                      className={`flex flex-col items-center cursor-pointer transition-transform ${
                        hoveredHop === hop.hop ? 'scale-110' : ''
                      }`}
                      onMouseEnter={() => setHoveredHop(hop.hop)}
                      onMouseLeave={() => setHoveredHop(null)}
                      onClick={() => onHopClick?.(hop)}
                    >
                      <div className="relative">
                        <DeviceIcon
                          type={hop.type}
                          status={hop.status}
                          size="md"
                        />
                        {/* Hop Number Badge */}
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-600 text-white text-xs flex items-center justify-center">
                          {hop.hop}
                        </div>
                      </div>
                      <span className="mt-1 text-xs font-medium text-gray-900 dark:text-white max-w-[60px] truncate">
                        {hop.name}
                      </span>
                      <span className="text-xs text-gray-500">{hop.ip}</span>
                    </div>
                  </React.Fragment>
                ))}

                {/* Final Connection to Destination */}
                <div className="relative flex-shrink-0 w-16 h-1 mx-1">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[data.summary.status] }}
                  />
                </div>

                {/* Destination */}
                <div className="flex flex-col items-center">
                  <DeviceIcon
                    type={data.destination.type}
                    status="healthy"
                    size="md"
                  />
                  <span className="mt-1 text-xs font-medium text-gray-900 dark:text-white">
                    {data.destination.name}
                  </span>
                  <span className="text-xs text-gray-500">{data.destination.ip}</span>
                </div>
              </div>
            </div>

            {/* Hop Details Table */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Hop Details
              </h4>
              <div className="space-y-2">
                {data.hops.map((hop) => (
                  <div
                    key={hop.hop}
                    className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer ${
                      hoveredHop === hop.hop
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onMouseEnter={() => setHoveredHop(hop.hop)}
                    onMouseLeave={() => setHoveredHop(null)}
                    onClick={() => onHopClick?.(hop)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                        {hop.hop}
                      </div>
                      <StatusIndicator status={hop.status} size="sm" showLabel={false} />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {hop.name}
                        </div>
                        <div className="text-xs text-gray-500">{hop.ip}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {hop.latency.toFixed(1)} ms
                        </div>
                        <div className="text-xs text-gray-500">Latency</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm ${hop.loss > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                          {hop.loss.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Loss</div>
                      </div>
                      {hop.location && (
                        <div className="text-right">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {hop.location}
                          </div>
                          <div className="text-xs text-gray-500">Location</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <StatusIndicator status={data.summary.status} size="md" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Path Status
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {data.summary.total_hops}
                  </div>
                  <div className="text-xs text-gray-500">Hops</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {data.summary.total_latency.toFixed(1)} ms
                  </div>
                  <div className="text-xs text-gray-500">Total Latency</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-semibold ${data.summary.avg_loss > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                    {data.summary.avg_loss.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">Avg Loss</div>
                </div>
              </div>
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
          />
          <span>{isPaused ? 'Paused' : 'Live'}</span>
        </span>
      </div>
    </div>
  );
}

export default PathTraceCard;
